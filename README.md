# Acoustics

First **application** on [bppServer](https://github.com/ronheusdens/bppServer) — not part of the server product. More apps will follow the same pattern: own repo, consume bppServer over TCP/WebSocket.

## Layout

| Path | Role |
|------|------|
| `client/` | HTML/TS UI (form, admin, materials, engineer, floormap, GA) |
| `fixtures/acoustics/` | Basic++ API programs (`INCLUDE` via `BASIC_CWD`) |
| `sql/` | Postgres DDL / seeds |
| `docs/` | Materials catalogs, convert scripts, deploy notes |
| `scripts/` | Apache HTTPS example |
| `start.sh` | Local stack: DDL + bppServer + UI |

## Prerequisites

- Sibling (or configured) bppServer build: `../bppServer/build/bin/bppServer`
- Postgres database `acoustics` (override with `BPP_PG_DB`)
- Node.js + npm for the UI

```bash
# Build server once (separate repo)
cd ../bppServer && ./scripts/bootstrap-core.sh && make

# Run this app
cd ../acoustics && ./start.sh
```

Override server location: `BPPSERVER_ROOT=/path/to/bppServer ./start.sh`

UI `:4173`, WebSocket `:18080` (defaults).

## Secure deploy

See [`client/docs/secure-deployment.md`](client/docs/secure-deployment.md) and [`scripts/apache2/acoustics-https.conf`](scripts/apache2/acoustics-https.conf).
