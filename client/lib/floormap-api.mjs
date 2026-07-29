/**
 * Floormap room subsection API — engineer-only.
 * POST/GET/DELETE /api/floormap/subsections
 * POST /api/floormap/scale
 * Auth: Bearer token or app_gevelwering_session cookie.
 */
import { getPool } from "./pg-config.mjs";
import {
  corsHeaders,
  jsonWithSecurity,
  parseSessionToken,
  requireHttpsOrReject,
  securityHeaders,
} from "./http-security.mjs";
import { partitionVrGaComponents } from "./ga-vr-components.mjs";
import {
  MATERIAL_RUBRIEKEN,
  formatRubriekLabel,
  formatSubrubriekLabel,
  isLengthQuantityRubriek,
  rubriekByName,
  subrubriekenFor,
} from "./material-taxonomy.mjs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEVELS = new Set(["GROUND", "FIRST", "SECOND", "THIRD", "ROOF", "OTHER"]);

function json(req, res, status, body) {
  jsonWithSecurity(req, res, status, body);
}

async function resolveEngineerSession(client, token) {
  const { rows } = await client.query(
    `SELECT u.id::text AS user_id, u.username, u.is_engineer
     FROM app_gevelwering.login_session s
     JOIN app_gevelwering.service_user u ON u.id = s.user_id
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

function normalizeAspectYx(aspectYx) {
  const a = Number(aspectYx);
  if (!Number.isFinite(a) || a <= 0) return 1;
  return a;
}

function scaledAreaM2(areaNorm, mpu, aspectYx) {
  const a = normalizeAspectYx(aspectYx);
  return areaNorm * mpu * mpu * a;
}

function scaledPathLength(points, mpu, aspectYx, closed = false) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  const a = normalizeAspectYx(aspectYx);
  const mx = mpu;
  const my = mpu * a;
  let sum = 0;
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const dx = Number(p1.x) - Number(p0.x);
    const dy = Number(p1.y) - Number(p0.y);
    sum += Math.hypot(dx * mx, dy * my);
  }
  return sum;
}

/**
 * Prefer live area from area_norm × current section scale over a possibly stale area_m2 column.
 */
function liveAreaM2FromRow(row) {
  const a =
    row.analysis && typeof row.analysis === "object" && !Array.isArray(row.analysis)
      ? row.analysis
      : {};
  if (String(a.quantity_kind || "") === "length") return null;
  const mpuRaw = row.metres_per_norm_unit ?? row.region_mpu;
  const mpu = mpuRaw != null ? Number(mpuRaw) : NaN;
  const aspect = normalizeAspectYx(row.region_aspect_yx ?? 1);
  const areaNorm = row.area_norm != null ? Number(row.area_norm) : NaN;
  if (Number.isFinite(mpu) && mpu > 0 && Number.isFinite(areaNorm) && areaNorm > 0) {
    return Math.round(scaledAreaM2(areaNorm, mpu, aspect) * 100) / 100;
  }
  return row.area_m2 != null && Number.isFinite(Number(row.area_m2)) ? Number(row.area_m2) : null;
}

function liveLengthMFromRow(row) {
  const a =
    row.analysis && typeof row.analysis === "object" && !Array.isArray(row.analysis)
      ? row.analysis
      : {};
  if (a.length_m != null && Number.isFinite(Number(a.length_m))) return Number(a.length_m);
  return null;
}

function normalizeRing(points, { allowEmpty = false } = {}) {
  if (!Array.isArray(points) || points.length < 3) return allowEmpty ? [] : null;
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

/** Open path (≥2 points), clamped — no auto-close. */
function normalizePath(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
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
  return out;
}

function normalizePoints(points) {
  return normalizeRing(points);
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

function openPolylineLength(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    sum += Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y));
  }
  return sum;
}

/** Optional hole rings for difference results (net area = outer − holes). */
function normalizeHoles(raw) {
  if (!Array.isArray(raw) || raw.length < 1) return [];
  const holes = [];
  for (const ring of raw) {
    const n = normalizeRing(ring);
    if (n && shoelaceArea(n) > 1e-12) holes.push(n);
  }
  return holes;
}

function netAreaNorm(outer, holes) {
  const holeSum = (holes || []).reduce((s, h) => s + shoelaceArea(h), 0);
  return Math.max(0, shoelaceArea(outer) - holeSum);
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
              r.scale_aspect_yx,
              r.scale_source,
              r.analysis_status,
              (SELECT COUNT(*)::int FROM app_gevelwering.drawing_subsection s WHERE s.section_id = r.id) AS room_count
       FROM app_gevelwering.drawing_region r`;

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
              s.vg_nr,
              s.vr_nr,
              s.geom_kind,
              s.points,
              s.area_norm,
              s.perimeter_norm,
              s.area_m2,
              s.perimeter_m,
              s.metres_per_norm_unit,
              s.analysis_status,
              s.analysis,
              s.sort_order,
              r.metres_per_norm_unit AS region_mpu,
              r.scale_aspect_yx AS region_aspect_yx
       FROM app_gevelwering.drawing_subsection s
       JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
       WHERE s.section_id = $1::uuid
       ORDER BY s.sort_order ASC, s.created_at ASC`,
      [sectionId],
    );
    json(req, res, 200, {
      ok: true,
      section_id: sectionId,
      subsections: rows.map((s) => {
        const liveArea = liveAreaM2FromRow(s);
        const a =
          s.analysis && typeof s.analysis === "object" && !Array.isArray(s.analysis)
            ? { ...s.analysis }
            : {};
        if (liveArea != null) a.area_m2 = liveArea;
        return {
          ...s,
          area_m2: liveArea != null ? liveArea : s.area_m2 != null ? Number(s.area_m2) : null,
          analysis: a,
        };
      }),
    });
  } catch (err) {
    console.error("floormap subsections list failed:", err);
    json(req, res, 500, { ok: false, error: "failed to list subsections" });
  } finally {
    client.release();
  }
}

/**
 * GET /api/floormap/vr-components?building_id=&vr_nr=
 * Façade/section components for one VR, ready for GA gevelwering.
 * Excludes boolean/set sources to avoid double-counting composites.
 */
export async function handleFloormapVrComponentsList(req, res, url) {
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
  const buildingId = (url.searchParams.get("building_id") || "").trim();
  const vrNr = (url.searchParams.get("vr_nr") || "").trim();
  if (!UUID_RE.test(buildingId)) {
    json(req, res, 400, { ok: false, error: "invalid building_id" });
    return;
  }
  if (!vrNr || !/^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$/.test(vrNr)) {
    json(req, res, 400, { ok: false, error: "invalid vr_nr" });
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

    // Load all scalable non-floormap components in the building so source
    // references across façades are visible when excluding boolean inputs.
    const { rows } = await client.query(
      `SELECT s.id::text AS id,
              s.section_id::text AS section_id,
              r.region_kind,
              r.label AS section_label,
              s.label,
              s.level_hint,
              s.vg_nr,
              s.vr_nr,
              s.area_norm,
              s.area_m2,
              s.metres_per_norm_unit,
              s.analysis,
              r.metres_per_norm_unit AS region_mpu,
              r.scale_aspect_yx AS region_aspect_yx
       FROM app_gevelwering.drawing_subsection s
       JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
       WHERE s.building_id = $1::uuid
         AND r.region_kind = ANY($2::text[])
       ORDER BY r.label ASC NULLS LAST, s.sort_order ASC, s.created_at ASC`,
      [buildingId, ["FACADE", "SECTION", "CROSS_SECTION"]],
    );

    const part = partitionVrGaComponents(rows, vrNr);
    const matIds = [
      ...new Set(
        part.eligible
          .map((s) => (s.material_id != null ? String(s.material_id) : ""))
          .filter((id) => UUID_RE.test(id)),
      ),
    ];
    /** @type {Map<string, number|null>} */
    const raByMaterial = new Map();
    if (matIds.length) {
      const { rows: mats } = await client.query(
        `SELECT id::text AS id, ra_dba
         FROM app_gevelwering.material
         WHERE id = ANY($1::uuid[])`,
        [matIds],
      );
      for (const m of mats) {
        raByMaterial.set(
          String(m.id),
          m.ra_dba != null && Number.isFinite(Number(m.ra_dba)) ? Number(m.ra_dba) : null,
        );
      }
    }
    json(req, res, 200, {
      ok: true,
      building_id: buildingId,
      vr_nr: part.vr_nr,
      rule: "include matching VR; exclude same-material boolean sources and geometry-only outlines",
      eligible: part.eligible.map((s) => {
        const a =
          s.analysis && typeof s.analysis === "object" && !Array.isArray(s.analysis)
            ? s.analysis
            : {};
        const qkind =
          a.quantity_kind != null
            ? String(a.quantity_kind)
            : a.length_m != null
              ? "length"
              : "area";
        const mid = s.material_id != null ? String(s.material_id) : "";
        const liveArea = qkind === "length" ? null : liveAreaM2FromRow(s);
        const liveLen = qkind === "length" ? liveLengthMFromRow(s) : null;
        return {
          id: s.id,
          section_id: s.section_id,
          region_kind: s.region_kind,
          section_label: s.section_label,
          label: s.label,
          vg_nr: s.vg_nr != null ? Number(s.vg_nr) : null,
          vr_nr: s.vr_nr != null ? String(s.vr_nr) : null,
          // For length quantities (kierdichting) do not expose polygon area as the GA quantity.
          area_m2: liveArea,
          quantity_kind: qkind,
          length_m: liveLen,
          ga_ready: Boolean(s.ga_ready),
          material_id: s.material_id,
          master_category: s.master_category,
          material_name: s.material_name,
          ra_dba: mid && raByMaterial.has(mid) ? raByMaterial.get(mid) : null,
          boolean_op: a.boolean_op || null,
        };
      }),
      excluded_as_source: part.excluded_as_source.map((s) => ({
        id: s.id,
        label: s.label,
        vr_nr: s.vr_nr != null ? String(s.vr_nr) : null,
        area_m2: s.area_m2 != null ? Number(s.area_m2) : null,
      })),
      counts: {
        for_vr: part.for_vr_count,
        eligible: part.eligible.length,
        ga_ready: part.eligible.filter((s) => s.ga_ready).length,
        excluded_as_source: part.excluded_as_source.length,
      },
    });
  } catch (err) {
    console.error("floormap vr-components list failed:", err);
    json(req, res, 500, { ok: false, error: "failed to list VR components" });
  } finally {
    client.release();
  }
}

/** POST /api/floormap/subsections  body: { section_id, label, level_hint, vg_nr?, vr_nr?, points, subsection_id?, metres_per_norm_unit? } */
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

  const analysisHint =
    body.analysis != null && typeof body.analysis === "object" && !Array.isArray(body.analysis)
      ? body.analysis
      : {};
  const wantsLength =
    analysisHint.quantity_kind === "length" ||
    Boolean(body.open_path) ||
    isLengthQuantityRubriek(analysisHint.master_category) ||
    isLengthQuantityRubriek(analysisHint.rubriek_nr);

  let points = null;
  let openPath = false;
  if (wantsLength) {
    const path = normalizePath(body.points);
    const ring = normalizeRing(body.points);
    // Prefer explicit open path (≥2) when not a closed ring request.
    if (body.open_path && path) {
      points = path;
      openPath = true;
    } else if (ring) {
      points = ring;
      openPath = false;
    } else if (path) {
      points = path;
      openPath = true;
    }
  } else {
    points = normalizePoints(body.points);
  }

  if (!UUID_RE.test(sectionId)) {
    json(req, res, 400, { ok: false, error: "invalid section_id" });
    return;
  }
  if (!points) {
    json(req, res, 400, {
      ok: false,
      error: wantsLength
        ? "kierdichting: pad met ≥2 punten of gesloten polygoon (≥3) in 0–1"
        : "points must be a closed polyline with ≥3 vertices in 0–1",
    });
    return;
  }
  if (subsectionId && !UUID_RE.test(subsectionId)) {
    json(req, res, 400, { ok: false, error: "invalid subsection_id" });
    return;
  }

  const parseVg = (raw) => {
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) return NaN;
    return n;
  };
  const parseVr = (raw) => {
    if (raw === null || raw === undefined || raw === "") return null;
    const s = String(raw).trim();
    if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$/.test(s)) return NaN;
    return s;
  };
  const vgNr = parseVg(body.vg_nr);
  const vrNr = parseVr(body.vr_nr);
  if (Number.isNaN(vgNr) || Number.isNaN(vrNr)) {
    json(req, res, 400, {
      ok: false,
      error: "VG must be a positive whole number; VR must be like 3 or 3A (letters/digits, max 16)",
    });
    return;
  }
  if ((vgNr == null) !== (vrNr == null)) {
    json(req, res, 400, { ok: false, error: "VG and VR must both be set, or both empty" });
    return;
  }

  const holesFromBody = normalizeHoles(
    body.holes ??
      (body.analysis && typeof body.analysis === "object" ? body.analysis.holes : null),
  );

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
              r.region_kind,
              r.metres_per_norm_unit,
              r.scale_aspect_yx
       FROM app_gevelwering.drawing_region r
       WHERE r.id = $1::uuid
         AND r.region_kind = ANY($2::text[])`,
      [sectionId, SCALABLE_KINDS],
    );
    if (secRows.length < 1) {
      json(req, res, 404, { ok: false, error: "scalable section not found" });
      return;
    }
    const sec = secRows[0];
    if (sec.region_kind === "FLOORMAP" && (vgNr == null || vrNr == null)) {
      json(req, res, 400, { ok: false, error: "VG and VR numbers are required for floormap rooms" });
      return;
    }

    // VR must be unique among floormap rooms in a building; façade/section
    // components may share a VR (same verblijfsruimte) for later GA insulation.
    if (sec.region_kind === "FLOORMAP" && vrNr != null) {
      const { rows: dupRows } = await client.query(
        `SELECT s.id::text AS id
         FROM app_gevelwering.drawing_subsection s
         JOIN app_gevelwering.drawing_region r ON r.id = s.section_id
         WHERE s.building_id = $1::uuid
           AND s.vr_nr IS NOT NULL
           AND lower(s.vr_nr) = lower($2)
           AND r.region_kind = 'FLOORMAP'
           AND ($3::uuid IS NULL OR s.id <> $3::uuid)
         LIMIT 1`,
        [sec.building_id, vrNr, subsectionId || null],
      );
      if (dupRows.length > 0) {
        json(req, res, 409, {
          ok: false,
          error: "VR number already used on another room in this project",
        });
        return;
      }
    }

    let analysisObj = {};
    let holes = holesFromBody;
    if (subsectionId) {
      const { rows: prevRows } = await client.query(
        `SELECT analysis FROM app_gevelwering.drawing_subsection
         WHERE id = $1::uuid AND section_id = $2::uuid`,
        [subsectionId, sectionId],
      );
      if (prevRows.length < 1) {
        json(req, res, 404, { ok: false, error: "subsection not found" });
        return;
      }
      const prev =
        prevRows[0].analysis && typeof prevRows[0].analysis === "object" && !Array.isArray(prevRows[0].analysis)
          ? prevRows[0].analysis
          : {};
      analysisObj = { ...prev };
      if (!holes.length) {
        holes = normalizeHoles(prev.holes);
      }
    }
    if (body.analysis != null && typeof body.analysis === "object" && !Array.isArray(body.analysis)) {
      analysisObj = { ...analysisObj, ...body.analysis };
    }
    if (holesFromBody.length > 0) {
      analysisObj.holes = holesFromBody;
      holes = holesFromBody;
    } else if (holes.length > 0) {
      analysisObj.holes = holes;
    } else {
      delete analysisObj.holes;
    }
    if (openPath) {
      holes = [];
      delete analysisObj.holes;
    }

    const areaNorm = openPath ? 0 : netAreaNorm(points, holes);
    const periNorm = openPath ? openPolylineLength(points) : polylinePerimeter(points);
    const bodyMpu = body.metres_per_norm_unit != null ? Number(body.metres_per_norm_unit) : NaN;
    const secMpu = sec.metres_per_norm_unit != null ? Number(sec.metres_per_norm_unit) : NaN;
    const mpu =
      Number.isFinite(bodyMpu) && bodyMpu > 0
        ? bodyMpu
        : Number.isFinite(secMpu) && secMpu > 0
          ? secMpu
          : null;
    const bodyAspect = body.scale_aspect_yx != null ? Number(body.scale_aspect_yx) : NaN;
    const secAspect = sec.scale_aspect_yx != null ? Number(sec.scale_aspect_yx) : NaN;
    const aspect = normalizeAspectYx(
      Number.isFinite(bodyAspect) && bodyAspect > 0
        ? bodyAspect
        : Number.isFinite(secAspect) && secAspect > 0
          ? secAspect
          : 1,
    );
    const areaM2 =
      mpu != null ? Math.round(scaledAreaM2(areaNorm, mpu, aspect) * 100) / 100 : null;
    const periM =
      mpu != null
        ? Math.round(scaledPathLength(points, mpu, aspect, !openPath) * 100) / 100
        : null;

    const quantityKind =
      wantsLength ||
      isLengthQuantityRubriek(analysisObj.master_category) ||
      isLengthQuantityRubriek(analysisObj.rubriek_nr)
        ? "length"
        : "area";
    if (quantityKind === "length") {
      analysisObj.quantity_kind = "length";
      analysisObj.length_norm = periNorm;
      if (periM != null) analysisObj.length_m = periM;
      else delete analysisObj.length_m;
      analysisObj.open_path = openPath;
      // Area is not the GA quantity for kierdichting.
      delete analysisObj.area_m2;
      delete analysisObj.area_norm;
    } else {
      delete analysisObj.quantity_kind;
      delete analysisObj.length_m;
      delete analysisObj.length_norm;
      delete analysisObj.open_path;
      analysisObj.area_norm = areaNorm;
      if (areaM2 != null) analysisObj.area_m2 = areaM2;
      else delete analysisObj.area_m2;
    }
    const analysisJson = JSON.stringify(analysisObj);

    let row;
    if (subsectionId) {
      const upd = await client.query(
        `UPDATE app_gevelwering.drawing_subsection SET
           label = $2,
           level_hint = $3,
           vg_nr = $4,
           vr_nr = $5,
           points = $6::jsonb,
           area_norm = $7,
           perimeter_norm = $8,
           area_m2 = $9,
           perimeter_m = $10,
           metres_per_norm_unit = $11,
           analysis = $12::jsonb,
           analysis_status = 'READY_FOR_ANALYSIS',
           updated_at = now()
         WHERE id = $1::uuid AND section_id = $13::uuid
         RETURNING id::text AS id, vg_nr, vr_nr, area_norm, perimeter_norm, area_m2, perimeter_m, metres_per_norm_unit, analysis`,
        [
          subsectionId,
          label,
          levelHint,
          vgNr,
          vrNr,
          JSON.stringify(points),
          areaNorm,
          periNorm,
          areaM2,
          periM,
          mpu,
          analysisJson,
          sectionId,
        ],
      );
      row = upd.rows[0];
    } else {
      const ins = await client.query(
        `INSERT INTO app_gevelwering.drawing_subsection
           (section_id, building_id, document_id, page_index, label, level_hint, vg_nr, vr_nr, geom_kind,
            points, area_norm, perimeter_norm, area_m2, perimeter_m, metres_per_norm_unit,
            analysis, analysis_status, created_by)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, 'POLYLINE',
                 $9::jsonb, $10, $11, $12, $13, $14, COALESCE($15::jsonb, '{}'::jsonb),
                 'READY_FOR_ANALYSIS', $16::uuid)
         RETURNING id::text AS id, vg_nr, vr_nr, area_norm, perimeter_norm, area_m2, perimeter_m, metres_per_norm_unit, analysis`,
        [
          sectionId,
          sec.building_id,
          sec.document_id,
          sec.page_index,
          label,
          levelHint,
          vgNr,
          vrNr,
          JSON.stringify(points),
          areaNorm,
          periNorm,
          areaM2,
          periM,
          mpu,
          analysisJson,
          session.user_id,
        ],
      );
      row = ins.rows[0];
    }

    // Keep linked GA verblijfsruimte floor/volume in sync with plattegrond area.
    // Clear stored GA results — geometry changed, previous calc is no longer valid.
    if (
      sec.region_kind === "FLOORMAP" &&
      row?.id &&
      quantityKind === "area" &&
      areaM2 != null &&
      Number.isFinite(areaM2)
    ) {
      await client.query(
        `UPDATE app_gevelwering.verblijfsruimte
         SET vloer_m2 = $2::double precision,
             volume_m3 = CASE
               WHEN hoogte_m > 0 THEN ROUND(($2::double precision * hoogte_m)::numeric, 2)
               ELSE volume_m3
             END,
             ga_dba = NULL,
             lbi_dba = NULL,
             gak_dba = NULL,
             updated_at = now()
         WHERE subsection_id = $1::uuid`,
        [row.id, areaM2],
      );
    }

    // Keep GA vlak S/l in sync with façade geometry (single component; grouped materials
    // are re-summed live in the GA UI from current façade subsections).
    if (
      row?.id &&
      sec.region_kind !== "FLOORMAP" &&
      ((quantityKind === "area" && areaM2 != null && Number.isFinite(areaM2)) ||
        (quantityKind === "length" && periM != null && Number.isFinite(periM)))
    ) {
      if (quantityKind === "length") {
        await client.query(
          `UPDATE app_gevelwering.vlak
           SET length_m = $2::double precision,
               quantity_kind = 'length',
               updated_at = now()
           WHERE facade_subsection_id = $1::uuid`,
          [row.id, periM],
        );
      } else {
        await client.query(
          `UPDATE app_gevelwering.vlak
           SET area_m2 = $2::double precision,
               quantity_kind = 'area',
               updated_at = now()
           WHERE facade_subsection_id = $1::uuid`,
          [row.id, areaM2],
        );
      }
      await client.query(
        `UPDATE app_gevelwering.verblijfsruimte vr
         SET ga_dba = NULL,
             lbi_dba = NULL,
             gak_dba = NULL,
             updated_at = now()
         FROM app_gevelwering.vlak v
         WHERE v.verblijfsruimte_id = vr.id
           AND v.facade_subsection_id = $1::uuid`,
        [row.id],
      );
    }

    json(req, res, subsectionId ? 200 : 201, {
      ok: true,
      subsection_id: row.id,
      vg_nr: row.vg_nr != null ? Number(row.vg_nr) : null,
      vr_nr: row.vr_nr != null ? String(row.vr_nr) : null,
      area_norm: Number(row.area_norm),
      perimeter_norm: Number(row.perimeter_norm),
      area_m2: row.area_m2 != null ? Number(row.area_m2) : null,
      perimeter_m: row.perimeter_m != null ? Number(row.perimeter_m) : null,
      metres_per_norm_unit: row.metres_per_norm_unit != null ? Number(row.metres_per_norm_unit) : null,
      analysis: row.analysis && typeof row.analysis === "object" ? row.analysis : {},
    });
  } catch (err) {
    if (err && typeof err === "object" && err.code === "23505") {
      json(req, res, 409, { ok: false, error: "VR number already used on another room in this project" });
      return;
    }
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
      `DELETE FROM app_gevelwering.drawing_subsection WHERE id = $1::uuid RETURNING id::text AS id`,
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

/** GET /api/floormap/material-categories — GG rubrieken 1–9 (+ optional subrubrieken) */
export async function handleFloormapMaterialCategoriesGet(req, res, url) {
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

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveEngineerSession(client, token);
    if (!session) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }
    const { rows } = await client.query(
      `SELECT COALESCE(rubriek_nr, 0)::int AS rubriek_nr,
              master_category,
              COUNT(*)::int AS material_count
       FROM app_gevelwering.material
       GROUP BY rubriek_nr, master_category
       ORDER BY COALESCE(rubriek_nr, 99) ASC, master_category ASC`,
    );
    const countByNr = new Map();
    for (const r of rows) {
      const nr = Number(r.rubriek_nr) || 0;
      if (nr >= 1 && nr <= 9) {
        countByNr.set(nr, (countByNr.get(nr) || 0) + Number(r.material_count) || 0);
      }
    }
    // Prefer taxonomy order; fall back to any leftover master names in DB.
    const categories = MATERIAL_RUBRIEKEN.map((r) => ({
      rubriek_nr: r.nr,
      master_category: r.name,
      label: formatRubriekLabel(r),
      material_count: countByNr.get(r.nr) || 0,
      subrubrieken: subrubriekenFor(r.nr).map((s) => ({
        subrubriek_nr: s.nr,
        category: s.name,
        label: formatSubrubriekLabel(s),
      })),
    }));
    for (const r of rows) {
      const nr = Number(r.rubriek_nr) || 0;
      if (nr >= 1 && nr <= 9) continue;
      categories.push({
        rubriek_nr: null,
        master_category: r.master_category,
        label: r.master_category,
        material_count: Number(r.material_count) || 0,
        subrubrieken: [],
      });
    }
    json(req, res, 200, { ok: true, categories });
  } catch (err) {
    console.error("floormap material categories failed:", err);
    json(req, res, 500, { ok: false, error: "failed to list material categories" });
  } finally {
    client.release();
  }
}

