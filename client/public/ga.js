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

// src/ga.ts
var BPP_WS = resolveBppWsUrl();
var AUTH_KEY = "acoustics_engineer_auth";
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
var vgForm = document.getElementById("ga-vg-form");
var vgNameEl = document.getElementById("ga-vg-name");
var vgRoomEl = document.getElementById("ga-vg-room");
var vrNameEl = document.getElementById("ga-vr-name");
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
var vlakAreaEl = document.getElementById("ga-vlak-area");
var vlakGakEl = document.getElementById("ga-vlak-gak");
var vlakListEl = document.getElementById("ga-vlak-list");
var ws = null;
var sessionId = null;
var auth = null;
var requestSeq = 0;
var pending = /* @__PURE__ */ new Map();
var buildingId = params.get("building_id") || "";
var variants = [];
var selectedVariantId = params.get("variant_id");
var vgs = [];
var selectedVgId = null;
var vrs = [];
var selectedVrId = null;
var vlakken = [];
var freeRooms = [];
var facadeParts = [];
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
    { code: 'INCLUDE "fixtures/acoustics/shared_building_api.basicpp"\n' },
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
  linkedSubIds = new Set(data.links.map((l) => l.subsection_id));
}
async function loadGeometryOptions() {
  if (!buildingId || !auth) return;
  const sections = await apiGet(`/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`);
  const rooms = [];
  const facades = [];
  for (const sec of sections.sections || []) {
    const kind = String(sec.region_kind || "").toUpperCase();
    const sub = await apiGet(`/api/floormap/subsections?section_id=${encodeURIComponent(sec.id)}`);
    for (const s of sub.subsections || []) {
      const opt = {
        id: s.id,
        section_id: sec.id,
        label: s.label,
        area_m2: s.area_m2,
        region_kind: kind,
        section_label: sec.label || kind
      };
      if (kind === "FLOORMAP") rooms.push(opt);
      if (kind === "FACADE") facades.push(opt);
    }
  }
  freeRooms = rooms.filter((r) => !linkedSubIds.has(r.id));
  facadeParts = facades;
  fillRoomSelect();
  fillFacadeSelect();
}
function fillRoomSelect() {
  const prev = vgRoomEl.value;
  vgRoomEl.innerHTML = "";
  if (freeRooms.length === 0) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "Geen vrije floormap-ruimten";
    vgRoomEl.appendChild(o);
    return;
  }
  for (const r of freeRooms) {
    const o = document.createElement("option");
    o.value = r.id;
    const area = r.area_m2 != null ? `${r.area_m2.toFixed(1)} m\xB2` : "geen m\xB2";
    o.textContent = `${r.label} \xB7 ${r.section_label} \xB7 ${area}`;
    o.dataset.area = r.area_m2 != null ? String(r.area_m2) : "";
    o.dataset.label = r.label;
    vgRoomEl.appendChild(o);
  }
  if (prev && [...vgRoomEl.options].some((o) => o.value === prev)) vgRoomEl.value = prev;
  onRoomPick();
}
function fillFacadeSelect() {
  const prev = vlakFacadeEl.value;
  vlakFacadeEl.innerHTML = `<option value="">\u2014 handmatig \u2014</option>`;
  for (const r of facadeParts) {
    const o = document.createElement("option");
    o.value = r.id;
    const area = r.area_m2 != null ? `${r.area_m2.toFixed(1)} m\xB2` : "geen m\xB2";
    o.textContent = `${r.label} \xB7 ${area}`;
    o.dataset.area = r.area_m2 != null ? String(r.area_m2) : "";
    o.dataset.label = r.label;
    vlakFacadeEl.appendChild(o);
  }
  if (prev && [...vlakFacadeEl.options].some((o) => o.value === prev)) vlakFacadeEl.value = prev;
}
function onRoomPick() {
  const opt = vgRoomEl.selectedOptions[0];
  if (!opt || !opt.value) return;
  if (!vrNameEl.value.trim()) vrNameEl.value = opt.dataset.label || "";
  if (!vgNameEl.value.trim()) vgNameEl.value = opt.dataset.label || "Verblijfsgebied";
}
function onFacadePick() {
  const opt = vlakFacadeEl.selectedOptions[0];
  if (!opt || !opt.value) return;
  if (opt.dataset.area) vlakAreaEl.value = opt.dataset.area;
  if (!vlakNameEl.value.trim()) vlakNameEl.value = opt.dataset.label || "Vlak";
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
    btn.textContent = `${v.omschrijving} \xB7 ${v.geluidsbelasting_dba} dB(A) \xB7 ${v.spectrum_kind}`;
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
async function loadVgs() {
  vgs = [];
  vrs = [];
  selectedVgId = null;
  selectedVrId = null;
  vlakken = [];
  if (!selectedVariantId || !auth) {
    renderVgs();
    renderVrs();
    renderVlakken();
    vrEditForm.classList.add("hidden");
    return;
  }
  const ret = await invokeString("API_ListVerblijfsgebieden", [auth.token, selectedVariantId]);
  const data = parseJsonOk(ret);
  vgs = data.verblijfsgebieden || [];
  if (vgs.length) selectedVgId = vgs[0].verblijfsgebied_id;
  renderVgs();
  await loadVrs();
}
function renderVgs() {
  vgListEl.innerHTML = "";
  if (!vgs.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nog geen verblijfsgebied.";
    vgListEl.appendChild(li);
    return;
  }
  for (const g of vgs) {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (g.verblijfsgebied_id === selectedVgId) li.classList.add("selected");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "drawing-list-select";
    btn.textContent = `${g.omschrijving} \xB7 ${g.vr_count} VR`;
    btn.addEventListener("click", () => {
      selectedVgId = g.verblijfsgebied_id;
      renderVgs();
      void loadVrs();
    });
    li.appendChild(btn);
    vgListEl.appendChild(li);
  }
}
async function loadVrs() {
  vrs = [];
  selectedVrId = null;
  vlakken = [];
  if (!selectedVgId || !auth) {
    renderVrs();
    renderVlakken();
    vrEditForm.classList.add("hidden");
    return;
  }
  const ret = await invokeString("API_ListVerblijfsruimten", [auth.token, selectedVgId]);
  const data = parseJsonOk(ret);
  vrs = data.verblijfsruimten || [];
  if (vrs.length) selectedVrId = vrs[0].verblijfsruimte_id;
  renderVrs();
  await loadVlakken();
}
function renderVrs() {
  vrListEl.innerHTML = "";
  if (!vrs.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Selecteer een VG of maak er een aan.";
    vrListEl.appendChild(li);
    vrEditForm.classList.add("hidden");
    return;
  }
  for (const r of vrs) {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (r.verblijfsruimte_id === selectedVrId) li.classList.add("selected");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "drawing-list-select";
    btn.textContent = `${r.omschrijving} \xB7 ${r.vloer_m2} m\xB2 \xB7 V=${r.volume_m3} m\xB3 \xB7 T0=${r.t0_s}`;
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
function fillVrEdit(r) {
  vrEditForm.classList.remove("hidden");
  vrEditNameEl.value = r.omschrijving;
  vrEditVloerEl.value = String(r.vloer_m2);
  vrEditHoogteEl.value = String(r.hoogte_m);
  vrEditVolumeEl.value = String(r.volume_m3);
  vrEditT0El.value = String(r.t0_s);
}
async function loadVlakken() {
  vlakken = [];
  if (!selectedVrId || !auth) {
    renderVlakken();
    return;
  }
  const ret = await invokeString("API_ListVlakken", [auth.token, selectedVrId]);
  const data = parseJsonOk(ret);
  vlakken = data.vlakken || [];
  renderVlakken();
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
    info.textContent = `${v.omschrijving} \xB7 S=${v.area_m2} m\xB2 \xB7 GA;k=${v.meenemen_gak ? "ja" : "nee"}`;
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
  buildingMetaEl.textContent = `Project ${buildingId.slice(0, 8)}\u2026 \xB7 ${freeRooms.length} vrije rooms \xB7 ${facadeParts.length} fa\xE7ade-delen`;
  setConn("ok", "Connected");
  const url = new URL(location.href);
  url.searchParams.set("building_id", buildingId);
  history.replaceState(null, "", url.toString());
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
        await send("session.open", { client_name: "acoustics-ga", client_version: "0.2.16" }, "session.opened");
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
vgRoomEl.addEventListener("change", onRoomPick);
vlakFacadeEl.addEventListener("change", onFacadePick);
variantNewBtn.addEventListener("click", () => {
  selectedVariantId = null;
  variantNameEl.value = "Nieuwe variant";
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
vgForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth || !selectedVariantId) throw new Error("Selecteer eerst een variant");
    const sub = vgRoomEl.value;
    if (!sub) throw new Error("Kies een vrije floormap-ruimte");
    const ret = await invokeString("API_CreateVerblijfsgebied", [
      auth.token,
      selectedVariantId,
      vgNameEl.value.trim() || "Verblijfsgebied",
      sub,
      vrNameEl.value.trim() || vgNameEl.value.trim() || "Verblijfsruimte",
      "",
      vrHoogteEl.value || "2.6",
      vrT0El.value || "0.5"
    ]);
    const data = parseJsonOk(ret);
    selectedVgId = data.verblijfsgebied_id;
    selectedVrId = data.verblijfsruimte_id;
    vgNameEl.value = "";
    vrNameEl.value = "";
    await refreshLinks();
    await loadGeometryOptions();
    await loadVgs();
    setConn("ok", "VG + VR aangemaakt vanuit floormap");
  })().catch((e) => setConn("err", String(e)));
});
vrAddBtn.addEventListener("click", () => {
  void (async () => {
    if (!auth || !selectedVgId) throw new Error("Selecteer een VG");
    const sub = vgRoomEl.value;
    if (!sub) throw new Error("Kies een vrije floormap-ruimte");
    const ret = await invokeString("API_AddVerblijfsruimte", [
      auth.token,
      selectedVgId,
      sub,
      vrNameEl.value.trim() || vgRoomEl.selectedOptions[0]?.dataset.label || "Verblijfsruimte",
      "",
      vrHoogteEl.value || "2.6",
      vrT0El.value || "0.5"
    ]);
    const data = parseJsonOk(ret);
    selectedVrId = data.verblijfsruimte_id;
    await refreshLinks();
    await loadGeometryOptions();
    await loadVgs();
    setConn("ok", "VR toegevoegd");
  })().catch((e) => setConn("err", String(e)));
});
vrEditForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth || !selectedVrId) return;
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
    const ret = await invokeString("API_SaveVlak", [
      auth.token,
      selectedVrId,
      "",
      vlakNameEl.value.trim() || "Vlak",
      vlakAreaEl.value || "0",
      "0",
      "0",
      vlakGakEl.checked ? "true" : "false",
      "0",
      fac
    ]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    vlakNameEl.value = "";
    vlakFacadeEl.value = "";
    await loadVlakken();
    setConn("ok", "Vlak toegevoegd");
  })().catch((e) => setConn("err", String(e)));
});
if (buildingId) buildingIdEl.value = buildingId;
syncFloormapLink();
connect();
