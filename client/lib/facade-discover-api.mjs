/**
 * POST /api/floormap/discover-openings
 *
 * Hi-res bitmap analysis on the Node server (CV, no LLM).
 * Preferred: section_id + outer_points — server re-renders PDF crop (no pixel upload).
 * Legacy: width, height, pixels_b64 (small crops / tests only).
 */
import { getPool } from "./pg-config.mjs";
import { renderSectionCropRgba } from "./facade-discover-render.mjs";
import {
  corsHeaders,
  jsonWithSecurity,
  parseSessionToken,
  requireHttpsOrReject,
  securityHeaders,
} from "./http-security.mjs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_PIXELS = Number(process.env.GEVELWERING_DISCOVER_MAX_PIXELS || 16_000_000);
const DEFAULT_MAX_WORK_DIM = Number(process.env.GEVELWERING_DISCOVER_MAX_WORK_DIM || 2048);
const DEFAULT_RENDER_SCALE = Number(process.env.GEVELWERING_DISCOVER_RENDER_SCALE || 6);
const MAX_BODY_BYTES = Number(process.env.GEVELWERING_DISCOVER_MAX_BODY || 2 * 1024 * 1024);

/** @type {import("./facade-discover-core.mjs") | null} */
let discoverCore = null;

function json(req, res, status, body) {
  jsonWithSecurity(req, res, status, body);
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBodyText(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy();
        reject(Object.assign(new Error("Payload too large"), { code: "LIMIT" }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function resolveSession(client, token) {
  const { rows } = await client.query(
    `SELECT u.id::text AS user_id,
            u.username,
            u.is_engineer
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

function isEngineerSession(session) {
  return session.username === "engineer" || session.username === "admin" || session.is_engineer === true;
}

function coercePoints(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const x = Number(item.x);
    const y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y });
  }
  return out;
}

async function loadDiscoverCore() {
  if (discoverCore) return discoverCore;
  discoverCore = await import("./facade-discover-core.mjs");
  return discoverCore;
}

async function loadSectionRow(client, sectionId) {
  const { rows } = await client.query(
    `SELECT r.id::text AS id,
            r.document_id::text AS document_id,
            r.page_index,
            r.x_min::float8 AS x_min,
            r.y_min::float8 AS y_min,
            r.x_max::float8 AS x_max,
            r.y_max::float8 AS y_max,
            r.region_kind
     FROM app_gevelwering.drawing_region r
     WHERE r.id = $1::uuid
       AND r.region_kind = ANY (ARRAY['FACADE', 'SECTION', 'CROSS_SECTION', 'FLOORMAP']::text[])`,
    [sectionId],
  );
  return rows[0] ?? null;
}

async function loadDocumentPdf(client, documentId, session) {
  const { rows } = await client.query(
    `SELECT d.filename, d.file_ext, d.content
     FROM app_gevelwering.document d
     JOIN app_gevelwering.building b ON b.id = d.building_id
     WHERE d.id = $1::uuid
       AND d.file_ext = 'pdf'
       AND (
         $2 = 'admin'
         OR $3 = true
         OR b.owner_user_id = $4::uuid
         OR b.owner_user_id IS NULL
       )`,
    [documentId, session.username, session.is_engineer, session.user_id],
  );
  return rows[0] ?? null;
}

export async function handleFacadeDiscoverOptions(req, res) {
  res.writeHead(204, {
    ...corsHeaders(req),
    ...securityHeaders(req),
    Allow: "POST, OPTIONS",
  });
  res.end();
}

export async function handleFacadeDiscoverOpenings(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  if (req.method !== "POST") {
    json(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "session required (Bearer or cookie)" });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBodyText(req));
  } catch (err) {
    const msg = err?.code === "LIMIT" ? "request body too large" : "invalid JSON body";
    json(req, res, err?.code === "LIMIT" ? 413 : 400, { ok: false, error: msg });
    return;
  }

  const sectionId = String(payload.section_id || "").trim();
  const pixelsB64 = String(payload.pixels_b64 || "").trim();
  const outerPoints = coercePoints(payload.outer_points);
  const minAreaFraction = Number(payload.min_area_fraction);
  const maxWorkDim = Number(payload.max_work_dim);
  const maxLineWorkDim = Number(payload.max_line_work_dim);
  const renderScale = Number(payload.render_scale);

  if (!sectionId || !UUID_RE.test(sectionId)) {
    json(req, res, 400, { ok: false, error: "section_id required" });
    return;
  }
  if (outerPoints.length < 3) {
    json(req, res, 400, { ok: false, error: "outer_points must be a closed contour (≥3)" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired — login again" });
      return;
    }
    if (!isEngineerSession(session)) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }

    const section = await loadSectionRow(client, sectionId);
    if (!section) {
      json(req, res, 404, { ok: false, error: "section not found" });
      return;
    }

    let img;
    let renderSource = "pdf";
    const scale = Number.isFinite(renderScale)
      ? Math.max(1, Math.min(12, renderScale))
      : DEFAULT_RENDER_SCALE;

    if (pixelsB64) {
      renderSource = "upload";
      const width = Number(payload.width);
      const height = Number(payload.height);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 40 || height < 40) {
        json(req, res, 400, { ok: false, error: "width and height required with pixels_b64 (≥40)" });
        return;
      }
      if (width * height > MAX_PIXELS) {
        json(req, res, 413, { ok: false, error: `image too large (max ${MAX_PIXELS} pixels)` });
        return;
      }
      const buf = Buffer.from(pixelsB64, "base64");
      const expected = width * height * 4;
      if (buf.length < expected) {
        json(req, res, 400, {
          ok: false,
          error: `pixels_b64 decode length ${buf.length} < expected ${expected}`,
        });
        return;
      }
      const data = new Uint8ClampedArray(buf.buffer, buf.byteOffset, expected);
      img = { width, height, data, colorSpace: "srgb" };
    } else {
      const doc = await loadDocumentPdf(client, section.document_id, session);
      if (!doc?.content?.length) {
        json(req, res, 404, { ok: false, error: "PDF tekening niet gevonden voor deze sectie" });
        return;
      }
      try {
        img = await renderSectionCropRgba(doc.content, section, scale);
      } catch (renderErr) {
        console.error("discover PDF render failed:", renderErr);
        json(req, res, 500, {
          ok: false,
          error: renderErr instanceof Error ? renderErr.message : "PDF render mislukt",
        });
        return;
      }
    }

    if (img.width * img.height > MAX_PIXELS) {
      json(req, res, 413, {
        ok: false,
        error: `rendered crop too large (${img.width}×${img.height}, max ${MAX_PIXELS} px)`,
      });
      return;
    }

    const core = await loadDiscoverCore();
    const workDim = Number.isFinite(maxWorkDim)
      ? Math.max(64, Math.min(4096, maxWorkDim))
      : DEFAULT_MAX_WORK_DIM;
    const lineWorkDim = Number.isFinite(maxLineWorkDim)
      ? Math.max(64, Math.min(4096, maxLineWorkDim))
      : workDim;
    const minFrac = Number.isFinite(minAreaFraction)
      ? Math.max(0, Math.min(1, minAreaFraction))
      : 0;

    const meta = {
      inputW: 0,
      inputH: 0,
      workW: 0,
      workH: 0,
      lineWorkW: 0,
      lineWorkH: 0,
      kindCounts: { dark_fill: 0, paper_pocket: 0, line_rect: 0 },
    };

    const openings = core.discoverInteriorOpenings(img, outerPoints, {
      minAreaFraction: minFrac,
      maxWorkDim: workDim,
      maxLineWorkDim: lineWorkDim,
      meta,
    });

    json(req, res, 200, {
      ok: true,
      section_id: sectionId,
      width: img.width,
      height: img.height,
      render_source: renderSource,
      render_scale: renderSource === "pdf" ? scale : null,
      max_work_dim: workDim,
      max_line_work_dim: lineWorkDim,
      meta,
      count: openings.length,
      openings: openings.map((o) => ({
        points: o.points,
        areaPx: o.areaPx,
        kind: o.kind,
        shape: o.shape,
        circularity: o.circularity,
        suggestedLabel: o.suggestedLabel,
      })),
    });
  } catch (err) {
    console.error("facade discover-openings failed:", err);
    json(req, res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : "discover-openings failed",
    });
  } finally {
    client.release();
  }
}
