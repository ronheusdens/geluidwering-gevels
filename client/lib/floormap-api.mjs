/**
 * Floormap room subsection API — engineer-only.
 * POST/GET/DELETE /api/floormap/subsections
 * POST /api/floormap/scale
 * Auth: Bearer token or acoustics_session cookie.
 */
import { getPool } from "./pg-config.mjs";
import {
  corsHeaders,
  jsonWithSecurity,
  parseSessionToken,
  requireHttpsOrReject,
  securityHeaders,
} from "./http-security.mjs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEVELS = new Set(["GROUND", "FIRST", "SECOND", "THIRD", "ROOF", "OTHER"]);

function json(req, res, status, body) {
  jsonWithSecurity(req, res, status, body);
}

async function resolveEngineerSession(client, token) {
  const { rows } = await client.query(
    `SELECT u.id::text AS user_id, u.username, u.is_engineer
     FROM acoustics.login_session s
     JOIN acoustics.service_user u ON u.id = s.user_id
     WHERE s.token = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       AND u.is_active = true`,
    [token],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.username !== "engineer" && row.username !== "admin" && !row.is_engineer) {
    return null;
  }
  return row;
}

function readJsonBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        reject(Object.assign(new Error("Payload too large"), { code: "LIMIT" }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function shoelaceArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += Number(a.x) * Number(b.y) - Number(b.x) * Number(a.y);
  }
  return Math.abs(sum) / 2;
}

function polylinePerimeter(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = Number(b.x) - Number(a.x);
    const dy = Number(b.y) - Number(a.y);
    sum += Math.hypot(dx, dy);
  }
  return sum;
}

function normalizePoints(points) {
  if (!Array.isArray(points) || points.length < 3) return null;
  const out = [];
  for (const p of points) {
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return null;
    out.push({
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
    });
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) > 1e-6) {
    out.push({ ...first });
  }
  return out;
}

export function handleFloormapApiOptions(req, res) {
  res.writeHead(204, {
    ...corsHeaders(req),
    ...securityHeaders(req),
  });
  res.end();
}

const SCALABLE_KINDS = ["FLOORMAP", "FACADE", "SECTION", "CROSS_SECTION"];

const SECTION_SELECT_SQL = `SELECT r.id::text AS id,
              r.document_id::text AS document_id,
              r.page_index,
              r.label,
              r.region_kind,
              r.x_min, r.y_min, r.x_max, r.y_max,
              r.scale_ratio,
              r.metres_per_norm_unit,
              r.scale_source,
              r.analysis_status,
              (SELECT COUNT(*)::int FROM acoustics.drawing_subsection s WHERE s.section_id = r.id) AS room_count
       FROM acoustics.drawing_region r`;

/** GET /api/floormap/section?section_id= — one scalable section (floormap/façade/…) */
export async function handleFloormapSectionGet(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
  if (req.method !== "GET") {
    json(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "session required (Bearer or cookie)" });
    return;
  }
  const sectionId = (url.searchParams.get("section_id") || "").trim();
  if (!UUID_RE.test(sectionId)) {
    json(req, res, 400, { ok: false, error: "invalid section_id" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveEngineerSession(client, token);
    if (!session) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }
    const { rows } = await client.query(
      `${SECTION_SELECT_SQL}
       WHERE r.id = $1::uuid
         AND r.region_kind = ANY($2::text[])`,
      [sectionId, SCALABLE_KINDS],
    );
    if (rows.length < 1) {
      json(req, res, 404, { ok: false, error: "scalable section not found" });
      return;
    }
    json(req, res, 200, { ok: true, section: rows[0] });
  } catch (err) {
    console.error("floormap section get failed:", err);
    json(req, res, 500, { ok: false, error: "failed to load section" });
  } finally {
    client.release();
  }
}

/** GET /api/floormap/sections?building_id=  (floormaps, façades, sections, cross-sections) */
export async function handleFloormapSectionsList(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
  if (req.method !== "GET") {
    json(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "session required (Bearer or cookie)" });
    return;
  }
  const buildingId = (url.searchParams.get("building_id") || "").trim();
  if (!UUID_RE.test(buildingId)) {
    json(req, res, 400, { ok: false, error: "invalid building_id" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveEngineerSession(client, token);
    if (!session) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }
    const { rows } = await client.query(
      `${SECTION_SELECT_SQL}
       WHERE r.building_id = $1::uuid
         AND r.region_kind = ANY($2::text[])
       ORDER BY r.sort_order ASC, r.created_at ASC`,
      [buildingId, SCALABLE_KINDS],
    );
    json(req, res, 200, { ok: true, building_id: buildingId, sections: rows });
  } catch (err) {
    console.error("floormap sections list failed:", err);
    json(req, res, 500, { ok: false, error: "failed to list scalable sections" });
  } finally {
    client.release();
  }
}