/**
 * GET /api/floormap/materials?master_category=&category=&q=&limit=
 * Catalog pick list for façade set-ops (engineer).
 * `category` filters by subrubriek name (optional).
 */
export async function handleFloormapMaterialsList(req, res, url) {
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
  const masterCategory = (url.searchParams.get("master_category") || "").trim();
  if (!masterCategory) {
    json(req, res, 400, { ok: false, error: "master_category is required" });
    return;
  }
  const subCategory = (url.searchParams.get("category") || "").trim();
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  let limit = Number(url.searchParams.get("limit") || 800);
  if (!Number.isFinite(limit) || limit < 1) limit = 800;
  if (limit > 2000) limit = 2000;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveEngineerSession(client, token);
    if (!session) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }
    const rub = rubriekByName(masterCategory);
    const params = [];
    let where;
    if (rub) {
      params.push(rub.nr);
      where = "rubriek_nr = $1";
    } else {
      params.push(masterCategory);
      where = "master_category = $1";
    }
    if (subCategory) {
      const subMeta =
        rub &&
        subrubriekenFor(rub.nr).find(
          (s) => s.name === subCategory || String(s.nr) === subCategory,
        );
      if (subMeta) {
        params.push(subMeta.nr);
        where += ` AND subrubriek_nr = $${params.length}`;
      } else {
        params.push(subCategory);
        where += ` AND category = $${params.length}`;
      }
    }
    if (q) {
      const needle = q.replace(/[%_\\]/g, "").trim();
      if (needle) {
        params.push(`%${needle}%`);
        where += ` AND (name ILIKE $${params.length} OR catalog_id ILIKE $${params.length})`;
      }
    }
    params.push(limit);
    const { rows } = await client.query(
      `SELECT id::text AS material_id,
              catalog_id,
              material_no,
              rubriek_nr,
              subrubriek_nr,
              master_category,
              name,
              COALESCE(category, '') AS category,
              thickness_mm,
              ra_dba,
              r_125_hz,
              r_250_hz,
              r_500_hz,
              r_1000_hz,
              r_2000_hz
       FROM app_gevelwering.material
       WHERE ${where}
       ORDER BY subrubriek_nr ASC NULLS LAST, material_no ASC, name ASC
       LIMIT $${params.length}`,
      params,
    );
    const numOrNull = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
    json(req, res, 200, {
      ok: true,
      master_category: rub ? rub.name : masterCategory,
      rubriek_nr: rub ? rub.nr : null,
      category: subCategory || null,
      materials: rows.map((r) => ({
        material_id: r.material_id,
        catalog_id: r.catalog_id,
        material_no: Number(r.material_no),
        rubriek_nr: r.rubriek_nr != null ? Number(r.rubriek_nr) : null,
        subrubriek_nr: r.subrubriek_nr != null ? Number(r.subrubriek_nr) : null,
        master_category: r.master_category,
        name: r.name,
        category: r.category || "",
        thickness_mm: numOrNull(r.thickness_mm),
        ra_dba: numOrNull(r.ra_dba),
        r_125_hz: numOrNull(r.r_125_hz),
        r_250_hz: numOrNull(r.r_250_hz),
        r_500_hz: numOrNull(r.r_500_hz),
        r_1000_hz: numOrNull(r.r_1000_hz),
        r_2000_hz: numOrNull(r.r_2000_hz),
      })),
    });
  } catch (err) {
    console.error("floormap materials list failed:", err);
    json(req, res, 500, { ok: false, error: "failed to list materials" });
  } finally {
    client.release();
  }
}

