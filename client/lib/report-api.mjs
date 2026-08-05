/**
 * Report generation + filesystem storage under a logical project folder.
 *
 * Layout (default root: <app>/data/projecten):
 *   {werknummer-or-label}_{buildingId8}/
 *     rapporten/
 *       {stamp}_gevelwering_{variant}_{status}.html
 *       {same}.pdf             — print-PDF for opdrachtgever download
 *       {same}.sha256          — content hash (volatile timestamp stripped)
 *
 * POST /api/reports/generate      JSON: { building_id, variant_id?, status?, force? }
 * POST /api/reports/publish       JSON: { building_id, filename, report_kind?, version_label?, message? }
 *                                 filename may be .html or .pdf (inbox stores .pdf)
 * GET  /api/reports/list?building_id=
 * GET  /api/reports/download?building_id=&file=
 * GET  /api/reports/inbox?building_id=   (omit building_id → all owner projects)
 * POST /api/reports/inbox/read           JSON: { inbox_id }
 * POST /api/reports/inbox/email-request  JSON: { inbox_id }
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "./pg-config.mjs";
import { htmlFileToPdf, pdfNameFromHtml } from "./html-to-pdf.mjs";
import {
  corsHeaders,
  jsonWithSecurity,
  parseSessionToken,
  requireHttpsOrReject,
  securityHeaders,
} from "./http-security.mjs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_PROJECTS_ROOT = path.join(APP_ROOT, "data", "projecten");

function projectsRoot() {
  const env = (process.env.GEVELWERING_PROJECTS_ROOT || "").trim();
  return env ? path.resolve(env) : DEFAULT_PROJECTS_ROOT;
}

function json(req, res, status, body) {
  jsonWithSecurity(req, res, status, body);
}

function slugify(raw, fallback = "project") {
  const s = String(raw || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || fallback;
}

function stampNow(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function fmtNum(n, digits = 1) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip volatile timestamp line so identical report data yields the same hash. */
function canonicalContent(html) {
  return html.replace(/data-generated-at="[^"]*"/g, 'data-generated-at=""').replace(
    /Gegenereerd: [^<]+/g,
    "Gegenereerd:",
  );
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function resolveSession(client, token) {
  const { rows } = await client.query(
    `SELECT u.id::text AS user_id,
            u.username,
            COALESCE(u.is_engineer, false) AS is_engineer,
            u.username = 'admin' AS is_admin
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

async function assertCanAccessBuilding(client, buildingId, session) {
  const { rows } = await client.query(
    `SELECT b.id::text AS id,
            b.label,
            COALESCE(b.external_ref, '') AS external_ref,
            b.project_status::text AS project_status,
            b.owner_user_id::text AS owner_user_id
     FROM app_gevelwering.building b
     WHERE b.id = $1::uuid`,
    [buildingId],
  );
  const b = rows[0];
  if (!b) return null;
  if (isStaffSession(session) || b.owner_user_id === session.user_id || !b.owner_user_id) return b;
  return null;
}

function isStaffSession(session) {
  const eng = session.is_engineer === true || session.is_engineer === "t" || session.is_engineer === "true";
  const adm = session.is_admin === true || session.is_admin === "t" || session.username === "admin";
  return eng || adm;
}

function normalizeReportKind(raw) {
  const k = String(raw || "concept").trim().toLowerCase();
  if (k === "definitief" || k === "final" || k === "definitive") return "definitief";
  return "concept";
}

function defaultInboxMessage(kind) {
  const label = kind === "definitief" ? "definitieve" : "concept";
  return `De ${label} rapportage is beschikbaar. Klik hier om deze op te halen (of te laten e-mailen).`;
}

function mapInboxRow(row) {
  return {
    inbox_id: row.inbox_id,
    building_id: row.building_id,
    building_label: row.building_label || "",
    filename: row.filename,
    report_kind: row.report_kind,
    version_label: row.version_label,
    content_hash: row.content_hash || "",
    message: row.message || defaultInboxMessage(row.report_kind),
    published_at: row.published_at,
    read_at: row.read_at,
    downloaded_at: row.downloaded_at,
    email_requested_at: row.email_requested_at,
    unread: !row.read_at,
  };
}

function projectFolderName(building) {
  const key = building.external_ref?.trim() || building.label?.trim() || "project";
  return `${slugify(key)}_${String(building.id).slice(0, 8)}`;
}

function projectDir(building) {
  return path.join(projectsRoot(), projectFolderName(building));
}

function reportsDir(building) {
  return path.join(projectDir(building), "rapporten");
}

async function ensureReportsDir(building) {
  const dir = reportsDir(building);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function findIdenticalReport(dir, contentHash) {
  if (!fs.existsSync(dir)) return null;
  const files = await fsp.readdir(dir);
  for (const f of files) {
    if (!f.endsWith(".sha256")) continue;
    const hashPath = path.join(dir, f);
    const stored = (await fsp.readFile(hashPath, "utf8")).trim();
    if (stored === contentHash) {
      const htmlName = f.replace(/\.sha256$/, "");
      const htmlPath = path.join(dir, htmlName);
      if (fs.existsSync(htmlPath)) {
        return { filename: htmlName, path: htmlPath, hash: contentHash };
      }
    }
  }
  return null;
}

async function loadReportModel(client, buildingId, variantId) {
  const buildingQ = await client.query(
    `SELECT b.id::text AS id,
            b.label,
            COALESCE(b.external_ref, '') AS external_ref,
            b.project_status::text AS project_status,
            COALESCE(c.name, '') AS customer_name,
            COALESCE(a.street_line, '') AS street_line,
            COALESCE(a.postal_code, '') AS postal_code,
            COALESCE(a.city, '') AS city
     FROM app_gevelwering.building b
     LEFT JOIN app_gevelwering.customer c ON c.id = b.customer_id
     LEFT JOIN app_gevelwering.address a ON a.id = b.dwelling_address_id
     WHERE b.id = $1::uuid`,
    [buildingId],
  );
  const building = buildingQ.rows[0];
  if (!building) throw Object.assign(new Error("project not found"), { code: "NOT_FOUND" });

  let variant;
  if (variantId) {
    const vq = await client.query(
      `SELECT id::text AS variant_id, omschrijving, gebruiksfunctie,
              geluidsbelasting_dba, spectrum_kind
       FROM app_gevelwering.variant
       WHERE id = $1::uuid AND building_id = $2::uuid`,
      [variantId, buildingId],
    );
    variant = vq.rows[0];
  } else {
    const vq = await client.query(
      `SELECT id::text AS variant_id, omschrijving, gebruiksfunctie,
              geluidsbelasting_dba, spectrum_kind
       FROM app_gevelwering.variant
       WHERE building_id = $1::uuid
       ORDER BY sort_order ASC, created_at ASC
       LIMIT 1`,
      [buildingId],
    );
    variant = vq.rows[0];
  }
  if (!variant) throw Object.assign(new Error("geen variant in project"), { code: "NO_VARIANT" });

  const vgQ = await client.query(
    `SELECT g.id::text AS verblijfsgebied_id, g.omschrijving, g.sort_order
     FROM app_gevelwering.verblijfsgebied g
     WHERE g.variant_id = $1::uuid
     ORDER BY g.sort_order ASC, g.created_at ASC`,
    [variant.variant_id],
  );

  const vrs = [];
  for (const g of vgQ.rows) {
    const rq = await client.query(
      `SELECT r.id::text AS verblijfsruimte_id, r.omschrijving, r.vloer_m2, r.hoogte_m,
              r.volume_m3, r.t0_s, r.ga_dba, r.lbi_dba, r.gak_dba,
              COALESCE(s.vr_nr, '') AS vr_nr, COALESCE(s.vg_nr::text, '') AS vg_nr
       FROM app_gevelwering.verblijfsruimte r
       LEFT JOIN app_gevelwering.drawing_subsection s ON s.id = r.subsection_id
       WHERE r.verblijfsgebied_id = $1::uuid
       ORDER BY r.sort_order ASC, r.created_at ASC`,
      [g.verblijfsgebied_id],
    );
    for (const r of rq.rows) {
      const vlQ = await client.query(
        `SELECT v.id::text AS vlak_id,
                v.omschrijving,
                v.area_m2,
                COALESCE(v.orientatie, '') AS orientatie,
                v.cl_db,
                v.cg_db,
                v.meenemen_gak,
                v.facade_subsection_id::text AS facade_subsection_id,
                COALESCE(m.id::text, '') AS material_id,
                COALESCE(m.catalog_id, '') AS catalog_id,
                COALESCE(m.name, '') AS material_name,
                COALESCE(m.master_category, '') AS master_category,
                COALESCE(m.source, '') AS material_source,
                m.ra_dba,
                m.rw_db,
                m.c_db,
                m.ctr_db,
                m.r_63_hz,
                m.r_125_hz,
                m.r_250_hz,
                m.r_500_hz,
                m.r_1000_hz,
                m.r_2000_hz,
                m.r_4000_hz,
                COALESCE(m.spectrum_ok, false) AS spectrum_ok
         FROM app_gevelwering.vlak v
         LEFT JOIN app_gevelwering.drawing_subsection s
           ON s.id = v.facade_subsection_id
         LEFT JOIN LATERAL (
           SELECT m.*
           FROM app_gevelwering.material m
           WHERE (
             COALESCE(TRIM(s.analysis->>'material_id'), '')
               ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
             AND m.id = TRIM(s.analysis->>'material_id')::uuid
           )
           OR (
             COALESCE(TRIM(s.analysis->>'catalog_id'), '') <> ''
             AND m.catalog_id = TRIM(s.analysis->>'catalog_id')
           )
           ORDER BY CASE
             WHEN COALESCE(TRIM(s.analysis->>'material_id'), '')
               ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              AND m.id = TRIM(s.analysis->>'material_id')::uuid THEN 0
             ELSE 1
           END
           LIMIT 1
         ) m ON true
         WHERE v.verblijfsruimte_id = $1::uuid
         ORDER BY v.sort_order ASC, v.created_at ASC`,
        [r.verblijfsruimte_id],
      );
      vrs.push({ ...r, vg_omschrijving: g.omschrijving, vlakken: vlQ.rows });
    }
  }

  // Unique catalog materials applied on façade components in this variant.
  const materialsById = new Map();
  for (const r of vrs) {
    for (const v of r.vlakken || []) {
      if (!v.material_id || materialsById.has(v.material_id)) continue;
      materialsById.set(v.material_id, {
        material_id: v.material_id,
        catalog_id: v.catalog_id,
        name: v.material_name,
        master_category: v.master_category,
        source: v.material_source,
        ra_dba: v.ra_dba,
        rw_db: v.rw_db,
        c_db: v.c_db,
        ctr_db: v.ctr_db,
        r_63_hz: v.r_63_hz,
        r_125_hz: v.r_125_hz,
        r_250_hz: v.r_250_hz,
        r_500_hz: v.r_500_hz,
        r_1000_hz: v.r_1000_hz,
        r_2000_hz: v.r_2000_hz,
        r_4000_hz: v.r_4000_hz,
        spectrum_ok: v.spectrum_ok,
      });
    }
  }

  return {
    building,
    variant,
    verblijfsgebieden: vgQ.rows,
    verblijfsruimten: vrs,
    materials: [...materialsById.values()],
  };
}

function grensForFunctie(functie) {
  const f = String(functie || "");
  if (/onderwijs|kinderopvang/i.test(f)) return 28;
  return 33;
}

function voldoet(lb, gak, grens) {
  if (gak == null || !Number.isFinite(Number(gak)) || !Number.isFinite(Number(lb))) return null;
  const lbik = Number(lb) - Number(gak);
  return lbik <= grens;
}

function spectrumBandCells(m) {
  const bands = [
    m.r_63_hz,
    m.r_125_hz,
    m.r_250_hz,
    m.r_500_hz,
    m.r_1000_hz,
    m.r_2000_hz,
    m.r_4000_hz,
  ];
  return bands.map((b) => `<td class="num">${esc(fmtNum(b, 0))}</td>`).join("");
}

function renderReportHtml(model, opts) {
  const { building, variant, verblijfsruimten, materials = [] } = model;
  const status = opts.status || "concept";
  const generatedAt = opts.generatedAt || new Date().toISOString();
  const generatedLabel = new Date(generatedAt).toLocaleString("nl-NL");
  const lb = Number(variant.geluidsbelasting_dba);
  const grens = grensForFunctie(variant.gebruiksfunctie);
  const adres = [building.street_line, `${building.postal_code} ${building.city}`.trim()]
    .filter(Boolean)
    .join(", ");
  const title = building.label || "Gevelwering";

  const vrRows = verblijfsruimten
    .map((r) => {
      const ok = voldoet(lb, r.gak_dba, grens);
      const label = r.vr_nr ? `VR ${esc(r.vr_nr)} · ${esc(r.omschrijving)}` : esc(r.omschrijving);
      const toets =
        ok == null ? '<td class="center missing">—</td>' : ok ? '<td class="center ok">Ja</td>' : '<td class="center fail">Nee</td>';
      return `<tr>
        <td>${label}</td>
        <td class="num">${esc(fmtNum(r.vloer_m2, 2))}</td>
        <td class="num">${esc(fmtNum(r.ga_dba, 1))}</td>
        <td class="num">${esc(fmtNum(r.lbi_dba, 1))}</td>
        <td class="num">${esc(fmtNum(r.gak_dba, 1))}</td>
        ${toets}
      </tr>`;
    })
    .join("\n");

  const detailBlocks = verblijfsruimten
    .map((r) => {
      const ok = voldoet(lb, r.gak_dba, grens);
      const lbik =
        r.gak_dba != null && Number.isFinite(Number(r.gak_dba))
          ? fmtNum(lb - Number(r.gak_dba), 1)
          : "—";
      const label = r.vr_nr ? `VR ${esc(r.vr_nr)} · ${esc(r.omschrijving)}` : esc(r.omschrijving);
      const vlakRows = (r.vlakken || [])
        .map((v) => {
          const mat =
            v.material_name || v.catalog_id
              ? `${esc(v.material_name || "—")}${v.catalog_id ? ` <span class="muted">(${esc(v.catalog_id)})</span>` : ""}`
              : '<span class="missing">geen materiaal</span>';
          return `<tr>
          <td>${esc(v.omschrijving)}</td>
          <td class="center">${esc(v.orientatie || "—")}</td>
          <td>${mat}</td>
          <td class="num">${esc(fmtNum(v.area_m2, 2))}</td>
          <td class="num">${esc(fmtNum(v.ra_dba, 1))}</td>
          <td class="num">${esc(fmtNum(v.cl_db, 1))}</td>
          <td class="num">${esc(fmtNum(v.cg_db, 1))}</td>
          <td class="center">${v.meenemen_gak ? "ja" : "nee"}</td>
        </tr>`;
        })
        .join("\n");
      return `
      <h3>Verblijfsruimte: ${label}</h3>
      <div class="vr-grid">
        <div>
          <div class="row"><span class="lab">Vloeroppervlak</span><span class="val">${esc(fmtNum(r.vloer_m2, 2))}</span><span class="unit">m²</span></div>
          <div class="row"><span class="lab">Vertrekhoogte</span><span class="val">${esc(fmtNum(r.hoogte_m, 2))}</span><span class="unit">m</span></div>
          <div class="row"><span class="lab">Volume</span><span class="val">${esc(fmtNum(r.volume_m3, 2))}</span><span class="unit">m³</span></div>
          <div class="row"><span class="lab">Nagalmtijd T₀</span><span class="val">${esc(fmtNum(r.t0_s, 2))}</span><span class="unit">s</span></div>
        </div>
        <div>
          <div class="row"><span class="lab">Max. geluidsbelasting</span><span class="val">${esc(fmtNum(lb, 1))}</span><span class="unit">dB</span></div>
          <div class="row"><span class="lab">Geluidwering GA</span><span class="val">${esc(fmtNum(r.ga_dba, 1))}</span><span class="unit">dB</span></div>
          <div class="row"><span class="lab">Binnenniveau Lbi</span><span class="val">${esc(fmtNum(r.lbi_dba, 1))}</span><span class="unit">dB</span></div>
          <div class="row"><span class="lab">Karakteristieke GA;k</span><span class="val">${esc(fmtNum(r.gak_dba, 1))}</span><span class="unit">dB</span></div>
          <div class="row"><span class="lab">Lbi;k</span><span class="val">${esc(lbik)}</span><span class="unit">dB</span></div>
          <div class="row"><span class="lab">Voldoet</span><span class="val ${ok === true ? "ok" : ok === false ? "fail" : ""}">${ok == null ? "—" : ok ? "Ja" : "Nee"}</span><span class="unit"></span></div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Vlak</th><th class="center">Oriëntatie</th><th>Materiaal (catalogus)</th><th class="num">S [m²]</th><th class="num">RA [dB]</th>
          <th class="num">CL</th><th class="num">Cg</th><th class="center">In GA;k</th>
        </tr></thead>
        <tbody>${vlakRows || '<tr><td colspan="8" class="missing">Geen vlakken</td></tr>'}</tbody>
      </table>`;
    })
    .join("\n");

  const materialRows = materials
    .map((m) => {
      const src = m.source === "eigen" ? "eigen" : m.source || "catalogus";
      return `<tr>
        <td>${esc(m.catalog_id || "—")}</td>
        <td>${esc(m.name || "—")}<div class="muted">${esc(m.master_category || "")}${m.master_category ? " · " : ""}${esc(src)}</div></td>
        <td class="num">${esc(fmtNum(m.ra_dba, 1))}</td>
        <td class="num">${esc(fmtNum(m.rw_db, 0))}</td>
        ${spectrumBandCells(m)}
        <td class="num">${esc(fmtNum(m.c_db, 0))}</td>
        <td class="num">${esc(fmtNum(m.ctr_db, 0))}</td>
      </tr>`;
    })
    .join("\n");

  const materialsBlock = `
    <h2>Toegepaste materialen — catalogusspectra</h2>
    <p class="note">Octaafband-R [dB] uit <code>app_gevelwering.material</code> voor materialen gekoppeld aan gevelvlakken in deze variant. De A-gewogen rekenkern gebruikt RA; spectra zijn bijlage/documentatie.</p>
    <table class="spectrum">
      <thead>
        <tr>
          <th>Cat.id</th>
          <th>Materiaal</th>
          <th class="num">RA</th>
          <th class="num">Rw</th>
          <th class="num">63</th>
          <th class="num">125</th>
          <th class="num">250</th>
          <th class="num">500</th>
          <th class="num">1k</th>
          <th class="num">2k</th>
          <th class="num">4k</th>
          <th class="num">C</th>
          <th class="num">Ctr</th>
        </tr>
      </thead>
      <tbody>
        ${
          materialRows ||
          '<tr><td colspan="13" class="missing">Geen catalogusmaterialen gekoppeld aan vlakken</td></tr>'
        }
      </tbody>
    </table>`;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} — rapport</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { margin: 0; color: #111; font: 10.5pt/1.35 Helvetica, Arial, sans-serif; }
    .sheet { padding: 0; }
    .page-head { display: grid; grid-template-columns: 1fr auto; gap: 1rem; border-bottom: 1px solid #bbb; padding-bottom: .55rem; margin-bottom: .75rem; }
    h1 { margin: 0; font-size: 13pt; }
    .werknummer { margin: .25rem 0 0; color: #444; font-size: 9.5pt; }
    .logo { width: 72px; height: auto; }
    .meta { display: grid; grid-template-columns: 9.5rem 1fr; gap: .15rem .75rem; font-size: 9.5pt; margin: .5rem 0 .85rem; }
    .meta dt { color: #444; } .meta dd { margin: 0; font-weight: 600; }
    .badge { display: inline-block; padding: .1rem .45rem; background: #f3e5ab; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; }
    .variant-bar { background: #d8d8d8; font-weight: 700; padding: .35rem .5rem; margin: .85rem 0 .55rem; }
    h2 { margin: .85rem 0 .35rem; font-size: 10.5pt; border-bottom: 1px solid #bbb; }
    h3 { margin: .75rem 0 .3rem; font-size: 10pt; }
    table { width: 100%; border-collapse: collapse; font-size: 8.8pt; margin: .35rem 0 .65rem; }
    table.spectrum { font-size: 7.8pt; }
    th, td { border: 1px solid #bbb; padding: .22rem .35rem; }
    th { background: #f2f2f2; text-align: left; }
    .num { text-align: right; } .center { text-align: center; }
    .ok { color: #1b5e20; font-weight: 700; } .fail { color: #b71c1c; font-weight: 700; } .missing { color: #888; font-style: italic; }
    .muted { color: #666; font-size: 8pt; font-weight: 400; }
    .note { font-size: 8.5pt; color: #444; margin: .2rem 0 .45rem; }
    .vr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .25rem 1.25rem; font-size: 9.5pt; margin: .35rem 0 .55rem; }
    .vr-grid .row { display: grid; grid-template-columns: 1fr auto auto; gap: .35rem; }
    .lab { color: #444; } .val { font-weight: 650; text-align: right; } .unit { color: #444; min-width: 1.6rem; }
    .page-foot { display: flex; justify-content: space-between; margin-top: 1.25rem; padding-top: .4rem; border-top: 1px solid #bbb; font-size: 8.5pt; color: #444; }
  </style>
</head>
<body data-generated-at="${esc(generatedAt)}">
  <article class="sheet">
    <header class="page-head">
      <div>
        <h1>${esc(title)}</h1>
        <p class="werknummer">Werknummer: ${esc(building.external_ref || "—")} · <span class="badge">${esc(status)}</span></p>
      </div>
      <img class="logo" src="/assets/stilte-logo.jpg" alt="Stilte" />
    </header>
    <dl class="meta">
      <dt>Project / omschrijving</dt><dd>${esc(title)}${adres ? ` — ${esc(adres)}` : ""}</dd>
      <dt>Opdrachtgever</dt><dd>${esc(building.customer_name || "—")}</dd>
      <dt>Rekenmethode</dt><dd>NPR 5272 / NEN 5077</dd>
      <dt>Gebruiksfunctie</dt><dd>${esc(variant.gebruiksfunctie)} (grens Lbi;k ≤ ${grens} dB)</dd>
      <dt>Rapportstatus</dt><dd>${esc(status)}</dd>
      <dt>Projectstatus app</dt><dd>${esc(building.project_status)}</dd>
    </dl>
    <div class="variant-bar">VARIANT: ${esc(variant.omschrijving)} · Lb ${esc(fmtNum(lb, 1))} dB · ${esc(variant.spectrum_kind)}</div>
    <h2>Resultaten GA;k</h2>
    <table>
      <thead>
        <tr>
          <th>Verblijfsruimte</th>
          <th class="num">Vloer [m²]</th>
          <th class="num">GA [dB]</th>
          <th class="num">Lbi [dB]</th>
          <th class="num">GA;k [dB]</th>
          <th class="center">Voldoet</th>
        </tr>
      </thead>
      <tbody>
        ${vrRows || '<tr><td colspan="6" class="missing">Geen verblijfsruimten</td></tr>'}
      </tbody>
    </table>
    ${detailBlocks}
    ${materialsBlock}
    <footer class="page-foot">
      <span>Geluidwering gevels · Stilte</span>
      <span>Gegenereerd: ${esc(generatedLabel)}</span>
    </footer>
  </article>
</body>
</html>`;
}

export function handleReportApiOptions(req, res) {
  res.writeHead(204, { ...securityHeaders(req), ...corsHeaders(req) });
  res.end();
}

export async function handleReportGenerate(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "login required" });
    return;
  }

  let body;
  try {
    const raw = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });
    body = raw ? JSON.parse(raw) : {};
  } catch {
    json(req, res, 400, { ok: false, error: "invalid JSON body" });
    return;
  }

  const buildingId = String(body.building_id || "").trim();
  const variantId = String(body.variant_id || "").trim();
  const status = String(body.status || "concept").trim().toLowerCase() || "concept";
  const force = Boolean(body.force);
  if (!UUID_RE.test(buildingId)) {
    json(req, res, 400, { ok: false, error: "building_id required" });
    return;
  }
  if (variantId && !UUID_RE.test(variantId)) {
    json(req, res, 400, { ok: false, error: "invalid variant_id" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired" });
      return;
    }
    const access = await assertCanAccessBuilding(client, buildingId, session);
    if (!access) {
      json(req, res, 403, { ok: false, error: "geen toegang tot dit project" });
      return;
    }

    const model = await loadReportModel(client, buildingId, variantId || null);
    const generatedAt = new Date().toISOString();
    const html = renderReportHtml(model, { status, generatedAt });
    const contentHash = sha256(canonicalContent(html));

    const dir = await ensureReportsDir(model.building);
    const identical = await findIdenticalReport(dir, contentHash);
    if (identical && !force) {
      const pdfFilename = pdfNameFromHtml(identical.filename);
      const pdfPath = path.join(dir, pdfFilename);
      if (!fs.existsSync(pdfPath)) {
        try {
          await htmlFileToPdf(identical.path, pdfPath);
        } catch (pdfErr) {
          console.error("PDF backfill for identical report failed:", pdfErr);
        }
      }
      json(req, res, 200, {
        ok: true,
        identical: true,
        skipped: true,
        warning:
          "Identiek rapport bestaat al — er is niets weggeschreven. Gebruik force=true om toch een nieuw bestand te maken.",
        existing_filename: identical.filename,
        pdf_filename: fs.existsSync(pdfPath) ? pdfFilename : null,
        filename_pdf: fs.existsSync(pdfPath) ? pdfFilename : null,
        relative_path: path.relative(projectsRoot(), identical.path),
        project_folder: path.relative(projectsRoot(), projectDir(model.building)),
        content_hash: contentHash,
      });
      return;
    }

    const filename =
      `${stampNow()}_gevelwering_${slugify(model.variant.omschrijving, "variant")}_${slugify(status, "concept")}.html`;
    const filePath = path.join(dir, filename);
    await fsp.writeFile(filePath, html, "utf8");
    await fsp.writeFile(`${filePath}.sha256`, `${contentHash}\n`, "utf8");

    const pdfFilename = pdfNameFromHtml(filename);
    const pdfPath = path.join(dir, pdfFilename);
    try {
      await htmlFileToPdf(filePath, pdfPath);
    } catch (pdfErr) {
      console.error("PDF generate error:", pdfErr);
      const msg =
        pdfErr?.code === "NO_CHROME"
          ? pdfErr.message
          : `PDF genereren mislukt: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`;
      json(req, res, 500, { ok: false, error: msg, html_filename: filename });
      return;
    }

    json(req, res, 201, {
      ok: true,
      identical: false,
      skipped: false,
      filename,
      pdf_filename: pdfFilename,
      filename_pdf: pdfFilename,
      relative_path: path.relative(projectsRoot(), pdfPath),
      html_relative_path: path.relative(projectsRoot(), filePath),
      project_folder: path.relative(projectsRoot(), projectDir(model.building)),
      content_hash: contentHash,
      byte_size: Buffer.byteLength(html, "utf8"),
      pdf_byte_size: (await fsp.stat(pdfPath)).size,
      status,
      variant_id: model.variant.variant_id,
    });
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      json(req, res, 404, { ok: false, error: err.message });
      return;
    }
    if (err?.code === "NO_VARIANT") {
      json(req, res, 400, { ok: false, error: err.message });
      return;
    }
    console.error("report generate error:", err);
    json(req, res, 500, { ok: false, error: "rapport genereren mislukt" });
  } finally {
    client.release();
  }
}

