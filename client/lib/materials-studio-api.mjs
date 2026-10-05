/**
 * Materials Studio HTTP API (admin-only).
 * Engineers consume app_gevelwering.material via BPP — not these routes.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./pg-config.mjs";
import {
  corsHeaders,
  jsonWithSecurity,
  parseSessionToken,
  securityHeaders,
} from "./http-security.mjs";
import {
  approximateRaFromR,
  computeRatings,
  layerSpectrumFromInput,
  stackSpectrumDb,
  woodGridMetrics,
} from "./acoustic-physics.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_JSON = path.join(__dirname, "..", "..", "data", "materials-audit", "report.json");

async function resolveSession(client, token) {
  const { rows } = await client.query(
    `SELECT u.id::text AS user_id,
            u.username,
            COALESCE(u.is_engineer, false) AS is_engineer,
            u.username = 'admin' AS is_admin
     FROM app_gevelwering.login_session s
     JOIN app_gevelwering.service_user u ON u.id = s.user_id
     WHERE s.token = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       AND u.is_active = true`,
    [token],
  );
  return rows[0] ?? null;
}

function isAdminSession(session) {
  return (
    session.is_admin === true ||
    session.is_admin === "t" ||
    session.username === "admin"
  );
}

async function requireAdmin(client, req, res) {
  const token = parseSessionToken(req);
  if (!token) {
    jsonWithSecurity(req, res, 401, { ok: false, error: "niet ingelogd" });
    return null;
  }
  const session = await resolveSession(client, token);
  if (!session) {
    jsonWithSecurity(req, res, 401, { ok: false, error: "sessie ongeldig of verlopen" });
    return null;
  }
  if (!isAdminSession(session)) {
    jsonWithSecurity(req, res, 403, {
      ok: false,
      error: "Materials Studio is alleen voor gebruiker admin",
    });
    return null;
  }
  return session;
}

export function handleMaterialsStudioApiOptions(req, res) {
  res.writeHead(204, {
    ...corsHeaders(req),
    ...securityHeaders(req),
  });
  res.end();
}

/** Catalog + acoustic_catalog overview for dashboard. */
export async function handleMaterialsStudioSummary(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (!(await requireAdmin(client, req, res))) return;

    const [materialQ, conceptQ, versionQ, patternQ, assemblyQ, linkedQ, kindsQ, recentQ, templatesQ, proposedQ] =
      await Promise.all([
        client.query(`SELECT COUNT(*)::int AS n FROM app_gevelwering.material`),
        client.query(`SELECT COUNT(*)::int AS n FROM acoustic_catalog.material_concept`),
        client.query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'approved' AND is_latest_approved)::int AS latest_approved,
             COUNT(*) FILTER (WHERE status = 'proposed')::int AS proposed,
             COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
           FROM acoustic_catalog.spectrum_version`,
        ),
        client.query(`SELECT COUNT(*)::int AS n FROM acoustic_catalog.spectrum_pattern`),
        client.query(`SELECT COUNT(*)::int AS n FROM acoustic_catalog.wall_assembly`),
        client.query(
          `SELECT COUNT(*)::int AS n
           FROM app_gevelwering.material m
           WHERE m.acoustic_spectrum_version_id IS NOT NULL`,
        ),
        client.query(
          `SELECT
             COUNT(*) FILTER (WHERE app_gevelwering.fw_material_opbouw(m) = 'homogeneous')::int AS homogeneous,
             COUNT(*) FILTER (WHERE app_gevelwering.fw_material_opbouw(m) = 'composite_stack')::int AS composite_stack
           FROM app_gevelwering.material m`,
        ),
        client.query(
          `SELECT m.id::text AS material_id,
                  m.catalog_id,
                  m.name,
                  COALESCE(m.source, '') AS source,
                  m.created_at,
                  app_gevelwering.fw_material_opbouw(m) AS material_kind
           FROM app_gevelwering.material m
           LEFT JOIN acoustic_catalog.material_concept c ON c.id = m.acoustic_concept_id
           ORDER BY m.created_at DESC NULLS LAST, m.catalog_id DESC
           LIMIT 5`,
        ),
        client.query(
          `SELECT a.code,
                  a.name,
                  a.description,
                  COALESCE(a.assembly_family, 'overig') AS assembly_family,
                  COALESCE(
                    jsonb_agg(
                      jsonb_build_object(
                        'layer_order', l.layer_order,
                        'layer_kind', l.layer_kind,
                        'label', l.label,
                        'thickness_mm', l.thickness_mm,
                        'density_kg_m3', l.density_kg_m3,
                        'cavity_depth_mm', l.cavity_depth_mm,
                        'stud_width_mm', l.stud_width_mm,
                        'stud_depth_mm', l.stud_depth_mm,
                        'stud_spacing_mm', l.stud_spacing_mm,
                        'acoustic_role', l.acoustic_role,
                        'params', l.params
                      )
                      ORDER BY l.layer_order
                    ) FILTER (WHERE l.assembly_id IS NOT NULL),
                    '[]'::jsonb
                  ) AS layers
           FROM acoustic_catalog.wall_assembly a
           LEFT JOIN acoustic_catalog.wall_assembly_layer l ON l.assembly_id = a.id
           GROUP BY a.id, a.code, a.name, a.description, a.assembly_family
           ORDER BY
             CASE COALESCE(a.assembly_family, 'overig')
               WHEN 'buitengevel' THEN 1
               WHEN 'dak' THEN 2
               ELSE 3
             END,
             a.code`,
        ),
        client.query(
          `SELECT DISTINCT ON (c.id)
                  c.id::text AS concept_id,
                  c.catalog_id AS concept_catalog_id,
                  c.name,
                  c.material_kind,
                  c.published_material_id::text AS published_material_id,
                  sv.id::text AS spectrum_version_id,
                  sv.version_no,
                  sv.status,
                  sv.ra_dba,
                  sv.rw_db,
                  sv.created_at,
                  a.code AS template_code,
                  COALESCE(a.assembly_family, 'overig') AS assembly_family
           FROM acoustic_catalog.material_concept c
           JOIN acoustic_catalog.spectrum_version sv ON sv.concept_id = c.id AND sv.status = 'proposed'
           LEFT JOIN acoustic_catalog.concept_assembly ca ON ca.concept_id = c.id
           LEFT JOIN acoustic_catalog.wall_assembly a ON a.id = ca.assembly_id
           WHERE c.material_kind = 'composite_stack'
           ORDER BY c.id, sv.version_no DESC`,
        ),
      ]);

    let qc = null;
    if (fs.existsSync(REPORT_JSON)) {
      try {
        const raw = await fsp.readFile(REPORT_JSON, "utf8");
        const parsed = JSON.parse(raw);
        qc = {
          generated_at: parsed.generated_at,
          stats: parsed.stats,
          issue_counts: parsed.issue_counts,
        };
      } catch {
        qc = null;
      }
    }

    jsonWithSecurity(req, res, 200, {
      ok: true,
      material_rows: materialQ.rows[0]?.n ?? 0,
      concepts: conceptQ.rows[0]?.n ?? 0,
      spectrum_versions: versionQ.rows[0] ?? {},
      patterns: patternQ.rows[0]?.n ?? 0,
      assemblies: assemblyQ.rows[0]?.n ?? 0,
      material_linked: linkedQ.rows[0]?.n ?? 0,
      concept_kinds: {
        homogeneous: kindsQ.rows[0]?.homogeneous ?? 0,
        composite_stack: kindsQ.rows[0]?.composite_stack ?? 0,
      },
      recently_added: recentQ.rows.map((r) => ({
        material_id: r.material_id,
        catalog_id: r.catalog_id,
        name: r.name,
        source: r.source,
        created_at: r.created_at,
        material_kind: r.material_kind,
      })),
      assembly_templates: templatesQ.rows.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description,
        assembly_family: r.assembly_family,
        layers: Array.isArray(r.layers) ? r.layers : [],
      })),
      proposed_composites: proposedQ.rows.map((r) => ({
        concept_id: r.concept_id,
        concept_catalog_id: r.concept_catalog_id,
        name: r.name,
        material_kind: r.material_kind,
        published_material_id: r.published_material_id,
        spectrum_version_id: r.spectrum_version_id,
        version_no: r.version_no,
        status: r.status,
        ra_dba: r.ra_dba,
        rw_db: r.rw_db,
        created_at: r.created_at,
        template_code: r.template_code,
        assembly_family: r.assembly_family,
      })),
      qc,
    });
  } catch (err) {
    console.error("materials-studio summary failed:", err);
    jsonWithSecurity(req, res, 500, { ok: false, error: "kon overzicht niet laden" });
  } finally {
    client.release();
  }
}

/** Serve cached QC report (run scripts/materials-qc-audit.py to refresh). */
export async function handleMaterialsStudioQcReport(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (!(await requireAdmin(client, req, res))) return;
    if (!fs.existsSync(REPORT_JSON)) {
      jsonWithSecurity(req, res, 404, {
        ok: false,
        error: "Geen QC-rapport — voer scripts/materials-qc-audit.py uit",
      });
      return;
    }
    const raw = await fsp.readFile(REPORT_JSON, "utf8");
    const parsed = JSON.parse(raw);
    jsonWithSecurity(req, res, 200, { ok: true, report: parsed });
  } catch (err) {
    console.error("materials-studio qc-report failed:", err);
    jsonWithSecurity(req, res, 500, { ok: false, error: "kon QC-rapport niet laden" });
  } finally {
    client.release();
  }
}

/** Sync latest approved spectrum_version → app_gevelwering.material (linked rows only). */
export async function handleMaterialsStudioPublish(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await requireAdmin(client, req, res);
    if (!session) return;

    await client.query("BEGIN");

    const linkQ = await client.query(
      `UPDATE acoustic_catalog.material_concept c
       SET published_material_id = m.id,
           updated_at = now()
       FROM app_gevelwering.material m
       WHERE c.published_material_id IS NULL
         AND c.catalog_id IS NOT NULL
         AND m.catalog_id = c.catalog_id
         AND COALESCE(m.source, 'catalogusGG.pdf') = c.catalog_source`,
    );

    const pubQ = await client.query(
      `WITH latest AS (
         SELECT DISTINCT ON (c.id)
           c.id AS concept_id,
           c.published_material_id,
           sv.id AS spectrum_version_id,
           sv.source_attribution,
           sv.r_63_hz, sv.r_125_hz, sv.r_250_hz, sv.r_500_hz,
           sv.r_1000_hz, sv.r_2000_hz, sv.r_4000_hz,
           sv.ra_dba, sv.rw_db, sv.c_db, sv.ctr_db
         FROM acoustic_catalog.material_concept c
         JOIN acoustic_catalog.spectrum_version sv ON sv.concept_id = c.id
         WHERE sv.is_latest_approved AND sv.status = 'approved'
         ORDER BY c.id, sv.version_no DESC
       )
       UPDATE app_gevelwering.material m SET
         r_63_hz = l.r_63_hz,
         r_125_hz = l.r_125_hz,
         r_250_hz = l.r_250_hz,
         r_500_hz = l.r_500_hz,
         r_1000_hz = l.r_1000_hz,
         r_2000_hz = l.r_2000_hz,
         r_4000_hz = l.r_4000_hz,
         ra_dba = l.ra_dba,
         rw_db = l.rw_db,
         c_db = l.c_db,
         ctr_db = l.ctr_db,
         source_attribution = l.source_attribution,
         acoustic_concept_id = l.concept_id,
         acoustic_spectrum_version_id = l.spectrum_version_id,
         updated_at = now()
       FROM latest l
       WHERE m.id = l.published_material_id
         AND l.published_material_id IS NOT NULL`,
    );

    await client.query("COMMIT");

    jsonWithSecurity(req, res, 200, {
      ok: true,
      linked_concepts: linkQ.rowCount ?? 0,
      published_rows: pubQ.rowCount ?? 0,
      published_by: session.username,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("materials-studio publish failed:", err);
    jsonWithSecurity(req, res, 500, { ok: false, error: "publiceren mislukt" });
  } finally {
    client.release();
  }
}

/** Median spectrum from R1/S2 cluster → SP-R1-S2-KALKZANDSTEEN. */
export async function handleMaterialsStudioRefineKalkzandsteen(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (!(await requireAdmin(client, req, res))) return;

    const clusterQ = await client.query(
      `SELECT
         COUNT(*)::int AS sample_count,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY thickness_mm)
           FILTER (WHERE thickness_mm IS NOT NULL AND thickness_mm > 0) AS thickness_mm_ref,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY (weight_kg_m2 / NULLIF(thickness_mm / 1000.0, 0)))
           FILTER (WHERE thickness_mm > 0 AND weight_kg_m2 > 0) AS density_kg_m3_ref,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY r_125_hz) AS r_125_hz,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY r_250_hz) AS r_250_hz,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY r_500_hz) AS r_500_hz,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY r_1000_hz) AS r_1000_hz,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY r_2000_hz) AS r_2000_hz
       FROM app_gevelwering.material
       WHERE rubriek_nr = 1 AND subrubriek_nr = 2
         AND r_125_hz IS NOT NULL AND r_250_hz IS NOT NULL
         AND r_500_hz IS NOT NULL AND r_1000_hz IS NOT NULL AND r_2000_hz IS NOT NULL`,
    );
    const c = clusterQ.rows[0];
    if (!c || c.sample_count < 3) {
      jsonWithSecurity(req, res, 400, {
        ok: false,
        error: `onvoldoende R1/S2-cluster (gevonden: ${c?.sample_count ?? 0}, minimaal 3)`,
      });
      return;
    }

    const upd = await client.query(
      `UPDATE acoustic_catalog.spectrum_pattern SET
         thickness_mm_ref = $1::float8,
         density_kg_m3_ref = $2::float8,
         r_125_hz = $3::float8,
         r_250_hz = $4::float8,
         r_500_hz = $5::float8,
         r_1000_hz = $6::float8,
         r_2000_hz = $7::float8,
         confidence = 'high',
         notes = $8,
         updated_at = now()
       WHERE code = 'SP-R1-S2-KALKZANDSTEEN'
       RETURNING code, name, thickness_mm_ref, density_kg_m3_ref,
                 r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz`,
      [
        c.thickness_mm_ref,
        c.density_kg_m3_ref,
        c.r_125_hz,
        c.r_250_hz,
        c.r_500_hz,
        c.r_1000_hz,
        c.r_2000_hz,
        `Afgeleid uit cataloguscluster R1/S2 (n=${c.sample_count}, mediaan 2026-08-28).`,
      ],
    );

    jsonWithSecurity(req, res, 200, {
      ok: true,
      sample_count: c.sample_count,
      pattern: upd.rows[0] ?? null,
    });
  } catch (err) {
    console.error("materials-studio refine-kalkzandsteen failed:", err);
    jsonWithSecurity(req, res, 500, { ok: false, error: "patroon verfijnen mislukt" });
  } finally {
    client.release();
  }
}

async function readJsonBody(req, limit = 256 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) {
      const err = new Error("payload too large");
      err.code = "LIMIT";
      throw err;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

/** Search homogeneous materials for layer assignment. */
export async function handleMaterialsStudioMaterialSearch(req, res, url) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (!(await requireAdmin(client, req, res))) return;
    const q = String(url.searchParams.get("q") || "").trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 50);
    const params = [];
    let where = "TRUE";
    if (q) {
      params.push(`%${q}%`);
      where = `(m.catalog_id ILIKE $1 OR m.name ILIKE $1 OR COALESCE(m.source_ref, '') ILIKE $1)`;
    }
    params.push(limit);
    const { rows } = await client.query(
      `SELECT m.id::text AS material_id,
              m.catalog_id,
              m.name,
              m.thickness_mm,
              m.weight_kg_m2,
              CASE WHEN m.thickness_mm > 0 AND m.weight_kg_m2 > 0
                   THEN m.weight_kg_m2 / (m.thickness_mm / 1000.0)
                   ELSE NULL END AS density_kg_m3,
              m.ra_dba,
              m.rw_db, m.c_db, m.ctr_db,
              m.r_63_hz, m.r_125_hz, m.r_250_hz, m.r_500_hz,
              m.r_1000_hz, m.r_2000_hz, m.r_4000_hz,
              COALESCE(c.material_kind, 'homogeneous') AS material_kind
       FROM app_gevelwering.material m
       LEFT JOIN acoustic_catalog.material_concept c ON c.id = m.acoustic_concept_id
       WHERE ${where}
         AND app_gevelwering.fw_material_opbouw(m) = 'homogeneous'
       ORDER BY m.catalog_id
       LIMIT $${params.length}`,
      params,
    );
    jsonWithSecurity(req, res, 200, { ok: true, materials: rows });
  } catch (err) {
    console.error("materials-studio material-search failed:", err);
    jsonWithSecurity(req, res, 500, { ok: false, error: "zoeken mislukt" });
  } finally {
    client.release();
  }
}

/**
 * Preview samengesteld component: per laag R-spectrum + Rw, plus MSM-stack totaal.
 * Body: { template_code?, name?, assembly_family?, layers: [{ layer_order, layer_kind, label,
 *   acoustic_role, thickness_mm?, density_kg_m3?, cavity_depth_mm?, material_id? }] }
 */
export async function handleMaterialsStudioComposePreview(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    if (!(await requireAdmin(client, req, res))) return;
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      jsonWithSecurity(req, res, err?.code === "LIMIT" ? 413 : 400, {
        ok: false,
        error: err?.code === "LIMIT" ? "payload too large" : "ongeldige JSON",
      });
      return;
    }

    const layersIn = Array.isArray(body.layers) ? body.layers : [];
    if (!layersIn.length) {
      jsonWithSecurity(req, res, 400, { ok: false, error: "minstens één laag vereist" });
      return;
    }

    const materialIds = [
      ...new Set(layersIn.map((L) => L.material_id).filter((id) => typeof id === "string" && id)),
    ];
    const matById = new Map();
    if (materialIds.length) {
      const mq = await client.query(
        `SELECT id::text AS material_id, catalog_id, name,
                thickness_mm, weight_kg_m2,
                CASE WHEN thickness_mm > 0 AND weight_kg_m2 > 0
                     THEN weight_kg_m2 / (thickness_mm / 1000.0) ELSE NULL END AS density_kg_m3,
                r_63_hz, r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
                ra_dba, rw_db, c_db, ctr_db
         FROM app_gevelwering.material
         WHERE id = ANY($1::uuid[])`,
        [materialIds],
      );
      for (const row of mq.rows) matById.set(row.material_id, row);
    }

    const resolved = [];
    for (const raw of layersIn) {
      const mat = raw.material_id ? matById.get(String(raw.material_id)) : null;
      const thickness =
        raw.thickness_mm != null && raw.thickness_mm !== ""
          ? Number(raw.thickness_mm)
          : mat?.thickness_mm != null
            ? Number(mat.thickness_mm)
            : null;
      const density =
        raw.density_kg_m3 != null && raw.density_kg_m3 !== ""
          ? Number(raw.density_kg_m3)
          : mat?.density_kg_m3 != null
            ? Number(mat.density_kg_m3)
            : null;
      const studWidth =
        raw.stud_width_mm != null && raw.stud_width_mm !== "" ? Number(raw.stud_width_mm) : null;
      const studDepth =
        raw.stud_depth_mm != null && raw.stud_depth_mm !== "" ? Number(raw.stud_depth_mm) : null;
      const studSpacing =
        raw.stud_spacing_mm != null && raw.stud_spacing_mm !== ""
          ? Number(raw.stud_spacing_mm)
          : null;

      let weight =
        thickness != null && density != null
          ? density * (thickness / 1000)
          : mat?.weight_kg_m2 != null
            ? Number(mat.weight_kg_m2)
            : null;

      const layerInput = {
        layer_kind: String(raw.layer_kind || "other"),
        acoustic_role: String(raw.acoustic_role || "structural"),
        thickness_mm: thickness,
        density_kg_m3: density,
        surface_mass_kg_m2: weight,
        cavity_depth_mm:
          raw.cavity_depth_mm != null && raw.cavity_depth_mm !== ""
            ? Number(raw.cavity_depth_mm)
            : null,
        stud_width_mm: studWidth,
        stud_depth_mm: studDepth,
        stud_spacing_mm: studSpacing,
        r_63_hz: mat?.r_63_hz,
        r_125_hz: mat?.r_125_hz,
        r_250_hz: mat?.r_250_hz,
        r_500_hz: mat?.r_500_hz,
        r_1000_hz: mat?.r_1000_hz,
        r_2000_hz: mat?.r_2000_hz,
        r_4000_hz: mat?.r_4000_hz,
      };
      const calc = layerSpectrumFromInput(layerInput);
      if (calc.surface_mass_kg_m2 != null) weight = calc.surface_mass_kg_m2;
      const grid = calc.wood_grid || woodGridMetrics(layerInput);
      resolved.push({
        layer_order: Number(raw.layer_order) || resolved.length + 1,
        layer_kind: layerInput.layer_kind,
        label: String(raw.label || mat?.name || layerInput.layer_kind),
        acoustic_role: layerInput.acoustic_role,
        thickness_mm: thickness,
        density_kg_m3: density,
        surface_mass_kg_m2: weight,
        cavity_depth_mm: layerInput.cavity_depth_mm,
        stud_width_mm: studWidth,
        stud_depth_mm: studDepth,
        stud_spacing_mm: studSpacing,
        phi: grid?.phi ?? null,
        m_eq_kg_m2: grid?.m_eq_kg_m2 ?? null,
        material_id: mat?.material_id || null,
        catalog_id: mat?.catalog_id || null,
        material_name: mat?.name || null,
        method: calc.method,
        note: calc.note,
        spectrum: calc.spectrum,
        rw_db: calc.ratings.rw_db,
        c_db: calc.ratings.c_db,
        ctr_db: calc.ratings.ctr_db,
        catalog_rw_db: mat?.rw_db != null ? Number(mat.rw_db) : null,
      });
    }

    resolved.sort((a, b) => a.layer_order - b.layer_order);

    const stackSpec = stackSpectrumDb(resolved);
    const stackRatings = computeRatings(stackSpec);
    const raApprox = approximateRaFromR(stackSpec);

    jsonWithSecurity(req, res, 200, {
      ok: true,
      template_code: body.template_code || null,
      name: body.name || null,
      assembly_family: body.assembly_family || "overig",
      layers: resolved,
      stack: {
        method: "msm_preview",
        spectrum: stackSpec,
        rw_db: stackRatings.rw_db,
        c_db: stackRatings.c_db,
        ctr_db: stackRatings.ctr_db,
        ra_dba_approx: raApprox,
        note: "MSM-preview over structurele bladen + spouw — ter vergelijking; goedkeuren na meting/catalogus.",
      },
    });
  } catch (err) {
    console.error("materials-studio compose-preview failed:", err);
    jsonWithSecurity(req, res, 500, { ok: false, error: "preview mislukt" });
  } finally {
    client.release();
  }
}

/**
 * Save compose result as wall_assembly template and/or proposed composite concept.
 * Body: {
 *   save_template: bool,
 *   template_code, name, description, assembly_family,
 *   save_concept: bool,
 *   concept_name, catalog_id?,
 *   layers: [...]  // same as preview; must include computed fields or material_ids
 *   stack_spectrum: {125:..}, stack_rw?, stack_ra?
 * }
 */
export async function handleMaterialsStudioComposeSave(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await requireAdmin(client, req, res);
    if (!session) return;
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      jsonWithSecurity(req, res, err?.code === "LIMIT" ? 413 : 400, {
        ok: false,
        error: err?.code === "LIMIT" ? "payload too large" : "ongeldige JSON",
      });
      return;
    }

    const layers = Array.isArray(body.layers) ? body.layers : [];
    if (!layers.length) {
      jsonWithSecurity(req, res, 400, { ok: false, error: "minstens één laag vereist" });
      return;
    }

    const saveTemplate = body.save_template === true;
    const saveConcept = body.save_concept === true;
    if (!saveTemplate && !saveConcept) {
      jsonWithSecurity(req, res, 400, {
        ok: false,
        error: "kies save_template en/of save_concept",
      });
      return;
    }

    await client.query("BEGIN");

    let templateCode = String(body.template_code || "").trim();
    let assemblyId = null;

    if (saveTemplate) {
      if (!templateCode) {
        const fam = String(body.assembly_family || "overig").toUpperCase().replace(/[^A-Z0-9]+/g, "-");
        templateCode = `ASM-${fam || "OVERIG"}-CUSTOM-${Date.now().toString(36).toUpperCase()}`;
      }
      const name = String(body.name || templateCode).trim();
      const family = ["dak", "buitengevel", "overig"].includes(body.assembly_family)
        ? body.assembly_family
        : "overig";
      const description =
        String(body.description || "").trim() ||
        `Samengesteld template (buiten→binnen), aangemaakt in Materials Studio door ${session.username}.`;

      const up = await client.query(
        `INSERT INTO acoustic_catalog.wall_assembly (code, name, description, assembly_family)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           assembly_family = EXCLUDED.assembly_family,
           updated_at = now()
         RETURNING id::text AS id, code`,
        [templateCode, name, description, family],
      );
      assemblyId = up.rows[0].id;
      templateCode = up.rows[0].code;

      await client.query(`DELETE FROM acoustic_catalog.wall_assembly_layer WHERE assembly_id = $1::uuid`, [
        assemblyId,
      ]);

      for (const L of layers) {
        const grid = woodGridMetrics({
          layer_kind: L.layer_kind,
          stud_width_mm: L.stud_width_mm,
          stud_depth_mm: L.stud_depth_mm,
          stud_spacing_mm: L.stud_spacing_mm,
          thickness_mm: L.thickness_mm,
          density_kg_m3: L.density_kg_m3,
        });
        await client.query(
          `INSERT INTO acoustic_catalog.wall_assembly_layer (
             assembly_id, layer_order, layer_kind, label,
             thickness_mm, density_kg_m3, surface_mass_kg_m2, cavity_depth_mm,
             stud_width_mm, stud_depth_mm, stud_spacing_mm,
             acoustic_role, params
           ) VALUES (
             $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
           )`,
          [
            assemblyId,
            Number(L.layer_order),
            String(L.layer_kind || "other"),
            String(L.label || L.layer_kind || "laag"),
            L.thickness_mm != null ? Number(L.thickness_mm) : null,
            L.density_kg_m3 != null ? Number(L.density_kg_m3) : null,
            L.surface_mass_kg_m2 != null
              ? Number(L.surface_mass_kg_m2)
              : grid?.m_eq_kg_m2 ?? null,
            L.cavity_depth_mm != null ? Number(L.cavity_depth_mm) : null,
            L.stud_width_mm != null ? Number(L.stud_width_mm) : null,
            L.stud_depth_mm != null ? Number(L.stud_depth_mm) : null,
            L.stud_spacing_mm != null ? Number(L.stud_spacing_mm) : null,
            String(L.acoustic_role || "structural"),
            JSON.stringify({
              material_id: L.material_id || null,
              catalog_id: L.catalog_id || null,
              method: L.method || null,
              phi: grid?.phi ?? null,
              m_eq_kg_m2: grid?.m_eq_kg_m2 ?? null,
              phi_readonly: true,
            }),
          ],
        );
      }
    }

    let conceptId = null;
    let spectrumVersionId = null;
    if (saveConcept) {
      const stack = body.stack_spectrum || {};
      const r125 = Number(stack["125"] ?? stack[125]);
      if (!Number.isFinite(r125)) {
        throw Object.assign(new Error("stack spectrum (125 Hz) ontbreekt — eerst preview"), {
          code: "NO_STACK",
        });
      }
      const conceptName = String(body.concept_name || body.name || "Samengesteld component").trim();
      const catalogId =
        String(body.catalog_id || "").trim() ||
        `COMP-${Date.now().toString(36).toUpperCase()}`;
      const attr = `afgeleid (spectrum patroon stack ${templateCode || "custom"})`;

      const cq = await client.query(
        `INSERT INTO acoustic_catalog.material_concept (
           catalog_source, catalog_id, material_kind, name, source_ref
         ) VALUES (
           'materials-studio', $1, 'composite_stack', $2, $3
         )
         ON CONFLICT DO NOTHING
         RETURNING id::text AS id`,
        [catalogId, conceptName, templateCode || null],
      );
      if (cq.rows[0]) {
        conceptId = cq.rows[0].id;
      } else {
        const existing = await client.query(
          `SELECT id::text AS id FROM acoustic_catalog.material_concept
           WHERE catalog_source = 'materials-studio' AND catalog_id = $1`,
          [catalogId],
        );
        conceptId = existing.rows[0]?.id;
      }
      if (!conceptId) throw new Error("kon concept niet aanmaken");

      if (assemblyId) {
        await client.query(
          `INSERT INTO acoustic_catalog.concept_assembly (concept_id, assembly_id)
           VALUES ($1::uuid, $2::uuid)
           ON CONFLICT (concept_id) DO UPDATE SET assembly_id = EXCLUDED.assembly_id`,
          [conceptId, assemblyId],
        );
      }

      const verNoQ = await client.query(
        `SELECT COALESCE(MAX(version_no), -1) + 1 AS n
         FROM acoustic_catalog.spectrum_version WHERE concept_id = $1::uuid`,
        [conceptId],
      );
      const versionNo = Number(verNoQ.rows[0].n) || 0;
      const ratings = computeRatings({
        125: r125,
        250: Number(stack["250"] ?? stack[250]),
        500: Number(stack["500"] ?? stack[500]),
        1000: Number(stack["1000"] ?? stack[1000]),
        2000: Number(stack["2000"] ?? stack[2000]),
        4000: Number(stack["4000"] ?? stack[4000] ?? stack["2000"] ?? stack[2000]),
      });
      const ra =
        body.stack_ra != null
          ? Number(body.stack_ra)
          : approximateRaFromR({
              125: r125,
              250: Number(stack["250"] ?? stack[250]),
              500: Number(stack["500"] ?? stack[500]),
              1000: Number(stack["1000"] ?? stack[1000]),
              2000: Number(stack["2000"] ?? stack[2000]),
            });

      const sv = await client.query(
        `INSERT INTO acoustic_catalog.spectrum_version (
           concept_id, version_kind, version_no, status, is_latest_approved,
           source_attribution,
           r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
           ra_dba, rw_db, c_db, ctr_db, notes
         ) VALUES (
           $1::uuid, 'instance', $2, 'proposed', false,
           $3,
           $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14
         )
         RETURNING id::text AS id`,
        [
          conceptId,
          versionNo,
          attr,
          r125,
          Number(stack["250"] ?? stack[250]),
          Number(stack["500"] ?? stack[500]),
          Number(stack["1000"] ?? stack[1000]),
          Number(stack["2000"] ?? stack[2000]),
          Number(stack["4000"] ?? stack[4000] ?? stack["2000"] ?? stack[2000]) || null,
          ra,
          ratings.rw_db,
          ratings.c_db,
          ratings.ctr_db,
          `Compose-assistent ${session.username}; template ${templateCode || "—"}.`,
        ],
      );
      spectrumVersionId = sv.rows[0].id;
    }

    await client.query("COMMIT");
    jsonWithSecurity(req, res, 200, {
      ok: true,
      template_code: templateCode || null,
      assembly_id: assemblyId,
      concept_id: conceptId,
      spectrum_version_id: spectrumVersionId,
      status: saveConcept ? "proposed" : "template_saved",
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("materials-studio compose-save failed:", err);
    const msg =
      err?.code === "NO_STACK"
        ? err.message
        : "opslaan mislukt";
    jsonWithSecurity(req, res, 500, { ok: false, error: msg });
  } finally {
    client.release();
  }
}

const FAMILY_MASTER = {
  dak: {
    master_category: "Dak-, vloer-, plafondconstructies",
    category: "Hellend dak houtachtig",
    rubriek_nr: 3,
    subrubriek_nr: 4,
  },
  buitengevel: {
    master_category: "Lichte paneelconstr./borstweringen/deuren",
    category: "Sandwich panelen",
    rubriek_nr: 4,
    subrubriek_nr: 1,
  },
  overig: {
    master_category: "Losse materialen",
    category: "Overig",
    rubriek_nr: 10,
    subrubriek_nr: 10,
  },
};

/**
 * Approve a proposed composite spectrum and upsert into app_gevelwering.material (A#####).
 * Body: { concept_id }
 */
export async function handleMaterialsStudioApprovePublish(req, res) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await requireAdmin(client, req, res);
    if (!session) return;
    let body;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      jsonWithSecurity(req, res, err?.code === "LIMIT" ? 413 : 400, {
        ok: false,
        error: err?.code === "LIMIT" ? "payload too large" : "ongeldige JSON",
      });
      return;
    }
    const conceptId = String(body.concept_id || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(conceptId)) {
      jsonWithSecurity(req, res, 400, { ok: false, error: "concept_id vereist" });
      return;
    }

    await client.query("BEGIN");

    const cq = await client.query(
      `SELECT c.id::text AS concept_id,
              c.name,
              c.catalog_id,
              c.published_material_id::text AS published_material_id,
              c.thickness_mm,
              COALESCE(a.assembly_family, 'overig') AS assembly_family,
              a.code AS template_code
       FROM acoustic_catalog.material_concept c
       LEFT JOIN acoustic_catalog.concept_assembly ca ON ca.concept_id = c.id
       LEFT JOIN acoustic_catalog.wall_assembly a ON a.id = ca.assembly_id
       WHERE c.id = $1::uuid
       FOR UPDATE OF c`,
      [conceptId],
    );
    if (!cq.rows[0]) {
      await client.query("ROLLBACK");
      jsonWithSecurity(req, res, 404, { ok: false, error: "concept niet gevonden" });
      return;
    }
    const concept = cq.rows[0];

    const svQ = await client.query(
      `SELECT id::text AS id, version_no,
              r_63_hz, r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
              ra_dba, rw_db, c_db, ctr_db, source_attribution, status
       FROM acoustic_catalog.spectrum_version
       WHERE concept_id = $1::uuid
         AND status IN ('proposed', 'approved')
       ORDER BY
         CASE WHEN status = 'proposed' THEN 0 ELSE 1 END,
         version_no DESC
       LIMIT 1
       FOR UPDATE`,
      [conceptId],
    );
    if (!svQ.rows[0]) {
      await client.query("ROLLBACK");
      jsonWithSecurity(req, res, 400, { ok: false, error: "geen spectrumversie om te publiceren" });
      return;
    }
    const sv = svQ.rows[0];

    await client.query(
      `UPDATE acoustic_catalog.spectrum_version
       SET is_latest_approved = false
       WHERE concept_id = $1::uuid AND is_latest_approved`,
      [conceptId],
    );
    await client.query(
      `UPDATE acoustic_catalog.spectrum_version
       SET status = 'approved',
           is_latest_approved = true,
           approved_at = now(),
           approved_by = $2
       WHERE id = $1::uuid`,
      [sv.id, session.username],
    );

    const familyMeta = FAMILY_MASTER[concept.assembly_family] || FAMILY_MASTER.overig;

    let thicknessMm = concept.thickness_mm != null ? Number(concept.thickness_mm) : null;
    if (!(thicknessMm > 0)) {
      const thQ = await client.query(
        `SELECT COALESCE(SUM(l.thickness_mm), 0)::float8 AS t
         FROM acoustic_catalog.concept_assembly ca
         JOIN acoustic_catalog.wall_assembly_layer l ON l.assembly_id = ca.assembly_id
         WHERE ca.concept_id = $1::uuid
           AND l.layer_kind NOT IN ('cavity_ventilated', 'membrane', 'vapor_barrier')`,
        [conceptId],
      );
      const t = Number(thQ.rows[0]?.t);
      thicknessMm = t > 0 ? Math.round(t * 10) / 10 : null;
    }

    const rDb = [
      sv.r_125_hz,
      sv.r_250_hz,
      sv.r_500_hz,
      sv.r_1000_hz,
      sv.r_2000_hz,
      sv.r_4000_hz != null ? sv.r_4000_hz : sv.r_2000_hz,
    ].map((x) => (x == null || !Number.isFinite(Number(x)) ? null : Number(x)));

    let materialId = concept.published_material_id;
    let catalogId = null;
    let created = false;

    if (materialId) {
      const up = await client.query(
        `UPDATE app_gevelwering.material SET
           name = $2,
           master_category = $3,
           category = $4,
           rubriek_nr = $5,
           subrubriek_nr = $6,
           thickness_mm = COALESCE($7, thickness_mm),
           ra_dba = $8,
           rw_db = $9,
           c_db = $10,
           ctr_db = $11,
           r_63_hz = $12,
           r_125_hz = $13,
           r_250_hz = $14,
           r_500_hz = $15,
           r_1000_hz = $16,
           r_2000_hz = $17,
           r_4000_hz = $18,
           r_db = $19::double precision[],
           spectrum_ok = true,
           source_ref = $20,
           source_attribution = $21,
           acoustic_concept_id = $22::uuid,
           acoustic_spectrum_version_id = $23::uuid,
           updated_at = now()
         WHERE id = $1::uuid
         RETURNING id::text AS id, catalog_id`,
        [
          materialId,
          concept.name,
          familyMeta.master_category,
          familyMeta.category,
          familyMeta.rubriek_nr,
          familyMeta.subrubriek_nr,
          thicknessMm,
          sv.ra_dba,
          sv.rw_db,
          sv.c_db,
          sv.ctr_db,
          sv.r_63_hz,
          sv.r_125_hz,
          sv.r_250_hz,
          sv.r_500_hz,
          sv.r_1000_hz,
          sv.r_2000_hz,
          sv.r_4000_hz,
          rDb,
          `Studio compose → ${concept.template_code || "custom"}`,
          sv.source_attribution || `Materials Studio (${session.username})`,
          conceptId,
          sv.id,
        ],
      );
      if (!up.rows[0]) {
        materialId = null;
      } else {
        catalogId = up.rows[0].catalog_id;
      }
    }

    if (!materialId) {
      const nextQ = await client.query(
        `SELECT
           COALESCE(MAX(material_no), 0) + 1 AS material_no,
           COALESCE(MAX(catalog_index), -1) + 1 AS catalog_index
         FROM app_gevelwering.material
         WHERE source = 'app'`,
      );
      const materialNo = Number(nextQ.rows[0].material_no) || 1;
      const catalogIndex = Number(nextQ.rows[0].catalog_index);
      catalogId = `A${String(materialNo).padStart(5, "0")}`;

      const ins = await client.query(
        `INSERT INTO app_gevelwering.material (
           catalog_index, catalog_id, material_no,
           master_category, name, category,
           rubriek_nr, subrubriek_nr,
           thickness_mm,
           r_63_hz, r_125_hz, r_250_hz, r_500_hz, r_1000_hz, r_2000_hz, r_4000_hz,
           r_db, ra_dba, rw_db, c_db, ctr_db,
           spectrum_ok, source, source_ref, source_attribution,
           acoustic_concept_id, acoustic_spectrum_version_id
         ) VALUES (
           $1, $2, $3,
           $4, $5, $6,
           $7, $8,
           $9,
           $10, $11, $12, $13, $14, $15, $16,
           $17::double precision[], $18, $19, $20, $21,
           true, 'app', $22, $23,
           $24::uuid, $25::uuid
         )
         RETURNING id::text AS id, catalog_id`,
        [
          catalogIndex,
          catalogId,
          materialNo,
          familyMeta.master_category,
          concept.name,
          familyMeta.category,
          familyMeta.rubriek_nr,
          familyMeta.subrubriek_nr,
          thicknessMm,
          sv.r_63_hz,
          sv.r_125_hz,
          sv.r_250_hz,
          sv.r_500_hz,
          sv.r_1000_hz,
          sv.r_2000_hz,
          sv.r_4000_hz,
          rDb,
          sv.ra_dba,
          sv.rw_db,
          sv.c_db,
          sv.ctr_db,
          `Studio compose → ${concept.template_code || "custom"}`,
          sv.source_attribution || `Materials Studio (${session.username})`,
          conceptId,
          sv.id,
        ],
      );
      materialId = ins.rows[0].id;
      catalogId = ins.rows[0].catalog_id;
      created = true;
    }

    await client.query(
      `UPDATE acoustic_catalog.material_concept
       SET published_material_id = $2::uuid,
           rubriek_nr = $3,
           subrubriek_nr = $4,
           thickness_mm = COALESCE($5, thickness_mm),
           updated_at = now()
       WHERE id = $1::uuid`,
      [
        conceptId,
        materialId,
        familyMeta.rubriek_nr,
        familyMeta.subrubriek_nr,
        thicknessMm,
      ],
    );

    await client.query("COMMIT");
    jsonWithSecurity(req, res, 200, {
      ok: true,
      concept_id: conceptId,
      material_id: materialId,
      catalog_id: catalogId,
      name: concept.name,
      created,
      spectrum_version_id: sv.id,
      ra_dba: sv.ra_dba,
      rw_db: sv.rw_db,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("materials-studio approve-publish failed:", err);
    jsonWithSecurity(req, res, 500, {
      ok: false,
      error: err?.message ? String(err.message).slice(0, 200) : "goedkeuren/publiceren mislukt",
    });
  } finally {
    client.release();
  }
}
