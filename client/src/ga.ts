/**
 * GA projectmodel — fase B: variant / VG / VR (floormap) / vlak (façade).
 * Engineer-only. Reuses shared_building_api (+ ga_model_api).
 * Rekenkern: GA / Lbi / GA;k conform NPR 5272 / NEN 5077 (DGMR-voorbeeld).
 */
import { loadAuth, storeAuth as persistAuth, syncSessionCookie, apiAuthHeaders } from "./auth-store";
import { resolveBppWsUrl } from "./ws-url";
import { initPasswordToggles } from "./password-toggle";
import { computeVrGa, round1 } from "./ga-calc";

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
  length_m?: number | null;
  quantity_kind?: "area" | "length" | string;
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
  vg_nr: number | null;
  vr_nr: string | null;
  level_hint: string;
};

type VrFacadeOpt = {
  id: string;
  label: string;
  section_label: string;
  region_kind: string;
  area_m2: number | null;
  quantity_kind: "area" | "length" | string;
  length_m: number | null;
  vg_nr: number | null;
  vr_nr: string | null;
  ga_ready: boolean;
  material_name: string | null;
  master_category: string | null;
  material_id: string | null;
  ra_dba: number | null;
  boolean_op: string | null;
};

type LinkedSub = {
  subsection_id: string;
  verblijfsruimte_id: string;
  verblijfsgebied_id: string;
  omschrijving: string;
};

type QueueProject = {
  building_id: string;
  label: string;
  customer_name: string;
  project_status: string;
};

const BPP_WS = resolveBppWsUrl();
const AUTH_KEY = "app_gevelwering_engineer_auth";
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

const vgNewBtn = document.getElementById("ga-vg-new-btn") as HTMLButtonElement;
const vgRoomEl = document.getElementById("ga-vg-room") as HTMLSelectElement;
const roomPreviewEl = document.getElementById("ga-room-preview") as HTMLElement | null;
const vrHeadingEl = document.getElementById("ga-vr-heading") as HTMLElement | null;
const vrEmptyHintEl = document.getElementById("ga-vr-empty-hint") as HTMLElement | null;
const vrEditPreviewEl = document.getElementById("ga-vr-edit-preview") as HTMLElement | null;
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
const vlakFacadeHintEl = document.getElementById("ga-vlak-facade-hint") as HTMLElement | null;
const vlakFacadePreviewEl = document.getElementById("ga-vlak-facade-preview") as HTMLElement | null;
const vlakAreaEl = document.getElementById("ga-vlak-area") as HTMLInputElement;
const vlakQtyLabelEl = document.getElementById("ga-vlak-qty-label") as HTMLElement | null;
const vlakClEl = document.getElementById("ga-vlak-cl") as HTMLInputElement | null;
const vlakCgEl = document.getElementById("ga-vlak-cg") as HTMLInputElement | null;
const vlakGakEl = document.getElementById("ga-vlak-gak") as HTMLInputElement;
const vlakListEl = document.getElementById("ga-vlak-list") as HTMLUListElement;
const customMatToggleBtn = document.getElementById("ga-custom-mat-toggle") as HTMLButtonElement | null;
const customMatPanelEl = document.getElementById("ga-custom-mat-panel") as HTMLElement | null;
const customMatForm = document.getElementById("ga-custom-mat-form") as HTMLFormElement | null;
const customMatRubriekEl = document.getElementById("ga-custom-mat-rubriek") as HTMLSelectElement | null;
const customMatNameEl = document.getElementById("ga-custom-mat-name") as HTMLInputElement | null;
const customMatRaEl = document.getElementById("ga-custom-mat-ra") as HTMLInputElement | null;
const customMatCancelBtn = document.getElementById("ga-custom-mat-cancel") as HTMLButtonElement | null;
const vrResultsHintEl = document.getElementById("ga-vr-results-hint") as HTMLElement | null;
const resSEl = document.getElementById("ga-res-s") as HTMLElement | null;
const resRpEl = document.getElementById("ga-res-rp") as HTMLElement | null;
const resDEl = document.getElementById("ga-res-d") as HTMLElement | null;
const resGaEl = document.getElementById("ga-res-ga") as HTMLElement | null;
const resLbiEl = document.getElementById("ga-res-lbi") as HTMLElement | null;
const resGakEl = document.getElementById("ga-res-gak") as HTMLElement | null;

let ws: WebSocket | null = null;
let sessionId: string | null = null;
let auth: AuthInfo | null = null;
let requestSeq = 0;
const pending = new Map<string, { resolve: (e: Envelope) => void; reject: (e: Error) => void; want: string }>();