export async function handleReportList(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "login required" });
    return;
  }
  const buildingId = String(url.searchParams.get("building_id") || "").trim();
  if (!UUID_RE.test(buildingId)) {
    json(req, res, 400, { ok: false, error: "building_id required" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired" });
      return;
    }
    const access = await assertCanAccessBuilding(client, buildingId, session);
    if (!access) {
      json(req, res, 403, { ok: false, error: "geen toegang tot dit project" });
      return;
    }
    const dir = reportsDir(access);
    let reports = [];
    if (fs.existsSync(dir)) {
      const files = await fsp.readdir(dir);
      for (const f of files) {
        if (!f.endsWith(".html") && !f.endsWith(".pdf")) continue;
        const st = await fsp.stat(path.join(dir, f));
        let content_hash = "";
        if (f.endsWith(".html")) {
          try {
            content_hash = (await fsp.readFile(path.join(dir, `${f}.sha256`), "utf8")).trim();
          } catch {
            /* optional */
          }
        }
        reports.push({
          filename: f,
          byte_size: st.size,
          modified_at: st.mtime.toISOString(),
          content_hash,
          kind: f.endsWith(".pdf") ? "pdf" : "html",
        });
      }
      reports.sort((a, b) => String(b.modified_at).localeCompare(String(a.modified_at)));
    }
    json(req, res, 200, {
      ok: true,
      building_id: buildingId,
      project_folder: path.relative(projectsRoot(), projectDir(access)),
      reports_root: projectsRoot(),
      reports,
    });
  } finally {
    client.release();
  }
}

