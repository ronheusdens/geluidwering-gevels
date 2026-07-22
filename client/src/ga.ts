/**
 * GA projectmodel — fase B: variant / VG / VR (floormap) / vlak (façade).
 * Engineer-only. Reuses shared_building_api (+ ga_model_api).
 */
import { loadAuth, storeAuth as persistAuth, syncSessionCookie, apiAuthHeaders } from "./auth-store";
import { resolveBppWsUrl } from "./ws-url";

type Envelope = {
  v: number;
  type: string;
  request_id: string;
  session_id?: string;
  payload?: Record<string, unknown>;
};

type AuthInfo = { token: string; username: string; display_name: string };

type Variant = {
  variant_id: string;
  omschrijving: string;
  gebruiksfunctie: string;
  geluidsbelasting_dba: number;
  spectrum_kind: string;
  sort_order: number;
};

type Vg = { verblijfsgebied_id: string; omschrijving: string; sort_order: number; vr_count: number };

type Vr = {
  verblijfsruimte_id: string;
  omschrijving: string;
  subsection_id: string;
  vloer_m2: number;
  hoogte_m: number;
  volume_m3: number;
  t0_s: number;
  sort_order: number;
  ga_dba: number | null;
  lbi_dba: number | null;
  gak_dba: number | null;
};

type Vlak = {
  vlak_id: string;
  omschrijving: string;
  area_m2: number;
  cl_db: number;
  cg_db: number;
  meenemen_gak: boolean;
  sort_order: number;
  facade_subsection_id: string | null;
};

type RoomOpt = {
  id: string;
  section_id: string;
  label: string;
  area_m2: number | null;
  region_kind: string;
  section_label: string;
};

type QueueProject = {
  building_id: string;
  label: string;
  customer_name: string;
  project_status: string;
};

const BPP_WS = resolveBppWsUrl();
const AUTH_KEY = "acoustics_engineer_auth";
const params = new URLSearchParams(location.search);

const connLedEl = document.getElementById("ga-conn-led") as HTMLElement;
const connStatusEl = document.getElementById("ga-conn-status") as HTMLElement;
const loginPanelEl = document.getElementById("ga-login-panel") as HTMLElement;
const loginForm = document.getElementById("ga-login-form") as HTMLFormElement;
const panelEl = document.getElementById("ga-panel") as HTMLElement;
const userLabelEl = document.getElementById("ga-user-label") as HTMLElement;
const logoutBtn = document.getElementById("ga-logout-btn") as HTMLButtonElement;
const buildingForm = document.getElementById("ga-building-form") as HTMLFormElement;
const buildingIdEl = document.getElementById("ga-building-id") as HTMLInputElement;
const buildingMetaEl = document.getElementById("ga-building-meta") as HTMLElement;
const queueBtn = document.getElementById("ga-queue-btn") as HTMLButtonElement;
const queueListEl = document.getElementById("ga-queue-list") as HTMLElement;
const modelPanelEl = document.getElementById("ga-model-panel") as HTMLElement;
const floormapLinkEl = document.getElementById("ga-floormap-link") as HTMLAnchorElement;

const variantForm = document.getElementById("ga-variant-form") as HTMLFormElement;
const variantListEl = document.getElementById("ga-variant-list") as HTMLUListElement;
const variantNameEl = document.getElementById("ga-variant-name") as HTMLInputElement;
const variantFunctieEl = document.getElementById("ga-variant-functie") as HTMLSelectElement;
const variantLbEl = document.getElementById("ga-variant-lb") as HTMLInputElement;
const variantSpectrumEl = document.getElementById("ga-variant-spectrum") as HTMLSelectElement;
const variantNewBtn = document.getElementById("ga-variant-new-btn") as HTMLButtonElement;
const variantDelBtn = document.getElementById("ga-variant-del-btn") as HTMLButtonElement;

