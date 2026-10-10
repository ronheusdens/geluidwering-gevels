var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key2, value) => key2 in obj ? __defProp(obj, key2, { enumerable: true, configurable: true, writable: true, value }) : obj[key2] = value;
var __publicField = (obj, key2, value) => __defNormalProp(obj, typeof key2 !== "symbol" ? key2 + "" : key2, value);

// src/auth-store.ts
function loadAuth(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    if (!sessionStorage.getItem(storageKey) && localStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, raw);
      localStorage.removeItem(storageKey);
    }
    return parsed;
  } catch {
    return null;
  }
}
function storeAuth(storageKey, info) {
  localStorage.removeItem(storageKey);
  if (!info) sessionStorage.removeItem(storageKey);
  else sessionStorage.setItem(storageKey, JSON.stringify(info));
}
async function syncSessionCookie(token) {
  try {
    if (token) {
      await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
    } else {
      await fetch("/api/session", {
        method: "DELETE",
        credentials: "include"
      });
    }
  } catch {
  }
}
function apiAuthHeaders(token, json = false) {
  const h = {
    Authorization: `Bearer ${token}`
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// src/flow-vr.ts
function key(bid) {
  return `app-gevelwering-flow-vr:${bid.trim().toLowerCase()}`;
}
function normalizeFlowVrNr(raw) {
  const s = String(raw ?? "").trim();
  return s || null;
}
function flowVrNrsEqual(a, b) {
  const x = normalizeFlowVrNr(a);
  const y = normalizeFlowVrNr(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const nx = Number(x);
  const ny = Number(y);
  return Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}
function clearFlowVr(buildingId2) {
  const bid = String(buildingId2 || "").trim();
  if (!bid) return;
  try {
    sessionStorage.removeItem(key(bid));
  } catch {
  }
}
function persistFlowVr(buildingId2, vrNr, vgNr) {
  const bid = String(buildingId2 || "").trim();
  if (!bid) return;
  const vr = normalizeFlowVrNr(vrNr);
  if (!vr) {
    clearFlowVr(bid);
    return;
  }
  const payload = {
    vr_nr: vr,
    vg_nr: vgNr != null && Number.isFinite(Number(vgNr)) ? Number(vgNr) : null
  };
  try {
    sessionStorage.setItem(key(bid), JSON.stringify(payload));
  } catch {
  }
}
function readFlowVr(buildingId2) {
  const bid = String(buildingId2 || "").trim();
  if (!bid) return null;
  try {
    const raw = sessionStorage.getItem(key(bid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const vr = normalizeFlowVrNr(parsed?.vr_nr);
    if (!vr) return null;
    const vg = parsed.vg_nr != null && Number.isFinite(Number(parsed.vg_nr)) ? Number(parsed.vg_nr) : null;
    return { vr_nr: vr, vg_nr: vg };
  } catch {
    return null;
  }
}

// src/ws-url.ts
function resolveBppWsUrl() {
  if (location.protocol === "https:") {
    return `wss://${location.host}/ws`;
  }
  const q = new URLSearchParams(location.search).get("ws");
  const override = window.BPP_WS_URL;
  return q || override || `ws://${location.hostname}:18080/ws`;
}

// src/password-toggle.ts
var EYE_CLOSED = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 9.11 17 5 12 5c-1.4 0-2.73.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`;
var EYE_OPEN = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5c-5 0-9.27 3.11-11 7.5C2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
function enhancePasswordInput(input) {
  if (input.dataset.pwToggle === "1") return;
  if (input.closest(".pw-field")) return;
  input.dataset.pwToggle = "1";
  const wrap = document.createElement("div");
  wrap.className = "pw-field";
  input.parentNode?.insertBefore(wrap, input);
  wrap.appendChild(input);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pw-toggle";
  btn.setAttribute("aria-label", "Wachtwoord tonen");
  btn.setAttribute("aria-pressed", "false");
  btn.innerHTML = EYE_CLOSED;
  wrap.appendChild(btn);
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.innerHTML = show ? EYE_OPEN : EYE_CLOSED;
    btn.setAttribute("aria-pressed", show ? "true" : "false");
    btn.setAttribute("aria-label", show ? "Wachtwoord verbergen" : "Wachtwoord tonen");
  });
}
function initPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(enhancePasswordInput);
}

// src/ga-calc.ts
var CR_DB = 3;
var GRENZWAARDE_LBIK_DB = 33;
var GRENZWAARDE_LBIK_BY_FUNCTIE = {
  Woonfunctie: 33,
  "Bijeenkomst voor kinderopvang": 28,
  Gezondheidszorgfunctie: 33,
  Onderwijsfunctie: 28,
  "Wgh, gezondheidszorg geluidgevoelig": 33,
  "Wgh, onderwijsfunctie geluidgevoelig": 28,
  Overig: 33
};
function grenswaardeLbik(gebruiksfunctie) {
  const key2 = String(gebruiksfunctie || "").trim();
  if (key2 && key2 in GRENZWAARDE_LBIK_BY_FUNCTIE) {
    return GRENZWAARDE_LBIK_BY_FUNCTIE[key2];
  }
  return GRENZWAARDE_LBIK_DB;
}
function round1(x) {
  return Math.round(Number(x) * 10) / 10;
}
function partialRas(el, sRef) {
  const q = Number(el.quantity);
  const ra = Number(el.ra_dba);
  if (!(sRef > 0) || !(q > 0) || !Number.isFinite(ra)) return null;
  return ra + 10 * Math.log10(sRef / q);
}
function combineRprime(rasValues) {
  const vals = rasValues.filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  let sum = 0;
  for (const r of vals) sum += 10 ** (-r / 10);
  if (!(sum > 0)) return null;
  return -10 * Math.log10(sum);
}
function combineLevelsDb(levels) {
  const vals = levels.filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  let sum = 0;
  for (const L of vals) sum += 10 ** (-L / 10);
  if (!(sum > 0)) return null;
  return -10 * Math.log10(sum);
}
function roomCorrectionDb(volumeM3, t0s, sM2) {
  const V = Number(volumeM3);
  const T = Number(t0s);
  const S = Number(sM2);
  if (!(V > 0) || !(T > 0) || !(S > 0)) return null;
  return 10 * Math.log10(V / (6 * T * S));
}
function gakCorrectionDb(volumeM3, t0s, stotM2) {
  const V = Number(volumeM3);
  const T = Number(t0s);
  const S = Number(stotM2);
  if (!(V > 0) || !(T > 0) || !(S > 0)) return null;
  const ratio = Math.max(V / S, 3);
  return 10 * Math.log10(ratio / (6 * T));
}
function normalizeOriKey(raw) {
  const s = String(raw || "").trim().toUpperCase();
  return s || "_";
}
function failResult(grens, partial) {
  return {
    ok: false,
    reason: partial.reason,
    s_m2: partial.s_m2,
    stot_m2: partial.stot_m2,
    elements: partial.elements || [],
    facades: partial.facades || [],
    r_prime: partial.r_prime ?? null,
    ruimte_db: partial.ruimte_db ?? null,
    cl_db: partial.cl_db ?? 0,
    cg_db: partial.cg_db ?? 0,
    d2m_nt: null,
    ga_dba: null,
    lbi_dba: null,
    gak_dba: null,
    gak_corr_db: null,
    lbik_dba: null,
    gak_required_dba: null,
    grenswaarde_lbik_db: grens,
    voldoet: null
  };
}
function computeVrGa(input) {
  const V = Number(input.volume_m3);
  const T = Number(input.t0_s) > 0 ? Number(input.t0_s) : 0.5;
  const Lb = Number(input.geluidsbelasting_dba);
  const Cr = input.cr_db != null ? Number(input.cr_db) : CR_DB;
  const grens = input.grenswaarde_lbik_db != null && Number.isFinite(Number(input.grenswaarde_lbik_db)) ? Number(input.grenswaarde_lbik_db) : grenswaardeLbik(input.gebruiksfunctie);
  const vlakken2 = Array.isArray(input.vlakken) ? input.vlakken : [];
  const overrideCl = input.cl_db != null && Number.isFinite(Number(input.cl_db)) ? Number(input.cl_db) : null;
  const overrideCg = input.cg_db != null && Number.isFinite(Number(input.cg_db)) ? Number(input.cg_db) : null;
  const raw = [];
  for (const v of vlakken2) {
    const kind = v.quantity_kind === "length" ? "length" : "area";
    const qty = kind === "length" ? v.length_m != null ? Number(v.length_m) : NaN : v.area_m2 != null ? Number(v.area_m2) : NaN;
    const ra = Number(v.ra_dba);
    if (!(qty > 0) || !Number.isFinite(ra)) continue;
    const cl = overrideCl != null ? overrideCl : Number(v.cl_db) || 0;
    const cg = overrideCg != null ? overrideCg : Number(v.cg_db) || 0;
    const ori = normalizeOriKey(v.orientatie);
    const ggId = String(v.gevelgroep_id || "").trim();
    raw.push({
      label: v.label || "",
      kind,
      quantity: qty,
      ra_dba: ra,
      meenemen_gak: v.meenemen_gak !== false,
      cl_db: cl,
      cg_db: cg,
      area_for_s: kind === "area" ? qty : 0,
      orientatie: ori,
      gevelgroep_id: ggId,
      gevelgroep_label: String(v.gevelgroep_label || "").trim()
    });
  }
  const sAll = raw.reduce((a, e) => a + e.area_for_s, 0);
  const stot = raw.filter((e) => e.meenemen_gak).reduce((a, e) => a + e.area_for_s, 0);
  if (!(sAll > 0) || !raw.length) {
    return failResult(grens, {
      reason: "geen geveloppervlak (m\xB2) \u2014 voeg vlakken met materiaal toe",
      s_m2: sAll,
      stot_m2: stot
    });
  }
  if (!(V > 0)) {
    return failResult(grens, {
      reason: "Geen volume (vloeroppervlak ontbreekt of is 0). Zet de schaal op de plattegrond, herbereken maten voor deze VR, daarna opnieuw Herberekenen GA / GA;k.",
      s_m2: sAll,
      stot_m2: stot
    });
  }
  const byFacadeKey = /* @__PURE__ */ new Map();
  for (const e of raw) {
    const key2 = e.gevelgroep_id ? `g:${e.gevelgroep_id}` : `${e.orientatie}\0${e.cl_db}\0${e.cg_db}`;
    const list = byFacadeKey.get(key2) || [];
    list.push(e);
    byFacadeKey.set(key2, list);
  }
  const facades = [];
  const allElements = [];
  for (const group of byFacadeKey.values()) {
    const ori = group[0].orientatie;
    const cl = group[0].cl_db;
    const cg = group[0].cg_db;
    const ggId = group[0].gevelgroep_id || null;
    const ggLabel = group[0].gevelgroep_label || "";
    const sOri = group.reduce((a, e) => a + e.area_for_s, 0);
    if (!(sOri > 0)) {
      return failResult(grens, {
        reason: `Gevel ${ori}: geen oppervlak (m\xB2) \u2014 alleen kierlengte is niet genoeg voor R\u2032`,
        s_m2: sAll,
        stot_m2: stot,
        elements: allElements,
        facades
      });
    }
    const elements = group.map((e) => ({
      label: e.label,
      kind: e.kind,
      quantity: e.quantity,
      ra_dba: e.ra_dba,
      ras: partialRas({ ra_dba: e.ra_dba, quantity: e.quantity }, sOri),
      meenemen_gak: e.meenemen_gak,
      cl_db: cl,
      cg_db: cg,
      area_for_s: e.area_for_s,
      orientatie: ori,
      gevelgroep_id: e.gevelgroep_id || null
    }));
    const rPrime = combineRprime(elements.map((e) => e.ras).filter((x) => x != null));
    const ruimte = roomCorrectionDb(V, T, sOri);
    if (rPrime == null || ruimte == null) {
      return failResult(grens, {
        reason: !(T > 0) ? "Geen nagalmtijd T\u2080 \u2014 vul T\u2080 bij de VR in." : `berekening mislukt voor gevel ${ori} (R' of ruimtecorrectie)`,
        s_m2: sAll,
        stot_m2: stot,
        elements: [...allElements, ...elements],
        facades,
        r_prime: rPrime,
        ruimte_db: ruimte,
        cl_db: cl,
        cg_db: cg
      });
    }
    const d2m = rPrime + ruimte + cg;
    const d2mRef = d2m + cl;
    const gaOri = d2m - Cr;
    const gaRef = d2mRef - Cr;
    const lbiOri = Number.isFinite(Lb) ? Lb - gaRef : null;
    facades.push({
      orientatie: ori,
      gevelgroep_id: ggId,
      gevelgroep_label: ggLabel || null,
      s_m2: sOri,
      r_prime: rPrime,
      ruimte_db: ruimte,
      cl_db: cl,
      cg_db: cg,
      d2m_nt: d2m,
      d2m_nt_ref: d2mRef,
      ga_dba: gaOri,
      lbi_dba: lbiOri,
      elements
    });
    allElements.push(...elements);
  }
  if (!facades.length) {
    return failResult(grens, {
      reason: "geen geveloppervlak (m\xB2) \u2014 voeg vlakken met materiaal toe",
      s_m2: sAll,
      stot_m2: stot,
      elements: allElements
    });
  }
  const d2mTot = combineLevelsDb(facades.map((f) => f.d2m_nt_ref));
  if (d2mTot == null) {
    return failResult(grens, {
      reason: "combinatie van gevels mislukt",
      s_m2: sAll,
      stot_m2: stot,
      elements: allElements,
      facades
    });
  }
  const ga = d2mTot - Cr;
  const lbi = Number.isFinite(Lb) ? Lb - ga : null;
  const gakCorr = stot > 0 ? gakCorrectionDb(V, T, stot) : null;
  const gak = gakCorr != null ? ga - gakCorr : null;
  const gakRequired = Number.isFinite(Lb) ? Lb - grens : null;
  const lbik = gak != null && Number.isFinite(Lb) ? Lb - gak : null;
  const voldoet = lbik != null ? lbik <= grens : null;
  let displayCl = facades[0].cl_db;
  let displayCg = facades[0].cg_db;
  let bestS = facades[0].s_m2;
  for (const f of facades) {
    if (f.s_m2 > bestS) {
      bestS = f.s_m2;
      displayCl = f.cl_db;
      displayCg = f.cg_db;
    }
  }
  const single = facades.length === 1;
  return {
    ok: true,
    reason: null,
    s_m2: sAll,
    stot_m2: stot,
    elements: allElements,
    facades,
    r_prime: single ? facades[0].r_prime : null,
    ruimte_db: single ? facades[0].ruimte_db : null,
    cl_db: displayCl,
    cg_db: displayCg,
    cr_db: Cr,
    d2m_nt: d2mTot,
    ga_dba: ga,
    lbi_dba: lbi,
    gak_dba: gak,
    gak_corr_db: gakCorr,
    lbik_dba: lbik,
    gak_required_dba: gakRequired,
    grenswaarde_lbik_db: grens,
    voldoet
  };
}
function minRaDeltaForRprime(elements, elementIndex, needDeltaR) {
  if (!(needDeltaR > 0)) return 0;
  const target = elements[elementIndex];
  if (!target || target.ras == null || !Number.isFinite(target.ras)) return null;
  const ori = target.orientatie;
  const gg = String(target.gevelgroep_id || "").trim();
  const peers = ori != null ? elements.map((e, i) => ({ e, i })).filter(({ e }) => {
    if (e.orientatie !== ori) return false;
    const eg = String(e.gevelgroep_id || "").trim();
    if (gg || eg) return eg === gg;
    return (target.cl_db == null || e.cl_db === target.cl_db) && (target.cg_db == null || e.cg_db === target.cg_db);
  }) : elements.map((e, i) => ({ e, i }));
  const rasList = peers.map(({ e }) => e.ras).filter((x) => x != null && Number.isFinite(x));
  if (rasList.length !== peers.length) return null;
  const oldSum = rasList.reduce((a, r) => a + 10 ** (-r / 10), 0);
  if (!(oldSum > 0)) return null;
  const oldRp = -10 * Math.log10(oldSum);
  const targetRp = oldRp + needDeltaR;
  const tauI = 10 ** (-target.ras / 10);
  const rest = oldSum - tauI;
  const maxSum = 10 ** (-targetRp / 10);
  if (!(maxSum > rest)) return null;
  const maxTauI = maxSum - rest;
  if (!(maxTauI > 0)) return null;
  const neededRas = -10 * Math.log10(maxTauI);
  const delta = neededRas - target.ras;
  if (!(delta > 0)) return 0;
  return Math.ceil(delta * 10) / 10;
}

// src/app-version.ts
var APP_VERSION = "0.74";
var APP_NAME = "Stilte advies en meten";
var USER_DOCS_HREF = "/handleiding.html";

// src/project-menu.ts
var RECENT_KEY = "app-gevelwering-recent-projects";
var RECENT_MAX = 8;
function parseJsonOk(raw) {
  if (raw.startsWith("ERROR")) throw new Error(raw);
  return JSON.parse(raw);
}
function projectTitle(meta) {
  const label = (meta.label || "").trim();
  const ref = (meta.external_ref || "").trim();
  if (label && ref) return `${label} (${ref})`;
  if (label) return label;
  if (ref) return ref;
  const id = meta.building_id || "";
  return id ? `${id.slice(0, 8)}\u2026` : "Geen project";
}
function loadRecentProjects() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => p?.building_id) : [];
  } catch {
    return [];
  }
}
function rememberRecentProject(entry) {
  const id = entry.building_id.trim();
  if (!id) return;
  const next = {
    building_id: id,
    label: (entry.label || "").trim(),
    external_ref: (entry.external_ref || "").trim() || void 0,
    at: Date.now()
  };
  const rest = loadRecentProjects().filter((p) => p.building_id !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([next, ...rest].slice(0, RECENT_MAX)));
}
function removeRecentProject(buildingId2) {
  const id = buildingId2.trim();
  if (!id) return;
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(loadRecentProjects().filter((p) => p.building_id !== id))
  );
}
async function cleanupProjectFolder(buildingId2, headers) {
  try {
    await fetch("/api/reports/cleanup-project-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ building_id: buildingId2 })
    });
  } catch {
  }
}
function mountProjectMenu(root, host) {
  root.classList.add("file-menu");
  root.setAttribute("aria-label", "Bestand en Over");
  root.innerHTML = `
    <div class="file-menu-bar">
      <details class="file-menu-details" id="pm-root">
        <summary class="file-menu-summary">Bestand</summary>
        <ul class="file-menu-list" role="menu">
          <li><button type="button" role="menuitem" data-act="open">Openen\u2026</button></li>
          <li class="file-menu-recent-wrap">
            <details class="file-menu-recent">
              <summary>Recent geopend</summary>
              <ul class="file-menu-recent-list" id="pm-recent"></ul>
            </details>
          </li>
          <li><button type="button" role="menuitem" data-act="save">Project opslaan</button></li>
          <li><button type="button" role="menuitem" data-act="rename">Hernoemen\u2026</button></li>
          <li><button type="button" role="menuitem" data-act="delete" class="danger">Verwijderen\u2026</button></li>
        </ul>
      </details>
      <details class="file-menu-details" id="pm-about">
        <summary class="file-menu-summary">Over</summary>
        <ul class="file-menu-list" role="menu">
          <li class="file-menu-about-version" role="menuitem">${APP_NAME}</li>
          <li class="file-menu-about-version" role="menuitem">Versie ${APP_VERSION}</li>
          <li>
            <a class="file-menu-about-link" href="${USER_DOCS_HREF}" role="menuitem">Gebruikershandleiding</a>
          </li>
        </ul>
      </details>
      <span class="file-menu-project-title" id="pm-title" aria-live="polite">Geen project</span>
    </div>
    <dialog class="file-menu-dialog" id="pm-open-dialog">
      <form method="dialog" class="file-menu-dialog-form">
        <h2>Project openen</h2>
        <p class="hint">Kies een lopend project om verder te werken.</p>
        <ul class="file-menu-project-list" id="pm-open-list"></ul>
        <p class="hint hidden" id="pm-open-empty">Geen openstaande projecten.</p>
        <div class="actions">
          <button type="submit" value="cancel" class="secondary">Annuleren</button>
        </div>
      </form>
    </dialog>
  `;
  const detailsEl = root.querySelector("#pm-root");
  const aboutEl = root.querySelector("#pm-about");
  const titleEl = root.querySelector("#pm-title");
  const recentEl = root.querySelector("#pm-recent");
  const dialogEl = root.querySelector("#pm-open-dialog");
  const openListEl = root.querySelector("#pm-open-list");
  const openEmptyEl = root.querySelector("#pm-open-empty");
  function status(state, text) {
    host.onStatus?.(state, text);
  }
  function refreshTitle() {
    const id = host.getBuildingId();
    const meta = host.getProjectMeta();
    const title = projectTitle({ ...meta, building_id: id });
    titleEl.textContent = id ? title : "Geen project";
    host.setTitle?.(id ? title : "Geen project");
  }
  function rememberCurrent() {
    const id = host.getBuildingId();
    if (!id) return;
    const meta = host.getProjectMeta();
    rememberRecentProject({
      building_id: id,
      label: meta.label,
      external_ref: meta.external_ref
    });
    renderRecent();
    refreshTitle();
  }
  function closeMenu() {
    detailsEl.open = false;
    aboutEl.open = false;
    const recent = root.querySelector(".file-menu-recent");
    if (recent) recent.open = false;
  }
  function renderRecent() {
    recentEl.innerHTML = "";
    const items = loadRecentProjects();
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "Nog geen recente projecten";
      recentEl.appendChild(li);
      return;
    }
    for (const p of items) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = projectTitle(p);
      btn.addEventListener("click", () => {
        closeMenu();
        void openProject(p.building_id);
      });
      li.appendChild(btn);
      recentEl.appendChild(li);
    }
  }
  async function openProject(buildingId2) {
    status("busy", "Project openen\u2026");
    try {
      await host.openBuilding(buildingId2);
      rememberCurrent();
      status("ok", "Project geopend");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function showOpenDialog() {
    const token = host.getToken();
    if (!token) {
      status("err", "Log eerst in");
      return;
    }
    closeMenu();
    openListEl.innerHTML = "";
    openEmptyEl.classList.add("hidden");
    status("busy", "Projecten laden\u2026");
    try {
      const ret = await host.invokeString("API_EngineerListProjects", [token]);
      const data = parseJsonOk(ret);
      const projects = data.projects || [];
      if (!projects.length) {
        openEmptyEl.classList.remove("hidden");
      }
      for (const p of projects) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        const title = projectTitle(p);
        const finished = p.project_status === "PROJECT_FINISHED";
        const who = p.customer_name ? ` \u2014 ${p.customer_name}` : "";
        btn.textContent = finished ? `${title}${who} \xB7 afgerond` : `${title}${who}`;
        if (p.project_status) {
          btn.title = p.project_status;
        }
        if (finished) btn.classList.add("project-open-finished");
        btn.addEventListener("click", () => {
          dialogEl.close();
          void openProject(p.building_id);
        });
        li.appendChild(btn);
        openListEl.appendChild(li);
      }
      status("ok", `${projects.length} project(en)`);
      if (typeof dialogEl.showModal === "function") dialogEl.showModal();
      else dialogEl.setAttribute("open", "");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function saveProject() {
    closeMenu();
    if (!host.getBuildingId()) {
      status("err", "Geen project geselecteerd");
      return;
    }
    status("busy", "Project opslaan\u2026");
    try {
      await host.saveProject();
      rememberCurrent();
      status("ok", "Project opgeslagen");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function renameProject() {
    closeMenu();
    const token = host.getToken();
    const id = host.getBuildingId();
    if (!token || !id) {
      status("err", "Geen project geselecteerd");
      return;
    }
    const meta = host.getProjectMeta();
    const label = window.prompt("Projectnaam (label)", meta.label || "");
    if (label === null) return;
    const externalRef = window.prompt("Projectnummer / werknummer", meta.external_ref || "");
    if (externalRef === null) return;
    status("busy", "Hernoemen\u2026");
    try {
      const ret = await host.invokeString("API_RenameProject", [
        token,
        id,
        label.trim(),
        externalRef.trim()
      ]);
      const data = parseJsonOk(ret);
      const next = {
        label: data.label ?? label.trim(),
        external_ref: data.external_ref ?? externalRef.trim()
      };
      host.onProjectRenamed?.(next);
      rememberRecentProject({ building_id: id, ...next });
      renderRecent();
      refreshTitle();
      status("ok", "Project hernoemd");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function deleteProject() {
    closeMenu();
    const token = host.getToken();
    const id = host.getBuildingId();
    if (!token || !id) {
      status("err", "Geen project geselecteerd");
      return;
    }
    const title = projectTitle({ ...host.getProjectMeta(), building_id: id });
    if (!window.confirm(
      `Project \xAB${title}\xBB definitief verwijderen?
Dit wist berekeningen, tekeningen en rapportmappen. Dit kan niet ongedaan worden gemaakt.`
    )) {
      return;
    }
    status("busy", "Project verwijderen\u2026");
    try {
      const ret = await host.invokeString("API_EngineerDeleteProject", [token, id]);
      parseJsonOk(ret);
      await cleanupProjectFolder(id, host.apiAuthHeaders());
      removeRecentProject(id);
      renderRecent();
      await host.onProjectDeleted?.();
      refreshTitle();
      status("ok", "Project verwijderd");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  detailsEl.addEventListener("toggle", () => {
    if (detailsEl.open) aboutEl.open = false;
  });
  aboutEl.addEventListener("toggle", () => {
    if (aboutEl.open) detailsEl.open = false;
  });
  root.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn || !root.contains(btn)) return;
    const act = btn.dataset.act;
    if (act === "open") void showOpenDialog();
    else if (act === "save") void saveProject();
    else if (act === "rename") void renameProject();
    else if (act === "delete") void deleteProject();
  });
  document.addEventListener("click", (ev) => {
    if (!detailsEl.open && !aboutEl.open) return;
    if (root.contains(ev.target)) return;
    closeMenu();
  });
  renderRecent();
  refreshTitle();
  return {
    refreshTitle,
    rememberCurrent,
    setEnabled(on) {
      root.classList.toggle("disabled", !on);
      for (const b of root.querySelectorAll("button, summary")) {
        if (b instanceof HTMLElement) {
          if (on) b.removeAttribute("aria-disabled");
          else b.setAttribute("aria-disabled", "true");
        }
      }
    }
  };
}

// src/bpp-api.ts
function parseBppJson(ret) {
  if (ret.startsWith("ERROR")) throw new Error(ret);
  try {
    return JSON.parse(ret);
  } catch {
    throw new Error(`Ongeldig JSON-antwoord van bppServer: ${ret.slice(0, 240)}`);
  }
}
async function bppListFloormapSections(invoke, token, buildingId2) {
  const ret = await invoke("API_ListFloormapSections", [token, buildingId2]);
  const data = parseBppJson(ret);
  return { sections: data.sections || [] };
}
function bppPhase1Enabled() {
  try {
    return localStorage.getItem("GEVELWERING_BPP_HTTP") !== "1";
  } catch {
    return true;
  }
}
async function bppListDrawingSubsections(invoke, token, sectionId) {
  const ret = await invoke("API_ListDrawingSubsections", [token, sectionId]);
  const data = parseBppJson(ret);
  return { subsections: data.subsections || [] };
}
async function bppListVrFacadeComponents(invoke, token, buildingId2, vrNr) {
  const ret = await invoke("API_ListVrFacadeComponents", [token, buildingId2, vrNr]);
  const data = parseBppJson(ret);
  return {
    ...data,
    eligible: data.eligible || []
  };
}
async function bppListMaterialAlternatives(invoke, token, materialId, limit = 6) {
  const ret = await invoke("API_ListMaterialAlternatives", [token, materialId, String(limit)]);
  const data = parseBppJson(ret);
  return { alternatives: data.alternatives || [], reason: data.reason };
}
async function bppSaveSubsectionMaterial(invoke, token, subsectionId, materialId) {
  const ret = await invoke("API_SaveSubsectionMaterial", [token, subsectionId, materialId]);
  return parseBppJson(ret);
}

// src/ga-labels.ts
function vgLabelFromNr(vgNr, fallback = "Verblijfsgebied") {
  const n = String(vgNr).trim();
  return n ? `VG ${n}` : fallback;
}
function vrLabelFromNr(vrNr, roomLabel) {
  const n = String(vrNr || "").trim();
  const room = (roomLabel || "").trim();
  if (n && room && room !== n) return `VR ${n} \xB7 ${room}`;
  if (n) return `VR ${n}`;
  return room || "Verblijfsruimte";
}
function formatVrVgLabel(vrNr, vgNr) {
  const vr = String(vrNr ?? "").trim();
  const vg = vgNr != null && String(vgNr).trim() !== "" && Number.isFinite(Number(vgNr)) ? String(Number(vgNr)) : "";
  if (vr && vg) return `VR ${vr} (VG ${vg})`;
  if (vr) return `VR ${vr}`;
  if (vg) return `VG ${vg}`;
  return "geen VG/VR";
}
function parseVgNrFromText(text) {
  const m = String(text || "").trim().match(/^VG\s+(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}
function levelLabel(hint) {
  switch (String(hint || "").toUpperCase()) {
    case "SOUTERRAIN":
      return "Souterrain";
    case "GROUND":
      return "Begane grond";
    case "BEL_ETAGE":
      return "Bel-etage";
    case "FIRST":
      return "1e verdieping";
    case "SECOND":
      return "2e verdieping";
    case "THIRD":
      return "3e verdieping";
    case "ROOF":
      return "Zolder";
    case "OTHER":
      return "Overig";
    default:
      return hint || "Overig";
  }
}
function isGroundLevel(hint) {
  return String(hint || "").toUpperCase() === "GROUND";
}
function sortByLabelAz(items, label) {
  return items.slice().sort((a, b) => label(a).localeCompare(label(b), void 0, { sensitivity: "base", numeric: true }));
}
function formatVrListLine(r, volumeM3) {
  const bits = [
    r.vr_nr ? `VR ${r.vr_nr}` : null,
    r.label || null,
    levelLabel(r.level_hint),
    r.area_m2 != null ? `${Number(r.area_m2).toFixed(2)} m\xB2` : null,
    volumeM3 != null ? `V=${Number(volumeM3).toFixed(1)} m\xB3` : null
  ].filter(Boolean);
  return bits.join(" \xB7 ");
}
function formatRoomSummary(r) {
  const bits = [
    r.vr_nr || r.vg_nr != null ? formatVrVgLabel(r.vr_nr, r.vg_nr) : null,
    r.label || null,
    levelLabel(r.level_hint),
    r.area_m2 != null ? `${Number(r.area_m2).toFixed(2)} m\xB2` : null
  ].filter(Boolean);
  return bits.join(" \xB7 ");
}

// src/gevel-coverage.ts
function gevelgroepNrOf(row) {
  const n = Number(row.gevelgroep_nr);
  return n === 2 || n === 3 ? n : 1;
}
function rowAreaM2(row) {
  const a = row.area_m2;
  return a != null && Number.isFinite(Number(a)) ? Number(a) : 0;
}
function isKozijnFacadeRole(role) {
  const r = String(role || "").trim();
  return r === "wood" || r === "glass";
}
function isComposeBooleanOp(op) {
  const o = String(op || "").toLowerCase();
  return o === "compose" || o === "difference";
}
function filterPool(rows, ori, groepNr) {
  const wantGg = groepNr === 2 || groepNr === 3 ? groepNr : 1;
  return rows.filter((r) => {
    if (String(r.orientatie || "").trim().toUpperCase() !== ori) return false;
    if (gevelgroepNrOf(r) !== wantGg) return false;
    if (String(r.quantity_kind || "area") === "length") return false;
    if (!String(r.material_id || "").trim()) return false;
    return rowAreaM2(r) > 0;
  });
}
function classifyHierarchy(pool) {
  const composes = pool.filter((r) => isComposeBooleanOp(r.boolean_op));
  const roleOpenings = pool.filter(
    (r) => !isComposeBooleanOp(r.boolean_op) && isKozijnFacadeRole(r.kozijn_role)
  );
  const plain = pool.filter(
    (r) => !isComposeBooleanOp(r.boolean_op) && !isKozijnFacadeRole(r.kozijn_role)
  );
  const primaryGevels = [];
  const secondaryGevels = [];
  const nestedPlain = [];
  if (plain.length) {
    const maxA = Math.max(...plain.map(rowAreaM2));
    for (const r of plain) {
      const a = rowAreaM2(r);
      if (a >= maxA - 0.021) primaryGevels.push(r);
      else if (a < maxA * 0.5) nestedPlain.push(r);
      else secondaryGevels.push(r);
    }
  }
  return {
    composes,
    primaryGevels,
    secondaryGevels,
    openings: [...roleOpenings, ...nestedPlain]
  };
}
function openingSumM2(parts) {
  return parts.openings.reduce((s, r) => s + rowAreaM2(r), 0);
}
function sameRow(a, b) {
  if (a === b) return true;
  const aid = String(a.id || "").trim();
  const bid = String(b.id || "").trim();
  if (aid && bid) return aid === bid;
  return rowAreaM2(a) === rowAreaM2(b) && String(a.kozijn_role || "") === String(b.kozijn_role || "") && String(a.material_id || "") === String(b.material_id || "") && String(a.boolean_op || "") === String(b.boolean_op || "");
}
function gevelContourStotaalM2(rows, ori, groepNr) {
  const pool = filterPool(rows, ori, groepNr);
  if (!pool.length) return 0;
  const parts = classifyHierarchy(pool);
  if (parts.composes.length) {
    let best = 0;
    const openingsInPool = openingSumM2(parts);
    for (const c of parts.composes) {
      const net = rowAreaM2(c);
      let plusMax = 0;
      let minusSum = 0;
      for (const part of c.constituents || []) {
        const a = part.area_m2 != null && Number.isFinite(Number(part.area_m2)) ? Number(part.area_m2) : 0;
        if (!(a > 0)) continue;
        if (String(part.sign || "") === "+") plusMax = Math.max(plusMax, a);
        else if (String(part.sign || "") === "-") minusSum += a;
      }
      const fromParts = plusMax > 0 ? plusMax : net + minusSum;
      const fromPoolOpenings = net + openingsInPool;
      best = Math.max(best, fromParts, fromPoolOpenings, net);
    }
    return Math.round(best * 100) / 100;
  }
  if (parts.primaryGevels.length) {
    return Math.round(Math.max(...parts.primaryGevels.map(rowAreaM2)) * 100) / 100;
  }
  return Math.round(Math.max(...pool.map(rowAreaM2)) * 100) / 100;
}
function gevelMaterialSumM2(rows, ori, groepNr) {
  const pool = filterPool(rows, ori, groepNr);
  if (!pool.length) return 0;
  const parts = classifyHierarchy(pool);
  if (parts.composes.length) {
    const sum = pool.reduce((s, r) => s + rowAreaM2(r), 0);
    return Math.round(sum * 100) / 100;
  }
  const openingSum = openingSumM2(parts);
  const primaryBruto = parts.primaryGevels.reduce((s, r) => s + rowAreaM2(r), 0);
  const secondary = parts.secondaryGevels.reduce((s, r) => s + rowAreaM2(r), 0);
  if (parts.primaryGevels.length && openingSum > 0) {
    const netPrimary = Math.max(0, primaryBruto - openingSum);
    return Math.round((netPrimary + openingSum + secondary) * 100) / 100;
  }
  return Math.round((primaryBruto + secondary + openingSum) * 100) / 100;
}
function gevelHierarchyEffectiveAreaM2(rows, ori, groepNr, row) {
  const base = rowAreaM2(row);
  if (!(base > 0)) return 0;
  if (isComposeBooleanOp(row.boolean_op) || isKozijnFacadeRole(row.kozijn_role)) {
    return Math.round(base * 100) / 100;
  }
  const pool = filterPool(rows, ori, groepNr);
  if (!pool.length) return Math.round(base * 100) / 100;
  const parts = classifyHierarchy(pool);
  if (parts.composes.length) {
    return Math.round(base * 100) / 100;
  }
  const openingSum = openingSumM2(parts);
  if (!(openingSum > 0) || !parts.primaryGevels.length) {
    return Math.round(base * 100) / 100;
  }
  const isOpening = parts.openings.some((o) => sameRow(o, row));
  if (isOpening) return Math.round(base * 100) / 100;
  const isPrimary = parts.primaryGevels.some((g) => sameRow(g, row));
  if (!isPrimary) return Math.round(base * 100) / 100;
  const primaryBruto = parts.primaryGevels.reduce((s, r) => s + rowAreaM2(r), 0);
  const share = primaryBruto > 0 ? base / primaryBruto : 1;
  const net = Math.max(0, base - openingSum * share);
  return Math.round(net * 100) / 100;
}
function gevelHierarchyApplies(rows, ori, groepNr) {
  const pool = filterPool(rows, ori, groepNr);
  if (!pool.length) return false;
  const parts = classifyHierarchy(pool);
  return !parts.composes.length && parts.primaryGevels.length > 0 && parts.openings.length > 0;
}
function gevelMaterialExceedsContour(rows, ori, groepNr, tol = 0.02) {
  const contour = gevelContourStotaalM2(rows, ori, groepNr);
  const sum = gevelMaterialSumM2(rows, ori, groepNr);
  return contour > 0 && sum > contour + tol;
}

// src/ga-orientation.ts
var ORIENTATIE_ALL = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"];
var ORIENTATIE_LABELS = {
  N: "N \xB7 noord",
  NO: "NO \xB7 noordoost",
  O: "O \xB7 oost",
  ZO: "ZO \xB7 zuidoost",
  Z: "Z \xB7 zuid",
  ZW: "ZW \xB7 zuidwest",
  W: "W \xB7 west",
  NW: "NW \xB7 noordwest"
};
function normalizeOrientatie(ori) {
  return String(ori || "").trim().toUpperCase();
}
function facadeOrientatie(f) {
  const fromTop = normalizeOrientatie(f.orientatie);
  if (fromTop) return fromTop;
  return normalizeOrientatie(f.analysis?.orientatie);
}
function resolveFacadeForOrientationVlak(v, vrFacades2) {
  const sid = (v.facade_subsection_id || "").trim();
  if (!sid) return null;
  const wantLen = v.quantity_kind === "length";
  if (wantLen) {
    return vrFacades2.find((f) => {
      const id = String(f.id || "").trim();
      const isSeal = Boolean(f.from_seal) || id.endsWith("#seal") || f.quantity_kind === "length";
      if (!isSeal) return false;
      const src = (f.source_subsection_id || "").trim();
      if (src && src === sid) return true;
      if (id === sid) return true;
      if (id.endsWith("#seal") && id.slice(0, -5) === sid) return true;
      return false;
    }) || null;
  }
  return vrFacades2.find((f) => {
    const id = String(f.id || "").trim();
    if (Boolean(f.from_seal) || id.endsWith("#seal") || f.quantity_kind === "length") {
      return false;
    }
    return id === sid;
  }) || vrFacades2.find((f) => f.id === sid) || null;
}
function groupOrientatie(g) {
  const fromGroup = normalizeOrientatie(g.orientatie);
  if (fromGroup) return fromGroup;
  for (const m of g.members) {
    const o = facadeOrientatie(m);
    if (o) return o;
  }
  return "";
}
function presentVlakOrientaties(vlakken2) {
  const s = /* @__PURE__ */ new Set();
  for (const v of vlakken2) {
    const o = normalizeOrientatie(v.orientatie);
    if (o) s.add(o);
  }
  return s;
}
function missingOrientations(expected, present) {
  return expected.filter((o) => !present.has(o));
}
function orientatieTakenOnVr(vlakken2, ori, exceptVlakId) {
  const wantOri = normalizeOrientatie(ori);
  if (!wantOri) return null;
  for (const v of vlakken2) {
    if (exceptVlakId && v.vlak_id === exceptVlakId) continue;
    if (normalizeOrientatie(v.orientatie) === wantOri) return v;
  }
  return null;
}
function materialOrientatieTaken(vlakken2, vrFacades2, materialGroupKey2, matKey, ori, exceptVlakId) {
  const wantOri = normalizeOrientatie(ori);
  for (const v of vlakken2) {
    if (exceptVlakId && v.vlak_id === exceptVlakId) continue;
    const f = resolveFacadeForOrientationVlak(v, vrFacades2);
    if (!f) continue;
    if (materialGroupKey2(f) !== matKey) continue;
    if (normalizeOrientatie(v.orientatie) === wantOri) return v;
  }
  return null;
}
function defaultOrientatieForMaterial(expected, vlakken2, vrFacades2, materialGroupKey2, matKey, exceptVlakId) {
  if (!expected.length) return "";
  if (!matKey) return expected[0];
  for (const c of expected) {
    if (!materialOrientatieTaken(vlakken2, vrFacades2, materialGroupKey2, matKey, c, exceptVlakId)) return c;
  }
  return "";
}
function resolveOrientatieForNewVlak(expected, currentOri, vlakken2, vrFacades2, materialGroupKey2, matKey, exceptVlakId) {
  const cur = normalizeOrientatie(currentOri);
  if (cur && expected.includes(cur)) {
    if (!matKey || !materialOrientatieTaken(vlakken2, vrFacades2, materialGroupKey2, matKey, cur, exceptVlakId)) {
      return cur;
    }
  }
  return defaultOrientatieForMaterial(expected, vlakken2, vrFacades2, materialGroupKey2, matKey, exceptVlakId);
}
function materialHasFreeOrientatie(expected, vlakken2, vrFacades2, materialGroupKey2, matKey, exceptVlakId) {
  if (!matKey) return expected.length > 0;
  return Boolean(defaultOrientatieForMaterial(expected, vlakken2, vrFacades2, materialGroupKey2, matKey, exceptVlakId));
}
function orisUsedForMaterial(vlakken2, vrFacades2, materialGroupKey2, matKey, exceptVlakId) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const v of vlakken2) {
    if (exceptVlakId && v.vlak_id === exceptVlakId) continue;
    const f = resolveFacadeForOrientationVlak(v, vrFacades2);
    if (!f || materialGroupKey2(f) !== matKey) continue;
    const o = normalizeOrientatie(v.orientatie);
    const label = o || "(geen)";
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}
function formatFacadeGroupOption(g) {
  const f = g.members[0];
  const code = (f.catalog_id || "").trim() || null;
  const name = (f.material_name || "").trim() || null;
  let base = code && name ? `${code} \xB7 ${name}` : code || name || (!g.ga_ready ? g.label?.trim() || "geen materiaal" : g.label?.trim() || "(zonder label)");
  const ori = groupOrientatie(g);
  if (ori) base += ` \xB7 ${ori}`;
  const n = g.members.length;
  if (n > 1) base += ` (${n}\xD7 opgeteld)`;
  if (g.quantity_kind === "length") {
    if (!/kier/i.test(base)) base += " \xB7 kierdichting";
    if (g.length_m != null) base += ` \xB7 l=${Number(g.length_m).toFixed(2)} m`;
  } else if (g.area_m2 != null) {
    base += ` \xB7 S=${Number(g.area_m2).toFixed(2)} m\xB2`;
  }
  return base;
}

// src/shared/bpp-session.ts
var MfaChallengeError = class extends Error {
  constructor(challenge) {
    super(
      challenge.needs_totp_setup ? "Authenticator koppelen vereist (Microsoft Authenticator)" : "Authenticator-code vereist"
    );
    __publicField(this, "challenge");
    this.name = "MfaChallengeError";
    this.challenge = challenge;
  }
};
var BppSession = class {
  constructor(opts) {
    __publicField(this, "ws", null);
    __publicField(this, "sessionId", null);
    __publicField(this, "auth", null);
    __publicField(this, "reqCounter", 0);
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "wsUrl");
    __publicField(this, "authKey");
    __publicField(this, "clientName");
    __publicField(this, "cb");
    /** Bumps on each connect() so stale open/close handlers are ignored. */
    __publicField(this, "connectGen", 0);
    __publicField(this, "reconnectTimer", null);
    /** Resolvers waiting for WebSocket OPEN (login while still connecting). */
    __publicField(this, "openWaiters", []);
    this.wsUrl = opts.wsUrl;
    this.authKey = opts.authKey;
    this.clientName = opts.clientName;
    this.cb = opts.callbacks;
  }
  nextRequestId(prefix) {
    this.reqCounter += 1;
    return `${prefix}_${this.reqCounter}_${Date.now()}`;
  }
  rejectAllPending(err) {
    for (const [id, waiter] of this.pending) {
      this.pending.delete(id);
      waiter.reject(err);
    }
  }
  rejectOpenWaiters(err) {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.reject(err);
    }
  }
  resolveOpenWaiters() {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.resolve();
    }
  }
  /** Wait until WS is OPEN (or fail). Used when user acts while still connecting. */
  async whenOpen(timeoutMs = 12e3) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      throw new Error(`WebSocket niet verbonden (${this.wsUrl}). Herlaad of start ./start.sh.`);
    }
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.openWaiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) this.openWaiters.splice(idx, 1);
        reject(new Error(`WebSocket timeout \u2014 geen verbinding met ${this.wsUrl}`));
      }, timeoutMs);
      this.openWaiters.push({ resolve, reject, timer });
    });
  }
  async send(type, payload, wantType) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        await this.whenOpen();
      } else {
        throw new Error(`WebSocket niet open (${this.wsUrl}). Herlaad of start ./start.sh.`);
      }
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket niet open (${this.wsUrl}). Herlaad of start ./start.sh.`);
    }
    const request_id = this.nextRequestId(type.replace(".", "_"));
    const env = { v: 1, type, request_id, payload };
    if (this.sessionId && type !== "session.open") env.session_id = this.sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(request_id, { resolve, reject, want: wantType });
      this.ws.send(JSON.stringify(env));
    });
  }
  onMessage(raw) {
    let env;
    try {
      env = JSON.parse(raw);
    } catch {
      return;
    }
    if (env.type === "session.opened") {
      const sid = typeof env.session_id === "string" && env.session_id || (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
      if (sid) this.sessionId = sid;
    }
    if (env.type === "error") {
      const waiter2 = this.pending.get(env.request_id);
      if (waiter2) {
        this.pending.delete(env.request_id);
        waiter2.reject(new Error(JSON.stringify(env.payload ?? env)));
      }
      return;
    }
    const waiter = this.pending.get(env.request_id);
    if (!waiter) return;
    if (env.type === waiter.want || env.type.endsWith(".completed") || env.type === "exec.completed") {
      if (env.type === "invoke.accepted" || env.type === "exec.accepted") return;
      this.pending.delete(env.request_id);
      waiter.resolve(env);
    }
  }
  async invokeString(target, args) {
    const inv = await this.send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
    const ret = inv.payload?.return;
    if (typeof ret !== "string") throw new Error(`Onverwacht antwoord van ${target}`);
    return ret;
  }
  async loadSharedApi() {
    await this.send(
      "exec.request",
      { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
      "exec.completed"
    );
    const bootRet = await this.invokeString("API_Bootstrap", []);
    if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap mislukt: ${bootRet}`);
  }
  applyAuth(info) {
    this.auth = info;
    this.storeAuth(info);
    this.cb.onLogin(info);
    return info;
  }
  async bootstrapAndLogin(username, password) {
    await this.whenOpen();
    await this.loadSharedApi();
    const ret = await this.invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    const parsed = JSON.parse(ret);
    if (parsed.needs_totp || parsed.needs_totp_setup) {
      if (!parsed.challenge) throw new Error("MFA challenge ontbreekt");
      throw new MfaChallengeError({
        needs_totp: parsed.needs_totp,
        needs_totp_setup: parsed.needs_totp_setup,
        challenge: parsed.challenge,
        username: parsed.username || username,
        totp_secret: parsed.totp_secret,
        otpauth_uri: parsed.otpauth_uri,
        authenticator_app: parsed.authenticator_app,
        authenticator_hint: parsed.authenticator_hint
      });
    }
    if (!parsed.ok || !parsed.token) throw new Error("Inloggen mislukt");
    return this.applyAuth({
      token: parsed.token,
      username: parsed.username || username,
      display_name: parsed.display_name || username
    });
  }
  async verifyTotp(challenge, code) {
    const ret = await this.invokeString("API_VerifyTotp", [challenge, code]);
    if (ret.startsWith("ERROR")) throw new Error(ret.replace(/^ERROR:\s*/, ""));
    const parsed = JSON.parse(ret);
    if (!parsed.ok || !parsed.token) throw new Error("Authenticator-bevestiging mislukt");
    return this.applyAuth({
      token: parsed.token,
      username: parsed.username || "admin",
      display_name: parsed.display_name || parsed.username || "admin"
    });
  }
  storeAuth(info) {
    storeAuth(this.authKey, info);
    void syncSessionCookie(info?.token ?? null);
  }
  loadStoredAuth() {
    return loadAuth(this.authKey);
  }
  logout() {
    this.auth = null;
    this.storeAuth(null);
    this.cb.onLogout();
  }
  /**
   * Open WS, session.open, loadSharedApi, validate stored token.
   * Page-specific `onReady` callback fires after successful restore or login prompt.
   */
  connect(opts) {
    const reconnectMs = opts?.reconnectMs ?? 1500;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const gen = ++this.connectGen;
    this.sessionId = null;
    this.rejectAllPending(new Error("WebSocket herverbindt"));
    this.rejectOpenWaiters(new Error("WebSocket herverbindt"));
    const prev = this.ws;
    this.ws = null;
    if (prev && (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CONNECTING)) {
      try {
        prev.close();
      } catch {
      }
    }
    this.cb.onStatus(`Verbinden met ${this.wsUrl}\u2026`, "busy");
    this.cb.onConnLed(false);
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    ws.addEventListener("open", () => {
      if (gen !== this.connectGen || this.ws !== ws) return;
      this.cb.onConnLed(true);
      this.resolveOpenWaiters();
      void (async () => {
        try {
          await this.send("session.open", { client: this.clientName }, "session.opened");
          if (gen !== this.connectGen) return;
          await this.loadSharedApi();
          if (gen !== this.connectGen) return;
          const stored = this.loadStoredAuth();
          if (stored?.token) {
            const ret = await this.invokeString("API_ValidateSession", [stored.token]);
            if (gen !== this.connectGen) return;
            if (ret.startsWith("ERROR")) {
              this.auth = null;
              this.storeAuth(null);
              this.cb.onLogout();
              this.cb.onStatus("Sessie verlopen \u2014 log in", "err");
            } else {
              this.auth = stored;
              this.cb.onLogin(stored);
              this.cb.onStatus("Gereed", "ok");
            }
          } else {
            this.cb.onLogout();
            this.cb.onStatus("Verbonden \u2014 log in", "ok");
          }
        } catch (err) {
          if (gen !== this.connectGen) return;
          this.cb.onStatus(err instanceof Error ? err.message : String(err), "err");
          if (!this.auth) this.cb.onLogout();
          return;
        }
        if (gen !== this.connectGen) return;
        try {
          await this.cb.onReady?.();
        } catch (err) {
          if (gen !== this.connectGen) return;
          this.cb.onStatus(err instanceof Error ? err.message : String(err), "err");
        }
      })();
    });
    ws.addEventListener("message", (ev) => {
      if (this.ws !== ws) return;
      this.onMessage(String(ev.data));
    });
    ws.addEventListener("close", () => {
      if (gen !== this.connectGen) return;
      if (this.ws === ws) this.ws = null;
      this.sessionId = null;
      this.rejectAllPending(new Error("WebSocket verbroken"));
      this.rejectOpenWaiters(new Error("WebSocket verbroken"));
      this.cb.onConnLed(false);
      this.cb.onStatus(
        reconnectMs > 0 ? `Verbinding verbroken \u2014 opnieuw verbinden\u2026 (${this.wsUrl})` : `Verbinding verbroken (${this.wsUrl})`,
        "err"
      );
      if (reconnectMs > 0) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (gen === this.connectGen) this.connect(opts);
        }, reconnectMs);
      }
    });
    ws.addEventListener("error", () => {
      if (gen !== this.connectGen || this.ws !== ws) return;
      this.cb.onStatus(`WebSocket-fout (${this.wsUrl})`, "err");
    });
  }
};