/** GET /api/floormap/subsections?section_id= */
export async function handleFloormapSubsectionsList(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
  if (req.method !== "GET") {
    json(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "Authorization: Bearer <session_token> required" });
    return;
  }
  const sectionId = (url.searchParams.get("section_id") || "").trim();
  if (!UUID_RE.test(sectionId)) {
    json(req, res, 400, { ok: false, error: "invalid section_id" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveEngineerSession(client, token);
    if (!session) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }
    const { rows } = await client.query(
      `SELECT s.id::text AS id,
              s.section_id::text AS section_id,
              s.label,
              s.level_hint,
              s.geom_kind,
              s.points,
              s.area_norm,
              s.perimeter_norm,
              s.area_m2,
              s.perimeter_m,
              s.metres_per_norm_unit,
              s.analysis_status,
              s.sort_order
       FROM acoustics.drawing_subsection s
       WHERE s.section_id = $1::uuid
       ORDER BY s.sort_order ASC, s.created_at ASC`,
      [sectionId],
    );
    json(req, res, 200, { ok: true, section_id: sectionId, subsections: rows });
  } catch (err) {
    console.error("floormap subsections list failed:", err);
    json(req, res, 500, { ok: false, error: "failed to list subsections" });
  } finally {
    client.release();
  }
}

/** POST /api/floormap/subsections  body: { section_id, label, level_hint, points, subsection_id?, metres_per_norm_unit? } */
export async function handleFloormapSubsectionSave(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  if (req.method !== "POST") {
    json(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "Authorization: Bearer <session_token> required" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "LIMIT") {
      json(req, res, 413, { ok: false, error: "payload too large" });
      return;
    }
    json(req, res, 400, { ok: false, error: "invalid JSON body" });
    return;
  }

  const sectionId = String(body.section_id || "").trim();
  const subsectionId = String(body.subsection_id || "").trim();
  const label = String(body.label || "Room").trim().slice(0, 200) || "Room";
  let levelHint = String(body.level_hint || "OTHER").trim().toUpperCase();
  if (!LEVELS.has(levelHint)) levelHint = "OTHER";
  const points = normalizePoints(body.points);
  if (!UUID_RE.test(sectionId)) {
    json(req, res, 400, { ok: false, error: "invalid section_id" });
    return;
  }
  if (!points) {
    json(req, res, 400, { ok: false, error: "points must be a closed polyline with ≥3 vertices in 0–1" });
    return;
  }
  if (subsectionId && !UUID_RE.test(subsectionId)) {
    json(req, res, 400, { ok: false, error: "invalid subsection_id" });
    return;
  }

  const areaNorm = shoelaceArea(points);
  const periNorm = polylinePerimeter(points);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveEngineerSession(client, token);
    if (!session) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }

    const { rows: secRows } = await client.query(
      `SELECT r.id::text AS id,
              r.building_id::text AS building_id,
              r.document_id::text AS document_id,
              r.page_index,
              r.metres_per_norm_unit
       FROM acoustics.drawing_region r
       WHERE r.id = $1::uuid
         AND r.region_kind = ANY($2::text[])`,
      [sectionId, SCALABLE_KINDS],
    );
    if (secRows.length < 1) {
      json(req, res, 404, { ok: false, error: "scalable section not found" });
      return;
    }
    const sec = secRows[0];
    const bodyMpu = body.metres_per_norm_unit != null ? Number(body.metres_per_norm_unit) : NaN;
    const secMpu = sec.metres_per_norm_unit != null ? Number(sec.metres_per_norm_unit) : NaN;
    const mpu =
      Number.isFinite(bodyMpu) && bodyMpu > 0
        ? bodyMpu
        : Number.isFinite(secMpu) && secMpu > 0
          ? secMpu
          : null;
    const areaM2 = mpu != null ? areaNorm * mpu * mpu : null;
    const periM = mpu != null ? periNorm * mpu : null;

    let row;
    if (subsectionId) {
      const upd = await client.query(
        `UPDATE acoustics.drawing_subsection SET
           label = $2,
           level_hint = $3,
           points = $4::jsonb,
           area_norm = $5,
           perimeter_norm = $6,
           area_m2 = $7,
           perimeter_m = $8,
           metres_per_norm_unit = $9,
           analysis_status = 'READY_FOR_ANALYSIS',
           updated_at = now()
         WHERE id = $1::uuid AND section_id = $10::uuid
         RETURNING id::text AS id, area_norm, perimeter_norm, area_m2, perimeter_m, metres_per_norm_unit`,
        [
          subsectionId,
          label,
          levelHint,
          JSON.stringify(points),
          areaNorm,
          periNorm,
          areaM2,
          periM,
          mpu,
          sectionId,
        ],
      );
      if (upd.rows.length < 1) {
        json(req, res, 404, { ok: false, error: "subsection not found" });
        return;
      }
      row = upd.rows[0];
    } else {
      const ins = await client.query(
        `INSERT INTO acoustics.drawing_subsection
           (section_id, building_id, document_id, page_index, label, level_hint, geom_kind,
            points, area_norm, perimeter_norm, area_m2, perimeter_m, metres_per_norm_unit,
            analysis_status, created_by)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, 'POLYLINE',
                 $7::jsonb, $8, $9, $10, $11, $12, 'READY_FOR_ANALYSIS', $13::uuid)
         RETURNING id::text AS id, area_norm, perimeter_norm, area_m2, perimeter_m, metres_per_norm_unit`,
        [
          sectionId,
          sec.building_id,
          sec.document_id,
          sec.page_index,
          label,
          levelHint,
          JSON.stringify(points),
          areaNorm,
          periNorm,
          areaM2,
          periM,
          mpu,
          session.user_id,
        ],
      );
      row = ins.rows[0];
    }

    json(req, res, subsectionId ? 200 : 201, {
      ok: true,
      subsection_id: row.id,
      area_norm: Number(row.area_norm),
      perimeter_norm: Number(row.perimeter_norm),
      area_m2: row.area_m2 != null ? Number(row.area_m2) : null,
      perimeter_m: row.perimeter_m != null ? Number(row.perimeter_m) : null,
      metres_per_norm_unit: row.metres_per_norm_unit != null ? Number(row.metres_per_norm_unit) : null,
    });
  } catch (err) {
    console.error("floormap subsection save failed:", err);
    json(req, res, 500, { ok: false, error: "failed to save subsection" });
  } finally {
    client.release();
  }
}