let buildingId = params.get("building_id") || "";
let pendingImportSubId = (params.get("subsection_id") || "").trim();
let pendingImportVgNr = (params.get("vg_nr") || "").trim();
let pendingImportVrNr = (params.get("vr_nr") || "").trim();
let variants: Variant[] = [];
let selectedVariantId: string | null = params.get("variant_id");
let vgs: Vg[] = [];
let selectedVgId: string | null = null;
let vrs: Vr[] = [];
let selectedVrId: string | null = null;
let vlakken: Vlak[] = [];
/** VR ids whose GA/Lbi/GA;k were computed in this browser session (not stale DB snapshots). */
const freshResultVrIds = new Set<string>();
let freeRooms: RoomOpt[] = [];
let floormapRoomsById = new Map<string, RoomOpt>();
let vrFacades: VrFacadeOpt[] = [];
let linkedBySub = new Map<string, LinkedSub>();
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
    { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
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

async function apiPost<T>(url: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...apiAuthHeaders(auth!.token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  const data = parseJsonOk<{ links: LinkedSub[] }>(ret);
  linkedBySub = new Map();
  linkedSubIds = new Set();
  for (const l of data.links || []) {
    if (!l?.subsection_id) continue;
    linkedBySub.set(l.subsection_id, l);
    linkedSubIds.add(l.subsection_id);
  }
}

function vgLabelFromNr(vgNr: string | number, fallback = "Verblijfsgebied"): string {
  const n = String(vgNr).trim();
  return n ? `VG ${n}` : fallback;
}

function vrLabelFromNr(vrNr: string, roomLabel?: string): string {
  const n = String(vrNr || "").trim();
  const room = (roomLabel || "").trim();
  if (n && room && room !== n) return `VR ${n} · ${room}`;
  if (n) return `VR ${n}`;
  return room || "Verblijfsruimte";
}

function parseVgNrFromText(text: string): number | null {
  const m = String(text || "").trim().match(/^VG\s+(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function levelLabel(hint?: string | null): string {
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

function isGroundLevel(hint?: string | null): boolean {
  return String(hint || "").toUpperCase() === "GROUND";
}

/** Floormap rooms already linked into a GA verblijfsgebied. */
function roomsForVg(vgId: string): RoomOpt[] {
  const out: RoomOpt[] = [];
  for (const [subId, link] of linkedBySub) {
    if (link.verblijfsgebied_id !== vgId) continue;
    const room = floormapRoomsById.get(subId);
    if (room) out.push(room);
  }
  return out;
}

function vgNrForVg(vgId: string, omschrijving?: string): number | null {
  const rooms = roomsForVg(vgId);
  const fromRoom = rooms.find((r) => r.vg_nr != null)?.vg_nr;
  if (fromRoom != null) return Number(fromRoom);
  return parseVgNrFromText(omschrijving || "");
}

function floorLevelForVg(vgId: string): string | null {
  const rooms = roomsForVg(vgId);
  if (!rooms.length) return null;
  return rooms[0].level_hint || null;
}

function vgDisplayTitle(g: Vg): string {
  const nr = vgNrForVg(g.verblijfsgebied_id, g.omschrijving);
  return nr != null ? vgLabelFromNr(nr) : g.omschrijving;
}

function sortByLabelAz<T>(items: T[], label: (item: T) => string): T[] {
  return items
    .slice()
    .sort((a, b) =>
      label(a).localeCompare(label(b), undefined, { sensitivity: "base", numeric: true }),
    );
}

/** Match GA VG to floormap vg_nr. */
function findVgIdForNr(vgNr: string | number): string | null {
  const n = Number(vgNr);
  if (!Number.isFinite(n)) return null;
  for (const g of vgs) {
    if (vgNrForVg(g.verblijfsgebied_id, g.omschrijving) === n) return g.verblijfsgebied_id;
  }
  return null;
}

function roomFromVr(vr: Vr): RoomOpt | null {
  return floormapRoomsById.get(vr.subsection_id) || null;
}

/** Compact VR line inside a VG (VG nr is already in the heading). */
function formatVrListLine(r: RoomOpt, volumeM3?: number): string {
  const bits = [
    r.vr_nr ? `VR ${r.vr_nr}` : null,
    r.label || null,
    levelLabel(r.level_hint),
    r.area_m2 != null ? `${Number(r.area_m2).toFixed(2)} m²` : null,
    volumeM3 != null ? `V=${Number(volumeM3).toFixed(1)} m³` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function formatRoomSummary(r: RoomOpt): string {
  const bits = [
    r.vg_nr != null ? `VG ${r.vg_nr}` : null,
    r.vr_nr ? `VR ${r.vr_nr}` : null,
    r.label || null,
    levelLabel(r.level_hint),
    r.area_m2 != null ? `${Number(r.area_m2).toFixed(2)} m²` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function labelsFromRoom(r: RoomOpt): { vgName: string; vrName: string } {
  if (r.vg_nr == null) {
    throw new Error("Deze plattegrondruimte heeft geen VG-nummer — vul VG/VR in op de plattegrond");
  }
  if (!r.vr_nr) {
    throw new Error("Deze plattegrondruimte heeft geen VR-nummer — vul VG/VR in op de plattegrond");
  }
  return {
    vgName: vgLabelFromNr(r.vg_nr),
    vrName: vrLabelFromNr(r.vr_nr, r.label),
  };
}

function selectedFreeRoom(): RoomOpt | null {
  const id = (vgRoomEl.value || "").trim();
  if (!id) return null;
  return freeRooms.find((r) => r.id === id) || floormapRoomsById.get(id) || null;
}

/** Free rooms that may be added to the currently selected VG (same floor + VG nr). */
function eligibleFreeRooms(): RoomOpt[] {
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

/** All free plattegrond rooms with VG/VR (for starting a new VG). */
function allFreeNumberedRooms(): RoomOpt[] {
  return freeRooms.filter((r) => r.vg_nr != null && r.vr_nr);
}

function roomFitsSelectedVg(room: RoomOpt | null): boolean {
  if (!room || !selectedVgId) return false;
  const floor = floorLevelForVg(selectedVgId);
  const vgNr = vgNrForVg(selectedVgId);
  if (floor && room.level_hint !== floor) return false;
  if (vgNr != null && room.vg_nr != null && Number(room.vg_nr) !== vgNr) return false;
  return true;
}

async function loadGeometryOptions(): Promise<void> {
  if (!buildingId || !auth) return;
  const sections = await apiGet<{
    sections: Array<{ id: string; label: string; region_kind: string }>;
  }>(`/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`);
  const rooms: RoomOpt[] = [];
  floormapRoomsById = new Map();
  for (const sec of sections.sections || []) {
    const kind = String(sec.region_kind || "").toUpperCase();
    const sub = await apiGet<{
      subsections: Array<{
        id: string;
        label: string;
        area_m2: number | null;
        vg_nr?: number | null;
        vr_nr?: string | null;
        level_hint?: string | null;
      }>;
    }>(`/api/floormap/subsections?section_id=${encodeURIComponent(sec.id)}`);
    for (const s of sub.subsections || []) {
      if (kind !== "FLOORMAP") continue;
      const opt: RoomOpt = {
        id: s.id,
        section_id: sec.id,
        label: s.label,
        area_m2: s.area_m2,
        region_kind: kind,
        section_label: sec.label || kind,
        vg_nr: s.vg_nr != null ? Number(s.vg_nr) : null,
        vr_nr: s.vr_nr != null && String(s.vr_nr).trim() ? String(s.vr_nr).trim() : null,
        level_hint: String(s.level_hint || "OTHER").toUpperCase(),
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

/** Disable add buttons when no eligible free rooms (or room doesn’t fit selected VG). */
function syncVrAddButtons(): void {
  const room = selectedFreeRoom();
  const anyFree = allFreeNumberedRooms().length > 0;
  vgNewBtn.disabled = !room;
  vgNewBtn.title = room
    ? "Maakt een nieuw verblijfsgebied met de gekozen ruimte als eerste VR"
    : anyFree
      ? "Kies eerst een vrije plattegrondruimte"
      : "Geen vrije plattegrondruimten met VG/VR-nummer meer";

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
    vrAddBtn.title = floor
      ? `Alleen ruimten op ${levelLabel(floor)}${vgNr != null ? ` met VG ${vgNr}` : ""} kunnen bij dit VG`
      : "Deze ruimte past niet bij het geselecteerde VG";
  } else {
    vrAddBtn.title = "Voegt de gekozen ruimte toe als extra VR in het geselecteerde VG";
  }
}

function fillRoomSelect(preferSubId?: string | null): void {
  const prev = preferSubId || vgRoomEl.value;
  vgRoomEl.innerHTML = "";
  // Always list all free numbered rooms so “Start nieuw VG” stays possible even when
  // the selected VG has no remaining same-floor rooms.
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

  const sortRooms = (items: RoomOpt[]) =>
    items
      .slice()
      .sort(
        (a, b) =>
          (a.vg_nr ?? 999) - (b.vg_nr ?? 999) ||
          String(a.vr_nr || "").localeCompare(String(b.vr_nr || ""), undefined, { numeric: true }),
      );

  const addGroup = (label: string, items: RoomOpt[]) => {
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
    const sameLabel = floor
      ? `Passend bij dit VG (${levelLabel(floor)}${vgNr != null ? ` · VG ${vgNr}` : ""})`
      : "Passend bij dit VG";
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

function materialGroupKey(f: VrFacadeOpt): string | null {
  if (!f.ga_ready) return null;
  const kind = f.quantity_kind === "length" ? "length" : "area";
  if (f.material_id) return `id:${f.material_id}|${kind}`;
  const name = (f.material_name || "").trim().toLowerCase();
  const cat = (f.master_category || "").trim().toLowerCase();
  if (!name && !cat) return null;
  const ra = f.ra_dba != null && Number.isFinite(f.ra_dba) ? String(f.ra_dba) : "";
  return `name:${cat}|${name}|${ra}|${kind}`;
}

type FacadePickGroup = {
  /** Option value = primary subsection id (for API / RA lookup). */
  primaryId: string;
  memberIds: string[];
  members: VrFacadeOpt[];
  quantity_kind: "area" | "length";
  area_m2: number | null;
  length_m: number | null;
  label: string;
  materialKey: string | null;
  ga_ready: boolean;
  used: boolean;
};

/** Same material (+ quantity kind) → one pick with summed S or l. */
function groupFacadesForPick(facades: VrFacadeOpt[], usedIds: Set<string>): FacadePickGroup[] {
  const usedKeys = new Set<string>();
  for (const id of usedIds) {
    const f = facades.find((x) => x.id === id);
    const key = f ? materialGroupKey(f) : null;
    if (key) usedKeys.add(key);
  }

  const groups = new Map<string, VrFacadeOpt[]>();
  const singles: VrFacadeOpt[] = [];
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

  const out: FacadePickGroup[] = [];

  const pushGroup = (members: VrFacadeOpt[], materialKey: string | null) => {
    const available = members.filter((m) => !usedIds.has(m.id));
    const pool = available.length ? available : members;
    const kind = pool[0].quantity_kind === "length" ? "length" : "area";
    let areaSum: number | null = null;
    let lenSum: number | null = null;
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
    const used =
      Boolean(materialKey && usedKeys.has(materialKey)) ||
      members.every((m) => usedIds.has(m.id));
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
      used,
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
    return (a.label || "").localeCompare(b.label || "", undefined, { sensitivity: "base" });
  });
  return out;
}

function formatFacadeGroupOption(g: FacadePickGroup): string {
  const f = g.members[0];
  const mat =
    f.master_category && f.material_name
      ? `${f.master_category}: ${f.material_name}`
      : f.material_name || f.master_category || null;
  const qty =
    g.quantity_kind === "length"
      ? g.length_m != null
        ? `l=${Number(g.length_m).toFixed(2)} m`
        : null
      : g.area_m2 != null
        ? `${Number(g.area_m2).toFixed(2)} m²`
        : null;
  const countBit = g.members.length > 1 ? `${g.members.length}×` : null;
  const bits = [
    g.members.length > 1 ? mat || g.label || "(zonder label)" : g.label || "(zonder label)",
    g.members.length > 1 ? null : mat,
    countBit,
    booleanOpShort(f.boolean_op),
    qty,
    g.members.length === 1 ? f.section_label || null : null,
    f.region_kind && f.region_kind !== "FACADE" ? f.region_kind : null,
    g.ga_ready ? null : "geen materiaal",
    g.used ? "al gekoppeld" : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function fillFacadeSelect(): void {
  const prev = vlakFacadeEl.value;
  const used = new Set(
    vlakken.map((v) => v.facade_subsection_id).filter((id): id is string => Boolean(id)),
  );
  vlakFacadeEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = vrFacades.length
    ? "— kies gevelcomponent voor deze VR —"
    : selectedVrId
      ? "— geen componenten voor deze VR —"
      : "— selecteer eerst een VR —";
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
    o.dataset.label =
      g.members.length > 1
        ? (g.members[0].material_name || g.label || "Vlak")
        : g.label || "";
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

function booleanOpShort(op?: string | null): string | null {
  if (op === "union") return "∪";
  if (op === "intersect") return "∩";
  if (op === "difference") return "−";
  return null;
}

function formatFacadeOption(f: VrFacadeOpt): string {
  return formatFacadeGroupOption({
    primaryId: f.id,
    memberIds: [f.id],
    members: [f],
    quantity_kind: f.quantity_kind === "length" ? "length" : "area",
    area_m2: f.area_m2,
    length_m: f.length_m,
    label: f.label,
    materialKey: materialGroupKey(f),
    ga_ready: f.ga_ready,
    used: false,
  });
}

function selectedVrNr(): string | null {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (!vr) return null;
  const room = roomFromVr(vr);
  if (room?.vr_nr) return room.vr_nr;
  const m = String(vr.omschrijving || "").match(/^VR\s+([^\s·]+)/i);
  return m ? m[1] : null;
}

async function loadFacadesForSelectedVr(): Promise<void> {
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
    const data = await apiGet<{
      eligible: Array<{
        id: string;
        label: string;
        section_label?: string;
        region_kind?: string;
        area_m2: number | null;
        quantity_kind?: string;
        length_m?: number | null;
        vg_nr?: number | null;
        vr_nr?: string | null;
        ga_ready?: boolean;
        material_name?: string | null;
        master_category?: string | null;
        material_id?: string | null;
        ra_dba?: number | null;
        boolean_op?: string | null;
      }>;
      counts?: { eligible?: number; ga_ready?: number; excluded_as_source?: number };
    }>(
      `/api/floormap/vr-components?building_id=${encodeURIComponent(buildingId)}&vr_nr=${encodeURIComponent(vrNr)}`,
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
      boolean_op: s.boolean_op || null,
    }));
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      const n = vrFacades.length;
      const ready = vrFacades.filter((f) => f.ga_ready).length;
      const excl = data.counts?.excluded_as_source ?? 0;
      const used = new Set(
        vlakken.map((v) => v.facade_subsection_id).filter((id): id is string => Boolean(id)),
      );
      const pickGroups = groupFacadesForPick(vrFacades, used);
      const merged = pickGroups.filter((g) => g.members.length > 1).length;
      const pickN = pickGroups.filter((g) => !g.used).length || pickGroups.length;
      vlakFacadeHintEl.textContent =
        n === 0
          ? `Geen gevelcomponenten voor VR ${vrNr}${excl ? ` (${excl} vervangen door zelfde-materiaal setbewerking)` : ""}.`
          : `VR ${vrNr}: ${n} component${n === 1 ? "" : "en"} · ${ready} met materiaal · ${pickN} keuz${pickN === 1 ? "e" : "es"}${merged ? ` (${merged}× zelfde materiaal opgeteld)` : ""}${excl ? ` · ${excl} vervangen (zelfde materiaal)` : ""}.`;
    }
  } catch (err) {
    vrFacades = [];
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      vlakFacadeHintEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}

function updateFacadeHint(): void {
  if (!vlakFacadePreviewEl) return;
  const opt = vlakFacadeEl.selectedOptions[0];
  const id = (vlakFacadeEl.value || "").trim();
  if (!opt || !id) {
    vlakFacadePreviewEl.textContent = "—";
    vlakFacadePreviewEl.classList.add("is-empty");
    return;
  }
  vlakFacadePreviewEl.textContent = opt.textContent || "—";
  vlakFacadePreviewEl.classList.remove("is-empty");
}

function updateRoomPreview(): void {
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

function syncVlakQtyUi(kind: "area" | "length", value?: string, fromFacade = false): void {
  const isLen = kind === "length";
  if (vlakQtyLabelEl) vlakQtyLabelEl.textContent = isLen ? "l [m]" : "S [m²]";
  vlakAreaEl.dataset.quantityKind = isLen ? "length" : "area";
  if (value != null && value !== "") vlakAreaEl.value = value;
  vlakAreaEl.readOnly = fromFacade;
  vlakAreaEl.title = fromFacade
    ? isLen
      ? "Lengte uit gevelcomponent (actueel van plattegrond/doorsnede)"
      : "Oppervlakte uit gevelcomponent (actueel van plattegrond/doorsnede)"
    : "";
}

function onFacadePick(forceName = false): void {
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
    true,
  );
  if (forceName || !vlakNameEl.value.trim()) {
    vlakNameEl.value = opt.dataset.label || "Vlak";
  }
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
    btn.textContent = `${v.omschrijving} · ${v.geluidsbelasting_dba} dB · ${v.spectrum_kind}`;
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

async function loadVgs(preferVgId?: string | null): Promise<void> {
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
  const data = parseJsonOk<{ verblijfsgebieden: Vg[] }>(ret);
  vgs = sortByLabelAz(data.verblijfsgebieden || [], vgDisplayTitle);
  await syncVgTitlesFromFloormap();
  vgs = sortByLabelAz(vgs, vgDisplayTitle);
  if (keepVg && vgs.some((g) => g.verblijfsgebied_id === keepVg)) selectedVgId = keepVg;
  else if (vgs.length) selectedVgId = vgs[0].verblijfsgebied_id;
  renderVgs();
  await loadVrs();
}

/** Rename stored VG labels to «VG n» when plattegrond rooms carry vg_nr. */
async function syncVgTitlesFromFloormap(): Promise<void> {
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
      String(g.sort_order ?? 0),
    ]);
    if (ret.startsWith("ERROR")) continue;
    g.omschrijving = want;
    changed = true;
  }
  if (changed) {
    // list counts may be unchanged; titles updated in memory
  }
}

function renderVgs(): void {
  vgListEl.innerHTML = "";
  if (!vgs.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nog geen verblijfsgebied — kies een plattegrondruimte met VG/VR en start een nieuw VG.";
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
    const n = g.vr_count === 1 ? "1 VR" : `${g.vr_count} VR’s`;
    const floorBit = floor ? ` · ${levelLabel(floor)}` : "";
    btn.textContent = `${title}${floorBit} · ${n}`;
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

function syncVrHeading(): void {
  const g = vgs.find((x) => x.verblijfsgebied_id === selectedVgId);
  if (vrHeadingEl) {
    if (!g) {
      vrHeadingEl.textContent = "Verblijfsruimten";
    } else {
      const title = vgDisplayTitle(g);
      const floor = floorLevelForVg(g.verblijfsgebied_id);
      vrHeadingEl.textContent = floor
        ? `Verblijfsruimten in ${title} (${levelLabel(floor)})`
        : `Verblijfsruimten in ${title}`;
    }
  }
  if (vrEmptyHintEl) {
    vrEmptyHintEl.classList.toggle("hidden", Boolean(selectedVgId));
    if (!selectedVgId) {
      vrEmptyHintEl.textContent = "Selecteer een verblijfsgebied hierboven om de VR’s te zien.";
    }
  }
}

async function loadVrs(preferVrId?: string | null): Promise<void> {
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
  const data = parseJsonOk<{ verblijfsruimten: Vr[] }>(ret);
  vrs = sortByLabelAz(data.verblijfsruimten || [], (r) => r.omschrijving || "");
  // Drop session “fresh” markers for VRs whose stored results were cleared server-side.
  for (const id of [...freshResultVrIds]) {
    const vr = vrs.find((r) => r.verblijfsruimte_id === id);
    if (!vr || (vr.ga_dba == null && vr.lbi_dba == null && vr.gak_dba == null)) {
      freshResultVrIds.delete(id);
    }
  }
  if (keepVr && vrs.some((r) => r.verblijfsruimte_id === keepVr)) selectedVrId = keepVr;
  else if (vrs.length) selectedVrId = vrs[0].verblijfsruimte_id;
  syncVrHeading();
  renderVrs();
  await loadVlakken();
}

function renderVrs(): void {
  vrListEl.innerHTML = "";
  if (!selectedVgId) {
    syncVrHeading();
    vrEditForm.classList.add("hidden");
    return;
  }
  if (!vrs.length) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = "Nog geen VR in dit VG — voeg een plattegrondruimte toe.";
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
    btn.title =
      r.verblijfsruimte_id === selectedVrId
        ? "Deze VR is geselecteerd (rood kader)"
        : "Selecteer deze VR";
    if (room) {
      const metrics = effectiveVrMetrics(r);
      btn.textContent = formatVrListLine(room, metrics.volume);
    } else {
      const metrics = effectiveVrMetrics(r);
      btn.textContent = `${r.omschrijving} · ${metrics.vloer.toFixed(2)} m² · V=${metrics.volume.toFixed(1)} m³`;
    }
    // Only show GA/Lbi/GA;k after a fresh calc this session (stored values are cleared when
    // plattegrond geometry changes; avoid showing outdated numbers from an earlier berekening).
    if (
      r.verblijfsruimte_id === selectedVrId &&
      (r.gak_dba != null || r.ga_dba != null) &&
      freshResultVrIds.has(r.verblijfsruimte_id)
    ) {
      const bits = [
        r.ga_dba != null ? `GA=${round1(r.ga_dba)}` : null,
        r.lbi_dba != null ? `Lbi=${round1(r.lbi_dba)}` : null,
        r.gak_dba != null ? `GA;k=${round1(r.gak_dba)}` : null,
      ].filter(Boolean);
      btn.textContent += ` · ${bits.join(" · ")}`;
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

function effectiveVrMetrics(r: Vr): { vloer: number; volume: number } {
  const room = roomFromVr(r);
  const hoogte = Number(r.hoogte_m) || 0;
  const liveFloor =
    room?.area_m2 != null && Number.isFinite(Number(room.area_m2)) ? Number(room.area_m2) : null;
  const vloer = liveFloor != null ? liveFloor : Number(r.vloer_m2) || 0;
  const volume =
    vloer > 0 && hoogte > 0 ? Math.round(vloer * hoogte * 100) / 100 : Number(r.volume_m3) || 0;
  return { vloer, volume };
}

/** Prefer live façade geometry (incl. same-material sum) over stored vlak snapshot. */
function liveVlakQty(v: Vlak): { kind: "area" | "length"; qty: number } {
  const kind = v.quantity_kind === "length" ? "length" : "area";
  const stored = kind === "length" ? Number(v.length_m ?? 0) : Number(v.area_m2 ?? 0);
  const facId = v.facade_subsection_id;
  if (!facId || !vrFacades.length) return { kind, qty: stored };
  const fac = vrFacades.find((f) => f.id === facId);
  if (!fac) return { kind, qty: stored };
  const key = materialGroupKey(fac);
  const peers = key ? vrFacades.filter((f) => materialGroupKey(f) === key) : [fac];
  if (kind === "length") {
    let sum = 0;
    let any = false;
    for (const p of peers) {
      if (p.length_m != null && Number.isFinite(Number(p.length_m))) {
        sum += Number(p.length_m);
        any = true;
      }
    }
    return { kind, qty: any ? Math.round(sum * 100) / 100 : stored };
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

function fillVrEdit(r: Vr): void {
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
  // Floor area comes from the floormap room; volume is always vloer × hoogte.
  vrEditVloerEl.readOnly = Boolean(room);
  vrEditVloerEl.title = room
    ? "Vloeroppervlak uit plattegrondruimte (actueel)"
    : "";
  vrEditVolumeEl.readOnly = true;
  vrEditVolumeEl.title = "Volume = vloer × hoogte";
  // Keep in-memory VR in sync so GA uses the live floor area.
  r.vloer_m2 = metrics.vloer;
  r.volume_m3 = metrics.volume;
  syncVrVolumeFromInputs();
}

function syncVrVolumeFromInputs(): void {
  const vloer = Number(vrEditVloerEl.value);
  const hoogte = Number(vrEditHoogteEl.value);
  if (vloer > 0 && hoogte > 0) {
    vrEditVolumeEl.value = (vloer * hoogte).toFixed(2);
  }
}

async function loadVlakken(): Promise<void> {
  vlakken = [];
  if (!selectedVrId || !auth) {
    renderVlakken();
    await loadFacadesForSelectedVr();
    return;
  }
  const ret = await invokeString("API_ListVlakken", [auth.token, selectedVrId]);
  const data = parseJsonOk<{ vlakken: Vlak[] }>(ret);
  vlakken = data.vlakken || [];
  await loadFacadesForSelectedVr();
  renderVlakken();
  const cur = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (cur) fillVrEdit(cur);
  await refreshVrCalc();
}

function fmtRes(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(round1(v)) : "—";
}

function clearVrResults(hint: string): void {
  if (vrResultsHintEl) {
    vrResultsHintEl.textContent = hint;
    vrResultsHintEl.classList.remove("hidden");
  }
  if (resSEl) resSEl.textContent = "—";
  if (resRpEl) resRpEl.textContent = "—";
  if (resDEl) resDEl.textContent = "—";
  if (resGaEl) resGaEl.textContent = "—";
  if (resLbiEl) resLbiEl.textContent = "—";
  if (resGakEl) resGakEl.textContent = "—";
}

async function refreshVrCalc(): Promise<void> {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  const variant = variants.find((v) => v.variant_id === selectedVariantId);
  if (!auth || !vr) {
    clearVrResults("Selecteer een VR en voeg vlakken met materiaal toe.");
    return;
  }
  if (!vlakken.length) {
    clearVrResults("Nog geen vlakken — voeg gevelcomponenten toe.");
    return;
  }

  const facadeById = new Map(vrFacades.map((f) => [f.id, f]));
  const calcVlakken = vlakken.map((v) => {
    const fac = v.facade_subsection_id ? facadeById.get(v.facade_subsection_id) : undefined;
    const live = liveVlakQty(v);
    return {
      label: v.omschrijving,
      ra_dba: fac?.ra_dba != null ? Number(fac.ra_dba) : NaN,
      quantity_kind: live.kind,
      area_m2: live.kind === "area" ? live.qty : null,
      length_m: live.kind === "length" ? live.qty : null,
      meenemen_gak: Boolean(v.meenemen_gak),
      cl_db: Number(v.cl_db) || 0,
      cg_db: Number(v.cg_db) || 0,
    };
  });

  const missingRa = calcVlakken.filter((v) => !Number.isFinite(v.ra_dba));
  if (missingRa.length) {
    clearVrResults(
      `Geen RA voor: ${missingRa.map((v) => v.label).join(", ")} — koppel materiaal op de plattegrond.`,
    );
    return;
  }

  const metrics = effectiveVrMetrics(vr);
  const result = computeVrGa({
    volume_m3: metrics.volume,
    t0_s: Number(vr.t0_s) || 0.5,
    geluidsbelasting_dba: Number(variant?.geluidsbelasting_dba ?? 0),
    vlakken: calcVlakken,
  });

  if (!result.ok) {
    clearVrResults(result.reason || "Berekening niet mogelijk.");
    return;
  }

  if (vrResultsHintEl) {
    vrResultsHintEl.textContent = `Cr=${result.cr_db} dB · CL=${round1(result.cl_db)} · Cg=${round1(result.cg_db)} · Ruimte=${fmtRes(result.ruimte_db)} dB`;
    vrResultsHintEl.classList.remove("hidden");
  }
  if (resSEl) {
    resSEl.textContent = `${fmtRes(result.s_m2)} / ${fmtRes(result.stot_m2)} m²`;
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

  // Persist on VR
  try {
    const ret = await invokeString("API_SaveVerblijfsruimteResults", [
      auth.token,
      vr.verblijfsruimte_id,
      result.ga_dba != null ? String(round1(result.ga_dba)) : "",
      result.lbi_dba != null ? String(round1(result.lbi_dba)) : "",
      result.gak_dba != null ? String(round1(result.gak_dba)) : "",
    ]);
    void ret;
  } catch {
    /* display still ok */
  }
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
    const live = liveVlakQty(v);
    const qtyTxt =
      live.kind === "length"
        ? `l=${live.qty.toFixed(2)} m`
        : `S=${live.qty.toFixed(2)} m²`;
    info.textContent = `${v.omschrijving} · ${qtyTxt} · GA;k=${v.meenemen_gak ? "ja" : "nee"}`;
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
  buildingMetaEl.textContent = `Project ${buildingId.slice(0, 8)}… · ${freeRooms.length} vrije rooms`;
  setConn("ok", "Connected");
  const url = new URL(location.href);
  url.searchParams.set("building_id", buildingId);
  history.replaceState(null, "", url.toString());
  await applyFloormapImport();
}

async function ensureDefaultVariant(): Promise<string> {
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
    "0",
  ]);
  const data = parseJsonOk<{ variant_id: string }>(ret);
  selectedVariantId = data.variant_id;
  await loadVariants();
  return selectedVariantId!;
}

function clearImportQueryParams(): void {
  pendingImportSubId = "";
  pendingImportVgNr = "";
  pendingImportVrNr = "";
  const url = new URL(location.href);
  url.searchParams.delete("subsection_id");
  url.searchParams.delete("vg_nr");
  url.searchParams.delete("vr_nr");
  history.replaceState(null, "", url.toString());
}

/**
 * From floormap «Open/Koppel berekening gevelwering»: take over VG/VR numbers
 * into the berekening sheet (select existing link, or create VG+VR / extra VR).
 */
async function applyFloormapImport(): Promise<void> {
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

  const room =
    freeRooms.find((r) => r.id === subId) ||
    null;
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
      vrT0El.value || "0.5",
    ]);
    const data = parseJsonOk<{ verblijfsruimte_id: string }>(ret);
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
      vrT0El.value || "0.5",
    ]);
    const data = parseJsonOk<{ verblijfsgebied_id: string; verblijfsruimte_id: string }>(ret);
    selectedVgId = data.verblijfsgebied_id;
    selectedVrId = data.verblijfsruimte_id;
    await refreshLinks();
    await loadGeometryOptions();
    await loadVgs(data.verblijfsgebied_id);
    await loadVrs(data.verblijfsruimte_id);
    setConn("ok", `VG/VR overgenomen: ${vgName} · ${vrName}`);
  }
  clearImportQueryParams();
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

async function createVgFromSelectedRoom(): Promise<void> {
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
    vrT0El.value || "0.5",
  ]);
  const data = parseJsonOk<{ verblijfsgebied_id: string; verblijfsruimte_id: string }>(ret);
  selectedVgId = data.verblijfsgebied_id;
  selectedVrId = data.verblijfsruimte_id;
  await refreshLinks();
  await loadGeometryOptions();
  await loadVgs(data.verblijfsgebied_id);
  await loadVrs(data.verblijfsruimte_id);
  setConn("ok", `Nieuw ${vgName} met ${vrName}`);
}

async function addVrToSelectedVg(): Promise<void> {
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
    vrT0El.value || "0.5",
  ]);
  const data = parseJsonOk<{ verblijfsruimte_id: string }>(ret);
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
      "0",
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
    const opt = vlakFacadeEl.selectedOptions[0];
    const isLen =
      (opt?.dataset.quantityKind || vlakAreaEl.dataset.quantityKind) === "length";
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
      isLen ? qty : "",
    ]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    vlakNameEl.value = "";
    await loadVlakken();
    setConn("ok", "Vlak toegevoegd");
  })().catch((e) => setConn("err", String(e)));
});

function setCustomMatPanelOpen(open: boolean): void {
  if (!customMatPanelEl) return;
  customMatPanelEl.classList.toggle("hidden", !open);
  if (open) void ensureCustomMatRubrieken();
}

async function ensureCustomMatRubrieken(): Promise<void> {
  if (!customMatRubriekEl || !auth || customMatRubriekEl.options.length > 1) return;
  const data = await apiGet<{
    categories: Array<{ rubriek_nr: number | null; label: string; master_category: string }>;
  }>("/api/floormap/material-categories");
  customMatRubriekEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— kies rubriek —";
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

    setConn("busy", "Eigen materiaal opslaan…");
    const data = await apiPost<{
      material: { material_id: string; name: string; ra_dba: number; catalog_id: string };
      assigned: boolean;
    }>("/api/floormap/materials", {
      name,
      ra_dba: ra,
      rubriek_nr: rubriek,
      subsection_id: fac,
    });

    setCustomMatPanelOpen(false);
    if (customMatNameEl) customMatNameEl.value = "";
    await loadFacadesForSelectedVr();
    // Keep the same façade selected after refresh.
    if ([...vlakFacadeEl.options].some((o) => o.value === fac)) {
      vlakFacadeEl.value = fac;
      onFacadePick(false);
    }
    setConn(
      "ok",
      data.assigned
        ? `Materiaal «${data.material.name}» gekoppeld (RA ${data.material.ra_dba}) — voeg nu het vlak toe`
        : `Materiaal «${data.material.name}» opgeslagen`,
    );
  })().catch((e) => setConn("err", String(e)));
});

if (buildingId) buildingIdEl.value = buildingId;
syncFloormapLink();
initPasswordToggles();
connect();
