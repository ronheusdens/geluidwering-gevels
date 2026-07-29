# Secure deployment — Acoustics + bppServer

Public www traffic must be **HTTPS** (UI/API) and **WSS** (bppServer protocol). bppServer itself stays on loopback without in-process TLS.

## Threat model

| Threat | Mitigation |
|--------|------------|
| Sniff / MITM on the internet | TLS at Apache; HSTS |
| Fake bppServer (DNS / Wi‑Fi spoof) | Browser trusts your hostname certificate; clients use `wss://` same origin only |
| Cross-site page opening your WS | `BPP_WS_ORIGIN_ALLOWLIST` on WS handshake |
| Stolen session token (XSS) | CSP; HttpOnly `app_gevelwering_session` cookie for HTTP APIs; WS token in `sessionStorage` (not `localStorage`) |
| Arbitrary Basic++ invoke | Server-side `API_*` allowlist + session validation |
| Direct hit on backend ports | bppServer + Node bind **127.0.0.1** only |

TLS does **not** replace app auth. Every `API_*` still validates `login_session`.

## Architecture

```
Browser --HTTPS/WSS--> Apache (TLS)
                         |-- /ws   --> ws://127.0.0.1:18080  (bppServer)
                         |-- /api  --> http://127.0.0.1:4173 (Node UI APIs)
                         \-- /     --> http://127.0.0.1:4173 (static UI)
```

Template: [`scripts/apache2/app-gevelwering-https.conf`](../../scripts/apache2/app-gevelwering-https.conf)

## Checklist

1. Install modules: `a2enmod ssl headers proxy proxy_http proxy_wstunnel rewrite`
2. Copy/adapt `app-gevelwering-https.conf`; replace `app-gevelwering.example.com` and cert paths
3. Certbot: `certbot --apache -d app-gevelwering.example.com`
4. Run backends on loopback:
   - `bppServer --server --port 18080`
   - `GEVELWERING_UI_PORT=4173 node serve.mjs` (host defaults to `127.0.0.1`)
5. Environment (production):

```bash
export BPP_WS_ORIGIN_ALLOWLIST=https://app-gevelwering.example.com
export GEVELWERING_CORS_ORIGIN=https://app-gevelwering.example.com
export GEVELWERING_REQUIRE_HTTPS=1
# optional: GEVELWERING_FORCE_HTTPS=1  # emit HSTS even if proto header missing
```

6. systemd unit: [`scripts/systemd/bppServer.service`](../../scripts/systemd/bppServer.service) — must include `--server`; set `BPP_WS_ORIGIN_ALLOWLIST`
7. **Rotate demo passwords** (`demo` / `engineer` / `admin`) before any public deploy

## Client behaviour

- On `https:` pages, WebSocket URL is always `wss://${location.host}/ws` (ignores `?ws=`).
- On local `http:` (dev `./start.sh`), still `ws://hostname:18080/ws`.
- After login, `POST /api/session` sets HttpOnly cookie; logout clears it. Fetch uses `credentials: "include"`.

## Verification

1. Dev: `./start.sh` still works over cleartext localhost.
2. Staging: browser Network shows only `https://` and `wss://`.
3. Direct `http://server:18080` from the internet refused (firewall / bind).
4. WS from a foreign Origin rejected when allowlist is set.
5. `/api/floormap/*` works with cookie alone after login.
6. Response includes `Strict-Transport-Security` on HTTPS.

## What this does not claim

- No mutual TLS (client certificates)
- No in-process OpenSSL in bppServer
- WS invoke still needs a JS-visible token until a future cookie-bound gate; CSP is mandatory
