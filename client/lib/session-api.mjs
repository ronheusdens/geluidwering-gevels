/**
 * POST /api/session  { token } → Set-Cookie app_gevelwering_session (HttpOnly)
 * DELETE /api/session → clear cookie
 */
import {
  corsHeaders,
  jsonWithSecurity,
  parseSessionToken,
  requireHttpsOrReject,
  securityHeaders,
  sessionCookieHeader,
  isHttpsRequest,
} from "./http-security.mjs";

const TOKEN_RE = /^[0-9a-f]{32,128}$/i;

export function handleSessionApiOptions(req, res) {
  res.writeHead(204, {
    ...corsHeaders(req),
    ...securityHeaders(req),
  });
  res.end();
}

async function readJsonBody(req, limit = 64 * 1024) {
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

export async function handleSessionSave(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err && err.code === "LIMIT") {
      jsonWithSecurity(req, res, 413, { ok: false, error: "payload too large" });
      return;
    }
    jsonWithSecurity(req, res, 400, { ok: false, error: "invalid JSON body" });
    return;
  }
  const token = String(body.token || "").trim();
  if (!TOKEN_RE.test(token)) {
    jsonWithSecurity(req, res, 400, { ok: false, error: "invalid token" });
    return;
  }
  const secure = isHttpsRequest(req);
  jsonWithSecurity(req, res, 200, { ok: true }, {
    "Set-Cookie": sessionCookieHeader(token, { secure }),
  });
}

export function handleSessionClear(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  const secure = isHttpsRequest(req);
  jsonWithSecurity(req, res, 200, { ok: true }, {
    "Set-Cookie": sessionCookieHeader("", { clear: true, secure }),
  });
}

/** Optional: confirm cookie present (does not hit DB). */
export function handleSessionStatus(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  const token = parseSessionToken(req);
  jsonWithSecurity(req, res, 200, { ok: true, has_session: Boolean(token) });
}
