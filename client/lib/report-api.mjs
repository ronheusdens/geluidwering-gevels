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
 * POST /api/reports/inbox/delete         JSON: { inbox_id }
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
import {
  resolveGeluidbelastingSpectrum,
  resolveSpectrumForReport,
  spectrumDisplayLabel,
} from "./geluidbelasting-spectra.mjs";
import {
  CR_DB,
  combineRprime,
  computeVrGa,
  partialRas,
  roomCorrectionDb,
  round1,
} from "./ga-calc.mjs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Compass order for gevelvlakken in the rapport (DGMR-stijl). */
const ORI_REPORT_ORDER = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"];
const ORI_GEVEL_LABEL = {
  N: "noordgevel",
  NO: "noordoostgevel",
  O: "oostgevel",
  ZO: "zuidoostgevel",
  Z: "zuidgevel",
  ZW: "zuidwestgevel",
  W: "westgevel",
  NW: "noordwestgevel",
};
const REPORT_BANDS_HZ = [63, 125, 250, 500, 1000, 2000];
const REPORT_BAND_KEYS = [
  "r_63_hz",
  "r_125_hz",
  "r_250_hz",
  "r_500_hz",
  "r_1000_hz",
  "r_2000_hz",
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_PROJECTS_ROOT = path.join(APP_ROOT, "data", "projecten");
const LOGO_PATH = path.join(__dirname, "..", "public", "assets", "stilte-logo.jpg");
const FIRM_NAME = "Stilte advies en meten";
/** Bump when report HTML template changes — forces a new content hash vs old files. */
const REPORT_TEMPLATE_VERSION = "2026-10-10-formules-og";

let cachedLogoDataUri = null;

/** Embed logo so PDF/file:// reports do not depend on the UI server. */
function stilteLogoDataUri() {
  if (cachedLogoDataUri != null) return cachedLogoDataUri;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      const buf = fs.readFileSync(LOGO_PATH);
      cachedLogoDataUri = `data:image/jpeg;base64,${buf.toString("base64")}`;
      return cachedLogoDataUri;
    }
  } catch (err) {
    console.warn("stilte logo load failed:", err);
  }
  cachedLogoDataUri = "";
  return cachedLogoDataUri;
}

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

