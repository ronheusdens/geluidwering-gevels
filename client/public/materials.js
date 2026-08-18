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

// lib/material-taxonomy.mjs
var MATERIAL_RUBRIEKEN = [
  { nr: 1, name: "Steenachtigen/beton/blokken" },
  { nr: 2, name: "Glas" },
  { nr: 3, name: "Dak-, vloer-, plafondconstructies" },
  { nr: 4, name: "Lichte paneelconstr./borstweringen/deuren" },
  { nr: 5, name: "Enkelvoudige plaatmaterialen/panelen" },
  { nr: 6, name: "Ventilatievoorzieningen" },
  { nr: 7, name: "Ventilatievoorzieningen oud (voor 1-1-2012)" },
  { nr: 8, name: "Lichte scheidingsconstructies" },
  { nr: 9, name: "Kier- en naaddichtingsprofielen" }
];
var MATERIAL_SUBRUBRIEKEN = {
  1: [
    { nr: 1, name: "Baksteen licht/zwaar" },
    { nr: 2, name: "Kalkzandsteen" },
    { nr: 3, name: "Grindbeton/natuursteen" },
    { nr: 4, name: "Lichtbeton/cellenbeton" },
    { nr: 5, name: "(hout-)vezelbeton" },
    { nr: 6, name: "Lichte blokken/gipsblokken" },
    { nr: 7, name: "Voorzetwanden" },
    { nr: 8, name: "Enkelsteensmuur, rekenmethode" },
    { nr: 9, name: "Spouwmuur, rekenmethode" },
    { nr: 10, name: "Diversen" }
  ],
  2: [
    { nr: 1, name: "Enkel glas" },
    { nr: 2, name: "Dubbel glas" },
    { nr: 3, name: "Enkel glas gelamineerd" },
    { nr: 4, name: "Dubbel glas 1-zijdig gelamineerd" },
    { nr: 5, name: "Dubbel glas 2-zijdig gelamineerd" },
    { nr: 6, name: "Schuiframen" },
    { nr: 7, name: "Enkel glas, rekenmethode T" },
    { nr: 8, name: "Dubbel glas, rekenmethode T" },
    { nr: 9, name: "Diversen" },
    { nr: 10, name: "Drievoudig glas" }
  ],
  3: [
    { nr: 1, name: "Plat dak houtachtig" },
    { nr: 2, name: "Plat dak (gas)beton" },
    { nr: 3, name: "Plat dak metaalplaat" },
    { nr: 4, name: "Hellend dak houtachtig" },
    { nr: 5, name: "Hellend dak gas(beton)" },
    { nr: 6, name: "Dakramen" },
    { nr: 7, name: "Dakkapellen" },
    { nr: 8, name: "Vloeren" },
    { nr: 9, name: "Diversen" }
  ],
  4: [
    { nr: 1, name: "Sandwich panelen" },
    { nr: 2, name: "Samengestelde panelen" },
    { nr: 3, name: "Deuren" },
    { nr: 4, name: "Samengestelde vloeren" },
    { nr: 5, name: "Kozijnen" },
    { nr: 6, name: "Diversen" }
  ],
  5: [
    { nr: 1, name: "Spaanplaat/board" },
    { nr: 2, name: "Triplex/multiplex/meubelplaat" },
    { nr: 3, name: "Hout/vloerdelen" },
    { nr: 4, name: "Gipsplaat/asbestcement" },
    { nr: 5, name: "Mineraalvezels/mineraalwol" },
    { nr: 6, name: "Kunststof (massief)" },
    { nr: 7, name: "Metaalplaat" },
    { nr: 8, name: "Diversen" }
  ],
  6: [
    { nr: 1, name: "Openingen/roosters" },
    { nr: 2, name: "Suskasten" },
    { nr: 3, name: "Muurdempers" },
    { nr: 4, name: "Dakdempers" },
    { nr: 5, name: "Mechanische ventilatie unit" },
    { nr: 6, name: "Diversen" },
    { nr: 7, name: "Ventilatie rekenmethode RM" }
  ],
  7: [
    { nr: 1, name: "Openingen/roosters" },
    { nr: 2, name: "Suskasten" },
    { nr: 3, name: "Muurdempers" },
    { nr: 4, name: "Diversen" }
  ],
  8: [
    { nr: 1, name: "Gipskarton wanden. U-profielen" },
    { nr: 2, name: "Gipskarton wanden. Stijlen" },
    { nr: 3, name: "Spaanplaatachtige wanden" },
    { nr: 4, name: "Metalen wanden" },
    { nr: 5, name: "Houtwolcement wanden" },
    { nr: 6, name: "Schuifbare wanden" },
    { nr: 7, name: "Diversen" }
  ],
  9: [
    { nr: 1, name: "Kierdichtingsprofielen" },
    { nr: 2, name: "Naaddichtingsprofielen" },
    { nr: 3, name: "Beglazingsranden" }
  ]
};
function rubriekByName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  return MATERIAL_RUBRIEKEN.find((r) => r.name.toLowerCase() === n) || MATERIAL_RUBRIEKEN.find((r) => n.startsWith(r.name.toLowerCase().slice(0, 24))) || null;
}
function subrubriekenFor(rubriekNr) {
  return MATERIAL_SUBRUBRIEKEN[Number(rubriekNr)] || [];
}
function formatRubriekLabel(r) {
  return `${r.nr}. ${r.name}`;
}
function formatSubrubriekLabel(s) {
  return `${s.nr} - ${s.name}`;
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
function bppPhase1Enabled() {
  try {
    return localStorage.getItem("GEVELWERING_BPP_HTTP") !== "1";
  } catch {
    return true;
  }
}
async function bppListMaterialFavorites(invoke, token, buildingId) {
  const ret = await invoke("API_ListMaterialFavorites", [token, buildingId]);
  const data = parseBppJson(ret);
  return { materials: data.materials || [] };
}
async function bppAddMaterialFavorite(invoke, token, buildingId, materialId) {
  const ret = await invoke("API_AddMaterialFavorite", [token, buildingId, materialId]);
  parseBppJson(ret);
}
async function bppRemoveMaterialFavorite(invoke, token, buildingId, materialId) {
  const ret = await invoke("API_RemoveMaterialFavorite", [token, buildingId, materialId]);
  parseBppJson(ret);
}
async function bppListMaterialFavoritePresets(invoke, token) {
  const ret = await invoke("API_ListMaterialFavoritePresets", [token]);
  const data = parseBppJson(ret);
  return { presets: data.presets || [] };
}
async function bppMaterialFavoritePresetAction(invoke, token, body) {
  const ret = await invoke("API_MaterialFavoritePresetAction", [token, JSON.stringify(body)]);
  return parseBppJson(ret);
}

// src/materials.ts
var BPP_WS = resolveBppWsUrl();
var AUTH_KEY = "app_gevelwering_admin_auth";
var bootParams = new URLSearchParams(location.search);
var deepMaterialId = (bootParams.get("material_id") || bootParams.get("id") || "").trim();
var deepQ = (bootParams.get("q") || "").trim();
var deepNew = bootParams.get("new") === "1" || bootParams.get("new") === "true" || bootParams.get("mode") === "new";
var returnHref = safeSameOriginPath(bootParams.get("return"));
var returnLabel = (bootParams.get("return_label") || "Terug naar toekennen vlak (gevel)").trim();
var returnLinkEl = document.getElementById("mat-return-link");
var pickBarEl = document.getElementById("mat-pick-bar");
var pickBtnEl = document.getElementById("mat-pick-btn");
var pickBtnEditorEl = document.getElementById("mat-pick-btn-editor");
var pickHintEl = document.getElementById("mat-pick-hint");
var PICK_STORAGE_KEY = "app-gevelwering-material-pick";
function buildingIdFromContext() {
  const direct = (bootParams.get("building_id") || "").trim();
  if (direct) return direct;
  if (!returnHref) return "";
  try {
    return new URL(returnHref, location.origin).searchParams.get("building_id")?.trim() || "";
  } catch {
    return "";
  }
}
var contextBuildingId = buildingIdFromContext();
function safeSameOriginPath(raw) {
  if (!raw) return null;
  try {
    const u = new URL(raw, location.origin);
    if (u.origin !== location.origin) return null;
    if (!u.pathname.startsWith("/")) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}
function setupReturnNav() {
  if (!returnLinkEl) return;
  if (!returnHref) {
    returnLinkEl.classList.add("hidden");
    return;
  }
  returnLinkEl.href = returnHref;
  returnLinkEl.textContent = `\u2190 ${returnLabel}`;
  returnLinkEl.classList.remove("hidden");
}
function syncPickUi() {
  const canPick = Boolean(returnHref && selectedId);
  if (pickBarEl) pickBarEl.classList.toggle("hidden", !returnHref);
  if (pickBtnEl) pickBtnEl.disabled = !canPick;
  if (pickBtnEditorEl) {
    pickBtnEditorEl.classList.toggle("hidden", !returnHref);
    pickBtnEditorEl.disabled = !canPick;
  }
  if (pickHintEl && returnHref) {
    pickHintEl.textContent = canPick ? "Geselecteerd materiaal wordt in het componentformulier gezet (ook als dat nog niet is opgeslagen)." : "Zoek en selecteer een materiaal, daarna overnemen om terug te gaan naar het component.";
  }
}
function pickMaterialForCaller() {
  if (!returnHref || !selectedId) return;
  const row = listRows.find((m) => m.material_id === selectedId) || {
    material_id: selectedId,
    catalog_id: catalogIdEl.value.trim(),
    master_category: masterEl.value.trim(),
    category: catEl.value.trim(),
    name: nameEl.value.trim()
  };
  const payload = {
    material_id: String(row.material_id || selectedId).trim(),
    catalog_id: String(row.catalog_id || "").trim(),
    master_category: String(row.master_category || "").trim(),
    category: String(row.category || "").trim(),
    name: String(row.name || "").trim()
  };
  if (!payload.material_id || !payload.master_category) {
    setStatus("Selecteer een materiaal met rubriek om over te nemen", "err");
    return;
  }
  try {
    const draftRaw = sessionStorage.getItem("app-gevelwering-fm-component-draft");
    if (draftRaw) payload.draft = JSON.parse(draftRaw);
  } catch {
  }
  try {
    sessionStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(payload));
  } catch {
  }
  location.assign(returnHref);
}
async function httpJson(url, init) {
  if (!auth?.token) throw new Error("Niet ingelogd");
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...apiAuthHeaders(auth.token, Boolean(init?.body)),
      ...init?.headers || {}
    }
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
async function syncFavoriteCheckbox() {
  if (!favoriteWrapEl || !favoriteEl) return;
  if (!contextBuildingId) {
    favoriteWrapEl.classList.add("hidden");
    favoriteEl.checked = false;
    return;
  }
  favoriteWrapEl.classList.remove("hidden");
  const mid = (selectedId || idEl.value || "").trim();
  if (!mid || !auth?.token) {
    favoriteEl.checked = false;
    return;
  }
  try {
    const data = bppPhase1Enabled() ? await bppListMaterialFavorites(invokeString, auth.token, contextBuildingId) : await httpJson(
      `/api/floormap/material-favorites?building_id=${encodeURIComponent(contextBuildingId)}`
    );
    favoriteEl.checked = (data.materials || []).some((m) => m.material_id === mid);
  } catch {
    favoriteEl.checked = false;
  }
}
async function setFavoriteForSelection(on) {
  if (!contextBuildingId || !auth?.token) return;
  const mid = (selectedId || idEl.value || "").trim();
  if (!mid) return;
  if (on) {
    if (bppPhase1Enabled()) {
      await bppAddMaterialFavorite(invokeString, auth.token, contextBuildingId, mid);
    } else {
      await httpJson("/api/floormap/material-favorites", {
        method: "POST",
        body: JSON.stringify({ building_id: contextBuildingId, material_id: mid })
      });
    }
  } else if (bppPhase1Enabled()) {
    await bppRemoveMaterialFavorite(invokeString, auth.token, contextBuildingId, mid);
  } else {
    await httpJson(
      `/api/floormap/material-favorites?building_id=${encodeURIComponent(contextBuildingId)}&material_id=${encodeURIComponent(mid)}`,
      { method: "DELETE" }
    );
  }
}
async function loadPresets() {
  if (!presetListEl || !presetEmptyEl || !auth?.token) return;
  try {
    const data = bppPhase1Enabled() ? await bppListMaterialFavoritePresets(invokeString, auth.token) : await httpJson("/api/floormap/material-favorite-presets");
    const presets = data.presets || [];
    presetListEl.replaceChildren();
    presetEmptyEl.classList.toggle("hidden", presets.length > 0);
    for (const p of presets) {
      const li = document.createElement("li");
      li.className = "mat-preset-item";
      const label = document.createElement("span");
      label.textContent = `${p.name} (${p.material_count})`;
      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "secondary";
      renameBtn.textContent = "Hernoemen";
      renameBtn.addEventListener("click", () => {
        const name = window.prompt("Nieuwe preset-naam:", p.name);
        if (!name?.trim() || name.trim() === p.name) return;
        const run = bppPhase1Enabled() ? bppMaterialFavoritePresetAction(invokeString, auth.token, {
          action: "rename",
          preset_id: p.preset_id,
          name: name.trim()
        }) : httpJson("/api/floormap/material-favorite-presets", {
          method: "POST",
          body: JSON.stringify({ action: "rename", preset_id: p.preset_id, name: name.trim() })
        });
        void run.then(() => loadPresets()).then(() => setStatus(`Preset hernoemd naar \xAB${name.trim()}\xBB`, "ok")).catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
      });
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "danger secondary";
      delBtn.textContent = "Verwijderen";
      delBtn.addEventListener("click", () => {
        if (!window.confirm(`Preset \xAB${p.name}\xBB verwijderen?`)) return;
        const run = bppPhase1Enabled() ? bppMaterialFavoritePresetAction(invokeString, auth.token, {
          action: "delete",
          preset_id: p.preset_id
        }) : httpJson("/api/floormap/material-favorite-presets", {
          method: "POST",
          body: JSON.stringify({ action: "delete", preset_id: p.preset_id })
        });
        void run.then(() => loadPresets()).then(() => setStatus(`Preset \xAB${p.name}\xBB verwijderd`, "ok")).catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
      });
      li.append(label, renameBtn, delBtn);
      presetListEl.appendChild(li);
    }
  } catch (err) {
    presetListEl.replaceChildren();
    presetEmptyEl.classList.remove("hidden");
    presetEmptyEl.textContent = err instanceof Error ? `Presets laden mislukt: ${err.message}` : "Presets laden mislukt";
  }
}
var connBarEl = document.getElementById("mat-conn-bar");
var connLedEl = document.getElementById("mat-conn-led");
var connStatusEl = document.getElementById("mat-conn-status");
var loginPanelEl = document.getElementById("mat-login-panel");
var loginForm = document.getElementById("mat-login-form");
var loginBtn = document.getElementById("mat-login-btn");
var panelEl = document.getElementById("mat-panel");
var userLabelEl = document.getElementById("mat-user-label");
var logoutBtn = document.getElementById("mat-logout-btn");
var filterForm = document.getElementById("mat-filter-form");
var qEl = document.getElementById("mat-q");
var categoryEl = document.getElementById("mat-category");
var subcategoryFilterEl = document.getElementById("mat-subcategory");
var pagerLabelEl = document.getElementById("mat-pager-label");
var prevBtn = document.getElementById("mat-prev-btn");
var nextBtn = document.getElementById("mat-next-btn");
var newBtn = document.getElementById("mat-new-btn");
var listboxEl = document.getElementById("mat-listbox");
var tbodyEl = document.getElementById("mat-tbody");
var editorTitleEl = document.getElementById("mat-editor-title");
var editorForm = document.getElementById("mat-editor-form");
var idEl = document.getElementById("mat-id");
var catalogIdEl = document.getElementById("mat-catalog-id");
var noEl = document.getElementById("mat-no");
var masterEl = document.getElementById("mat-master");
var nameEl = document.getElementById("mat-name");
var catEl = document.getElementById("mat-cat");
var sourceRefEl = document.getElementById("mat-source-ref");
var sourceEl = document.getElementById("mat-source");
var spectrumOkEl = document.getElementById("mat-spectrum-ok");
var favoriteWrapEl = document.getElementById("mat-fav-wrap");
var favoriteEl = document.getElementById("mat-favorite");
var presetListEl = document.getElementById("mat-preset-list");
var presetEmptyEl = document.getElementById("mat-preset-empty");
var thickEl = document.getElementById("mat-thick");
var weightEl = document.getElementById("mat-weight");
var raEl = document.getElementById("mat-ra");
var t1El = document.getElementById("mat-t1");
var cavEl = document.getElementById("mat-cav");
var t2El = document.getElementById("mat-t2");
var r63El = document.getElementById("mat-r63");
var r125El = document.getElementById("mat-r125");
var r250El = document.getElementById("mat-r250");
var r500El = document.getElementById("mat-r500");
var r1000El = document.getElementById("mat-r1000");
var r2000El = document.getElementById("mat-r2000");
var r4000El = document.getElementById("mat-r4000");
var rwEl = document.getElementById("mat-rw");
var cEl = document.getElementById("mat-c");
var ctrEl = document.getElementById("mat-ctr");
var saveBtn = document.getElementById("mat-save-btn");
var deleteBtn = document.getElementById("mat-delete-btn");
var clearBtn = document.getElementById("mat-clear-btn");
var ws = null;
var sessionId = null;
var auth = null;
var reqCounter = 0;
var offset = 0;
var total = 0;
var selectedId = null;
var listRows = [];
var PAGE_SIZE = 10;
var pending = /* @__PURE__ */ new Map();
function setStatus(text, kind = "busy") {
  connStatusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}
function setConnLed(connected) {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}
function nextRequestId(prefix) {
  reqCounter += 1;
  return `${prefix}_${reqCounter}_${Date.now()}`;
}
function storeAuth2(info) {
  storeAuth(AUTH_KEY, info);
  void syncSessionCookie(info?.token ?? null);
}
function loadStoredAuth() {
  return loadAuth(AUTH_KEY);
}
function showLogin() {
  auth = null;
  storeAuth2(null);
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
}
function showAdmin(info) {
  auth = info;
  storeAuth2(info);
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
  if (favoriteWrapEl) favoriteWrapEl.classList.toggle("hidden", !contextBuildingId);
  void loadPresets();
}
function send(type, payload, wantType) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket niet open"));
  }
  const request_id = nextRequestId(type.replace(".", "_"));
  const env = { v: 1, type, request_id, payload };
  if (sessionId && type !== "session.open") env.session_id = sessionId;
  return new Promise((resolve, reject) => {
    pending.set(request_id, { resolve, reject, want: wantType });
    ws.send(JSON.stringify(env));
  });
}
function onMessage(raw) {
  let env;
  try {
    env = JSON.parse(raw);
  } catch {
    return;
  }
  if (env.type === "session.opened") {
    const sid = typeof env.session_id === "string" && env.session_id || (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
    if (sid) sessionId = sid;
  }
  if (env.type === "error") {
    const waiter2 = pending.get(env.request_id);
    if (waiter2) {
      pending.delete(env.request_id);
      waiter2.reject(new Error(JSON.stringify(env.payload ?? env)));
    }
    return;
  }
  const waiter = pending.get(env.request_id);
  if (!waiter) return;
  if (env.type === waiter.want || env.type.endsWith(".completed") || env.type === "exec.completed") {
    if (env.type === "invoke.accepted" || env.type === "exec.accepted") return;
    pending.delete(env.request_id);
    waiter.resolve(env);
  }
}
async function invokeString(target, args) {
  const inv = await send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
  const ret = inv.payload?.return;
  if (typeof ret !== "string") throw new Error(`Unexpected return from ${target}: ${JSON.stringify(inv.payload)}`);
  return ret;
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function normalizeDecimalInput(raw) {
  let s = raw.trim().replace(/\s/g, "");
  if (!s) return "";
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Ongeldig getal: \u201C${raw.trim()}\u201D (gebruik bijv. 42,6 of 42.6)`);
  }
  return s;
}
function decimalField(el, label) {
  try {
    return normalizeDecimalInput(el.value);
  } catch (err) {
    throw new Error(`${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
function fillFilterRubrieken() {
  const keep = categoryEl.value;
  categoryEl.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "Alle rubrieken";
  categoryEl.appendChild(all);
  for (const r of MATERIAL_RUBRIEKEN) {
    const opt = document.createElement("option");
    opt.value = r.name;
    opt.textContent = formatRubriekLabel(r);
    categoryEl.appendChild(opt);
  }
  if (keep && [...categoryEl.options].some((o) => o.value === keep)) {
    categoryEl.value = keep;
  }
  fillFilterSubrubrieken();
}
function fillFilterSubrubrieken() {
  const master = categoryEl.value;
  const rub = rubriekByName(master);
  const keep = subcategoryFilterEl.value;
  subcategoryFilterEl.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "0 - Alle subrubrieken";
  subcategoryFilterEl.appendChild(all);
  const subs = rub ? subrubriekenFor(rub.nr) : [];
  for (const s of subs) {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = formatSubrubriekLabel(s);
    subcategoryFilterEl.appendChild(opt);
  }
  subcategoryFilterEl.disabled = !rub;
  if (keep && subs.some((s) => s.name === keep)) subcategoryFilterEl.value = keep;
  else subcategoryFilterEl.value = "";
}
function fillEditorRubrieken() {
  const keep = masterEl.value;
  masterEl.replaceChildren();
  for (const r of MATERIAL_RUBRIEKEN) {
    const opt = document.createElement("option");
    opt.value = r.name;
    opt.textContent = formatRubriekLabel(r);
    masterEl.appendChild(opt);
  }
  if (keep && [...masterEl.options].some((o) => o.value === keep)) masterEl.value = keep;
  else masterEl.value = MATERIAL_RUBRIEKEN[0]?.name || "";
  fillEditorSubrubrieken();
}
function fillEditorSubrubrieken() {
  const rub = rubriekByName(masterEl.value);
  const keep = catEl.value;
  catEl.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "\u2014 kies subrubriek \u2014";
  catEl.appendChild(empty);
  const subs = rub ? subrubriekenFor(rub.nr) : [];
  for (const s of subs) {
    const opt = document.createElement("option");
    opt.value = s.name;
    opt.textContent = formatSubrubriekLabel(s);
    catEl.appendChild(opt);
  }
  if (keep && subs.some((s) => s.name === keep)) catEl.value = keep;
  else catEl.value = "";
}
function listCategoryFilter() {
  const master = categoryEl.value.trim();
  if (!master) return "";
  const sub = subcategoryFilterEl.value.trim();
  return sub ? `${master}::${sub}` : master;
}
function ensureSourceOption(value) {
  const v = (value || "app").trim() || "app";
  const normalized = v === "eigen" ? "app" : v;
  if (sourceEl instanceof HTMLSelectElement) {
    if (![...sourceEl.options].some((o) => o.value === normalized)) {
      const opt = document.createElement("option");
      opt.value = normalized;
      opt.textContent = normalized;
      sourceEl.appendChild(opt);
    }
    sourceEl.value = normalized;
  } else {
    sourceEl.value = normalized;
  }
}
function resolveSaveSource() {
  const cid = catalogIdEl.value.trim().toUpperCase();
  const isNew = !idEl.value.trim();
  let src = (sourceEl.value || "").trim() || "app";
  if (src === "eigen") src = "app";
  if (isNew) src = "app";
  if ((src === "catalogusGG.pdf" || src === "GL.cat") && cid && !cid.startsWith("D")) {
    src = "app";
  }
  ensureSourceOption(src);
  return src;
}
function clearEditor() {
  selectedId = null;
  highlightSelection();
  idEl.value = "";
  catalogIdEl.value = "";
  noEl.value = "";
  masterEl.value = MATERIAL_RUBRIEKEN[0]?.name || "";
  fillEditorSubrubrieken();
  nameEl.value = "";
  catEl.value = "";
  sourceRefEl.value = "";
  ensureSourceOption("app");
  spectrumOkEl.checked = true;
  thickEl.value = "";
  weightEl.value = "";
  raEl.value = "";
  t1El.value = "";
  cavEl.value = "";
  t2El.value = "";
  r63El.value = "";
  r125El.value = "";
  r250El.value = "";
  r500El.value = "";
  r1000El.value = "";
  r2000El.value = "";
  r4000El.value = "";
  rwEl.value = "";
  cEl.value = "";
  ctrEl.value = "";
  editorTitleEl.textContent = "Nieuw materiaal";
  deleteBtn.disabled = true;
  syncPickUi();
  if (favoriteEl) favoriteEl.checked = false;
  if (favoriteWrapEl) favoriteWrapEl.classList.toggle("hidden", !contextBuildingId);
}
function fillEditor(m) {
  selectedId = m.material_id || null;
  idEl.value = m.material_id || "";
  catalogIdEl.value = m.catalog_id || "";
  noEl.value = m.material_no === "" || m.material_no == null ? "" : String(m.material_no);
  masterEl.value = m.master_category || MATERIAL_RUBRIEKEN[0]?.name || "";
  if (![...masterEl.options].some((o) => o.value === masterEl.value) && m.master_category) {
    const opt = document.createElement("option");
    opt.value = m.master_category;
    opt.textContent = m.master_category;
    masterEl.appendChild(opt);
    masterEl.value = m.master_category;
  }
  fillEditorSubrubrieken();
  nameEl.value = m.name || "";
  catEl.value = m.category || "";
  if (m.category && ![...catEl.options].some((o) => o.value === m.category)) {
    const opt = document.createElement("option");
    opt.value = m.category;
    opt.textContent = m.category;
    catEl.appendChild(opt);
    catEl.value = m.category;
  }
  sourceRefEl.value = m.source_ref || "";
  ensureSourceOption(m.source || "app");
  spectrumOkEl.checked = m.spectrum_ok === "true" || m.spectrum_ok === "t";
  thickEl.value = m.thickness_mm || "";
  weightEl.value = m.weight_kg_m2 || "";
  raEl.value = m.ra_dba || "";
  t1El.value = m.glass_t1_mm || "";
  cavEl.value = m.glass_cavity_mm || "";
  t2El.value = m.glass_t2_mm || "";
  r63El.value = m.r_63_hz || "";
  r125El.value = m.r_125_hz || "";
  r250El.value = m.r_250_hz || "";
  r500El.value = m.r_500_hz || "";
  r1000El.value = m.r_1000_hz || "";
  r2000El.value = m.r_2000_hz || "";
  r4000El.value = m.r_4000_hz || "";
  rwEl.value = m.rw_db || "";
  cEl.value = m.c_db || "";
  ctrEl.value = m.ctr_db || "";
  editorTitleEl.textContent = m.material_id ? `Bewerken \xB7 ${m.catalog_id || ""} \xB7 ${m.name}` : "Nieuw materiaal";
  deleteBtn.disabled = !m.material_id;
  highlightSelection();
  syncPickUi();
  void syncFavoriteCheckbox();
}
function highlightSelection() {
  for (const tr of tbodyEl.querySelectorAll("tr[data-id]")) {
    const on = !!selectedId && tr.dataset.id === selectedId;
    tr.classList.toggle("selected", on);
    tr.setAttribute("aria-selected", on ? "true" : "false");
    if (on) tr.scrollIntoView({ block: "nearest" });
  }
}
function limit() {
  return PAGE_SIZE;
}
function updatePager() {
  const lim = limit();
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + lim, total);
  pagerLabelEl.textContent = total === 0 ? "Geen materialen gevonden." : `Weergave ${from}\u2013${to} van ${total}`;
  prevBtn.disabled = offset <= 0;
  nextBtn.disabled = offset + lim >= total;
}
function selectFromList(id, opts) {
  const row = listRows.find((m) => m.material_id === id);
  if (!row) return;
  fillEditor(row);
  setStatus(`Geselecteerd: ${row.name}`, "ok");
  const fieldId = opts?.focusFieldId;
  if (fieldId) {
    const el = document.getElementById(fieldId);
    if (el && "focus" in el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      window.requestAnimationFrame(() => {
        el.focus({ preventScroll: true });
        if (el instanceof HTMLInputElement && el.type !== "checkbox" && typeof el.select === "function") {
          el.select();
        }
      });
      return;
    }
  }
  listboxEl.focus({ preventScroll: true });
}
function moveSelection(delta) {
  if (listRows.length === 0) return;
  const idx = selectedId ? listRows.findIndex((m) => m.material_id === selectedId) : -1;
  let next = idx + delta;
  if (idx < 0) next = delta > 0 ? 0 : listRows.length - 1;
  if (next < 0) next = 0;
  if (next >= listRows.length) next = listRows.length - 1;
  const row = listRows[next];
  if (row) selectFromList(row.material_id);
}
async function loadList(preferId) {
  if (!auth?.token) return;
  const lim = limit();
  const ret = await invokeString("API_AdminListMaterials", [
    auth.token,
    qEl.value.trim(),
    listCategoryFilter(),
    String(lim),
    String(offset),
    ""
  ]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("admin")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret);
  total = Number(parsed.total) || 0;
  listRows = parsed.materials ?? [];
  tbodyEl.innerHTML = listRows.map(
    (m) => `
      <tr data-id="${esc(m.material_id)}" role="option" tabindex="-1" title="Dubbelklik om te bewerken">
        <td data-field="mat-catalog-id">${esc(m.catalog_id || "")}</td>
        <td data-field="mat-master">${esc(m.master_category || "")}</td>
        <td data-field="mat-cat">${esc(m.category || "")}</td>
        <td class="mat-name-cell" data-field="mat-name">${esc(m.name)}</td>
        <td data-field="mat-thick">${esc(m.thickness_mm || "")}</td>
        <td data-field="mat-weight">${esc(m.weight_kg_m2 || "")}</td>
        <td data-field="mat-ra">${esc(m.ra_dba || "")}</td>
        <td data-field="mat-r63">${esc(m.r_63_hz || "")}</td>
        <td data-field="mat-r125">${esc(m.r_125_hz || "")}</td>
        <td data-field="mat-r250">${esc(m.r_250_hz || "")}</td>
        <td data-field="mat-r500">${esc(m.r_500_hz || "")}</td>
        <td data-field="mat-r1000">${esc(m.r_1000_hz || "")}</td>
        <td data-field="mat-r2000">${esc(m.r_2000_hz || "")}</td>
        <td data-field="mat-r4000">${esc(m.r_4000_hz || "")}</td>
        <td data-field="mat-rw">${esc(m.rw_db || "")}</td>
        <td data-field="mat-c">${esc(m.c_db || "")}</td>
        <td data-field="mat-ctr">${esc(m.ctr_db || "")}</td>
      </tr>`
  ).join("");
  updatePager();
  const want = preferId ?? selectedId;
  const pick = want && listRows.find((m) => m.material_id === want) || listRows[0] || null;
  if (pick) {
    fillEditor(pick);
    setStatus(`Geladen ${listRows.length} \xB7 ${pick.name}`, "ok");
  } else {
    clearEditor();
    setStatus(total === 0 ? "Geen materialen gevonden" : `${listRows.length} materialen geladen`, "ok");
  }
}
async function applyDeepLink() {
  if (!auth?.token) return;
  if (deepNew && !deepMaterialId) {
    await loadList();
    clearEditor();
    editorForm.scrollIntoView({ block: "nearest", behavior: "smooth" });
    nameEl.focus({ preventScroll: true });
    setStatus("Nieuw materiaal \u2014 vul rubriek, subrubriek, spectra en RA in", "ok");
    return;
  }
  if (!deepMaterialId) return;
  if (deepQ && !qEl.value.trim()) qEl.value = deepQ;
  setStatus("Materiaal laden\u2026", "busy");
  const ret = await invokeString("API_AdminGetMaterial", [auth.token, deepMaterialId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    await loadList();
    return;
  }
  const m = JSON.parse(ret);
  if (m.catalog_id && !qEl.value.trim()) qEl.value = m.catalog_id;
  offset = 0;
  await loadList(m.material_id);
  if (!listRows.some((r) => r.material_id === m.material_id)) {
    fillEditor(m);
  }
  editorForm.scrollIntoView({ block: "nearest", behavior: "smooth" });
  nameEl.focus({ preventScroll: true });
  setStatus(`Geopend: ${m.catalog_id || ""} \xB7 ${m.name}`, "ok");
}
async function bootstrapSession() {
  setStatus(`Verbinden met ${BPP_WS}\u2026`, "busy");
  ws = new WebSocket(BPP_WS);
  setConnLed(false);
  await new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("WebSocket-verbinding time-out")), 8e3);
    ws.onopen = () => {
      window.clearTimeout(t);
      setConnLed(true);
      resolve();
    };
    ws.onerror = () => {
      window.clearTimeout(t);
      setConnLed(false);
      reject(new Error("WebSocket-verbinding mislukt \u2014 draait bppServer op poort 18080?"));
    };
  });
  ws.onmessage = (ev) => onMessage(String(ev.data));
  ws.onclose = () => {
    setConnLed(false);
    setStatus("Verbinding met bppServer verbroken", "err");
  };
  await send("session.open", { client_name: "app-gevelwering-materials-web", client_version: "0.2.12" }, "session.opened");
  await send("exec.request", { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' }, "exec.completed");
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap mislukt: ${bootRet}`);
  setStatus(`Verbonden \xB7 sessie ${sessionId ?? "?"} \xB7 Postgres gereed`, "ok");
  const stored = loadStoredAuth();
  if (stored?.token) {
    const validated = await invokeString("API_ValidateSession", [stored.token]);
    if (!validated.startsWith("ERROR")) {
      const info = JSON.parse(validated);
      if (info.username === "admin") {
        showAdmin({ token: stored.token, username: info.username, display_name: info.display_name });
        if (deepMaterialId || deepNew) await applyDeepLink();
        else await loadList();
        return;
      }
    }
  }
  showLogin();
}
loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  loginBtn.disabled = true;
  setStatus("Inloggen\u2026", "busy");
  try {
    const fd = new FormData(loginForm);
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const ret = await invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const info = JSON.parse(ret);
    if (info.username !== "admin") {
      setStatus("Materiaaleditor is alleen voor gebruiker 'admin'", "err");
      return;
    }
    showAdmin(info);
    offset = 0;
    if (deepMaterialId || deepNew) await applyDeepLink();
    else await loadList();
    setStatus("Beheerder ingelogd", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    loginBtn.disabled = false;
  }
});
logoutBtn.addEventListener("click", async () => {
  try {
    if (auth?.token) await invokeString("API_Logout", [auth.token]);
  } catch {
  }
  showLogin();
  setStatus("Uitgelogd", "ok");
});
filterForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  offset = 0;
  try {
    await loadList();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
});
categoryEl.addEventListener("change", () => {
  fillFilterSubrubrieken();
});
masterEl.addEventListener("change", () => {
  fillEditorSubrubrieken();
});
prevBtn.addEventListener("click", async () => {
  offset = Math.max(0, offset - limit());
  selectedId = null;
  await loadList();
});
nextBtn.addEventListener("click", async () => {
  offset = offset + limit();
  selectedId = null;
  await loadList();
});
newBtn.addEventListener("click", () => {
  clearEditor();
  nameEl.focus();
});
clearBtn.addEventListener("click", () => clearEditor());
favoriteEl?.addEventListener("change", () => {
  if (!favoriteEl || !contextBuildingId) return;
  if (!selectedId && !idEl.value.trim()) {
    favoriteEl.checked = false;
    setStatus("Sla het materiaal eerst op voordat je favoriet zet", "err");
    return;
  }
  void setFavoriteForSelection(favoriteEl.checked).then(
    () => setStatus(
      favoriteEl.checked ? "Toegevoegd aan meest gebruikt" : "Verwijderd uit meest gebruikt",
      "ok"
    )
  ).catch((err) => {
    favoriteEl.checked = !favoriteEl.checked;
    setStatus(err instanceof Error ? err.message : String(err), "err");
  });
});
pickBtnEl?.addEventListener("click", () => pickMaterialForCaller());
pickBtnEditorEl?.addEventListener("click", () => pickMaterialForCaller());
tbodyEl.addEventListener("click", (ev) => {
  const tr = ev.target.closest("tr[data-id]");
  if (!tr) return;
  selectFromList(tr.getAttribute("data-id") || "");
});
tbodyEl.addEventListener("dblclick", (ev) => {
  const td = ev.target.closest("td[data-field]");
  const tr = ev.target.closest("tr[data-id]");
  if (!tr) return;
  ev.preventDefault();
  const fieldId = td?.getAttribute("data-field") || "mat-name";
  selectFromList(tr.getAttribute("data-id") || "", { focusFieldId: fieldId });
});
listboxEl.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    moveSelection(1);
    return;
  }
  if (ev.key === "ArrowUp") {
    ev.preventDefault();
    moveSelection(-1);
    return;
  }
  if (ev.key === "Home") {
    ev.preventDefault();
    if (listRows[0]) selectFromList(listRows[0].material_id);
    return;
  }
  if (ev.key === "End") {
    ev.preventDefault();
    const last = listRows[listRows.length - 1];
    if (last) selectFromList(last.material_id);
    return;
  }
  if (ev.key === "Enter" || ev.key === " ") {
    ev.preventDefault();
    if (selectedId) selectFromList(selectedId);
    else if (listRows[0]) selectFromList(listRows[0].material_id);
  }
});
editorForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!auth?.token) return;
  saveBtn.disabled = true;
  setStatus("Materiaal opslaan\u2026", "busy");
  try {
    const ret = await invokeString("API_AdminSaveMaterial", [
      auth.token,
      idEl.value.trim(),
      catalogIdEl.value.trim(),
      masterEl.value.trim(),
      noEl.value.trim(),
      nameEl.value.trim(),
      catEl.value.trim(),
      decimalField(thickEl, "Dikte"),
      decimalField(weightEl, "Gewicht"),
      decimalField(raEl, "RA"),
      sourceRefEl.value.trim(),
      spectrumOkEl.checked ? "true" : "false",
      decimalField(r63El, "63 Hz"),
      decimalField(r125El, "125 Hz"),
      decimalField(r250El, "250 Hz"),
      decimalField(r500El, "500 Hz"),
      decimalField(r1000El, "1000 Hz"),
      decimalField(r2000El, "2000 Hz"),
      decimalField(r4000El, "4000 Hz"),
      decimalField(rwEl, "Rw"),
      decimalField(cEl, "C"),
      decimalField(ctrEl, "Ctr"),
      decimalField(t1El, "Glas t1"),
      decimalField(cavEl, "Spouw"),
      decimalField(t2El, "Glas t2"),
      resolveSaveSource()
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const saved = JSON.parse(ret);
    const wantFav = Boolean(favoriteEl?.checked && contextBuildingId);
    setStatus(saved.created ? "Materiaal aangemaakt" : "Materiaal bijgewerkt", "ok");
    await loadList(saved.material_id || null);
    if (wantFav && saved.material_id) {
      try {
        if (bppPhase1Enabled()) {
          await bppAddMaterialFavorite(
            invokeString,
            auth.token,
            contextBuildingId,
            saved.material_id
          );
        } else {
          await httpJson("/api/floormap/material-favorites", {
            method: "POST",
            body: JSON.stringify({
              building_id: contextBuildingId,
              material_id: saved.material_id
            })
          });
        }
        if (favoriteEl) favoriteEl.checked = true;
      } catch (favErr) {
        setStatus(
          `Opgeslagen, maar favoriet mislukt: ${favErr instanceof Error ? favErr.message : String(favErr)}`,
          "err"
        );
      }
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    saveBtn.disabled = false;
  }
});
deleteBtn.addEventListener("click", async () => {
  if (!auth?.token || !idEl.value) return;
  if (!window.confirm(`Materiaal \u201C${nameEl.value || idEl.value}\u201D verwijderen?`)) return;
  deleteBtn.disabled = true;
  setStatus("Verwijderen\u2026", "busy");
  try {
    const ret = await invokeString("API_AdminDeleteMaterial", [auth.token, idEl.value]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    selectedId = null;
    await loadList();
    setStatus("Materiaal verwijderd", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    deleteBtn.disabled = !idEl.value;
  }
});
fillFilterRubrieken();
fillEditorRubrieken();
setupReturnNav();
syncPickUi();
if (deepQ) qEl.value = deepQ;
bootstrapSession().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});
initPasswordToggles();