/**
 * POST /api/floormap/materials
 * Engineer: eigen materiaal aanmaken (source=eigen) en optioneel koppelen aan gevelcomponent.
 * body: { name, ra_dba, rubriek_nr, subsection_id? }
 */
export async function handleFloormapMaterialCreate(req, res) {
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

  const name = String(body.name || "").trim().slice(0, 200);
  const ra = Number(body.ra_dba);
  const rubriekNr = Number(body.rubriek_nr);
  const subsectionId = String(body.subsection_id || "").trim();

  if (!name) {
    json(req, res, 400, { ok: false, error: "name is required" });
    return;
  }
  if (!Number.isFinite(ra) || ra < 0 || ra > 100) {
    json(req, res, 400, { ok: false, error: "ra_dba must be between 0 and 100" });
    return;
  }
  if (!Number.isInteger(rubriekNr) || rubriekNr < 1 || rubriekNr > 9) {
    json(req, res, 400, { ok: false, error: "rubriek_nr must be 1–9" });
    return;
  }
  if (subsectionId && !UUID_RE.test(subsectionId)) {
    json(req, res, 400, { ok: false, error: "invalid subsection_id" });
    return;
  }

  const rub = MATERIAL_RUBRIEKEN.find((r) => r.nr === rubriekNr);
  const masterCategory = rub ? rub.name : `Rubriek ${rubriekNr}`;
  const asLength = isLengthQuantityRubriek(rubriekNr);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveEngineerSession(client, token);
    if (!session) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }

    await client.query("BEGIN");
    const src = "eigen";
    const { rows: nextRows } = await client.query(
      `SELECT
         COALESCE(MAX(material_no), 0) + 1 AS next_no,
         COALESCE(MAX(catalog_index), -1) + 1 AS next_idx
       FROM app_gevelwering.material
       WHERE source = $1`,
      [src],
    );
    const materialNo = Number(nextRows[0]?.next_no) || 1;
    const catalogIndex = Number(nextRows[0]?.next_idx) || 0;
    const catalogId = `E${String(materialNo).padStart(5, "0")}`;

    const { rows: matRows } = await client.query(
      `INSERT INTO app_gevelwering.material (
         catalog_index, catalog_id, material_no, master_category, name,
         rubriek_nr, ra_dba, spectrum_ok, source, source_ref
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, true, $8, $9
       )
       RETURNING id::text AS material_id, catalog_id, name, master_category,
                 rubriek_nr, ra_dba`,
      [
        catalogIndex,
        catalogId,
        materialNo,
        masterCategory,
        name,
        rubriekNr,
        ra,
        src,
        "eigen materiaal",
      ],
    );
    const mat = matRows[0];
    if (!mat) {
      await client.query("ROLLBACK");
      json(req, res, 500, { ok: false, error: "material insert failed" });
      return;
    }

    let assigned = false;
    if (subsectionId) {
      const { rows: subRows } = await client.query(
        `SELECT id::text AS id, analysis
         FROM app_gevelwering.drawing_subsection
         WHERE id = $1::uuid
         FOR UPDATE`,
        [subsectionId],
      );
      if (!subRows[0]) {
        await client.query("ROLLBACK");
        json(req, res, 404, { ok: false, error: "subsection not found" });
        return;
      }
      const prev =
        subRows[0].analysis &&
        typeof subRows[0].analysis === "object" &&
        !Array.isArray(subRows[0].analysis)
          ? { ...subRows[0].analysis }
          : {};
      const analysis = {
        ...prev,
        material_id: mat.material_id,
        material_name: mat.name,
        catalog_id: mat.catalog_id,
        master_category: mat.master_category,
        rubriek_nr: rubriekNr,
      };
      if (asLength) {
        analysis.quantity_kind = "length";
      }
      await client.query(
        `UPDATE app_gevelwering.drawing_subsection
         SET analysis = $2::jsonb, updated_at = now()
         WHERE id = $1::uuid`,
        [subsectionId, JSON.stringify(analysis)],
      );
      assigned = true;
    }

    await client.query("COMMIT");
    json(req, res, 200, {
      ok: true,
      material: {
        material_id: mat.material_id,
        catalog_id: mat.catalog_id,
        name: mat.name,
        master_category: mat.master_category,
        rubriek_nr: Number(mat.rubriek_nr),
        ra_dba: Number(mat.ra_dba),
        source: src,
      },
      subsection_id: subsectionId || null,
      assigned,
    });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("floormap material create failed:", err);
    json(req, res, 500, { ok: false, error: "failed to create material" });
  } finally {
    client.release();
  }
}