export async function handleReportDownload(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "login required" });
    return;
  }
  const buildingId = String(url.searchParams.get("building_id") || "").trim();
  const file = String(url.searchParams.get("file") || "").trim();
  const inboxId = String(url.searchParams.get("inbox_id") || "").trim();
  if (!UUID_RE.test(buildingId) || !file || file.includes("..") || file.includes("/") || file.includes("\\")) {
    json(req, res, 400, { ok: false, error: "building_id and safe file required" });
    return;
  }
  const isHtml = file.endsWith(".html");
  const isPdf = file.endsWith(".pdf");
  if (!isHtml && !isPdf) {
    json(req, res, 400, { ok: false, error: "alleen .pdf of .html rapporten" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired" });
      return;
    }
    const access = await assertCanAccessBuilding(client, buildingId, session);
    if (!access) {
      json(req, res, 403, { ok: false, error: "geen toegang tot dit project" });
      return;
    }
    const dir = reportsDir(access);
    let serveName = file;
    let filePath = path.join(dir, serveName);

    // Opdrachtgever / inbox: prefer PDF. If .html was requested or only HTML exists, render PDF.
    if (isHtml) {
      const pdfName = pdfNameFromHtml(file);
      const pdfPath = path.join(dir, pdfName);
      if (!fs.existsSync(pdfPath) && fs.existsSync(filePath)) {
        try {
          await htmlFileToPdf(filePath, pdfPath);
        } catch (pdfErr) {
          console.error("on-demand PDF failed:", pdfErr);
        }
      }
      if (fs.existsSync(pdfPath)) {
        serveName = pdfName;
        filePath = pdfPath;
      }
    } else if (isPdf && !fs.existsSync(filePath)) {
      const htmlName = `${file.slice(0, -4)}.html`;
      const htmlPath = path.join(dir, htmlName);
      if (fs.existsSync(htmlPath)) {
        try {
          await htmlFileToPdf(htmlPath, filePath);
        } catch (pdfErr) {
          console.error("on-demand PDF failed:", pdfErr);
          json(req, res, 500, {
            ok: false,
            error:
              pdfErr?.code === "NO_CHROME"
                ? pdfErr.message
                : `PDF niet beschikbaar: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`,
          });
          return;
        }
      }
    }

    if (!fs.existsSync(filePath)) {
      json(req, res, 404, { ok: false, error: "rapport niet gevonden" });
      return;
    }
    if (inboxId && UUID_RE.test(inboxId)) {
      await client.query(
        `UPDATE app_gevelwering.customer_report_inbox
         SET downloaded_at = COALESCE(downloaded_at, now()),
             read_at = COALESCE(read_at, now())
         WHERE id = $1::uuid AND building_id = $2::uuid`,
        [inboxId, buildingId],
      );
    }
    const buf = await fsp.readFile(filePath);
    const asPdf = serveName.endsWith(".pdf");
    res.writeHead(200, {
      ...securityHeaders(req),
      ...corsHeaders(req),
      "Content-Type": asPdf ? "application/pdf" : "text/html; charset=utf-8",
      "Content-Length": buf.length,
      "Content-Disposition": `${asPdf ? "attachment" : "inline"}; filename="${serveName.replace(/"/g, "")}"`,
    });
    res.end(buf);
  } finally {
    client.release();
  }
}

