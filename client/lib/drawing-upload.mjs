/**
 * P1 HTTP drawing upload — binary POST, parameterized INSERT into app_gevelwering.document.
 *
 * POST /api/drawings/upload?building_id=<uuid>&filename=<name>
 * Headers: Authorization: Bearer <session_token>  OR cookie app_gevelwering_session
 * Body: application/octet-stream (raw file bytes)
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

const MAX_UPLOAD_BYTES = Number(process.env.GEVELWERING_MAX_UPLOAD_BYTES || 100 * 1024 * 1024);

function json(req, res, status, body) {
  jsonWithSecurity(req, res, status, body);
}

function safeFilename(raw) {
  if (!raw || typeof raw !== "string") return "";
  const base = raw.split(/[/\\]/).pop() || "";
  return base.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 255);
}

function fileExtension(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot + 1).toLowerCase();
}

function contentTypeForExt(ext) {
  if (ext === "pdf") return "application/pdf";
  if (ext === "dwg") return "application/acad";
  return "application/octet-stream";
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {number} maxBytes
 * @returns {Promise<Buffer>}
 */
function readBodyLimited(req, maxBytes) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
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

    req.on("end", () => resolve(Buffer.concat(chunks)));
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

async function assertProjectOwned(client, buildingId, ownerId) {
  const { rows } = await client.query(
    `SELECT b.id::text AS id
     FROM app_gevelwering.building b
     WHERE b.id = $1::uuid
       AND (b.owner_user_id = $2::uuid OR b.owner_user_id IS NULL)`,
    [buildingId, ownerId],
  );
  return rows.length > 0;
}

async function assertProjectUploadAllowed(client, buildingId, ownerId) {
  const { rows } = await client.query(
    `SELECT b.project_status::text AS project_status
     FROM app_gevelwering.building b
     WHERE b.id = $1::uuid
       AND (b.owner_user_id = $2::uuid OR b.owner_user_id IS NULL)`,
    [buildingId, ownerId],
  );
  if (rows.length < 1) {
    return { ok: false, status: 404, error: "project not found" };
  }
  if (rows[0].project_status !== "INITIAL_REQUEST") {
    return {
      ok: false,
      status: 403,
      error: "drawings can only be uploaded while project status is INITIAL_REQUEST",
    };
  }
  return { ok: true };
}

export function handleDrawingApiOptions(req, res) {
  res.writeHead(204, {
    ...corsHeaders(req),
    ...securityHeaders(req),
  });
  res.end();
}

/** @deprecated use handleDrawingApiOptions */
export const handleDrawingUploadOptions = handleDrawingApiOptions;

/**
 * GET /api/drawings/list?building_id=<uuid>
 * Headers: Authorization: Bearer <session_token>
 */
export async function handleDrawingList(req, res, url) {
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
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired — login again" });
      return;
    }
    const ownerId = session.user_id;

    if (!(await assertProjectOwned(client, buildingId, ownerId))) {
      json(req, res, 404, { ok: false, error: "project not found" });
      return;
    }

    const { rows } = await client.query(
      `SELECT d.id::text AS id,
              d.filename,
              d.file_ext,
              d.byte_size::text AS byte_size,
              d.created_at::text AS created_at
       FROM app_gevelwering.document d
       WHERE d.building_id = $1::uuid
       ORDER BY d.created_at ASC`,
      [buildingId],
    );

    json(req, res, 200, {
      ok: true,
      building_id: buildingId,
      documents: rows,
    });
  } catch (err) {
    console.error("drawing list failed:", err);
    json(req, res, 500, { ok: false, error: "failed to list drawings" });
  } finally {
    client.release();
  }
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {URL} url
 */
