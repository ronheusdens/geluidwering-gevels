# Acoustics client (UI)

Web UI for the Acoustics app. Orchestration lives one level up: [`../start.sh`](../start.sh) and [`../README.md`](../README.md).

## URL

With `../start.sh` running:
- Landing (logo): **http://127.0.0.1:4173/**
- Opdrachtgever (login/projecten): **http://127.0.0.1:4173/opdrachtgever.html**  
WebSocket (dev): `ws://127.0.0.1:18080/ws`. On HTTPS: `wss://<host>/ws`.

**Production / TLS:** [docs/secure-deployment.md](docs/secure-deployment.md).

## What it does

1. Login / request access via `API_Login` / `API_RequestAccess`
2. Buildings and project status for the signed-in account
3. Admin / materials / engineer / floormap / GA pages
4. Drawing upload over HTTP; other APIs over WebSocket after `INCLUDE` of fixtures

**Logins:** `ronheusdens` / `demo` · `demo` / `demo` · `admin` / `demo` · `engineer` / `demo`

## Dev (UI only)

```bash
cd client
npm install
npm run build
npm run serve   # needs bppServer already running with BASIC_CWD=../..
```

Prefer `../start.sh` for the full local stack.
