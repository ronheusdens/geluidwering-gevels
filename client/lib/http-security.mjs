/**
 * Shared HTTP security helpers for app-gevelwering serve + APIs.
 */
const SESSION_COOKIE = "app_gevelwering_session";
const SESSION_MAX_AGE_SEC = 12 * 60 * 60; // match login_session 12h

function isLocalDevHost(hostHeader) {
  const h = (hostHeader || "").split(":")[0].toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h === "[::1]" || h === "::1";
}

export function forwardedProto(req) {
  const xf = req.headers["x-forwarded-proto"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim().toLowerCase();
  return null;
}

export function isHttpsRequest(req) {
  if (process.env.GEVELWERING_FORCE_HTTPS === "1") return true;
  return forwardedProto(req) === "https";
}

/** Reject cleartext API access when GEVELWERING_REQUIRE_HTTPS=1 (behind TLS proxy). */
export function requireHttpsOrReject(req, res) {
  if (process.env.GEVELWERING_REQUIRE_HTTPS !== "1") return false;
  if (isHttpsRequest(req)) return false;
  const payload = JSON.stringify({
    ok: false,
    error: "HTTPS required (set X-Forwarded-Proto: https at the TLS proxy)",
  });
  res.writeHead(403, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
  return true;
}

/**
 * CORS: explicit GEVELWERING_CORS_ORIGIN in production; * only for local/dev when unset.
 */
export function corsHeaders(req) {
  const configured = (process.env.GEVELWERING_CORS_ORIGIN || "").trim();
  let origin;
  if (configured) {
    origin = configured;
  } else if (isLocalDevHost(req?.headers?.host)) {
    origin = "*";
  } else {
    // Same-origin behind proxy: omit wildcard; echo request Origin only if same host
    const reqOrigin = req?.headers?.origin;
    origin = typeof reqOrigin === "string" ? reqOrigin : "null";
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Credentials": origin === "*" ? "false" : "true",
    Vary: "Origin",
  };
}

export function securityHeaders(req) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data: blob:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  };
  if (isHttpsRequest(req) || process.env.GEVELWERING_FORCE_HTTPS === "1") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

export function parseCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw || typeof raw !== "string") return "";
  const parts = raw.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return "";
}

export function parseBearerToken(req) {
  const auth = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1].trim() : "";
}

/** Bearer header or app_gevelwering_session cookie. */
export function parseSessionToken(req) {
  const bearer = parseBearerToken(req);
  if (bearer) return bearer;
  return parseCookie(req, SESSION_COOKIE);
}

export function sessionCookieHeader(token, { clear = false, secure = false } = {}) {
  if (clear || !token) {
    return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
  }
  const safe = encodeURIComponent(token);
  return `${SESSION_COOKIE}=${safe}; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; HttpOnly; SameSite=Strict${
    secure ? "; Secure" : ""
  }`;
}

export { SESSION_COOKIE, SESSION_MAX_AGE_SEC };

export function jsonWithSecurity(req, res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...corsHeaders(req),
    ...securityHeaders(req),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}