/** DELETE /api/floormap/subsections?subsection_id= */
export async function handleFloormapSubsectionDelete(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
  if (req.method !== "DELETE") {
    json(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "Authorization: Bearer <session_token> required" });
    return;
  }
  const subsectionId = (url.searchParams.get("subsection_id") || "").trim();
  if (!UUID_RE.test(subsectionId)) {
    json(req, res, 400, { ok: false, error: "invalid subsection_id" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveEngineerSession(client, token);
    if (!session) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }
    const { rows } = await client.query(
      `DELETE FROM acoustics.drawing_subsection WHERE id = $1::uuid RETURNING id::text AS id`,
      [subsectionId],
    );
    if (rows.length < 1) {
      json(req, res, 404, { ok: false, error: "subsection not found" });
      return;
    }
    json(req, res, 200, { ok: true, deleted_subsection_id: rows[0].id });
  } catch (err) {
    console.error("floormap subsection delete failed:", err);
    json(req, res, 500, { ok: false, error: "failed to delete subsection" });
  } finally {
    client.release();
  }
}

/** POST /api/floormap/scale  body: { section_id, metres_per_norm_unit, scale_ratio?, scale_source } */
export async function handleFloormapScaleSave(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  if (req.method !== "POST") {
    json(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "Authorization: Bearer <session_token> required" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req, 64 * 1024);
  } catch {
    json(req, res, 400, { ok: false, error: "invalid JSON body" });
    return;
  }

  const sectionId = String(body.section_id || "").trim();
  const mpu = Number(body.metres_per_norm_unit);
  const scaleRatio = body.scale_ratio != null ? Number(body.scale_ratio) : null;
  let source = String(body.scale_source || "CALIBRATED").trim().toUpperCase();
  if (!["PDF_TEXT", "CALIBRATED", "NONE"].includes(source)) source = "CALIBRATED";

  if (!UUID_RE.test(sectionId)) {
    json(req, res, 400, { ok: false, error: "invalid section_id" });
    return;
  }
  if (!(mpu > 0) || !Number.isFinite(mpu)) {
    json(req, res, 400, { ok: false, error: "metres_per_norm_unit must be a positive number" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await resolveEngineerSession(client, token);
    if (!session) {
      await client.query("ROLLBACK");
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }

    const { rows } = await client.query(
      `UPDATE acoustics.drawing_region SET
         metres_per_norm_unit = $2,
         scale_ratio = $3,
         scale_source = $4,
         updated_at = now()
       WHERE id = $1::uuid
         AND region_kind IN ('FLOORMAP', 'FACADE', 'SECTION', 'CROSS_SECTION')
       RETURNING id::text AS id`,
      [sectionId, mpu, scaleRatio, source],
    );
    if (rows.length < 1) {
      await client.query("ROLLBACK");
      json(req, res, 404, { ok: false, error: "scalable section not found" });
      return;
    }

    await client.query(
      `UPDATE acoustics.drawing_subsection SET
         metres_per_norm_unit = $2,
         area_m2 = area_norm * $2 * $2,
         perimeter_m = perimeter_norm * $2,
         updated_at = now()
       WHERE section_id = $1::uuid
         AND area_norm IS NOT NULL
         AND perimeter_norm IS NOT NULL`,
      [sectionId, mpu],
    );

    await client.query("COMMIT");
    json(req, res, 200, {
      ok: true,
      section_id: sectionId,
      metres_per_norm_unit: mpu,
      scale_ratio: scaleRatio,
      scale_source: source,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("floormap scale save failed:", err);
    json(req, res, 500, { ok: false, error: "failed to save scale" });
  } finally {
    client.release();
  }
}