// src/ga.ts
function facadeSourceId(f) {
  const src = (f.source_subsection_id || "").trim();
  if (src) return src;
  const id = (f.id || "").trim();
  if (id.endsWith("#seal")) return id.slice(0, -5);
  return id;
}
function usedFacadePickIds() {
  const used = /* @__PURE__ */ new Set();
  for (const v of vlakken) {
    const sid = (v.facade_subsection_id || "").trim();
    if (!sid) continue;
    if (v.quantity_kind === "length") {
      const seal = vrFacades.find(
        (f) => f.from_seal && facadeSourceId(f) === sid
      );
      if (seal) {
        used.add(seal.id);
      } else if (sid.endsWith("#seal")) {
        used.add(sid);
      }
    } else {
      used.add(sid);
    }
  }
  return used;
}
function findFacadeForVlak(v) {
  const sid = (v.facade_subsection_id || "").trim();
  if (!sid) return null;
  if (v.quantity_kind === "length") {
    return vrFacades.find((f) => f.from_seal && facadeSourceId(f) === sid) || vrFacades.find((f) => f.id === sid && f.quantity_kind === "length") || null;
  }
  return vrFacades.find((f) => !f.from_seal && f.id === sid) || vrFacades.find((f) => !f.from_seal && facadeSourceId(f) === sid) || vrFacades.find((f) => f.id === sid) || vrFacades.find((f) => facadeSourceId(f) === sid) || null;
}
function vlakGevelgroepNr(v) {
  const fac = findFacadeForVlak(v);
  if (fac) return facadeGevelgroepNr(fac);
  const g = findGevelgroep(v.gevelgroep_id);
  return g ? gevelgroepNrOf2(g) : 1;
}
var AUTH_KEY = "app_gevelwering_engineer_auth";
var params = new URLSearchParams(location.search);
var connLedEl = document.getElementById("ga-conn-led");
var connStatusEl = document.getElementById("ga-conn-status");
var loginPanelEl = document.getElementById("ga-login-panel");
var loginForm = document.getElementById("ga-login-form");
var panelEl = document.getElementById("ga-panel");
var userLabelEl = document.getElementById("ga-user-label");
var logoutBtn = document.getElementById("ga-logout-btn");
var buildingForm = document.getElementById("ga-building-form");
var buildingIdEl = document.getElementById("ga-building-id");
var buildingMetaEl = document.getElementById("ga-building-meta");
var buildingMetaSummaryEl = document.getElementById("ga-building-meta-summary");
var projectIdBarEl = document.getElementById("ga-project-id-bar");
var queueBtn = document.getElementById("ga-queue-btn");
var queueListEl = document.getElementById("ga-queue-list");
var modelPanelEl = document.getElementById("ga-model-panel");
var floormapLinkEl = document.getElementById("ga-floormap-link");
var fileMenuRoot = document.getElementById("ga-file-menu");
var processDockEl = document.getElementById("ga-work-mode");
var processDockCollapseBtn = document.getElementById(
  "ga-process-dock-collapse"
);
var processDockDragEl = document.getElementById("ga-process-dock-drag");
var PROCESS_DOCK_POS_KEY = "app-gevelwering-process-dock-pos";
var PROCESS_DOCK_COLLAPSE_KEY = "app-gevelwering-process-dock-collapsed";
var SIDEBAR_WORK_MODE_KEY = "app-gevelwering-sidebar-work-mode";
var FM_LAST_SECTION_PREFIX = "app-gevelwering-fm-last-section:";
var variantForm = document.getElementById("ga-variant-form");
var variantListEl = document.getElementById("ga-variant-list");
var variantNameEl = document.getElementById("ga-variant-name");
var variantFunctieEl = document.getElementById("ga-variant-functie");
var variantLbEl = document.getElementById("ga-variant-lb");
var variantSpectrumEl = document.getElementById("ga-variant-spectrum");
var variantNewBtn = document.getElementById("ga-variant-new-btn");
var variantCloneBtn = document.getElementById("ga-variant-clone-btn");
var variantDelBtn = document.getElementById("ga-variant-del-btn");
var comparePickEl = document.getElementById("ga-compare-pick");
var compareBtn = document.getElementById("ga-compare-btn");
var compareWrapEl = document.getElementById("ga-compare-table-wrap");
var compareTableEl = document.getElementById("ga-compare-table");
var sectionPreviewCaptionEl = document.getElementById(
  "ga-section-preview-caption"
);
var sectionPreviewImgEl = document.getElementById("ga-section-preview-img");
var sectionPreviewEmptyEl = document.getElementById(
  "ga-section-preview-empty"
);
var sectionPreviewLinkEl = document.getElementById(
  "ga-section-preview-link"
);
var vgNewBtn = document.getElementById("ga-vg-new-btn");
var vgRoomEl = document.getElementById("ga-vg-room");
var roomPreviewEl = document.getElementById("ga-room-preview");
var vrHeadingEl = document.getElementById("ga-vr-heading");
var vrEmptyHintEl = document.getElementById("ga-vr-empty-hint");
var vrEditPreviewEl = document.getElementById("ga-vr-edit-preview");
var vrHoogteEl = document.getElementById("ga-vr-hoogte");
var vrT0El = document.getElementById("ga-vr-t0");
var vrAddBtn = document.getElementById("ga-vr-add-btn");
var vgListEl = document.getElementById("ga-vg-list");
var vrListEl = document.getElementById("ga-vr-list");
var vrEditForm = document.getElementById("ga-vr-edit-form");
var vrEditNameEl = document.getElementById("ga-vr-edit-name");
var vrEditVloerEl = document.getElementById("ga-vr-edit-vloer");
var vrEditHoogteEl = document.getElementById("ga-vr-edit-hoogte");
var vrEditVolumeEl = document.getElementById("ga-vr-edit-volume");
var vrEditT0El = document.getElementById("ga-vr-edit-t0");
var vrDelBtn = document.getElementById("ga-vr-del-btn");
var vgDelBtn = document.getElementById("ga-vg-del-btn");
var vlakForm = document.getElementById("ga-vlak-form");
var vlakNameEl = document.getElementById("ga-vlak-name");
var vlakFacadeEl = document.getElementById("ga-vlak-facade");
var vlakFacadeHintEl = document.getElementById("ga-vlak-facade-hint");
var vlakFacadePreviewEl = document.getElementById("ga-vlak-facade-preview");
var vlakComponentFieldset = document.getElementById("ga-vlak-component-fieldset");
var vlakPropsGateHintEl = document.getElementById("ga-vlak-props-gate-hint");
var vlakFacadeLabelEl = document.getElementById("ga-vlak-facade-label");
var vlakFacadeLinkedEl = document.getElementById("ga-vlak-facade-linked");
var vlakFacadeComposeEl = document.getElementById("ga-vlak-facade-compose");
var vlakInventoryEl = document.getElementById("ga-vlak-inventory");
var vlakCoverageEl = document.getElementById("ga-vlak-coverage");
var vlakCoveragePctEl = document.getElementById("ga-vlak-coverage-pct");
var vlakCoverageBarEl = document.getElementById("ga-vlak-coverage-bar");
var vlakCoverageMetaEl = document.getElementById("ga-vlak-coverage-meta");
var vlakAreaEl = document.getElementById("ga-vlak-area");
var vlakQtyLabelEl = document.getElementById("ga-vlak-qty-label");
var vlakOrientatieEl = document.getElementById("ga-vlak-orientatie");
var vlakOrientatieDisplayEl = document.getElementById("ga-vlak-orientatie-display");
var vlakPickGroepEl = document.getElementById("ga-vlak-pick-groep");
var vlakPickGroepHintEl = document.getElementById("ga-vlak-pick-groep-hint");
var vlakClEl = document.getElementById("ga-vlak-cl");
var vlakCgEl = document.getElementById("ga-vlak-cg");
var vlakClDownBtn = document.getElementById("ga-vlak-cl-down");
var vlakClUpBtn = document.getElementById("ga-vlak-cl-up");
var vlakCgDownBtn = document.getElementById("ga-vlak-cg-down");
var vlakCgUpBtn = document.getElementById("ga-vlak-cg-up");
var vlakCorrResetBtn = document.getElementById("ga-vlak-corr-reset");
var vlakCorrHintEl = document.getElementById("ga-vlak-corr-hint");
var vlakOriStatusEl = document.getElementById("ga-vlak-ori-status");
var vlakEditHintEl = document.getElementById("ga-vlak-edit-hint");
var vlakGakEl = document.getElementById("ga-vlak-gak");
var vlakSaveBtn = document.getElementById("ga-vlak-save-btn");
var vlakListToVlakBtn = document.getElementById(
  "ga-vlak-list-to-vlak-btn"
);
var vlakCancelBtn = document.getElementById("ga-vlak-cancel-btn");
var vlakListEl = document.getElementById("ga-vlak-list");
var vlakPickEl = document.getElementById("ga-vlak-pick");
var copyVlakkenBarEl = document.getElementById("ga-copy-vlakken-bar");
var copyVlakkenCbEl = document.getElementById("ga-copy-vlakken-cb");
var copyVlakkenControlsEl = document.getElementById(
  "ga-copy-vlakken-controls"
);
var copyVlakkenSourceEl = document.getElementById(
  "ga-copy-vlakken-source"
);
var copyVlakkenAnchorEl = document.getElementById(
  "ga-copy-vlakken-anchor"
);
var copyVlakkenBtnEl = document.getElementById("ga-copy-vlakken-btn");
var recalcBtn = document.getElementById("ga-recalc-btn");
var analyzeBtn = document.getElementById("ga-analyze-btn");
var analyzePanelEl = document.getElementById("ga-analyze-panel");
var analyzeHintEl = document.getElementById("ga-analyze-hint");
var analyzeCausesEl = document.getElementById("ga-analyze-causes");
var analyzeSuggestionsEl = document.getElementById("ga-analyze-suggestions");
var reportBtn = document.getElementById("ga-report-btn");
var reportInboxBtn = document.getElementById("ga-report-inbox-btn");
var reportKindEl = document.getElementById("ga-report-kind");
var reportHintEl = document.getElementById("ga-report-hint");
var vrResultsHintEl = document.getElementById("ga-vr-results-hint");
var vrResultsWerknummerEl = document.getElementById("ga-vr-results-werknummer");
var resSEl = document.getElementById("ga-res-s");
var resRpEl = document.getElementById("ga-res-rp");
var resRpLabelEl = document.getElementById("ga-res-rp-label");
var resDEl = document.getElementById("ga-res-d");
var resDLabelEl = document.getElementById("ga-res-d-label");
var resGaEl = document.getElementById("ga-res-ga");
var resLbiEl = document.getElementById("ga-res-lbi");
var resGakEl = document.getElementById("ga-res-gak");
var resLbikEl = document.getElementById("ga-res-lbik");
var resToetsEl = document.getElementById("ga-res-toets");
var buildingId = params.get("building_id") || "";
var pendingImportSubId = (params.get("subsection_id") || "").trim();
var pendingImportVgNr = (params.get("vg_nr") || "").trim();
var pendingImportVrNr = (params.get("vr_nr") || "").trim();
var variants = [];
var selectedVariantId = params.get("variant_id");
var vgs = [];
var selectedVgId = (params.get("vg_id") || "").trim() || null;
var vrs = [];
var selectedVrId = (params.get("vr_id") || "").trim() || null;
var selectedVlakId = null;
var vlakPickSyncLock = false;
var vlakPickValue = "";
var vlakken = [];
var gevelgroepen = [];
var selectedGevelgroepId = null;
var selectedPickGroepNr = 1;
var vrOriPresentById = /* @__PURE__ */ new Map();
var vrVlakkenById = /* @__PURE__ */ new Map();
var vrCopyLabelById = /* @__PURE__ */ new Map();
var freshResultVrIds = /* @__PURE__ */ new Set();
var vrVoldoet = /* @__PURE__ */ new Map();
var resultsDirty = false;
var lastFreshGaResult = null;
var calcRevealEpoch = 0;
var freeRooms = [];
var floormapRoomsById = /* @__PURE__ */ new Map();
var floormapSectionsById = /* @__PURE__ */ new Map();
var sectionPreviewUrlCache = /* @__PURE__ */ new Map();
var sectionPreviewPdfByDoc = /* @__PURE__ */ new Map();
var sectionPreviewPdfLoads = /* @__PURE__ */ new Map();
var sectionPreviewBuildingId = "";
var sectionPreviewReq = 0;
var SECTION_PREVIEW_W = 480;
var SECTION_PREVIEW_H = 360;
var vrFacades = [];
var allLinks = [];
var linkedBySub = /* @__PURE__ */ new Map();
var linkedSubIds = /* @__PURE__ */ new Set();
var compareSelectedIds = /* @__PURE__ */ new Set();
var buildingLabel = "";
var buildingExternalRef = "";
var projectMenu = null;
function setConn(state, text) {
  connLedEl.className = `conn-led ${state === "ok" ? "connected" : state === "busy" ? "busy" : "disconnected"}`;
  connStatusEl.textContent = text;
}
function showLogin() {
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
  if (fileMenuRoot) fileMenuRoot.hidden = true;
  projectMenu?.setEnabled(false);
  syncProcessDockVisibility();
}
function showPanel(info) {
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
  if (fileMenuRoot) fileMenuRoot.hidden = false;
  projectMenu?.setEnabled(true);
  projectMenu?.refreshTitle();
  syncProcessDockVisibility();
}
var session = new BppSession({
  wsUrl: resolveBppWsUrl(),
  authKey: AUTH_KEY,
  clientName: "app-gevelwering-ga",
  callbacks: {
    onStatus: (text, kind) => setConn(kind, text),
    onConnLed: (connected) => {
      connLedEl.className = `conn-led ${connected ? "connected" : "disconnected"}`;
    },
    onLogin: (info) => showPanel(info),
    onLogout: () => showLogin(),
    onReady: async () => {
      if (session.auth && buildingId) await openBuilding(buildingId);
    }
  }
});
function invokeString(target, args) {
  return session.invokeString(target, args);
}
function auth() {
  return session.auth;
}
async function apiGet(url) {
  const res = await fetch(url, { credentials: "include", headers: apiAuthHeaders(auth().token) });
  const body = await res.json();
  if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}
