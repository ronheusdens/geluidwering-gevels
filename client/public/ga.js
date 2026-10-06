var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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
  const key = String(gebruiksfunctie || "").trim();
  if (key && key in GRENZWAARDE_LBIK_BY_FUNCTIE) {
    return GRENZWAARDE_LBIK_BY_FUNCTIE[key];
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
    raw.push({
      label: v.label || "",
      kind,
      quantity: qty,
      ra_dba: ra,
      meenemen_gak: v.meenemen_gak !== false,
      cl_db: overrideCl != null ? overrideCl : Number(v.cl_db) || 0,
      cg_db: overrideCg != null ? overrideCg : Number(v.cg_db) || 0,
      area_for_s: kind === "area" ? qty : 0,
      orientatie: normalizeOriKey(v.orientatie)
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
  const byOri = /* @__PURE__ */ new Map();
  for (const e of raw) {
    const list = byOri.get(e.orientatie) || [];
    list.push(e);
    byOri.set(e.orientatie, list);
  }
  const facades = [];
  const allElements = [];
  for (const [ori, group] of byOri) {
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
    let cl = 0;
    let cg = 0;
    let bestArea = -1;
    for (const e of group) {
      if (e.area_for_s > bestArea) {
        bestArea = e.area_for_s;
        cl = e.cl_db;
        cg = e.cg_db;
      }
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
      orientatie: ori
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
    const d2m = rPrime + ruimte + cl + cg;
    const gaOri = d2m - Cr;
    const lbiOri = Number.isFinite(Lb) ? Lb - gaOri : null;
    facades.push({
      orientatie: ori,
      s_m2: sOri,
      r_prime: rPrime,
      ruimte_db: ruimte,
      cl_db: cl,
      cg_db: cg,
      d2m_nt: d2m,
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
  const d2mTot = combineLevelsDb(facades.map((f) => f.d2m_nt));
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
  const peers = ori != null ? elements.map((e, i) => ({ e, i })).filter(({ e }) => e.orientatie === ori) : elements.map((e, i) => ({ e, i }));
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
var APP_VERSION = "0.72";
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
        btn.textContent = p.customer_name ? `${title} \u2014 ${p.customer_name}` : title;
        if (p.project_status) {
          btn.title = p.project_status;
        }
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
    r.vg_nr != null ? `VG ${r.vg_nr}` : null,
    r.vr_nr ? `VR ${r.vr_nr}` : null,
    r.label || null,
    levelLabel(r.level_hint),
    r.area_m2 != null ? `${Number(r.area_m2).toFixed(2)} m\xB2` : null
  ].filter(Boolean);
  return bits.join(" \xB7 ");
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
  async bootstrapAndLogin(username, password) {
    await this.whenOpen();
    await this.loadSharedApi();
    const ret = await this.invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    const parsed = JSON.parse(ret);
    if (!parsed.ok || !parsed.token) throw new Error("Inloggen mislukt");
    const info = {
      token: parsed.token,
      username: parsed.username || username,
      display_name: parsed.display_name || username
    };
    this.auth = info;
    this.storeAuth(info);
    this.cb.onLogin(info);
    return info;
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
          if (gen !== this.connectGen) return;
          await this.cb.onReady?.();
        } catch (err) {
          if (gen !== this.connectGen) return;
          this.cb.onStatus(err instanceof Error ? err.message : String(err), "err");
          this.cb.onLogout();
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
  return vrFacades.find((f) => !f.from_seal && f.id === sid) || vrFacades.find((f) => f.id === sid) || null;
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
var vlakClEl = document.getElementById("ga-vlak-cl");
var vlakCgEl = document.getElementById("ga-vlak-cg");
var vlakOriStatusEl = document.getElementById("ga-vlak-ori-status");
var vlakEditHintEl = document.getElementById("ga-vlak-edit-hint");
var vlakGakEl = document.getElementById("ga-vlak-gak");
var vlakSaveBtn = document.getElementById("ga-vlak-save-btn");
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
var selectedVgId = null;
var vrs = [];
var selectedVrId = null;
var selectedVlakId = null;
var vlakPickSyncLock = false;
var vlakPickValue = "";
var vlakken = [];
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
}
function showPanel(info) {
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
  if (fileMenuRoot) fileMenuRoot.hidden = false;
  projectMenu?.setEnabled(true);
  projectMenu?.refreshTitle();
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
function syncFloormapLink() {
  const q = buildingId ? `?building_id=${encodeURIComponent(buildingId)}` : "";
  floormapLinkEl.href = `/floormap.html${q}`;
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
  const rooms = roomsForVg(vgId);
  const fromRoom = rooms.find((r) => r.vg_nr != null)?.vg_nr;
  if (fromRoom != null) return Number(fromRoom);
  return parseVgNrFromText(omschrijving || "");
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
    if (vgNrForVg(g.verblijfsgebied_id, g.omschrijving) === n) return g.verblijfsgebied_id;
  }
  return null;
}
function gaSelStorageKey(bid) {
  return `app-gevelwering-ga-sel:${bid}`;
}
function rememberGaSelection() {
  if (!buildingId) return;
  try {
    const payload = {
      variantId: selectedVariantId,
      vgId: selectedVgId,
      vrId: selectedVrId
    };
    sessionStorage.setItem(gaSelStorageKey(buildingId), JSON.stringify(payload));
  } catch {
  }
}
function readRememberedGaSelection() {
  if (!buildingId) return null;
  try {
    const raw = sessionStorage.getItem(gaSelStorageKey(buildingId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function vgVrNrSummary(vgId) {
  const rooms = roomsForVg(vgId);
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
async function loadGeometryOptions() {
  if (!buildingId || !auth()) return;
  const sectionRows = bppPhase1Enabled() ? (await bppListFloormapSections(invokeString, auth().token, buildingId)).sections : (await apiGet(`/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`)).sections;
  const rooms = [];
  floormapRoomsById = /* @__PURE__ */ new Map();
  for (const sec of sectionRows || []) {
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
  if (f.material_id) return `id:${f.material_id}|${kind}`;
  const name = (f.material_name || "").trim().toLowerCase();
  const cat = (f.master_category || "").trim().toLowerCase();
  if (!name && !cat) return null;
  const ra = f.ra_dba != null && Number.isFinite(f.ra_dba) ? String(f.ra_dba) : "";
  return `name:${cat}|${name}|${ra}|${kind}`;
}
function filterFacadeGroupsByOrientatie(groups, wantOri) {
  const want = normalizeOrientatie(wantOri);
  if (!want) return groups;
  return groups.filter((g) => groupOrientatie(g) === want);
}
function groupFacadesForPick(facades, usedIds) {
  const groups = /* @__PURE__ */ new Map();
  const singles = [];
  for (const f of facades) {
    const key = materialGroupKey(f);
    if (!key) {
      singles.push(f);
      continue;
    }
    const list = groups.get(key) || [];
    list.push(f);
    groups.set(key, list);
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
    const pool = available;
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
    out.push({
      primaryId: pool[0].id,
      memberIds: pool.map((m) => m.id),
      members: pool,
      quantity_kind: kind,
      area_m2: areaSum != null ? Math.round(areaSum * 100) / 100 : null,
      length_m: lenSum != null ? Math.round(lenSum * 100) / 100 : null,
      label: pool[0].label || "",
      materialKey,
      ga_ready: pool.every((m) => m.ga_ready),
      used: false,
      orientatie: groupOrientatie({ members: pool, orientatie: facadeOrientatie(pool[0]) })
    });
  };
  for (const [key, members] of groups) {
    const byOri = /* @__PURE__ */ new Map();
    for (const m of members) {
      const o = facadeOrientatie(m) || "";
      const list = byOri.get(o) || [];
      list.push(m);
      byOri.set(o, list);
    }
    for (const [, oriMembers] of byOri) {
      pushGroup(oriMembers, key);
    }
  }
  for (const f of singles) {
    pushGroup([f], null);
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
      cl: String(Number(c.cl_db) || 0),
      cg: String(Number(c.cg_db) || 0)
    };
  }
  return { cl: "0", cg: "0" };
}
function applyClCgFromOrientatie(ori) {
  const c = correctionsForOrientatie(ori);
  if (vlakClEl) {
    vlakClEl.value = c.cl;
    vlakClEl.readOnly = true;
    vlakClEl.title = "CL vast per gevelori\xEBntatie (plattegrond) \u2014 niet live te wijzigen";
  }
  if (vlakCgEl) {
    vlakCgEl.value = c.cg;
    vlakCgEl.readOnly = true;
    vlakCgEl.title = "Cg vast per gevelori\xEBntatie (plattegrond) \u2014 niet live te wijzigen";
  }
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
  const freeMats = groupFacadesForPick(vrFacades, used).filter(
    (g) => g.ga_ready && !g.used && Boolean(groupOrientatie(g)) && materialHasFreeOrientatie2(g.materialKey)
  );
  const noFreeMat = !editing && vrFacades.length > 0 && freeMats.length === 0;
  const propsOk = editing || vlakPropsComplete();
  const ready = propsOk && !noPlattegrondOri && (!noFreeMat || editing);
  applyClCgFromOrientatie(vlakOrientatieEl?.value);
  syncOrientatieDisplay();
  const lockFacade = editing;
  vlakFacadeEl.disabled = lockFacade || !ready;
  vlakComponentFieldset?.classList.toggle("is-gated", !ready && !editing);
  vlakFacadeEl.classList.toggle("ga-facade-select--locked", lockFacade);
  if (vlakPropsGateHintEl) {
    const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
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
      const leftover = wantOri ? groupFacadesForPick(vrFacades, used).filter(
        (g) => g.ga_ready && !g.used && groupOrientatie(g) === wantOri && materialHasFreeOrientatie2(g.materialKey)
      ) : [];
      vlakPropsGateHintEl.textContent = wantOri && assignedForOri.length && leftover.length === 0 ? `Alle materialen voor ${wantOri} zijn toebedeeld \u2014 zie toegevoegde vlakken.` : "Kies een nog niet gekoppeld materiaal van de geveltekening. Zelfde materiaal wordt opgeteld; zo vul je Stotaal tot 100%.";
    }
  }
  if (!ready) {
    vlakFacadeEl.title = noPlattegrondOri ? "Eerst ori\xEBntaties op de plattegrond" : noFreeMat ? "Geen vrij materiaal meer" : "Eerst plattegrond-ori\xEBntatie";
    if (vlakSaveBtn && !editing) {
      vlakSaveBtn.disabled = true;
      vlakSaveBtn.title = vlakFacadeEl.title;
    }
    return;
  }
  vlakFacadeEl.title = "Materiaal en RA staan op de gevelcomponent; wijzig die op de geveltekening";
  if (vlakSaveBtn) {
    const hasFac = Boolean(vlakFacadeEl.value) || editing;
    vlakSaveBtn.disabled = !hasFac && !editing;
    vlakSaveBtn.title = hasFac || editing ? "" : "Selecteer een gevelcomponent";
  }
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
function createOriStatusLed(ori, ready) {
  const led = document.createElement("span");
  led.className = "scale-calibrated-led";
  led.classList.add(ready ? "is-on" : "is-warn");
  led.setAttribute("role", "status");
  const name = ORIENTATIE_LABELS[ori] || ori;
  const title = ready ? `${ori} (${name}): materialen gekoppeld` : `${ori} (${name}): nog niet berekend`;
  led.title = title;
  led.setAttribute("aria-label", title);
  return led;
}
function appendVrOriLedStrip(parent, vr) {
  const room = roomFromVr(vr);
  const expected = Array.isArray(room?.expected_orientaties) ? room.expected_orientaties.map((o) => normalizeOrientatie(o)).filter(Boolean) : [];
  if (!expected.length) return;
  const present = vrOriPresentById.get(vr.verblijfsruimte_id) || /* @__PURE__ */ new Set();
  const strip = document.createElement("span");
  strip.className = "ga-ori-led-strip";
  strip.setAttribute("aria-label", "Ori\xEBntatie-status");
  for (const code of expected) {
    const chip = document.createElement("span");
    chip.className = "ga-ori-led-chip";
    chip.appendChild(createOriStatusLed(code, present.has(code)));
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
      const assigned = vlakkenForOrientatie(code);
      const ready = assigned.length > 0;
      const li = document.createElement("li");
      li.className = "drawing-list-item ga-ori-pick-item";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "drawing-list-select";
      btn.setAttribute("role", "option");
      btn.dataset.value = `ori:${code}`;
      const inner = document.createElement("span");
      inner.className = "drawing-list-select-inner";
      inner.appendChild(createOriStatusLed(code, ready));
      const label = document.createElement("span");
      label.className = "drawing-list-select-label";
      label.textContent = ready ? `${code} \xB7 ${ORIENTATIE_LABELS[code] || code}` : `${code} \xB7 ${ORIENTATIE_LABELS[code] || code} \xB7 nog niet gespecificeerd`;
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
  applyClCgFromOrientatie(code);
  vlakGakEl.checked = true;
  fillFacadeSelect();
  syncVlakMaterialGate();
  updateVlakOriCompletenessHint();
  syncOrientatieDisplay();
  if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak toevoegen";
  vlakCancelBtn?.classList.add("hidden");
  const assigned = vlakkenForOrientatie(code);
  const oriLabel = ORIENTATIE_LABELS[code] || code;
  if (vlakEditHintEl) {
    vlakEditHintEl.textContent = assigned.length ? `Ori\xEBntatie ${oriLabel} \u2014 resterende materialen bij 2; vastgelegde vlakken in de scrollbox hieronder.` : `Voeg een vlak toe voor ${oriLabel} \u2014 kies hieronder een gevelcomponent.`;
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
  const key = materialGroupKeyInList(fac);
  const ori = facadeOrientatie(fac);
  const peers = key ? facades.filter((f) => materialGroupKeyInList(f) === key && facadeOrientatie(f) === ori) : [fac];
  let shareCount = 0;
  if (key) {
    for (const other of allVlakken) {
      if (!(other.facade_subsection_id || "").trim()) continue;
      const of = findFacadeInList(other, facades);
      if (of && materialGroupKeyInList(of) === key && facadeOrientatie(of) === ori) {
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
    const a = p.area_m2 != null && Number.isFinite(Number(p.area_m2)) ? Number(p.area_m2) : 0;
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
  const oriCorr = correctionsForOrientatie(dst);
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
    const key = srcFac ? materialGroupKey(srcFac) : null;
    const matLabel = srcFac?.material_name || v.omschrijving || (v.quantity_kind === "length" ? "kierdichting" : "materiaal");
    if (!key) {
      unmatched.push(matLabel);
      continue;
    }
    if (takenKeys.has(key)) {
      skippedExist += 1;
      continue;
    }
    const wantLen = v.quantity_kind === "length" || srcFac?.quantity_kind === "length";
    const srcCompose = srcFac ? facadeIsComposeOp(srcFac) : false;
    const candidates = groupFacadesForPick(vrFacades, used).filter((g) => {
      if (!g.ga_ready || g.used || g.materialKey !== key) return false;
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
    const ret = await invokeString("API_SaveVlak", [
      auth().token,
      selectedVrId,
      "",
      name,
      wantLen ? "0" : String(rounded),
      oriCorr.cl,
      oriCorr.cg,
      v.meenemen_gak !== false ? "true" : "false",
      "0",
      facadeId,
      wantLen ? "length" : "area",
      wantLen ? String(rounded) : "",
      dst,
      "true"
    ]);
    if (ret.startsWith("ERROR")) {
      unmatched.push(`${matLabel} (${ret.replace(/^ERROR:\s*/i, "")})`);
      continue;
    }
    copied += 1;
    takenKeys.add(key);
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
  const allGroups = groupFacadesForPick(vrFacades, used);
  const readyGroups = allGroups.filter((g) => g.ga_ready);
  let available = readyGroups.filter((g) => {
    if (g.used) return false;
    const compOri = groupOrientatie(g);
    if (!compOri) return false;
    const matKey = g.materialKey;
    if (!matKey) return false;
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
    const g = fac ? groupFacadesForPick(vrFacades, /* @__PURE__ */ new Set()).find(
      (x) => x.primaryId === fac.id || x.memberIds.includes(fac.id)
    ) : facId ? groupFacadesForPick(vrFacades, /* @__PURE__ */ new Set()).find(
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
    ph.textContent = wantOri ? `\u2014 kies materiaal voor ${ORIENTATIE_LABELS[wantOri] || wantOri} \u2014` : "\u2014 kies een materiaal (zelfde materiaal wordt opgeteld) \u2014";
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
  const focusVlakken = focusOri ? vlakkenForOrientatie(focusOri) : [];
  if (focusOri && focusVlakken.length === 0) {
    if (vlakCoverageEl) vlakCoverageEl.hidden = true;
    const oriLabel = ORIENTATIE_LABELS[focusOri] || focusOri;
    vlakInventoryEl.textContent = `Ori\xEBntatie ${oriLabel}: nog geen toegevoegde vlakken.`;
    syncRecalcEnabled();
    return;
  }
  const stotaal = focusOri ? facadeStotaalM2(focusOri) : 0;
  const deel = focusOri ? vlakkenDeeloppervlakM2(focusOri) : 0;
  const oriBit = focusOri ? ` (${focusOri})` : "";
  const tol = 0.02;
  const complete = stotaal > 0 && Math.abs(stotaal - deel) <= tol;
  const over = stotaal > 0 && deel > stotaal + tol;
  let pct = 0;
  if (stotaal > 0) {
    pct = complete ? 100 : Math.max(0, Math.round(deel / stotaal * 1e3) / 10);
  }
  if (vlakCoverageEl && vlakCoveragePctEl && vlakCoverageBarEl && vlakCoverageMetaEl) {
    if (!(stotaal > 0) && !focusVlakken.length) {
      vlakCoverageEl.hidden = true;
    } else {
      vlakCoverageEl.hidden = false;
      vlakCoverageEl.classList.remove("is-complete", "is-partial", "is-over");
      if (!(stotaal > 0)) {
        vlakCoveragePctEl.textContent = "\u2014";
        vlakCoverageBarEl.style.width = "0%";
        vlakCoverageMetaEl.textContent = focusOri ? `Nog geen complete geveloppervlakten (Stotaal) voor ori\xEBntatie ${focusOri}.` : "Kies een ori\xEBntatie om Stotaal-dekking te zien.";
      } else if (facadeOpeningsUncutFromWall(focusOri)) {
        const rawSum = facadeReadyAreaFacades(focusOri).reduce((a, f) => a + Number(f.area_m2), 0);
        vlakCoverageEl.classList.add("is-partial");
        vlakCoveragePctEl.textContent = `${pct}%`;
        vlakCoverageBarEl.style.width = `${Math.min(100, pct)}%`;
        vlakCoverageMetaEl.textContent = `Stotaal ${stotaal.toFixed(2)} m\xB2${oriBit} is de gevelcontour (nu ${deel.toFixed(2)} m\xB2 muur toegekend). Kozijn/glas zitten nog in die contour (los getekend ${rawSum.toFixed(2)} m\xB2) \u2014 maak \xB1 (gevel \u2212 kozijn) zodat muur + hout + glas optellen tot Stotaal.`;
      } else if (complete) {
        vlakCoverageEl.classList.add("is-complete");
        vlakCoveragePctEl.textContent = "100%";
        vlakCoverageBarEl.style.width = "100%";
        vlakCoverageMetaEl.textContent = `Volledige dekking${oriBit}: ${deel.toFixed(2)} / ${stotaal.toFixed(2)} m\xB2 \u2014 materialen tellen op tot 100% van dit gevelvlak.`;
      } else if (over) {
        vlakCoverageEl.classList.add("is-over");
        vlakCoveragePctEl.textContent = `${pct}%`;
        vlakCoverageBarEl.style.width = "100%";
        vlakCoverageMetaEl.textContent = `Te veel${oriBit}: ${deel.toFixed(2)} / ${stotaal.toFixed(2)} m\xB2 \u2014 deeloppervlakten overschrijden Stotaal (${(deel - stotaal).toFixed(2)} m\xB2 te veel).`;
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
  const groups = groupFacadesForPick(vrFacades, used).filter(
    (g) => g.ga_ready && Boolean(groupOrientatie(g))
  );
  const linked = groups.filter(
    (g) => g.used || !materialHasFreeOrientatie2(g.materialKey)
  ).length;
  const free = groups.filter(
    (g) => !g.used && materialHasFreeOrientatie2(g.materialKey)
  ).length;
  const expected = expectedOrientatiesForSelectedVr();
  const missingOri = expected.filter((o) => !orientatieTakenOnVr2(o, null));
  const bits = [
    `Geveltekening: ${groups.length} materiaal-groep(en)`,
    `${linked} als vlak gekoppeld`,
    free ? `${free} nog toe te kennen` : "geen vrij materiaal"
  ];
  if (focusOri) {
    bits.unshift(
      `ori ${focusOri}: ${focusVlakken.length} vlak${focusVlakken.length === 1 ? "" : "ken"}`
    );
  }
  if (expected.length) {
    bits.push(
      missingOri.length ? `nog dekking nodig voor ori ${missingOri.join(", ")}` : `ori\xEBntaties gedekt (${expected.join(", ")})`
    );
  }
  if (focusOri && stotaal > 0) {
    bits.unshift(
      complete ? `ori ${focusOri}: 100% Stotaal` : `ori ${focusOri}: ${pct}% van Stotaal`
    );
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
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      const n = vrFacades.length;
      const ready = vrFacades.filter((f) => f.ga_ready).length;
      const excl = data.counts?.excluded_as_source ?? 0;
      const used = usedFacadePickIds();
      const pickGroups = groupFacadesForPick(vrFacades, used).filter(
        (g) => g.ga_ready && Boolean(groupOrientatie(g))
      );
      const merged = pickGroups.filter((g) => g.members.length > 1).length;
      const pickN = pickGroups.filter(
        (g) => !g.used && materialHasFreeOrientatie2(g.materialKey)
      ).length;
      const already = pickGroups.filter(
        (g) => g.used || !materialHasFreeOrientatie2(g.materialKey)
      ).length;
      const incomplete = n - ready;
      const reusedMat = pickGroups.filter(
        (g) => !g.used && g.materialKey && orisUsedForMaterial2(g.materialKey).length > 0 && materialHasFreeOrientatie2(g.materialKey)
      ).length;
      vlakFacadeHintEl.textContent = n === 0 ? `Geen gevelcomponenten voor VR ${vrNr}${excl ? ` (${excl} vervangen door zelfde-materiaal setbewerking)` : ""}.` : `VR ${vrNr}: ${ready} component(en) met materiaal + ori\xEBntatie \xB7 ${pickN} materiaal-groep(en) kiesbaar` + (reusedMat ? ` \xB7 ${reusedMat}\xD7 zelfde materiaal opnieuw (andere ori\xEBntatie)` : "") + (already ? ` \xB7 ${already} al gekoppeld` : "") + (merged ? ` \xB7 ${merged}\xD7 zelfde materiaal opgeteld` : "") + (incomplete ? ` \xB7 ${incomplete} zonder materiaal (niet selecteerbaar)` : "") + (excl ? ` \xB7 ${excl} vervangen (zelfde materiaal)` : "") + `. Meerdere materialen per ori\xEBntatie; zelfde materiaal wordt opgeteld.`;
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
    return;
  }
  roomPreviewEl.textContent = formatRoomSummary(r);
  roomPreviewEl.classList.remove("is-empty");
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
    applyClCgFromOrientatie(vlakOrientatieEl?.value);
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
  const keepVg = preferVgId || selectedVgId;
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
  await syncVgTitlesFromFloormap();
  vgs = sortByLabelAz(vgs, vgDisplayTitle);
  if (keepVg && vgs.some((g) => g.verblijfsgebied_id === keepVg)) selectedVgId = keepVg;
  else if (vgs.length) selectedVgId = vgs[0].verblijfsgebied_id;
  renderVgs();
  await loadVrs(preferVrId ?? null);
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
    const n = g.vr_count === 1 ? "1 VR" : `${g.vr_count} VR\u2019s`;
    const floorBit = floor ? ` \xB7 ${levelLabel(floor)}` : "";
    const vrNrs = vgVrNrSummary(g.verblijfsgebied_id);
    const vrBit = vrNrs ? ` \xB7 ${vrNrs}` : "";
    btn.textContent = `${title}${floorBit} \xB7 ${n}${vrBit}`;
    btn.title = vrNrs ? `Toon verblijfsruimten in dit VG (${vrNrs})` : "Toon verblijfsruimten in dit VG";
    btn.addEventListener("click", () => {
      selectedVgId = g.verblijfsgebied_id;
      selectedVrId = null;
      rememberGaSelection();
      renderVgs();
      void loadVrs();
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
  vrs = sortByLabelAz(data.verblijfsruimten || [], (r) => r.omschrijving || "");
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
      if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak toevoegen";
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
  else vrEditForm.classList.add("hidden");
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
  const key = materialGroupKey(fac);
  const ori = facadeOrientatie(fac);
  const peers = key ? vrFacades.filter(
    (f) => materialGroupKey(f) === key && facadeOrientatie(f) === ori
  ) : [fac];
  let shareCount = 0;
  if (key) {
    for (const other of vlakken) {
      if (!(other.facade_subsection_id || "").trim()) continue;
      const of = findFacadeForVlak(other);
      if (of && materialGroupKey(of) === key && facadeOrientatie(of) === ori) shareCount += 1;
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
      if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak toevoegen";
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
      await clearPersistedVrCalc("");
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
function facadeReadyAreaFacades(ori) {
  const want = normalizeOrientatie(ori);
  return vrFacades.filter((f) => {
    if (!f.ga_ready || f.quantity_kind === "length") return false;
    if (f.area_m2 == null || !Number.isFinite(Number(f.area_m2))) return false;
    if (want && facadeOrientatie(f) !== want) return false;
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
function effectiveFacadeAreaM2(f) {
  const base = f.area_m2 != null && Number.isFinite(Number(f.area_m2)) ? Number(f.area_m2) : 0;
  if (!facadeIsComposeOp(f) || !f.constituents?.length) return base;
  const parentRpt = Math.max(1, Number(f.repeat_count) || 1);
  let area = base;
  for (const part of f.constituents) {
    if (part.sign !== "-") continue;
    const sid = String(part.id || "").trim();
    if (!sid) continue;
    const src = vrFacades.find((x) => x.id === sid);
    const srcRpt = Math.max(1, Number(src?.repeat_count) || 1);
    const extra = Math.max(0, srcRpt - parentRpt);
    if (extra <= 0) continue;
    const hole1 = facadeOpeningOuterArea1x(sid, part.area_m2);
    if (hole1 > 0) area -= extra * hole1;
  }
  return Math.round(area * 100) / 100;
}
function facadeUncutOpeningIds(ori) {
  const ready = facadeReadyAreaFacades(ori);
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
function facadeOpeningsUncutFromWall(ori) {
  const want = normalizeOrientatie(ori);
  const oris = want ? [want] : facadeOrisWithArea();
  for (const o of oris) {
    const uncut = facadeUncutOpeningIds(o);
    if (!uncut.size) continue;
    if (facadeReadyAreaFacades(o).some((f) => uncut.has(f.id))) return true;
  }
  return false;
}
function facadeStotaalM2(ori) {
  const want = normalizeOrientatie(ori);
  if (!want) return 0;
  const ready = facadeReadyAreaFacades(want);
  let sum = 0;
  for (const f of ready) sum += effectiveFacadeAreaM2(f);
  const uncut = facadeUncutOpeningIds(want);
  if (uncut.size) {
    for (const f of ready) {
      if (uncut.has(f.id)) sum -= effectiveFacadeAreaM2(f);
    }
  }
  return Math.round(sum * 100) / 100;
}
function vlakkenDeeloppervlakM2(ori) {
  const want = normalizeOrientatie(ori);
  let sum = 0;
  for (const v of vlakken) {
    const vOri = normalizeOrientatie(v.orientatie);
    if (want && vOri !== want) continue;
    const live = liveVlakQty(v);
    if (live.kind !== "area") continue;
    const fac = findFacadeForVlak(v);
    if (fac && vOri) {
      const uncut = facadeUncutOpeningIds(vOri);
      if (uncut.has(fac.id)) continue;
    }
    if (Number.isFinite(live.qty) && live.qty > 0) sum += live.qty;
  }
  return Math.round(sum * 100) / 100;
}
function vlakkenMatchFacadeStotaal(ori) {
  const want = normalizeOrientatie(ori);
  const oris = want ? [want] : facadeOrisWithArea();
  if (!oris.length) return false;
  for (const o of oris) {
    if (facadeOpeningsUncutFromWall(o)) return false;
    const stotaal = facadeStotaalM2(o);
    if (!(stotaal > 0)) return false;
    const deel = vlakkenDeeloppervlakM2(o);
    if (Math.abs(stotaal - deel) > 0.02) return false;
  }
  return true;
}
function syncRecalcEnabled() {
  if (!recalcBtn) return;
  const ok = Boolean(selectedVrId) && vlakken.length > 0 && vlakkenMatchFacadeStotaal();
  recalcBtn.disabled = !ok;
  const incompleteOri = facadeOrisWithArea().find((o) => !vlakkenMatchFacadeStotaal(o));
  recalcBtn.title = ok ? "Herbereken GA / GA;k voor deze VR" : !selectedVrId ? "Selecteer eerst een VR" : !vlakken.length ? "Voeg eerst vlakken toe" : incompleteOri && facadeOpeningsUncutFromWall(incompleteOri) ? `Eerst openingen uit de gevelcontour snijden op ori ${incompleteOri} (\xB1 op de geveltekening)` : incompleteOri ? `Eerst alle materialen toekennen tot 100% Stotaal voor ori ${incompleteOri}` : "Eerst alle materialen toekennen tot 100% Stotaal per ori\xEBntatie";
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
    await clearPersistedVrCalc(msg);
    setConn("err", msg);
    return;
  }
  const calcVlakken = vlakken.map((v) => {
    const fac = findFacadeForVlak(v) || void 0;
    const live = liveVlakQty(v);
    const kind = live.kind;
    const qty = live.qty;
    const editingThis = Boolean(selectedVlakId && v.vlak_id === selectedVlakId);
    const oriCode = normalizeOrientatie(v.orientatie);
    const room = roomFromVr(vr);
    const oriCorr = oriCode && room?.orientatie_correcties?.[oriCode] ? room.orientatie_correcties[oriCode] : null;
    return {
      label: v.omschrijving,
      orientatie: oriCode || v.orientatie || "",
      ra_dba: fac?.ra_dba != null ? Number(fac.ra_dba) : NaN,
      quantity_kind: kind,
      area_m2: kind === "area" ? qty : null,
      length_m: kind === "length" ? qty : null,
      // While editing, form checkbox drives Stot / GA;k immediately.
      meenemen_gak: editingThis ? vlakGakEl.checked : v.meenemen_gak !== false,
      cl_db: oriCorr ? Number(oriCorr.cl_db) || 0 : Number(v.cl_db) || 0,
      cg_db: oriCorr ? Number(oriCorr.cg_db) || 0 : Number(v.cg_db) || 0
    };
  });
  const missingRa = calcVlakken.filter((v) => !Number.isFinite(v.ra_dba));
  if (missingRa.length) {
    const msg = `Geen RA voor: ${missingRa.map((v) => v.label).join(", ")} \u2014 materiaal ontbreekt of catalogus-id is verouderd. Koppel materiaal opnieuw op de geveltekening, daarna Herberekenen GA / GA;k.`;
    clearVrResults(msg, { keepStored: false });
    setConn("err", msg);
    return;
  }
  const useForm = Boolean(opts?.useFormCorrections);
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
  if (vrResultsHintEl) {
    const req = result.gak_required_dba != null ? ` \xB7 GA;k \u2265 ${fmtRes(result.gak_required_dba)} dB (Lb\u2212${grens})` : "";
    const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
    const focusFacade = focusOri && result.facades?.length ? result.facades.find((f) => f.orientatie === focusOri) || null : result.facades?.length === 1 ? result.facades[0] : null;
    const facadeBit = result.facades && result.facades.length > 1 ? ` \xB7 ${result.facades.length} gevels (CL/Cg per ori in D2m)` : ` \xB7 CL/Cg in D2m (${round1(result.cl_db)} / ${round1(result.cg_db)} dB)`;
    const gevelBit = focusFacade ? ` \xB7 gevel ${focusFacade.orientatie}: Ruimte=${fmtRes(focusFacade.ruimte_db)} CL=${round1(focusFacade.cl_db)}` : "";
    const totBit = result.facades && result.facades.length > 1 && result.d2m_nt != null ? ` \xB7 D2m,tot=${fmtRes(result.d2m_nt)} dB` : "";
    vrResultsHintEl.textContent = `Cr=${result.cr_db} dB${facadeBit}${gevelBit}${totBit} \xB7 C3\u2192GA;k \xB7 grens Lbi;k \u2264 ${grens} dB${req}${statusBit}`;
    vrResultsHintEl.classList.remove("hidden");
  }
  if (resSEl) {
    resSEl.textContent = `${fmtRes(result.s_m2)} / ${fmtRes(result.stot_m2)} m\xB2`;
  }
  {
    const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
    const focusFacade = focusOri && result.facades?.length ? result.facades.find((f) => f.orientatie === focusOri) || null : result.facades?.length === 1 ? result.facades[0] : null;
    const rp = focusFacade?.r_prime ?? result.r_prime;
    const dGevel = focusFacade?.d2m_nt ?? result.d2m_nt;
    if (resRpLabelEl) {
      resRpLabelEl.textContent = focusFacade ? `R' (gevel ${focusFacade.orientatie})` : "R' (gevel)";
    }
    if (resDLabelEl) {
      resDLabelEl.innerHTML = focusFacade ? `D<sub>2m,nT</sub> (gevel ${focusFacade.orientatie})` : "D<sub>2m,nT</sub> (gevel)";
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
  if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak toevoegen";
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
  const fromOri = correctionsForOrientatie(ori);
  const vrRow = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  const room = vrRow ? roomFromVr(vrRow) : null;
  const hasOriMap = Boolean(ori && room?.orientatie_correcties?.[ori]);
  if (vlakClEl) {
    vlakClEl.value = hasOriMap ? fromOri.cl : String(Number(v.cl_db) || 0);
    vlakClEl.readOnly = true;
  }
  if (vlakCgEl) {
    vlakCgEl.value = hasOriMap ? fromOri.cg : String(Number(v.cg_db) || 0);
    vlakCgEl.readOnly = true;
  }
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
    const oriCorr = correctionsForOrientatie(v.orientatie);
    const vrRow = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
    const room = vrRow ? roomFromVr(vrRow) : null;
    const oriCode = normalizeOrientatie(v.orientatie);
    const hasOriMap = Boolean(oriCode && room?.orientatie_correcties?.[oriCode]);
    const clShow = hasOriMap ? Number(oriCorr.cl) || 0 : Number(v.cl_db) || 0;
    const cgShow = hasOriMap ? Number(oriCorr.cg) || 0 : Number(v.cg_db) || 0;
    const corrTxt = `CL=${round1(clShow)} \xB7 Cg=${round1(cgShow)} (ori)`;
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
        await clearPersistedVrCalc("");
        if (selectedVlakId === v.vlak_id) {
          selectedVlakId = null;
          vlakNameEl.value = "";
          applyVlakFormDefaultsFromExisting(focusOri);
          if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak toevoegen";
          vlakCancelBtn?.classList.add("hidden");
        }
        await loadVlakken();
        if (!vlakkenMatchFacadeStotaal()) {
          await clearPersistedVrCalc("");
        }
      })().catch((e) => setConn("err", String(e)));
    });
    actions.appendChild(del);
    li.appendChild(actions);
    host.appendChild(li);
  };
  const wrap = document.createElement("li");
  wrap.className = "ga-vlak-ori-group";
  const title = document.createElement("p");
  title.className = "ga-vlak-ori-group-title";
  title.textContent = `${focusOri} \xB7 ${ORIENTATIE_LABELS[focusOri] || focusOri} \xB7 ${focusVlakken.length} vlak${focusVlakken.length === 1 ? "" : "ken"}`;
  wrap.appendChild(title);
  const inner = document.createElement("ul");
  inner.className = "drawing-list";
  for (const v of focusVlakken) appendVlakRow(inner, v);
  wrap.appendChild(inner);
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
  setBuildingMetaText(buildingMetaLine());
  if (projectIdBarEl) {
    projectIdBarEl.open = false;
    localStorage.setItem("app-gevelwering-ga-project-id-collapsed", "1");
  }
  projectMenu?.rememberCurrent();
  projectMenu?.refreshTitle();
  setConn("ok", "Verbonden");
  const url = new URL(location.href);
  url.searchParams.set("building_id", buildingId);
  history.replaceState(null, "", url.toString());
  await applyFloormapImport();
}
async function saveProjectCheckpoint() {
  if (!auth() || !buildingId) throw new Error("Log in en selecteer een project");
  if (!selectedVariantId) throw new Error("Geen actieve variant");
  const keepVg = selectedVgId;
  const keepVr = selectedVrId;
  const keepVlak = selectedVlakId;
  setConn("busy", "Alle VR\u2019s herberekenen en opslaan\u2026");
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
        try {
          await loadVlakken({ resetForm: true });
          if (!vlakken.length) {
            skipped += 1;
            skipReasons.push(`${vrShortLabel(vr)}: geen vlakken`);
            continue;
          }
          if (!vlakkenMatchFacadeStotaal()) {
            skipped += 1;
            const bad = facadeOrisWithArea().find((o) => !vlakkenMatchFacadeStotaal(o)) || "?";
            skipReasons.push(`${vrShortLabel(vr)}: ori ${bad} geen 100% Stotaal`);
            continue;
          }
          await refreshVrCalc({ persist: true, reveal: true });
          const cur = vrs.find((r) => r.verblijfsruimte_id === vr.verblijfsruimte_id);
          if (cur && vrHasStoredResults(cur)) saved += 1;
          else {
            skipped += 1;
            skipReasons.push(`${vrShortLabel(vr)}: berekening niet opgeslagen`);
          }
        } catch (err) {
          failed += 1;
          skipReasons.push(
            `${vrShortLabel(vr)}: ${err instanceof Error ? err.message : String(err)}`
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
    const detail = skipReasons.length ? ` \xB7 ${skipReasons.slice(0, 3).join("; ")}${skipReasons.length > 3 ? "\u2026" : ""}` : "";
    const msg = `VR-resultaten bijgewerkt \xB7 ${saved} opgeslagen${skipped ? ` \xB7 ${skipped} overgeslagen` : ""}${failed ? ` \xB7 ${failed} mislukt` : ""}${detail}`;
    setConn(failed ? "err" : skipped && !saved ? "err" : "ok", msg);
    return { saved, skipped, failed };
  } catch (err) {
    setConn("err", err instanceof Error ? err.message : String(err));
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
  const key = "app-gevelwering-ga-project-id-collapsed";
  if (localStorage.getItem(key) === "1") projectIdBarEl.open = false;
  projectIdBarEl.addEventListener("toggle", () => {
    localStorage.setItem(key, projectIdBarEl.open ? "0" : "1");
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
      if (!oriVal) {
        throw new Error("Kies eerst een gevelori\xEBntatie in de listbox");
      }
    }
    const expectedOris = expectedOrientatiesForSelectedVr();
    if (!expectedOris.length) {
      throw new Error(
        "Geen gevelori\xEBntaties op de plattegrond \u2014 vink die eerst aan bij Opgeslagen ruimten"
      );
    }
    if (!expectedOris.includes(normalizeOrientatie(oriVal))) {
      throw new Error(
        `Ori\xEBntatie ${normalizeOrientatie(oriVal)} staat niet in de plattegrond-definitie (${expectedOris.join(", ")})`
      );
    }
    const matKeyForGuard = (() => {
      if (fac) {
        const optKey = (opt?.dataset.materialKey || "").trim();
        if (optKey) return optKey;
        return materialGroupKey(vrFacades.find((f) => f.id === fac) || {});
      }
      if (editingId) {
        const cur = vlakken.find((v) => v.vlak_id === editingId);
        const facId = cur?.facade_subsection_id;
        if (!facId) return null;
        const curV = vlakken.find((x) => x.vlak_id === editingId);
        const facOpt = curV ? findFacadeForVlak(curV) : null;
        return materialGroupKey(facOpt || {});
      }
      return null;
    })();
    if (!editingId) {
      const hasMat = Boolean((opt?.dataset.materialId || "").trim());
      if (!hasMat) {
        throw new Error(
          "Deze component heeft nog geen materiaal \u2014 koppel het op de geveltekening, daarna hier als vlak toevoegen"
        );
      }
      const usedIds = usedFacadePickIds();
      if (usedIds.has(fac)) {
        throw new Error("Deze gevelcomponent is al als vlak gekoppeld");
      }
      const groups = groupFacadesForPick(vrFacades, usedIds);
      const pickGroup = groups.find((g) => g.primaryId === fac || g.memberIds.includes(fac));
      if (pickGroup?.used) {
        throw new Error(
          "Geen vrije gevelcomponent meer voor dit materiaal \u2014 teken een extra component of kies een ander materiaal"
        );
      }
    }
    if (matKeyForGuard) {
      const taken = materialOrientatieTaken2(matKeyForGuard, oriVal, editingId);
      if (taken) {
        const oriLabel = normalizeOrientatie(oriVal) || "(geen)";
        throw new Error(
          `Dit materiaal heeft al een vlak met ori\xEBntatie ${oriLabel} (\u201C${taken.omschrijving}\u201D). Kies een andere ori\xEBntatie.`
        );
      }
      if (orisUsedForMaterial2(matKeyForGuard, editingId).length && !normalizeOrientatie(oriVal)) {
        throw new Error(
          "Dit materiaal is al als vlak gebruikt \u2014 voeg het toe voor een andere (vrije) plattegrond-ori\xEBntatie"
        );
      }
    }
    const isLen = (opt?.dataset.quantityKind || vlakAreaEl.dataset.quantityKind) === "length";
    const qty = vlakAreaEl.value || "0";
    const pickFac = fac ? vrFacades.find((f) => f.id === fac) : void 0;
    const facadeId = pickFac ? facadeSourceId(pickFac) : fac || "";
    const oriCorr = correctionsForOrientatie(oriVal);
    applyClCgFromOrientatie(oriVal);
    const clVal = oriCorr.cl;
    const cgVal = oriCorr.cg;
    const ret = await invokeString("API_SaveVlak", [
      auth().token,
      selectedVrId,
      editingId || "",
      vlakNameEl.value.trim() || "Vlak",
      isLen ? "0" : qty,
      clVal,
      cgVal,
      vlakGakEl.checked ? "true" : "false",
      "0",
      facadeId,
      isLen ? "length" : "area",
      isLen ? qty : "",
      oriVal,
      editingId ? vlakken.find((x) => x.vlak_id === editingId)?.prefer_stored_qty ? "true" : "" : ""
    ]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    const wasEdit = Boolean(editingId);
    await loadVlakken();
    clearVlakEdit(oriVal);
    await refreshVrCalc({ persist: true });
    if (!selectedVlakId) {
      blankResultsUntilVlakSelected(
        "Vlak opgeslagen. Open een vlak in de lijst om de berekening te tonen."
      );
    }
    setConn(
      "ok",
      wasEdit ? `Vlak bijgewerkt (CL/Cg \u2192 GA;k)` : `Vlak toegevoegd \xB7 ori\xEBntatie ${normalizeOrientatie(oriVal)} (uit plattegrond)`
    );
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
recalcBtn?.addEventListener("click", () => {
  void (async () => {
    if (!auth() || !selectedVrId) {
      setConn("err", "Selecteer eerst een VR");
      return;
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
        const oriVal = vlakOrientatieEl?.value || v.orientatie || "";
        const oriCorr = correctionsForOrientatie(oriVal);
        applyClCgFromOrientatie(oriVal);
        const syncRet = await invokeString("API_SaveVlak", [
          auth().token,
          selectedVrId,
          v.vlak_id,
          vlakNameEl.value.trim() || v.omschrijving || "Vlak",
          live.kind === "area" ? String(live.qty) : "0",
          oriCorr.cl,
          oriCorr.cg,
          vlakGakEl.checked ? "true" : "false",
          String(v.sort_order || 0),
          v.facade_subsection_id || "",
          live.kind,
          live.kind === "length" ? String(live.qty) : "",
          oriVal,
          v.prefer_stored_qty ? "true" : ""
        ]);
        if (syncRet.startsWith("ERROR")) throw new Error(syncRet);
        await loadVlakken();
        clearVlakEdit();
      }
    }
    await refreshVrCalc({ persist: true, reveal: true });
    setConn("ok", "GA / GA;k herberekend (CL/Cg per ori in D2m, gevels gecombineerd)");
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
  if (reportHintEl) reportHintEl.textContent = "Eerst alle VR\u2019s herberekenen\u2026";
  const checkpoint = await saveProjectCheckpoint();
  if (checkpoint.saved === 0 && (checkpoint.skipped > 0 || checkpoint.failed > 0)) {
    throw new Error(
      "Rapport niet gemaakt: geen VR met opgeslagen GA;k. Vul per VR alle gevelori\xEBntaties tot 100% Stotaal en probeer opnieuw."
    );
  }
  if (reportHintEl) {
    reportHintEl.textContent = checkpoint.skipped || checkpoint.failed ? `Rapport wordt gegenereerd\u2026 (${checkpoint.saved} VR\u2019s actueel, ${checkpoint.skipped + checkpoint.failed} overgeslagen)` : "Rapport wordt gegenereerd\u2026";
  }
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
    throw new Error(`Rapport opslaan mislukt (HTTP ${res.status})`);
  }
  if (!res.ok || !parsed.ok) {
    throw new Error(parsed.error || `Rapport opslaan mislukt (HTTP ${res.status})`);
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
  const okMsg = `Rapport opgeslagen (PDF): ${pathHint}${folder}`;
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
session.connect();
