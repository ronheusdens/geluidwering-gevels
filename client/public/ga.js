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
function computeVrGa(input) {
  const V = Number(input.volume_m3);
  const T = Number(input.t0_s) > 0 ? Number(input.t0_s) : 0.5;
  const Lb = Number(input.geluidsbelasting_dba);
  const Cr = input.cr_db != null ? Number(input.cr_db) : CR_DB;
  const vlakken2 = Array.isArray(input.vlakken) ? input.vlakken : [];
  const elements = [];
  for (const v of vlakken2) {
    const kind = v.quantity_kind === "length" ? "length" : "area";
    const qty = kind === "length" ? v.length_m != null ? Number(v.length_m) : NaN : v.area_m2 != null ? Number(v.area_m2) : NaN;
    const ra = Number(v.ra_dba);
    if (!(qty > 0) || !Number.isFinite(ra)) continue;
    const areaForS = kind === "area" ? qty : 0;
    elements.push({
      label: v.label || "",
      kind,
      quantity: qty,
      ra_dba: ra,
      ras: null,
      meenemen_gak: v.meenemen_gak !== false,
      cl_db: Number(v.cl_db) || 0,
      cg_db: Number(v.cg_db) || 0,
      area_for_s: areaForS
    });
  }
  const sRef = elements.reduce((a, e) => a + e.area_for_s, 0);
  const stot = elements.filter((e) => e.meenemen_gak).reduce((a, e) => a + e.area_for_s, 0);
  if (!(sRef > 0) || !elements.length) {
    return {
      ok: false,
      reason: "geen geveloppervlak (m\xB2) \u2014 voeg vlakken met materiaal toe",
      s_m2: sRef,
      stot_m2: stot,
      elements: [],
      r_prime: null,
      ruimte_db: null,
      cl_db: 0,
      cg_db: 0,
      d2m_nt: null,
      ga_dba: null,
      lbi_dba: null,
      gak_dba: null,
      gak_corr_db: null
    };
  }
  let cl = 0;
  let cg = 0;
  let bestArea = -1;
  for (const e of elements) {
    if (e.area_for_s > bestArea) {
      bestArea = e.area_for_s;
      cl = e.cl_db;
      cg = e.cg_db;
    }
  }
  for (const e of elements) {
    e.ras = partialRas({ ra_dba: e.ra_dba, quantity: e.quantity }, sRef);
  }
  const rPrime = combineRprime(elements.map((e) => e.ras).filter((x) => x != null));
  const ruimte = roomCorrectionDb(V, T, sRef);
  if (rPrime == null || ruimte == null) {
    return {
      ok: false,
      reason: "berekening mislukt (R' of ruimtecorrectie)",
      s_m2: sRef,
      stot_m2: stot,
      elements,
      r_prime: rPrime,
      ruimte_db: ruimte,
      cl_db: cl,
      cg_db: cg,
      d2m_nt: null,
      ga_dba: null,
      lbi_dba: null,
      gak_dba: null,
      gak_corr_db: null
    };
  }
  const d2m = rPrime + cg + ruimte + cl;
  const ga = d2m - Cr;
  const lbi = Number.isFinite(Lb) ? Lb - ga : null;
  const gakCorr = stot > 0 ? gakCorrectionDb(V, T, stot) : null;
  const gak = gakCorr != null ? ga - gakCorr : null;
  return {
    ok: true,
    reason: null,
    s_m2: sRef,
    stot_m2: stot,
    elements,
    r_prime: rPrime,
    ruimte_db: ruimte,
    cl_db: cl,
    cg_db: cg,
    cr_db: Cr,
    d2m_nt: d2m,
    ga_dba: ga,
    lbi_dba: lbi,
    gak_dba: gak,
    gak_corr_db: gakCorr
  };
}