/** POST /api/floormap/scale  body: { section_id, metres_per_norm_unit, scale_ratio?, scale_source, scale_aspect_yx? } */
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
  const aspectRaw = body.scale_aspect_yx != null ? Number(body.scale_aspect_yx) : NaN;
  const aspect = Number.isFinite(aspectRaw) && aspectRaw > 0 ? aspectRaw : null;
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
      `UPDATE app_gevelwering.drawing_region SET
         metres_per_norm_unit = $2,
         scale_ratio = $3,
         scale_source = $4,
         scale_aspect_yx = COALESCE($5, scale_aspect_yx),
         updated_at = now()
       WHERE id = $1::uuid
         AND region_kind IN ('FLOORMAP', 'FACADE', 'SECTION', 'CROSS_SECTION')
       RETURNING id::text AS id, scale_aspect_yx`,
      [sectionId, mpu, scaleRatio, source, aspect],
    );
    if (rows.length < 1) {
      await client.query("ROLLBACK");
      json(req, res, 404, { ok: false, error: "scalable section not found" });
      return;
    }
    const storedAspect = normalizeAspectYx(rows[0].scale_aspect_yx ?? aspect ?? 1);

    const { rows: subs } = await client.query(
      `SELECT id::text AS id, points, analysis,
              COALESCE((analysis->>'quantity_kind'), '') AS quantity_kind,
              COALESCE((analysis->>'open_path'), 'false') AS open_path
       FROM app_gevelwering.drawing_subsection
       WHERE section_id = $1::uuid`,
      [sectionId],
    );

    for (const sub of subs) {
      const pts = Array.isArray(sub.points) ? sub.points : [];
      const analysis =
        sub.analysis && typeof sub.analysis === "object" && !Array.isArray(sub.analysis)
          ? sub.analysis
          : {};
      const holes = normalizeHoles(analysis.holes);
      const openPath =
        String(sub.open_path).toLowerCase() === "true" ||
        analysis.open_path === true ||
        (sub.quantity_kind === "length" &&
          pts.length >= 2 &&
          Math.hypot(
            Number(pts[0].x) - Number(pts[pts.length - 1].x),
            Number(pts[0].y) - Number(pts[pts.length - 1].y),
          ) > 1e-6);
      const areaNorm = openPath || sub.quantity_kind === "length" ? 0 : netAreaNorm(pts, holes);
      const periNorm = openPath ? openPolylineLength(pts) : polylinePerimeter(pts);
      const areaM2 =
        areaNorm > 0 ? Math.round(scaledAreaM2(areaNorm, mpu, storedAspect) * 100) / 100 : null;
      const periM =
        pts.length >= 2
          ? Math.round(scaledPathLength(pts, mpu, storedAspect, !openPath) * 100) / 100
          : Math.round(periNorm * mpu * 100) / 100;
      let nextAnalysis = analysis;
      if (sub.quantity_kind === "length" || analysis.quantity_kind === "length") {
        nextAnalysis = { ...analysis, length_m: periM, length_norm: periNorm };
      }
      await client.query(
        `UPDATE app_gevelwering.drawing_subsection SET
           metres_per_norm_unit = $2,
           area_norm = $3,
           perimeter_norm = $4,
           area_m2 = $5,
           perimeter_m = $6,
           analysis = $7::jsonb,
           updated_at = now()
         WHERE id = $1::uuid`,
        [
          sub.id,
          mpu,
          areaNorm,
          periNorm,
          areaM2,
          periM,
          JSON.stringify(nextAnalysis),
        ],
      );
    }

    // Geometry/scale changed → invalidate stored GA results for linked VRs.
    await client.query(
      `UPDATE app_gevelwering.verblijfsruimte vr
       SET ga_dba = NULL, lbi_dba = NULL, gak_dba = NULL, updated_at = now()
       WHERE vr.subsection_id IN (
         SELECT id FROM app_gevelwering.drawing_subsection WHERE section_id = $1::uuid
       )
       OR vr.id IN (
         SELECT v.verblijfsruimte_id FROM app_gevelwering.vlak v
         JOIN app_gevelwering.drawing_subsection s ON s.id = v.facade_subsection_id
         WHERE s.section_id = $1::uuid
       )`,
      [sectionId],
    );

    await client.query("COMMIT");
    json(req, res, 200, {
      ok: true,
      section_id: sectionId,
      metres_per_norm_unit: mpu,
      scale_ratio: scaleRatio,
      scale_source: source,
      scale_aspect_yx: storedAspect,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("floormap scale save failed:", err);
    json(req, res, 500, { ok: false, error: "failed to save scale" });
  } finally {
    client.release();
  }
}