async function readJsonBody(req) {
  const raw = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
  return raw ? JSON.parse(raw) : {};
}

/** Engineer publishes an existing report file into the opdrachtgever inbox. */
export async function handleReportPublish(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "login required" });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    json(req, res, 400, { ok: false, error: "invalid JSON body" });
    return;
  }

  const buildingId = String(body.building_id || "").trim();
  const filename = String(body.filename || "").trim();
  const reportKind = normalizeReportKind(body.report_kind || body.status);
  const versionLabel = String(body.version_label || "1.0").trim().slice(0, 32) || "1.0";
  const customMessage = String(body.message || "").trim();
  if (!UUID_RE.test(buildingId)) {
    json(req, res, 400, { ok: false, error: "building_id required" });
    return;
  }
  if (
    !filename ||
    (!filename.endsWith(".html") && !filename.endsWith(".pdf")) ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    json(req, res, 400, { ok: false, error: "safe .pdf of .html filename required" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired" });
      return;
    }
    if (!isStaffSession(session)) {
      json(req, res, 403, { ok: false, error: "alleen engineer/admin mag publiceren naar inbox" });
      return;
    }
    const access = await assertCanAccessBuilding(client, buildingId, session);
    if (!access) {
      json(req, res, 403, { ok: false, error: "geen toegang tot dit project" });
      return;
    }
    const dir = reportsDir(access);
    const htmlName = filename.endsWith(".pdf") ? `${filename.slice(0, -4)}.html` : filename;
    const pdfName = filename.endsWith(".pdf") ? filename : pdfNameFromHtml(filename);
    const htmlPath = path.join(dir, htmlName);
    const pdfPath = path.join(dir, pdfName);

    if (!fs.existsSync(htmlPath) && !fs.existsSync(pdfPath)) {
      json(req, res, 404, { ok: false, error: "rapportbestand niet gevonden — sla eerst op" });
      return;
    }
    if (!fs.existsSync(pdfPath)) {
      if (!fs.existsSync(htmlPath)) {
        json(req, res, 404, { ok: false, error: "PDF ontbreekt en HTML-bron niet gevonden" });
        return;
      }
      try {
        await htmlFileToPdf(htmlPath, pdfPath);
      } catch (pdfErr) {
        console.error("publish PDF generate error:", pdfErr);
        json(req, res, 500, {
          ok: false,
          error:
            pdfErr?.code === "NO_CHROME"
              ? pdfErr.message
              : `PDF genereren mislukt: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`,
        });
        return;
      }
    }

    let contentHash = "";
    try {
      contentHash = (await fsp.readFile(`${htmlPath}.sha256`, "utf8")).trim();
    } catch {
      if (fs.existsSync(htmlPath)) {
        contentHash = sha256(canonicalContent(await fsp.readFile(htmlPath, "utf8")));
      } else {
        contentHash = sha256(await fsp.readFile(pdfPath));
      }
    }

    // Inbox always points at the PDF the opdrachtgever downloads.
    const inboxFilename = pdfName;
    const message = customMessage || defaultInboxMessage(reportKind);
    const { rows } = await client.query(
      `INSERT INTO app_gevelwering.customer_report_inbox
         (building_id, filename, report_kind, version_label, content_hash, message, published_by)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid)
       ON CONFLICT (building_id, filename) DO UPDATE SET
         report_kind = EXCLUDED.report_kind,
         version_label = EXCLUDED.version_label,
         content_hash = EXCLUDED.content_hash,
         message = EXCLUDED.message,
         published_by = EXCLUDED.published_by,
         published_at = now(),
         read_at = NULL,
         downloaded_at = NULL,
         email_requested_at = NULL
       RETURNING id::text AS inbox_id,
                 building_id::text AS building_id,
                 filename,
                 report_kind,
                 version_label,
                 content_hash,
                 message,
                 published_at,
                 read_at,
                 downloaded_at,
                 email_requested_at`,
      [buildingId, inboxFilename, reportKind, versionLabel, contentHash, message, session.user_id],
    );

    // Progress: concept → near final; definitief → finished
    const nextStatus = reportKind === "definitief" ? "PROJECT_FINISHED" : "PROJECT_NEAR_FINAL";
    await client.query(
      `UPDATE app_gevelwering.building
       SET project_status = $2::app_gevelwering.project_status,
           updated_at = now()
       WHERE id = $1::uuid
         AND (
           CASE project_status
             WHEN 'PROJECT_FINISHED'::app_gevelwering.project_status THEN 5
             WHEN 'PROJECT_NEAR_FINAL'::app_gevelwering.project_status THEN 4
             WHEN 'PROJECT_UNDERWAY'::app_gevelwering.project_status THEN 3
             WHEN 'PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED'::app_gevelwering.project_status THEN 2
             ELSE 1
           END
         ) < (
           CASE $2::text
             WHEN 'PROJECT_FINISHED' THEN 5
             WHEN 'PROJECT_NEAR_FINAL' THEN 4
             ELSE 0
           END
         )`,
      [buildingId, nextStatus],
    );
    const statusQ = await client.query(
      `SELECT project_status::text AS project_status FROM app_gevelwering.building WHERE id = $1::uuid`,
      [buildingId],
    );

    const item = mapInboxRow({
      ...rows[0],
      building_label: access.label || "",
    });
    json(req, res, 201, {
      ok: true,
      inbox: item,
      project_status: statusQ.rows[0]?.project_status || nextStatus,
      warning: null,
    });
  } catch (err) {
    console.error("report publish error:", err);
    json(req, res, 500, { ok: false, error: "publiceren naar inbox mislukt" });
  } finally {
    client.release();
  }
}

