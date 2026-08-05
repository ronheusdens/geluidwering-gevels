# Acoustics

First **application** on [bppServer](https://github.com/ronheusdens/bppServer) — not part of the server product. More apps will follow the same pattern: own repo, consume bppServer over TCP/WebSocket.

## Layout

| Path | Role |
|------|------|
| `client/` | HTML/TS UI (form, admin, materials, engineer, floormap, GA) |
| `lib/database/` | Basic++ Postgres OOP helpers (`INCLUDE` from fixtures) |
| `fixtures/app-gevelwering/` | Basic++ API programs (`INCLUDE` via `BASIC_CWD`) |
| `sql/` | Postgres DDL / seeds |
| `docs/` | Materials catalogs, convert scripts, deploy notes |
| `scripts/` | Apache HTTPS example |
| `start.sh` | Local stack: DDL + bppServer + UI |

## Prerequisites

- Sibling (or configured) bppServer build: `../bppServer/build/bin/bppServer`
- Postgres database `app_gevelwering` (override with `BPP_PG_DB`)
- Node.js + npm for the UI

```bash
# Build server once (separate repo)
cd ../bppServer && ./scripts/bootstrap-core.sh && make

# Run this app
cd ../app-gevelwering && ./start.sh
```

Override server location: `BPPSERVER_ROOT=/path/to/bppServer ./start.sh`

UI `:4173`, WebSocket `:18080` (defaults).

## Docs

- Architecture (overview, schema, multi-variant GA): [`docs/architecture/`](docs/architecture/)
- Engineer-handleiding (online): [`/handleiding.html`](client/public/handleiding.html) na `./start.sh`
- Secure deploy: [`client/docs/secure-deployment.md`](client/docs/secure-deployment.md)
- Apache template: [`scripts/apache2/app-gevelwering-https.conf`](scripts/apache2/app-gevelwering-https.conf)
