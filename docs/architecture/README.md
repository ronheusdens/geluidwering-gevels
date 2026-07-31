# Architecture — app-gevelwering

Product design for **geluidwering gevels** on [bppServer](../../../bppServer/).

| Doc | Role |
|-----|------|
| [app-gevelwering-overview.md](app-gevelwering-overview.md) | Product overview, **materiaaltoekenning + compositie-workflow** (§5), handoff |
| [../workflow gevelweringgevels-app.drawio](../workflow%20gevelweringgevels-app.drawio) | Procesflow diagram (draw.io) |
| [app-gevelwering-postgres-schema.md](app-gevelwering-postgres-schema.md) | Versioned PostgreSQL DDL + material/floormap APIs |
| [facade-sound-insulation-app.md](facade-sound-insulation-app.md) | Design driver / invokes (aanvulling op overview §5) |

**Zusterapp:** [`c/app-berekening-wegverkeer/docs/architecture/`](../../../app-berekening-wegverkeer/docs/architecture/)

**Server protocol / runtime:** sibling bppServer [`server-runtime-rfc.md`](../../../bppServer/docs/Architectural_aspects/09-bppserver/server-runtime-rfc.md).

**Secure deploy:** [`../client/docs/secure-deployment.md`](../client/docs/secure-deployment.md).