/** List inbox items for one building or all buildings owned by the session user. */
export async function handleReportInboxList(req, res, url) {
  if (requireHttpsOrReject(req, res)) return;
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "login required" });
    return;
  }
  const buildingId = String(url.searchParams.get("building_id") || "").trim();
  if (buildingId && !UUID_RE.test(buildingId)) {
    json(req, res, 400, { ok: false, error: "invalid building_id" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired" });
      return;
    }

    let rows;
    if (buildingId) {
      const access = await assertCanAccessBuilding(client, buildingId, session);
      if (!access) {
        json(req, res, 403, { ok: false, error: "geen toegang tot dit project" });
        return;
      }
      const q = await client.query(
        `SELECT i.id::text AS inbox_id,
                i.building_id::text AS building_id,
                COALESCE(b.label, '') AS building_label,
                i.filename,
                i.report_kind,
                i.version_label,
                i.content_hash,
                i.message,
                i.published_at,
                i.read_at,
                i.downloaded_at,
                i.email_requested_at
         FROM app_gevelwering.customer_report_inbox i
         JOIN app_gevelwering.building b ON b.id = i.building_id
         WHERE i.building_id = $1::uuid
         ORDER BY i.published_at DESC`,
        [buildingId],
      );
      rows = q.rows;
    } else {
      const staff = isStaffSession(session);
      const q = await client.query(
        `SELECT i.id::text AS inbox_id,
                i.building_id::text AS building_id,
                COALESCE(b.label, '') AS building_label,
                i.filename,
                i.report_kind,
                i.version_label,
                i.content_hash,
                i.message,
                i.published_at,
                i.read_at,
                i.downloaded_at,
                i.email_requested_at
         FROM app_gevelwering.customer_report_inbox i
         JOIN app_gevelwering.building b ON b.id = i.building_id
         WHERE ($1::boolean = true)
            OR b.owner_user_id = $2::uuid
            OR b.owner_user_id IS NULL
         ORDER BY i.published_at DESC
         LIMIT 100`,
        [staff, session.user_id],
      );
      rows = q.rows;
    }

    const items = rows.map(mapInboxRow);
    json(req, res, 200, {
      ok: true,
      building_id: buildingId || null,
      unread_count: items.filter((i) => i.unread).length,
      items,
    });
  } finally {
    client.release();
  }
}

