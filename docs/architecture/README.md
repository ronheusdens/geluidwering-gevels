# Acoustics architecture docs

Product design for Acoustics apps on [bppServer](../../../bppServer/). Not part of Basic++ language docs.

| Doc | Role |
|-----|------|
| [acoustics-suite-overview.md](acoustics-suite-overview.md) | Two apps, shared building data, `NoiseLoad` handoff |
| [acoustics-postgres-schema.md](acoustics-postgres-schema.md) | Versioned PostgreSQL DDL |
| [road-traffic-noise-app.md](road-traffic-noise-app.md) | App 1 — road traffic Laeq |
| [facade-sound-insulation-app.md](facade-sound-insulation-app.md) | App 2 — façade insulation |

**Server protocol / runtime:** sibling bppServer [`server-runtime-rfc.md`](../../../bppServer/docs/Architectural_aspects/09-bppserver/server-runtime-rfc.md).

**Secure deploy (this app):** [`../client/docs/secure-deployment.md`](../client/docs/secure-deployment.md) — path from repo root: `client/docs/secure-deployment.md`.