export async function handleDrawingUpload(req, res, url) {
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

  const buildingId = (url.searchParams.get("building_id") || "").trim();
  const filename = safeFilename(url.searchParams.get("filename") || "");
  const ext = fileExtension(filename);

  if (!UUID_RE.test(buildingId)) {
    json(req, res, 400, { ok: false, error: "invalid building_id" });
    return;
  }
  if (!filename) {
    json(req, res, 400, { ok: false, error: "filename query parameter is required" });
    return;
  }
  if (ext !== "pdf" && ext !== "dwg") {
    json(req, res, 400, { ok: false, error: "only pdf and dwg files are allowed" });
    return;
  }

  let body;
  try {
    body = await readBodyLimited(req, MAX_UPLOAD_BYTES);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "LIMIT") {
      json(req, res, 413, {
        ok: false,
        error: `file exceeds maximum upload size (${MAX_UPLOAD_BYTES} bytes)`,
      });
      return;
    }
    json(req, res, 400, { ok: false, error: "failed to read request body" });
    return;
  }

  if (body.length === 0) {
    json(req, res, 400, { ok: false, error: "empty file body" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const session = await resolveSession(client, token);
    if (!session) {
      await client.query("ROLLBACK");
      json(req, res, 401, { ok: false, error: "session invalid or expired — login again" });
      return;
    }
    const ownerId = session.user_id;

    const gate = await assertProjectUploadAllowed(client, buildingId, ownerId);
    if (!gate.ok) {
      await client.query("ROLLBACK");
      json(req, res, gate.status, { ok: false, error: gate.error });
      return;
    }

    const { rows } = await client.query(
      `INSERT INTO app_gevelwering.document
         (building_id, filename, file_ext, content_type, content, byte_size, owner_user_id)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid)
       RETURNING id::text AS id, byte_size`,
      [buildingId, filename, ext, contentTypeForExt(ext), body, body.length, ownerId],
    );

    await client.query("COMMIT");

    json(req, res, 201, {
      ok: true,
      document_id: rows[0].id,
      building_id: buildingId,
      filename,
      file_ext: ext,
      byte_size: Number(rows[0].byte_size),
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("drawing upload failed:", err);
    json(req, res, 500, { ok: false, error: "drawing insert failed" });
  } finally {
    client.release();
  }
}

async function assertDocumentDownloadAllowed(client, documentId, session) {
  const { rows } = await client.query(
    `SELECT d.filename, d.file_ext, d.content_type, d.content
     FROM app_gevelwering.document d
     JOIN app_gevelwering.building b ON b.id = d.building_id
     WHERE d.id = $1::uuid
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

/**
 * GET /api/drawings/download?document_id=<uuid>
 * Headers: Authorization: Bearer <session_token>
 */
export async function handleDrawingDownload(req, res, url) {
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

  const documentId = (url.searchParams.get("document_id") || "").trim();
  if (!UUID_RE.test(documentId)) {
    json(req, res, 400, { ok: false, error: "invalid document_id" });
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

    const doc = await assertDocumentDownloadAllowed(client, documentId, session);
    if (!doc) {
      json(req, res, 404, { ok: false, error: "drawing not found" });
      return;
    }

    const body = doc.content;
    res.writeHead(200, {
      ...corsHeaders(req),
      ...securityHeaders(req),
      "Content-Type": doc.content_type || contentTypeForExt(doc.file_ext),
      "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"`,
      "Content-Length": body.length,
    });
    res.end(body);
  } catch (err) {
    console.error("drawing download failed:", err);
    json(req, res, 500, { ok: false, error: "failed to download drawing" });
  } finally {
    client.release();
  }
}

function isEngineerSession(session) {
  return session.username === "engineer" || session.username === "admin" || session.is_engineer === true;
}

/**
 * DELETE /api/drawings/sections?section_id=<uuid>
 * DELETE /api/drawings/sections?document_id=<uuid>  (clear all for drawing)
 * Headers: Authorization: Bearer <session_token>
 * Engineer/admin only.
 */
export async function handleDrawingSectionsDelete(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
  if (req.method !== "DELETE") {
    json(req, res, 405, { ok: false, error: "method not allowed" });
    return;
  }

  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "session required (Bearer or cookie)" });
    return;
  }

  const sectionId = (url.searchParams.get("section_id") || "").trim();
  const documentId = (url.searchParams.get("document_id") || "").trim();
  if (!sectionId && !documentId) {
    json(req, res, 400, { ok: false, error: "section_id or document_id is required" });
    return;
  }
  if (sectionId && !UUID_RE.test(sectionId)) {
    json(req, res, 400, { ok: false, error: "invalid section_id" });
    return;
  }
  if (documentId && !UUID_RE.test(documentId)) {
    json(req, res, 400, { ok: false, error: "invalid document_id" });
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

    if (sectionId) {
      const { rows } = await client.query(
        `DELETE FROM app_gevelwering.drawing_region WHERE id = $1::uuid RETURNING id::text AS id`,
        [sectionId],
      );
      if (rows.length < 1) {
        json(req, res, 404, { ok: false, error: "section not found" });
        return;
      }
      json(req, res, 200, { ok: true, deleted_section_id: rows[0].id });
      return;
    }

    const { rowCount } = await client.query(
      `DELETE FROM app_gevelwering.drawing_region WHERE document_id = $1::uuid`,
      [documentId],
    );
    json(req, res, 200, { ok: true, document_id: documentId, deleted_count: rowCount ?? 0 });
  } catch (err) {
    console.error("section delete failed:", err);
    json(req, res, 500, { ok: false, error: "failed to delete section(s)" });
  } finally {
    client.release();
  }
}