export async function handleReportInboxRead(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "login required" });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    json(req, res, 400, { ok: false, error: "invalid JSON body" });
    return;
  }
  const inboxId = String(body.inbox_id || "").trim();
  if (!UUID_RE.test(inboxId)) {
    json(req, res, 400, { ok: false, error: "inbox_id required" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired" });
      return;
    }
    const found = await client.query(
      `SELECT building_id::text AS building_id FROM app_gevelwering.customer_report_inbox WHERE id = $1::uuid`,
      [inboxId],
    );
    if (!found.rows[0]) {
      json(req, res, 404, { ok: false, error: "inbox-item niet gevonden" });
      return;
    }
    const access = await assertCanAccessBuilding(client, found.rows[0].building_id, session);
    if (!access) {
      json(req, res, 403, { ok: false, error: "geen toegang" });
      return;
    }
    await client.query(
      `UPDATE app_gevelwering.customer_report_inbox
       SET read_at = COALESCE(read_at, now())
       WHERE id = $1::uuid`,
      [inboxId],
    );
    json(req, res, 200, { ok: true, inbox_id: inboxId });
  } finally {
    client.release();
  }
}

/**
 * Remove on-disk project folder(s) under data/projecten after DB delete.
 * Matches `{slug}_{first8}` and any leftover dir ending with `_{first8}`.
 * POST JSON: { building_id }
 */