const vgForm = document.getElementById("ga-vg-form") as HTMLFormElement;
const vgNameEl = document.getElementById("ga-vg-name") as HTMLInputElement;
const vgRoomEl = document.getElementById("ga-vg-room") as HTMLSelectElement;
const vrNameEl = document.getElementById("ga-vr-name") as HTMLInputElement;
const vrHoogteEl = document.getElementById("ga-vr-hoogte") as HTMLInputElement;
const vrT0El = document.getElementById("ga-vr-t0") as HTMLInputElement;
const vrAddBtn = document.getElementById("ga-vr-add-btn") as HTMLButtonElement;
const vgListEl = document.getElementById("ga-vg-list") as HTMLUListElement;
const vrListEl = document.getElementById("ga-vr-list") as HTMLUListElement;
const vrEditForm = document.getElementById("ga-vr-edit-form") as HTMLFormElement;
const vrEditNameEl = document.getElementById("ga-vr-edit-name") as HTMLInputElement;
const vrEditVloerEl = document.getElementById("ga-vr-edit-vloer") as HTMLInputElement;
const vrEditHoogteEl = document.getElementById("ga-vr-edit-hoogte") as HTMLInputElement;
const vrEditVolumeEl = document.getElementById("ga-vr-edit-volume") as HTMLInputElement;
const vrEditT0El = document.getElementById("ga-vr-edit-t0") as HTMLInputElement;
const vrDelBtn = document.getElementById("ga-vr-del-btn") as HTMLButtonElement;
const vgDelBtn = document.getElementById("ga-vg-del-btn") as HTMLButtonElement;

const vlakForm = document.getElementById("ga-vlak-form") as HTMLFormElement;
const vlakNameEl = document.getElementById("ga-vlak-name") as HTMLInputElement;
const vlakFacadeEl = document.getElementById("ga-vlak-facade") as HTMLSelectElement;
const vlakAreaEl = document.getElementById("ga-vlak-area") as HTMLInputElement;
const vlakGakEl = document.getElementById("ga-vlak-gak") as HTMLInputElement;
const vlakListEl = document.getElementById("ga-vlak-list") as HTMLUListElement;

let ws: WebSocket | null = null;
let sessionId: string | null = null;
let auth: AuthInfo | null = null;
let requestSeq = 0;
const pending = new Map<string, { resolve: (e: Envelope) => void; reject: (e: Error) => void; want: string }>();

let buildingId = params.get("building_id") || "";
let variants: Variant[] = [];
let selectedVariantId: string | null = params.get("variant_id");
let vgs: Vg[] = [];
let selectedVgId: string | null = null;
let vrs: Vr[] = [];
let selectedVrId: string | null = null;
let vlakken: Vlak[] = [];
let freeRooms: RoomOpt[] = [];
let facadeParts: RoomOpt[] = [];
let linkedSubIds = new Set<string>();

function nextRequestId(prefix: string): string {
  requestSeq += 1;
  return `${prefix}_${requestSeq}`;
}

function setConn(state: "ok" | "busy" | "err", text: string): void {
  connLedEl.className = `conn-led ${state === "ok" ? "connected" : state === "busy" ? "busy" : "disconnected"}`;
  connStatusEl.textContent = text;
}

function storeAuth(info: AuthInfo | null): void {
  auth = info;
  if (info) persistAuth(AUTH_KEY, info);
  else persistAuth(AUTH_KEY, null);
}

function showLogin(): void {
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
}

function showPanel(info: AuthInfo): void {
  storeAuth(info);
  void syncSessionCookie(info.token);
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
}

function send(type: string, payload: Record<string, unknown>, wantType: string): Promise<Envelope> {
  if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error("WebSocket not open"));
  const request_id = nextRequestId(type.replace(".", "_"));
  const env: Envelope = { v: 1, type, request_id, payload };
  if (sessionId && type !== "session.open") env.session_id = sessionId;
  return new Promise((resolve, reject) => {
    pending.set(request_id, { resolve, reject, want: wantType });
    ws!.send(JSON.stringify(env));
  });
}

