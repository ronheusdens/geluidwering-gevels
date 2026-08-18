/**
 * Project material favorites ("meest gebruikt") + named presets.
 * @deprecated Phase 4b — archived HTTP fallback. Prefer bppServer WSS (client/src/bpp-api.ts).
 * Loaded only when GEVELWERING_BPP_ONLY is unset/0.
 */
import { getPool } from "../pg-config.mjs";
import {
  jsonWithSecurity,
  parseSessionToken,
  requireHttpsOrReject,
} from "../http-security.mjs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(req, res, status, body) {
  jsonWithSecurity(req, res, status, body);
}

function readJsonBody(req, maxBytes = 64 * 1024) {
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

const MATERIAL_SELECT = `
  m.id::text AS material_id,
  m.catalog_id,
  m.material_no,
  m.rubriek_nr,
  m.subrubriek_nr,
  m.master_category,
  m.name,
  COALESCE(m.category, '') AS category,
  COALESCE(m.source, '') AS source,
  m.thickness_mm,
  m.ra_dba,
  m.r_125_hz,
  m.r_250_hz,
  m.r_500_hz,
  m.r_1000_hz,
  m.r_2000_hz
`;

function mapMaterialRow(r) {
  const numOrNull = (v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    material_id: r.material_id,
    catalog_id: r.catalog_id || "",
    material_no: Number(r.material_no) || 0,
    rubriek_nr: numOrNull(r.rubriek_nr),
    subrubriek_nr: numOrNull(r.subrubriek_nr),
    master_category: r.master_category || "",
    name: r.name || "",
    category: r.category || "",
    source: r.source || "",
    thickness_mm: numOrNull(r.thickness_mm),
    ra_dba: numOrNull(r.ra_dba),
    r_125_hz: numOrNull(r.r_125_hz),
    r_250_hz: numOrNull(r.r_250_hz),
    r_500_hz: numOrNull(r.r_500_hz),
    r_1000_hz: numOrNull(r.r_1000_hz),
    r_2000_hz: numOrNull(r.r_2000_hz),
  };
}

/** GET/POST/DELETE /api/floormap/material-favorites */
/** @deprecated Phase 4 — prefer API_List/Add/RemoveMaterialFavorite via WSS. */
export async function handleMaterialFavorites(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
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

    if (req.method === "GET") {
      const buildingId = (url.searchParams.get("building_id") || "").trim();
      if (!UUID_RE.test(buildingId)) {
        json(req, res, 400, { ok: false, error: "invalid building_id" });
        return;
      }
      const { rows } = await client.query(
        `SELECT ${MATERIAL_SELECT}, f.sort_order
         FROM app_gevelwering.building_material_favorite f
         JOIN app_gevelwering.material m ON m.id = f.material_id
         WHERE f.building_id = $1::uuid
         ORDER BY f.sort_order ASC, m.name ASC`,
        [buildingId],
      );
      json(req, res, 200, {
        ok: true,
        building_id: buildingId,
        materials: rows.map((r) => ({ ...mapMaterialRow(r), sort_order: Number(r.sort_order) || 0 })),
      });
      return;
    }

    if (req.method === "DELETE") {
      const buildingIdQ = (url.searchParams.get("building_id") || "").trim();
      const materialIdQ = (url.searchParams.get("material_id") || "").trim();
      let delBuilding = buildingIdQ;
      let delMaterial = materialIdQ;
      if (!UUID_RE.test(delBuilding) || !UUID_RE.test(delMaterial)) {
        let body;
        try {
          body = await readJsonBody(req);
        } catch {
          body = {};
        }
        delBuilding = String(body.building_id || delBuilding).trim();
        delMaterial = String(body.material_id || delMaterial).trim();
      }
      if (!UUID_RE.test(delBuilding) || !UUID_RE.test(delMaterial)) {
        json(req, res, 400, { ok: false, error: "building_id and material_id required" });
        return;
      }
      await client.query(
        `DELETE FROM app_gevelwering.building_material_favorite
         WHERE building_id = $1::uuid AND material_id = $2::uuid`,
        [delBuilding, delMaterial],
      );
      json(req, res, 200, {
        ok: true,
        building_id: delBuilding,
        material_id: delMaterial,
        favorited: false,
      });
      return;
    }

    if (req.method !== "POST") {
      json(req, res, 405, { ok: false, error: "method not allowed" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      json(req, res, 400, { ok: false, error: "invalid JSON body" });
      return;
    }
    const buildingId = String(body.building_id || "").trim();
    const materialId = String(body.material_id || "").trim();
    if (!UUID_RE.test(buildingId) || !UUID_RE.test(materialId)) {
      json(req, res, 400, { ok: false, error: "building_id and material_id required" });
      return;
    }

    const { rows: b } = await client.query(
      `SELECT id FROM app_gevelwering.building WHERE id = $1::uuid`,
      [buildingId],
    );
    if (!b[0]) {
      json(req, res, 404, { ok: false, error: "building not found" });
      return;
    }
    const { rows: m } = await client.query(
      `SELECT id FROM app_gevelwering.material WHERE id = $1::uuid`,
      [materialId],
    );
    if (!m[0]) {
      json(req, res, 404, { ok: false, error: "material not found" });
      return;
    }
    const { rows: sortRows } = await client.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort
       FROM app_gevelwering.building_material_favorite
       WHERE building_id = $1::uuid`,
      [buildingId],
    );
    const sortOrder = Number(sortRows[0]?.next_sort) || 0;
    await client.query(
      `INSERT INTO app_gevelwering.building_material_favorite (building_id, material_id, sort_order)
       VALUES ($1::uuid, $2::uuid, $3)
       ON CONFLICT (building_id, material_id) DO NOTHING`,
      [buildingId, materialId, sortOrder],
    );
    json(req, res, 200, { ok: true, building_id: buildingId, material_id: materialId, favorited: true });
  } catch (err) {
    console.error("material favorites failed:", err);
    json(req, res, 500, { ok: false, error: "failed to manage favorites" });
  } finally {
    client.release();
  }
}

/**
 * GET — list presets
 * POST body { action: "save"|"apply"|"delete"|"rename", ... }
 *   save:  { name, building_id } — copy current building favorites into named preset (upsert by name)
 *   apply: { preset_id|name, building_id } — replace building favorites with preset items
 *   delete: { preset_id }
 *   rename: { preset_id, name }
 */
/** @deprecated Phase 4 — prefer API_ListMaterialFavoritePresets / API_MaterialFavoritePresetAction via WSS. */
export async function handleMaterialFavoritePresets(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
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

    if (req.method === "GET") {
      const { rows } = await client.query(
        `SELECT p.id::text AS preset_id,
                p.name,
                p.created_at,
                p.updated_at,
                COUNT(i.material_id)::int AS material_count
         FROM app_gevelwering.material_favorite_preset p
         LEFT JOIN app_gevelwering.material_favorite_preset_item i ON i.preset_id = p.id
         GROUP BY p.id
         ORDER BY p.name ASC`,
      );
      json(req, res, 200, {
        ok: true,
        presets: rows.map((r) => ({
          preset_id: r.preset_id,
          name: r.name,
          material_count: Number(r.material_count) || 0,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })),
      });
      return;
    }

    if (req.method !== "POST") {
      json(req, res, 405, { ok: false, error: "method not allowed" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      json(req, res, 400, { ok: false, error: "invalid JSON body" });
      return;
    }
    const action = String(body.action || "").trim().toLowerCase();

    if (action === "save") {
      const name = String(body.name || "").trim().slice(0, 120);
      const buildingId = String(body.building_id || "").trim();
      if (!name) {
        json(req, res, 400, { ok: false, error: "name is required" });
        return;
      }
      if (!UUID_RE.test(buildingId)) {
        json(req, res, 400, { ok: false, error: "invalid building_id" });
        return;
      }
      const { rows: favs } = await client.query(
        `SELECT material_id, sort_order
         FROM app_gevelwering.building_material_favorite
         WHERE building_id = $1::uuid
         ORDER BY sort_order ASC`,
        [buildingId],
      );
      if (!favs.length) {
        json(req, res, 400, { ok: false, error: "geen favorieten om op te slaan" });
        return;
      }
      await client.query("BEGIN");
      try {
        const { rows: existing } = await client.query(
          `SELECT id::text AS id FROM app_gevelwering.material_favorite_preset WHERE name = $1`,
          [name],
        );
        let presetId = existing[0]?.id;
        if (presetId) {
          await client.query(
            `UPDATE app_gevelwering.material_favorite_preset
             SET updated_at = now(), created_by = $2::uuid
             WHERE id = $1::uuid`,
            [presetId, session.user_id],
          );
          await client.query(
            `DELETE FROM app_gevelwering.material_favorite_preset_item WHERE preset_id = $1::uuid`,
            [presetId],
          );
        } else {
          const ins = await client.query(
            `INSERT INTO app_gevelwering.material_favorite_preset (name, created_by)
             VALUES ($1, $2::uuid)
             RETURNING id::text AS id`,
            [name, session.user_id],
          );
          presetId = ins.rows[0].id;
        }
        for (const f of favs) {
          await client.query(
            `INSERT INTO app_gevelwering.material_favorite_preset_item (preset_id, material_id, sort_order)
             VALUES ($1::uuid, $2::uuid, $3)
             ON CONFLICT DO NOTHING`,
            [presetId, f.material_id, Number(f.sort_order) || 0],
          );
        }
        await client.query("COMMIT");
        json(req, res, 200, {
          ok: true,
          preset_id: presetId,
          name,
          material_count: favs.length,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
      return;
    }

    if (action === "apply") {
      const buildingId = String(body.building_id || "").trim();
      const presetId = String(body.preset_id || "").trim();
      const name = String(body.name || "").trim();
      if (!UUID_RE.test(buildingId)) {
        json(req, res, 400, { ok: false, error: "invalid building_id" });
        return;
      }
      let pid = presetId;
      if (!UUID_RE.test(pid)) {
        if (!name) {
          json(req, res, 400, { ok: false, error: "preset_id or name required" });
          return;
        }
        const { rows } = await client.query(
          `SELECT id::text AS id FROM app_gevelwering.material_favorite_preset WHERE name = $1`,
          [name],
        );
        pid = rows[0]?.id || "";
      }
      if (!UUID_RE.test(pid)) {
        json(req, res, 404, { ok: false, error: "preset not found" });
        return;
      }
      const { rows: items } = await client.query(
        `SELECT material_id, sort_order
         FROM app_gevelwering.material_favorite_preset_item
         WHERE preset_id = $1::uuid
         ORDER BY sort_order ASC`,
        [pid],
      );
      await client.query("BEGIN");
      try {
        await client.query(
          `DELETE FROM app_gevelwering.building_material_favorite WHERE building_id = $1::uuid`,
          [buildingId],
        );
        for (const it of items) {
          await client.query(
            `INSERT INTO app_gevelwering.building_material_favorite (building_id, material_id, sort_order)
             VALUES ($1::uuid, $2::uuid, $3)`,
            [buildingId, it.material_id, Number(it.sort_order) || 0],
          );
        }
        await client.query("COMMIT");
        json(req, res, 200, {
          ok: true,
          building_id: buildingId,
          preset_id: pid,
          material_count: items.length,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
      return;
    }

    if (action === "delete") {
      const presetId = String(body.preset_id || "").trim();
      if (!UUID_RE.test(presetId)) {
        json(req, res, 400, { ok: false, error: "invalid preset_id" });
        return;
      }
      await client.query(
        `DELETE FROM app_gevelwering.material_favorite_preset WHERE id = $1::uuid`,
        [presetId],
      );
      json(req, res, 200, { ok: true, preset_id: presetId, deleted: true });
      return;
    }

    if (action === "rename") {
      const presetId = String(body.preset_id || "").trim();
      const name = String(body.name || "").trim().slice(0, 120);
      if (!UUID_RE.test(presetId) || !name) {
        json(req, res, 400, { ok: false, error: "preset_id and name required" });
        return;
      }
      const { rows } = await client.query(
        `UPDATE app_gevelwering.material_favorite_preset
         SET name = $2, updated_at = now()
         WHERE id = $1::uuid
         RETURNING id::text AS preset_id, name`,
        [presetId, name],
      );
      if (!rows[0]) {
        json(req, res, 404, { ok: false, error: "preset not found" });
        return;
      }
      json(req, res, 200, { ok: true, ...rows[0] });
      return;
    }

    json(req, res, 400, { ok: false, error: "unknown action" });
  } catch (err) {
    console.error("material favorite presets failed:", err);
    json(req, res, 500, { ok: false, error: "failed to manage presets" });
  } finally {
    client.release();
  }
}