/** Leading integer from VG/VR labels («3», «3A», «VG 2»). */
function leadingNr(raw) {
  const s = String(raw ?? "").trim();
  const m = s.match(/(\d+)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

/** VG then VR (numeric), for report tables and detail blocks. */
function compareVgThenVr(a, b) {
  const vgA = leadingNr(a?.vg_nr);
  const vgB = leadingNr(b?.vg_nr);
  if (vgA !== vgB) return vgA - vgB;
  const sa = String(a?.vr_nr || "").trim();
  const sb = String(b?.vr_nr || "").trim();
  const ia = leadingNr(sa);
  const ib = leadingNr(sb);
  if (ia !== ib) return ia - ib;
  return sa.localeCompare(sb, "nl", { numeric: true, sensitivity: "base" });
}

/** @deprecated use compareVgThenVr — kept for call sites that only have vr_nr. */
function compareVrNr(a, b) {
  return compareVgThenVr(a, b);
}

function isLengthVlak(v) {
  return String(v?.quantity_kind || "") === "length";
}

function vlakOmschrijving(v) {
  let name = String(v?.omschrijving || "").trim() || "Vlak";
  if (isLengthVlak(v) && !/kier/i.test(name)) name += " · kierdichting";
  return name;
}

function vlakQtyCell(v) {
  if (isLengthVlak(v)) {
    return `<td class="num">${esc(fmtNum(v.length_m, 2))} m</td>`;
  }
  return `<td class="num">${esc(fmtNum(v.area_m2, 2))}</td>`;
}

/** Strip volatile timestamp line so identical report data yields the same hash. */
function canonicalContent(html) {
  // Strip volatile timestamp in footer (last span in .page-foot) for identical-hash compare.
  return html
    .replace(/data-generated-at="[^"]*"/g, 'data-generated-at=""')
    .replace(
      /(<footer class="page-foot">[\s\S]*?<span>[^<]*<\/span>\s*<span>)[^<]*(<\/span>)/,
      "$1$2",
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
            COALESCE(b.client_ref, '') AS client_ref,
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
            COALESCE(b.client_ref, '') AS client_ref,
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
              COALESCE(s.vr_nr, '') AS vr_nr, COALESCE(s.vg_nr::text, '') AS vg_nr,
              COALESCE(s.analysis, '{}'::jsonb) AS room_analysis
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
                COALESCE(v.analysis->>'quantity_kind', 'area') AS quantity_kind,
                CASE
                  WHEN COALESCE(v.analysis->>'length_m', '') ~ '^-?\\d'
                  THEN (v.analysis->>'length_m')::double precision
                  WHEN COALESCE(v.analysis->>'quantity_kind', 'area') = 'length'
                       AND (s.analysis->'seal'->>'length_m') ~ '^-?\\d'
                  THEN ROUND(
                    (s.analysis->'seal'->>'length_m')::numeric
                    * GREATEST(
                        1,
                        CASE
                          WHEN (s.analysis->>'repeat_count') ~ '^[0-9]+$'
                          THEN (s.analysis->>'repeat_count')::int
                          ELSE 1
                        END
                      ),
                    2
                  )::double precision
                  ELSE NULL
                END AS length_m,
                COALESCE(v.orientatie, '') AS orientatie,
                COALESCE(gg.cl_db, v.cl_db) AS cl_db,
                COALESCE(gg.cg_db, v.cg_db) AS cg_db,
                v.meenemen_gak,
                v.gevelgroep_id::text AS gevelgroep_id,
                COALESCE(gg.groep_nr::text, '') AS gevelgroep_nr,
                COALESCE(gg.label, '') AS gevelgroep_label,
                v.facade_subsection_id::text AS facade_subsection_id,
                COALESCE(m.id::text, '') AS material_id,
                COALESCE(m.catalog_id, '') AS catalog_id,
                COALESCE(m.name, '') AS material_name,
                COALESCE(m.master_category, '') AS master_category,
                COALESCE(m.source, '') AS material_source,
                COALESCE(
                  m.ra_dba,
                  CASE
                    WHEN COALESCE(matsrc.src->>'ra_dba', '') ~ '^-?\\d'
                    THEN (matsrc.src->>'ra_dba')::double precision
                    ELSE NULL
                  END
                ) AS ra_dba,
                m.rw_db,
                m.c_db,
                m.ctr_db,
                m.r_63_hz,
                m.r_125_hz,
                m.r_250_hz,
                m.r_500_hz,
                m.r_1000_hz,
                m.r_2000_hz,
                m.r_4000_hz
         FROM app_gevelwering.vlak v
         LEFT JOIN app_gevelwering.drawing_subsection s
           ON s.id = v.facade_subsection_id
         LEFT JOIN app_gevelwering.gevelgroep gg
           ON gg.id = v.gevelgroep_id
         LEFT JOIN LATERAL (
           SELECT CASE
             WHEN COALESCE(v.analysis->>'quantity_kind', 'area') = 'length'
                  AND COALESCE(s.analysis->>'quantity_kind', '') IS DISTINCT FROM 'length'
                  AND jsonb_typeof(s.analysis->'seal') = 'object'
                  AND COALESCE(s.analysis->'seal'->>'enabled', '') IN ('true', 't', '1')
             THEN s.analysis->'seal'
             ELSE COALESCE(s.analysis, '{}'::jsonb)
           END AS src
         ) matsrc ON true
         LEFT JOIN LATERAL (
           SELECT m.*
           FROM app_gevelwering.material m
           WHERE (
             COALESCE(TRIM(matsrc.src->>'material_id'), '')
               ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
             AND m.id = TRIM(matsrc.src->>'material_id')::uuid
           )
           OR (
             COALESCE(TRIM(matsrc.src->>'catalog_id'), '') <> ''
             AND m.catalog_id = TRIM(matsrc.src->>'catalog_id')
           )
           ORDER BY CASE
             WHEN COALESCE(TRIM(matsrc.src->>'material_id'), '')
               ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              AND m.id = TRIM(matsrc.src->>'material_id')::uuid THEN 0
             ELSE 1
           END
           LIMIT 1
         ) m ON true
         WHERE v.verblijfsruimte_id = $1::uuid
         ORDER BY v.sort_order ASC, v.created_at ASC`,
        [r.verblijfsruimte_id],
      );
      const roomAnalysis =
        r.room_analysis && typeof r.room_analysis === "object" && !Array.isArray(r.room_analysis)
          ? r.room_analysis
          : {};
      const expectedRaw = Array.isArray(roomAnalysis.expected_orientaties)
        ? roomAnalysis.expected_orientaties
        : [];
      const ORI = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"];
      const expectedOrientaties = [
        ...new Set(
          expectedRaw
            .map((c) => String(c || "").trim().toUpperCase())
            .filter((c) => ORI.includes(c)),
        ),
      ];
      const fromVlakken = [
        ...new Set(
          (vlQ.rows || [])
            .map((v) => String(v.orientatie || "").trim().toUpperCase())
            .filter((c) => ORI.includes(c)),
        ),
      ];
      const { room_analysis: _ra, ...roomRest } = r;
      vrs.push({
        ...roomRest,
        verblijfsgebied_id: g.verblijfsgebied_id,
        vg_omschrijving: g.omschrijving,
        vlakken: vlQ.rows,
        expected_orientaties: expectedOrientaties.length ? expectedOrientaties : fromVlakken,
      });
    }
  }

  vrs.sort(compareVgThenVr);

  return {
    building,
    variant,
    verblijfsgebieden: vgQ.rows,
    verblijfsruimten: vrs,
  };
}

/** Parse numeric DB/JSON fields; null/"" must not become 0 via Number(null). */
function parseReportNum(v) {
  if (v == null || v === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * VG-samenvatting à la DGMR: Stot/Vtot over VR’s, GA;k oppervlaktegewogen
 * (NEN 5077 transmissiegemiddelde van GA;k,i met Si = vloeroppervlak).
 * VR’s zonder opgeslagen GA;k worden niet in het gewogen gemiddelde meegenomen
 * (Number(null)===0 zou anders ~0 dB injecteren en de VG-toetsing vernietigen).
 */
function aggregateVerblijfsgebieden(verblijfsgebieden, verblijfsruimten, lb, grens) {
  const byVg = new Map();
  for (const r of verblijfsruimten || []) {
    const id = r.verblijfsgebied_id;
    if (!id) continue;
    if (!byVg.has(id)) byVg.set(id, []);
    byVg.get(id).push(r);
  }
  return (verblijfsgebieden || []).map((g) => {
    const rooms = byVg.get(g.verblijfsgebied_id) || [];
    let stot = 0;
    let vtot = 0;
    let sumTau = 0;
    let sumSGak = 0;
    let roomsWithGak = 0;
    for (const r of rooms) {
      const s = parseReportNum(r.vloer_m2);
      const v = parseReportNum(r.volume_m3);
      if (Number.isFinite(s) && s > 0) stot += s;
      if (Number.isFinite(v) && v > 0) vtot += v;
      const gak = parseReportNum(r.gak_dba);
      if (Number.isFinite(s) && s > 0 && Number.isFinite(gak)) {
        roomsWithGak += 1;
        sumSGak += s;
        sumTau += s * 10 ** (-gak / 10);
      }
    }
    const gak =
      roomsWithGak > 0 && sumSGak > 0 && sumTau > 0
        ? -10 * Math.log10(sumTau / sumSGak)
        : null;
    const ok = voldoet(lb, gak, grens);
    const nr =
      rooms.map((r) => String(r.vg_nr || "").trim()).find(Boolean) ||
      String(g.omschrijving || "").match(/\bVG\s*(\d+)/i)?.[1] ||
      "";
    const oms = String(g.omschrijving || "").trim();
    let label = oms || "Verblijfsgebied";
    if (nr && oms && !new RegExp(`\\bVG\\s*${nr}\\b`, "i").test(oms)) {
      label = `VG ${nr} · ${oms}`;
    } else if (nr && !oms) {
      label = `VG ${nr}`;
    }
    return {
      verblijfsgebied_id: g.verblijfsgebied_id,
      vg_nr: nr,
      sort_order: g.sort_order,
      label,
      stot_m2: stot > 0 ? stot : null,
      vtot_m3: vtot > 0 ? vtot : null,
      gak_dba: gak,
      voldoet: ok,
      vr_count: rooms.length,
      vr_with_gak: roomsWithGak,
    };
  }).sort((a, b) => {
    const ia = leadingNr(a.vg_nr);
    const ib = leadingNr(b.vg_nr);
    if (ia !== ib) return ia - ib;
    const soA = Number(a.sort_order);
    const soB = Number(b.sort_order);
    if (Number.isFinite(soA) && Number.isFinite(soB) && soA !== soB) return soA - soB;
    return String(a.label).localeCompare(String(b.label), "nl", { numeric: true });
  });
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

function oriGevelLabel(code) {
  const c = String(code || "").trim().toUpperCase();
  return ORI_GEVEL_LABEL[c] || (c && c !== "_" ? `${c.toLowerCase()}gevel` : "gevel");
}

function compareOriReport(a, b) {
  const ia = ORI_REPORT_ORDER.indexOf(String(a || "").toUpperCase());
  const ib = ORI_REPORT_ORDER.indexOf(String(b || "").toUpperCase());
  const aa = ia < 0 ? 99 : ia;
  const bb = ib < 0 ? 99 : ib;
  if (aa !== bb) return aa - bb;
  return String(a || "").localeCompare(String(b || ""), "nl");
}

function truthyMeenemen(v) {
  return !(v === false || v === "f" || v === "false" || v === 0 || v === "0");
}

/** Group vlakken like ga-calc: gevelgroep, else ori+CL+Cg. */
function groupVlakkenByFacade(vlakken) {
  const map = new Map();
  for (const v of vlakken || []) {
    const ori = String(v.orientatie || "").trim().toUpperCase() || "_";
    const cl = Number(v.cl_db) || 0;
    const cg = Number(v.cg_db) || 0;
    const gg = String(v.gevelgroep_id || "").trim();
    const key = gg ? `g:${gg}` : `${ori}\0${cl}\0${cg}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        orientatie: ori,
        cl_db: cl,
        cg_db: cg,
        gevelgroep_id: gg || null,
        gevelgroep_nr: String(v.gevelgroep_nr || "").trim(),
        gevelgroep_label: String(v.gevelgroep_label || "").trim(),
        members: [],
      });
    }
    map.get(key).members.push(v);
  }
  return [...map.values()].sort((a, b) => {
    const o = compareOriReport(a.orientatie, b.orientatie);
    if (o !== 0) return o;
    const na = Number(a.gevelgroep_nr) || 0;
    const nb = Number(b.gevelgroep_nr) || 0;
    if (na !== nb) return na - nb;
    return a.cl_db - b.cl_db || a.cg_db - b.cg_db;
  });
}