function onMessage(raw: string): void {
  let env: Envelope;
  try {
    env = JSON.parse(raw) as Envelope;
  } catch {
    return;
  }
  if (env.type === "session.opened") {
    const sid =
      (typeof env.session_id === "string" && env.session_id) ||
      (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
    if (sid) sessionId = sid;
  }
  if (env.type === "error") {
    const waiter = pending.get(env.request_id);
    if (waiter) {
      pending.delete(env.request_id);
      waiter.reject(new Error(JSON.stringify(env.payload ?? env)));
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

async function invokeString(target: string, args: unknown[]): Promise<string> {
  const inv = await send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
  const ret = inv.payload?.return;
  if (typeof ret !== "string") throw new Error(`Unexpected return from ${target}`);
  return ret;
}

async function loadSharedApi(): Promise<void> {
  await send(
    "exec.request",
    { code: 'INCLUDE "fixtures/acoustics/shared_building_api.basicpp"\n' },
    "exec.completed",
  );
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap failed: ${bootRet}`);
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: apiAuthHeaders(auth!.token) });
  const body = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function parseJsonOk<T>(ret: string): T {
  if (ret.startsWith("ERROR")) throw new Error(ret);
  return JSON.parse(ret) as T;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function syncFloormapLink(): void {
  const q = buildingId ? `?building_id=${encodeURIComponent(buildingId)}` : "";
  floormapLinkEl.href = `/floormap.html${q}`;
}

async function refreshLinks(): Promise<void> {
  if (!buildingId || !auth) return;
  const ret = await invokeString("API_ListLinkedSubsections", [auth.token, buildingId]);
  const data = parseJsonOk<{ links: Array<{ subsection_id: string }> }>(ret);
  linkedSubIds = new Set(data.links.map((l) => l.subsection_id));
}

async function loadGeometryOptions(): Promise<void> {
  if (!buildingId || !auth) return;
  const sections = await apiGet<{
    sections: Array<{ id: string; label: string; region_kind: string }>;
  }>(`/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`);
  const rooms: RoomOpt[] = [];
  const facades: RoomOpt[] = [];
  for (const sec of sections.sections || []) {
    const kind = String(sec.region_kind || "").toUpperCase();
    const sub = await apiGet<{
      subsections: Array<{ id: string; label: string; area_m2: number | null }>;
    }>(`/api/floormap/subsections?section_id=${encodeURIComponent(sec.id)}`);
    for (const s of sub.subsections || []) {
      const opt: RoomOpt = {
        id: s.id,
        section_id: sec.id,
        label: s.label,
        area_m2: s.area_m2,
        region_kind: kind,
        section_label: sec.label || kind,
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

function fillRoomSelect(): void {
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
    const area = r.area_m2 != null ? `${r.area_m2.toFixed(1)} m²` : "geen m²";
    o.textContent = `${r.label} · ${r.section_label} · ${area}`;
    o.dataset.area = r.area_m2 != null ? String(r.area_m2) : "";
    o.dataset.label = r.label;
    vgRoomEl.appendChild(o);
  }
  if (prev && [...vgRoomEl.options].some((o) => o.value === prev)) vgRoomEl.value = prev;
  onRoomPick();
}

function fillFacadeSelect(): void {
  const prev = vlakFacadeEl.value;
  vlakFacadeEl.innerHTML = `<option value="">— handmatig —</option>`;
  for (const r of facadeParts) {
    const o = document.createElement("option");
    o.value = r.id;
    const area = r.area_m2 != null ? `${r.area_m2.toFixed(1)} m²` : "geen m²";
    o.textContent = `${r.label} · ${area}`;
    o.dataset.area = r.area_m2 != null ? String(r.area_m2) : "";
    o.dataset.label = r.label;
    vlakFacadeEl.appendChild(o);
  }
  if (prev && [...vlakFacadeEl.options].some((o) => o.value === prev)) vlakFacadeEl.value = prev;
}

function onRoomPick(): void {
  const opt = vgRoomEl.selectedOptions[0];
  if (!opt || !opt.value) return;
  if (!vrNameEl.value.trim()) vrNameEl.value = opt.dataset.label || "";
  if (!vgNameEl.value.trim()) vgNameEl.value = opt.dataset.label || "Verblijfsgebied";
}

function onFacadePick(): void {
  const opt = vlakFacadeEl.selectedOptions[0];
  if (!opt || !opt.value) return;
  if (opt.dataset.area) vlakAreaEl.value = opt.dataset.area;
  if (!vlakNameEl.value.trim()) vlakNameEl.value = opt.dataset.label || "Vlak";
}

async function loadVariants(): Promise<void> {
  if (!buildingId || !auth) return;
  const ret = await invokeString("API_ListVariants", [auth.token, buildingId]);
  const data = parseJsonOk<{ variants: Variant[] }>(ret);
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

function fillVariantForm(v: Variant): void {
  variantNameEl.value = v.omschrijving;
  variantFunctieEl.value = v.gebruiksfunctie;
  variantLbEl.value = String(v.geluidsbelasting_dba);
  variantSpectrumEl.value = v.spectrum_kind;
}

function renderVariants(): void {
  variantListEl.innerHTML = "";
  if (!variants.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nog geen variant — vul het formulier in en sla op.";
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
    btn.textContent = `${v.omschrijving} · ${v.geluidsbelasting_dba} dB(A) · ${v.spectrum_kind}`;
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

async function loadVgs(): Promise<void> {
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
  const data = parseJsonOk<{ verblijfsgebieden: Vg[] }>(ret);
  vgs = data.verblijfsgebieden || [];
  if (vgs.length) selectedVgId = vgs[0].verblijfsgebied_id;
  renderVgs();
  await loadVrs();
}

function renderVgs(): void {
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
    btn.textContent = `${g.omschrijving} · ${g.vr_count} VR`;
    btn.addEventListener("click", () => {
      selectedVgId = g.verblijfsgebied_id;
      renderVgs();
      void loadVrs();
    });
    li.appendChild(btn);
    vgListEl.appendChild(li);
  }
}

async function loadVrs(): Promise<void> {
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
  const data = parseJsonOk<{ verblijfsruimten: Vr[] }>(ret);
  vrs = data.verblijfsruimten || [];
  if (vrs.length) selectedVrId = vrs[0].verblijfsruimte_id;
  renderVrs();
  await loadVlakken();
}

function renderVrs(): void {
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
    btn.textContent = `${r.omschrijving} · ${r.vloer_m2} m² · V=${r.volume_m3} m³ · T0=${r.t0_s}`;
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

function fillVrEdit(r: Vr): void {
  vrEditForm.classList.remove("hidden");
  vrEditNameEl.value = r.omschrijving;
  vrEditVloerEl.value = String(r.vloer_m2);
  vrEditHoogteEl.value = String(r.hoogte_m);
  vrEditVolumeEl.value = String(r.volume_m3);
  vrEditT0El.value = String(r.t0_s);
}

async function loadVlakken(): Promise<void> {
  vlakken = [];
  if (!selectedVrId || !auth) {
    renderVlakken();
    return;
  }
  const ret = await invokeString("API_ListVlakken", [auth.token, selectedVrId]);
  const data = parseJsonOk<{ vlakken: Vlak[] }>(ret);
  vlakken = data.vlakken || [];
  renderVlakken();
}

function renderVlakken(): void {
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
    info.textContent = `${v.omschrijving} · S=${v.area_m2} m² · GA;k=${v.meenemen_gak ? "ja" : "nee"}`;
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

async function openBuilding(id: string): Promise<void> {
  buildingId = id.trim();
  buildingIdEl.value = buildingId;
  syncFloormapLink();
  if (!buildingId) {
    modelPanelEl.classList.add("hidden");
    buildingMetaEl.textContent = "—";
    return;
  }
  setConn("busy", "Laden…");
  await refreshLinks();
  await loadGeometryOptions();
  await loadVariants();
  modelPanelEl.classList.remove("hidden");
  buildingMetaEl.textContent = `Project ${buildingId.slice(0, 8)}… · ${freeRooms.length} vrije rooms · ${facadeParts.length} façade-delen`;
  setConn("ok", "Connected");
  const url = new URL(location.href);
  url.searchParams.set("building_id", buildingId);
  history.replaceState(null, "", url.toString());
}

async function loadQueue(): Promise<void> {
  if (!auth) return;
  const ret = await invokeString("API_EngineerListReviewQueue", [auth.token]);
  const data = parseJsonOk<{ projects: QueueProject[] }>(ret);
  queueListEl.classList.remove("hidden");
  queueListEl.innerHTML = "";
  for (const p of data.projects || []) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "admin-project-card panel";
    card.innerHTML = `<strong>${esc(p.label || p.building_id.slice(0, 8))}</strong><br/><span class="hint">${esc(p.customer_name)} · ${esc(p.project_status)}</span>`;
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

async function bootstrapAndLogin(username: string, password: string): Promise<void> {
  await loadSharedApi();
  const ret = await invokeString("API_Login", [username, password]);
  if (ret.startsWith("ERROR")) throw new Error(ret);
  const parsed = JSON.parse(ret) as { ok?: boolean; token?: string; username?: string; display_name?: string };
  if (!parsed.ok || !parsed.token) throw new Error("Login failed");
  showPanel({
    token: parsed.token,
    username: parsed.username || username,
    display_name: parsed.display_name || username,
  });
  if (buildingId) await openBuilding(buildingId);
}

function connect(): void {
  setConn("busy", "Connecting…");
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
  void bootstrapAndLogin(String(fd.get("username") || ""), String(fd.get("password") || "")).catch((e) =>
    setConn("err", String(e)),
  );
});

logoutBtn.addEventListener("click", () => {
  storeAuth(null);
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
      "0",
    ]);
    const data = parseJsonOk<{ variant_id: string }>(ret);
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
      vrT0El.value || "0.5",
    ]);
    const data = parseJsonOk<{ verblijfsgebied_id: string; verblijfsruimte_id: string }>(ret);
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
      vrT0El.value || "0.5",
    ]);
    const data = parseJsonOk<{ verblijfsruimte_id: string }>(ret);
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
      "0",
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
    if (!confirm("Verblijfsgebied en alle VR’s verwijderen?")) return;
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
      fac,
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