// src/ga.ts
var BPP_WS = resolveBppWsUrl();
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
var queueBtn = document.getElementById("ga-queue-btn");
var queueListEl = document.getElementById("ga-queue-list");
var modelPanelEl = document.getElementById("ga-model-panel");
var floormapLinkEl = document.getElementById("ga-floormap-link");
var variantForm = document.getElementById("ga-variant-form");
var variantListEl = document.getElementById("ga-variant-list");
var variantNameEl = document.getElementById("ga-variant-name");
var variantFunctieEl = document.getElementById("ga-variant-functie");
var variantLbEl = document.getElementById("ga-variant-lb");
var variantSpectrumEl = document.getElementById("ga-variant-spectrum");
var variantNewBtn = document.getElementById("ga-variant-new-btn");
var variantDelBtn = document.getElementById("ga-variant-del-btn");
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
var vlakAreaEl = document.getElementById("ga-vlak-area");
var vlakQtyLabelEl = document.getElementById("ga-vlak-qty-label");
var vlakClEl = document.getElementById("ga-vlak-cl");
var vlakCgEl = document.getElementById("ga-vlak-cg");
var vlakGakEl = document.getElementById("ga-vlak-gak");
var vlakListEl = document.getElementById("ga-vlak-list");
var customMatToggleBtn = document.getElementById("ga-custom-mat-toggle");
var customMatPanelEl = document.getElementById("ga-custom-mat-panel");
var customMatForm = document.getElementById("ga-custom-mat-form");
var customMatRubriekEl = document.getElementById("ga-custom-mat-rubriek");
var customMatNameEl = document.getElementById("ga-custom-mat-name");
var customMatRaEl = document.getElementById("ga-custom-mat-ra");
var customMatCancelBtn = document.getElementById("ga-custom-mat-cancel");
var vrResultsHintEl = document.getElementById("ga-vr-results-hint");
var resSEl = document.getElementById("ga-res-s");
var resRpEl = document.getElementById("ga-res-rp");
var resDEl = document.getElementById("ga-res-d");
var resGaEl = document.getElementById("ga-res-ga");
var resLbiEl = document.getElementById("ga-res-lbi");
var resGakEl = document.getElementById("ga-res-gak");
var ws = null;
var sessionId = null;
var auth = null;
var requestSeq = 0;
var pending = /* @__PURE__ */ new Map();
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
var vlakken = [];
var freshResultVrIds = /* @__PURE__ */ new Set();
var freeRooms = [];
var floormapRoomsById = /* @__PURE__ */ new Map();
var vrFacades = [];
var linkedBySub = /* @__PURE__ */ new Map();
var linkedSubIds = /* @__PURE__ */ new Set();
function nextRequestId(prefix) {
  requestSeq += 1;
  return `${prefix}_${requestSeq}`;
}
function setConn(state, text) {
  connLedEl.className = `conn-led ${state === "ok" ? "connected" : state === "busy" ? "busy" : "disconnected"}`;
  connStatusEl.textContent = text;
}
function storeAuth2(info) {
  auth = info;
  if (info) storeAuth(AUTH_KEY, info);
  else storeAuth(AUTH_KEY, null);
}
function showLogin() {
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
}
function showPanel(info) {
  storeAuth2(info);
  void syncSessionCookie(info.token);
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
}
function send(type, payload, wantType) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("WebSocket not open"));
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
  if (typeof ret !== "string") throw new Error(`Unexpected return from ${target}`);
  return ret;
}
async function loadSharedApi() {
  await send(
    "exec.request",
    { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
    "exec.completed"
  );
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap failed: ${bootRet}`);
}
async function apiGet(url) {
  const res = await fetch(url, { credentials: "include", headers: apiAuthHeaders(auth.token) });
  const body = await res.json();
  if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}
async function apiPost(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...apiAuthHeaders(auth.token), "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}
function parseJsonOk(ret) {
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
  if (!buildingId || !auth) return;
  const ret = await invokeString("API_ListLinkedSubsections", [auth.token, buildingId]);
  const data = parseJsonOk(ret);
  linkedBySub = /* @__PURE__ */ new Map();
  linkedSubIds = /* @__PURE__ */ new Set();
  for (const l of data.links || []) {
    if (!l?.subsection_id) continue;
    linkedBySub.set(l.subsection_id, l);
    linkedSubIds.add(l.subsection_id);
  }
}
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
    case "GROUND":
      return "Begane grond";
    case "FIRST":
      return "1e verdieping";
    case "SECOND":
      return "2e verdieping";
    case "THIRD":
      return "3e verdieping";
    case "ROOF":
      return "Dak";
    case "OTHER":
      return "Overig";
    default:
      return hint || "Overig";
  }
}
function isGroundLevel(hint) {
  return String(hint || "").toUpperCase() === "GROUND";
}
function roomsForVg(vgId) {
  const out = [];
  for (const [subId, link] of linkedBySub) {
    if (link.verblijfsgebied_id !== vgId) continue;
    const room = floormapRoomsById.get(subId);
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
function sortByLabelAz(items, label) {
  return items.slice().sort(
    (a, b) => label(a).localeCompare(label(b), void 0, { sensitivity: "base", numeric: true })
  );
}
function findVgIdForNr(vgNr) {
  const n = Number(vgNr);
  if (!Number.isFinite(n)) return null;
  for (const g of vgs) {
    if (vgNrForVg(g.verblijfsgebied_id, g.omschrijving) === n) return g.verblijfsgebied_id;
  }
  return null;
}
function roomFromVr(vr) {
  return floormapRoomsById.get(vr.subsection_id) || null;
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
  if (!buildingId || !auth) return;
  const sections = await apiGet(`/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`);
  const rooms = [];
  floormapRoomsById = /* @__PURE__ */ new Map();
  for (const sec of sections.sections || []) {
    const kind = String(sec.region_kind || "").toUpperCase();
    const sub = await apiGet(`/api/floormap/subsections?section_id=${encodeURIComponent(sec.id)}`);
    for (const s of sub.subsections || []) {
      if (kind !== "FLOORMAP") continue;
      const opt = {
        id: s.id,
        section_id: sec.id,
        label: s.label,
        area_m2: s.area_m2,
        region_kind: kind,
        section_label: sec.label || kind,
        vg_nr: s.vg_nr != null ? Number(s.vg_nr) : null,
        vr_nr: s.vr_nr != null && String(s.vr_nr).trim() ? String(s.vr_nr).trim() : null,
        level_hint: String(s.level_hint || "OTHER").toUpperCase()
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
  await refreshVrCalc();
}
function syncVrAddButtons() {
  const room = selectedFreeRoom();
  const anyFree = allFreeNumberedRooms().length > 0;
  vgNewBtn.disabled = !room;
  vgNewBtn.title = room ? "Maakt een nieuw verblijfsgebied met de gekozen ruimte als eerste VR" : anyFree ? "Kies eerst een vrije plattegrondruimte" : "Geen vrije plattegrondruimten met VG/VR-nummer meer";
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
function groupFacadesForPick(facades, usedIds) {
  const usedKeys = /* @__PURE__ */ new Set();
  for (const id of usedIds) {
    const f = facades.find((x) => x.id === id);
    const key = f ? materialGroupKey(f) : null;
    if (key) usedKeys.add(key);
  }
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
    const pool = available.length ? available : members;
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
        if (m.area_m2 != null && Number.isFinite(m.area_m2)) areaSum += Number(m.area_m2);
      }
    }
    const used = Boolean(materialKey && usedKeys.has(materialKey)) || members.every((m) => usedIds.has(m.id));
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
      used
    });
  };
  for (const [key, members] of groups) {
    pushGroup(members, key);
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
function formatFacadeGroupOption(g) {
  const f = g.members[0];
  const mat = f.master_category && f.material_name ? `${f.master_category}: ${f.material_name}` : f.material_name || f.master_category || null;
  const qty = g.quantity_kind === "length" ? g.length_m != null ? `l=${Number(g.length_m).toFixed(2)} m` : null : g.area_m2 != null ? `${Number(g.area_m2).toFixed(2)} m\xB2` : null;
  const countBit = g.members.length > 1 ? `${g.members.length}\xD7` : null;
  const bits = [
    g.members.length > 1 ? mat || g.label || "(zonder label)" : g.label || "(zonder label)",
    g.members.length > 1 ? null : mat,
    countBit,
    booleanOpShort(f.boolean_op),
    qty,
    g.members.length === 1 ? f.section_label || null : null,
    f.region_kind && f.region_kind !== "FACADE" ? f.region_kind : null,
    g.ga_ready ? null : "geen materiaal",
    g.used ? "al gekoppeld" : null
  ].filter(Boolean);
  return bits.join(" \xB7 ");
}
function fillFacadeSelect() {
  const prev = vlakFacadeEl.value;
  const used = new Set(
    vlakken.map((v) => v.facade_subsection_id).filter((id) => Boolean(id))
  );
  vlakFacadeEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = vrFacades.length ? "\u2014 kies gevelcomponent voor deze VR \u2014" : selectedVrId ? "\u2014 geen componenten voor deze VR \u2014" : "\u2014 selecteer eerst een VR \u2014";
  vlakFacadeEl.appendChild(ph);
  const groups = groupFacadesForPick(vrFacades, used);
  const shown = groups.some((g) => !g.used) ? groups.filter((g) => !g.used) : groups;
  for (const g of shown) {
    const o = document.createElement("option");
    o.value = g.primaryId;
    o.textContent = formatFacadeGroupOption(g);
    o.title = formatFacadeGroupOption(g);
    o.dataset.area = g.area_m2 != null ? Number(g.area_m2).toFixed(2) : "";
    o.dataset.length = g.length_m != null ? Number(g.length_m).toFixed(2) : "";
    o.dataset.quantityKind = g.quantity_kind === "length" ? "length" : "area";
    o.dataset.label = g.members.length > 1 ? g.members[0].material_name || g.label || "Vlak" : g.label || "";
    o.dataset.ready = g.ga_ready ? "1" : "0";
    o.dataset.memberIds = g.memberIds.join(",");
    o.dataset.count = String(g.members.length);
    vlakFacadeEl.appendChild(o);
  }
  vlakFacadeEl.size = Math.min(8, Math.max(3, shown.length + 1));
  let pick = "";
  if (prev && [...vlakFacadeEl.options].some((o) => o.value === prev)) {
    pick = prev;
  } else {
    const ready = shown.find((g) => g.ga_ready && !g.used) || shown.find((g) => !g.used) || shown[0];
    if (ready) pick = ready.primaryId;
  }
  if (pick) vlakFacadeEl.value = pick;
  else vlakFacadeEl.value = "";
  onFacadePick(true);
  updateFacadeHint();
}
function booleanOpShort(op) {
  if (op === "union") return "\u222A";
  if (op === "intersect") return "\u2229";
  if (op === "difference") return "\u2212";
  return null;
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
  if (!auth || !buildingId || !selectedVrId) {
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
    const data = await apiGet(
      `/api/floormap/vr-components?building_id=${encodeURIComponent(buildingId)}&vr_nr=${encodeURIComponent(vrNr)}`
    );
    vrFacades = (data.eligible || []).map((s) => ({
      id: s.id,
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
      master_category: s.master_category || null,
      material_id: s.material_id != null ? String(s.material_id) : null,
      ra_dba: s.ra_dba != null ? Number(s.ra_dba) : null,
      boolean_op: s.boolean_op || null
    }));
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      const n = vrFacades.length;
      const ready = vrFacades.filter((f) => f.ga_ready).length;
      const excl = data.counts?.excluded_as_source ?? 0;
      const used = new Set(
        vlakken.map((v) => v.facade_subsection_id).filter((id) => Boolean(id))
      );
      const pickGroups = groupFacadesForPick(vrFacades, used);
      const merged = pickGroups.filter((g) => g.members.length > 1).length;
      const pickN = pickGroups.filter((g) => !g.used).length || pickGroups.length;
      vlakFacadeHintEl.textContent = n === 0 ? `Geen gevelcomponenten voor VR ${vrNr}${excl ? ` (${excl} vervangen door zelfde-materiaal setbewerking)` : ""}.` : `VR ${vrNr}: ${n} component${n === 1 ? "" : "en"} \xB7 ${ready} met materiaal \xB7 ${pickN} keuz${pickN === 1 ? "e" : "es"}${merged ? ` (${merged}\xD7 zelfde materiaal opgeteld)` : ""}${excl ? ` \xB7 ${excl} vervangen (zelfde materiaal)` : ""}.`;
    }
  } catch (err) {
    vrFacades = [];
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      vlakFacadeHintEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}
function updateFacadeHint() {
  if (!vlakFacadePreviewEl) return;
  const opt = vlakFacadeEl.selectedOptions[0];
  const id = (vlakFacadeEl.value || "").trim();
  if (!opt || !id) {
    vlakFacadePreviewEl.textContent = "\u2014";
    vlakFacadePreviewEl.classList.add("is-empty");
    return;
  }
  vlakFacadePreviewEl.textContent = opt.textContent || "\u2014";
  vlakFacadePreviewEl.classList.remove("is-empty");
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
}
async function loadVariants() {
  if (!buildingId || !auth) return;
  const ret = await invokeString("API_ListVariants", [auth.token, buildingId]);
  const data = parseJsonOk(ret);
  variants = data.variants || [];
  if (!selectedVariantId && variants.length) selectedVariantId = variants[0].variant_id;
  if (selectedVariantId && !variants.some((v) => v.variant_id === selectedVariantId)) {
    selectedVariantId = variants[0]?.variant_id ?? null;
  }
  renderVariants();
  const cur = variants.find((v) => v.variant_id === selectedVariantId);
  if (cur) fillVariantForm(cur);
  await loadVgs();
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
      renderVariants();
      void loadVgs();
    });
    li.appendChild(btn);
    variantListEl.appendChild(li);
  }
}
async function loadVgs(preferVgId) {
  vgs = [];
  vrs = [];
  vlakken = [];
  const keepVg = preferVgId || selectedVgId;
  selectedVgId = null;
  selectedVrId = null;
  if (!selectedVariantId || !auth) {
    renderVgs();
    renderVrs();
    renderVlakken();
    vrEditForm.classList.add("hidden");
    return;
  }
  const ret = await invokeString("API_ListVerblijfsgebieden", [auth.token, selectedVariantId]);
  const data = parseJsonOk(ret);
  vgs = sortByLabelAz(data.verblijfsgebieden || [], vgDisplayTitle);
  await syncVgTitlesFromFloormap();
  vgs = sortByLabelAz(vgs, vgDisplayTitle);
  if (keepVg && vgs.some((g) => g.verblijfsgebied_id === keepVg)) selectedVgId = keepVg;
  else if (vgs.length) selectedVgId = vgs[0].verblijfsgebied_id;
  renderVgs();
  await loadVrs();
}
async function syncVgTitlesFromFloormap() {
  if (!auth) return;
  let changed = false;
  for (const g of vgs) {
    const nr = vgNrForVg(g.verblijfsgebied_id, g.omschrijving);
    if (nr == null) continue;
    const want = vgLabelFromNr(nr);
    if (g.omschrijving.trim() === want) continue;
    const ret = await invokeString("API_SaveVerblijfsgebied", [
      auth.token,
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
    btn.textContent = `${title}${floorBit} \xB7 ${n}`;
    btn.title = "Toon verblijfsruimten in dit VG";
    btn.addEventListener("click", () => {
      selectedVgId = g.verblijfsgebied_id;
      selectedVrId = null;
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
  if (!selectedVgId || !auth) {
    renderVrs();
    renderVlakken();
    vrEditForm.classList.add("hidden");
    syncVrHeading();
    return;
  }
  const ret = await invokeString("API_ListVerblijfsruimten", [auth.token, selectedVgId]);
  const data = parseJsonOk(ret);
  vrs = sortByLabelAz(data.verblijfsruimten || [], (r) => r.omschrijving || "");
  for (const id of [...freshResultVrIds]) {
    const vr = vrs.find((r) => r.verblijfsruimte_id === id);
    if (!vr || vr.ga_dba == null && vr.lbi_dba == null && vr.gak_dba == null) {
      freshResultVrIds.delete(id);
    }
  }
  if (keepVr && vrs.some((r) => r.verblijfsruimte_id === keepVr)) selectedVrId = keepVr;
  else if (vrs.length) selectedVrId = vrs[0].verblijfsruimte_id;
  syncVrHeading();
  renderVrs();
  await loadVlakken();
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
    if (room) {
      const metrics = effectiveVrMetrics(r);
      btn.textContent = formatVrListLine(room, metrics.volume);
    } else {
      const metrics = effectiveVrMetrics(r);
      btn.textContent = `${r.omschrijving} \xB7 ${metrics.vloer.toFixed(2)} m\xB2 \xB7 V=${metrics.volume.toFixed(1)} m\xB3`;
    }
    if (r.verblijfsruimte_id === selectedVrId && (r.gak_dba != null || r.ga_dba != null) && freshResultVrIds.has(r.verblijfsruimte_id)) {
      const bits = [
        r.ga_dba != null ? `GA=${round1(r.ga_dba)}` : null,
        r.lbi_dba != null ? `Lbi=${round1(r.lbi_dba)}` : null,
        r.gak_dba != null ? `GA;k=${round1(r.gak_dba)}` : null
      ].filter(Boolean);
      btn.textContent += ` \xB7 ${bits.join(" \xB7 ")}`;
    }
    btn.addEventListener("click", () => {
      selectedVrId = r.verblijfsruimte_id;
      fillVrEdit(r);
      renderVrs();
      void loadVlakken();
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
  const facId = v.facade_subsection_id;
  if (!facId || !vrFacades.length) return { kind, qty: stored };
  const fac = vrFacades.find((f) => f.id === facId);
  if (!fac) return { kind, qty: stored };
  const key = materialGroupKey(fac);
  const peers = key ? vrFacades.filter((f) => materialGroupKey(f) === key) : [fac];
  if (kind === "length") {
    let sum2 = 0;
    let any2 = false;
    for (const p of peers) {
      if (p.length_m != null && Number.isFinite(Number(p.length_m))) {
        sum2 += Number(p.length_m);
        any2 = true;
      }
    }
    return { kind, qty: any2 ? Math.round(sum2 * 100) / 100 : stored };
  }
  let sum = 0;
  let any = false;
  for (const p of peers) {
    if (p.area_m2 != null && Number.isFinite(Number(p.area_m2))) {
      sum += Number(p.area_m2);
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
async function loadVlakken() {
  vlakken = [];
  if (!selectedVrId || !auth) {
    renderVlakken();
    await loadFacadesForSelectedVr();
    return;
  }
  const ret = await invokeString("API_ListVlakken", [auth.token, selectedVrId]);
  const data = parseJsonOk(ret);
  vlakken = data.vlakken || [];
  await loadFacadesForSelectedVr();
  renderVlakken();
  const cur = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (cur) fillVrEdit(cur);
  await refreshVrCalc();
}
function fmtRes(v) {
  return v != null && Number.isFinite(v) ? String(round1(v)) : "\u2014";
}
function clearVrResults(hint) {
  if (vrResultsHintEl) {
    vrResultsHintEl.textContent = hint;
    vrResultsHintEl.classList.remove("hidden");
  }
  if (resSEl) resSEl.textContent = "\u2014";
  if (resRpEl) resRpEl.textContent = "\u2014";
  if (resDEl) resDEl.textContent = "\u2014";
  if (resGaEl) resGaEl.textContent = "\u2014";
  if (resLbiEl) resLbiEl.textContent = "\u2014";
  if (resGakEl) resGakEl.textContent = "\u2014";
}
async function refreshVrCalc() {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  const variant = variants.find((v) => v.variant_id === selectedVariantId);
  if (!auth || !vr) {
    clearVrResults("Selecteer een VR en voeg vlakken met materiaal toe.");
    return;
  }
  if (!vlakken.length) {
    clearVrResults("Nog geen vlakken \u2014 voeg gevelcomponenten toe.");
    return;
  }
  const facadeById = new Map(vrFacades.map((f) => [f.id, f]));
  const calcVlakken = vlakken.map((v) => {
    const fac = v.facade_subsection_id ? facadeById.get(v.facade_subsection_id) : void 0;
    const live = liveVlakQty(v);
    return {
      label: v.omschrijving,
      ra_dba: fac?.ra_dba != null ? Number(fac.ra_dba) : NaN,
      quantity_kind: live.kind,
      area_m2: live.kind === "area" ? live.qty : null,
      length_m: live.kind === "length" ? live.qty : null,
      meenemen_gak: Boolean(v.meenemen_gak),
      cl_db: Number(v.cl_db) || 0,
      cg_db: Number(v.cg_db) || 0
    };
  });
  const missingRa = calcVlakken.filter((v) => !Number.isFinite(v.ra_dba));
  if (missingRa.length) {
    clearVrResults(
      `Geen RA voor: ${missingRa.map((v) => v.label).join(", ")} \u2014 koppel materiaal op de plattegrond.`
    );
    return;
  }
  const metrics = effectiveVrMetrics(vr);
  const result = computeVrGa({
    volume_m3: metrics.volume,
    t0_s: Number(vr.t0_s) || 0.5,
    geluidsbelasting_dba: Number(variant?.geluidsbelasting_dba ?? 0),
    vlakken: calcVlakken
  });
  if (!result.ok) {
    clearVrResults(result.reason || "Berekening niet mogelijk.");
    return;
  }
  if (vrResultsHintEl) {
    vrResultsHintEl.textContent = `Cr=${result.cr_db} dB \xB7 CL=${round1(result.cl_db)} \xB7 Cg=${round1(result.cg_db)} \xB7 Ruimte=${fmtRes(result.ruimte_db)} dB`;
    vrResultsHintEl.classList.remove("hidden");
  }
  if (resSEl) {
    resSEl.textContent = `${fmtRes(result.s_m2)} / ${fmtRes(result.stot_m2)} m\xB2`;
  }
  if (resRpEl) resRpEl.textContent = `${fmtRes(result.r_prime)} dB`;
  if (resDEl) resDEl.textContent = `${fmtRes(result.d2m_nt)} dB`;
  if (resGaEl) resGaEl.textContent = `${fmtRes(result.ga_dba)} dB`;
  if (resLbiEl) resLbiEl.textContent = `${fmtRes(result.lbi_dba)} dB`;
  if (resGakEl) resGakEl.textContent = `${fmtRes(result.gak_dba)} dB`;
  vr.ga_dba = result.ga_dba != null ? round1(result.ga_dba) : null;
  vr.lbi_dba = result.lbi_dba != null ? round1(result.lbi_dba) : null;
  vr.gak_dba = result.gak_dba != null ? round1(result.gak_dba) : null;
  freshResultVrIds.add(vr.verblijfsruimte_id);
  renderVrs();
  try {
    const ret = await invokeString("API_SaveVerblijfsruimteResults", [
      auth.token,
      vr.verblijfsruimte_id,
      result.ga_dba != null ? String(round1(result.ga_dba)) : "",
      result.lbi_dba != null ? String(round1(result.lbi_dba)) : "",
      result.gak_dba != null ? String(round1(result.gak_dba)) : ""
    ]);
    void ret;
  } catch {
  }
}
function renderVlakken() {
  vlakListEl.innerHTML = "";
  if (!selectedVrId) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Selecteer eerst een verblijfsruimte.";
    vlakListEl.appendChild(li);
    return;
  }
  if (!vlakken.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nog geen vlakken.";
    vlakListEl.appendChild(li);
    return;
  }
  for (const v of vlakken) {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    const info = document.createElement("span");
    info.className = "drawing-list-select";
    const live = liveVlakQty(v);
    const qtyTxt = live.kind === "length" ? `l=${live.qty.toFixed(2)} m` : `S=${live.qty.toFixed(2)} m\xB2`;
    info.textContent = `${v.omschrijving} \xB7 ${qtyTxt} \xB7 GA;k=${v.meenemen_gak ? "ja" : "nee"}`;
    li.appendChild(info);
    const actions = document.createElement("span");
    actions.className = "drawing-list-actions";
    const del = document.createElement("button");
    del.type = "button";
    del.className = "secondary";
    del.textContent = "Verwijder";
    del.addEventListener("click", () => {
      void (async () => {
        if (!auth) return;
        const ret = await invokeString("API_DeleteVlak", [auth.token, v.vlak_id]);
        if (ret.startsWith("ERROR")) throw new Error(ret);
        await loadVlakken();
      })().catch((e) => setConn("err", String(e)));
    });
    actions.appendChild(del);
    li.appendChild(actions);
    vlakListEl.appendChild(li);
  }
}
async function openBuilding(id) {
  buildingId = id.trim();
  buildingIdEl.value = buildingId;
  syncFloormapLink();
  if (!buildingId) {
    modelPanelEl.classList.add("hidden");
    buildingMetaEl.textContent = "\u2014";
    return;
  }
  setConn("busy", "Laden\u2026");
  await refreshLinks();
  await loadGeometryOptions();
  await loadVariants();
  modelPanelEl.classList.remove("hidden");
  buildingMetaEl.textContent = `Project ${buildingId.slice(0, 8)}\u2026 \xB7 ${freeRooms.length} vrije rooms`;
  setConn("ok", "Connected");
  const url = new URL(location.href);
  url.searchParams.set("building_id", buildingId);
  history.replaceState(null, "", url.toString());
  await applyFloormapImport();
}
async function ensureDefaultVariant() {
  if (!auth || !buildingId) throw new Error("Geen project");
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
    auth.token,
    buildingId,
    "",
    "Hoofdvariant",
    "Woonfunctie",
    "55",
    "SPECTRUM_2",
    "0"
  ]);
  const data = parseJsonOk(ret);
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
  if (!subId || !auth || !buildingId) return;
  const linked = linkedBySub.get(subId);
  if (linked) {
    await ensureDefaultVariant();
    selectedVgId = linked.verblijfsgebied_id;
    selectedVrId = linked.verblijfsruimte_id;
    await loadVgs(linked.verblijfsgebied_id);
    await loadVrs(linked.verblijfsruimte_id);
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
      auth.token,
      existingVgId,
      subId,
      vrName,
      "",
      vrHoogteEl.value || "2.6",
      vrT0El.value || "0.5"
    ]);
    const data = parseJsonOk(ret);
    selectedVgId = existingVgId;
    selectedVrId = data.verblijfsruimte_id;
    await refreshLinks();
    await loadGeometryOptions();
    await loadVgs(existingVgId);
    await loadVrs(data.verblijfsruimte_id);
    setConn("ok", `VR overgenomen in ${vgName}: ${vrName}`);
  } else {
    const ret = await invokeString("API_CreateVerblijfsgebied", [
      auth.token,
      variantId,
      vgName,
      subId,
      vrName,
      "",
      vrHoogteEl.value || "2.6",
      vrT0El.value || "0.5"
    ]);
    const data = parseJsonOk(ret);
    selectedVgId = data.verblijfsgebied_id;
    selectedVrId = data.verblijfsruimte_id;
    await refreshLinks();
    await loadGeometryOptions();
    await loadVgs(data.verblijfsgebied_id);
    await loadVrs(data.verblijfsruimte_id);
    setConn("ok", `VG/VR overgenomen: ${vgName} \xB7 ${vrName}`);
  }
  clearImportQueryParams();
}
async function loadQueue() {
  if (!auth) return;
  const ret = await invokeString("API_EngineerListReviewQueue", [auth.token]);
  const data = parseJsonOk(ret);
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
async function bootstrapAndLogin(username, password) {
  await loadSharedApi();
  const ret = await invokeString("API_Login", [username, password]);
  if (ret.startsWith("ERROR")) throw new Error(ret);
  const parsed = JSON.parse(ret);
  if (!parsed.ok || !parsed.token) throw new Error("Login failed");
  showPanel({
    token: parsed.token,
    username: parsed.username || username,
    display_name: parsed.display_name || username
  });
  if (buildingId) await openBuilding(buildingId);
}
function connect() {
  setConn("busy", "Connecting\u2026");
  ws = new WebSocket(BPP_WS);
  ws.addEventListener("message", (ev) => onMessage(String(ev.data)));
  ws.addEventListener("open", () => {
    void (async () => {
      try {
        await send("session.open", { client_name: "app-gevelwering-ga", client_version: "0.2.16" }, "session.opened");
        await loadSharedApi();
        setConn("ok", "Connected");
        const saved = loadAuth(AUTH_KEY);
        if (saved?.token) {
          const v = await invokeString("API_ValidateSession", [saved.token]);
          if (!v.startsWith("ERROR")) {
            showPanel(saved);
            if (buildingId) await openBuilding(buildingId);
            return;
          }
        }
        showLogin();
      } catch (e) {
        setConn("err", String(e));
      }
    })();
  });
  ws.addEventListener("close", () => setConn("err", "Disconnected"));
  ws.addEventListener("error", () => setConn("err", "WebSocket error"));
}
loginForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(loginForm);
  void bootstrapAndLogin(String(fd.get("username") || ""), String(fd.get("password") || "")).catch(
    (e) => setConn("err", String(e))
  );
});
logoutBtn.addEventListener("click", () => {
  storeAuth2(null);
  showLogin();
});
buildingForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void openBuilding(buildingIdEl.value).catch((e) => setConn("err", String(e)));
});
queueBtn.addEventListener("click", () => {
  void loadQueue().catch((e) => setConn("err", String(e)));
});
vgRoomEl.addEventListener("change", () => {
  updateRoomPreview();
  syncVrAddButtons();
});
vlakFacadeEl.addEventListener("change", onFacadePick);
variantNewBtn.addEventListener("click", () => {
  selectedVariantId = null;
  variantNameEl.value = "Nieuwe variant";
  variantSpectrumEl.value = "SPECTRUM_2";
  renderVariants();
});
variantForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth || !buildingId) return;
    const ret = await invokeString("API_SaveVariant", [
      auth.token,
      buildingId,
      selectedVariantId || "",
      variantNameEl.value.trim(),
      variantFunctieEl.value,
      variantLbEl.value || "0",
      variantSpectrumEl.value,
      "0"
    ]);
    const data = parseJsonOk(ret);
    selectedVariantId = data.variant_id;
    await loadVariants();
    setConn("ok", "Variant opgeslagen");
  })().catch((e) => setConn("err", String(e)));
});
variantDelBtn.addEventListener("click", () => {
  void (async () => {
    if (!auth || !selectedVariantId) return;
    if (!confirm("Variant en alle VG/VR/vlakken verwijderen?")) return;
    const ret = await invokeString("API_DeleteVariant", [auth.token, selectedVariantId]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    selectedVariantId = null;
    await loadVariants();
    await refreshLinks();
    await loadGeometryOptions();
  })().catch((e) => setConn("err", String(e)));
});
async function createVgFromSelectedRoom() {
  if (!auth) throw new Error("Niet ingelogd");
  const variantId = await ensureDefaultVariant();
  const room = selectedFreeRoom();
  if (!room) throw new Error("Kies een vrije plattegrondruimte");
  const { vgName, vrName } = labelsFromRoom(room);
  const ret = await invokeString("API_CreateVerblijfsgebied", [
    auth.token,
    variantId,
    vgName,
    room.id,
    vrName,
    "",
    vrHoogteEl.value || "2.6",
    vrT0El.value || "0.5"
  ]);
  const data = parseJsonOk(ret);
  selectedVgId = data.verblijfsgebied_id;
  selectedVrId = data.verblijfsruimte_id;
  await refreshLinks();
  await loadGeometryOptions();
  await loadVgs(data.verblijfsgebied_id);
  await loadVrs(data.verblijfsruimte_id);
  setConn("ok", `Nieuw ${vgName} met ${vrName}`);
}
async function addVrToSelectedVg() {
  if (!auth) throw new Error("Niet ingelogd");
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
  const ret = await invokeString("API_AddVerblijfsruimte", [
    auth.token,
    selectedVgId,
    room.id,
    vrName,
    "",
    vrHoogteEl.value || "2.6",
    vrT0El.value || "0.5"
  ]);
  const data = parseJsonOk(ret);
  selectedVrId = data.verblijfsruimte_id;
  await refreshLinks();
  await loadGeometryOptions();
  await loadVgs(selectedVgId);
  await loadVrs(data.verblijfsruimte_id);
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
    if (!auth || !selectedVrId) return;
    syncVrVolumeFromInputs();
    const ret = await invokeString("API_SaveVerblijfsruimte", [
      auth.token,
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
    if (!auth || !selectedVrId) return;
    const ret = await invokeString("API_DeleteVerblijfsruimte", [auth.token, selectedVrId]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    await refreshLinks();
    await loadGeometryOptions();
    await loadVgs();
  })().catch((e) => setConn("err", String(e)));
});
vgDelBtn.addEventListener("click", () => {
  void (async () => {
    if (!auth || !selectedVgId) return;
    if (!confirm("Verblijfsgebied en alle VR\u2019s verwijderen?")) return;
    const ret = await invokeString("API_DeleteVerblijfsgebied", [auth.token, selectedVgId]);
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
    if (!auth || !selectedVrId) throw new Error("Selecteer een VR");
    const fac = vlakFacadeEl.value;
    const opt = vlakFacadeEl.selectedOptions[0];
    const isLen = (opt?.dataset.quantityKind || vlakAreaEl.dataset.quantityKind) === "length";
    const qty = vlakAreaEl.value || "0";
    const ret = await invokeString("API_SaveVlak", [
      auth.token,
      selectedVrId,
      "",
      vlakNameEl.value.trim() || "Vlak",
      isLen ? "0" : qty,
      vlakClEl?.value || "0",
      vlakCgEl?.value || "0",
      vlakGakEl.checked ? "true" : "false",
      "0",
      fac,
      isLen ? "length" : "area",
      isLen ? qty : ""
    ]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    vlakNameEl.value = "";
    await loadVlakken();
    setConn("ok", "Vlak toegevoegd");
  })().catch((e) => setConn("err", String(e)));
});
function setCustomMatPanelOpen(open) {
  if (!customMatPanelEl) return;
  customMatPanelEl.classList.toggle("hidden", !open);
  if (open) void ensureCustomMatRubrieken();
}
async function ensureCustomMatRubrieken() {
  if (!customMatRubriekEl || !auth || customMatRubriekEl.options.length > 1) return;
  const data = await apiGet("/api/floormap/material-categories");
  customMatRubriekEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "\u2014 kies rubriek \u2014";
  customMatRubriekEl.appendChild(ph);
  for (const c of data.categories || []) {
    if (c.rubriek_nr == null) continue;
    const o = document.createElement("option");
    o.value = String(c.rubriek_nr);
    o.textContent = c.label || c.master_category;
    customMatRubriekEl.appendChild(o);
  }
}
customMatToggleBtn?.addEventListener("click", () => {
  if (!vlakFacadeEl.value) {
    setConn("err", "Selecteer eerst een gevelcomponent");
    return;
  }
  setCustomMatPanelOpen(true);
  if (customMatNameEl && !customMatNameEl.value.trim()) {
    const opt = vlakFacadeEl.selectedOptions[0];
    customMatNameEl.value = (opt?.dataset.label || "").trim();
  }
});
customMatCancelBtn?.addEventListener("click", () => {
  setCustomMatPanelOpen(false);
});
customMatForm?.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth) throw new Error("Niet ingelogd");
    const fac = vlakFacadeEl.value;
    if (!fac) throw new Error("Selecteer eerst een gevelcomponent");
    const rubriek = Number(customMatRubriekEl?.value || "");
    const name = (customMatNameEl?.value || "").trim();
    const ra = Number(customMatRaEl?.value);
    if (!rubriek) throw new Error("Kies een rubriek");
    if (!name) throw new Error("Naam is verplicht");
    if (!Number.isFinite(ra)) throw new Error("RA is verplicht");
    setConn("busy", "Eigen materiaal opslaan\u2026");
    const data = await apiPost("/api/floormap/materials", {
      name,
      ra_dba: ra,
      rubriek_nr: rubriek,
      subsection_id: fac
    });
    setCustomMatPanelOpen(false);
    if (customMatNameEl) customMatNameEl.value = "";
    await loadFacadesForSelectedVr();
    if ([...vlakFacadeEl.options].some((o) => o.value === fac)) {
      vlakFacadeEl.value = fac;
      onFacadePick(false);
    }
    setConn(
      "ok",
      data.assigned ? `Materiaal \xAB${data.material.name}\xBB gekoppeld (RA ${data.material.ra_dba}) \u2014 voeg nu het vlak toe` : `Materiaal \xAB${data.material.name}\xBB opgeslagen`
    );
  })().catch((e) => setConn("err", String(e)));
});
if (buildingId) buildingIdEl.value = buildingId;
syncFloormapLink();
initPasswordToggles();
connect();