export async function handleProjectFolderCleanup(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "login required" });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    json(req, res, 400, { ok: false, error: "invalid JSON body" });
    return;
  }
  const buildingId = String(body.building_id || "").trim();
  if (!UUID_RE.test(buildingId)) {
    json(req, res, 400, { ok: false, error: "building_id required" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveSession(client, token);
    if (!session || !isStaffSession(session)) {
      json(req, res, 403, { ok: false, error: "engineer access required" });
      return;
    }
  } finally {
    client.release();
  }

  const id8 = buildingId.slice(0, 8).toLowerCase();
  const root = projectsRoot();
  const removed = [];
  if (fs.existsSync(root)) {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const name = ent.name;
      if (!name.toLowerCase().endsWith(`_${id8}`)) continue;
      const full = path.join(root, name);
      await fsp.rm(full, { recursive: true, force: true });
      removed.push(name);
    }
  }
  json(req, res, 200, { ok: true, building_id: buildingId, removed });
}

/** Record an e-mail delivery request (mail send is stubbed for now). */
export async function handleReportInboxEmailRequest(req, res) {
  if (requireHttpsOrReject(req, res)) return;
  const token = parseSessionToken(req);
  if (!token) {
    json(req, res, 401, { ok: false, error: "login required" });
    return;
  }
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    json(req, res, 400, { ok: false, error: "invalid JSON body" });
    return;
  }
  const inboxId = String(body.inbox_id || "").trim();
  if (!UUID_RE.test(inboxId)) {
    json(req, res, 400, { ok: false, error: "inbox_id required" });
    return;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired" });
      return;
    }
    const found = await client.query(
      `SELECT i.building_id::text AS building_id,
              i.filename,
              i.report_kind,
              COALESCE(u.email, '') AS owner_email,
              COALESCE(c.email, '') AS customer_email
       FROM app_gevelwering.customer_report_inbox i
       JOIN app_gevelwering.building b ON b.id = i.building_id
       LEFT JOIN app_gevelwering.service_user u ON u.id = b.owner_user_id
       LEFT JOIN app_gevelwering.customer c ON c.id = b.customer_id
       WHERE i.id = $1::uuid`,
      [inboxId],
    );
    if (!found.rows[0]) {
      json(req, res, 404, { ok: false, error: "inbox-item niet gevonden" });
      return;
    }
    const row = found.rows[0];
    const access = await assertCanAccessBuilding(client, row.building_id, session);
    if (!access) {
      json(req, res, 403, { ok: false, error: "geen toegang" });
      return;
    }
    await client.query(
      `UPDATE app_gevelwering.customer_report_inbox
       SET email_requested_at = now(),
           read_at = COALESCE(read_at, now())
       WHERE id = $1::uuid`,
      [inboxId],
    );
    const dest = row.owner_email || row.customer_email || "";
    json(req, res, 200, {
      ok: true,
      inbox_id: inboxId,
      email_requested: true,
      email_to: dest || null,
      note: dest
        ? `Aanvraag geregistreerd — rapport wordt (in productie) gemaild naar ${dest}.`
        : "Aanvraag geregistreerd — er is nog geen e-mailadres gekoppeld; de engineer kan het handmatig versturen.",
    });
  } finally {
    client.release();
  }
}