async function apiPost(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...apiAuthHeaders(auth().token), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}
function parseJsonOk2(ret) {
  if (ret.startsWith("ERROR")) throw new Error(ret);
  return JSON.parse(ret);
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function readLastFloormapSectionId(bid) {
  if (!bid) return "";
  try {
    return sessionStorage.getItem(`${FM_LAST_SECTION_PREFIX}${bid.trim().toLowerCase()}`)?.trim() || "";
  } catch {
    return "";
  }
}
function currentFlowVr() {
  if (selectedVrId) {
    const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
    const room = vr ? roomFromVr(vr) : null;
    const nr = vrNrForVrId(selectedVrId) || normalizeFlowVrNr(room?.vr_nr);
    if (nr) {
      const vg = room?.vg_nr != null && Number.isFinite(Number(room.vg_nr)) ? Number(room.vg_nr) : null;
      return { vr_nr: nr, vg_nr: vg };
    }
  }
  const fromUrl = normalizeFlowVrNr(params.get("vr_nr"));
  if (fromUrl) {
    const vgRaw = Number(params.get("vg_nr") || NaN);
    return {
      vr_nr: fromUrl,
      vg_nr: Number.isFinite(vgRaw) && vgRaw >= 1 ? vgRaw : null
    };
  }
  return buildingId ? readFlowVr(buildingId) : null;
}
function floormapHref(workMode) {
  const q = new URLSearchParams();
  if (buildingId) q.set("building_id", buildingId);
  const sectionId = readLastFloormapSectionId(buildingId);
  if (sectionId) q.set("section_id", sectionId);
  if (workMode) q.set("work_mode", workMode);
  const flow = currentFlowVr();
  if (flow?.vr_nr) {
    q.set("vr_nr", flow.vr_nr);
    if (flow.vg_nr != null) q.set("vg_nr", String(flow.vg_nr));
    if (buildingId) persistFlowVr(buildingId, flow.vr_nr, flow.vg_nr);
  }
  const qs = q.toString();
  return qs ? `/floormap.html?${qs}` : "/floormap.html";
}
function syncFloormapLink() {
  floormapLinkEl.href = floormapHref();
}
function syncProcessDockVisibility() {
  if (!processDockEl) return;
  const show = !panelEl.classList.contains("hidden");
  processDockEl.classList.toggle("hidden", !show);
  if (show) processDockEl.removeAttribute("hidden");
  else processDockEl.setAttribute("hidden", "");
}
function applyProcessDockCollapsed(collapsed) {
  if (!processDockEl) return;
  processDockEl.classList.toggle("is-collapsed", collapsed);
  if (processDockCollapseBtn) {
    processDockCollapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    processDockCollapseBtn.textContent = collapsed ? "+" : "\u2212";
    processDockCollapseBtn.title = collapsed ? "Uitklappen" : "Inklappen";
  }
  try {
    sessionStorage.setItem(PROCESS_DOCK_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
  }
}
function restoreProcessDockLayout() {
  if (!processDockEl) return;
  try {
    if (sessionStorage.getItem(PROCESS_DOCK_COLLAPSE_KEY) === "1") {
      applyProcessDockCollapsed(true);
    }
    const raw = sessionStorage.getItem(PROCESS_DOCK_POS_KEY);
    if (raw) {
      const pos = JSON.parse(raw);
      if (Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
        processDockEl.style.left = `${Math.max(8, Number(pos.left))}px`;
        processDockEl.style.top = `${Math.max(8, Number(pos.top))}px`;
        processDockEl.style.right = "auto";
      }
    }
  } catch {
  }
}
function initProcessDockChrome() {
  restoreProcessDockLayout();
  syncProcessDockVisibility();
  processDockCollapseBtn?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const next = !processDockEl?.classList.contains("is-collapsed");
    applyProcessDockCollapsed(next);
  });
  if (!processDockEl || !processDockDragEl) return;
  let drag = null;
  processDockDragEl.addEventListener("pointerdown", (ev) => {
    if (ev.target?.closest?.("button")) return;
    const rect = processDockEl.getBoundingClientRect();
    drag = { ox: ev.clientX, oy: ev.clientY, sl: rect.left, st: rect.top };
    processDockDragEl.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  processDockDragEl.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const left = Math.min(window.innerWidth - 48, Math.max(8, drag.sl + (ev.clientX - drag.ox)));
    const top = Math.min(window.innerHeight - 40, Math.max(8, drag.st + (ev.clientY - drag.oy)));
    processDockEl.style.left = `${left}px`;
    processDockEl.style.top = `${top}px`;
    processDockEl.style.right = "auto";
  });
  const endDrag = (ev) => {
    if (!drag) return;
    drag = null;
    try {
      processDockDragEl.releasePointerCapture(ev.pointerId);
    } catch {
    }
    const left = parseFloat(processDockEl.style.left || "0");
    const top = parseFloat(processDockEl.style.top || "0");
    try {
      sessionStorage.setItem(PROCESS_DOCK_POS_KEY, JSON.stringify({ left, top }));
    } catch {
    }
  };
  processDockDragEl.addEventListener("pointerup", endDrag);
  processDockDragEl.addEventListener("pointercancel", endDrag);
  processDockEl.addEventListener("click", (ev) => {
    const btn = ev.target?.closest?.("button[data-mode]");
    if (!btn || !processDockEl.contains(btn)) return;
    const mode = btn.dataset.mode;
    if (mode === "ga") {
      setConn("ok", "Je bent al op GA-berekening");
      return;
    }
    if (mode !== "picklist" && mode !== "draw" && mode !== "assign" && mode !== "compose") {
      return;
    }
    if (!buildingId) {
      setConn("err", "Open eerst een project om terug te gaan naar de geveltekening");
      return;
    }
    try {
      sessionStorage.setItem(SIDEBAR_WORK_MODE_KEY, mode);
    } catch {
    }
    setConn("busy", "Terug naar geveltekening\u2026");
    window.location.assign(floormapHref(mode));
  });
}
async function refreshLinks() {
  if (!buildingId || !auth()) return;
  const ret = await invokeString("API_ListLinkedSubsections", [auth().token, buildingId]);
  const data = parseJsonOk2(ret);
  allLinks = data.links || [];
  rebuildLinkedForSelectedVariant();
}
function rebuildLinkedForSelectedVariant() {
  linkedBySub = /* @__PURE__ */ new Map();
  linkedSubIds = /* @__PURE__ */ new Set();
  for (const l of allLinks) {
    if (!l?.subsection_id) continue;
    if (selectedVariantId && l.variant_id && l.variant_id !== selectedVariantId) continue;
    linkedBySub.set(l.subsection_id, l);
    linkedSubIds.add(l.subsection_id);
  }
}
function roomsForVg(vgId) {
  const out = [];
  for (const l of allLinks) {
    if (l.verblijfsgebied_id !== vgId) continue;
    const room = floormapRoomsById.get(l.subsection_id);
    if (room) out.push(room);
  }
  return out;
}
function vgNrForVg(vgId, omschrijving) {
  const fromTitle = parseVgNrFromText(omschrijving || "");
  if (fromTitle != null) return fromTitle;
  const rooms = roomsForVg(vgId);
  const nrs = [...new Set(rooms.map((r) => r.vg_nr != null ? Number(r.vg_nr) : null).filter((n) => n != null))];
  if (nrs.length === 1) return nrs[0];
  if (nrs.length > 1) {
    const g = vgs.find((x) => x.verblijfsgebied_id === vgId);
    const fromLabel = parseVgNrFromText(g?.omschrijving || "");
    if (fromLabel != null) return fromLabel;
  }
  const fromRoom = rooms.find((r) => r.vg_nr != null)?.vg_nr;
  if (fromRoom != null) return Number(fromRoom);
  return null;
}
function floormapRoomsForVg(vgId) {
  const want = vgNrForVg(vgId, vgs.find((g) => g.verblijfsgebied_id === vgId)?.omschrijving);
  return roomsForVg(vgId).filter((r) => {
    if (want == null || r.vg_nr == null) return true;
    return Number(r.vg_nr) === want;
  });
}
function vrsMatchingFloormapVg(vgId, list) {
  const want = vgNrForVg(vgId, vgs.find((g) => g.verblijfsgebied_id === vgId)?.omschrijving);
  if (want == null) return list;
  return list.filter((vr) => {
    const room = floormapRoomsById.get(vr.subsection_id);
    if (!room || room.vg_nr == null) return true;
    return Number(room.vg_nr) === want;
  });
}
function floorLevelForVg(vgId) {
  const rooms = roomsForVg(vgId);
  if (!rooms.length) return null;
  return rooms[0].level_hint || null;
}
function vgDisplayTitle(g) {
  const nr = vgNrForVg(g.verblijfsgebied_id, g.omschrijving);
  return nr != null ? vgLabelFromNr(nr) : g.omschrijving;
}
function findVgIdForNr(vgNr) {
  const n = Number(vgNr);
  if (!Number.isFinite(n)) return null;
  for (const g of vgs) {
    if (parseVgNrFromText(g.omschrijving) === n) return g.verblijfsgebied_id;
  }
  for (const g of vgs) {
    if (floormapRoomsForVg(g.verblijfsgebied_id).some((r) => Number(r.vg_nr) === n)) {
      return g.verblijfsgebied_id;
    }
  }
  for (const g of vgs) {
    if (vgNrForVg(g.verblijfsgebied_id, g.omschrijving) === n) return g.verblijfsgebied_id;
  }
  return null;
}
async function ensureVgForFloormapNr(vgNr) {
  if (!auth()?.token || !selectedVariantId) return null;
  const existing = findVgIdForNr(vgNr);
  if (existing) return existing;
  const label = vgLabelFromNr(vgNr);
  const ret = await invokeString("API_CreateEmptyVerblijfsgebied", [
    auth().token,
    selectedVariantId,
    label
  ]);
  const data = parseJsonOk2(ret);
  const id = (data.verblijfsgebied_id || "").trim();
  if (!id) return null;
  vgs.push({ verblijfsgebied_id: id, omschrijving: label, sort_order: vgs.length, vr_count: 0 });
  vgs = sortByLabelAz(vgs, vgDisplayTitle);
  return id;
}
async function syncVrVgMembershipFromFloormap() {
  if (!auth()?.token || !selectedVariantId || floormapRoomsById.size === 0 || !vgs.length) {
    return 0;
  }
  const pending = [];
  for (const g of vgs) {
    const ret = await invokeString("API_ListVerblijfsruimten", [
      auth().token,
      g.verblijfsgebied_id
    ]);
    const data = parseJsonOk2(ret);
    for (const vr of data.verblijfsruimten || []) {
      const room = floormapRoomsById.get(vr.subsection_id);
      if (!room || room.vg_nr == null) continue;
      const wantVgNr = Number(room.vg_nr);
      if (!Number.isFinite(wantVgNr)) continue;
      const target = findVgIdForNr(wantVgNr);
      if (target === g.verblijfsgebied_id) continue;
      pending.push({ vrId: vr.verblijfsruimte_id, fromVgId: g.verblijfsgebied_id, wantVgNr });
    }
  }
  if (!pending.length) return 0;
  let moved = 0;
  for (const row of pending) {
    let targetId = findVgIdForNr(row.wantVgNr);
    if (!targetId) targetId = await ensureVgForFloormapNr(row.wantVgNr);
    if (!targetId || targetId === row.fromVgId) continue;
    const ret = await invokeString("API_MoveVerblijfsruimte", [
      auth().token,
      row.vrId,
      targetId
    ]);
    if (ret.startsWith("ERROR")) {
      console.warn("sync VR\u2192VG failed", row.vrId, ret);
      continue;
    }
    moved++;
  }
  if (moved > 0) {
    await refreshLinks();
    const vgRet = await invokeString("API_ListVerblijfsgebieden", [
      auth().token,
      selectedVariantId
    ]);
    const vgData = parseJsonOk2(vgRet);
    vgs = sortByLabelAz(vgData.verblijfsgebieden || [], vgDisplayTitle);
  }
  return moved;
}
function gaSelStorageKey(bid) {
  return `app-gevelwering-ga-sel:${bid}`;
}
function syncGaLocation() {
  const url = new URL(location.href);
  if (buildingId) url.searchParams.set("building_id", buildingId);
  else url.searchParams.delete("building_id");
  if (selectedVariantId) url.searchParams.set("variant_id", selectedVariantId);
  else url.searchParams.delete("variant_id");
  if (selectedVgId) url.searchParams.set("vg_id", selectedVgId);
  else url.searchParams.delete("vg_id");
  if (selectedVrId) url.searchParams.set("vr_id", selectedVrId);
  else url.searchParams.delete("vr_id");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
function rememberGaSelection() {
  if (!buildingId) return;
  try {
    const payload = {
      variantId: selectedVariantId,
      vgId: selectedVgId,
      vrId: selectedVrId
    };
    const raw = JSON.stringify(payload);
    localStorage.setItem(gaSelStorageKey(buildingId), raw);
    sessionStorage.setItem(gaSelStorageKey(buildingId), raw);
  } catch {
  }
  if (selectedVrId) {
    const nr = vrNrForVrId(selectedVrId);
    if (nr) {
      const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
      const room = vr ? roomFromVr(vr) : null;
      persistFlowVr(
        buildingId,
        nr,
        room?.vg_nr != null && Number.isFinite(Number(room.vg_nr)) ? Number(room.vg_nr) : null
      );
    }
  }
  syncGaLocation();
}
function readRememberedGaSelection() {
  if (!buildingId) return null;
  let fromStore = null;
  try {
    const raw = localStorage.getItem(gaSelStorageKey(buildingId)) || sessionStorage.getItem(gaSelStorageKey(buildingId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") fromStore = parsed;
    }
  } catch {
  }
  const urlVariant = (params.get("variant_id") || "").trim() || null;
  const urlVg = (params.get("vg_id") || "").trim() || null;
  const urlVr = (params.get("vr_id") || "").trim() || null;
  if (!urlVariant && !urlVg && !urlVr && !fromStore) return null;
  return {
    variantId: urlVariant || fromStore?.variantId || null,
    vgId: urlVg || fromStore?.vgId || null,
    vrId: urlVr || fromStore?.vrId || null
  };
}
async function findVgIdForVr(vrId) {
  if (!auth() || !vrId || !vgs.length) return null;
  for (const g of vgs) {
    const ret = await invokeString("API_ListVerblijfsruimten", [auth().token, g.verblijfsgebied_id]);
    if (typeof ret === "string" && ret.startsWith("ERROR")) continue;
    try {
      const data = parseJsonOk2(ret);
      if ((data.verblijfsruimten || []).some((r) => r.verblijfsruimte_id === vrId)) {
        return g.verblijfsgebied_id;
      }
    } catch {
    }
  }
  return null;
}
function vgVrNrSummary(vgId) {
  const rooms = floormapRoomsForVg(vgId);
  const nrs = rooms.map((r) => String(r.vr_nr || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, void 0, { numeric: true }));
  if (!nrs.length) return "";
  return nrs.map((n) => /^VR/i.test(n) ? n : `VR${n}`).join(", ");
}
function roomFromVr(vr) {
  return floormapRoomsById.get(vr.subsection_id) || null;
}
function labelsFromRoom(r) {
  if (r.vg_nr == null) {
    throw new Error("Deze plattegrondruimte heeft geen VG-nummer \u2014 vul VG/VR in op de plattegrond");
  }
  if (!r.vr_nr) {
    throw new Error("Deze plattegrondruimte heeft geen VR-nummer \u2014 vul VG/VR in op de plattegrond");
  }
  return {
    vgName: vgLabelFromNr(r.vg_nr),
    vrName: vrLabelFromNr(r.vr_nr, r.label)
  };
}
function selectedFreeRoom() {
  const id = (vgRoomEl.value || "").trim();
  if (!id) return null;
  return freeRooms.find((r) => r.id === id) || floormapRoomsById.get(id) || null;
}
function eligibleFreeRooms() {
  const withNr = freeRooms.filter((r) => r.vg_nr != null && r.vr_nr);
  if (!selectedVgId) return withNr;
  const floor = floorLevelForVg(selectedVgId);
  const vgNr = vgNrForVg(selectedVgId);
  return withNr.filter((r) => {
    if (floor && r.level_hint !== floor) return false;
    if (vgNr != null && r.vg_nr != null && Number(r.vg_nr) !== vgNr) return false;
    return true;
  });
}
function allFreeNumberedRooms() {
  return freeRooms.filter((r) => r.vg_nr != null && r.vr_nr);
}
function roomFitsSelectedVg(room) {
  if (!room || !selectedVgId) return false;
  const floor = floorLevelForVg(selectedVgId);
  const vgNr = vgNrForVg(selectedVgId);
  if (floor && room.level_hint !== floor) return false;
  if (vgNr != null && room.vg_nr != null && Number(room.vg_nr) !== vgNr) return false;
  return true;
}
function clearSectionPreviewCaches(bid) {
  if (sectionPreviewBuildingId === bid) return;
  sectionPreviewUrlCache.clear();
  sectionPreviewPdfByDoc.clear();
  sectionPreviewPdfLoads.clear();
  sectionPreviewBuildingId = bid;
}
function toSectionPreviewMeta(sec) {
  const id = String(sec.id || "").trim();
  const document_id = String(sec.document_id || "").trim();
  if (!id || !document_id) return null;
  const viewRaw = sec.view_rotate ?? sec.viewRotate ?? 0;
  return {
    id,
    document_id,
    page_index: Math.max(0, Number(sec.page_index) || 0),
    label: String(sec.label || "").trim(),
    region_kind: String(sec.region_kind || "").toUpperCase(),
    x_min: Number(sec.x_min) || 0,
    y_min: Number(sec.y_min) || 0,
    x_max: Number(sec.x_max) || 1,
    y_max: Number(sec.y_max) || 1,
    view_rotate: Number(viewRaw) || 0
  };
}
function ensureGaPdfjsWorker() {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
}
async function loadSectionPreviewPdf(documentId) {
  ensureGaPdfjsWorker();
  const cached = sectionPreviewPdfByDoc.get(documentId);
  if (cached) return cached;
  let pending = sectionPreviewPdfLoads.get(documentId);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(`/api/drawings/download?document_id=${encodeURIComponent(documentId)}`, {
        credentials: "include",
        headers: apiAuthHeaders(auth().token)
      });
      if (!res.ok) throw new Error(`PDF laden mislukt (HTTP ${res.status})`);
      const buf = await res.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: buf }).promise;
      sectionPreviewPdfByDoc.set(documentId, doc);
      sectionPreviewPdfLoads.delete(documentId);
      return doc;
    })();
    sectionPreviewPdfLoads.set(documentId, pending);
  }
  return pending;
}
async function sectionPreviewDataUrl(sec) {
  const hit = sectionPreviewUrlCache.get(sec.id);
  if (hit) return hit;
  if (!auth()?.token) return null;
  try {
    const pdf = await loadSectionPreviewPdf(sec.document_id);
    const pageNum = Math.min(pdf.numPages, Math.max(1, sec.page_index + 1));
    const page = await pdf.getPage(pageNum);
    const pageRotate = typeof page.rotate === "number" ? page.rotate : 0;
    const viewRotate = Number(sec.view_rotate) || 0;
    const rotation = (pageRotate + viewRotate) % 360;
    const baseVp = page.getViewport({ scale: 1, rotation });
    const cropWNorm = Math.max(1e-3, sec.x_max - sec.x_min);
    const cropPxW = cropWNorm * baseVp.width;
    const renderScale = Math.min(2.2, Math.max(1, SECTION_PREVIEW_W * 1.5 / cropPxW));
    const viewport = page.getViewport({ scale: renderScale, rotation });
    const off = document.createElement("canvas");
    off.width = Math.floor(viewport.width);
    off.height = Math.floor(viewport.height);
    const octx = off.getContext("2d");
    if (!octx) return null;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    await page.render({ canvasContext: octx, viewport }).promise;
    const x0 = Math.floor(sec.x_min * off.width);
    const y0 = Math.floor(sec.y_min * off.height);
    const x1 = Math.ceil(sec.x_max * off.width);
    const y1 = Math.ceil(sec.y_max * off.height);
    const cw = Math.max(1, x1 - x0);
    const ch = Math.max(1, y1 - y0);
    const thumb = document.createElement("canvas");
    thumb.width = SECTION_PREVIEW_W;
    thumb.height = SECTION_PREVIEW_H;
    const tctx = thumb.getContext("2d");
    if (!tctx) return null;
    tctx.fillStyle = "#fff";
    tctx.fillRect(0, 0, SECTION_PREVIEW_W, SECTION_PREVIEW_H);
    const fit = Math.min(SECTION_PREVIEW_W / cw, SECTION_PREVIEW_H / ch);
    const dw = cw * fit;
    const dh = ch * fit;
    tctx.drawImage(
      off,
      x0,
      y0,
      cw,
      ch,
      (SECTION_PREVIEW_W - dw) / 2,
      (SECTION_PREVIEW_H - dh) / 2,
      dw,
      dh
    );
    const dataUrl = thumb.toDataURL("image/jpeg", 0.85);
    sectionPreviewUrlCache.set(sec.id, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn("GA section preview failed", sec.id, err);
    return null;
  }
}
function currentSectionForPreview() {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  const room = vr ? roomFromVr(vr) : selectedFreeRoom();
  if (!room?.section_id) {
    return {
      section: null,
      caption: selectedVrId ? "Geselecteerde VR heeft geen plattegrondsectie" : "Selecteer een VR of vrije ruimte"
    };
  }
  const section = floormapSectionsById.get(room.section_id) || null;
  const roomBit = room.vr_nr ? vrLabelFromNr(room.vr_nr) : room.label || "ruimte";
  const secBit = section?.label || room.section_label || "sectie";
  return {
    section,
    caption: section ? `${secBit} \xB7 ${roomBit}` : `Sectie niet geladen \xB7 ${roomBit}`
  };
}
function updateSectionPreview() {
  if (!sectionPreviewImgEl || !sectionPreviewEmptyEl || !sectionPreviewCaptionEl) return;
  const { section, caption } = currentSectionForPreview();
  sectionPreviewCaptionEl.textContent = caption;
  const req = ++sectionPreviewReq;
  if (sectionPreviewLinkEl) {
    if (section && buildingId) {
      sectionPreviewLinkEl.href = `/floormap.html?building_id=${encodeURIComponent(buildingId)}&section_id=${encodeURIComponent(section.id)}`;
      sectionPreviewLinkEl.classList.remove("hidden");
    } else {
      sectionPreviewLinkEl.classList.add("hidden");
    }
  }
  if (!section) {
    sectionPreviewImgEl.hidden = true;
    sectionPreviewImgEl.removeAttribute("src");
    sectionPreviewImgEl.classList.remove("is-loading");
    sectionPreviewEmptyEl.textContent = caption;
    sectionPreviewEmptyEl.classList.remove("hidden");
    return;
  }
  const cached = sectionPreviewUrlCache.get(section.id);
  sectionPreviewEmptyEl.classList.add("hidden");
  sectionPreviewImgEl.hidden = false;
  sectionPreviewImgEl.alt = section.label || "Plattegrondsectie";
  if (cached) {
    sectionPreviewImgEl.src = cached;
    sectionPreviewImgEl.classList.remove("is-loading");
    return;
  }
  sectionPreviewImgEl.classList.add("is-loading");
  sectionPreviewImgEl.removeAttribute("src");
  void sectionPreviewDataUrl(section).then((url) => {
    if (req !== sectionPreviewReq) return;
    sectionPreviewImgEl.classList.remove("is-loading");
    if (!url) {
      sectionPreviewImgEl.hidden = true;
      sectionPreviewEmptyEl.textContent = "Voorbeeld niet beschikbaar";
      sectionPreviewEmptyEl.classList.remove("hidden");
      return;
    }
    sectionPreviewImgEl.src = url;
    sectionPreviewImgEl.hidden = false;
    sectionPreviewEmptyEl.classList.add("hidden");
  });
}
async function loadGeometryOptions() {
  if (!buildingId || !auth()) return;
  clearSectionPreviewCaches(buildingId);
  const sectionRows = bppPhase1Enabled() ? (await bppListFloormapSections(invokeString, auth().token, buildingId)).sections : (await apiGet(`/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`)).sections;
  const rooms = [];
  floormapRoomsById = /* @__PURE__ */ new Map();
  floormapSectionsById = /* @__PURE__ */ new Map();
  for (const sec of sectionRows || []) {
    const meta = toSectionPreviewMeta(sec);
    if (meta) floormapSectionsById.set(meta.id, meta);
    const kind = String(sec.region_kind || "").toUpperCase();
    if (kind !== "FLOORMAP") continue;
    const sub = bppPhase1Enabled() ? await bppListDrawingSubsections(invokeString, auth().token, sec.id) : await apiGet(`/api/floormap/subsections?section_id=${encodeURIComponent(sec.id)}`);
    for (const s of sub.subsections || []) {
      const expected = Array.isArray(s.analysis?.expected_orientaties) ? s.analysis.expected_orientaties.map((c) => normalizeOrientatie(c)).filter(
        (c) => ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"].includes(c)
      ) : [];
      const corrRaw = s.analysis?.orientatie_correcties;
      const orientatie_correcties = {};
      if (corrRaw && typeof corrRaw === "object" && !Array.isArray(corrRaw)) {
        for (const [k, v] of Object.entries(corrRaw)) {
          const code = normalizeOrientatie(k);
          if (!code || !v || typeof v !== "object") continue;
          orientatie_correcties[code] = {
            cl_db: Number(v.cl_db) || 0,
            cg_db: Number(v.cg_db) || 0
          };
        }
      }
      const opt = {
        id: s.id,
        section_id: sec.id,
        label: s.label,
        area_m2: s.area_m2 != null ? Number(s.area_m2) : null,
        region_kind: kind,
        section_label: sec.label || kind,
        vg_nr: s.vg_nr != null ? Number(s.vg_nr) : null,
        vr_nr: s.vr_nr != null && String(s.vr_nr).trim() ? String(s.vr_nr).trim() : null,
        level_hint: String(s.level_hint || "OTHER").toUpperCase(),
        expected_orientaties: expected,
        orientatie_correcties
      };
      rooms.push(opt);
      floormapRoomsById.set(opt.id, opt);
    }
  }
  freeRooms = rooms.filter((r) => !linkedSubIds.has(r.id));
  fillRoomSelect();
  await loadFacadesForSelectedVr();
  renderVrs();
  const cur = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (cur) fillVrEdit(cur);
  else updateSectionPreview();
  renderVlakken();
  if (selectedVlakId) await refreshVrCalc();
  else blankResultsUntilVlakSelected();
}
function syncVrAddButtons() {
  const room = selectedFreeRoom();
  const anyFree = allFreeNumberedRooms().length > 0;
  vgNewBtn.disabled = !room;
  vgNewBtn.title = room ? room.vg_nr != null && findVgIdForNr(room.vg_nr) ? `Voegt toe aan bestaand ${vgLabelFromNr(room.vg_nr)} (zelfde VG-nummer)` : "Maakt een nieuw verblijfsgebied met de gekozen ruimte als eerste VR" : anyFree ? "Kies eerst een vrije plattegrondruimte" : "Geen vrije plattegrondruimten met VG/VR-nummer meer";
  const canAddToVg = Boolean(selectedVgId) && roomFitsSelectedVg(room);
  vrAddBtn.disabled = !canAddToVg;
  if (!selectedVgId) {
    vrAddBtn.title = "Selecteer eerst een verblijfsgebied hierboven";
  } else if (!anyFree) {
    vrAddBtn.title = "Geen vrije plattegrondruimten meer";
  } else if (!room) {
    vrAddBtn.title = "Kies eerst een vrije plattegrondruimte";
  } else if (!roomFitsSelectedVg(room)) {
    const floor = floorLevelForVg(selectedVgId);
    const vgNr = vgNrForVg(selectedVgId);
    vrAddBtn.title = floor ? `Alleen ruimten op ${levelLabel(floor)}${vgNr != null ? ` met VG ${vgNr}` : ""} kunnen bij dit VG` : "Deze ruimte past niet bij het geselecteerde VG";
  } else {
    vrAddBtn.title = "Voegt de gekozen ruimte toe als extra VR in het geselecteerde VG";
  }
}
function fillRoomSelect(preferSubId) {
  const prev = preferSubId || vgRoomEl.value;
  vgRoomEl.innerHTML = "";
  const all = allFreeNumberedRooms();
  const forVg = selectedVgId ? eligibleFreeRooms() : all;
  const forVgIds = new Set(forVg.map((r) => r.id));
  if (all.length === 0) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "Geen vrije plattegrondruimten meer";
    vgRoomEl.appendChild(o);
    updateRoomPreview();
    syncVrAddButtons();
    return;
  }
  const sortRooms = (items) => items.slice().sort(
    (a, b) => (a.vg_nr ?? 999) - (b.vg_nr ?? 999) || String(a.vr_nr || "").localeCompare(String(b.vr_nr || ""), void 0, { numeric: true })
  );
  const addGroup = (label, items) => {
    if (!items.length) return;
    const og = document.createElement("optgroup");
    og.label = label;
    for (const r of items) {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = formatRoomSummary(r);
      og.appendChild(o);
    }
    vgRoomEl.appendChild(og);
  };
  if (selectedVgId) {
    const floor = floorLevelForVg(selectedVgId);
    const vgNr = vgNrForVg(selectedVgId);
    const sameLabel = floor ? `Passend bij dit VG (${levelLabel(floor)}${vgNr != null ? ` \xB7 VG ${vgNr}` : ""})` : "Passend bij dit VG";
    addGroup(sameLabel, sortRooms(forVg));
    const other = all.filter((r) => !forVgIds.has(r.id));
    if (other.length) {
      addGroup("Andere vrije ruimten (alleen voor nieuw VG)", sortRooms(other));
    }
  } else {
    addGroup("Begane grond", sortRooms(all.filter((r) => isGroundLevel(r.level_hint))));
    addGroup("Verdieping", sortRooms(all.filter((r) => !isGroundLevel(r.level_hint))));
  }
  if (prev && [...vgRoomEl.options].some((o) => o.value === prev && !o.disabled)) {
    vgRoomEl.value = prev;
  } else {
    const prefer = forVg[0]?.id || all[0]?.id || "";
    if (prefer && [...vgRoomEl.options].some((o) => o.value === prefer)) vgRoomEl.value = prefer;
    else if (vgRoomEl.options.length) vgRoomEl.selectedIndex = 0;
  }
  updateRoomPreview();
  syncVrAddButtons();
}
function materialGroupKey(f) {
  if (!f.ga_ready) return null;
  const kind = f.quantity_kind === "length" ? "length" : "area";
  const gg = facadeGevelgroepNr(f);
  if (f.material_id) return `id:${f.material_id}|${kind}|g${gg}`;
  const name = (f.material_name || "").trim().toLowerCase();
  const cat = (f.master_category || "").trim().toLowerCase();
  if (!name && !cat) return null;
  const ra = f.ra_dba != null && Number.isFinite(f.ra_dba) ? String(f.ra_dba) : "";
  return `name:${cat}|${name}|${ra}|${kind}|g${gg}`;
}
function filterFacadeGroupsByOrientatie(groups, wantOri) {
  const want = normalizeOrientatie(wantOri);
  if (!want) return groups;
  return groups.filter((g) => groupOrientatie(g) === want);
}
function facadeGevelgroepNr(f) {
  const n = Number(f?.gevelgroep_nr);
  return n === 2 || n === 3 ? n : 1;
}
function gevelgroepNrOf2(g) {
  if (!g) return 1;
  const n = Number(g.groep_nr);
  if (n === 1 || n === 2 || n === 3) return n;
  const fromLabel = Number(g.label);
  if (fromLabel === 1 || fromLabel === 2 || fromLabel === 3) return fromLabel;
  const fromSort = Number(g.sort_order);
  if (fromSort === 1 || fromSort === 2) return fromSort + 1;
  return 1;
}
function componentGroepNrsPresentForOri(ori) {
  const want = normalizeOrientatie(ori ?? vlakOrientatieEl?.value);
  const set = /* @__PURE__ */ new Set();
  if (!want) return [];
  for (const f of vrFacades) {
    if (facadeOrientatie(f) !== want) continue;
    set.add(facadeGevelgroepNr(f));
  }
  return [...set].sort((a, b) => a - b);
}
function componentGroepNrsForOri(_ori) {
  return [1, 2, 3];
}
function shouldBundleFacadesForOri(_ori) {
  return true;
}
function groupFacadesForPick(facades, usedIds, opts) {
  const bundle = opts?.bundleSameMaterial !== false;
  const groups = /* @__PURE__ */ new Map();
  const singles = [];
  for (const f of facades) {
    const key2 = materialGroupKey(f);
    if (!bundle || !key2) {
      singles.push(f);
      continue;
    }
    const list = groups.get(key2) || [];
    list.push(f);
    groups.set(key2, list);
  }
  const out = [];
  const pushGroup = (members, materialKey) => {
    const available = members.filter((m) => !usedIds.has(m.id));
    if (!available.length) {
      out.push({
        primaryId: members[0].id,
        memberIds: members.map((m) => m.id),
        members,
        quantity_kind: members[0].quantity_kind === "length" ? "length" : "area",
        area_m2: null,
        length_m: null,
        label: members[0].label || "",
        materialKey,
        ga_ready: members.every((m) => m.ga_ready),
        used: true,
        orientatie: groupOrientatie({ members, orientatie: facadeOrientatie(members[0]) })
      });
      return;
    }
    const pool = [...available].sort((a, b) => {
      const ac = facadeIsComposeOp(a) ? 0 : 1;
      const bc = facadeIsComposeOp(b) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return effectiveFacadeAreaM2(b) - effectiveFacadeAreaM2(a);
    });
    const kind = pool[0].quantity_kind === "length" ? "length" : "area";
    let areaSum = null;
    let lenSum = null;
    if (kind === "length") {
      lenSum = 0;
      for (const m of pool) {
        if (m.length_m != null && Number.isFinite(m.length_m)) lenSum += Number(m.length_m);
      }
    } else {
      areaSum = 0;
      for (const m of pool) {
        const a = effectiveFacadeAreaM2(m);
        if (Number.isFinite(a)) areaSum += a;
      }
    }
    const primary = pool[0];
    out.push({
      primaryId: primary.id,
      memberIds: pool.map((m) => m.id),
      members: pool,
      quantity_kind: kind,
      area_m2: areaSum != null ? Math.round(areaSum * 100) / 100 : null,
      length_m: lenSum != null ? Math.round(lenSum * 100) / 100 : null,
      label: primary.label || "",
      materialKey,
      ga_ready: pool.every((m) => m.ga_ready),
      used: false,
      orientatie: groupOrientatie({ members: pool, orientatie: facadeOrientatie(primary) })
    });
  };
  for (const [key2, members] of groups) {
    const byOri = /* @__PURE__ */ new Map();
    for (const m of members) {
      const o = facadeOrientatie(m) || "";
      const list = byOri.get(o) || [];
      list.push(m);
      byOri.set(o, list);
    }
    for (const [, oriMembers] of byOri) {
      pushGroup(oriMembers, key2);
    }
  }
  for (const f of singles) {
    pushGroup([f], materialGroupKey(f));
  }
  out.sort((a, b) => {
    if (a.used !== b.used) return a.used ? 1 : -1;
    if (a.ga_ready !== b.ga_ready) return a.ga_ready ? -1 : 1;
    return (a.label || "").localeCompare(b.label || "", void 0, { sensitivity: "base" });
  });
  return out;
}
function correctionsForOrientatie(ori) {
  const code = normalizeOrientatie(ori);
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  const room = vr ? roomFromVr(vr) : null;
  const c = code && room?.orientatie_correcties ? room.orientatie_correcties[code] : null;
  if (c) {
    return {
      cl: String(Math.round(Number(c.cl_db) || 0)),
      cg: String(Number(c.cg_db) || 0)
    };
  }
  return { cl: "0", cg: "0" };
}
function gevelgroepenForOri(ori) {
  const want = normalizeOrientatie(ori);
  if (!want) return [];
  return gevelgroepen.filter((g) => normalizeOrientatie(g.orientatie) === want).slice().sort((a, b) => gevelgroepNrOf2(a) - gevelgroepNrOf2(b) || a.label.localeCompare(b.label, "nl"));
}
function findGevelgroep(id) {
  const want = String(id || "").trim();
  if (!want) return null;
  return gevelgroepen.find((g) => g.gevelgroep_id === want) || null;
}
function findGevelgroepByNr(ori, nr) {
  const want = nr === 2 || nr === 3 ? nr : 1;
  return gevelgroepenForOri(ori).find((g) => gevelgroepNrOf2(g) === want) || null;
}
function fillPickGroepSelect(ori, preferNr) {
  if (!vlakPickGroepEl) return;
  const code = normalizeOrientatie(ori ?? vlakOrientatieEl?.value);
  const nrs = componentGroepNrsForOri(code);
  const keep = preferNr === 2 || preferNr === 3 || preferNr === 1 ? preferNr : selectedPickGroepNr;
  vlakPickGroepEl.innerHTML = "";
  for (const n of nrs) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    vlakPickGroepEl.appendChild(o);
  }
  const pick = nrs.includes(keep) ? keep : nrs[0] || 1;
  vlakPickGroepEl.value = String(pick);
  selectedPickGroepNr = pick;
  if (vlakPickGroepHintEl) {
    const present = componentGroepNrsPresentForOri(code);
    vlakPickGroepHintEl.textContent = present.length ? `Op deze ori staan groepen ${present.join(", ")} (geveltekening). Kies een groep \u2014 de materiaallijst toont alleen die componenten.` : "Groep 1 is standaard. Zet groep 2/3 op de geveltekening bij bel-etage e.d.";
  }
  const g = findGevelgroepByNr(code, pick);
  selectedGevelgroepId = g?.gevelgroep_id || null;
}
function readFormClCg(ori) {
  const def = correctionsForOrientatie(ori ?? vlakOrientatieEl?.value);
  const clRaw = vlakClEl?.value.trim() ?? "";
  const cgRaw = vlakCgEl?.value.trim() ?? "";
  const clN = clRaw === "" ? NaN : Number(clRaw);
  const cgN = cgRaw === "" ? NaN : Number(cgRaw);
  return {
    cl: Number.isFinite(clN) ? String(Math.round(clN)) : String(Math.round(Number(def.cl) || 0)),
    cg: Number.isFinite(cgN) ? String(cgN) : def.cg
  };
}
function correctionsForVlak(v) {
  const g = findGevelgroep(v.gevelgroep_id);
  if (g) {
    return { cl: Number(g.cl_db) || 0, cg: Number(g.cg_db) || 0 };
  }
  const def = correctionsForOrientatie(v.orientatie);
  const cl = Number(v.cl_db);
  const cg = Number(v.cg_db);
  return {
    cl: Number.isFinite(cl) ? cl : Number(def.cl) || 0,
    cg: Number.isFinite(cg) ? cg : Number(def.cg) || 0
  };
}
function syncVlakCorrHint(ori) {
  if (!vlakCorrHintEl) return;
  const code = normalizeOrientatie(ori ?? vlakOrientatieEl?.value);
  const def = correctionsForOrientatie(code);
  const cur = readFormClCg(code);
  const clN = Number(cur.cl);
  const cgN = Number(cur.cg);
  const defCl = Number(def.cl) || 0;
  const defCg = Number(def.cg) || 0;
  const same = Math.abs(clN - defCl) < 1e-9 && Math.abs(cgN - defCg) < 1e-9;
  const g = findGevelgroep(selectedGevelgroepId) || findGevelgroepByNr(code, selectedPickGroepNr);
  if (!code) {
    vlakCorrHintEl.textContent = "";
    return;
  }
  const groepBit = `Groep ${selectedPickGroepNr}`;
  vlakCorrHintEl.textContent = same ? `${groepBit}: CL/Cg = ori-default ${code} (${round1(defCl)} / ${round1(defCg)} dB).` : `${groepBit}: CL/Cg afwijkend van ori ${code} (${round1(defCl)} / ${round1(defCg)} dB) \u2014 alle vlakken in deze groep.`;
}
function applyClCgFromGevelgroep(g, ori) {
  const code = normalizeOrientatie(ori ?? g?.orientatie ?? vlakOrientatieEl?.value);
  const c = g ? { cl: String(Math.round(Number(g.cl_db) || 0)), cg: String(Number(g.cg_db) || 0) } : correctionsForOrientatie(code);
  if (vlakClEl) {
    vlakClEl.value = String(Math.round(Number(c.cl) || 0));
    vlakClEl.readOnly = false;
    vlakClEl.title = "CL voor de gekozen gevelgroep (hele dB).";
  }
  if (vlakCgEl) {
    vlakCgEl.value = c.cg;
    vlakCgEl.readOnly = false;
    vlakCgEl.title = "Cg voor de gekozen gevelgroep.";
  }
  syncVlakCorrHint(code);
}
function applyClCgFromOrientatie(ori) {
  const code = normalizeOrientatie(ori);
  fillPickGroepSelect(code, selectedPickGroepNr);
  const g = findGevelgroepByNr(code, selectedPickGroepNr);
  selectedGevelgroepId = g?.gevelgroep_id || null;
  applyClCgFromGevelgroep(g, code);
}
async function loadGevelgroepen() {
  gevelgroepen = [];
  if (!selectedVrId || !auth()) {
    fillPickGroepSelect();
    return;
  }
  const ret = await invokeString("API_ListGevelgroepen", [auth().token, selectedVrId]);
  if (ret.startsWith("ERROR")) {
    fillPickGroepSelect(vlakOrientatieEl?.value, selectedPickGroepNr);
    return;
  }
  const data = parseJsonOk2(ret);
  gevelgroepen = (data.gevelgroepen || []).map((g) => ({
    ...g,
    cl_db: Number(g.cl_db) || 0,
    cg_db: Number(g.cg_db) || 0,
    sort_order: Number(g.sort_order) || 0,
    groep_nr: gevelgroepNrOf2(g),
    vlak_count: Number(g.vlak_count) || 0
  }));
  fillPickGroepSelect(vlakOrientatieEl?.value, selectedPickGroepNr);
}
function resolveFocusOrientatie(preferred) {
  const fromPreferred = normalizeOrientatie(preferred);
  if (fromPreferred) return fromPreferred;
  const fromForm = normalizeOrientatie(vlakOrientatieEl?.value);
  if (fromForm) return fromForm;
  const fromGg = normalizeOrientatie(findGevelgroep(selectedGevelgroepId)?.orientatie);
  if (fromGg) return fromGg;
  if (selectedVlakId) {
    const v = vlakken.find((x) => x.vlak_id === selectedVlakId);
    const fromVlak = normalizeOrientatie(v?.orientatie);
    if (fromVlak) return fromVlak;
  }
  return "";
}
async function persistFormGevelgroep(ori, corrOverride) {
  if (!auth() || !selectedVrId) throw new Error("Geen VR geselecteerd");
  const fromSelected = findGevelgroep(selectedGevelgroepId);
  const code = resolveFocusOrientatie(ori || fromSelected?.orientatie);
  if (!code) throw new Error("Geen ori\xEBntatie \u2014 kies eerst een gevelori\xEBntatie");
  const formCorr = corrOverride ?? readFormClCg(code);
  const nr = selectedPickGroepNr === 2 || selectedPickGroepNr === 3 ? selectedPickGroepNr : 1;
  const existing = (fromSelected && normalizeOrientatie(fromSelected.orientatie) === code ? fromSelected : null) || findGevelgroepByNr(code, nr);
  const ret = await invokeString("API_SaveGevelgroep", [
    auth().token,
    selectedVrId,
    existing?.gevelgroep_id || "",
    code,
    String(nr),
    formCorr.cl,
    formCorr.cg,
    String(nr - 1)
  ]);
  if (ret.startsWith("ERROR")) throw new Error(ret);
  const data = parseJsonOk2(ret);
  selectedGevelgroepId = data.gevelgroep_id;
  selectedPickGroepNr = nr;
  if (vlakOrientatieEl && normalizeOrientatie(vlakOrientatieEl.value) !== code) {
    ensureOrientatieOption(code);
    vlakOrientatieEl.value = code;
  }
  await loadGevelgroepen();
  fillPickGroepSelect(code, nr);
  applyClCgFromGevelgroep(findGevelgroep(selectedGevelgroepId), code);
  return selectedGevelgroepId;
}
function nudgeCorrField(el, delta) {
  if (!el) return;
  const cur = Number(el.value);
  const base = Number.isFinite(cur) ? cur : 0;
  const next = base + delta;
  el.value = Math.abs(delta) >= 1 && Number.isInteger(delta) ? String(Math.round(next)) : String(Math.round(next * 10) / 10);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
function vlakPropsComplete() {
  if (selectedVlakId) return true;
  return expectedOrientatiesForSelectedVr().length > 0;
}
function assertVlakPropsOrThrow() {
  const expected = expectedOrientatiesForSelectedVr();
  if (!expected.length) {
    throw new Error(
      "Geen gevelori\xEBntaties op de plattegrond voor deze VR \u2014 vink die eerst aan bij Opgeslagen ruimten"
    );
  }
}
function syncVlakMaterialGate() {
  const editing = Boolean(selectedVlakId);
  const expected = expectedOrientatiesForSelectedVr();
  const noPlattegrondOri = !expected.length;
  const used = usedFacadePickIds();
  const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
  const bundle = shouldBundleFacadesForOri(focusOri);
  const freeMats = groupFacadesForPick(vrFacades, used, { bundleSameMaterial: bundle }).filter(
    (g) => g.ga_ready && !g.used && Boolean(groupOrientatie(g)) && (bundle ? materialHasFreeOrientatie2(g.materialKey) : true)
  );
  const noFreeMat = !editing && vrFacades.length > 0 && freeMats.length === 0;
  const propsOk = editing || vlakPropsComplete();
  const ready = propsOk && !noPlattegrondOri && (!noFreeMat || editing);
  syncVlakCorrHint(vlakOrientatieEl?.value);
  syncOrientatieDisplay();
  const lockFacade = editing;
  vlakFacadeEl.disabled = lockFacade || !ready;
  vlakComponentFieldset?.classList.toggle("is-gated", !ready && !editing);
  vlakFacadeEl.classList.toggle("ga-facade-select--locked", lockFacade);
  if (vlakPropsGateHintEl) {
    if (editing) {
      const incomplete = Boolean(focusOri) && !vlakkenMatchFacadeStotaal(focusOri);
      vlakPropsGateHintEl.textContent = incomplete ? "Je bewerkt een bestaand vlak \u2014 de materiaallijst is vergrendeld. Klik \xABAnnuleer bewerken\xBB om een ander materiaal toe te voegen tot 100% Stotaal voor deze ori\xEBntatie." : "";
    } else if (noPlattegrondOri) {
      vlakPropsGateHintEl.textContent = "Eerst gevelori\xEBntaties + CL/Cg vastleggen op de plattegrond (Opgeslagen ruimten).";
    } else if (!vrFacades.some((f) => f.ga_ready)) {
      vlakPropsGateHintEl.textContent = "Nog geen complete gevelcomponenten voor deze VR \u2014 koppel materiaal \xE9n ori\xEBntatie (N\u2026NW) op de geveltekening.";
    } else if (noFreeMat) {
      const incomplete = Boolean(focusOri) && !vlakkenMatchFacadeStotaal(focusOri);
      vlakPropsGateHintEl.textContent = incomplete ? "Geen vrij materiaal meer voor deze ori\xEBntatie, maar dekking is nog geen 100%. Controleer of alle gevelcomponenten een materiaal hebben op de geveltekening, of dat restoppervlak bij hetzelfde materiaal hoort." : "Alle gevelmaterialen voor deze ori\xEBntatie zijn toebedeeld \u2014 zie toegevoegde vlakken.";
    } else {
      const wantOri = focusOri;
      const assignedForOri = wantOri ? vlakkenForOrientatie(wantOri) : [];
      const leftover = wantOri ? groupFacadesForPick(vrFacades, used, { bundleSameMaterial: bundle }).filter(
        (g) => g.ga_ready && !g.used && groupOrientatie(g) === wantOri && (bundle ? materialHasFreeOrientatie2(g.materialKey) : true)
      ) : [];
      vlakPropsGateHintEl.textContent = wantOri && assignedForOri.length && leftover.length === 0 ? `Alle materialen voor ${wantOri} zijn toebedeeld \u2014 zie toegevoegde vlakken.` : "Kies een nog niet gekoppeld materiaal. Zelfde materiaal binnen deze gevelgroep wordt opgeteld tot 100% Stotaal.";
    }
  }
  if (!ready) {
    vlakFacadeEl.title = noPlattegrondOri ? "Eerst ori\xEBntaties op de plattegrond" : noFreeMat ? "Geen vrij materiaal meer" : "Eerst plattegrond-ori\xEBntatie";
    if (vlakSaveBtn && !editing) {
      vlakSaveBtn.disabled = true;
      vlakSaveBtn.title = vlakFacadeEl.title;
    }
    syncListToVlakButton();
    return;
  }
  vlakFacadeEl.title = "Materiaal en RA staan op de gevelcomponent; wijzig die op de geveltekening";
  if (vlakSaveBtn) {
    const hasFac = Boolean(vlakFacadeEl.value) || editing;
    vlakSaveBtn.disabled = !hasFac && !editing;
    vlakSaveBtn.title = hasFac || editing ? "" : "Selecteer een gevelcomponent";
  }
  syncListToVlakButton();
}
function availableFacadePickGroups() {
  const wantOri = normalizeOrientatie(vlakOrientatieEl?.value);
  if (!wantOri) return [];
  const used = usedFacadePickIds();
  const pickNr = selectedPickGroepNr === 2 || selectedPickGroepNr === 3 ? selectedPickGroepNr : 1;
  const bundle = shouldBundleFacadesForOri(wantOri);
  return groupFacadesForPick(vrFacades, used, { bundleSameMaterial: bundle }).filter((g) => {
    if (!g.ga_ready || g.used) return false;
    if (groupOrientatie(g) !== wantOri) return false;
    if (!g.materialKey) return false;
    if (!g.members.every((m) => facadeGevelgroepNr(m) === pickNr)) return false;
    if (bundle && materialOrientatieTaken2(g.materialKey, wantOri, null)) return false;
    return true;
  });
}
function syncListToVlakButton() {
  if (!vlakListToVlakBtn) return;
  const editing = Boolean(selectedVlakId);
  const n = availableFacadePickGroups().length;
  vlakListToVlakBtn.disabled = editing || n < 1;
  vlakListToVlakBtn.classList.toggle("hidden", editing);
  vlakListToVlakBtn.title = editing ? "Alleen bij toevoegen \u2014 annuleer bewerken" : n ? `${n} materiaal(en) uit de lijst als vlakken toevoegen` : "Geen vrije materialen in de pickerlijst";
}
function expectedOrientatiesForSelectedVr() {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (!vr) return [];
  const room = roomFromVr(vr);
  return Array.isArray(room?.expected_orientaties) ? [...room.expected_orientaties] : [];
}
function presentVlakOrientaties2() {
  return presentVlakOrientaties(vlakken);
}
function orientatieTakenOnVr2(ori, exceptVlakId) {
  return orientatieTakenOnVr(vlakken, ori, exceptVlakId);
}
function missingOrientationsForSelectedVr() {
  const expected = expectedOrientatiesForSelectedVr();
  const have = presentVlakOrientaties2();
  return missingOrientations(expected, have);
}
function vlakMaterialLabel(v) {
  const fac = findFacadeForVlak(v);
  const name = (fac?.material_name || "").trim();
  const code = (fac?.catalog_id || "").trim();
  let base = code && name ? `${code} \xB7 ${name}` : name || code || v.omschrijving || "materiaal";
  if (fac?.from_seal || v.quantity_kind === "length") {
    if (!/kier/i.test(base)) base += " \xB7 kierdichting";
  }
  return base;
}
function vlakkenForOrientatie(ori) {
  const want = normalizeOrientatie(ori);
  if (!want) return [];
  return vlakken.filter((v) => normalizeOrientatie(v.orientatie) === want);
}
function orisPresentInVlakken(list) {
  const out = /* @__PURE__ */ new Set();
  for (const v of list) {
    const o = normalizeOrientatie(v.orientatie);
    if (o) out.add(o);
  }
  return out;
}
function rememberVrOriPresent(vrId, list) {
  const id = (vrId || "").trim();
  if (!id) return;
  vrOriPresentById.set(id, orisPresentInVlakken(list));
  vrVlakkenById.set(id, list.slice());
}
function createOriStatusLed(ori, detail) {
  const led = document.createElement("span");
  led.className = "scale-calibrated-led";
  led.classList.add(detail === "complete" ? "is-on" : "is-warn");
  led.setAttribute("role", "status");
  const name = ORIENTATIE_LABELS[ori] || ori;
  const title = detail === "complete" ? `${ori} (${name}): 100% Stotaal` : detail === "partial" ? `${ori} (${name}): materialen gekoppeld, nog geen 100% Stotaal` : `${ori} (${name}): nog niet gespecificeerd`;
  led.title = title;
  led.setAttribute("aria-label", title);
  return led;
}
function oriLedStateForSelectedVr(ori) {
  const code = normalizeOrientatie(ori);
  if (!code) return "empty";
  if (!vlakkenForOrientatie(code).length) return "empty";
  return vlakkenMatchFacadeStotaal(code) ? "complete" : "partial";
}
function appendVrOriLedStrip(parent, vr) {
  const room = roomFromVr(vr);
  const expected = Array.isArray(room?.expected_orientaties) ? room.expected_orientaties.map((o) => normalizeOrientatie(o)).filter(Boolean) : [];
  if (!expected.length) return;
  const present = vrOriPresentById.get(vr.verblijfsruimte_id) || /* @__PURE__ */ new Set();
  const strip = document.createElement("span");
  strip.className = "ga-ori-led-strip";
  strip.setAttribute("aria-label", "Ori\xEBntatie-status");
  const isSelected = vr.verblijfsruimte_id === selectedVrId;
  for (const code of expected) {
    const chip = document.createElement("span");
    chip.className = "ga-ori-led-chip";
    if (isSelected) {
      chip.appendChild(createOriStatusLed(code, oriLedStateForSelectedVr(code)));
    } else {
      const has = present.has(code);
      chip.appendChild(createOriStatusLed(code, has ? "partial" : "empty"));
    }
    const t = document.createElement("span");
    t.className = "ga-ori-led-code";
    t.textContent = code;
    chip.appendChild(t);
    strip.appendChild(chip);
  }
  parent.appendChild(strip);
}
async function hydrateVrOriCoverage() {
  if (!auth() || !vrs.length) return;
  const token = auth().token;
  await Promise.all(
    vrs.map(async (r) => {
      rememberVrCopyLabel(r);
      const id = r.verblijfsruimte_id;
      if (id === selectedVrId) {
        rememberVrOriPresent(id, vlakken);
        return;
      }
      try {
        const ret = await invokeString("API_ListVlakken", [token, id]);
        const data = parseJsonOk2(ret);
        rememberVrOriPresent(id, data.vlakken || []);
      } catch {
      }
    })
  );
}
function syncVlakPickDropdown() {
  if (!vlakPickEl) return;
  vlakPickSyncLock = true;
  try {
    const prev = vlakPickValue;
    vlakPickEl.replaceChildren();
    if (!selectedVrId) {
      vlakPickEl.setAttribute("aria-disabled", "true");
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "\u2014 selecteer eerst een VR \u2014";
      vlakPickEl.appendChild(li);
      vlakPickValue = "";
      return;
    }
    const expected = expectedOrientatiesForSelectedVr();
    if (!expected.length) {
      vlakPickEl.setAttribute("aria-disabled", "true");
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "\u2014 eerst ori\xEBntaties op de plattegrond \u2014";
      vlakPickEl.appendChild(li);
      vlakPickValue = "";
      return;
    }
    vlakPickEl.setAttribute("aria-disabled", "false");
    for (const code of expected) {
      const st = oriLedStateForSelectedVr(code);
      const li = document.createElement("li");
      li.className = "drawing-list-item ga-ori-pick-item";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "drawing-list-select";
      btn.setAttribute("role", "option");
      btn.dataset.value = `ori:${code}`;
      const inner = document.createElement("span");
      inner.className = "drawing-list-select-inner";
      inner.appendChild(createOriStatusLed(code, st));
      const label = document.createElement("span");
      label.className = "drawing-list-select-label";
      label.textContent = st === "complete" ? `${code} \xB7 ${ORIENTATIE_LABELS[code] || code} \xB7 100%` : st === "partial" ? `${code} \xB7 ${ORIENTATIE_LABELS[code] || code} \xB7 incompleet` : `${code} \xB7 ${ORIENTATIE_LABELS[code] || code} \xB7 nog niet gespecificeerd`;
      inner.appendChild(label);
      btn.appendChild(inner);
      btn.addEventListener("click", () => {
        if (vlakPickSyncLock) return;
        const pick = btn.dataset.value || "";
        vlakPickValue = pick;
        for (const item of vlakPickEl.querySelectorAll(".drawing-list-item")) {
          item.classList.toggle(
            "selected",
            item.querySelector("button")?.dataset.value === pick
          );
        }
        if (!pick) {
          clearVlakEdit();
          return;
        }
        if (pick.startsWith("ori:")) prepareVlakForOrientatie(pick.slice(4));
      });
      li.appendChild(btn);
      vlakPickEl.appendChild(li);
    }
    let want = "";
    const formOri = normalizeOrientatie(vlakOrientatieEl?.value);
    if (formOri && expected.includes(formOri)) {
      want = `ori:${formOri}`;
    } else if (selectedVlakId) {
      const cur = vlakken.find((v) => v.vlak_id === selectedVlakId);
      const ori = normalizeOrientatie(cur?.orientatie);
      if (ori) want = `ori:${ori}`;
    }
    if (want && expected.some((c) => `ori:${c}` === want)) {
      vlakPickValue = want;
    } else if (prev && expected.some((c) => `ori:${c}` === prev)) {
      vlakPickValue = prev;
    } else {
      vlakPickValue = expected.length === 1 ? `ori:${expected[0]}` : "";
    }
    for (const item of vlakPickEl.querySelectorAll(".drawing-list-item")) {
      const val = item.querySelector("button")?.dataset.value || "";
      item.classList.toggle("selected", Boolean(vlakPickValue) && val === vlakPickValue);
    }
  } finally {
    vlakPickSyncLock = false;
  }
}
function prepareVlakForOrientatie(ori) {
  const code = normalizeOrientatie(ori);
  if (!code) return;
  selectedVlakId = null;
  vlakNameEl.value = "";
  syncOrientatieSelectOptions();
  ensureOrientatieOption(code);
  if (vlakOrientatieEl) vlakOrientatieEl.value = code;
  selectedPickGroepNr = 1;
  fillPickGroepSelect(code, 1);
  applyClCgFromOrientatie(code);
  vlakGakEl.checked = true;
  fillFacadeSelect();
  syncVlakMaterialGate();
  updateVlakOriCompletenessHint();
  syncOrientatieDisplay();
  if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak vullen";
  vlakCancelBtn?.classList.add("hidden");
  const assigned = vlakkenForOrientatie(code);
  const oriLabel = ORIENTATIE_LABELS[code] || code;
  if (vlakEditHintEl) {
    vlakEditHintEl.textContent = assigned.length ? `Ori\xEBntatie ${oriLabel} \xB7 groep ${selectedPickGroepNr} \u2014 resterende materialen bij 2; vastgelegde vlakken hieronder.` : `Voeg een vlak toe voor ${oriLabel} \xB7 groep ${selectedPickGroepNr}.`;
  }
  renderVlakken();
  blankResultsUntilVlakSelected(
    assigned.length ? void 0 : `Ori\xEBntatie ${oriLabel}: nog geen materialen \u2014 berekening wordt niet getoond tot je hier vlakken toevoegt.`
  );
  syncCopyVlakkenBar();
}
function vrShortLabel(vr) {
  const room = roomFromVr(vr);
  if (room?.vr_nr) {
    return vrLabelFromNr(room.vr_nr, room.label || vr.omschrijving || "");
  }
  return (vr.omschrijving || "VR").trim() || "VR";
}
function rememberVrCopyLabel(vr) {
  vrCopyLabelById.set(vr.verblijfsruimte_id, vrShortLabel(vr));
}
function parseCopySourceKey(raw) {
  const s = (raw || "").trim();
  const i = s.indexOf("|");
  if (i <= 0) return null;
  const vrId = s.slice(0, i).trim();
  const ori = normalizeOrientatie(s.slice(i + 1));
  if (!vrId || !ori) return null;
  return { vrId, ori };
}
function facadeIdsRelatedToAnchor(anchorId, ori) {
  const want = normalizeOrientatie(ori);
  const related = /* @__PURE__ */ new Set();
  const anchor = vrFacades.find((f) => f.id === anchorId);
  if (!anchor || want && facadeOrientatie(anchor) !== want) return related;
  related.add(anchor.id);
  for (const c of anchor.constituents || []) {
    const id = String(c.id || "").trim();
    if (id) related.add(id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of vrFacades) {
      if (want && facadeOrientatie(f) !== want) continue;
      if (related.has(f.id)) {
        for (const c of f.constituents || []) {
          const id = String(c.id || "").trim();
          if (id && !related.has(id)) {
            related.add(id);
            grew = true;
          }
        }
        continue;
      }
      const cids = (f.constituents || []).map((c) => String(c.id || "").trim()).filter(Boolean);
      if (cids.some((id) => related.has(id))) {
        related.add(f.id);
        for (const id of cids) related.add(id);
        grew = true;
      }
      if (f.from_seal && related.has(facadeSourceId(f))) {
        related.add(f.id);
        grew = true;
      }
    }
  }
  return related;
}
function syncCopyVlakkenBar() {
  if (selectedVrId) {
    const cur = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
    if (cur) rememberVrCopyLabel(cur);
    rememberVrOriPresent(selectedVrId, vlakken);
  }
  if (!copyVlakkenBarEl) return;
  copyVlakkenBarEl.classList.add("hidden");
  if (copyVlakkenCbEl) copyVlakkenCbEl.checked = false;
  copyVlakkenControlsEl?.classList.add("hidden");
  if (copyVlakkenBtnEl) copyVlakkenBtnEl.disabled = true;
}
function updateCopyVlakkenBtnEnabled() {
  if (!copyVlakkenBtnEl) return;
  copyVlakkenBtnEl.disabled = !copyVlakkenCbEl?.checked || !copyVlakkenSourceEl?.value || !copyVlakkenAnchorEl?.value;
}
function findFacadeInList(v, facades) {
  const sid = (v.facade_subsection_id || "").trim();
  if (!sid) return null;
  if (v.quantity_kind === "length") {
    return facades.find((f) => f.from_seal && facadeSourceId(f) === sid) || facades.find((f) => f.id === sid && f.quantity_kind === "length") || null;
  }
  return facades.find((f) => !f.from_seal && f.id === sid) || facades.find((f) => f.id === sid) || null;
}
function materialGroupKeyInList(f) {
  return materialGroupKey(f);
}
function liveVlakQtyInContext(v, facades, allVlakken) {
  const kind = v.quantity_kind === "length" ? "length" : "area";
  const stored = kind === "length" ? Number(v.length_m ?? 0) : Number(v.area_m2 ?? 0);
  if (v.prefer_stored_qty && Number.isFinite(stored) && stored > 0) {
    return { kind, qty: Math.round(stored * 100) / 100 };
  }
  const fac = findFacadeInList(v, facades);
  if (!fac) return { kind, qty: stored };
  const key2 = materialGroupKeyInList(fac);
  const ori = facadeOrientatie(fac);
  const peers = key2 ? facades.filter((f) => materialGroupKeyInList(f) === key2 && facadeOrientatie(f) === ori) : [fac];
  let shareCount = 0;
  if (key2) {
    for (const other of allVlakken) {
      if (!(other.facade_subsection_id || "").trim()) continue;
      const of = findFacadeInList(other, facades);
      if (of && materialGroupKeyInList(of) === key2 && facadeOrientatie(of) === ori) {
        shareCount += 1;
      }
    }
  }
  const sources = shareCount > 1 ? [fac] : peers;
  if (kind === "length") {
    let sum2 = 0;
    let any2 = false;
    for (const p of sources) {
      if (p.length_m != null && Number.isFinite(Number(p.length_m))) {
        sum2 += Number(p.length_m);
        any2 = true;
      }
    }
    return { kind, qty: any2 ? Math.round(sum2 * 100) / 100 : stored };
  }
  let sum = 0;
  let any = false;
  for (const p of sources) {
    const a = effectiveFacadeAreaM2(p, facades);
    if (a > 0) {
      sum += a;
      any = true;
    }
  }
  return { kind, qty: any ? Math.round(sum * 100) / 100 : stored };
}
async function loadFacadesForVrNr(vrNr) {
  if (!auth() || !buildingId || !vrNr) return [];
  const data = bppPhase1Enabled() ? await bppListVrFacadeComponents(invokeString, auth().token, buildingId, vrNr) : await apiGet(
    `/api/floormap/vr-components?building_id=${encodeURIComponent(buildingId)}&vr_nr=${encodeURIComponent(vrNr)}`
  );
  return mapEligibleToVrFacades(data.eligible || []);
}
function mapEligibleToVrFacades(eligible) {
  const out = (eligible || []).map((s) => {
    const rawId = String(s.id || "");
    const fromSeal = Boolean(s.from_seal) || rawId.endsWith("#seal");
    const sourceId = String(
      s.source_subsection_id || (fromSeal && rawId.endsWith("#seal") ? rawId.slice(0, -5) : rawId)
    );
    return {
      id: rawId,
      label: s.label || "",
      section_label: s.section_label || "",
      region_kind: String(s.region_kind || "FACADE").toUpperCase(),
      area_m2: s.area_m2 != null ? Number(s.area_m2) : null,
      quantity_kind: s.quantity_kind === "length" ? "length" : "area",
      length_m: s.length_m != null ? Number(s.length_m) : null,
      vg_nr: s.vg_nr != null ? Number(s.vg_nr) : null,
      vr_nr: s.vr_nr != null ? String(s.vr_nr) : null,
      ga_ready: Boolean(s.ga_ready),
      material_name: s.material_name || null,
      catalog_id: s.catalog_id != null && String(s.catalog_id).trim() ? String(s.catalog_id).trim() : null,
      master_category: s.master_category || null,
      material_id: s.material_id != null ? String(s.material_id) : null,
      ra_dba: s.ra_dba != null ? Number(s.ra_dba) : null,
      boolean_op: s.boolean_op || null,
      repeat_count: s.repeat_count != null && Number.isFinite(Number(s.repeat_count)) ? Math.max(1, Math.min(99, Math.round(Number(s.repeat_count)))) : 1,
      orientatie: normalizeOrientatie(s.orientatie) || null,
      kozijn_role: s.kozijn_role != null ? String(s.kozijn_role).trim() || null : null,
      gevelgroep_nr: (() => {
        const n = Number(s.gevelgroep_nr);
        return n === 2 || n === 3 ? n : 1;
      })(),
      from_seal: fromSeal,
      source_subsection_id: sourceId || null,
      constituents: Array.isArray(s.constituents) ? s.constituents.map((c) => ({
        id: String(c.id || ""),
        sign: c.sign === "-" ? "-" : "+",
        label: String(c.label || ""),
        catalog_id: c.catalog_id != null && String(c.catalog_id).trim() ? String(c.catalog_id).trim() : null,
        material_name: c.material_name != null ? String(c.material_name) : null,
        area_m2: c.area_m2 != null ? Number(c.area_m2) : null
      })) : []
    };
  });
  for (const f of out) {
    if (!facadeOrientatie(f)) f.ga_ready = false;
  }
  return out;
}
function vrNrForVrId(vrId) {
  const vr = vrs.find((r) => r.verblijfsruimte_id === vrId);
  if (!vr) return null;
  const room = roomFromVr(vr);
  if (room?.vr_nr) return String(room.vr_nr);
  const m = String(vr.omschrijving || "").match(/^VR\s+([^\s·]+)/i);
  return m ? m[1] : null;
}
function vrMatchesFlowNr(vr, want) {
  const nr = (() => {
    const room = roomFromVr(vr);
    if (room?.vr_nr) return String(room.vr_nr);
    const m = String(vr.omschrijving || "").match(/^VR\s+([^\s·]+)/i);
    return m ? m[1] : null;
  })();
  return flowVrNrsEqual(nr, want);
}
async function findVrIdByFlowNr(vrNr) {
  const want = normalizeFlowVrNr(vrNr);
  if (!want || !auth() || !vgs.length) return null;
  for (const r of vrs) {
    if (vrMatchesFlowNr(r, want) && selectedVgId) {
      return { vgId: selectedVgId, vrId: r.verblijfsruimte_id };
    }
  }
  for (const g of vgs) {
    const ret = await invokeString("API_ListVerblijfsruimten", [
      auth().token,
      g.verblijfsgebied_id
    ]);
    if (typeof ret === "string" && ret.startsWith("ERROR")) continue;
    try {
      const data = parseJsonOk2(ret);
      for (const r of data.verblijfsruimten || []) {
        if (vrMatchesFlowNr(r, want)) {
          return { vgId: g.verblijfsgebied_id, vrId: r.verblijfsruimte_id };
        }
      }
    } catch {
    }
  }
  return null;
}
async function applyFlowVrPreference(vrNr) {
  const want = normalizeFlowVrNr(vrNr);
  if (!want) return false;
  const hit = await findVrIdByFlowNr(want);
  if (!hit) return false;
  if (selectedVgId !== hit.vgId) {
    selectedVgId = hit.vgId;
    renderVgs();
    await loadVrs(hit.vrId);
  } else if (selectedVrId !== hit.vrId) {
    await loadVrs(hit.vrId);
  }
  const room = (() => {
    const vr = vrs.find((r) => r.verblijfsruimte_id === hit.vrId);
    return vr ? roomFromVr(vr) : null;
  })();
  if (buildingId) {
    persistFlowVr(
      buildingId,
      want,
      room?.vg_nr != null && Number.isFinite(Number(room.vg_nr)) ? Number(room.vg_nr) : null
    );
  }
  rememberGaSelection();
  return selectedVrId === hit.vrId;
}
async function copyVlakkenFromSource(sourceVrId, sourceOri, targetOri, anchorId) {
  if (!auth() || !selectedVrId) throw new Error("Selecteer eerst een VR");
  const srcOri = normalizeOrientatie(sourceOri);
  const dst = normalizeOrientatie(targetOri);
  const anchor = (anchorId || "").trim();
  if (!srcOri || !dst) throw new Error("Bron- en doelori\xEBntatie zijn verplicht");
  if (!anchor) throw new Error("Kies een anker-gevelvlak op de actieve ori");
  if (sourceVrId === selectedVrId && srcOri === dst) {
    throw new Error("Kies een andere VR \xB7 ori als bron");
  }
  const expected = expectedOrientatiesForSelectedVr();
  if (!expected.includes(dst)) {
    throw new Error(`Ori\xEBntatie ${dst} staat niet in de plattegrond-definitie`);
  }
  const anchorFac = vrFacades.find((f) => f.id === anchor);
  if (!anchorFac || facadeOrientatie(anchorFac) !== dst) {
    throw new Error("Anker hoort niet bij de actieve ori\xEBntatie");
  }
  let sourceVlakken = (vrVlakkenById.get(sourceVrId) || []).filter(
    (v) => normalizeOrientatie(v.orientatie) === srcOri
  );
  if (!sourceVlakken.length && auth()) {
    const ret = await invokeString("API_ListVlakken", [auth().token, sourceVrId]);
    const data = parseJsonOk2(ret);
    rememberVrOriPresent(sourceVrId, data.vlakken || []);
    sourceVlakken = (data.vlakken || []).filter(
      (v) => normalizeOrientatie(v.orientatie) === srcOri
    );
  }
  if (!sourceVlakken.length) {
    throw new Error(`Geen vlakken op bron ${vrCopyLabelById.get(sourceVrId) || "VR"} \xB7 ${srcOri}`);
  }
  let sourceFacades = sourceVrId === selectedVrId ? vrFacades : [];
  if (!sourceFacades.length) {
    const nr = vrNrForVrId(sourceVrId);
    if (!nr) throw new Error("Bron-VR heeft geen VR-nummer van de plattegrond");
    sourceFacades = await loadFacadesForVrNr(nr);
  }
  const relatedIds = facadeIdsRelatedToAnchor(anchor, dst);
  const targetPoolIds = relatedIds.size > 1 ? relatedIds : new Set(
    vrFacades.filter((f) => f.ga_ready && facadeOrientatie(f) === dst).map((f) => f.id)
  );
  targetPoolIds.add(anchor);
  const used = usedFacadePickIds();
  const takenKeys = /* @__PURE__ */ new Set();
  for (const v of vlakkenForOrientatie(dst)) {
    const f = findFacadeForVlak(v);
    const k = f ? materialGroupKey(f) : null;
    if (k) takenKeys.add(k);
  }
  let copied = 0;
  let skippedExist = 0;
  const unmatched = [];
  const ordered = [...sourceVlakken].sort((a, b) => {
    const fa = findFacadeInList(a, sourceFacades);
    const fb = findFacadeInList(b, sourceFacades);
    const ka = fa ? materialGroupKey(fa) : null;
    const kb = fb ? materialGroupKey(fb) : null;
    const anchorKey = materialGroupKey(anchorFac);
    const aHit = ka && ka === anchorKey ? 0 : 1;
    const bHit = kb && kb === anchorKey ? 0 : 1;
    return aHit - bHit;
  });
  for (const v of ordered) {
    const srcFac = findFacadeInList(v, sourceFacades);
    const key2 = srcFac ? materialGroupKey(srcFac) : null;
    const matLabel = srcFac?.material_name || v.omschrijving || (v.quantity_kind === "length" ? "kierdichting" : "materiaal");
    if (!key2) {
      unmatched.push(matLabel);
      continue;
    }
    if (takenKeys.has(key2)) {
      skippedExist += 1;
      continue;
    }
    const wantLen = v.quantity_kind === "length" || srcFac?.quantity_kind === "length";
    const srcCompose = srcFac ? facadeIsComposeOp(srcFac) : false;
    const candidates = groupFacadesForPick(vrFacades, used, {
      bundleSameMaterial: shouldBundleFacadesForOri(dst)
    }).filter((g) => {
      if (!g.ga_ready || g.used || g.materialKey !== key2) return false;
      if (groupOrientatie(g) !== dst) return false;
      const isLen = g.quantity_kind === "length";
      if (isLen !== Boolean(wantLen)) return false;
      return g.memberIds.some((id) => targetPoolIds.has(id)) || targetPoolIds.has(g.primaryId);
    });
    candidates.sort((a, b) => {
      const aAnchor = a.primaryId === anchor || a.memberIds.includes(anchor) ? 0 : 1;
      const bAnchor = b.primaryId === anchor || b.memberIds.includes(anchor) ? 0 : 1;
      if (aAnchor !== bAnchor) return aAnchor - bAnchor;
      const aComp = a.members.some(facadeIsComposeOp) === srcCompose ? 0 : 1;
      const bComp = b.members.some(facadeIsComposeOp) === srcCompose ? 0 : 1;
      return aComp - bComp;
    });
    if (!candidates.length) {
      unmatched.push(matLabel);
      continue;
    }
    const pick = candidates[0];
    const fac = (pick.primaryId === anchor ? anchorFac : pick.members.find((m) => m.id === anchor)) || pick.members[0] || vrFacades.find((f) => f.id === pick.primaryId);
    if (!fac) {
      unmatched.push(matLabel);
      continue;
    }
    const live = liveVlakQtyInContext(v, sourceFacades, sourceVlakken);
    const qty = live.qty > 0 ? live.qty : wantLen ? Number(v.length_m) || 0 : Number(v.area_m2) || 0;
    const rounded = Math.round(qty * 100) / 100;
    const facadeId = facadeSourceId(fac);
    const name = (v.omschrijving || "").trim() || fac.material_name || fac.label || "Vlak";
    const srcCorr = correctionsForVlak(v);
    const dstDef = correctionsForOrientatie(dst);
    const clCopy = Number.isFinite(Number(v.cl_db)) ? String(srcCorr.cl) : dstDef.cl;
    const cgCopy = Number.isFinite(Number(v.cg_db)) ? String(srcCorr.cg) : dstDef.cg;
    const srcNr = facadeGevelgroepNr(
      findFacadeInList(v, sourceFacades) || { gevelgroep_nr: 1 }
    );
    const dstLabel = String(srcNr === 2 || srcNr === 3 ? srcNr : 1);
    let dstGgId = "";
    const matchGg = findGevelgroepByNr(dst, Number(dstLabel)) || gevelgroepenForOri(dst).find(
      (g) => Math.abs((Number(g.cl_db) || 0) - (Number(clCopy) || 0)) < 1e-9 && Math.abs((Number(g.cg_db) || 0) - (Number(cgCopy) || 0)) < 1e-9
    );
    if (matchGg) {
      dstGgId = matchGg.gevelgroep_id;
    } else {
      const ggRet = await invokeString("API_SaveGevelgroep", [
        auth().token,
        selectedVrId,
        "",
        dst,
        dstLabel,
        clCopy,
        cgCopy,
        String(gevelgroepenForOri(dst).length)
      ]);
      if (!ggRet.startsWith("ERROR")) {
        const ggData = parseJsonOk2(ggRet);
        dstGgId = ggData.gevelgroep_id;
        await loadGevelgroepen();
      }
    }
    const ret = await invokeString("API_SaveVlak", [
      auth().token,
      selectedVrId,
      "",
      name,
      wantLen ? "0" : String(rounded),
      clCopy,
      cgCopy,
      v.meenemen_gak !== false ? "true" : "false",
      "0",
      facadeId,
      wantLen ? "length" : "area",
      wantLen ? String(rounded) : "",
      dst,
      "true",
      dstGgId
    ]);
    if (ret.startsWith("ERROR")) {
      unmatched.push(`${matLabel} (${ret.replace(/^ERROR:\s*/i, "")})`);
      continue;
    }
    copied += 1;
    takenKeys.add(key2);
    used.add(pick.primaryId);
    for (const mid of pick.memberIds) used.add(mid);
  }
  await loadVlakken({ resetForm: true, openFirstVlak: false });
  clearVlakEdit(dst);
  prepareVlakForOrientatie(dst);
  await refreshVrCalc({ persist: true });
  if (!selectedVlakId) {
    blankResultsUntilVlakSelected(
      copied ? `${copied} vlak(ken) overgenomen naar ${dst}. Open een vlak om de berekening te tonen.` : void 0
    );
  }
  const srcLabel = `${vrCopyLabelById.get(sourceVrId) || "VR"} \xB7 ${srcOri}`;
  const bits = [`${copied} overgenomen van ${srcLabel} \u2192 ${dst}`];
  if (skippedExist) bits.push(`${skippedExist} al aanwezig`);
  if (unmatched.length) {
    bits.push(
      `${unmatched.length} niet gekoppeld (geen vrij component rond anker: ${unmatched.slice(0, 3).join(", ")}${unmatched.length > 3 ? "\u2026" : ""})`
    );
  }
  setConn(copied || skippedExist ? "ok" : "err", bits.join(" \xB7 "));
  syncCopyVlakkenBar();
}
function syncOrientatieSelectOptions() {
  if (!vlakOrientatieEl) return;
  const expected = expectedOrientatiesForSelectedVr();
  const codes = expected.length ? expected : [...ORIENTATIE_ALL];
  const prev = vlakOrientatieEl.value;
  vlakOrientatieEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "\u2014";
  vlakOrientatieEl.appendChild(ph);
  for (const c of codes) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = ORIENTATIE_LABELS[c] || c;
    vlakOrientatieEl.appendChild(o);
  }
  if (prev && [...vlakOrientatieEl.options].some((o) => o.value === prev)) {
    vlakOrientatieEl.value = prev;
  } else {
    vlakOrientatieEl.value = "";
  }
  syncOrientatieDisplay();
}
function ensureOrientatieOption(code) {
  if (!vlakOrientatieEl || !code) return;
  if (![...vlakOrientatieEl.options].some((o) => o.value === code)) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = ORIENTATIE_LABELS[code] || code;
    vlakOrientatieEl.appendChild(o);
  }
}
function syncOrientatieDisplay() {
  if (!vlakOrientatieDisplayEl) return;
  const expected = expectedOrientatiesForSelectedVr();
  if (selectedVlakId) {
    const ori2 = normalizeOrientatie(vlakOrientatieEl?.value);
    vlakOrientatieDisplayEl.textContent = ori2 ? `Ori\xEBntatie: ${ORIENTATIE_LABELS[ori2] || ori2} (vastgelegd)` : "Ori\xEBntatie: \u2014";
    return;
  }
  if (!expected.length) {
    vlakOrientatieDisplayEl.textContent = "Ori\xEBntatie: \u2014 (eerst vastleggen op de plattegrond)";
    return;
  }
  const matKey = (vlakFacadeEl.selectedOptions[0]?.dataset.materialKey || "").trim() || null;
  const chosen = normalizeOrientatie(vlakOrientatieEl?.value);
  const ori = chosen || resolveOrientatieForNewVlak2("", matKey);
  const multi = expected.length > 1;
  if (!chosen && !ori) {
    vlakOrientatieDisplayEl.textContent = `Ori\xEBntatie: \u2014 kies in de listbox hierboven (${expected.join(", ")})`;
    return;
  }
  vlakOrientatieDisplayEl.textContent = ori ? `Ori\xEBntatie: ${ORIENTATIE_LABELS[ori] || ori} (uit plattegrond` + (matKey && multi ? ", per materiaal" : "") + `)` + (multi ? ` \xB7 plattegrond: ${expected.join(", ")}` : "") : `Ori\xEBntatie: \u2014 \xB7 plattegrond: ${expected.join(", ")}`;
}
function updateVlakOriCompletenessHint() {
  if (!vlakOriStatusEl) return;
  const expected = expectedOrientatiesForSelectedVr();
  if (!selectedVrId) {
    vlakOriStatusEl.textContent = "";
    return;
  }
  if (!expected.length) {
    vlakOriStatusEl.textContent = "Geen gevelori\xEBntaties op de plattegrond voor deze VR \u2014 verplicht bij Opgeslagen ruimten.";
    return;
  }
  const have = presentVlakOrientaties2();
  const missing = expected.filter((o) => !have.has(o));
  const done = expected.filter((o) => have.has(o));
  if (!missing.length) {
    vlakOriStatusEl.textContent = `Plattegrond-ori\xEBntaties gedekt (${expected.join(", ")}) \u2014 meerdere materialen per ori\xEBntatie zijn toegestaan.`;
  } else {
    vlakOriStatusEl.textContent = `Nog geen vlak voor ori\xEBntatie(s): ${missing.join(", ")}` + (done.length ? ` (al: ${done.join(", ")})` : "") + " \u2014 voeg per ori\xEBntatie minstens \xE9\xE9n materiaal toe.";
  }
}
function resolveOrientatieForNewVlak2(currentOri, matKey, exceptVlakId) {
  return resolveOrientatieForNewVlak(
    expectedOrientatiesForSelectedVr(),
    currentOri,
    vlakken,
    vrFacades,
    materialGroupKey,
    matKey,
    exceptVlakId
  );
}
function materialHasFreeOrientatie2(matKey, exceptVlakId) {
  return materialHasFreeOrientatie(
    expectedOrientatiesForSelectedVr(),
    vlakken,
    vrFacades,
    materialGroupKey,
    matKey,
    exceptVlakId
  );
}
function materialOrientatieTaken2(matKey, ori, exceptVlakId) {
  return materialOrientatieTaken(vlakken, vrFacades, materialGroupKey, matKey, ori, exceptVlakId);
}
function orisUsedForMaterial2(matKey, exceptVlakId) {
  return orisUsedForMaterial(vlakken, vrFacades, materialGroupKey, matKey, exceptVlakId);
}
function formatFacadeGroupOption2(g) {
  return formatFacadeGroupOption(g);
}
function fillFacadeSelect() {
  const prev = vlakFacadeEl.value;
  const used = usedFacadePickIds();
  const editing = Boolean(selectedVlakId);
  const propsReady = editing || vlakPropsComplete();
  const expected = expectedOrientatiesForSelectedVr();
  const canShowMaterials = propsReady && Boolean(expected.length);
  const wantOri = normalizeOrientatie(vlakOrientatieEl?.value);
  const bundle = shouldBundleFacadesForOri(wantOri);
  const allGroups = groupFacadesForPick(vrFacades, used, { bundleSameMaterial: bundle });
  const readyGroups = allGroups.filter((g) => g.ga_ready);
  const pickNr = selectedPickGroepNr === 2 || selectedPickGroepNr === 3 ? selectedPickGroepNr : 1;
  let available = readyGroups.filter((g) => {
    if (g.used) return false;
    const compOri = groupOrientatie(g);
    if (!compOri) return false;
    const matKey = g.materialKey;
    if (!matKey) return false;
    if (!g.members.every((m) => facadeGevelgroepNr(m) === pickNr)) return false;
    if (!bundle) return true;
    return !materialOrientatieTaken2(matKey, compOri, selectedVlakId || null);
  });
  if (!wantOri) {
    available = [];
  } else {
    available = filterFacadeGroupsByOrientatie(available, wantOri);
  }
  const assignedForOri = wantOri ? vlakkenForOrientatie(wantOri) : [];
  const readyForOri = wantOri ? readyGroups.filter((g) => groupOrientatie(g) === wantOri) : [];
  const incompleteN = allGroups.filter((g) => !g.ga_ready).length;
  if (editing) {
    const cur = vlakken.find((v) => v.vlak_id === selectedVlakId);
    const fac = cur ? findFacadeForVlak(cur) : null;
    const facId = fac?.id || cur?.facade_subsection_id || prev || "";
    const g = fac ? groupFacadesForPick(vrFacades, /* @__PURE__ */ new Set(), { bundleSameMaterial: false }).find(
      (x) => x.primaryId === fac.id || x.memberIds.includes(fac.id)
    ) : facId ? groupFacadesForPick(vrFacades, /* @__PURE__ */ new Set(), { bundleSameMaterial: false }).find(
      (x) => x.primaryId === facId || x.memberIds.includes(facId)
    ) : void 0;
    vlakFacadeEl.innerHTML = "";
    if (facId) {
      const o = document.createElement("option");
      o.value = facId;
      const base = g ? formatFacadeGroupOption2(g) : fac?.material_name || facId.slice(0, 8);
      o.textContent = base;
      if (g) {
        o.dataset.area = g.area_m2 != null ? Number(g.area_m2).toFixed(2) : "";
        o.dataset.length = g.length_m != null ? Number(g.length_m).toFixed(2) : "";
        o.dataset.quantityKind = g.quantity_kind === "length" ? "length" : "area";
        o.dataset.label = g.members[0]?.material_name || g.label || "Vlak";
        o.dataset.materialId = (g.members[0]?.material_id || "").trim();
        o.dataset.catalogId = (g.members[0]?.catalog_id || "").trim();
        if (g.materialKey) o.dataset.materialKey = g.materialKey;
      }
      vlakFacadeEl.appendChild(o);
      vlakFacadeEl.value = facId;
      vlakFacadeEl.size = 1;
    } else {
      const ph2 = document.createElement("option");
      ph2.value = "";
      ph2.textContent = "\u2014 geen component gekoppeld \u2014";
      vlakFacadeEl.appendChild(ph2);
      vlakFacadeEl.size = 1;
    }
    if (vlakFacadeLabelEl) {
      vlakFacadeLabelEl.classList.add("hidden");
    }
    if (vlakFacadeLinkedEl) {
      const label = vlakFacadeEl.selectedOptions[0]?.textContent?.trim() || "\u2014";
      const composed = fac?.boolean_op === "compose" || fac?.boolean_op === "difference";
      vlakFacadeLinkedEl.hidden = false;
      vlakFacadeLinkedEl.textContent = fac?.from_seal || cur?.quantity_kind === "length" ? `Gekoppeld kierdichting: ${label}` : composed ? `Gekoppeld netto-component: ${label}` : `Gekoppeld aan dit vlak: ${label}`;
    }
    vlakFacadeEl.classList.add("ga-facade-select--locked");
    vlakFacadeEl.disabled = true;
    onFacadePick(false);
    updateFacadeHint();
    syncVlakMaterialGate();
    updateVlakInventory();
    return;
  }
  if (vlakFacadeLabelEl) vlakFacadeLabelEl.classList.remove("hidden");
  if (vlakFacadeLinkedEl) {
    vlakFacadeLinkedEl.hidden = true;
    vlakFacadeLinkedEl.textContent = "";
  }
  if (vlakFacadeComposeEl) {
    vlakFacadeComposeEl.hidden = true;
    vlakFacadeComposeEl.innerHTML = "";
  }
  vlakFacadeEl.classList.remove("ga-facade-select--locked");
  vlakFacadeEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  if (!expected.length) {
    ph.textContent = "\u2014 eerst ori\xEBntaties op plattegrond \u2014";
  } else if (!propsReady) {
    ph.textContent = "\u2014 eerst ori\xEBntaties op plattegrond \u2014";
  } else if (!available.length) {
    ph.textContent = !wantOri ? "\u2014 kies eerst een ori\xEBntatie hierboven \u2014" : assignedForOri.length ? `\u2014 alle materialen voor ${wantOri} zijn toebedeeld \u2014 zie toegevoegde vlakken \u2014` : readyForOri.length ? `\u2014 geen vrij materiaal meer voor ${wantOri} \u2014` : readyGroups.length ? `\u2014 geen componenten met ori\xEBntatie ${wantOri} (leg ori vast op geveltekening) \u2014` : incompleteN ? "\u2014 geen complete componenten (materiaal + ori\xEBntatie op gevel vereist) \u2014" : "\u2014 geen componenten voor deze VR \u2014";
  } else {
    ph.textContent = wantOri ? bundle ? `\u2014 kies materiaal voor ${ORIENTATIE_LABELS[wantOri] || wantOri} \xB7 groep ${pickNr} \u2014` : `\u2014 kies component voor ${ORIENTATIE_LABELS[wantOri] || wantOri} \xB7 groep ${pickNr} \u2014` : "\u2014 kies een materiaal (zelfde materiaal wordt opgeteld) \u2014";
  }
  vlakFacadeEl.appendChild(ph);
  const shown = canShowMaterials ? [...available] : [];
  for (const g of shown) {
    const o = document.createElement("option");
    o.value = g.primaryId;
    const base = formatFacadeGroupOption2(g);
    o.textContent = base;
    o.title = base;
    o.dataset.area = g.area_m2 != null ? Number(g.area_m2).toFixed(2) : "";
    o.dataset.length = g.length_m != null ? Number(g.length_m).toFixed(2) : "";
    o.dataset.quantityKind = g.quantity_kind === "length" ? "length" : "area";
    o.dataset.label = g.members.length > 1 ? g.members[0].material_name || g.label || "Vlak" : g.label || "";
    o.dataset.ready = g.ga_ready ? "1" : "0";
    o.dataset.memberIds = g.memberIds.join(",");
    o.dataset.count = String(g.members.length);
    const primary = g.members[0];
    o.dataset.materialId = (primary?.material_id || "").trim();
    o.dataset.catalogId = (primary?.catalog_id || "").trim();
    if (g.materialKey) o.dataset.materialKey = g.materialKey;
    vlakFacadeEl.appendChild(o);
  }
  vlakFacadeEl.size = Math.min(6, Math.max(3, shown.length + 1));
  let pick = "";
  if (canShowMaterials && prev && [...vlakFacadeEl.options].some((o) => o.value === prev)) {
    pick = prev;
  } else if (canShowMaterials && wantOri && shown.length === 1) {
    pick = shown[0].primaryId;
  } else if (canShowMaterials && wantOri && shown.length > 1 && !prev) {
    pick = shown[0].primaryId;
  }
  if (pick) vlakFacadeEl.value = pick;
  else vlakFacadeEl.value = "";
  onFacadePick(false);
  updateFacadeHint();
  syncVlakMaterialGate();
  syncListToVlakButton();
  updateVlakInventory();
}
function updateVlakInventory() {
  if (!vlakInventoryEl) return;
  if (!selectedVrId) {
    vlakInventoryEl.textContent = "";
    if (vlakCoverageEl) vlakCoverageEl.hidden = true;
    syncRecalcEnabled();
    return;
  }
  const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
  const focusGg = selectedPickGroepNr === 2 || selectedPickGroepNr === 3 ? selectedPickGroepNr : 1;
  const focusVlakken = focusOri ? vlakkenForOrientatie(focusOri) : [];
  const focusVlakkenGroep = focusVlakken.filter((v) => vlakGevelgroepNr(v) === focusGg);
  const stotaal = focusOri ? facadeStotaalM2(focusOri, focusGg) : 0;
  const deel = focusOri ? vlakkenDeeloppervlakM2(focusOri, focusGg) : 0;
  const materialSum = focusOri ? gevelMaterialSumM2(vrFacadesAsCoverageRows(), focusOri, focusGg) : 0;
  const oriBit = focusOri ? ` (${focusOri} \xB7 groep ${focusGg})` : "";
  const tol = stotaal > 0 ? Math.max(0.05, Math.round(stotaal * 0.01 * 100) / 100) : 0.05;
  const hasVlakken = focusVlakkenGroep.length > 0 && deel > 0;
  const materialOver = hasVlakken && stotaal > 0 && materialSum > stotaal + tol;
  const complete = stotaal > 0 && hasVlakken && !materialOver && Math.abs(stotaal - deel) <= tol;
  const over = stotaal > 0 && deel > stotaal + tol;
  let pct = 0;
  if (stotaal > 0 && hasVlakken) {
    pct = complete ? 100 : Math.max(0, Math.round(deel / stotaal * 1e3) / 10);
  }
  if (vlakCoverageEl && vlakCoveragePctEl && vlakCoverageBarEl && vlakCoverageMetaEl) {
    if (!focusOri) {
      vlakCoverageEl.hidden = true;
    } else {
      vlakCoverageEl.hidden = false;
      vlakCoverageEl.classList.remove("is-complete", "is-partial", "is-over");
      if (!(stotaal > 0)) {
        vlakCoveragePctEl.textContent = "0%";
        vlakCoverageBarEl.style.width = "0%";
        vlakCoverageMetaEl.textContent = focusVlakkenGroep.length ? `Groep ${focusGg}: nog geen Stotaal (geveloppervlakten) voor ori\xEBntatie ${focusOri}.` : `Groep ${focusGg}: 0% \u2014 nog geen vlakken toegekend.`;
      } else if (!hasVlakken) {
        vlakCoverageEl.classList.add("is-partial");
        vlakCoveragePctEl.textContent = "0%";
        vlakCoverageBarEl.style.width = "0%";
        const tekenBit = materialSum > stotaal + tol ? ` Tekening heeft nog ${materialSum.toFixed(2)} m\xB2 materialen (contour ${stotaal.toFixed(2)} m\xB2) \u2014 pas na \xABLijst naar vlak\xBB meet dit in de dekking.` : "";
        vlakCoverageMetaEl.textContent = `0 / ${stotaal.toFixed(2)} m\xB2 gedekt${oriBit} \u2014 nog geen vlakken.${tekenBit}`;
      } else if (over) {
        vlakCoverageEl.classList.add("is-over");
        vlakCoveragePctEl.textContent = `${pct}%`;
        vlakCoverageBarEl.style.width = "100%";
        vlakCoverageMetaEl.textContent = `Te veel${oriBit}: ${deel.toFixed(2)} / ${stotaal.toFixed(2)} m\xB2 \u2014 deeloppervlakten overschrijden Stotaal (${(deel - stotaal).toFixed(2)} m\xB2 te veel).`;
      } else if (materialOver) {
        vlakCoverageEl.classList.add("is-over");
        vlakCoveragePctEl.textContent = `${pct}%`;
        vlakCoverageBarEl.style.width = `${Math.min(100, pct)}%`;
        vlakCoverageMetaEl.textContent = `Vlakken ${deel.toFixed(2)} / ${stotaal.toFixed(2)} m\xB2${oriBit}, maar tekening ${materialSum.toFixed(2)} m\xB2 > contour \u2014 controleer hi\xEBrarchie (gevel \u2283 kozijn \u2283 ruit) of muurdelen samenvoegen.`;
      } else if (facadeOpeningsUncutFromWall(focusOri, focusGg)) {
        vlakCoverageEl.classList.add("is-partial");
        vlakCoveragePctEl.textContent = `${pct}%`;
        vlakCoverageBarEl.style.width = `${Math.min(100, pct)}%`;
        vlakCoverageMetaEl.textContent = `Stotaal ${stotaal.toFixed(2)} m\xB2${oriBit}: ${deel.toFixed(2)} m\xB2 op vlakken. Openingen nog niet in hi\xEBrarchie (tekening ${materialSum.toFixed(2)} m\xB2) \u2014 kozijn-tool of handmatige \xB1.`;
      } else if (complete) {
        vlakCoverageEl.classList.add("is-complete");
        vlakCoveragePctEl.textContent = "100%";
        vlakCoverageBarEl.style.width = "100%";
        vlakCoverageMetaEl.textContent = `Volledige dekking${oriBit}: ${deel.toFixed(2)} / ${stotaal.toFixed(2)} m\xB2 \u2014 materialen tellen op tot 100% van deze gevelgroep.`;
      } else {
        vlakCoverageEl.classList.add("is-partial");
        vlakCoveragePctEl.textContent = `${pct}%`;
        vlakCoverageBarEl.style.width = `${Math.min(100, pct)}%`;
        const rest = Math.max(0, stotaal - deel);
        vlakCoverageMetaEl.textContent = `${deel.toFixed(2)} / ${stotaal.toFixed(2)} m\xB2 gedekt${oriBit} \u2014 nog ${rest.toFixed(2)} m\xB2 (${Math.max(0, Math.round((100 - pct) * 10) / 10)}%) nodig tot 100%.`;
      }
    }
  }
  const used = usedFacadePickIds();
  const bundleInv = shouldBundleFacadesForOri(focusOri);
  const groups = groupFacadesForPick(vrFacades, used, {
    bundleSameMaterial: bundleInv
  }).filter((g) => {
    if (!g.ga_ready || !groupOrientatie(g)) return false;
    if (!focusOri) return true;
    if (groupOrientatie(g) !== focusOri) return false;
    return g.members.every((m) => facadeGevelgroepNr(m) === focusGg);
  });
  const linked = groups.filter(
    (g) => g.used || bundleInv && !materialHasFreeOrientatie2(g.materialKey)
  ).length;
  const free = groups.filter(
    (g) => !g.used && (bundleInv ? materialHasFreeOrientatie2(g.materialKey) : true)
  ).length;
  const expected = expectedOrientatiesForSelectedVr();
  const missingOri = expected.filter((o) => !orientatieTakenOnVr2(o, null));
  const bits = [
    bundleInv ? `Geveltekening: ${groups.length} materiaal-groep(en)` : `Geveltekening: ${groups.length} component(en) apart (multi-groep)`,
    `${linked} als vlak gekoppeld`,
    free ? `${free} nog toe te kennen` : "geen vrij materiaal"
  ];
  if (focusOri) {
    bits.unshift(
      `ori ${focusOri} \xB7 groep ${focusGg}: ${focusVlakkenGroep.length} vlak${focusVlakkenGroep.length === 1 ? "" : "ken"}`
    );
  }
  if (expected.length) {
    bits.push(
      missingOri.length ? `nog dekking nodig voor ori ${missingOri.join(", ")}` : `ori\xEBntaties gedekt (${expected.join(", ")})`
    );
  }
  if (focusOri && stotaal > 0) {
    bits.unshift(
      !hasVlakken ? `ori ${focusOri} \xB7 groep ${focusGg}: 0% \u2014 geen vlakken` : over ? `ori ${focusOri} \xB7 groep ${focusGg}: ${pct}% \u2014 vlakken > Stotaal` : complete ? `ori ${focusOri} \xB7 groep ${focusGg}: 100% Stotaal` : `ori ${focusOri} \xB7 groep ${focusGg}: ${pct}% van Stotaal`
    );
  } else if (focusOri && !focusVlakkenGroep.length) {
    bits.unshift(`ori ${ORIENTATIE_LABELS[focusOri] || focusOri} \xB7 groep ${focusGg}: nog geen vlakken`);
  }
  vlakInventoryEl.textContent = bits.join(" \xB7 ");
  syncRecalcEnabled();
}
function selectedVrNr() {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (!vr) return null;
  const room = roomFromVr(vr);
  if (room?.vr_nr) return room.vr_nr;
  const m = String(vr.omschrijving || "").match(/^VR\s+([^\s·]+)/i);
  return m ? m[1] : null;
}
async function loadFacadesForSelectedVr() {
  vrFacades = [];
  if (!auth() || !buildingId || !selectedVrId) {
    fillFacadeSelect();
    return;
  }
  const vrNr = selectedVrNr();
  if (!vrNr) {
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      vlakFacadeHintEl.textContent = "Geselecteerde VR heeft geen VR-nummer van de plattegrond.";
    }
    return;
  }
  try {
    const data = bppPhase1Enabled() ? await bppListVrFacadeComponents(invokeString, auth().token, buildingId, vrNr) : await apiGet(
      `/api/floormap/vr-components?building_id=${encodeURIComponent(buildingId)}&vr_nr=${encodeURIComponent(vrNr)}`
    );
    vrFacades = mapEligibleToVrFacades(data.eligible || []);
    fillPickGroepSelect(vlakOrientatieEl?.value, selectedPickGroepNr);
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      const n = vrFacades.length;
      const ready = vrFacades.filter((f) => f.ga_ready).length;
      const excl = data.counts?.excluded_as_source ?? 0;
      const used = usedFacadePickIds();
      const focusOriHint = normalizeOrientatie(vlakOrientatieEl?.value);
      const bundleHint = shouldBundleFacadesForOri(focusOriHint);
      const pickGroups = groupFacadesForPick(vrFacades, used, {
        bundleSameMaterial: bundleHint
      }).filter((g) => g.ga_ready && Boolean(groupOrientatie(g)));
      const merged = pickGroups.filter((g) => g.members.length > 1).length;
      const pickN = pickGroups.filter(
        (g) => !g.used && (bundleHint ? materialHasFreeOrientatie2(g.materialKey) : true)
      ).length;
      const already = pickGroups.filter(
        (g) => g.used || bundleHint && !materialHasFreeOrientatie2(g.materialKey)
      ).length;
      const incomplete = n - ready;
      const reusedMat = pickGroups.filter(
        (g) => !g.used && g.materialKey && orisUsedForMaterial2(g.materialKey).length > 0 && (bundleHint ? materialHasFreeOrientatie2(g.materialKey) : true)
      ).length;
      vlakFacadeHintEl.textContent = n === 0 ? `Geen gevelcomponenten voor VR ${vrNr}${excl ? ` (${excl} vervangen door zelfde-materiaal setbewerking)` : ""}.` : `VR ${vrNr}: ${ready} component(en) met materiaal + ori\xEBntatie \xB7 ${pickN} ${bundleHint ? "materiaal-groep(en)" : "component(en)"} kiesbaar` + (reusedMat && bundleHint ? ` \xB7 ${reusedMat}\xD7 zelfde materiaal opnieuw (andere ori\xEBntatie)` : "") + (already ? ` \xB7 ${already} al gekoppeld` : "") + (merged ? ` \xB7 ${merged}\xD7 zelfde materiaal opgeteld` : "") + (incomplete ? ` \xB7 ${incomplete} zonder materiaal (niet selecteerbaar)` : "") + (excl ? ` \xB7 ${excl} vervangen (zelfde materiaal)` : "") + (bundleHint ? `. Meerdere materialen per ori\xEBntatie; zelfde materiaal wordt opgeteld.` : `. Meerdere gevelgroepen: componenten apart \u2014 verdeel over groepen met eigen CL.`);
    }
  } catch (err) {
    vrFacades = [];
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      vlakFacadeHintEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}
function formatConstituentLine(c) {
  const code = (c.catalog_id || "").trim();
  const name = (c.material_name || c.label || "").trim();
  const mat = code && name ? `${code} \xB7 ${name}` : code || name || c.id.slice(0, 8);
  const area = c.area_m2 != null && Number.isFinite(c.area_m2) ? ` \xB7 ${c.area_m2.toFixed(2)} m\xB2` : "";
  return `${c.sign === "-" ? "\u2212" : "+"} ${mat}${area}`;
}
function renderFacadeComposeBreakdown(facId) {
  if (!vlakFacadeComposeEl) return;
  vlakFacadeComposeEl.innerHTML = "";
  const id = (facId || "").trim();
  const fac = id ? vrFacades.find((f) => f.id === id) : null;
  const parts = fac?.constituents?.length ? fac.constituents : [];
  if (!fac || !parts.length) {
    vlakFacadeComposeEl.hidden = true;
    return;
  }
  const head = document.createElement("li");
  head.className = "ga-facade-compose-head";
  head.textContent = "Opbouw gevelvlak (+/\u2212):";
  vlakFacadeComposeEl.appendChild(head);
  const netto = document.createElement("li");
  netto.className = "ga-facade-compose-netto";
  const code = (fac.catalog_id || "").trim();
  const name = (fac.material_name || fac.label || "").trim();
  const mat = code && name ? `${code} \xB7 ${name}` : code || name || "netto";
  const area = fac.area_m2 != null && Number.isFinite(fac.area_m2) ? ` \xB7 ${Number(fac.area_m2).toFixed(2)} m\xB2` : "";
  netto.textContent = `= ${mat}${area} (netto in berekening)`;
  vlakFacadeComposeEl.appendChild(netto);
  for (const c of parts) {
    const li = document.createElement("li");
    li.className = c.sign === "-" ? "ga-facade-compose-minus" : "ga-facade-compose-plus";
    li.textContent = formatConstituentLine(c);
    vlakFacadeComposeEl.appendChild(li);
  }
  vlakFacadeComposeEl.hidden = false;
}
function updateFacadeHint() {
  if (!vlakFacadePreviewEl) return;
  const opt = vlakFacadeEl.selectedOptions[0];
  const id = (vlakFacadeEl.value || "").trim();
  if (!opt || !id) {
    vlakFacadePreviewEl.textContent = "\u2014";
    vlakFacadePreviewEl.classList.add("is-empty");
    renderFacadeComposeBreakdown(null);
    return;
  }
  const fac = vrFacades.find((f) => f.id === id);
  const code = (fac?.catalog_id || opt.dataset.catalogId || "").trim();
  const name = (fac?.material_name || "").trim();
  const hasMat = Boolean((fac?.material_id || opt.dataset.materialId || "").trim());
  if (hasMat) {
    const matLabel = code && name ? `${code} \xB7 ${name}` : code || name || "materiaal gekoppeld";
    const composed = fac?.boolean_op === "compose" || fac?.boolean_op === "difference" ? " \xB7 samengesteld (\xB1)" : "";
    const matKey = (opt.dataset.materialKey || "").trim() || (fac ? materialGroupKey(fac) : null) || "";
    const oris = matKey ? orisUsedForMaterial2(matKey, selectedVlakId) : [];
    const oriBit = oris.length ? ` \xB7 al als vlak met ori ${oris.join(", ")}` : "";
    const chosen = normalizeOrientatie(vlakOrientatieEl?.value);
    const nextBit = chosen ? ` \xB7 dit vlak krijgt ori ${chosen}` : "";
    const nParts = Number(opt.dataset.count || "1");
    const sumBit = nParts > 1 ? ` \xB7 ${nParts} componenten opgeteld` : "";
    vlakFacadePreviewEl.textContent = `Netto-materiaal: ${matLabel}${composed}${sumBit} \u2014 RA op geveltekening; CL/Cg bij het vlak${oriBit}${nextBit}`;
  } else {
    vlakFacadePreviewEl.textContent = "Geen materiaal \u2014 incomplete componenten staan niet in de keuzelijst; koppel eerst op de geveltekening.";
  }
  vlakFacadePreviewEl.classList.toggle("is-empty", !hasMat);
  vlakFacadePreviewEl.classList.toggle("is-warn", !hasMat);
  renderFacadeComposeBreakdown(id);
}
function updateRoomPreview() {
  if (!roomPreviewEl) return;
  const r = selectedFreeRoom();
  if (!r) {
    roomPreviewEl.textContent = "Geen vrije ruimte geselecteerd";
    roomPreviewEl.classList.add("is-empty");
  } else {
    roomPreviewEl.textContent = formatRoomSummary(r);
    roomPreviewEl.classList.remove("is-empty");
  }
  if (!selectedVrId) updateSectionPreview();
}
function syncVlakQtyUi(kind, value, fromFacade = false) {
  const isLen = kind === "length";
  if (vlakQtyLabelEl) vlakQtyLabelEl.textContent = isLen ? "l [m]" : "S [m\xB2]";
  vlakAreaEl.dataset.quantityKind = isLen ? "length" : "area";
  if (value != null && value !== "") vlakAreaEl.value = value;
  vlakAreaEl.readOnly = fromFacade;
  vlakAreaEl.title = fromFacade ? isLen ? "Lengte uit gevelcomponent (actueel van plattegrond/doorsnede)" : "Oppervlakte uit gevelcomponent (actueel van plattegrond/doorsnede)" : "";
}
function onFacadePick(forceName = false) {
  const opt = vlakFacadeEl.selectedOptions[0];
  updateFacadeHint();
  if (!opt || !opt.value) {
    syncVlakQtyUi("area", "0", false);
    if (!selectedVlakId) syncVlakMaterialGate();
    return;
  }
  const isLen = opt.dataset.quantityKind === "length";
  syncVlakQtyUi(
    isLen ? "length" : "area",
    isLen ? opt.dataset.length || "0" : opt.dataset.area || "0",
    true
  );
  if (forceName || !vlakNameEl.value.trim()) {
    vlakNameEl.value = opt.dataset.label || "Vlak";
  }
  if (!selectedVlakId) {
    syncOrientatieDisplay();
    syncVlakMaterialGate();
  }
}
function refreshFreeRoomsFromLinks() {
  rebuildLinkedForSelectedVariant();
  freeRooms = [...floormapRoomsById.values()].filter((r) => !linkedSubIds.has(r.id));
  fillRoomSelect();
}
async function loadVariants() {
  if (!buildingId || !auth()) return;
  const ret = await invokeString("API_ListVariants", [auth().token, buildingId]);
  const data = parseJsonOk2(ret);
  variants = data.variants || [];
  const remembered = readRememberedGaSelection();
  if (!selectedVariantId && remembered?.variantId) selectedVariantId = remembered.variantId;
  if (!selectedVariantId && variants.length) selectedVariantId = variants[0].variant_id;
  if (selectedVariantId && !variants.some((v) => v.variant_id === selectedVariantId)) {
    selectedVariantId = variants[0]?.variant_id ?? null;
  }
  refreshFreeRoomsFromLinks();
  renderVariants();
  renderComparePick();
  const cur = variants.find((v) => v.variant_id === selectedVariantId);
  if (cur) fillVariantForm(cur);
  const preferVg = pendingImportSubId ? null : remembered?.vgId || null;
  const preferVr = pendingImportSubId ? null : remembered?.vrId || null;
  await loadVgs(preferVg, preferVr);
  const flowNr = normalizeFlowVrNr(pendingImportVrNr) || normalizeFlowVrNr(params.get("vr_nr")) || normalizeFlowVrNr(readFlowVr(buildingId)?.vr_nr);
  if (flowNr) {
    await applyFlowVrPreference(flowNr);
  } else if (selectedVrId && buildingId) {
    const nr = vrNrForVrId(selectedVrId);
    if (nr) {
      const vrRow = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
      const room = vrRow ? roomFromVr(vrRow) : null;
      persistFlowVr(
        buildingId,
        nr,
        room?.vg_nr != null && Number.isFinite(Number(room.vg_nr)) ? Number(room.vg_nr) : null
      );
    }
  }
}
function fillVariantForm(v) {
  variantNameEl.value = v.omschrijving;
  variantFunctieEl.value = v.gebruiksfunctie;
  variantLbEl.value = String(v.geluidsbelasting_dba);
  variantSpectrumEl.value = v.spectrum_kind;
}
function renderVariants() {
  variantListEl.innerHTML = "";
  if (!variants.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nog geen variant \u2014 vul het formulier in en sla op.";
    variantListEl.appendChild(li);
    return;
  }
  for (const v of variants) {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (v.variant_id === selectedVariantId) li.classList.add("selected");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "drawing-list-select";
    btn.textContent = `${v.omschrijving} \xB7 ${v.geluidsbelasting_dba} dB \xB7 ${v.spectrum_kind}`;
    btn.addEventListener("click", () => {
      selectedVariantId = v.variant_id;
      fillVariantForm(v);
      refreshFreeRoomsFromLinks();
      renderVariants();
      renderComparePick();
      rememberGaSelection();
      void loadVgs();
    });
    li.appendChild(btn);
    variantListEl.appendChild(li);
  }
}
function renderComparePick() {
  if (!comparePickEl) return;
  comparePickEl.innerHTML = "";
  if (variants.length < 2) {
    comparePickEl.innerHTML = `<p class="hint">Maak of kopieer een tweede variant om te vergelijken.</p>`;
    return;
  }
  for (const v of variants) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = v.variant_id;
    cb.checked = compareSelectedIds.has(v.variant_id);
    cb.addEventListener("change", () => {
      if (cb.checked) compareSelectedIds.add(v.variant_id);
      else compareSelectedIds.delete(v.variant_id);
    });
    label.appendChild(cb);
    label.appendChild(
      document.createTextNode(
        ` ${v.omschrijving} \xB7 Lb ${v.geluidsbelasting_dba} dB \xB7 ${v.spectrum_kind}`
      )
    );
    comparePickEl.appendChild(label);
  }
}
function fmtCompareNum(n) {
  if (n == null || !Number.isFinite(Number(n))) return "\u2014";
  return String(round1(Number(n)));
}
async function runVariantCompare() {
  if (!auth() || !buildingId || !compareTableEl || !compareWrapEl) return;
  const ids = [...compareSelectedIds].filter((id) => variants.some((v) => v.variant_id === id));
  if (ids.length < 2) throw new Error("Selecteer minstens twee varianten");
  const ret = await invokeString("API_CompareVariants", [auth().token, buildingId, ids.join(",")]);
  const data = parseJsonOk2(ret);
  const rows = data.rows || [];
  const bySub = /* @__PURE__ */ new Map();
  for (const r of rows) {
    let entry = bySub.get(r.subsection_id);
    if (!entry) {
      const room = floormapRoomsById.get(r.subsection_id);
      const label = r.vr_nr ? `VR ${r.vr_nr}${r.omschrijving ? ` \xB7 ${r.omschrijving}` : ""}` : r.omschrijving || r.subsection_id.slice(0, 8);
      entry = { label: room ? vrLabelFromNr(room.vr_nr || r.vr_nr, room.label) : label, byVariant: /* @__PURE__ */ new Map() };
      bySub.set(r.subsection_id, entry);
    }
    entry.byVariant.set(r.variant_id, r);
  }
  const selectedVariants = ids.map((id) => variants.find((v) => v.variant_id === id)).filter((v) => Boolean(v));
  const thead = compareTableEl.querySelector("thead");
  const tbody = compareTableEl.querySelector("tbody");
  if (!thead || !tbody) return;
  thead.innerHTML = "";
  tbody.innerHTML = "";
  const hr = document.createElement("tr");
  hr.innerHTML = `<th>Ruimte</th>`;
  for (const v of selectedVariants) {
    const th = document.createElement("th");
    th.innerHTML = `${esc(v.omschrijving)}<br><span class="hint">Lb ${esc(String(v.geluidsbelasting_dba))} \xB7 ${esc(v.spectrum_kind)} \xB7 ${esc(v.gebruiksfunctie)}</span>`;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  const sortedSubs = [...bySub.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, "nl"));
  for (const [, entry] of sortedSubs) {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = entry.label;
    tr.appendChild(td0);
    const cellVals = [];
    for (const v of selectedVariants) {
      const r = entry.byVariant.get(v.variant_id);
      const grens = grenswaardeLbik(v.gebruiksfunctie);
      const gak = r?.gak_dba != null ? Number(r.gak_dba) : null;
      const lb = Number(v.geluidsbelasting_dba);
      const lbik = gak != null && Number.isFinite(lb) ? round1(lb - gak) : null;
      const toets = lbik != null ? lbik <= grens : null;
      const ga = r?.ga_dba != null ? Number(r.ga_dba) : null;
      const text = `GA ${fmtCompareNum(ga)} \xB7 GA;k ${fmtCompareNum(gak)} \xB7 Lbi;k ${fmtCompareNum(lbik)}` + (toets == null ? " \xB7 \u2014" : toets ? " \xB7 Voldoet" : " \xB7 Voldoet niet");
      cellVals.push({ lbik, toets, text });
    }
    const lbiks = cellVals.map((c) => c.lbik).filter((x) => x != null);
    const allSame = lbiks.length <= 1 || lbiks.every((x) => Math.abs(x - lbiks[0]) < 0.05);
    const toetsDiff = new Set(cellVals.map((c) => String(c.toets))).size > 1;
    for (const c of cellVals) {
      const td = document.createElement("td");
      td.textContent = c.text;
      if (c.toets === true) td.classList.add("toets-ok");
      if (c.toets === false) td.classList.add("toets-fail");
      if (!allSame || toetsDiff) td.classList.add("ga-compare-diff");
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  if (!sortedSubs.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="${selectedVariants.length + 1}">Geen gedeelde ruimten in de geselecteerde varianten.</td>`;
    tbody.appendChild(tr);
  }
  compareWrapEl.classList.remove("hidden");
}
async function loadVgs(preferVgId, preferVrId) {
  vgs = [];
  vrs = [];
  vlakken = [];
  vrOriPresentById.clear();
  vrVlakkenById.clear();
  vrCopyLabelById.clear();
  let keepVg = preferVgId || selectedVgId;
  const keepVr = preferVrId || selectedVrId;
  selectedVgId = null;
  selectedVrId = null;
  if (!selectedVariantId || !auth()) {
    renderVgs();
    renderVrs();
    renderVlakken();
    vrEditForm.classList.add("hidden");
    return;
  }
  const ret = await invokeString("API_ListVerblijfsgebieden", [auth().token, selectedVariantId]);
  const data = parseJsonOk2(ret);
  vgs = sortByLabelAz(data.verblijfsgebieden || [], vgDisplayTitle);
  const moved = await syncVrVgMembershipFromFloormap();
  await syncVgTitlesFromFloormap();
  vgs = sortByLabelAz(vgs, vgDisplayTitle);
  if (moved > 0) {
    setConn(
      "ok",
      moved === 1 ? "VG-indeling bijgewerkt van plattegrond (1 VR verplaatst)" : `VG-indeling bijgewerkt van plattegrond (${moved} VR\u2019s verplaatst)`
    );
  }
  if (keepVg && vgs.some((g) => g.verblijfsgebied_id === keepVg)) selectedVgId = keepVg;
  else if (vgs.length) selectedVgId = vgs[0].verblijfsgebied_id;
  renderVgs();
  await loadVrs(keepVr ?? null);
  if (keepVr && selectedVrId !== keepVr) {
    const ownerVg = await findVgIdForVr(keepVr);
    if (ownerVg && ownerVg !== selectedVgId) {
      selectedVgId = ownerVg;
      renderVgs();
      await loadVrs(keepVr);
    }
  }
  rememberGaSelection();
}
async function syncVgTitlesFromFloormap() {
  if (!auth()) return;
  let changed = false;
  for (const g of vgs) {
    const nr = vgNrForVg(g.verblijfsgebied_id, g.omschrijving);
    if (nr == null) continue;
    const want = vgLabelFromNr(nr);
    if (g.omschrijving.trim() === want) continue;
    const ret = await invokeString("API_SaveVerblijfsgebied", [
      auth().token,
      g.verblijfsgebied_id,
      want,
      String(g.sort_order ?? 0)
    ]);
    if (ret.startsWith("ERROR")) continue;
    g.omschrijving = want;
    changed = true;
  }
  if (changed) {
  }
}
function renderVgs() {
  vgListEl.innerHTML = "";
  if (!vgs.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nog geen verblijfsgebied \u2014 kies een plattegrondruimte met VG/VR en start een nieuw VG.";
    vgListEl.appendChild(li);
    syncVrHeading();
    fillRoomSelect();
    return;
  }
  for (const g of vgs) {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (g.verblijfsgebied_id === selectedVgId) li.classList.add("selected");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "drawing-list-select";
    const title = vgDisplayTitle(g);
    const floor = floorLevelForVg(g.verblijfsgebied_id);
    const vrShown = floormapRoomsForVg(g.verblijfsgebied_id).length || g.vr_count;
    const n = vrShown === 1 ? "1 VR" : `${vrShown} VR\u2019s`;
    const floorBit = floor ? ` \xB7 ${levelLabel(floor)}` : "";
    const vrNrs = vgVrNrSummary(g.verblijfsgebied_id);
    const vrBit = vrNrs ? ` \xB7 ${vrNrs}` : "";
    btn.textContent = `${title}${floorBit} \xB7 ${n}${vrBit}`;
    btn.title = vrNrs ? `Toon verblijfsruimten in dit VG (${vrNrs})` : "Toon verblijfsruimten in dit VG";
    btn.addEventListener("click", () => {
      selectedVgId = g.verblijfsgebied_id;
      selectedVrId = null;
      renderVgs();
      void loadVrs().then(() => rememberGaSelection());
    });
    li.appendChild(btn);
    vgListEl.appendChild(li);
  }
  syncVrHeading();
  fillRoomSelect();
}
function syncVrHeading() {
  const g = vgs.find((x) => x.verblijfsgebied_id === selectedVgId);
  if (vrHeadingEl) {
    if (!g) {
      vrHeadingEl.textContent = "Verblijfsruimten";
    } else {
      const title = vgDisplayTitle(g);
      const floor = floorLevelForVg(g.verblijfsgebied_id);
      vrHeadingEl.textContent = floor ? `Verblijfsruimten in ${title} (${levelLabel(floor)})` : `Verblijfsruimten in ${title}`;
    }
  }
  if (vrEmptyHintEl) {
    vrEmptyHintEl.classList.toggle("hidden", Boolean(selectedVgId));
    if (!selectedVgId) {
      vrEmptyHintEl.textContent = "Selecteer een verblijfsgebied hierboven om de VR\u2019s te zien.";
    }
  }
}
async function loadVrs(preferVrId) {
  vrs = [];
  vlakken = [];
  const keepVr = preferVrId || selectedVrId;
  selectedVrId = null;
  if (!selectedVgId || !auth()) {
    renderVrs();
    renderVlakken();
    vrEditForm.classList.add("hidden");
    syncVrHeading();
    return;
  }
  const ret = await invokeString("API_ListVerblijfsruimten", [auth().token, selectedVgId]);
  const data = parseJsonOk2(ret);
  vrs = sortByLabelAz(
    vrsMatchingFloormapVg(selectedVgId, data.verblijfsruimten || []),
    (r) => r.omschrijving || ""
  );
  for (const id of [...freshResultVrIds]) {
    const vr = vrs.find((r) => r.verblijfsruimte_id === id);
    if (!vr || vr.ga_dba == null && vr.lbi_dba == null && vr.gak_dba == null) {
      freshResultVrIds.delete(id);
      vrVoldoet.delete(id);
    }
  }
  if (keepVr && vrs.some((r) => r.verblijfsruimte_id === keepVr)) selectedVrId = keepVr;
  else if (vrs.length) selectedVrId = vrs[0].verblijfsruimte_id;
  syncVrHeading();
  renderVrs();
  await loadVlakken({ resetForm: true, openFirstVlak: true });
  try {
    await hydrateVrOriCoverage();
  } catch {
  }
  renderVrs();
  rememberGaSelection();
}
function renderVrs() {
  vrListEl.innerHTML = "";
  if (!selectedVgId) {
    syncVrHeading();
    vrEditForm.classList.add("hidden");
    return;
  }
  if (!vrs.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nog geen VR in dit VG \u2014 voeg een plattegrondruimte toe.";
    vrListEl.appendChild(li);
    vrEditForm.classList.add("hidden");
    return;
  }
  for (const r of vrs) {
    const room = roomFromVr(r);
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (r.verblijfsruimte_id === selectedVrId) li.classList.add("selected");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "drawing-list-select";
    btn.title = r.verblijfsruimte_id === selectedVrId ? "Deze VR is geselecteerd (rood kader)" : "Selecteer deze VR";
    const inner = document.createElement("span");
    inner.className = "drawing-list-select-inner";
    const label = document.createElement("span");
    label.className = "drawing-list-select-label";
    if (room) {
      const metrics = effectiveVrMetrics(r);
      label.textContent = formatVrListLine(room, metrics.volume);
    } else {
      const metrics = effectiveVrMetrics(r);
      label.textContent = `${r.omschrijving} \xB7 ${metrics.vloer.toFixed(2)} m\xB2 \xB7 V=${metrics.volume.toFixed(1)} m\xB3`;
    }
    if (r.gak_dba != null || r.ga_dba != null || r.lbi_dba != null) {
      if (!vrVoldoet.has(r.verblijfsruimte_id)) {
        const t = deriveToetsFromStored(r);
        if (t != null) vrVoldoet.set(r.verblijfsruimte_id, t);
      }
      const source = freshResultVrIds.has(r.verblijfsruimte_id) ? "" : " (opgeslagen)";
      const bits = [
        r.ga_dba != null ? `GA=${round1(r.ga_dba)}` : null,
        r.lbi_dba != null ? `Lbi=${round1(r.lbi_dba)}` : null,
        r.gak_dba != null ? `GA;k=${round1(r.gak_dba)}` : null,
        vrVoldoet.get(r.verblijfsruimte_id) === true ? "Voldoet" : vrVoldoet.get(r.verblijfsruimte_id) === false ? "Voldoet niet" : null
      ].filter(Boolean);
      label.textContent += ` \xB7 ${bits.join(" \xB7 ")}${source}`;
    } else if (r.verblijfsruimte_id === selectedVrId) {
      label.textContent += " \xB7 herberekenen";
    }
    inner.appendChild(label);
    appendVrOriLedStrip(inner, r);
    btn.appendChild(inner);
    btn.addEventListener("click", () => {
      selectedVrId = r.verblijfsruimte_id;
      selectedVlakId = null;
      if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak vullen";
      vlakCancelBtn?.classList.add("hidden");
      rememberGaSelection();
      fillVrEdit(r);
      renderVrs();
      void loadVlakken({ resetForm: true, openFirstVlak: true });
    });
    li.appendChild(btn);
    vrListEl.appendChild(li);
  }
  const cur = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (cur) fillVrEdit(cur);
  else {
    vrEditForm.classList.add("hidden");
    updateSectionPreview();
  }
}
function effectiveVrMetrics(r) {
  const room = roomFromVr(r);
  const hoogte = Number(r.hoogte_m) || 0;
  const liveFloor = room?.area_m2 != null && Number.isFinite(Number(room.area_m2)) ? Number(room.area_m2) : null;
  const vloer = liveFloor != null ? liveFloor : Number(r.vloer_m2) || 0;
  const volume = vloer > 0 && hoogte > 0 ? Math.round(vloer * hoogte * 100) / 100 : Number(r.volume_m3) || 0;
  return { vloer, volume };
}
function liveVlakQty(v) {
  const kind = v.quantity_kind === "length" ? "length" : "area";
  const stored = kind === "length" ? Number(v.length_m ?? 0) : Number(v.area_m2 ?? 0);
  if (v.prefer_stored_qty && Number.isFinite(stored) && stored > 0) {
    return { kind, qty: Math.round(stored * 100) / 100 };
  }
  const facId = v.facade_subsection_id;
  if (!facId || !vrFacades.length) return { kind, qty: stored };
  const fac = findFacadeForVlak(v);
  if (!fac) return { kind, qty: stored };
  const key2 = materialGroupKey(fac);
  const ori = facadeOrientatie(fac);
  const peers = key2 ? vrFacades.filter(
    (f) => materialGroupKey(f) === key2 && facadeOrientatie(f) === ori
  ) : [fac];
  let shareCount = 0;
  if (key2) {
    for (const other of vlakken) {
      if (!(other.facade_subsection_id || "").trim()) continue;
      const of = findFacadeForVlak(other);
      if (of && materialGroupKey(of) === key2 && facadeOrientatie(of) === ori) shareCount += 1;
    }
  }
  const sources = shareCount > 1 ? [fac] : peers;
  if (kind === "length") {
    let sum2 = 0;
    let any2 = false;
    for (const p of sources) {
      if (p.length_m != null && Number.isFinite(Number(p.length_m))) {
        sum2 += Number(p.length_m);
        any2 = true;
      }
    }
    return { kind, qty: any2 ? Math.round(sum2 * 100) / 100 : stored };
  }
  let sum = 0;
  let any = false;
  for (const p of sources) {
    const a = effectiveFacadeAreaM2(p);
    if (Number.isFinite(a) && a > 0) {
      sum += a;
      any = true;
    }
  }
  return { kind, qty: any ? Math.round(sum * 100) / 100 : stored };
}
function fillVrEdit(r) {
  vrEditForm.classList.remove("hidden");
  const room = roomFromVr(r);
  const metrics = effectiveVrMetrics(r);
  if (vrEditPreviewEl) {
    vrEditPreviewEl.textContent = room ? formatRoomSummary(room) : r.omschrijving;
    vrEditPreviewEl.classList.toggle("is-empty", !room && !r.omschrijving);
  }
  vrEditNameEl.value = r.omschrijving;
  vrEditVloerEl.value = metrics.vloer.toFixed(2);
  vrEditHoogteEl.value = Number(r.hoogte_m).toFixed(2);
  vrEditVolumeEl.value = metrics.volume.toFixed(2);
  vrEditT0El.value = String(r.t0_s);
  vrEditVloerEl.readOnly = Boolean(room);
  vrEditVloerEl.title = room ? "Vloeroppervlak uit plattegrondruimte (actueel)" : "";
  vrEditVolumeEl.readOnly = true;
  vrEditVolumeEl.title = "Volume = vloer \xD7 hoogte";
  r.vloer_m2 = metrics.vloer;
  r.volume_m3 = metrics.volume;
  syncVrVolumeFromInputs();
  updateSectionPreview();
}
function syncVrVolumeFromInputs() {
  const vloer = Number(vrEditVloerEl.value);
  const hoogte = Number(vrEditHoogteEl.value);
  if (vloer > 0 && hoogte > 0) {
    vrEditVolumeEl.value = (vloer * hoogte).toFixed(2);
  }
}
async function loadVlakken(opts) {
  vlakken = [];
  if (!selectedVrId || !auth()) {
    gevelgroepen = [];
    selectedGevelgroepId = null;
    selectedPickGroepNr = 1;
    fillPickGroepSelect();
    renderVlakken();
    await loadFacadesForSelectedVr();
    syncOrientatieSelectOptions();
    updateVlakOriCompletenessHint();
    return;
  }
  const ret = await invokeString("API_ListVlakken", [auth().token, selectedVrId]);
  const data = parseJsonOk2(ret);
  vlakken = data.vlakken || [];
  rememberVrOriPresent(selectedVrId, vlakken);
  await loadGevelgroepen();
  await loadFacadesForSelectedVr();
  syncOrientatieSelectOptions();
  renderVlakken();
  renderVrs();
  const cur = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (cur) {
    fillVrEdit(cur);
    if (vlakken.length && selectedVlakId) hydrateStoredVrResults(cur);
  }
  if (opts?.openFirstVlak && vlakken.length) {
    if (vlakkenMatchFacadeStotaal()) {
      fillVlakEdit(vlakken[0]);
      await refreshVrCalc({ persist: false });
    } else {
      selectedVlakId = null;
      if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak vullen";
      vlakCancelBtn?.classList.add("hidden");
      applyVlakFormDefaultsFromExisting();
      fillFacadeSelect();
      syncVlakMaterialGate();
      updateVlakOriCompletenessHint();
      syncOrientatieDisplay();
      renderVlakken();
      if (vlakEditHintEl) {
        vlakEditHintEl.textContent = "Oppervlaktedekking is nog geen 100%. Kies een ori\xEBntatie en daarna bij 2. een nog vrij materiaal.";
      }
    }
    return;
  }
  if (!selectedVlakId) {
    if (opts?.resetForm) {
      applyVlakFormDefaultsFromExisting();
    } else {
      const expected = expectedOrientatiesForSelectedVr();
      const cur2 = normalizeOrientatie(vlakOrientatieEl?.value);
      if (vlakOrientatieEl) {
        if (cur2 && expected.includes(cur2)) {
          ensureOrientatieOption(cur2);
          vlakOrientatieEl.value = cur2;
        }
      }
      fillFacadeSelect();
      syncVlakMaterialGate();
      updateVlakOriCompletenessHint();
      syncOrientatieDisplay();
    }
    if (!vlakkenMatchFacadeStotaal()) {
      const incompleteOri = normalizeOrientatie(vlakOrientatieEl?.value) || facadeOrisWithArea().find((o) => !vlakkenMatchFacadeStotaal(o)) || "";
      clearVrResults(
        incompleteOri ? `Stotaal voor ori\xEBntatie ${incompleteOri} is nog geen 100% \u2014 vul vlakken aan, daarna Herberekenen. Vorige GA;k blijft bewaard tot een geslaagde herberekening.` : "Stotaal-dekking is nog geen 100% \u2014 vul vlakken per ori\xEBntatie aan. Vorige GA;k blijft bewaard tot een geslaagde herberekening.",
        { keepStored: true }
      );
    } else {
      blankResultsUntilVlakSelected();
    }
    return;
  }
  updateVlakOriCompletenessHint();
  await refreshVrCalc();
}
function fmtRes(v) {
  return v != null && Number.isFinite(v) ? String(round1(v)) : "\u2014";
}
function vrHasStoredResults(r) {
  return r.ga_dba != null || r.lbi_dba != null || r.gak_dba != null;
}
function deriveToetsFromStored(vr) {
  const variant = variants.find((v) => v.variant_id === selectedVariantId);
  const Lb = Number(variant?.geluidsbelasting_dba ?? 0);
  const gak = vr.gak_dba != null && Number.isFinite(Number(vr.gak_dba)) ? Number(vr.gak_dba) : null;
  if (gak == null || !Number.isFinite(Lb)) return null;
  const lbik = round1(Lb - gak);
  const grens = grenswaardeLbik(variant?.gebruiksfunctie);
  return lbik <= grens;
}
function hydrateStoredVrResults(vr, hintExtra) {
  if (!vrHasStoredResults(vr)) return false;
  const variant = variants.find((v) => v.variant_id === selectedVariantId);
  const Lb = Number(variant?.geluidsbelasting_dba ?? 0);
  const grens = grenswaardeLbik(variant?.gebruiksfunctie);
  const gak = vr.gak_dba != null && Number.isFinite(Number(vr.gak_dba)) ? Number(vr.gak_dba) : null;
  const lbik = gak != null && Number.isFinite(Lb) ? round1(Lb - gak) : null;
  const voldoet = deriveToetsFromStored(vr);
  if (voldoet != null) vrVoldoet.set(vr.verblijfsruimte_id, voldoet);
  else vrVoldoet.delete(vr.verblijfsruimte_id);
  if (resSEl) resSEl.textContent = "\u2014";
  if (resRpEl) resRpEl.textContent = "\u2014";
  if (resDEl) resDEl.textContent = "\u2014";
  if (resGaEl) resGaEl.textContent = `${fmtRes(vr.ga_dba)} dB`;
  if (resLbiEl) resLbiEl.textContent = `${fmtRes(vr.lbi_dba)} dB`;
  if (resGakEl) resGakEl.textContent = `${fmtRes(vr.gak_dba)} dB`;
  if (resLbikEl) resLbikEl.textContent = lbik != null ? `${fmtRes(lbik)} dB` : "\u2014";
  if (resToetsEl) {
    resToetsEl.classList.remove("toets-ok", "toets-fail");
    if (voldoet === true) {
      resToetsEl.textContent = "Voldoet";
      resToetsEl.classList.add("toets-ok");
    } else if (voldoet === false) {
      resToetsEl.textContent = "Voldoet niet";
      resToetsEl.classList.add("toets-fail");
    } else {
      resToetsEl.textContent = "\u2014";
    }
  }
  const dirtyBit = resultsDirty ? " \xB7 niet opgeslagen" : " \xB7 opgeslagen";
  const req = gak != null ? ` \xB7 GA;k \u2265 ${fmtRes(Lb - grens)} dB (Lb\u2212${grens})` : "";
  if (vrResultsHintEl) {
    vrResultsHintEl.textContent = `Opgeslagen resultaten${dirtyBit} \xB7 grens Lbi;k \u2264 ${grens} dB${req}${hintExtra ? ` \xB7 ${hintExtra}` : ""}`;
    vrResultsHintEl.classList.remove("hidden");
  }
  return true;
}
function clearVrResults(hint, opts) {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (opts?.keepStored !== false && vr && vrHasStoredResults(vr)) {
    hydrateStoredVrResults(vr, hint);
    lastFreshGaResult = null;
    setAnalyzeEnabled(deriveToetsFromStored(vr) === false);
    hideAnalyzePanel();
    return;
  }
  lastFreshGaResult = null;
  hideAnalyzePanel();
  setAnalyzeEnabled(false);
  if (vrResultsHintEl) {
    if (hint) {
      vrResultsHintEl.textContent = hint;
      vrResultsHintEl.classList.remove("hidden");
    } else {
      vrResultsHintEl.textContent = "";
      vrResultsHintEl.classList.add("hidden");
    }
  }
  if (resSEl) resSEl.textContent = "\u2014";
  if (resRpEl) resRpEl.textContent = "\u2014";
  if (resDEl) resDEl.textContent = "\u2014";
  if (resGaEl) resGaEl.textContent = "\u2014";
  if (resLbiEl) resLbiEl.textContent = "\u2014";
  if (resGakEl) resGakEl.textContent = "\u2014";
  if (resLbikEl) resLbikEl.textContent = "\u2014";
  if (resToetsEl) {
    resToetsEl.textContent = "\u2014";
    resToetsEl.classList.remove("toets-ok", "toets-fail");
  }
}
function blankResultsUntilVlakSelected(hint) {
  calcRevealEpoch += 1;
  clearVrResults(
    hint || "Open een vlak in de lijst om de berekening te tonen, of voeg een nieuw vlak toe voor een vrije ori\xEBntatie.",
    { keepStored: false }
  );
}
function resultsRevealAllowed(opts) {
  if (opts?.reveal) return true;
  if (opts?.useFormCorrections && selectedVlakId) return true;
  const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
  if (focusOri && vlakkenForOrientatie(focusOri).length === 0) return false;
  return Boolean(selectedVlakId);
}
async function clearPersistedVrCalc(hint) {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  clearVrResults(hint, { keepStored: false });
  if (!hint && vrResultsHintEl) {
    vrResultsHintEl.textContent = "";
    vrResultsHintEl.classList.add("hidden");
  }
  if (!vr) return;
  vr.ga_dba = null;
  vr.lbi_dba = null;
  vr.gak_dba = null;
  vrVoldoet.delete(vr.verblijfsruimte_id);
  freshResultVrIds.delete(vr.verblijfsruimte_id);
  resultsDirty = false;
  renderVrs();
  if (!auth()) return;
  try {
    const ret = await invokeString("API_SaveVerblijfsruimteResults", [
      auth().token,
      vr.verblijfsruimte_id,
      "",
      "",
      ""
    ]);
    if (typeof ret === "string" && ret.startsWith("ERROR")) {
      setConn("err", `Resultaten niet gewist: ${ret}`);
    }
  } catch (err) {
    setConn("err", `Resultaten niet gewist: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function facadeToCoverageRow(f) {
  return {
    id: f.id,
    area_m2: f.area_m2,
    kozijn_role: f.kozijn_role,
    boolean_op: f.boolean_op,
    material_id: f.material_id,
    orientatie: facadeOrientatie(f),
    gevelgroep_nr: facadeGevelgroepNr(f),
    quantity_kind: f.quantity_kind,
    constituents: f.constituents?.map((c) => ({
      sign: c.sign,
      area_m2: c.area_m2
    }))
  };
}
function vrFacadesAsCoverageRows(list = vrFacades) {
  return list.filter((f) => f.ga_ready && f.quantity_kind !== "length").map(facadeToCoverageRow);
}
function facadeReadyAreaFacades(ori, groepNr) {
  const want = normalizeOrientatie(ori);
  const wantGg = groepNr === 2 || groepNr === 3 ? groepNr : groepNr === 1 ? 1 : null;
  return vrFacades.filter((f) => {
    if (!f.ga_ready || f.quantity_kind === "length") return false;
    if (f.area_m2 == null || !Number.isFinite(Number(f.area_m2))) return false;
    if (want && facadeOrientatie(f) !== want) return false;
    if (wantGg != null && facadeGevelgroepNr(f) !== wantGg) return false;
    return true;
  });
}
function facadeOrisWithArea() {
  const oris = /* @__PURE__ */ new Set();
  for (const f of facadeReadyAreaFacades()) {
    const o = facadeOrientatie(f);
    if (o) oris.add(o);
  }
  return [...oris];
}
function facadeIsComposeOp(f) {
  const op = String(f.boolean_op || "").toLowerCase();
  return op === "compose" || op === "difference";
}
function facadeOpeningOuterArea1x(sourceId, fallbackArea) {
  const src = vrFacades.find((x) => x.id === sourceId);
  if (src && facadeIsComposeOp(src) && Array.isArray(src.constituents) && src.constituents.length) {
    let hole = 0;
    for (const c of src.constituents) {
      if (c.sign === "+" && c.area_m2 != null && Number.isFinite(Number(c.area_m2))) {
        hole += Number(c.area_m2);
      }
    }
    if (hole > 0) return hole;
  }
  if (src?.area_m2 != null && Number.isFinite(Number(src.area_m2))) {
    const rpt = Math.max(1, Number(src.repeat_count) || 1);
    return Number(src.area_m2) / rpt;
  }
  return fallbackArea != null && Number.isFinite(Number(fallbackArea)) ? Number(fallbackArea) : 0;
}
function effectiveFacadeAreaM2(f, facades = vrFacades) {
  const base = f.area_m2 != null && Number.isFinite(Number(f.area_m2)) ? Number(f.area_m2) : 0;
  if (facadeIsComposeOp(f) && f.constituents?.length) {
    const parentRpt = Math.max(1, Number(f.repeat_count) || 1);
    let area = base;
    for (const part of f.constituents) {
      if (part.sign !== "-") continue;
      const sid = String(part.id || "").trim();
      if (!sid) continue;
      const src = facades.find((x) => x.id === sid);
      const srcRpt = Math.max(1, Number(src?.repeat_count) || 1);
      const extra = Math.max(0, srcRpt - parentRpt);
      if (extra <= 0) continue;
      const hole1 = facadeOpeningOuterArea1x(sid, part.area_m2);
      if (hole1 > 0) area -= extra * hole1;
    }
    return Math.round(area * 100) / 100;
  }
  const ori = facadeOrientatie(f);
  if (!ori) return Math.round(base * 100) / 100;
  return gevelHierarchyEffectiveAreaM2(
    vrFacadesAsCoverageRows(facades),
    ori,
    facadeGevelgroepNr(f),
    facadeToCoverageRow(f)
  );
}
function facadeUncutOpeningIds(ori, groepNr) {
  const ready = facadeReadyAreaFacades(ori, groepNr);
  const composes = ready.filter(facadeIsComposeOp);
  const constituentIds = /* @__PURE__ */ new Set();
  for (const c of composes) {
    for (const part of c.constituents || []) {
      const id = String(part.id || "").trim();
      if (id) constituentIds.add(id);
    }
  }
  const hosts = ready.filter((f) => !facadeIsComposeOp(f) && !constituentIds.has(f.id));
  if (!hosts.length) return /* @__PURE__ */ new Set();
  const uncut = /* @__PURE__ */ new Set();
  for (const c of composes) {
    uncut.add(c.id);
    for (const part of c.constituents || []) {
      const id = String(part.id || "").trim();
      if (id) uncut.add(id);
    }
  }
  for (const h of hosts) uncut.delete(h.id);
  return uncut;
}
function facadeOpeningsUncutFromWall(ori, groepNr) {
  const want = normalizeOrientatie(ori);
  const gg = groepNr === 2 || groepNr === 3 ? groepNr : 1;
  const rows = vrFacadesAsCoverageRows();
  if (want && gevelHierarchyApplies(rows, want, gg)) {
    return gevelMaterialExceedsContour(rows, want, gg);
  }
  if (want && gevelMaterialExceedsContour(rows, want, gg)) {
    return true;
  }
  const oris = want ? [want] : facadeOrisWithArea();
  for (const o of oris) {
    if (gevelHierarchyApplies(rows, o, gg)) continue;
    const uncut = facadeUncutOpeningIds(o, groepNr);
    if (!uncut.size) continue;
    if (facadeReadyAreaFacades(o, groepNr).some((f) => uncut.has(f.id))) return true;
  }
  return false;
}
function facadeStotaalM2(ori, groepNr) {
  const want = normalizeOrientatie(ori);
  if (!want) return 0;
  const gg = groepNr === 2 || groepNr === 3 ? groepNr : 1;
  const rows = vrFacadesAsCoverageRows();
  const contour = gevelContourStotaalM2(rows, want, gg);
  if (contour > 0) {
    return contour;
  }
  const ready = facadeReadyAreaFacades(want, groepNr);
  let sum = 0;
  for (const f of ready) sum += effectiveFacadeAreaM2(f);
  const uncut = facadeUncutOpeningIds(want, groepNr);
  if (uncut.size) {
    for (const f of ready) {
      if (uncut.has(f.id)) sum -= effectiveFacadeAreaM2(f);
    }
  }
  return Math.round(sum * 100) / 100;
}
function vlakkenDeeloppervlakM2(ori, groepNr) {
  const want = normalizeOrientatie(ori);
  const wantGg = groepNr === 2 || groepNr === 3 ? groepNr : groepNr === 1 ? 1 : null;
  let sum = 0;
  for (const v of vlakken) {
    const vOri = normalizeOrientatie(v.orientatie);
    if (want && vOri !== want) continue;
    if (wantGg != null && vlakGevelgroepNr(v) !== wantGg) continue;
    const live = liveVlakQty(v);
    if (live.kind !== "area") continue;
    const fac = findFacadeForVlak(v);
    const facId = (v.facade_subsection_id || "").trim();
    if (facId && !fac) continue;
    if (fac && vOri) {
      const uncut = facadeUncutOpeningIds(vOri, wantGg);
      if (uncut.has(fac.id)) continue;
    }
    if (Number.isFinite(live.qty) && live.qty > 0) sum += live.qty;
  }
  return Math.round(sum * 100) / 100;
}
function gevelGroepsWithMaterialForOri(ori) {
  const out = /* @__PURE__ */ new Set();
  for (const r of vrFacadesAsCoverageRows()) {
    if (String(r.orientatie || "").trim().toUpperCase() !== ori) continue;
    out.add(gevelgroepNrOf(r));
  }
  return [...out].sort((a, b) => a - b);
}
function stotaalAreaTol(stotaal) {
  return stotaal > 0 ? Math.max(0.05, Math.round(stotaal * 0.01 * 100) / 100) : 0.05;
}
function vlakkenMatchFacadeStotaal(ori) {
  const want = normalizeOrientatie(ori);
  const oris = want ? [want] : facadeOrisWithArea();
  if (!oris.length) return false;
  const rows = vrFacadesAsCoverageRows();
  for (const o of oris) {
    for (const gg of gevelGroepsWithMaterialForOri(o)) {
      if (gevelMaterialExceedsContour(rows, o, gg)) return false;
    }
    if (facadeOpeningsUncutFromWall(o)) return false;
    const stotaal = facadeStotaalM2(o);
    if (!(stotaal > 0)) return false;
    const deel = vlakkenDeeloppervlakM2(o);
    if (Math.abs(stotaal - deel) > stotaalAreaTol(stotaal)) return false;
  }
  return true;
}
function syncRecalcEnabled() {
  if (!recalcBtn) return;
  const ok = Boolean(selectedVrId) && vlakken.length > 0 && vlakkenMatchFacadeStotaal();
  recalcBtn.disabled = !ok;
  const incompleteOri = facadeOrisWithArea().find((o) => !vlakkenMatchFacadeStotaal(o));
  recalcBtn.title = ok ? "Herbereken GA / GA;k voor deze VR" : !selectedVrId ? "Selecteer eerst een VR" : !vlakken.length ? "Voeg eerst vlakken toe" : incompleteOri && facadeOpeningsUncutFromWall(incompleteOri) ? `Eerst openingen in hi\xEBrarchie (gevel \u2283 kozijn \u2283 ruit) of \xB1 op ori ${incompleteOri}` : incompleteOri ? `Eerst alle materialen toekennen tot 100% Stotaal voor ori ${incompleteOri}` : "Eerst alle materialen toekennen tot 100% Stotaal per ori\xEBntatie";
}
async function refreshVrCalc(opts) {
  const epoch = ++calcRevealEpoch;
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  const variant = variants.find((v) => v.variant_id === selectedVariantId);
  if (!auth() || !vr) {
    const msg = "Selecteer een VR en voeg vlakken met materiaal toe.";
    clearVrResults(msg, { keepStored: false });
    setConn("err", msg);
    return;
  }
  if (!vlakken.length) {
    await clearPersistedVrCalc("");
    setConn("err", "Geen vlakken \u2014 voeg gevelcomponenten toe v\xF3\xF3r GA / GA;k.");
    return;
  }
  if (!vlakkenMatchFacadeStotaal()) {
    const incompleteOri = normalizeOrientatie(vlakOrientatieEl?.value) || facadeOrisWithArea().find((o) => !vlakkenMatchFacadeStotaal(o)) || "";
    const msg = incompleteOri ? `Geen GA;k: Stotaal voor ori\xEBntatie ${incompleteOri} is nog geen 100% \u2014 vul de vlakken aan of maak \xB1 (gevel \u2212 kozijn).` : "Geen GA;k: Stotaal-dekking is nog geen 100% \u2014 vul de vlakken per ori\xEBntatie aan.";
    clearVrResults(msg, { keepStored: true });
    setConn("err", msg);
    return;
  }
  const editingVlak = selectedVlakId ? vlakken.find((x) => x.vlak_id === selectedVlakId) || null : null;
  const useForm = Boolean(opts?.useFormCorrections);
  const focusOriForForm = normalizeOrientatie(
    editingVlak?.orientatie || vlakOrientatieEl?.value
  );
  const liveGgId = String(
    selectedGevelgroepId || editingVlak?.gevelgroep_id || findGevelgroepByNr(focusOriForForm, selectedPickGroepNr)?.gevelgroep_id || ""
  ).trim();
  const liveFormCorr = useForm && focusOriForForm ? readFormClCg(focusOriForForm) : null;
  const liveFormLabel = String(selectedPickGroepNr);
  const livePickNr = selectedPickGroepNr === 2 || selectedPickGroepNr === 3 ? selectedPickGroepNr : 1;
  const calcVlakken = vlakken.map((v) => {
    const fac = findFacadeForVlak(v) || void 0;
    const live = liveVlakQty(v);
    const kind = live.kind;
    const qty = live.qty;
    const editingThis = Boolean(editingVlak && v.vlak_id === editingVlak.vlak_id);
    const oriCode = normalizeOrientatie(v.orientatie);
    const vGgId = String(v.gevelgroep_id || "").trim();
    const vGgNr = gevelgroepNrOf2(findGevelgroep(vGgId));
    const sameGroupLive = Boolean(liveFormCorr) && Boolean(focusOriForForm) && oriCode === focusOriForForm && (liveGgId ? vGgId === liveGgId : vGgNr === livePickNr);
    const stored = correctionsForVlak(v);
    const formGg = sameGroupLive && liveGgId ? liveGgId : vGgId;
    const gg = findGevelgroep(formGg);
    return {
      label: v.omschrijving,
      orientatie: oriCode || v.orientatie || "",
      gevelgroep_id: formGg || null,
      gevelgroep_label: sameGroupLive ? liveFormLabel : gg ? String(gevelgroepNrOf2(gg)) : null,
      ra_dba: fac?.ra_dba != null ? Number(fac.ra_dba) : NaN,
      quantity_kind: kind,
      area_m2: kind === "area" ? qty : null,
      length_m: kind === "length" ? qty : null,
      // While editing, form checkbox / group CL/Cg drive the live preview.
      meenemen_gak: editingThis ? vlakGakEl.checked : v.meenemen_gak !== false,
      cl_db: sameGroupLive && liveFormCorr ? Number(liveFormCorr.cl) || 0 : stored.cl,
      cg_db: sameGroupLive && liveFormCorr ? Number(liveFormCorr.cg) || 0 : stored.cg
    };
  });
  const missingRa = calcVlakken.filter((v) => !Number.isFinite(v.ra_dba));
  if (missingRa.length) {
    const msg = `Geen RA voor: ${missingRa.map((v) => v.label).join(", ")} \u2014 materiaal ontbreekt of catalogus-id is verouderd. Koppel materiaal opnieuw op de geveltekening, daarna Herberekenen GA / GA;k.`;
    clearVrResults(msg, { keepStored: false });
    setConn("err", msg);
    return;
  }
  const metrics = effectiveVrMetrics(vr);
  if (!(metrics.volume > 0)) {
    const msg = metrics.vloer <= 0 ? "Geen GA;k: vloeroppervlak ontbreekt (0 m\xB2). Zet de schaal op de plattegrond, herbereken maten voor deze VR, daarna opnieuw Herberekenen GA / GA;k." : "Geen GA;k: volume is 0 \u2014 controleer vloeroppervlak en hoogte bij de VR.";
    clearVrResults(msg, { keepStored: false });
    setConn("err", msg);
    return;
  }
  const result = computeVrGa({
    volume_m3: metrics.volume,
    t0_s: Number(vr.t0_s) || 0.5,
    geluidsbelasting_dba: Number(variant?.geluidsbelasting_dba ?? 0),
    vlakken: calcVlakken,
    gebruiksfunctie: variant?.gebruiksfunctie
  });
  if (!result.ok) {
    const msg = result.reason || "Berekening niet mogelijk.";
    clearVrResults(msg, { keepStored: false });
    setConn("err", msg);
    return;
  }
  const grens = result.grenswaarde_lbik_db;
  const shouldPersist = opts?.persist !== false && !useForm;
  if (useForm) resultsDirty = true;
  lastFreshGaResult = result;
  vr.ga_dba = result.ga_dba != null ? round1(result.ga_dba) : null;
  vr.lbi_dba = result.lbi_dba != null ? round1(result.lbi_dba) : null;
  vr.gak_dba = result.gak_dba != null ? round1(result.gak_dba) : null;
  if (result.voldoet != null) vrVoldoet.set(vr.verblijfsruimte_id, result.voldoet);
  else vrVoldoet.delete(vr.verblijfsruimte_id);
  freshResultVrIds.add(vr.verblijfsruimte_id);
  renderVrs();
  if (shouldPersist) {
    try {
      const ret = await invokeString("API_SaveVerblijfsruimteResults", [
        auth().token,
        vr.verblijfsruimte_id,
        result.ga_dba != null ? String(round1(result.ga_dba)) : "",
        result.lbi_dba != null ? String(round1(result.lbi_dba)) : "",
        result.gak_dba != null ? String(round1(result.gak_dba)) : ""
      ]);
      if (typeof ret === "string" && ret.startsWith("ERROR")) {
        resultsDirty = true;
        setConn("err", `Resultaten niet opgeslagen: ${ret}`);
      } else {
        resultsDirty = false;
      }
    } catch (err) {
      resultsDirty = true;
      setConn("err", `Resultaten niet opgeslagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (epoch !== calcRevealEpoch) return;
  if (!resultsRevealAllowed(opts)) {
    const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
    const oriEmpty = Boolean(focusOri) && vlakkenForOrientatie(focusOri).length === 0;
    clearVrResults(
      oriEmpty && focusOri ? `Ori\xEBntatie ${ORIENTATIE_LABELS[focusOri] || focusOri}: nog geen materialen \u2014 berekening wordt niet getoond tot je hier vlakken toevoegt.` : "Open een vlak in de lijst om de berekening te tonen, of voeg een nieuw vlak toe voor een vrije ori\xEBntatie.",
      { keepStored: false }
    );
    return;
  }
  const statusBit = useForm ? " \xB7 (live Stot \u2014 niet opgeslagen)" : resultsDirty ? " \xB7 niet opgeslagen" : shouldPersist ? " \xB7 opgeslagen" : " \xB7 berekend";
  const pickFocusFacade = () => {
    const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
    if (!result.facades?.length) return null;
    if (!focusOri) return result.facades.length === 1 ? result.facades[0] : null;
    const focusGg = String(selectedGevelgroepId || "").trim();
    const sel = selectedVlakId ? vlakken.find((x) => x.vlak_id === selectedVlakId) : null;
    const form = sel ? readFormClCg(sel.orientatie) : null;
    const corr = form ? { cl: Number(form.cl) || 0, cg: Number(form.cg) || 0 } : null;
    const matchCorr = (f) => !corr || Math.abs(f.cl_db - corr.cl) < 1e-9 && Math.abs(f.cg_db - corr.cg) < 1e-9;
    if (focusGg) {
      const byGg = result.facades.find(
        (f) => f.orientatie === focusOri && String(f.gevelgroep_id || "") === focusGg
      );
      if (byGg) return byGg;
    }
    return result.facades.find((f) => f.orientatie === focusOri && matchCorr(f)) || result.facades.find((f) => f.orientatie === focusOri) || null;
  };
  if (vrResultsHintEl) {
    const req = result.gak_required_dba != null ? ` \xB7 GA;k \u2265 ${fmtRes(result.gak_required_dba)} dB (Lb\u2212${grens})` : "";
    const focusFacade = pickFocusFacade();
    const oriGroups = new Set((result.facades || []).map((f) => f.orientatie)).size;
    const facadeBit = result.facades && result.facades.length > oriGroups ? ` \xB7 ${result.facades.length} gevelgroepen (CL/Cg per groep)` : result.facades && result.facades.length > 1 ? ` \xB7 ${result.facades.length} gevels (CL in ruimtesom)` : ` \xB7 CL/Cg ${round1(result.cl_db)} / ${round1(result.cg_db)} dB (CL \u2192 ruimtesom)`;
    const ggLab = focusFacade?.gevelgroep_label ? ` \xAB${focusFacade.gevelgroep_label}\xBB` : "";
    const gevelBit = focusFacade ? ` \xB7 gevel ${focusFacade.orientatie}${ggLab}: GA_vlak=${fmtRes(focusFacade.ga_dba)} CL=${round1(focusFacade.cl_db)}` : "";
    const totBit = result.facades && result.facades.length > 1 && result.d2m_nt != null ? ` \xB7 D2m,tot(ref)=${fmtRes(result.d2m_nt)} dB` : "";
    vrResultsHintEl.textContent = `Cr=${result.cr_db} dB${facadeBit}${gevelBit}${totBit} \xB7 C3\u2192GA;k \xB7 grens Lbi;k \u2264 ${grens} dB${req}${statusBit}`;
    vrResultsHintEl.classList.remove("hidden");
  }
  if (resSEl) {
    resSEl.textContent = `${fmtRes(result.s_m2)} / ${fmtRes(result.stot_m2)} m\xB2`;
  }
  {
    const focusFacade = pickFocusFacade();
    const rp = focusFacade?.r_prime ?? result.r_prime;
    const dGevel = focusFacade?.d2m_nt ?? result.d2m_nt;
    const ggLab = focusFacade?.gevelgroep_label ? ` \xB7 ${focusFacade.gevelgroep_label}` : "";
    if (resRpLabelEl) {
      resRpLabelEl.textContent = focusFacade ? `R' (gevel ${focusFacade.orientatie}${ggLab})` : "R' (gevel)";
    }
    if (resDLabelEl) {
      resDLabelEl.innerHTML = focusFacade ? `D<sub>2m,nT</sub> (gevel ${focusFacade.orientatie}${ggLab})` : "D<sub>2m,nT</sub> (gevel)";
    }
    if (resRpEl) resRpEl.textContent = `${fmtRes(rp)} dB`;
    if (resDEl) resDEl.textContent = `${fmtRes(dGevel)} dB`;
  }
  if (resGaEl) resGaEl.textContent = `${fmtRes(result.ga_dba)} dB`;
  if (resLbiEl) resLbiEl.textContent = `${fmtRes(result.lbi_dba)} dB`;
  if (resGakEl) resGakEl.textContent = `${fmtRes(result.gak_dba)} dB`;
  if (resLbikEl) resLbikEl.textContent = `${fmtRes(result.lbik_dba)} dB`;
  if (resToetsEl) {
    resToetsEl.classList.remove("toets-ok", "toets-fail");
    if (result.voldoet === true) {
      resToetsEl.textContent = "Voldoet";
      resToetsEl.classList.add("toets-ok");
    } else if (result.voldoet === false) {
      resToetsEl.textContent = "Voldoet niet";
      resToetsEl.classList.add("toets-fail");
    } else {
      resToetsEl.textContent = "\u2014";
    }
  }
  syncAnalyzeUi(result.voldoet === false);
  if (!useForm) {
    setConn(
      "ok",
      `GA ${fmtRes(result.ga_dba)} \xB7 GA;k ${fmtRes(result.gak_dba)} dB${statusBit}`
    );
  }
}
async function resyncStoredLbiForVariant(variantId) {
  if (!auth() || !variantId) return;
  const variant = variants.find((v) => v.variant_id === variantId);
  const Lb = Number(variant?.geluidsbelasting_dba ?? 0);
  if (!Number.isFinite(Lb)) return;
  const vgRet = await invokeString("API_ListVerblijfsgebieden", [auth().token, variantId]);
  const vgData = parseJsonOk2(vgRet);
  for (const g of vgData.verblijfsgebieden || []) {
    const vrRet = await invokeString("API_ListVerblijfsruimten", [auth().token, g.verblijfsgebied_id]);
    const vrData = parseJsonOk2(vrRet);
    for (const vr of vrData.verblijfsruimten || []) {
      if (vr.ga_dba == null || !Number.isFinite(Number(vr.ga_dba))) continue;
      const ga = Number(vr.ga_dba);
      const gak = vr.gak_dba != null && Number.isFinite(Number(vr.gak_dba)) ? Number(vr.gak_dba) : null;
      const lbi = round1(Lb - ga);
      try {
        await invokeString("API_SaveVerblijfsruimteResults", [
          auth().token,
          vr.verblijfsruimte_id,
          String(round1(ga)),
          String(lbi),
          gak != null ? String(round1(gak)) : ""
        ]);
      } catch {
      }
    }
  }
}
function applyVlakFormDefaultsFromExisting(keepOri) {
  if (selectedVlakId) return;
  syncOrientatieSelectOptions();
  const expected = expectedOrientatiesForSelectedVr();
  const missing = missingOrientationsForSelectedVr();
  const current = normalizeOrientatie(keepOri || vlakOrientatieEl?.value);
  const code = (current && expected.includes(current) ? current : "") || missing[0] || expected[0] || "";
  if (vlakOrientatieEl) vlakOrientatieEl.value = code;
  const keepGg = selectedPickGroepNr === 2 || selectedPickGroepNr === 3 ? selectedPickGroepNr : 1;
  fillPickGroepSelect(code, keepGg);
  applyClCgFromOrientatie(code);
  vlakGakEl.checked = true;
  fillFacadeSelect();
  syncVlakMaterialGate();
  updateVlakOriCompletenessHint();
  syncOrientatieDisplay();
}
function clearVlakEdit(keepOri) {
  selectedVlakId = null;
  vlakNameEl.value = "";
  applyVlakFormDefaultsFromExisting(keepOri);
  if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak vullen";
  vlakCancelBtn?.classList.add("hidden");
  if (vlakEditHintEl) {
    const code = normalizeOrientatie(keepOri || vlakOrientatieEl?.value);
    vlakEditHintEl.textContent = code ? `Ori\xEBntatie ${ORIENTATIE_LABELS[code] || code} blijft geselecteerd \u2014 kies het volgende materiaal of een andere ori\xEBntatie.` : "Kies een ori\xEBntatie in de listbox, of open een vlak in \xABToegevoegde vlakken\xBB om te bewerken.";
  }
  renderVlakken();
  syncVlakMaterialGate();
  blankResultsUntilVlakSelected();
  syncCopyVlakkenBar();
}
function fillVlakEdit(v) {
  selectedVlakId = v.vlak_id;
  syncOrientatieSelectOptions();
  vlakNameEl.value = v.omschrijving || "";
  const ori = normalizeOrientatie(v.orientatie);
  if (vlakOrientatieEl) {
    if (ori) ensureOrientatieOption(ori);
    vlakOrientatieEl.value = ori;
  }
  selectedGevelgroepId = String(v.gevelgroep_id || "").trim() || null;
  const g = findGevelgroep(selectedGevelgroepId);
  selectedPickGroepNr = g ? gevelgroepNrOf2(g) : 1;
  fillPickGroepSelect(ori, selectedPickGroepNr);
  applyClCgFromGevelgroep(g, ori);
  vlakGakEl.checked = v.meenemen_gak !== false;
  fillFacadeSelect();
  const live = liveVlakQty(v);
  const linked = findFacadeForVlak(v);
  const facId = linked?.id || v.facade_subsection_id || "";
  if (facId && [...vlakFacadeEl.options].some((o) => o.value === facId)) {
    vlakFacadeEl.value = facId;
  }
  updateFacadeHint();
  syncVlakQtyUi(live.kind, String(live.qty), true);
  if (vlakSaveBtn) vlakSaveBtn.textContent = "Opslaan & herberekenen";
  vlakCancelBtn?.classList.remove("hidden");
  renderVlakken();
  syncVlakMaterialGate();
  updateVlakOriCompletenessHint();
  syncOrientatieDisplay();
  syncCopyVlakkenBar();
}
function renderVlakken() {
  vlakListEl.innerHTML = "";
  updateVlakInventory();
  syncVlakPickDropdown();
  syncCopyVlakkenBar();
  if (!selectedVrId) {
    const li = document.createElement("li");
    li.className = "hint ga-vlak-added-empty";
    li.textContent = "Selecteer eerst een verblijfsruimte.";
    vlakListEl.appendChild(li);
    return;
  }
  const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
  if (!focusOri) {
    const li = document.createElement("li");
    li.className = "hint ga-vlak-added-empty";
    li.textContent = "Kies eerst een gevelori\xEBntatie hierboven.";
    vlakListEl.appendChild(li);
    return;
  }
  const focusVlakken = vlakkenForOrientatie(focusOri);
  if (!focusVlakken.length) {
    const li = document.createElement("li");
    li.className = "hint ga-vlak-added-empty";
    li.textContent = `Nog geen vlakken voor ${ORIENTATIE_LABELS[focusOri] || focusOri}. Koppel een materiaal bij 2.`;
    vlakListEl.appendChild(li);
    return;
  }
  const appendVlakRow = (host, v) => {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (v.vlak_id === selectedVlakId) li.classList.add("selected");
    const info = document.createElement("button");
    info.type = "button";
    info.className = "drawing-list-select";
    const live = liveVlakQty(v);
    const qtyTxt = live.kind === "length" ? `l=${live.qty.toFixed(2)} m` : `S=${live.qty.toFixed(2)} m\xB2`;
    const mat = vlakMaterialLabel(v);
    const storedCorr = correctionsForVlak(v);
    const corrTxt = `CL=${round1(storedCorr.cl)} \xB7 Cg=${round1(storedCorr.cg)}`;
    info.textContent = `${mat} \xB7 ${qtyTxt} \xB7 ${corrTxt} \xB7 Stot=${v.meenemen_gak ? "ja" : "nee"}`;
    info.title = "Open dit vlak om te bewerken";
    info.addEventListener("click", () => {
      fillVlakEdit(v);
      void refreshVrCalc({ persist: false });
    });
    li.appendChild(info);
    const actions = document.createElement("span");
    actions.className = "drawing-list-actions";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "secondary";
    del.textContent = "Verwijder";
    del.addEventListener("click", () => {
      void (async () => {
        if (!auth()) return;
        const ret = await invokeString("API_DeleteVlak", [auth().token, v.vlak_id]);
        if (ret.startsWith("ERROR")) throw new Error(ret);
        if (selectedVlakId === v.vlak_id) {
          selectedVlakId = null;
          vlakNameEl.value = "";
          applyVlakFormDefaultsFromExisting(focusOri);
          if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak vullen";
          vlakCancelBtn?.classList.add("hidden");
        }
        await loadVlakken();
        if (!vlakken.length) {
          await clearPersistedVrCalc("");
        }
      })().catch((e) => setConn("err", String(e)));
    });
    actions.appendChild(del);
    li.appendChild(actions);
    host.appendChild(li);
  };
  const groups = gevelgroepenForOri(focusOri);
  const byGg = /* @__PURE__ */ new Map();
  for (const v of focusVlakken) {
    const key2 = String(v.gevelgroep_id || "").trim() || "_";
    const list = byGg.get(key2) || [];
    list.push(v);
    byGg.set(key2, list);
  }
  const orderedKeys = [];
  for (const g of groups) {
    if (byGg.has(g.gevelgroep_id)) orderedKeys.push(g.gevelgroep_id);
  }
  for (const key2 of byGg.keys()) {
    if (!orderedKeys.includes(key2)) orderedKeys.push(key2);
  }
  const wrap = document.createElement("li");
  wrap.className = "ga-vlak-ori-group";
  const title = document.createElement("p");
  title.className = "ga-vlak-ori-group-title";
  const groepN = orderedKeys.length;
  title.textContent = `${focusOri} \xB7 ${ORIENTATIE_LABELS[focusOri] || focusOri} \xB7 ${focusVlakken.length} vlak${focusVlakken.length === 1 ? "" : "ken"}${groepN > 1 ? ` \xB7 ${groepN} groepen` : ""}`;
  wrap.appendChild(title);
  for (const key2 of orderedKeys) {
    const members = byGg.get(key2) || [];
    if (!members.length) continue;
    const g = findGevelgroep(key2 === "_" ? null : key2);
    const corr = g ? { cl: Number(g.cl_db) || 0, cg: Number(g.cg_db) || 0 } : correctionsForVlak(members[0]);
    const sub = document.createElement("div");
    sub.className = "ga-vlak-gevelgroep";
    const subTitle = document.createElement("p");
    subTitle.className = "ga-vlak-gevelgroep-title";
    const nr = g ? gevelgroepNrOf2(g) : 1;
    subTitle.textContent = `Groep ${nr} \xB7 CL=${Math.round(corr.cl)} \xB7 Cg=${round1(corr.cg)} \xB7 ${members.length} vlak${members.length === 1 ? "" : "ken"}`;
    sub.appendChild(subTitle);
    const inner = document.createElement("ul");
    inner.className = "drawing-list";
    for (const v of members) appendVlakRow(inner, v);
    sub.appendChild(inner);
    wrap.appendChild(sub);
  }
  vlakListEl.appendChild(wrap);
}
async function refreshBuildingMeta() {
  if (!auth() || !buildingId) {
    buildingLabel = "";
    buildingExternalRef = "";
    return;
  }
  try {
    const ret = await invokeString("API_EngineerGetProject", [auth().token, buildingId]);
    if (ret.startsWith("ERROR")) return;
    const data = parseJsonOk2(ret);
    buildingLabel = data.label || data.building?.label || "";
    buildingExternalRef = data.external_ref || data.building?.external_ref || "";
  } catch {
  }
}
function setBuildingMetaText(text) {
  buildingMetaEl.textContent = text;
  if (buildingMetaSummaryEl) {
    const compact = text === "\u2014" ? "" : text;
    buildingMetaSummaryEl.textContent = compact ? `\xB7 ${compact}` : "";
  }
  syncResultsWerknummer();
}
function syncResultsWerknummer() {
  if (!vrResultsWerknummerEl) return;
  const wn = (buildingExternalRef || "").trim();
  if (!wn || !buildingId) {
    vrResultsWerknummerEl.hidden = true;
    vrResultsWerknummerEl.textContent = "";
    return;
  }
  vrResultsWerknummerEl.hidden = false;
  vrResultsWerknummerEl.textContent = `Werknummer: ${wn}`;
}
function buildingMetaLine() {
  const title = buildingLabel || buildingExternalRef || (buildingId ? `${buildingId.slice(0, 8)}\u2026` : "\u2014");
  const wn = (buildingExternalRef || "").trim();
  const wnBit = wn && buildingLabel && wn !== buildingLabel ? ` \xB7 werknummer ${wn}` : "";
  return `${title}${wnBit} \xB7 ${freeRooms.length} vrije rooms`;
}
async function openBuilding(id) {
  buildingId = id.trim();
  buildingIdEl.value = buildingId;
  syncFloormapLink();
  syncProcessDockVisibility();
  if (!buildingId) {
    modelPanelEl.classList.add("hidden");
    setBuildingMetaText("\u2014");
    buildingLabel = "";
    buildingExternalRef = "";
    syncResultsWerknummer();
    return;
  }
  setConn("busy", "Laden\u2026");
  await refreshBuildingMeta();
  await refreshLinks();
  await loadGeometryOptions();
  await loadVariants();
  modelPanelEl.classList.remove("hidden");
  syncProcessDockVisibility();
  setBuildingMetaText(buildingMetaLine());
  if (projectIdBarEl) {
    projectIdBarEl.open = false;
    localStorage.setItem("app-gevelwering-ga-project-id-collapsed", "1");
  }
  projectMenu?.rememberCurrent();
  projectMenu?.refreshTitle();
  setConn("ok", "Verbonden");
  syncGaLocation();
  await applyFloormapImport();
}
async function saveProjectCheckpoint() {
  if (!auth() || !buildingId) throw new Error("Log in en selecteer een project");
  if (!selectedVariantId) throw new Error("Geen actieve variant");
  const keepVg = selectedVgId;
  const keepVr = selectedVrId;
  const keepVlak = selectedVlakId;
  setConn("busy", "Alle VR\u2019s herberekenen (alle gevelori\xEBntaties)\u2026");
  let saved = 0;
  let skipped = 0;
  let failed = 0;
  const skipReasons = [];
  try {
    const vgRet = await invokeString("API_ListVerblijfsgebieden", [auth().token, selectedVariantId]);
    const vgData = parseJsonOk2(vgRet);
    const allVgs = vgData.verblijfsgebieden || [];
    for (const g of allVgs) {
      selectedVgId = g.verblijfsgebied_id;
      const vrRet = await invokeString("API_ListVerblijfsruimten", [auth().token, g.verblijfsgebied_id]);
      const vrData = parseJsonOk2(vrRet);
      const list = vrData.verblijfsruimten || [];
      vrs = list;
      for (const vr of list) {
        selectedVrId = vr.verblijfsruimte_id;
        selectedVlakId = null;
        const label = vrShortLabel(vr);
        setConn("busy", `Herberekenen ${label} (alle gevelori\u2019s)\u2026`);
        try {
          await loadVlakken({ resetForm: true });
          if (!vlakken.length) {
            skipped += 1;
            skipReasons.push(`${label}: geen vlakken`);
            continue;
          }
          if (!vlakkenMatchFacadeStotaal()) {
            skipped += 1;
            const bad = facadeOrisWithArea().find((o) => !vlakkenMatchFacadeStotaal(o)) || "?";
            skipReasons.push(`${label}: ori ${bad} geen 100% Stotaal`);
            continue;
          }
          await refreshVrCalc({ persist: true, reveal: true });
          const cur = vrs.find((r) => r.verblijfsruimte_id === vr.verblijfsruimte_id);
          if (cur && vrHasStoredResults(cur)) saved += 1;
          else {
            skipped += 1;
            skipReasons.push(`${label}: berekening niet opgeslagen`);
          }
        } catch (err) {
          failed += 1;
          skipReasons.push(
            `${label}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    }
    resultsDirty = false;
    selectedVlakId = keepVlak;
    if (keepVg) {
      selectedVgId = keepVg;
      await loadVgs(keepVg);
      if (keepVr) await loadVrs(keepVr);
    } else {
      await loadVgs();
    }
    const reasonBit = skipReasons.length ? ` \xB7 ${skipReasons.slice(0, 4).join("; ")}${skipReasons.length > 4 ? "\u2026" : ""}` : "";
    const message = failed || skipped && !saved ? `Herberekening gevelori\u2019s mislukt \xB7 ${saved} opgeslagen${skipped ? ` \xB7 ${skipped} overgeslagen` : ""}${failed ? ` \xB7 ${failed} mislukt` : ""}${reasonBit}` : skipped ? `Herberekening gevelori\u2019s klaar \xB7 ${saved} VR\u2019s opgeslagen \xB7 ${skipped} overgeslagen${reasonBit}` : `Herberekening gevelori\u2019s geslaagd \xB7 ${saved} VR\u2019s opgeslagen (alle ori\u2019s)`;
    const state = failed > 0 || saved === 0 && skipped > 0 ? "err" : "ok";
    setConn(state, message);
    return { saved, skipped, failed, reasons: skipReasons, message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setConn("err", `Herberekening gevelori\u2019s mislukt: ${msg}`);
    throw err;
  }
}
async function ensureDefaultVariant() {
  if (!auth() || !buildingId) throw new Error("Geen project");
  if (selectedVariantId && variants.some((v) => v.variant_id === selectedVariantId)) {
    return selectedVariantId;
  }
  if (variants.length) {
    selectedVariantId = variants[0].variant_id;
    renderVariants();
    fillVariantForm(variants[0]);
    return selectedVariantId;
  }
  const ret = await invokeString("API_SaveVariant", [
    auth().token,
    buildingId,
    "",
    "Hoofdvariant",
    "Woonfunctie",
    "55",
    "SPECTRUM_2",
    "0"
  ]);
  const data = parseJsonOk2(ret);
  selectedVariantId = data.variant_id;
  await loadVariants();
  return selectedVariantId;
}
function clearImportQueryParams() {
  pendingImportSubId = "";
  pendingImportVgNr = "";
  pendingImportVrNr = "";
  const url = new URL(location.href);
  url.searchParams.delete("subsection_id");
  url.searchParams.delete("vg_nr");
  url.searchParams.delete("vr_nr");
  history.replaceState(null, "", url.toString());
  syncGaLocation();
}
async function applyFloormapImport() {
  const subId = pendingImportSubId;
  if (!subId || !auth() || !buildingId) return;
  const linked = linkedBySub.get(subId);
  if (linked) {
    await ensureDefaultVariant();
    selectedVgId = linked.verblijfsgebied_id;
    selectedVrId = linked.verblijfsruimte_id;
    await loadVgs(linked.verblijfsgebied_id, linked.verblijfsruimte_id);
    setConn("ok", `Berekening geopend: ${linked.omschrijving}`);
    clearImportQueryParams();
    return;
  }
  const room = freeRooms.find((r) => r.id === subId) || null;
  const vgNr = pendingImportVgNr || (room?.vg_nr != null ? String(room.vg_nr) : "");
  const vrNr = pendingImportVrNr || room?.vr_nr || "";
  const roomLabel = room?.label || "";
  const vgName = vgNr ? vgLabelFromNr(vgNr) : roomLabel || "Verblijfsgebied";
  const vrName = vrNr ? vrLabelFromNr(vrNr, roomLabel) : roomLabel || "Verblijfsruimte";
  if (!room) {
    setConn("err", "Floormap-ruimte niet gevonden of al gekoppeld");
    clearImportQueryParams();
    return;
  }
  fillRoomSelect(subId);
  const variantId = await ensureDefaultVariant();
  await loadVgs();
  const existingVgId = vgNr ? findVgIdForNr(vgNr) : null;
  if (existingVgId) {
    const ret = await invokeString("API_AddVerblijfsruimte", [
      auth().token,
      existingVgId,
      subId,
      vrName,
      "",
      vrHoogteEl.value || "2.6",
      vrT0El.value || "0.5"
    ]);
    const data = parseJsonOk2(ret);
    selectedVgId = existingVgId;
    selectedVrId = data.verblijfsruimte_id;
    await refreshLinks();
    refreshFreeRoomsFromLinks();
    await loadVgs(existingVgId, data.verblijfsruimte_id);
    try {
      await loadGeometryOptions();
    } catch {
    }
    setConn("ok", `VR overgenomen in ${vgName}: ${vrName}`);
  } else {
    const ret = await invokeString("API_CreateVerblijfsgebied", [
      auth().token,
      variantId,
      vgName,
      subId,
      vrName,
      "",
      vrHoogteEl.value || "2.6",
      vrT0El.value || "0.5"
    ]);
    const data = parseJsonOk2(ret);
    selectedVgId = data.verblijfsgebied_id;
    selectedVrId = data.verblijfsruimte_id;
    await refreshLinks();
    refreshFreeRoomsFromLinks();
    await loadVgs(data.verblijfsgebied_id, data.verblijfsruimte_id);
    try {
      await loadGeometryOptions();
    } catch {
    }
    setConn("ok", `VG/VR overgenomen: ${vgName} \xB7 ${vrName}`);
  }
  clearImportQueryParams();
}
async function loadQueue() {
  if (!auth()) return;
  const ret = await invokeString("API_EngineerListReviewQueue", [auth().token]);
  const data = parseJsonOk2(ret);
  queueListEl.classList.remove("hidden");
  queueListEl.innerHTML = "";
  for (const p of data.projects || []) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "admin-project-card panel";
    card.innerHTML = `<strong>${esc(p.label || p.building_id.slice(0, 8))}</strong><br/><span class="hint">${esc(p.customer_name)} \xB7 ${esc(p.project_status)}</span>`;
    card.addEventListener("click", () => {
      queueListEl.classList.add("hidden");
      void openBuilding(p.building_id);
    });
    queueListEl.appendChild(card);
  }
  if (!(data.projects || []).length) {
    queueListEl.innerHTML = `<p class="hint">Geen projecten in de review-queue.</p>`;
  }
}
loginForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(loginForm);
  void session.bootstrapAndLogin(
    String(fd.get("username") || ""),
    String(fd.get("password") || "")
  ).then(async () => {
    if (buildingId) await openBuilding(buildingId);
  }).catch((e) => setConn("err", String(e)));
});
logoutBtn.addEventListener("click", () => {
  session.logout();
});
buildingForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void openBuilding(buildingIdEl.value).catch((e) => setConn("err", String(e)));
});
queueBtn.addEventListener("click", () => {
  if (projectIdBarEl) projectIdBarEl.open = true;
  void loadQueue().catch((e) => setConn("err", String(e)));
});
(() => {
  if (!projectIdBarEl) return;
  const key2 = "app-gevelwering-ga-project-id-collapsed";
  if (localStorage.getItem(key2) === "1") projectIdBarEl.open = false;
  projectIdBarEl.addEventListener("toggle", () => {
    localStorage.setItem(key2, projectIdBarEl.open ? "0" : "1");
  });
})();
vgRoomEl.addEventListener("change", () => {
  updateRoomPreview();
  syncVrAddButtons();
});
variantNewBtn.addEventListener("click", () => {
  selectedVariantId = null;
  variantNameEl.value = "Nieuwe variant";
  variantSpectrumEl.value = "SPECTRUM_2";
  renderVariants();
});
variantCloneBtn?.addEventListener("click", () => {
  void (async () => {
    if (!auth() || !selectedVariantId) throw new Error("Selecteer eerst een variant om te kopi\xEBren");
    const src = variants.find((v) => v.variant_id === selectedVariantId);
    const name = `${src?.omschrijving || "Variant"} (kopie)`;
    const ret = await invokeString("API_CloneVariant", [auth().token, selectedVariantId, name]);
    const data = parseJsonOk2(ret);
    selectedVariantId = data.variant_id;
    compareSelectedIds.add(data.variant_id);
    if (src) compareSelectedIds.add(src.variant_id);
    await refreshLinks();
    await loadVariants();
    setConn(
      "ok",
      `Variant gekopieerd \xB7 ${data.vg_count} VG \xB7 ${data.vr_count} VR \xB7 ${data.vlak_count} vlakken`
    );
  })().catch((e) => setConn("err", String(e)));
});
compareBtn?.addEventListener("click", () => {
  void runVariantCompare().then(() => setConn("ok", "Variantvergelijking bijgewerkt")).catch((e) => setConn("err", String(e)));
});
variantForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth() || !buildingId) return;
    const ret = await invokeString("API_SaveVariant", [
      auth().token,
      buildingId,
      selectedVariantId || "",
      variantNameEl.value.trim(),
      variantFunctieEl.value,
      variantLbEl.value || "0",
      variantSpectrumEl.value,
      "0"
    ]);
    const data = parseJsonOk2(ret);
    selectedVariantId = data.variant_id;
    await loadVariants();
    await resyncStoredLbiForVariant(data.variant_id);
    if (selectedVlakId) await refreshVrCalc({ persist: true });
    else {
      await refreshVrCalc({ persist: true });
      blankResultsUntilVlakSelected();
    }
    setConn("ok", "Variant opgeslagen");
  })().catch((e) => setConn("err", String(e)));
});
variantDelBtn.addEventListener("click", () => {
  void (async () => {
    if (!auth() || !selectedVariantId) return;
    if (!confirm("Variant en alle VG/VR/vlakken verwijderen?")) return;
    const ret = await invokeString("API_DeleteVariant", [auth().token, selectedVariantId]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    selectedVariantId = null;
    await loadVariants();
    await refreshLinks();
    await loadGeometryOptions();
  })().catch((e) => setConn("err", String(e)));
});
async function createVgFromSelectedRoom() {
  if (!auth()) throw new Error("Niet ingelogd");
  const variantId = await ensureDefaultVariant();
  const room = selectedFreeRoom();
  if (!room) throw new Error("Kies een vrije plattegrondruimte");
  const { vgName, vrName } = labelsFromRoom(room);
  const existingVgId = room.vg_nr != null ? findVgIdForNr(room.vg_nr) : null;
  if (existingVgId) {
    selectedVgId = existingVgId;
    await addVrToSelectedVg();
    return;
  }
  const ret = await invokeString("API_CreateVerblijfsgebied", [
    auth().token,
    variantId,
    vgName,
    room.id,
    vrName,
    "",
    vrHoogteEl.value || "2.6",
    vrT0El.value || "0.5"
  ]);
  const data = parseJsonOk2(ret);
  selectedVgId = data.verblijfsgebied_id;
  selectedVrId = data.verblijfsruimte_id;
  await refreshLinks();
  refreshFreeRoomsFromLinks();
  await loadVgs(data.verblijfsgebied_id, data.verblijfsruimte_id);
  try {
    await loadGeometryOptions();
  } catch {
  }
  setConn("ok", `Nieuw ${vgName} met ${vrName}`);
}
async function addVrToSelectedVg() {
  if (!auth()) throw new Error("Niet ingelogd");
  if (!selectedVgId) throw new Error("Selecteer eerst een verblijfsgebied");
  const room = selectedFreeRoom();
  if (!room) throw new Error("Kies een vrije plattegrondruimte op dezelfde vloer");
  const floor = floorLevelForVg(selectedVgId);
  if (floor && room.level_hint !== floor) {
    throw new Error(`Alleen ruimten op ${levelLabel(floor)} mogen bij dit VG`);
  }
  const vgNr = vgNrForVg(selectedVgId);
  if (vgNr != null && room.vg_nr != null && Number(room.vg_nr) !== vgNr) {
    throw new Error(`Deze ruimte hoort bij VG ${room.vg_nr}, niet bij VG ${vgNr}`);
  }
  const { vrName } = labelsFromRoom(room);
  const vgId = selectedVgId;
  const ret = await invokeString("API_AddVerblijfsruimte", [
    auth().token,
    vgId,
    room.id,
    vrName,
    "",
    vrHoogteEl.value || "2.6",
    vrT0El.value || "0.5"
  ]);
  const data = parseJsonOk2(ret);
  selectedVgId = vgId;
  selectedVrId = data.verblijfsruimte_id;
  await refreshLinks();
  refreshFreeRoomsFromLinks();
  await loadVgs(vgId, data.verblijfsruimte_id);
  try {
    await loadGeometryOptions();
  } catch {
  }
  setConn("ok", `${vrName} toegevoegd`);
}
vgNewBtn.addEventListener("click", () => {
  void createVgFromSelectedRoom().catch((e) => setConn("err", String(e)));
});
vrAddBtn.addEventListener("click", () => {
  void addVrToSelectedVg().catch((e) => setConn("err", String(e)));
});
vrEditForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth() || !selectedVrId) return;
    syncVrVolumeFromInputs();
    const ret = await invokeString("API_SaveVerblijfsruimte", [
      auth().token,
      selectedVrId,
      vrEditNameEl.value.trim(),
      vrEditVloerEl.value || "0",
      vrEditHoogteEl.value || "0",
      vrEditVolumeEl.value || "",
      vrEditT0El.value || "0.5",
      "0"
    ]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    await loadVrs();
    setConn("ok", "VR bijgewerkt");
  })().catch((e) => setConn("err", String(e)));
});
vrEditHoogteEl.addEventListener("input", () => syncVrVolumeFromInputs());
vrEditVloerEl.addEventListener("input", () => syncVrVolumeFromInputs());
vrDelBtn.addEventListener("click", () => {
  void (async () => {
    if (!auth() || !selectedVrId) return;
    const ret = await invokeString("API_DeleteVerblijfsruimte", [auth().token, selectedVrId]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    await refreshLinks();
    await loadGeometryOptions();
    await loadVgs();
  })().catch((e) => setConn("err", String(e)));
});
vgDelBtn.addEventListener("click", () => {
  void (async () => {
    if (!auth() || !selectedVgId) return;
    if (!confirm("Verblijfsgebied en alle VR\u2019s verwijderen?")) return;
    const ret = await invokeString("API_DeleteVerblijfsgebied", [auth().token, selectedVgId]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    selectedVgId = null;
    await refreshLinks();
    await loadGeometryOptions();
    await loadVgs();
  })().catch((e) => setConn("err", String(e)));
});
async function saveVlakFromPick(opts) {
  if (!auth() || !selectedVrId) throw new Error("Selecteer een VR");
  const editingId = opts.editingId || "";
  const fac = opts.primaryId;
  if (!fac && !editingId) throw new Error("Selecteer een gevelcomponent");
  const oriVal = normalizeOrientatie(opts.oriVal);
  if (!oriVal) throw new Error("Kies eerst een gevelori\xEBntatie in de listbox");
  const expectedOris = expectedOrientatiesForSelectedVr();
  if (!expectedOris.length) {
    throw new Error(
      "Geen gevelori\xEBntaties op de plattegrond \u2014 vink die eerst aan bij Opgeslagen ruimten"
    );
  }
  if (!expectedOris.includes(oriVal)) {
    throw new Error(
      `Ori\xEBntatie ${oriVal} staat niet in de plattegrond-definitie (${expectedOris.join(", ")})`
    );
  }
  const matKey = (opts.materialKey || "").trim() || null;
  if (!editingId) {
    if (!(opts.materialId || "").trim()) {
      throw new Error(
        "Deze component heeft nog geen materiaal \u2014 koppel het op de geveltekening, daarna hier als vlak toevoegen"
      );
    }
    const usedIds = usedFacadePickIds();
    if (usedIds.has(fac)) {
      throw new Error("Deze gevelcomponent is al als vlak gekoppeld");
    }
    if (matKey && materialOrientatieTaken2(matKey, oriVal, editingId || null)) {
      throw new Error(
        `Dit materiaal heeft al een vlak met ori\xEBntatie ${oriVal}.`
      );
    }
  } else if (matKey && materialOrientatieTaken2(matKey, oriVal, editingId || null)) {
    throw new Error(
      `Dit materiaal heeft al een vlak met ori\xEBntatie ${oriVal}.`
    );
  }
  const isLen = opts.quantity_kind === "length";
  const qty = isLen ? String(opts.length_m != null ? opts.length_m : 0) : String(opts.area_m2 != null ? opts.area_m2 : 0);
  const pickFac = fac ? vrFacades.find((f) => f.id === fac) : void 0;
  const facadeId = pickFac ? facadeSourceId(pickFac) : fac || "";
  const ret = await invokeString("API_SaveVlak", [
    auth().token,
    selectedVrId,
    editingId,
    opts.label.trim() || "Vlak",
    isLen ? "0" : qty,
    opts.clVal,
    opts.cgVal,
    opts.meenemenGak ? "true" : "false",
    "0",
    facadeId,
    isLen ? "length" : "area",
    isLen ? qty : "",
    oriVal,
    opts.preferStored ? "true" : "",
    opts.ggId
  ]);
  if (ret.startsWith("ERROR")) throw new Error(ret);
}
vlakForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth() || !selectedVrId) throw new Error("Selecteer een VR");
    assertVlakPropsOrThrow();
    const editingId = selectedVlakId;
    const fac = vlakFacadeEl.value;
    const opt = vlakFacadeEl.selectedOptions[0];
    if (!fac && !editingId) throw new Error("Selecteer een gevelcomponent");
    let oriVal = "";
    if (editingId) {
      oriVal = normalizeOrientatie(vlakOrientatieEl?.value) || normalizeOrientatie(vlakken.find((v) => v.vlak_id === editingId)?.orientatie);
    } else {
      oriVal = normalizeOrientatie(vlakOrientatieEl?.value);
      if (!oriVal) throw new Error("Kies eerst een gevelori\xEBntatie in de listbox");
    }
    const isLen = (opt?.dataset.quantityKind || vlakAreaEl.dataset.quantityKind) === "length";
    const qtyN = Number(vlakAreaEl.value || "0");
    const ggId = await persistFormGevelgroep(oriVal);
    const formCorr = readFormClCg(oriVal);
    await saveVlakFromPick({
      editingId,
      primaryId: fac,
      quantity_kind: isLen ? "length" : "area",
      area_m2: isLen ? null : qtyN,
      length_m: isLen ? qtyN : null,
      label: vlakNameEl.value.trim() || opt?.dataset.label || "Vlak",
      materialKey: opt?.dataset.materialKey || null,
      materialId: opt?.dataset.materialId || null,
      oriVal,
      ggId,
      clVal: formCorr.cl,
      cgVal: formCorr.cg,
      meenemenGak: vlakGakEl.checked,
      preferStored: editingId ? Boolean(vlakken.find((x) => x.vlak_id === editingId)?.prefer_stored_qty) : false
    });
    const wasEdit = Boolean(editingId);
    await loadVlakken();
    clearVlakEdit(oriVal);
    const stotaalOk = vlakkenMatchFacadeStotaal();
    if (stotaalOk) {
      await refreshVrCalc({ persist: true });
      if (!selectedVlakId) {
        blankResultsUntilVlakSelected(
          "Vlak opgeslagen. Open een vlak in de lijst om de berekening te tonen."
        );
      }
      setConn(
        "ok",
        wasEdit ? `Vlak bijgewerkt (gevelgroep CL/Cg \u2192 GA;k)` : `Vlak gevuld \xB7 ori\xEBntatie ${normalizeOrientatie(oriVal)} \xB7 groep ${selectedPickGroepNr}`
      );
    } else {
      const incompleteOri = normalizeOrientatie(oriVal) || facadeOrisWithArea().find((o) => !vlakkenMatchFacadeStotaal(o)) || "";
      setConn(
        "err",
        `Vlak opgeslagen, maar Stotaal${incompleteOri ? ` voor ori ${incompleteOri}` : ""} is nog geen 100% \u2014 GA;k niet herberekend (vorige resultaten blijven staan). Vul materialen aan of snijd openingen (\xB1).`
      );
    }
  })().catch((e) => setConn("err", String(e)));
});
vlakListToVlakBtn?.addEventListener("click", () => {
  void (async () => {
    if (!auth() || !selectedVrId) throw new Error("Selecteer een VR");
    if (selectedVlakId) throw new Error("Annuleer eerst bewerken");
    assertVlakPropsOrThrow();
    const oriVal = normalizeOrientatie(vlakOrientatieEl?.value);
    if (!oriVal) throw new Error("Kies eerst een gevelori\xEBntatie");
    const groups = availableFacadePickGroups();
    if (!groups.length) throw new Error("Geen vrije materialen in de pickerlijst");
    const ggId = await persistFormGevelgroep(oriVal);
    const formCorr = readFormClCg(oriVal);
    let ok = 0;
    const errors = [];
    for (const g of groups) {
      try {
        const primary = g.members[0];
        await saveVlakFromPick({
          primaryId: g.primaryId,
          quantity_kind: g.quantity_kind === "length" ? "length" : "area",
          area_m2: g.area_m2,
          length_m: g.length_m,
          label: primary?.material_name || g.label || "Vlak",
          materialKey: g.materialKey,
          materialId: primary?.material_id || null,
          oriVal,
          ggId,
          clVal: formCorr.cl,
          cgVal: formCorr.cg,
          meenemenGak: true
        });
        ok += 1;
        await loadVlakken({ resetForm: false, openFirstVlak: false });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    clearVlakEdit(oriVal);
    await loadVlakken({ resetForm: true, openFirstVlak: false });
    const stotaalOk = vlakkenMatchFacadeStotaal();
    if (ok && stotaalOk) {
      await refreshVrCalc({ persist: true });
      if (!selectedVlakId) {
        blankResultsUntilVlakSelected(
          `${ok} vlak(ken) uit de lijst. Open een vlak om de berekening te tonen.`
        );
      }
    }
    const bits = [`${ok} vlak(ken) uit lijst \u2192 groep ${selectedPickGroepNr}`];
    if (errors.length) bits.push(`${errors.length} mislukt: ${errors[0]}`);
    if (ok && !stotaalOk) {
      bits.push("Stotaal nog geen 100% \u2014 GA;k niet herberekend (vorige resultaten blijven staan)");
    }
    setConn(ok && stotaalOk ? "ok" : "err", bits.join(" \xB7 "));
  })().catch((e) => setConn("err", String(e)));
});
vlakCancelBtn?.addEventListener("click", () => {
  clearVlakEdit();
  setConn("ok", "Bewerken geannuleerd");
});
copyVlakkenCbEl?.addEventListener("change", () => {
  syncCopyVlakkenBar();
});
copyVlakkenSourceEl?.addEventListener("change", () => {
  updateCopyVlakkenBtnEnabled();
});
copyVlakkenAnchorEl?.addEventListener("change", () => {
  updateCopyVlakkenBtnEnabled();
});
copyVlakkenBtnEl?.addEventListener("click", () => {
  void (async () => {
    const target = normalizeOrientatie(vlakOrientatieEl?.value);
    const parsed = parseCopySourceKey(copyVlakkenSourceEl?.value || "");
    const anchor = (copyVlakkenAnchorEl?.value || "").trim();
    if (!target) throw new Error("Kies eerst de doelori\xEBntatie in de listbox");
    if (!parsed) throw new Error("Kies een bron VR \xB7 ori");
    if (!anchor) throw new Error("Kies een anker-gevelvlak");
    await copyVlakkenFromSource(parsed.vrId, parsed.ori, target, anchor);
  })().catch((e) => setConn("err", String(e)));
});
vlakFacadeEl.addEventListener("change", () => {
  onFacadePick();
  syncVlakMaterialGate();
});
vlakGakEl.addEventListener("change", () => {
  if (!selectedVlakId) return;
  void refreshVrCalc({ useFormCorrections: true, persist: false });
  resultsDirty = true;
  setConn("ok", vlakGakEl.checked ? "Meenemen in GA;k \u2014 nog opslaan" : "Niet in Stot/GA;k \u2014 nog opslaan");
});
var corrPersistTimer = null;
var corrPersistGen = 0;
var onVlakCorrInput = () => {
  syncVlakCorrHint();
  const oriAtEdit = resolveFocusOrientatie();
  const capturedCorr = readFormClCg(oriAtEdit);
  const capturedGgId = selectedGevelgroepId;
  const capturedNr = selectedPickGroepNr === 2 || selectedPickGroepNr === 3 ? selectedPickGroepNr : 1;
  const g = findGevelgroep(capturedGgId) || findGevelgroepByNr(oriAtEdit, capturedNr);
  if (g) {
    g.cl_db = Math.round(Number(capturedCorr.cl) || 0);
    g.cg_db = Number(capturedCorr.cg) || 0;
  }
  renderVlakken();
  if (oriAtEdit || selectedVlakId) {
    void refreshVrCalc({ useFormCorrections: true, persist: false });
  }
  resultsDirty = true;
  setConn("busy", "CL/Cg opslaan\u2026");
  if (corrPersistTimer != null) clearTimeout(corrPersistTimer);
  const gen = ++corrPersistGen;
  corrPersistTimer = setTimeout(() => {
    corrPersistTimer = null;
    void (async () => {
      if (!auth() || !selectedVrId) {
        setConn("ok", "CL/Cg aangepast \u2014 log in en selecteer een VR om op te slaan");
        return;
      }
      const ori = resolveFocusOrientatie(oriAtEdit) || normalizeOrientatie(findGevelgroep(capturedGgId)?.orientatie);
      if (!ori && !capturedGgId) {
        setConn("ok", "CL/Cg aangepast \u2014 kies een ori\xEBntatie om op te slaan");
        return;
      }
      if (capturedGgId) selectedGevelgroepId = capturedGgId;
      selectedPickGroepNr = capturedNr;
      try {
        await persistFormGevelgroep(ori, capturedCorr);
        if (gen !== corrPersistGen) return;
        await loadVlakken({ resetForm: false, openFirstVlak: false });
        if (gen !== corrPersistGen) return;
        const savedOri = resolveFocusOrientatie(ori);
        setConn(
          "ok",
          `CL/Cg opgeslagen voor ${ORIENTATIE_LABELS[savedOri] || savedOri || "?"} \xB7 groep ${selectedPickGroepNr} \u2014 herbereken voor GA;k`
        );
      } catch (e) {
        if (gen !== corrPersistGen) return;
        setConn("err", e instanceof Error ? e.message : String(e));
      }
    })();
  }, 350);
};
vlakClEl?.addEventListener("input", onVlakCorrInput);
vlakCgEl?.addEventListener("input", onVlakCorrInput);
vlakClDownBtn?.addEventListener("click", () => nudgeCorrField(vlakClEl, -1));
vlakClUpBtn?.addEventListener("click", () => nudgeCorrField(vlakClEl, 1));
vlakCgDownBtn?.addEventListener("click", () => nudgeCorrField(vlakCgEl, -0.1));
vlakCgUpBtn?.addEventListener("click", () => nudgeCorrField(vlakCgEl, 0.1));
vlakCorrResetBtn?.addEventListener("click", () => {
  const code = normalizeOrientatie(vlakOrientatieEl?.value);
  const def = correctionsForOrientatie(code);
  if (vlakClEl) vlakClEl.value = def.cl;
  if (vlakCgEl) vlakCgEl.value = def.cg;
  onVlakCorrInput();
  setConn("ok", "CL/Cg teruggezet op ori-default (groep)");
});
vlakPickGroepEl?.addEventListener("change", () => {
  const nr = Number(vlakPickGroepEl.value) || 1;
  selectedPickGroepNr = nr === 2 || nr === 3 ? nr : 1;
  const code = normalizeOrientatie(vlakOrientatieEl?.value);
  const g = findGevelgroepByNr(code, selectedPickGroepNr);
  selectedGevelgroepId = g?.gevelgroep_id || null;
  applyClCgFromGevelgroep(g, code);
  selectedVlakId = null;
  vlakNameEl.value = "";
  if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak vullen";
  vlakCancelBtn?.classList.add("hidden");
  fillFacadeSelect();
  syncVlakMaterialGate();
  updateVlakInventory();
  renderVlakken();
  blankResultsUntilVlakSelected(
    code ? `Groep ${selectedPickGroepNr} \xB7 ${ORIENTATIE_LABELS[code] || code} \u2014 kies materiaal bij 2.` : void 0
  );
  setConn("ok", `Gevelgroep ${selectedPickGroepNr} \u2014 componenten gefilterd`);
});
recalcBtn?.addEventListener("click", () => {
  void (async () => {
    if (!auth() || !selectedVrId) {
      setConn("err", "Selecteer eerst een VR");
      return;
    }
    if (corrPersistTimer != null) {
      clearTimeout(corrPersistTimer);
      corrPersistTimer = null;
    }
    const focusOri = resolveFocusOrientatie();
    const formCorrAtClick = readFormClCg(focusOri);
    if (focusOri || selectedGevelgroepId) {
      await persistFormGevelgroep(focusOri || void 0, formCorrAtClick);
    }
    if (!vlakken.length) {
      setConn("err", "Voeg eerst vlakken toe tot 100% Stotaal");
      return;
    }
    if (!vlakkenMatchFacadeStotaal()) {
      const badOri = facadeOrisWithArea().find((o) => !vlakkenMatchFacadeStotaal(o));
      setConn(
        "err",
        badOri && facadeOpeningsUncutFromWall(badOri) ? `Herberekenen niet mogelijk: snijd eerst openingen uit de gevelcontour op ori ${badOri} (\xB1 op de geveltekening)` : badOri ? `Herberekenen niet mogelijk: ori ${badOri} is nog geen 100% Stotaal` : "Herberekenen niet mogelijk: oppervlaktedekking is nog geen 100% Stotaal per ori\xEBntatie"
      );
      syncRecalcEnabled();
      return;
    }
    if (selectedVlakId) {
      assertVlakPropsOrThrow();
      const v = vlakken.find((x) => x.vlak_id === selectedVlakId);
      if (v) {
        const live = liveVlakQty(v);
        const oriVal = resolveFocusOrientatie(v.orientatie) || v.orientatie || "";
        const ggId = selectedGevelgroepId || await persistFormGevelgroep(oriVal, readFormClCg(oriVal));
        const formCorr = readFormClCg(oriVal);
        const syncRet = await invokeString("API_SaveVlak", [
          auth().token,
          selectedVrId,
          v.vlak_id,
          vlakNameEl.value.trim() || v.omschrijving || "Vlak",
          live.kind === "area" ? String(live.qty) : "0",
          formCorr.cl,
          formCorr.cg,
          vlakGakEl.checked ? "true" : "false",
          String(v.sort_order || 0),
          v.facade_subsection_id || "",
          live.kind,
          live.kind === "length" ? String(live.qty) : "",
          oriVal,
          v.prefer_stored_qty ? "true" : "",
          ggId
        ]);
        if (syncRet.startsWith("ERROR")) throw new Error(syncRet);
        clearVlakEdit();
      }
    }
    await loadVlakken({ resetForm: false, openFirstVlak: false });
    await refreshVrCalc({ persist: true, reveal: true });
    setConn("ok", "GA / GA;k herberekend (alle gevelgroepen in D2m, gecombineerd)");
  })().catch((e) => setConn("err", String(e)));
});
function setAnalyzeEnabled(on) {
  if (analyzeBtn) analyzeBtn.disabled = !on;
}
function hideAnalyzePanel() {
  analyzePanelEl?.classList.add("hidden");
  if (analyzeCausesEl) analyzeCausesEl.innerHTML = "";
  if (analyzeSuggestionsEl) analyzeSuggestionsEl.innerHTML = "";
  if (analyzeHintEl) analyzeHintEl.textContent = "";
}
function syncAnalyzeUi(fail) {
  setAnalyzeEnabled(fail);
  if (!fail) hideAnalyzePanel();
}
function materialsForAnalyze(result) {
  const byMat = /* @__PURE__ */ new Map();
  let elIdx = 0;
  for (const v of vlakken) {
    const fac = findFacadeForVlak(v) || void 0;
    const live = liveVlakQty(v);
    const ra = fac?.ra_dba != null ? Number(fac.ra_dba) : NaN;
    if (!(live.qty > 0) || !Number.isFinite(ra)) continue;
    const el = result.elements[elIdx];
    const elementIndex = elIdx;
    elIdx += 1;
    const mid = (fac?.material_id || "").trim();
    if (!mid || !v.facade_subsection_id) continue;
    const ras = el?.ras ?? null;
    const prev = byMat.get(mid);
    if (!prev || ras != null && (prev.ras == null || ras < prev.ras)) {
      byMat.set(mid, {
        facadeId: v.facade_subsection_id,
        materialId: mid,
        materialName: fac?.material_name || v.omschrijving || "Materiaal",
        catalogId: fac?.catalog_id || null,
        ra_dba: ra,
        ras,
        elementIndex,
        label: v.omschrijving || fac?.label || "Vlak",
        area_m2: el?.area_for_s ?? (live.kind === "area" ? live.qty : 0)
      });
    }
  }
  return [...byMat.values()].sort((a, b) => {
    const ar = a.ras ?? Infinity;
    const br = b.ras ?? Infinity;
    return ar - br;
  });
}
async function runAnalyze() {
  if (!auth()) return;
  if (!lastFreshGaResult || lastFreshGaResult.voldoet !== false) {
    await refreshVrCalc({ persist: false, reveal: true });
  }
  const result = lastFreshGaResult;
  if (!result || result.voldoet !== false) {
    setConn("ok", "Toets voldoet \u2014 Analyseer niet nodig");
    hideAnalyzePanel();
    setAnalyzeEnabled(false);
    return;
  }
  if (!analyzePanelEl || !analyzeCausesEl || !analyzeSuggestionsEl) return;
  const lbik = result.lbik_dba;
  const grens = result.grenswaarde_lbik_db;
  const deficit = lbik != null && Number.isFinite(lbik) ? Math.max(0, round1(lbik - grens)) : 0;
  const gak = result.gak_dba;
  const gakReq = result.gak_required_dba;
  const causes = [];
  if (deficit > 0) {
    causes.push(
      `Lbi;k = ${fmtRes(lbik)} dB overschrijdt de grens van ${fmtRes(grens)} dB met ${fmtRes(deficit)} dB.`
    );
  } else {
    causes.push(`Lbi;k voldoet niet aan de grens van ${fmtRes(grens)} dB.`);
  }
  if (gak != null && gakReq != null && gak < gakReq) {
    causes.push(
      `GA;k = ${fmtRes(gak)} dB is lager dan vereist (${fmtRes(gakReq)} dB = Lb \u2212 grens).`
    );
  }
  if (result.cl_db === 0 && result.cg_db === 0) {
    causes.push("CL en Cg zijn 0 dB \u2014 controleer of ori\xEBntatiecorrecties op de plattegrond zijn gezet.");
  }
  const mats = materialsForAnalyze(result);
  if (!mats.length) {
    causes.push("Geen gekoppelde materialen gevonden op de vlakken \u2014 koppel materialen op de geveltekening.");
  } else {
    const weakest = mats.slice(0, 3);
    for (const m of weakest) {
      const rasTxt = m.ras != null ? `RAs \u2248 ${fmtRes(m.ras)} dB` : "RAs onbekend";
      causes.push(
        `Zwak element: \xAB${m.label}\xBB (${m.materialName}, RA ${fmtRes(m.ra_dba)} dB, ${rasTxt}).`
      );
    }
  }
  analyzeCausesEl.innerHTML = causes.map((c) => `<li>${esc(c)}</li>`).join("");
  if (analyzeHintEl) {
    analyzeHintEl.textContent = deficit > 0 ? `Suggesties: equivalente materialen met hogere RA (zelfde rubriek). Richtwaarde \u2248 +${fmtRes(deficit)} dB op R\u2032/GA;k.` : "Suggesties: equivalente materialen met hogere RA (zelfde rubriek).";
  }
  analyzeSuggestionsEl.innerHTML = `<p class="hint">Alternatieven laden\u2026</p>`;
  analyzePanelEl.classList.remove("hidden");
  const blocks = [];
  for (const m of mats) {
    const need = deficit > 0 ? minRaDeltaForRprime(result.elements, m.elementIndex, deficit) : 0;
    let alts = [];
    try {
      const data = bppPhase1Enabled() ? await bppListMaterialAlternatives(invokeString, auth().token, m.materialId, 8) : await apiGet(
        `/api/floormap/material-alternatives?material_id=${encodeURIComponent(m.materialId)}&limit=8`
      );
      alts = Array.isArray(data.alternatives) ? data.alternatives.map((alt) => ({
        material_id: alt.material_id,
        catalog_id: alt.catalog_id ?? null,
        name: alt.name ?? "",
        ra_dba: alt.ra_dba ?? 0,
        delta_ra: alt.delta_ra,
        thickness_mm: alt.thickness_mm ?? null
      })) : [];
    } catch (err) {
      blocks.push(
        `<div class="ga-analyze-mat"><p class="ga-analyze-mat-title">${esc(m.materialName)}</p><p class="hint">Alternatieven ophalen mislukt: ${esc(err instanceof Error ? err.message : String(err))}</p></div>`
      );
      continue;
    }
    const ranked = [...alts].sort((a, b) => {
      const aOk = need != null && need > 0 ? a.delta_ra >= need : true;
      const bOk = need != null && need > 0 ? b.delta_ra >= need : true;
      if (aOk !== bOk) return aOk ? -1 : 1;
      return a.delta_ra - b.delta_ra;
    });
    const needTxt = need == null ? "Dit vlak alleen kan de norm niet redden \u2014 combineer met andere materialen." : need > 0 ? `Voor dit vlak is circa +${fmtRes(need)} dB RA nodig om de overschrijding te dichten.` : "";
    const facadesWithMat = vrFacades.filter((f) => (f.material_id || "") === m.materialId).map((f) => f.id);
    const targetIds = facadesWithMat.length ? facadesWithMat : [
      ...new Set(
        vlakken.map((v) => v.facade_subsection_id).filter(
          (id) => typeof id === "string" && id.length > 0 && facadeByMaterial(id, m.materialId)
        )
      )
    ];
    let altHtml;
    if (!ranked.length) {
      altHtml = `<p class="hint">Geen materialen met hogere RA in dezelfde rubriek.</p>`;
    } else {
      altHtml = `<ul class="ga-analyze-alt-list">` + ranked.map((a) => {
        const enough = need != null && need > 0 && a.delta_ra >= need;
        const th = a.thickness_mm != null && Number.isFinite(a.thickness_mm) ? `, ${fmtRes(a.thickness_mm)} mm` : "";
        const cat = a.catalog_id ? ` \xB7 ${a.catalog_id}` : "";
        const cls = enough ? " ga-analyze-alt-enough" : "";
        const mark = enough ? " \xB7 voldoende \u0394RA" : "";
        return `<li class="ga-analyze-alt-item${cls}"><span>${esc(a.name)}${esc(cat)} \u2014 RA ${fmtRes(a.ra_dba)} dB (+${fmtRes(a.delta_ra)})${esc(th)}${esc(mark)}</span><button type="button" class="secondary ga-analyze-apply" data-material-id="${esc(a.material_id)}" data-from-material-id="${esc(m.materialId)}" data-subsection-ids="${esc(targetIds.join(","))}" data-name="${esc(a.name)}">Pas toe</button></li>`;
      }).join("") + `</ul>`;
    }
    blocks.push(
      `<div class="ga-analyze-mat"><p class="ga-analyze-mat-title">${esc(m.materialName)} <span class="ga-analyze-mat-meta">(RA ${fmtRes(m.ra_dba)} dB \xB7 ${esc(m.label)})</span></p>` + (needTxt ? `<p class="ga-analyze-mat-meta">${esc(needTxt)}</p>` : "") + altHtml + `</div>`
    );
  }
  analyzeSuggestionsEl.innerHTML = blocks.length ? blocks.join("") : `<p class="hint">Geen materiaalsuggesties beschikbaar.</p>`;
  setConn("ok", "Analyse klaar \u2014 kies eventueel Pas toe");
}
function facadeByMaterial(facadeId, materialId) {
  const fac = vrFacades.find((f) => f.id === facadeId);
  return (fac?.material_id || "") === materialId;
}
async function applyAnalyzeMaterial(subsectionIds, materialId, name, fromMaterialId) {
  if (!auth() || !materialId) return;
  const oldMat = (fromMaterialId || "").trim();
  const targets = new Set(subsectionIds.filter(Boolean));
  if (oldMat) {
    for (const f of vrFacades) {
      if ((f.material_id || "") === oldMat) targets.add(f.id);
    }
  }
  if (!targets.size) {
    setConn("err", "Geen gevelcomponenten om materiaal op toe te passen");
    return;
  }
  setConn("busy", `Materiaal toepassen: ${name}\u2026`);
  let appliedRa = null;
  let appliedCatalog = null;
  let appliedName = name;
  for (const sid of targets) {
    const ret = bppPhase1Enabled() ? await bppSaveSubsectionMaterial(invokeString, auth().token, sid, materialId) : await apiPost("/api/floormap/subsection-material", {
      subsection_id: sid,
      material_id: materialId
    });
    const mat = ret.material;
    if (mat) {
      if (mat.ra_dba != null && Number.isFinite(Number(mat.ra_dba))) appliedRa = Number(mat.ra_dba);
      if (mat.catalog_id != null) appliedCatalog = String(mat.catalog_id);
      if (mat.name) appliedName = String(mat.name);
    }
    const fac = vrFacades.find((f) => f.id === sid);
    if (fac) {
      fac.material_id = materialId;
      fac.material_name = appliedName;
      if (appliedCatalog != null) fac.catalog_id = appliedCatalog;
      if (appliedRa != null) fac.ra_dba = appliedRa;
      fac.ga_ready = true;
    }
  }
  await loadFacadesForSelectedVr();
  renderVlakken();
  hideAnalyzePanel();
  await refreshVrCalc({ persist: true, reveal: true });
  if (!lastFreshGaResult?.ok) {
    await loadFacadesForSelectedVr();
    await refreshVrCalc({ persist: true, reveal: true });
  }
  const ok = lastFreshGaResult?.voldoet === true;
  const fail = lastFreshGaResult?.voldoet === false;
  syncAnalyzeUi(fail);
  setConn(
    "ok",
    ok ? `\xAB${appliedName}\xBB toegepast op ${targets.size} component(en) \u2014 toets voldoet` : fail ? `\xAB${appliedName}\xBB toegepast op ${targets.size} component(en) \u2014 toets nog niet voldoende (Analyseer opnieuw mogelijk)` : `\xAB${appliedName}\xBB toegepast op ${targets.size} component(en) \u2014 herberekend`
  );
}
analyzeBtn?.addEventListener("click", () => {
  void runAnalyze().catch((e) => setConn("err", String(e)));
});
analyzeSuggestionsEl?.addEventListener("click", (ev) => {
  const t = ev.target;
  const btn = t?.closest?.("button.ga-analyze-apply");
  if (!btn) return;
  const materialId = (btn.dataset.materialId || "").trim();
  const fromMaterialId = (btn.dataset.fromMaterialId || "").trim();
  const ids = (btn.dataset.subsectionIds || "").split(",").map((s) => s.trim()).filter(Boolean);
  const name = (btn.dataset.name || "materiaal").trim();
  void applyAnalyzeMaterial(ids, materialId, name, fromMaterialId).catch(
    (e) => setConn("err", String(e))
  );
});
async function saveProjectReport(force = false) {
  if (!auth() || !buildingId) throw new Error("Log in en selecteer een gebouw");
  if (!selectedVariantId) throw new Error("Selecteer eerst een variant");
  const status = reportKindEl?.value === "definitief" ? "definitief" : "concept";
  setConn("busy", "Rapport: alle gevelori\u2019s herberekenen\u2026");
  if (reportHintEl) reportHintEl.textContent = "Eerst alle VR\u2019s herberekenen (alle gevelori\u2019s)\u2026";
  const checkpoint = await saveProjectCheckpoint();
  if (checkpoint.saved === 0 && (checkpoint.skipped > 0 || checkpoint.failed > 0)) {
    const reasonBit = checkpoint.reasons.length ? ` ${checkpoint.reasons.slice(0, 5).join("; ")}${checkpoint.reasons.length > 5 ? "\u2026" : ""}` : " Vul per VR alle gevelori\xEBntaties tot 100% Stotaal.";
    const msg = `Rapport niet gemaakt: geen VR met opgeslagen GA;k.${reasonBit}`;
    if (reportHintEl) reportHintEl.textContent = msg;
    setConn("err", msg);
    throw new Error(msg);
  }
  const genHint = checkpoint.failed || checkpoint.skipped ? `Rapport genereren\u2026 (${checkpoint.saved} VR\u2019s actueel \xB7 ${checkpoint.skipped + checkpoint.failed} overgeslagen)` : `Rapport genereren\u2026 (herberekening gevelori\u2019s geslaagd \xB7 ${checkpoint.saved} VR\u2019s)`;
  setConn("busy", genHint);
  if (reportHintEl) reportHintEl.textContent = genHint;
  const res = await fetch("/api/reports/generate", {
    method: "POST",
    credentials: "include",
    headers: apiAuthHeaders(auth().token, true),
    body: JSON.stringify({
      building_id: buildingId,
      variant_id: selectedVariantId,
      status,
      force
    })
  });
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    const msg = `Rapport opslaan mislukt (HTTP ${res.status})`;
    setConn("err", msg);
    throw new Error(msg);
  }
  if (!res.ok || !parsed.ok) {
    const msg = parsed.error || `Rapport opslaan mislukt (HTTP ${res.status})`;
    setConn("err", msg);
    throw new Error(msg);
  }
  const pdfName = parsed.pdf_filename || parsed.filename_pdf || null;
  if (parsed.identical && parsed.skipped) {
    const existing = parsed.existing_filename || "bestaand bestand";
    const msg = parsed.warning || `Identiek rapport bestaat al (${existing}) \u2014 er is niets weggeschreven.`;
    if (reportHintEl) reportHintEl.textContent = msg;
    setConn("err", msg);
    const forceAnyway = window.confirm(
      `${msg}

Toch een nieuw bestand schrijven?`
    );
    if (forceAnyway) return saveProjectReport(true);
    return pdfName || (existing.endsWith(".html") || existing.endsWith(".pdf") ? existing : null);
  }
  const pathHint = parsed.relative_path || pdfName || parsed.filename || "";
  const folder = parsed.project_folder ? ` \xB7 map ${parsed.project_folder}` : "";
  const recomputeBit = checkpoint.failed || checkpoint.skipped ? ` \xB7 herberekening: ${checkpoint.saved} VR\u2019s ok` : ` \xB7 alle gevelori\u2019s herberekend (${checkpoint.saved} VR\u2019s)`;
  const okMsg = `Rapport opgeslagen (PDF): ${pathHint}${folder}${recomputeBit}`;
  if (reportHintEl) reportHintEl.textContent = okMsg;
  setConn("ok", okMsg);
  return pdfName || parsed.filename || null;
}
async function publishReportToInbox(filename) {
  if (!auth() || !buildingId) throw new Error("Log in en selecteer een gebouw");
  const reportKind = reportKindEl?.value === "definitief" ? "definitief" : "concept";
  if (reportHintEl) reportHintEl.textContent = "Publiceren naar inbox\u2026";
  const res = await fetch("/api/reports/publish", {
    method: "POST",
    credentials: "include",
    headers: apiAuthHeaders(auth().token, true),
    body: JSON.stringify({
      building_id: buildingId,
      filename,
      report_kind: reportKind,
      version_label: "1.0"
    })
  });
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    throw new Error(`Publiceren mislukt (HTTP ${res.status})`);
  }
  if (!res.ok || !parsed.ok) {
    throw new Error(parsed.error || `Publiceren mislukt (HTTP ${res.status})`);
  }
  const kindLabel = reportKind === "definitief" ? "definitieve" : "concept";
  const okMsg = `${kindLabel.charAt(0).toUpperCase()}${kindLabel.slice(1)} rapport in inbox opdrachtgever gezet${parsed.project_status ? ` \xB7 status ${parsed.project_status}` : ""}.`;
  if (reportHintEl) reportHintEl.textContent = okMsg;
  setConn("ok", okMsg);
}
reportBtn?.addEventListener("click", () => {
  void saveProjectReport(false).catch((e) => {
    const msg = String(e);
    if (reportHintEl) reportHintEl.textContent = msg;
    setConn("err", msg);
  });
});
reportInboxBtn?.addEventListener("click", () => {
  void (async () => {
    const filename = await saveProjectReport(false);
    if (!filename) throw new Error("Geen rapportbestand om te publiceren");
    await publishReportToInbox(filename);
  })().catch((e) => {
    const msg = String(e);
    if (reportHintEl) reportHintEl.textContent = msg;
    setConn("err", msg);
  });
});
if (buildingId) buildingIdEl.value = buildingId;
syncFloormapLink();
initPasswordToggles();
if (fileMenuRoot) {
  projectMenu = mountProjectMenu(fileMenuRoot, {
    getToken: () => auth()?.token ?? null,
    getBuildingId: () => buildingId,
    getProjectMeta: () => ({ label: buildingLabel, external_ref: buildingExternalRef }),
    invokeString: (name, args) => invokeString(name, args),
    apiAuthHeaders: () => auth ? apiAuthHeaders(auth().token, true) : {},
    openBuilding: (id) => openBuilding(id),
    saveProject: () => saveProjectCheckpoint(),
    onProjectRenamed: (meta) => {
      buildingLabel = meta.label;
      buildingExternalRef = meta.external_ref;
      setBuildingMetaText(buildingMetaLine());
    },
    onProjectDeleted: async () => {
      buildingId = "";
      buildingLabel = "";
      buildingExternalRef = "";
      buildingIdEl.value = "";
      modelPanelEl.classList.add("hidden");
      setBuildingMetaText("\u2014");
      if (projectIdBarEl) projectIdBarEl.open = true;
      variants = [];
      vgs = [];
      vrs = [];
      selectedVariantId = null;
      selectedVgId = null;
      selectedVrId = null;
      const url = new URL(location.href);
      url.searchParams.delete("building_id");
      history.replaceState(null, "", url.toString());
      syncFloormapLink();
    },
    onStatus: (state, text) => setConn(state, text),
    setTitle: (title) => {
      document.title = title === "Geen project" ? "Stilte advies en meten \u2014 Berekening gevelwering" : `${title} \u2014 GA`;
    }
  });
  fileMenuRoot.hidden = true;
}
initProcessDockChrome();
{
  const stored = loadAuth(AUTH_KEY);
  if (stored?.token) showPanel(stored);
}
session.connect();
async function refreshGaFromFloormap() {
  if (!buildingId || !auth()?.token || modelPanelEl.classList.contains("hidden")) return;
  await loadGeometryOptions();
  await loadVgs(selectedVgId, selectedVrId);
  setBuildingMetaText(buildingMetaLine());
}
window.addEventListener("pageshow", (ev) => {
  if (!ev.persisted) return;
  void refreshGaFromFloormap().catch((e) => setConn("err", String(e)));
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  void refreshGaFromFloormap().catch((e) => setConn("err", String(e)));
});