function bandPartial(R, sRef, q) {
  const r = Number(R);
  if (!Number.isFinite(r) || !(sRef > 0) || !(q > 0)) return null;
  return r + 10 * Math.log10(sRef / q);
}

/**
 * DGMR-stijl «Vlak N: …gevel» met CL/Cg, elementtabel (S/lengte/RA/partiële banden),
 * Totaal S + R′ + GA per oriëntatie/gevelgroep.
 */
function renderFacadeVlakSections(room, lb) {
  const groups = groupVlakkenByFacade(room.vlakken);
  if (!groups.length) {
    return `<p class="missing">Geen gevelvlakken</p>`;
  }
  const V = Number(room.volume_m3);
  const T = Number(room.t0_s) > 0 ? Number(room.t0_s) : 0.5;
  const bandHeaders = REPORT_BANDS_HZ.map((hz) => `<th class="num">${hz}</th>`).join("");

  return groups
    .map((g, idx) => {
      const els = [];
      for (const v of g.members) {
        const kind = String(v.quantity_kind || "area") === "length" ? "length" : "area";
        const q =
          kind === "length"
            ? parseReportNum(v.length_m)
            : parseReportNum(v.area_m2);
        const ra = parseReportNum(v.ra_dba);
        if (!(q > 0) || !Number.isFinite(ra)) continue;
        els.push({ v, kind, q, ra });
      }
      const sOri = els.reduce((a, e) => a + (e.kind === "area" ? e.q : 0), 0);
      const ruimte = sOri > 0 ? roomCorrectionDb(V, T, sOri) : null;
      const rasList = els
        .map((e) => (sOri > 0 ? partialRas({ ra_dba: e.ra, quantity: e.q }, sOri) : null))
        .filter((x) => x != null && Number.isFinite(x));
      const rPrime = combineRprime(rasList);
      // DGMR-vlakrij: GA = R′ + ruimte + Cg − Cr (CL niet in de rij; wel in ruimtesom).
      const gaOri =
        rPrime != null && ruimte != null
          ? rPrime + ruimte + g.cg_db - CR_DB
          : null;

      const rPrimeBands = REPORT_BAND_KEYS.map((key) => {
        const parts = els
          .map((e) => bandPartial(e.v[key], sOri, e.q))
          .filter((x) => x != null && Number.isFinite(x));
        return combineRprime(parts);
      });
      const gaBands = rPrimeBands.map((rp) =>
        rp != null && ruimte != null ? rp + ruimte + g.cg_db - CR_DB : null,
      );

      const rows = els
        .map((e) => {
          const id = String(e.v.catalog_id || "").trim() || "—";
          const name =
            String(e.v.material_name || e.v.omschrijving || "").trim() || "element";
          const sCell =
            e.kind === "area" ? esc(fmtNum(e.q, 2)) : '<span class="missing">—</span>';
          const lenCell =
            e.kind === "length" ? esc(fmtNum(e.q, 2)) : '<span class="missing">—</span>';
          const ras = sOri > 0 ? partialRas({ ra_dba: e.ra, quantity: e.q }, sOri) : null;
          const bandCells = REPORT_BAND_KEYS.map((key) => {
            const p = bandPartial(e.v[key], sOri, e.q);
            return `<td class="num">${esc(fmtNum(p, 1))}</td>`;
          }).join("");
          return `<tr>
          <td>${esc(id)}</td>
          <td>${esc(name)}</td>
          <td class="num">${sCell}</td>
          <td class="num">${lenCell}</td>
          <td class="num">${esc(fmtNum(e.ra, 1))}</td>
          ${bandCells}
          <td class="num"><strong>${esc(fmtNum(ras, 1))}</strong></td>
        </tr>`;
        })
        .join("\n");

      const rPrimeBandCells = rPrimeBands
        .map((v) => `<td class="num">${esc(fmtNum(v, 1))}</td>`)
        .join("");
      const gaBandCells = gaBands
        .map((v) => `<td class="num">${esc(fmtNum(v, 1))}</td>`)
        .join("");

      const ggBit =
        g.gevelgroep_nr && Number(g.gevelgroep_nr) > 1
          ? ` · groep ${esc(g.gevelgroep_nr)}${
              g.gevelgroep_label && g.gevelgroep_label !== "Standaard"
                ? ` (${esc(g.gevelgroep_label)})`
                : ""
            }`
          : "";
      const title = `Vlak ${idx + 1}: ${oriGevelLabel(g.orientatie)}${ggBit}`;

      return `
      <div class="facade-vlak">
        <p class="vlak-head">${title}</p>
        <div class="corr-grid">
          <div class="row"><span class="lab">Geluidniveaucorrectie CL</span><span class="val">${esc(fmtNum(g.cl_db, 1))}</span><span class="unit">dB</span><span class="muted"> (eigen waarde)</span></div>
          <div class="row"><span class="lab">Gevelstructuurcorrectie Cg</span><span class="val">${esc(fmtNum(g.cg_db, 1))}</span><span class="unit">dB</span><span class="muted"> (eigen waarde)</span></div>
        </div>
        <table class="spectrum facade-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Omschrijving</th>
              <th class="num">S [m²]</th>
              <th class="num">Lengte [m]</th>
              <th class="num">RA/DneA</th>
              <th colspan="${REPORT_BANDS_HZ.length}" class="center">Partiële geluidsisolatie per octaafband [dB(A)]</th>
              <th class="num">Totaal</th>
            </tr>
            <tr class="subhead">
              <th></th><th></th><th></th><th></th><th class="num">[dB(A)]</th>
              ${bandHeaders}
              <th class="num">[dB(A)]</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="${5 + REPORT_BANDS_HZ.length + 1}" class="missing">Geen elementen met RA</td></tr>`}
            <tr class="tot">
              <td colspan="2"><strong>Totaal</strong></td>
              <td class="num"><strong>${esc(fmtNum(sOri > 0 ? sOri : null, 2))}</strong></td>
              <td></td>
              <td class="num"><strong>R′</strong></td>
              ${rPrimeBandCells}
              <td class="num"><strong>${esc(fmtNum(rPrime, 1))}</strong></td>
            </tr>
            <tr class="tot">
              <td colspan="4"></td>
              <td class="num"><strong>GA</strong></td>
              ${gaBandCells}
              <td class="num"><strong>${esc(fmtNum(gaOri, 1))}</strong></td>
            </tr>
          </tbody>
        </table>
        <p class="note">R′ = energetische som van partiële RA’s (RAs). GA = R′ + ruimtecorrectie + Cg − Cr (${CR_DB} dB).</p>
      </div>`;
    })
    .join("\n");
}

function renderVrDetailBlock(r, lb, grens) {
  const label = r.vr_nr ? `VR ${esc(r.vr_nr)} · ${esc(r.omschrijving)}` : esc(r.omschrijving);
  // Live herberekening voor consistentie met GA-UI (facades / R′); opgeslagen waarden blijven in kop.
  const gaLive = computeVrGa({
    volume_m3: Number(r.volume_m3),
    t0_s: Number(r.t0_s) > 0 ? Number(r.t0_s) : 0.5,
    geluidsbelasting_dba: lb,
    vlakken: (r.vlakken || []).map((v) => ({
      label: v.material_name || v.omschrijving || v.catalog_id || "",
      orientatie: v.orientatie,
      gevelgroep_id: v.gevelgroep_id,
      gevelgroep_label: v.gevelgroep_label,
      ra_dba: Number(v.ra_dba),
      quantity_kind: v.quantity_kind,
      area_m2: v.area_m2,
      length_m: v.length_m,
      meenemen_gak: truthyMeenemen(v.meenemen_gak),
      cl_db: Number(v.cl_db) || 0,
      cg_db: Number(v.cg_db) || 0,
    })),
  });
  const gaShow = r.ga_dba != null && Number.isFinite(Number(r.ga_dba)) ? r.ga_dba : gaLive.ga_dba;
  const lbiShow =
    r.lbi_dba != null && Number.isFinite(Number(r.lbi_dba)) ? r.lbi_dba : gaLive.lbi_dba;
  const gakShow =
    r.gak_dba != null && Number.isFinite(Number(r.gak_dba)) ? r.gak_dba : gaLive.gak_dba;
  const okShow = voldoet(lb, gakShow, grens);

  return `
      <h3>Verblijfsruimte: ${label}</h3>
      <div class="vr-grid">
        <div>
          <div class="row"><span class="lab">Vloeroppervlak</span><span class="val">${esc(fmtNum(r.vloer_m2, 2))}</span><span class="unit">m²</span></div>
          <div class="row"><span class="lab">Vertrekhoogte</span><span class="val">${esc(fmtNum(r.hoogte_m, 2))}</span><span class="unit">m</span></div>
          <div class="row"><span class="lab">Volume</span><span class="val">${esc(fmtNum(r.volume_m3, 2))}</span><span class="unit">m³</span></div>
          <div class="row"><span class="lab">Nagalmtijd T₀</span><span class="val">${esc(fmtNum(r.t0_s != null ? r.t0_s : 0.5, 2))}</span><span class="unit">s</span></div>
        </div>
        <div>
          <div class="row"><span class="lab">Maximale geluidsbelasting</span><span class="val">${esc(fmtNum(lb, 1))}</span><span class="unit">dB</span></div>
          <div class="row"><span class="lab">Geluidwering GA</span><span class="val">${esc(fmtNum(gaShow, 1))}</span><span class="unit">dB</span></div>
          <div class="row"><span class="lab">Binnenniveau Lbi</span><span class="val">${esc(fmtNum(lbiShow, 1))}</span><span class="unit">dB</span></div>
          <div class="row"><span class="lab">Karakteristieke geluidwering GA;k</span><span class="val">${esc(fmtNum(gakShow, 1))}</span><span class="unit">dB</span></div>
          <div class="row"><span class="lab">Voldoet</span><span class="val ${okShow === true ? "ok" : okShow === false ? "fail" : ""}">${okShow == null ? "—" : okShow ? "Ja" : "Nee"}</span><span class="unit"></span></div>
        </div>
      </div>
      ${
        !gaLive.ok && gaLive.reason
          ? `<p class="note missing">Gevelbijdrage: ${esc(gaLive.reason)}</p>`
          : ""
      }
      ${renderFacadeVlakSections(r, lb)}`;
}

/** Tabel «Geluidbelasting» — Spectrum 2 (Atr) geschaald naar project-Lb. */
function renderGeluidbelastingSection(variant, lb) {
  const kind = variant.spectrum_kind;
  const spec = resolveSpectrumForReport(kind, lb);
  const label = spectrumDisplayLabel(kind);
  const fmt1 = (n) =>
    n == null || !Number.isFinite(Number(n))
      ? "—"
      : Number(n).toLocaleString("nl-NL", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        });
  const bandHeaders = (spec?.bands_hz || [63, 125, 250, 500, 1000, 2000])
    .map((hz) => `<th class="num">${hz}</th>`)
    .join("");
  let bandCells;
  let totalCell;
  let note;
  if (spec) {
    bandCells = spec.levels_db.map((v) => `<td class="num">${esc(fmt1(v))}</td>`).join("");
    totalCell = `<td class="num"><strong>${esc(fmt1(spec.total_db))}</strong></td>`;
    const base = resolveGeluidbelastingSpectrum(kind);
    const shifted =
      base && Number.isFinite(lb) && Math.abs(Number(lb) - Number(base.total_db)) > 0.05;
    note = shifted
      ? `<p class="note">Spectrum 2 (vorm Atr, referentie ${esc(fmt1(base.total_db))} dB) geschaald naar maximale gevelbelasting Lb = ${esc(fmt1(lb))} dB — octaafbanden +${esc(fmt1(Number(lb) - Number(base.total_db)))} dB.</p>`
      : `<p class="note">Spectrum 2 — wegverkeer, index Atr: octaafbanden 63–2000 Hz + totaal ${esc(fmt1(spec.total_db))} dB.</p>`;
  } else {
    bandCells = [63, 125, 250, 500, 1000, 2000]
      .map(() => `<td class="num missing">—</td>`)
      .join("");
    totalCell = `<td class="num"><strong>${esc(fmt1(lb))}</strong></td>`;
    note = `<p class="note">Voor dit spectrum zijn nog geen vaste octaafbanden vastgelegd; Lb-totaal is leidend.</p>`;
  }
  return `
    <h2>Geluidbelasting — ${esc(label)}</h2>
    <p class="note">Toegepast verkeersgeluidspectrum op deze variant (NPR 5272 / NEN 5077).</p>
    <table>
      <thead>
        <tr>
          <th>Geluidbelasting [dB]</th>
          ${bandHeaders}
          <th class="num">Totaal</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${esc(label)}</td>
          ${bandCells}
          ${totalCell}
        </tr>
      </tbody>
    </table>
    ${note}`;
}

/** Losse laatste pagina: gebruikte formules (opdrachtgever-vriendelijk). */
function renderFormulesAppendix() {
  return `
    <section class="formules-page" aria-label="Gebruikte formules">
      <h2>Gebruikte formules</h2>
      <p class="note">
        Rekenmethode NPR&nbsp;5272 / NEN&nbsp;5077 / EN&nbsp;12354-3.
        Cr = ${CR_DB}&nbsp;dB (reflectieterm).
      </p>
      <ol>
        <li>
          <strong>Partiële geluidsisolatie</strong><br />
          <code>RAs<sub>i</sub> = RA<sub>i</sub> + 10·log<sub>10</sub>(S / Q<sub>i</sub>)</code>
          — Q<sub>i</sub> = oppervlak [m²] of lengte [m] (kier)
        </li>
        <li>
          <strong>Gecombineerde geluidsisolatie R′</strong><br />
          <code>R′ = −10·log<sub>10</sub>(Σ 10<sup>−RAs<sub>i</sub>/10</sup>)</code>
        </li>
        <li>
          <strong>Ruimtecorrectie</strong><br />
          <code>Ruimte = 10·log<sub>10</sub>(V / (6·T·S))</code>
          — V volume [m³], T nagalmtijd [s], S geveloppervlak [m²]
        </li>
        <li>
          <strong>Niveauverschil per gevelvlak</strong><br />
          <code>D<sub>2m,nT</sub> = R′ + Ruimte + Cg</code>
        </li>
        <li>
          <strong>GA per gevelvlak</strong><br />
          <code>GA<sub>vlak</sub> = D<sub>2m,nT</sub> − Cr</code>
        </li>
        <li>
          <strong>Correctie geluidbelasting (CL)</strong><br />
          <code>D<sub>2m,ref</sub> = D<sub>2m,nT</sub> + CL</code>
          — CL corrigeert t.o.v. de referentiegeluidbelasting L<sub>ref</sub>
        </li>
        <li>
          <strong>GA van de verblijfsruimte</strong><br />
          <code>D<sub>2m,tot</sub> = −10·log<sub>10</sub>(Σ 10<sup>−D<sub>2m,ref</sub>/10</sup>)</code><br />
          <code>GA = D<sub>2m,tot</sub> − Cr</code>
        </li>
        <li>
          <strong>Binnenniveau</strong><br />
          <code>Lbi = Lb − GA</code>
        </li>
        <li>
          <strong>Karakteristieke gevelwering</strong><br />
          <code>GA;k = GA − 10·log<sub>10</sub>(max(V/Stot,&nbsp;3) / (6·T))</code>
          — Stot = som S van de meegenomen geveloppervlakken
        </li>
        <li>
          <strong>Karakteristiek binnenniveau en toets</strong><br />
          <code>Lbi;k = Lb − GA;k</code>
          — voldoet indien Lbi;k ≤ grenswaarde gebruiksfunctie
        </li>
      </ol>
      <p class="note">
        Cg = gevelstructuurcorrectie; CL = geluidniveaucorrectie. Beide gelden per gevelgroep.
      </p>
    </section>`;
}

function renderReportHtml(model, opts) {
  const { building, variant, verblijfsgebieden, verblijfsruimten } = model;
  const status = opts.status || "concept";
  const generatedAt = opts.generatedAt || new Date().toISOString();
  const generatedLabel = new Date(generatedAt).toLocaleString("nl-NL");
  const lb = Number(variant.geluidsbelasting_dba);
  const grens = grensForFunctie(variant.gebruiksfunctie);
  const adres = [building.street_line, `${building.postal_code} ${building.city}`.trim()]
    .filter(Boolean)
    .join(", ");
  const title = building.label || "Gevelwering";

  const vgSummaries = aggregateVerblijfsgebieden(
    verblijfsgebieden,
    verblijfsruimten,
    lb,
    grens,
  );
  const vgRows = vgSummaries
    .map((g) => {
      const toets =
        g.voldoet == null
          ? '<td class="center missing">—</td>'
          : g.voldoet
            ? '<td class="center ok">Ja</td>'
            : '<td class="center fail">Nee</td>';
      return `<tr>
        <td>${esc(g.label)}</td>
        <td class="num">${esc(fmtNum(g.stot_m2, 2))}</td>
        <td class="num">${esc(fmtNum(g.vtot_m3, 2))}</td>
        <td class="num">${esc(fmtNum(g.gak_dba, 1))}</td>
        ${toets}
      </tr>`;
    })
    .join("\n");

  /** Resultaten GA;k per VG (DGMR: VR-rijen + totaalregel), daarna VR-details met gevelvlakken. */
  const resultsAndDetails = vgSummaries
    .map((g) => {
      const rooms = verblijfsruimten.filter(
        (r) => r.verblijfsgebied_id === g.verblijfsgebied_id,
      );
      const vrRows = rooms
        .map((r) => {
          const ok = voldoet(lb, r.gak_dba, grens);
          const label = r.vr_nr
            ? `VR ${esc(r.vr_nr)} · ${esc(r.omschrijving)}`
            : esc(r.omschrijving);
          const toets =
            ok == null
              ? '<td class="center missing">—</td>'
              : ok
                ? '<td class="center ok">Ja</td>'
                : '<td class="center fail">Nee</td>';
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
      const vgOk = g.voldoet;
      const vgToets =
        vgOk == null
          ? '<td class="center missing">—</td>'
          : vgOk
            ? '<td class="center ok">Ja</td>'
            : '<td class="center fail">Nee</td>';
      const details = rooms.map((r) => renderVrDetailBlock(r, lb, grens)).join("\n");
      return `
    <h2>Resultaten GA;k — ${esc(g.label)}</h2>
    <table>
      <thead>
        <tr>
          <th>Verblijfsruimte</th>
          <th class="num">Vloeroppervlak [m²]</th>
          <th class="num">GA [dB]</th>
          <th class="num">Lbi [dB]</th>
          <th class="num">GA;k [dB]</th>
          <th class="center">Voldoet</th>
        </tr>
      </thead>
      <tbody>
        ${vrRows || '<tr><td colspan="6" class="missing">Geen verblijfsruimten</td></tr>'}
        <tr class="tot">
          <td><strong>Totaal verblijfsgebied</strong></td>
          <td class="num"><strong>${esc(fmtNum(g.stot_m2, 2))}</strong></td>
          <td></td>
          <td></td>
          <td class="num"><strong>${esc(fmtNum(g.gak_dba, 1))}</strong></td>
          ${vgToets}
        </tr>
      </tbody>
    </table>
    ${details}`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>${esc(title)} — rapport</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { margin: 0; color: #111; font: 10.5pt/1.35 Helvetica, Arial, sans-serif; }
    .sheet { padding: 0; }
    .page-head { display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: start; border-bottom: 1px solid #bbb; padding-bottom: .55rem; margin-bottom: .75rem; }
    h1 { margin: 0; font-size: 13pt; }
    .werknummer { margin: .25rem 0 0; color: #444; font-size: 9.5pt; }
    .logo { width: 72px; height: auto; display: block; object-fit: contain; }
    .logo-fallback { width: 72px; min-height: 36px; border: 1px dashed #bbb; color: #888; font-size: 7.5pt; text-align: center; padding: .35rem; box-sizing: border-box; }
    .meta { display: grid; grid-template-columns: 9.5rem 1fr; gap: .15rem .75rem; font-size: 9.5pt; margin: .5rem 0 .85rem; }
    .meta dt { color: #444; } .meta dd { margin: 0; font-weight: 600; }
    .badge { display: inline-block; padding: .1rem .45rem; background: #f3e5ab; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; }
    .variant-bar { background: #d8d8d8; font-weight: 700; padding: .35rem .5rem; margin: .85rem 0 .55rem; }
    h2 { margin: .85rem 0 .35rem; font-size: 10.5pt; border-bottom: 1px solid #bbb; }
    h3 { margin: .75rem 0 .3rem; font-size: 10pt; }
    table { width: 100%; border-collapse: collapse; font-size: 8.8pt; margin: .35rem 0 .65rem; }
    table.spectrum { font-size: 7.2pt; }
    table.facade-table th.subhead, tr.subhead th { background: #fafafa; font-weight: 500; font-size: 6.8pt; }
    th, td { border: 1px solid #bbb; padding: .18rem .28rem; vertical-align: top; }
    th { background: #f2f2f2; text-align: left; }
    tr.tot td { background: #f7f7f7; }
    .num { text-align: right; white-space: nowrap; } .center { text-align: center; }
    .ok { color: #1b5e20; font-weight: 700; } .fail { color: #b71c1c; font-weight: 700; } .missing { color: #888; font-style: italic; }
    .muted { color: #666; font-size: 7.5pt; font-weight: 400; }
    .note { font-size: 8.5pt; color: #444; margin: .2rem 0 .45rem; }
    .vlak-head { margin: .65rem 0 .2rem; font-weight: 700; font-size: 9.5pt; }
    .facade-vlak { margin: .35rem 0 .75rem; page-break-inside: avoid; }
    .corr-grid { font-size: 9pt; margin: .15rem 0 .4rem; }
    .corr-grid .row { display: grid; grid-template-columns: 12rem auto auto 1fr; gap: .35rem; align-items: baseline; }
    .vr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .25rem 1.25rem; font-size: 9.5pt; margin: .35rem 0 .55rem; }
    .vr-grid .row { display: grid; grid-template-columns: 1fr auto auto; gap: .35rem; }
    .lab { color: #444; } .val { font-weight: 650; text-align: right; } .unit { color: #444; min-width: 1.6rem; }
    .page-foot { display: flex; justify-content: space-between; margin-top: 1.25rem; padding-top: .4rem; border-top: 1px solid #bbb; font-size: 8.5pt; color: #444; }
    .formules-page { page-break-before: always; break-before: page; }
    .formules-page h2 { margin-top: 0; }
    .formules-page ol { margin: .35rem 0 .65rem; padding-left: 1.25rem; }
    .formules-page li { margin: .28rem 0; }
    .formules-page code { font-size: 9pt; }
  </style>
</head>
<body data-generated-at="${esc(generatedAt)}" data-report-template="${esc(REPORT_TEMPLATE_VERSION)}">
  <article class="sheet">
    <header class="page-head">
      <div>
        <h1>${esc(title)}</h1>
        <p class="werknummer">Werknummer: ${esc(building.external_ref || "—")} · <span class="badge">${esc(status)}</span></p>
      </div>
      ${
        stilteLogoDataUri()
          ? `<img class="logo" src="${stilteLogoDataUri()}" alt="${esc(FIRM_NAME)}" />`
          : `<div class="logo-fallback">${esc(FIRM_NAME)}</div>`
      }
    </header>
    <dl class="meta">
      <dt>Werknummer</dt><dd>${esc(building.external_ref || "—")}</dd>
      <dt>Kenmerk opdrachtgever</dt><dd>${esc(building.client_ref || "—")}</dd>
      <dt>Project / omschrijving</dt><dd>${esc(title)}${adres ? ` — ${esc(adres)}` : ""}</dd>
      <dt>Opdrachtgever</dt><dd>${esc(building.customer_name || "—")}</dd>
      <dt>Rekenmethode</dt><dd>NPR 5272 / NEN 5077</dd>
      <dt>Gebruiksfunctie</dt><dd>${esc(variant.gebruiksfunctie)} (grens Lbi;k ≤ ${grens} dB)</dd>
      <dt>Rapportstatus</dt><dd>${esc(status)}</dd>
      <dt>Projectstatus app</dt><dd>${esc(building.project_status)}</dd>
    </dl>
    <div class="variant-bar">VARIANT: ${esc(variant.omschrijving)} · Lb ${esc(fmtNum(lb, 1))} dB · ${esc(spectrumDisplayLabel(variant.spectrum_kind))}</div>
    ${renderGeluidbelastingSection(variant, lb)}
    <h2>Verblijfsgebieden</h2>
    <p class="note">Samenvatting per verblijfsgebied: Stot/Vtot over alle VR’s; GA;k = transmissiegemiddelde over VR’s met opgeslagen GA;k (vloergewogen, NEN 5077).</p>
    <table>
      <thead>
        <tr>
          <th>Omschrijving</th>
          <th class="num">Stot [m²]</th>
          <th class="num">Vtot [m³]</th>
          <th class="num">GA;k [dB]</th>
          <th class="center">Voldoet</th>
        </tr>
      </thead>
      <tbody>
        ${vgRows || '<tr><td colspan="5" class="missing">Geen verblijfsgebieden</td></tr>'}
      </tbody>
    </table>
    ${resultsAndDetails || '<h2>Resultaten GA;k</h2><p class="missing">Geen verblijfsruimten</p>'}
    ${renderFormulesAppendix()}
    <footer class="page-foot">
      <span>Geluidwering gevels · ${esc(FIRM_NAME)}</span>
      <span>${esc(generatedLabel)}</span>
    </footer>
  </article>
</body>
</html>`;
}

export function handleReportApiOptions(req, res) {
  res.writeHead(204, { ...securityHeaders(req), ...corsHeaders(req) });
  res.end();
}

/**
 * Core report write (HTML+PDF). Used by HTTP handler and local regen scripts.
 * @param {{ buildingId: string, variantId?: string, status?: string, force?: boolean }} opts
 */
export async function generateReportFiles(opts) {
  const buildingId = String(opts.buildingId || "").trim();
  const variantId = String(opts.variantId || "").trim();
  const status = String(opts.status || "concept").trim().toLowerCase() || "concept";
  const force = Boolean(opts.force);
  if (!UUID_RE.test(buildingId)) {
    const err = new Error("building_id required");
    err.code = "BAD_REQUEST";
    throw err;
  }
  if (variantId && !UUID_RE.test(variantId)) {
    const err = new Error("invalid variant_id");
    err.code = "BAD_REQUEST";
    throw err;
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
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
      return {
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
        status,
        variant_id: model.variant.variant_id,
      };
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
      const err = new Error(msg);
      err.code = "PDF_FAILED";
      err.html_filename = filename;
      throw err;
    }

    return {
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
    };
  } finally {
    client.release();
  }
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
  } catch (err) {
    console.error("report generate auth error:", err);
    json(req, res, 500, { ok: false, error: "rapport genereren mislukt" });
    return;
  } finally {
    client.release();
  }

  try {
    const result = await generateReportFiles({ buildingId, variantId, status, force });
    json(req, res, result.identical ? 200 : 201, result);
  } catch (err) {
    if (err?.code === "NOT_FOUND") {
      json(req, res, 404, { ok: false, error: err.message });
      return;
    }
    if (err?.code === "NO_VARIANT") {
      json(req, res, 400, { ok: false, error: err.message });
      return;
    }
    if (err?.code === "PDF_FAILED") {
      json(req, res, 500, { ok: false, error: err.message, html_filename: err.html_filename });
      return;
    }
    console.error("report generate error:", err);
    json(req, res, 500, { ok: false, error: "rapport genereren mislukt" });
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

    // Mirror naar gedeelde Stilte-inbox (portaal + isolatie).
    try {
      const sharedExisting = await client.query(
        `SELECT id::text AS inbox_id
         FROM identity.customer_report_inbox
         WHERE service = 'gevelwering' AND building_id = $1::uuid AND filename = $2`,
        [buildingId, inboxFilename],
      );
      if (sharedExisting.rows[0]) {
        await client.query(
          `UPDATE identity.customer_report_inbox
           SET owner_user_id = $2::uuid,
               building_label = $3,
               report_kind = $4,
               version_label = $5,
               content_hash = $6,
               message = $7,
               published_by = $8::uuid,
               published_at = now(),
               read_at = NULL,
               downloaded_at = NULL,
               email_requested_at = NULL
           WHERE id = $1::uuid`,
          [
            sharedExisting.rows[0].inbox_id,
            access.owner_user_id || null,
            access.label || "",
            reportKind,
            versionLabel,
            contentHash,
            message,
            session.user_id,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO identity.customer_report_inbox
             (id, service, building_id, owner_user_id, building_label, filename,
              report_kind, version_label, content_hash, message, published_by)
           VALUES ($1::uuid, 'gevelwering', $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10::uuid)`,
          [
            rows[0].inbox_id,
            buildingId,
            access.owner_user_id || null,
            access.label || "",
            inboxFilename,
            reportKind,
            versionLabel,
            contentHash,
            message,
            session.user_id,
          ],
        );
      }
    } catch (syncErr) {
      console.warn("shared inbox sync failed:", syncErr);
    }

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

/** Owner/staff: remove inbox row + bijbehorend rapportbestand (pdf/html/hash). */
export async function handleReportInboxDelete(req, res) {
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
  let building = null;
  let filename = "";
  try {
    const session = await resolveSession(client, token);
    if (!session) {
      json(req, res, 401, { ok: false, error: "session invalid or expired" });
      return;
    }
    const found = await client.query(
      `SELECT building_id::text AS building_id,
              filename
       FROM app_gevelwering.customer_report_inbox
       WHERE id = $1::uuid`,
      [inboxId],
    );
    if (!found.rows[0]) {
      json(req, res, 404, { ok: false, error: "inbox-item niet gevonden" });
      return;
    }
    filename = String(found.rows[0].filename || "").trim();
    const access = await assertCanAccessBuilding(client, found.rows[0].building_id, session);
    if (!access) {
      json(req, res, 403, { ok: false, error: "geen toegang" });
      return;
    }
    building = access;
    const del = await client.query(
      `DELETE FROM app_gevelwering.customer_report_inbox
       WHERE id = $1::uuid
       RETURNING id::text AS inbox_id`,
      [inboxId],
    );
    if (!del.rows[0]) {
      json(req, res, 404, { ok: false, error: "inbox-item niet gevonden" });
      return;
    }
    // Spiegel in gedeelde Stilte-inbox meenemen (anders blijft portaal-teller staan).
    try {
      await client.query(
        `DELETE FROM identity.customer_report_inbox
         WHERE service = 'gevelwering'
           AND (
             id = $1::uuid
             OR (building_id = $2::uuid AND filename = $3)
           )`,
        [inboxId, found.rows[0].building_id, filename],
      );
    } catch (syncErr) {
      console.warn("shared inbox delete sync failed:", syncErr);
    }
  } finally {
    client.release();
  }

  const removedFiles = [];
  if (building && filename && !filename.includes("..") && !filename.includes("/") && !filename.includes("\\")) {
    const dir = reportsDir(building);
    const base = filename.replace(/\.(pdf|html)$/i, "");
    const candidates = [
      `${base}.pdf`,
      `${base}.html`,
      `${base}.html.sha256`,
      `${base}.sha256`,
      filename,
    ];
    const seen = new Set();
    for (const name of candidates) {
      if (seen.has(name)) continue;
      seen.add(name);
      const full = path.join(dir, name);
      try {
        if (fs.existsSync(full)) {
          await fsp.unlink(full);
          removedFiles.push(name);
        }
      } catch (err) {
        console.error("inbox delete file failed:", full, err);
      }
    }
  }

  json(req, res, 200, { ok: true, inbox_id: inboxId, removed_files: removedFiles });
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
