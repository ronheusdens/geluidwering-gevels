/**
 * Section drawing analysis workspace — engineer-only.
 * Crop viewer, scale calibrate, polyline discovery review, saved rooms/components.
 * Works for FLOORMAP, FACADE, SECTION, and CROSS_SECTION.
 */
import {
  closeRing,
  ensureEditablePolyline,
  metresPerNormFromPaperScale,
  parseScaleRatioFromText,
  removeRingVertex,
  ringVertexCount,
  shoelaceArea,
  simplifyEditableRing,
  translateRing,
  type Pt,
} from "./geom";
import { discoverRoomPolylines, pixelsToSectionNorm } from "./room-discover";
import { loadAuth, storeAuth as persistAuth, syncSessionCookie, apiAuthHeaders } from "./auth-store";
import { resolveBppWsUrl } from "./ws-url";

type Envelope = {
  v: number;
  type: string;
  request_id: string;
  session_id?: string;
  payload?: Record<string, unknown>;
};

type AuthInfo = {
  token: string;
  username: string;
  display_name: string;
};

type RegionKind = "FACADE" | "SECTION" | "FLOORMAP" | "CROSS_SECTION" | "OTHER";

type FloormapSection = {
  id: string;
  document_id: string;
  page_index: number;
  label: string;
  region_kind: RegionKind;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  scale_ratio: number | null;
  metres_per_norm_unit: number | null;
  scale_source: string;
  room_count: number;
};

type RoomSubsection = {
  id: string;
  section_id: string;
  label: string;
  level_hint: string;
  points: Pt[];
  area_norm: number | null;
  perimeter_norm: number | null;
  area_m2: number | null;
  perimeter_m: number | null;
  /** Scale snapshot stored with the room (metres per section-local unit). */
  metres_per_norm_unit: number | null;
  analysis_status: string;
};

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDocument> };
    };
  }
}

type PdfDocument = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
};

type PdfPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (ctx: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
    promise: Promise<void>;
  };
  getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[] }> }>;
};

const params = new URLSearchParams(location.search);
const BPP_WS = resolveBppWsUrl();

const AUTH_KEY = "acoustics_engineer_auth";
const URL_BUILDING = params.get("building_id") || "";
const URL_SECTION = params.get("section_id") || "";

const connBarEl = document.getElementById("fm-conn-bar") as HTMLElement;
const connLedEl = document.getElementById("fm-conn-led") as HTMLElement;
const connStatusEl = document.getElementById("fm-conn-status") as HTMLElement;
const loginPanelEl = document.getElementById("fm-login-panel") as HTMLElement;
const loginForm = document.getElementById("fm-login-form") as HTMLFormElement;
const panelEl = document.getElementById("fm-panel") as HTMLElement;
const userLabelEl = document.getElementById("fm-user-label") as HTMLElement;
const logoutBtn = document.getElementById("fm-logout-btn") as HTMLButtonElement;
const buildingInput = document.getElementById("fm-building-input") as HTMLInputElement;
const loadBuildingBtn = document.getElementById("fm-load-building-btn") as HTMLButtonElement;
const sectionListEl = document.getElementById("fm-section-list") as HTMLElement;
const pickerPanelEl = document.getElementById("fm-picker-panel") as HTMLElement;
const workspacePanelEl = document.getElementById("fm-workspace-panel") as HTMLElement;
const sectionTitleEl = document.getElementById("fm-section-title") as HTMLElement;
const sectionMetaEl = document.getElementById("fm-section-meta") as HTMLElement;
const backPickerBtn = document.getElementById("fm-back-picker-btn") as HTMLButtonElement;
const pdfCanvas = document.getElementById("fm-pdf-canvas") as HTMLCanvasElement;
const overlayCanvas = document.getElementById("fm-overlay-canvas") as HTMLCanvasElement;
const pdfScrollEl = document.getElementById("fm-pdf-scroll") as HTMLElement;
const zoomOutBtn = document.getElementById("fm-zoom-out") as HTMLButtonElement;
const zoomInBtn = document.getElementById("fm-zoom-in") as HTMLButtonElement;
const zoomBtn = document.getElementById("fm-zoom-btn") as HTMLButtonElement;
const zoomFitBtn = document.getElementById("fm-zoom-fit") as HTMLButtonElement;
const zoomLabelEl = document.getElementById("fm-zoom-label") as HTMLElement;
const discoverBtn = document.getElementById("fm-discover-btn") as HTMLButtonElement;
const calibrateBtn = document.getElementById("fm-calibrate-btn") as HTMLButtonElement;
const scaleStatusEl = document.getElementById("fm-scale-status") as HTMLElement;
const calibrateMetresWrap = document.getElementById("fm-calibrate-metres-wrap") as HTMLElement;
const calibrateMetresInput = document.getElementById("fm-calibrate-metres") as HTMLInputElement;
const calibrateApplyBtn = document.getElementById("fm-calibrate-apply-btn") as HTMLButtonElement;
const calibrateRepickBtn = document.getElementById("fm-calibrate-repick-btn") as HTMLButtonElement;
const calibrateHintEl = document.getElementById("fm-calibrate-hint") as HTMLElement;
const toolClearBtn = document.getElementById("fm-tool-clear-btn") as HTMLButtonElement | null;
const toolHintEl = document.getElementById("fm-tool-hint") as HTMLElement;
const toolLengthMmEl = document.getElementById("fm-tool-length-mm") as HTMLInputElement;
const toolCircMmEl = document.getElementById("fm-tool-circ-mm") as HTMLInputElement;
const toolAreaMm2El = document.getElementById("fm-tool-area-mm2") as HTMLInputElement;
const roomLabelInput = document.getElementById("fm-room-label") as HTMLInputElement;
const roomLevelSelect = document.getElementById("fm-room-level") as HTMLSelectElement;
const roomPendingHintEl = document.getElementById("fm-room-pending-hint") as HTMLElement;
const roomDrawBtn = document.getElementById("fm-room-draw-btn") as HTMLButtonElement;
const roomCloseBtn = document.getElementById("fm-room-close-btn") as HTMLButtonElement;
const roomSimplifyBtn = document.getElementById("fm-room-simplify-btn") as HTMLButtonElement | null;
const roomSaveBtn = document.getElementById("fm-room-save-btn") as HTMLButtonElement;
const roomClearBtn = document.getElementById("fm-room-clear-btn") as HTMLButtonElement;
const discoverBtnSide = document.getElementById("fm-discover-btn-side") as HTMLButtonElement | null;
const discoveryDockEl = document.getElementById("fm-discovery-dock") as HTMLElement;
const discoveryProgressEl = document.getElementById("fm-discovery-progress") as HTMLElement;
const discoveryHintEl = document.getElementById("fm-discovery-hint") as HTMLElement;
const discoveryLabelInput = document.getElementById("fm-discovery-label") as HTMLInputElement;
const discoveryLevelSelect = document.getElementById("fm-discovery-level") as HTMLSelectElement;
const discoveryAcceptBtn = document.getElementById("fm-discovery-accept") as HTMLButtonElement;
const discoverySkipBtn = document.getElementById("fm-discovery-skip") as HTMLButtonElement;
const discoveryCancelBtn = document.getElementById("fm-discovery-cancel") as HTMLButtonElement;
const discoverySimplifyBtn = document.getElementById("fm-discovery-simplify") as HTMLButtonElement | null;
const nudgeLeftBtn = document.getElementById("fm-nudge-left") as HTMLButtonElement;
const nudgeRightBtn = document.getElementById("fm-nudge-right") as HTMLButtonElement;
const nudgeUpBtn = document.getElementById("fm-nudge-up") as HTMLButtonElement;
const nudgeDownBtn = document.getElementById("fm-nudge-down") as HTMLButtonElement;
const roomCountEl = document.getElementById("fm-room-count") as HTMLElement;
const roomsHintEl = document.getElementById("fm-rooms-hint") as HTMLElement;
const roomListEl = document.getElementById("fm-room-list") as HTMLUListElement;
const gaLinkEl = document.getElementById("fm-ga-link") as HTMLAnchorElement | null;
const markRoomLegendEl = document.querySelector("#fm-mark-room-fieldset legend") as HTMLElement | null;
const savedRoomsHeadingEl = document.querySelector(".saved-sections-block h3") as HTMLElement | null;
const pickerHeadingEl = document.querySelector("#fm-picker-panel h2") as HTMLElement | null;
const pickerHintEl = document.querySelector("#fm-picker-panel > .hint") as HTMLElement | null;
const pageTitleEl = document.querySelector("h1") as HTMLElement | null;

function partNoun(kind?: string | null): { singular: string; plural: string; title: string; kindLabel: string } {
  const k = String(kind || "FLOORMAP").toUpperCase();
  if (k === "FLOORMAP") {
    return { singular: "room", plural: "rooms", title: "Floormap", kindLabel: "Floormap" };
  }
  if (k === "FACADE") {
    return { singular: "component", plural: "components", title: "Façade", kindLabel: "Façade" };
  }
  if (k === "CROSS_SECTION") {
    return {
      singular: "component",
      plural: "components",
      title: "Cross-section",
      kindLabel: "Cross-section",
    };
  }
  if (k === "SECTION") {
    return {
      singular: "component",
      plural: "components",
      title: "Building section",
      kindLabel: "Building section",
    };
  }
  return { singular: "component", plural: "components", title: "Drawing", kindLabel: "Drawing" };
}

function activePartNoun() {
  return partNoun(activeSection?.region_kind);
}

/** Keep toolbar / sidebar copy in sync with floormap vs façade/section. */
function syncWorkspaceLabels(kind?: string | null): void {
  const n = partNoun(kind ?? activeSection?.region_kind);
  const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
  if (pageTitleEl) pageTitleEl.textContent = `${n.title} analysis`;
  if (pickerHeadingEl) pickerHeadingEl.textContent = "Scalable sections";
  if (pickerHintEl) {
    pickerHintEl.textContent =
      "Pick a floormap, façade, or section to measure and mark components (same workflow for each).";
  }
  if (loadBuildingBtn) loadBuildingBtn.textContent = "Load sections";
  if (backPickerBtn) backPickerBtn.textContent = "All sections";
  discoverBtn.textContent = `Discover ${n.plural}`;
  if (discoverBtnSide) discoverBtnSide.textContent = `Discover ${n.plural}`;
  if (markRoomLegendEl) markRoomLegendEl.textContent = cap;
  roomDrawBtn.textContent = `Draw ${n.singular}`;
  roomSaveBtn.textContent = `Save ${n.singular}`;
  roomLabelInput.placeholder =
    n.singular === "room" ? "e.g. slaapkamer 1" : "e.g. window band / panel";
  roomPendingHintEl.textContent = `Use Draw ${n.singular} in Tools, click vertices, then Close & save. Double-click an anchor to remove it; Simplify thins the outline.`;
  if (savedRoomsHeadingEl) {
    savedRoomsHeadingEl.replaceChildren(
      document.createTextNode(`Saved ${n.plural} `),
      roomCountEl,
    );
  }
  roomsHintEl.textContent = `Each ${n.singular} shows area (m²) and circumference (m) when scale is set.`;
}

let ws: WebSocket | null = null;
let sessionId: string | null = null;
let auth: AuthInfo | null = null;
let reqCounter = 0;
const pending = new Map<string, { resolve: (env: Envelope) => void; reject: (err: Error) => void; want: string }>();

let buildingId = URL_BUILDING;
let sections: FloormapSection[] = [];
let activeSection: FloormapSection | null = null;
let rooms: RoomSubsection[] = [];
/** subsection_id → VR omschrijving when linked in GA model */
let linkedRooms = new Map<string, string>();
let pdfDoc: PdfDocument | null = null;
/** Cropped floormap bitmap at base resolution (before display zoom). */
let cropBitmap: HTMLCanvasElement | null = null;
let cropWidthPdfPts = 0;
let canvasWidth = 0;
let canvasHeight = 0;
let viewZoom = 1.0;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

type DiscoveryState = {
  candidates: Pt[][];
  index: number;
  current: Pt[];
  dragVertex: number | null;
};
let discovery: DiscoveryState | null = null;

type CalibrateState = {
  points: Pt[];
};
let calibrate: CalibrateState | null = null;

type MeasureTool = "off" | "length";
type ToolMode = "off" | "length" | "room";
type MeasureState = {
  tool: MeasureTool;
  /** Section-local 0–1 points. */
  points: Pt[];
  cursor: Pt | null;
};
let measure: MeasureState = { tool: "off", points: [], cursor: null };

/** Manual room mark / edit (section-local 0–1). */
type PendingRoom = {
  points: Pt[];
  closed: boolean;
  editingId: string | null;
  dragVertex: number | null;
  drawing: boolean;
};
let pendingRoom: PendingRoom | null = null;

function setStatus(text: string, kind: "busy" | "ok" | "err" = "busy"): void {
  connStatusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}

function setConnLed(connected: boolean): void {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}

function nextRequestId(prefix: string): string {
  reqCounter += 1;
  return `${prefix}_${reqCounter}_${Date.now()}`;
}

function storeAuth(info: AuthInfo | null): void {
  persistAuth(AUTH_KEY, info);
  void syncSessionCookie(info?.token ?? null);
}

function loadStoredAuth(): AuthInfo | null {
  return loadAuth(AUTH_KEY);
}

function showLogin(): void {
  auth = null;
  storeAuth(null);
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
}

function showPanel(info: AuthInfo): void {
  auth = info;
  storeAuth(info);
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Signed in as ${info.display_name || info.username}`;
}

function send(type: string, payload: Record<string, unknown>, wantType: string): Promise<Envelope> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
  }
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

async function bootstrapAndLogin(username: string, password: string): Promise<void> {
  await loadSharedApi();
  const ret = await invokeString("API_Login", [username, password]);
  if (ret.startsWith("ERROR")) throw new Error(ret);
  const parsed = JSON.parse(ret) as {
    ok?: boolean;
    token?: string;
    username?: string;
    display_name?: string;
  };
  if (!parsed.ok || !parsed.token) throw new Error("Login failed");
  showPanel({
    token: parsed.token,
    username: parsed.username || username,
    display_name: parsed.display_name || username,
  });
}

function authHeaders(): HeadersInit {
  return apiAuthHeaders(auth!.token, true);
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: apiAuthHeaders(auth!.token),
  });
  const body = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return body;
}

async function apiPost<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return body;
}

async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers: apiAuthHeaders(auth!.token),
  });
  const body = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return body;
}

function updateScaleUi(): void {
  const n = activePartNoun();
  if (!activeSection) {
    scaleStatusEl.textContent = "Not set";
    calibrateHintEl.textContent = "Click Calibrate scale when you are ready.";
    roomsHintEl.textContent = `Set drawing scale to get ${n.singular} areas in m².`;
    return;
  }
  const mpu = activeSection.metres_per_norm_unit;
  const ratio = activeSection.scale_ratio;
  const src = (activeSection.scale_source || "NONE").toUpperCase();
  if (mpu != null && mpu > 0) {
    if (ratio != null && ratio > 0) {
      const from = src === "PDF_TEXT" ? " (from drawing text)" : src === "CALIBRATED" ? " (calibrated)" : "";
      scaleStatusEl.textContent = `Paper scale 1:${ratio}${from}`;
    } else {
      scaleStatusEl.textContent =
        src === "CALIBRATED"
          ? "Scale set from marked length"
          : `Scale set — ${n.singular} sizes in m² / m`;
    }
    calibrateHintEl.textContent = `Scale is ready. Use Length to check a distance, or Draw ${n.singular} — circ/area update from the polygon.`;
    roomsHintEl.textContent = `${n.singular.charAt(0).toUpperCase() + n.singular.slice(1)} area (m²) and perimeter (m) use this scale.`;
    calibrateBtn.textContent = "Recalibrate scale";
  } else {
    scaleStatusEl.textContent = "Not set — mark a known length, or use detected 1:N";
    calibrateHintEl.textContent = "Click Calibrate scale, mark two points, then enter that length in mm.";
    roomsHintEl.textContent = "Without scale, only relative sizes are shown.";
    calibrateBtn.textContent = "Calibrate scale";
  }
  updateToolHint();
}

function activeScaleMpu(): number | null {
  const mpu = activeSection?.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0)) return null;
  return mpu;
}

function fmtMeasure(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function pathLengthM(pts: Pt[], mpu: number, closed: boolean): number {
  if (pts.length < 2) return 0;
  let sum = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y) * mpu;
  }
  return sum;
}

function pathAreaM2(pts: Pt[], mpu: number): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return (Math.abs(sum) / 2) * mpu * mpu;
}

function measureDisplayPoints(): Pt[] {
  const pts = measure.points.slice();
  if (measure.cursor && measure.tool === "length" && pts.length === 1) {
    pts.push(measure.cursor);
  }
  return pts;
}

function ringForMetrics(): { pts: Pt[]; closed: boolean } | null {
  if (pendingRoom && pendingRoom.points.length >= 2) {
    return { pts: pendingRoom.points, closed: pendingRoom.closed };
  }
  if (discovery?.current && discovery.current.length >= 2) {
    return { pts: discovery.current, closed: true };
  }
  return null;
}

function updateMeasureReadouts(): void {
  const mpu = activeScaleMpu();
  if (!mpu) {
    toolLengthMmEl.value = "—";
    toolCircMmEl.value = "—";
    toolAreaMm2El.value = "—";
    return;
  }

  if (measure.tool === "length") {
    const display = measureDisplayPoints();
    toolLengthMmEl.value =
      display.length >= 2 ? fmtMeasure(pathLengthM(display.slice(0, 2), mpu, false), 2) : "—";
  } else {
    toolLengthMmEl.value = "—";
  }

  const ring = ringForMetrics();
  if (ring) {
    toolCircMmEl.value = fmtMeasure(pathLengthM(ring.pts, mpu, ring.closed), 2);
    // Area for closed rooms, or provisional (as-if-closed) while drawing ≥3 vertices
    toolAreaMm2El.value =
      ring.pts.length >= 3 ? fmtMeasure(pathAreaM2(ring.pts, mpu), 2) : "—";
  } else {
    toolCircMmEl.value = "—";
    toolAreaMm2El.value = "—";
  }
}

function updateToolHint(): void {
  if (!toolHintEl) return;
  const n = activePartNoun();
  if (!activeScaleMpu()) {
    toolHintEl.textContent = `Set scale first, then measure a length or draw a ${n.singular}.`;
    return;
  }
  if (pendingRoom?.drawing && !pendingRoom.closed) {
    toolHintEl.textContent =
      pendingRoom.points.length === 0
        ? `Click ${n.singular} corners. Circumference updates as you go; area after 3 points.`
        : `${pendingRoom.points.length} vertex(es). Close polygon (≥3) or click near start.`;
    return;
  }
  if (pendingRoom?.closed) {
    toolHintEl.textContent = `${n.singular.charAt(0).toUpperCase() + n.singular.slice(1)} polygon ready — circ/area shown. Drag vertices or Save ${n.singular}.`;
    return;
  }
  if (measure.tool === "length") {
    toolHintEl.textContent =
      measure.points.length < 2
        ? "Click two points to measure length (updates live while moving)."
        : "Length ready. Clear or click again to start over.";
    return;
  }
  toolHintEl.textContent = `Choose Length or Draw ${n.singular}. Circumference and area come from the polygon.`;
}

function activeToolMode(): ToolMode {
  if (pendingRoom?.drawing || pendingRoom?.closed) return "room";
  if (measure.tool === "length") return "length";
  return "off";
}

function syncToolButtons(): void {
  const mode = activeToolMode();
  const n = activePartNoun();
  document.querySelectorAll<HTMLButtonElement>(".tool-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn.dataset.tool || "off") === mode);
    if (btn.dataset.tool === "room") btn.textContent = `Draw ${n.singular}`;
  });
}

function clearMeasure(keepTool = true): void {
  measure = {
    tool: keepTool ? measure.tool : "off",
    points: [],
    cursor: null,
  };
  if (!keepTool) syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
}

function setMeasureTool(tool: ToolMode): void {
  if (tool === "room") {
    if (pendingRoom?.drawing) {
      syncToolButtons();
      updateToolHint();
      return;
    }
    beginDrawRoom();
    return;
  }

  if (tool !== "off") {
    if (calibrate) endCalibrate();
    if (discovery) {
      setStatus("Finish or cancel room discovery before measuring", "err");
      syncToolButtons();
      return;
    }
    if (!activeScaleMpu()) {
      setStatus("Set scale first", "err");
      measure.tool = "off";
      syncToolButtons();
      updateToolHint();
      return;
    }
  }

  if (pendingRoom) clearPendingRoom();
  measure = { tool: tool === "length" ? "length" : "off", points: [], cursor: null };
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
  if (tool === "length") setStatus("Measure length: click two points", "busy");
}

function renderSectionList(): void {
  sectionListEl.innerHTML = "";
  if (sections.length === 0) {
    sectionListEl.innerHTML = `<p class="hint">No scalable sections (floormap / façade / section) for this project.</p>`;
    return;
  }
  for (const s of sections) {
    const card = document.createElement("article");
    card.className = "admin-project-card panel";
    const n = partNoun(s.region_kind);
    const scale =
      s.metres_per_norm_unit != null && s.metres_per_norm_unit > 0
        ? `scale set (${s.scale_source})`
        : "no scale";
    card.innerHTML = `
      <h3>${s.label || n.title}</h3>
      <p class="hint">${n.kindLabel} · page ${s.page_index + 1} · ${s.room_count} ${n.singular}(s) · ${scale}</p>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `Open ${n.title.toLowerCase()}`;
    btn.addEventListener("click", () => {
      void openSection(s.id);
    });
    card.appendChild(btn);
    sectionListEl.appendChild(card);
  }
}

function roomMetricsLabel(r: RoomSubsection): string {
  const mpu =
    r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0
      ? r.metres_per_norm_unit
      : activeScaleMpu();
  let area = "—";
  let circ = "—";
  if (r.area_m2 != null && Number.isFinite(r.area_m2)) area = `${r.area_m2.toFixed(2)} m²`;
  else if (r.area_norm != null && mpu) area = `${(r.area_norm * mpu * mpu).toFixed(2)} m²`;
  else if (r.area_norm != null) area = `${r.area_norm.toFixed(4)} (no scale)`;

  if (r.perimeter_m != null && Number.isFinite(r.perimeter_m)) circ = `${r.perimeter_m.toFixed(2)} m`;
  else if (r.perimeter_norm != null && mpu) circ = `${(r.perimeter_norm * mpu).toFixed(2)} m`;
  else if (r.perimeter_norm != null) circ = `${r.perimeter_norm.toFixed(4)} (no scale)`;

  return `${area} · circ ${circ}`;
}

function syncPendingRoomButtons(): void {
  const n = activePartNoun();
  const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
  const has = Boolean(pendingRoom && pendingRoom.points.length > 0);
  const closed = Boolean(pendingRoom?.closed);
  roomCloseBtn.disabled = !(pendingRoom?.drawing && pendingRoom.points.length >= 3 && !closed);
  roomSaveBtn.disabled = !(closed && pendingRoom && pendingRoom.points.length >= 3);
  roomClearBtn.disabled = !has && !pendingRoom?.drawing;
  if (roomSimplifyBtn) {
    roomSimplifyBtn.disabled = !(closed && pendingRoom && ringVertexCount(pendingRoom.points) > 3);
  }
  if (!pendingRoom) {
    roomPendingHintEl.textContent = `Use Draw ${n.singular} (Tools or here), then click vertices. Double-click an anchor to remove; Simplify thins the outline.`;
    roomDrawBtn.textContent = `Draw ${n.singular}`;
    return;
  }
  if (pendingRoom.drawing && !pendingRoom.closed) {
    roomPendingHintEl.textContent = `${pendingRoom.points.length} vertex(es). Circ/area update above; Close polygon when ready (≥3).`;
    roomDrawBtn.textContent = "Cancel draw";
  } else if (pendingRoom.closed) {
    roomPendingHintEl.textContent = pendingRoom.editingId
      ? "Editing — drag anchors, double-click to remove, Simplify to thin, then Save."
      : "Polygon ready — double-click anchors to remove extras, or Simplify, then Save.";
    roomDrawBtn.textContent = `Draw ${n.singular}`;
  }
  roomSaveBtn.textContent = `Save ${n.singular}`;
  if (markRoomLegendEl) markRoomLegendEl.textContent = cap;
}

function clearPendingRoom(): void {
  pendingRoom = null;
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
  drawOverlay();
}

function beginDrawRoom(): void {
  endDiscovery();
  endCalibrate();
  if (measure.tool !== "off") clearMeasure(false);
  pendingRoom = {
    points: [],
    closed: false,
    editingId: null,
    dragVertex: null,
    drawing: true,
  };
  roomLabelInput.value = `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  setStatus("Click room corners on the plan", "busy");
  drawOverlay();
}

function startDrawRoom(): void {
  if (pendingRoom?.drawing) {
    clearPendingRoom();
    setStatus("Draw cancelled", "ok");
    return;
  }
  beginDrawRoom();
}

function closePendingPolygon(): void {
  if (!pendingRoom || pendingRoom.points.length < 3) return;
  pendingRoom.points = closeRing(pendingRoom.points);
  pendingRoom.closed = true;
  pendingRoom.drawing = false;
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  setStatus(`Polygon closed — Save ${activePartNoun().singular} when ready`, "ok");
  drawOverlay();
}

async function savePendingRoom(): Promise<void> {
  if (!pendingRoom?.closed || !activeSection || !auth) return;
  const points = closeRing(pendingRoom.points);
  if (shoelaceArea(points) < 1e-8) {
    setStatus("Room too small", "err");
    return;
  }
  const label =
    roomLabelInput.value.trim() ||
    `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  const level = roomLevelSelect.value || "OTHER";
  roomSaveBtn.disabled = true;
  setStatus("Saving room…", "busy");
  try {
    const mpu = activeScaleMpu();
    await apiPost("/api/floormap/subsections", {
      section_id: activeSection.id,
      subsection_id: pendingRoom.editingId || undefined,
      label,
      level_hint: level,
      points,
      metres_per_norm_unit: mpu ?? undefined,
    });
    clearPendingRoom();
    await loadRooms();
    setStatus(`Saved ${label}`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncPendingRoomButtons();
  }
}

function editRoom(room: RoomSubsection): void {
  endDiscovery();
  endCalibrate();
  if (measure.tool !== "off") clearMeasure(false);
  if (
    activeSection &&
    !(activeSection.metres_per_norm_unit != null && activeSection.metres_per_norm_unit > 0) &&
    room.metres_per_norm_unit != null &&
    room.metres_per_norm_unit > 0
  ) {
    activeSection.metres_per_norm_unit = room.metres_per_norm_unit;
    if (!activeSection.scale_source || activeSection.scale_source === "NONE") {
      activeSection.scale_source = "CALIBRATED";
    }
    updateScaleUi();
  }
  pendingRoom = {
    points: closeRing(room.points.map((p) => ({ ...p }))),
    closed: true,
    editingId: room.id,
    dragVertex: null,
    drawing: false,
  };
  roomLabelInput.value = room.label;
  roomLevelSelect.value = room.level_hint || "OTHER";
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
  const selectedLi = roomListEl.querySelector(".drawing-list-item.selected");
  selectedLi?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  scrollToRing(pendingRoom.points);
  setStatus(`Editing ${room.label}`, "ok");
  drawOverlay();
}

function fmtArea(r: RoomSubsection): string {
  return roomMetricsLabel(r);
}

function fmtPerim(_r: RoomSubsection): string {
  return "";
}

function renderRoomList(): void {
  roomListEl.innerHTML = "";
  roomCountEl.textContent = String(rooms.length);
  if (rooms.length === 0) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = `No ${activePartNoun().plural} saved yet — Draw ${activePartNoun().singular} or Discover.`;
    roomListEl.appendChild(li);
    return;
  }
  for (const r of rooms) {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (pendingRoom?.editingId === r.id) li.classList.add("selected");
    const info = document.createElement("button");
    info.type = "button";
    info.className = "drawing-list-select";
    const linked = linkedRooms.get(r.id);
    const linkBit =
      activeSection?.region_kind === "FLOORMAP" && linked
        ? ` · VR: ${linked}`
        : activeSection?.region_kind === "FLOORMAP"
          ? " · niet in GA"
          : "";
    info.textContent = `${r.label} · ${r.level_hint} · ${roomMetricsLabel(r)}${linkBit}`;
    info.addEventListener("click", () => editRoom(r));
    li.appendChild(info);
    const actions = document.createElement("span");
    actions.className = "drawing-list-actions";
    if (activeSection?.region_kind === "FLOORMAP" && buildingId) {
      const ga = document.createElement("a");
      ga.className = "secondary-link";
      ga.href = `/ga.html?building_id=${encodeURIComponent(buildingId)}`;
      ga.textContent = linked ? "Open GA" : "Koppel in GA";
      actions.appendChild(ga);
    }
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editRoom(r));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      void deleteRoom(r.id);
    });
    actions.appendChild(editBtn);
    actions.appendChild(btn);
    li.appendChild(actions);
    roomListEl.appendChild(li);
  }
}

async function refreshLinkedRooms(): Promise<void> {
  linkedRooms = new Map();
  if (!auth?.token || !buildingId) return;
  try {
    const ret = await invokeString("API_ListLinkedSubsections", [auth.token, buildingId]);
    if (ret.startsWith("ERROR")) return;
    const data = JSON.parse(ret) as {
      links?: Array<{ subsection_id: string; omschrijving: string }>;
    };
    for (const l of data.links || []) {
      linkedRooms.set(l.subsection_id, l.omschrijving);
    }
  } catch {
    // optional overlay
  }
}

function normalizeSection(s: Partial<FloormapSection> & { id: string }): FloormapSection {
  return {
    ...s,
    id: String(s.id),
    document_id: String(s.document_id || ""),
    label: String(s.label || ""),
    region_kind: (String(s.region_kind || "FLOORMAP").toUpperCase() as RegionKind) || "FLOORMAP",
    page_index: Number(s.page_index) || 0,
    x_min: Number(s.x_min),
    y_min: Number(s.y_min),
    x_max: Number(s.x_max),
    y_max: Number(s.y_max),
    scale_ratio: s.scale_ratio != null ? Number(s.scale_ratio) : null,
    metres_per_norm_unit: s.metres_per_norm_unit != null ? Number(s.metres_per_norm_unit) : null,
    scale_source: String(s.scale_source || "NONE"),
    room_count: Number(s.room_count) || 0,
  };
}

async function ensureSectionInList(sectionId: string): Promise<boolean> {
  if (sections.some((s) => s.id === sectionId)) return true;
  try {
    const data = await apiGet<{ section: FloormapSection }>(
      `/api/floormap/section?section_id=${encodeURIComponent(sectionId)}`,
    );
    if (!data.section?.id) return false;
    sections = [normalizeSection(data.section), ...sections.filter((s) => s.id !== data.section.id)];
    renderSectionList();
    return true;
  } catch {
    return false;
  }
}

async function loadFloormapSections(bid: string): Promise<void> {
  if (!auth?.token) return;
  buildingId = bid.trim();
  if (!buildingId) {
    setStatus("Enter a building id", "err");
    return;
  }
  buildingInput.value = buildingId;
  if (gaLinkEl) {
    gaLinkEl.href = `/ga.html?building_id=${encodeURIComponent(buildingId)}`;
  }
  setStatus("Loading sections…", "busy");
  try {
    await refreshLinkedRooms();
    const data = await apiGet<{ sections: FloormapSection[] }>(
      `/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`,
    );
    sections = (data.sections || []).map((s) => normalizeSection(s));
    if (URL_SECTION) {
      await ensureSectionInList(URL_SECTION);
    }
    syncWorkspaceLabels(sections[0]?.region_kind || "FLOORMAP");
    renderSectionList();
    pickerPanelEl.classList.remove("hidden");
    workspacePanelEl.classList.add("hidden");
    setStatus(`${sections.length} section(s)`, "ok");
    if (URL_SECTION && sections.some((s) => s.id === URL_SECTION)) {
      await openSection(URL_SECTION);
    } else if (URL_SECTION) {
      setStatus("Section not found or not scalable — check engineer review link", "err");
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

async function loadRooms(): Promise<void> {
  if (!auth?.token || !activeSection) return;
  const data = await apiGet<{ subsections: RoomSubsection[] }>(
    `/api/floormap/subsections?section_id=${encodeURIComponent(activeSection.id)}`,
  );
  rooms = (data.subsections || []).map((r) => ({
    ...r,
    points: Array.isArray(r.points) ? (r.points as Pt[]) : [],
    area_norm: r.area_norm != null ? Number(r.area_norm) : null,
    perimeter_norm: r.perimeter_norm != null ? Number(r.perimeter_norm) : null,
    area_m2: r.area_m2 != null ? Number(r.area_m2) : null,
    perimeter_m: r.perimeter_m != null ? Number(r.perimeter_m) : null,
    metres_per_norm_unit:
      r.metres_per_norm_unit != null && Number(r.metres_per_norm_unit) > 0
        ? Number(r.metres_per_norm_unit)
        : null,
  }));
  await restoreScaleFromRooms();
  await refreshLinkedRooms();
  renderRoomList();
  drawOverlay();
}

/** If the floormap has no scale but rooms do, restore it so edits need no recalibration. */
async function restoreScaleFromRooms(): Promise<void> {
  if (!activeSection || !auth?.token) return;
  if (activeSection.metres_per_norm_unit != null && activeSection.metres_per_norm_unit > 0) {
    updateScaleUi();
    return;
  }
  const withScale = rooms.find(
    (r) => r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0,
  );
  if (!withScale?.metres_per_norm_unit) {
    updateScaleUi();
    return;
  }
  const mpu = withScale.metres_per_norm_unit;
  activeSection.metres_per_norm_unit = mpu;
  if (!activeSection.scale_source || activeSection.scale_source === "NONE") {
    activeSection.scale_source = "CALIBRATED";
  }
  updateScaleUi();
  updateMeasureReadouts();
  try {
    await apiPost("/api/floormap/scale", {
      section_id: activeSection.id,
      metres_per_norm_unit: mpu,
      scale_ratio: activeSection.scale_ratio,
      scale_source: activeSection.scale_source || "CALIBRATED",
    });
  } catch {
    // In-memory restore is enough for this session if persist fails
  }
}

async function openSection(sectionId: string): Promise<void> {
  const sec = sections.find((s) => s.id === sectionId);
  if (!sec || !auth?.token) return;
  endDiscovery();
  endCalibrate();
  activeSection = sec;
  const n = partNoun(sec.region_kind);
  syncWorkspaceLabels(sec.region_kind);
  sectionTitleEl.textContent = sec.label || n.title;
  sectionMetaEl.textContent = `${n.kindLabel} · page ${sec.page_index + 1} · ${sec.document_id.slice(0, 8)}…`;
  pickerPanelEl.classList.add("hidden");
  workspacePanelEl.classList.remove("hidden");
  updateScaleUi();
  setStatus(`Loading ${n.title.toLowerCase()} crop…`, "busy");
  try {
    await loadCroppedPdf(sec);
    await tryDetectPdfScale(sec);
    await loadRooms();
    updateScaleUi();
    setStatus(`${n.title} ready — calibrate, discover, or draw ${n.plural}`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

async function loadCroppedPdf(sec: FloormapSection): Promise<void> {
  const res = await fetch(`/api/drawings/download?document_id=${encodeURIComponent(sec.document_id)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth!.token),
  });
  if (!res.ok) throw new Error(`Failed to load PDF (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageNum = Math.min(pdfDoc.numPages, Math.max(1, sec.page_index + 1));
  const page = await pdfDoc.getPage(pageNum);
  const renderScale = 2.5;
  const viewport = page.getViewport({ scale: renderScale });
  const off = document.createElement("canvas");
  off.width = Math.floor(viewport.width);
  off.height = Math.floor(viewport.height);
  const octx = off.getContext("2d");
  if (!octx) throw new Error("canvas context unavailable");
  await page.render({ canvasContext: octx, viewport }).promise;

  const x0 = Math.floor(sec.x_min * off.width);
  const y0 = Math.floor(sec.y_min * off.height);
  const x1 = Math.ceil(sec.x_max * off.width);
  const y1 = Math.ceil(sec.y_max * off.height);
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);
  cropBitmap = document.createElement("canvas");
  cropBitmap.width = cw;
  cropBitmap.height = ch;
  const cctx = cropBitmap.getContext("2d");
  if (!cctx) throw new Error("crop context unavailable");
  cctx.drawImage(off, x0, y0, cw, ch, 0, 0, cw, ch);

  const baseVp = page.getViewport({ scale: 1 });
  cropWidthPdfPts = (sec.x_max - sec.x_min) * baseVp.width;

  viewZoom = 1;
  await paintCropView();
}

async function tryDetectPdfScale(sec: FloormapSection): Promise<void> {
  if (!pdfDoc) return;
  if (sec.metres_per_norm_unit != null && sec.metres_per_norm_unit > 0) return;
  try {
    const page = await pdfDoc.getPage(Math.min(pdfDoc.numPages, Math.max(1, sec.page_index + 1)));
    const content = await page.getTextContent();
    const base = page.getViewport({ scale: 1 });
    let found: number | null = null;
    for (const item of content.items) {
      const str = item.str || "";
      const ratio = parseScaleRatioFromText(str);
      if (ratio == null) continue;
      const t = item.transform;
      if (t && t.length >= 6) {
        const px = t[4] / base.width;
        const py = 1 - t[5] / base.height;
        if (px < sec.x_min - 0.02 || px > sec.x_max + 0.02 || py < sec.y_min - 0.02 || py > sec.y_max + 0.02) {
          continue;
        }
      }
      found = ratio;
      break;
    }
    if (found == null || !(cropWidthPdfPts > 0)) return;
    const mpu = metresPerNormFromPaperScale(found, cropWidthPdfPts);
    await apiPost("/api/floormap/scale", {
      section_id: sec.id,
      metres_per_norm_unit: mpu,
      scale_ratio: found,
      scale_source: "PDF_TEXT",
    });
    sec.metres_per_norm_unit = mpu;
    sec.scale_ratio = found;
    sec.scale_source = "PDF_TEXT";
    activeSection = sec;
    const idx = sections.findIndex((s) => s.id === sec.id);
    if (idx >= 0) sections[idx] = sec;
    calibrateHintEl.textContent = `Detected paper scale 1:${found} from PDF text.`;
  } catch {
    /* optional */
  }
}

async function paintCropView(): Promise<void> {
  if (!cropBitmap) return;
  canvasWidth = Math.max(1, Math.floor(cropBitmap.width * viewZoom));
  canvasHeight = Math.max(1, Math.floor(cropBitmap.height * viewZoom));
  pdfCanvas.width = canvasWidth;
  pdfCanvas.height = canvasHeight;
  overlayCanvas.width = canvasWidth;
  overlayCanvas.height = canvasHeight;
  const ctx = pdfCanvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cropBitmap, 0, 0, canvasWidth, canvasHeight);
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
  drawOverlay();
}

function updateZoomLabel(): void {
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
}

async function setViewZoom(next: number): Promise<void> {
  viewZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  updateZoomLabel();
  await paintCropView();
}

async function zoomToFit(): Promise<void> {
  if (!cropBitmap) return;
  const avail = Math.max(200, pdfScrollEl.clientWidth - 16);
  await setViewZoom(avail / cropBitmap.width);
}

function canvasToNorm(cx: number, cy: number): Pt {
  return {
    x: Math.min(1, Math.max(0, cx / Math.max(1, canvasWidth))),
    y: Math.min(1, Math.max(0, cy / Math.max(1, canvasHeight))),
  };
}

function normToCanvas(p: Pt): { x: number; y: number } {
  return { x: p.x * canvasWidth, y: p.y * canvasHeight };
}

function eventToCanvas(ev: MouseEvent): { x: number; y: number } {
  const rect = overlayCanvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - rect.left) / Math.max(1, rect.width)) * canvasWidth,
    y: ((ev.clientY - rect.top) / Math.max(1, rect.height)) * canvasHeight,
  };
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  stroke: string,
  fill: string,
  lineWidth: number,
  opts?: { vertexHandles?: boolean; dash?: number[]; label?: string },
): void {
  if (points.length < 2) return;
  ctx.beginPath();
  const first = normToCanvas(points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = normToCanvas(points[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  if (opts?.dash?.length) ctx.setLineDash(opts.dash);
  else ctx.setLineDash([]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (opts?.vertexHandles) {
    const verts = points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6
      ? points.slice(0, -1)
      : points;
    for (const pt of verts) {
      const c = normToCanvas(pt);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (opts?.label) {
    const xs = points.map((p) => normToCanvas(p).x);
    const ys = points.map((p) => normToCanvas(p).y);
    const lx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const ly = Math.min(...ys) - 8;
    ctx.fillStyle = stroke;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.label, lx, Math.max(12, ly));
  }
}

function drawOverlay(): void {
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (const r of rooms) {
    if (!r.points?.length) continue;
    drawPolyline(ctx, r.points, "#6a1b9a", "rgba(106,27,154,0.12)", 1.5);
  }

  if (discovery) {
    discovery.candidates.forEach((ring, i) => {
      if (i === discovery!.index) return;
      drawPolyline(ctx, ring, "#9e9e9e", "rgba(158,158,158,0.06)", 1.5, { dash: [4, 4] });
    });
    if (discovery.current.length >= 2) {
      drawPolyline(ctx, discovery.current, "#c62828", "rgba(198,40,40,0.12)", 2.5, {
        dash: [8, 4],
        vertexHandles: true,
        label: `Candidate ${discovery.index + 1}`,
      });
    }
  }

  if (pendingRoom?.points.length) {
    drawPolyline(
      ctx,
      pendingRoom.points,
      "#2e7d32",
      pendingRoom.closed ? "rgba(46,125,50,0.18)" : "rgba(46,125,50,0.08)",
      2,
      { vertexHandles: pendingRoom.closed || pendingRoom.points.length >= 2 },
    );
    if (!pendingRoom.closed && pendingRoom.points.length >= 1) {
      // open path stroke for in-progress draw
      ctx.strokeStyle = "#2e7d32";
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const a = normToCanvas(pendingRoom.points[0]);
      ctx.moveTo(a.x, a.y);
      for (let i = 1; i < pendingRoom.points.length; i++) {
        const p = normToCanvas(pendingRoom.points[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (calibrate?.points.length) {
    ctx.strokeStyle = "#1565c0";
    ctx.fillStyle = "#1565c0";
    ctx.lineWidth = 2;
    for (let i = 0; i < calibrate.points.length; i++) {
      const c = normToCanvas(calibrate.points[i]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (i === 1) {
        const a = normToCanvas(calibrate.points[0]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
    }
  }

  if (measure.tool === "length") {
    const pts = measureDisplayPoints();
    if (pts.length > 0) {
      ctx.strokeStyle = "#0277bd";
      ctx.fillStyle = "#0277bd";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const first = normToCanvas(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = normToCanvas(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const pt of measure.points) {
        const c = normToCanvas(pt);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#0277bd";
        ctx.fill();
      }
    }
  }
}

function seedStarterRoom(): Pt[] {
  // Dense closed polyline (not a 4-corner rect) so walls can be followed by dragging anchors
  return ensureEditablePolyline(
    [
      { x: 0.28, y: 0.28 },
      { x: 0.72, y: 0.28 },
      { x: 0.72, y: 0.72 },
      { x: 0.28, y: 0.72 },
    ],
    20,
  );
}

function scrollToRing(points: Pt[]): void {
  if (!points.length || canvasWidth <= 0 || canvasHeight <= 0) return;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const midX = ((Math.min(...xs) + Math.max(...xs)) / 2) * canvasWidth - pdfScrollEl.clientWidth / 2;
  const midY = ((Math.min(...ys) + Math.max(...ys)) / 2) * canvasHeight - pdfScrollEl.clientHeight / 2;
  pdfScrollEl.scrollTo({
    top: Math.max(0, midY),
    left: Math.max(0, midX),
    behavior: "auto",
  });
}

function endDiscovery(msg?: string): void {
  discovery = null;
  discoveryDockEl.classList.add("hidden");
  document.body.classList.remove("discovery-active");
  if (msg) setStatus(msg, "ok");
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
}

function showDiscoveryCandidate(): void {
  if (!discovery) return;
  const total = discovery.candidates.length;
  const i = discovery.index;
  if (i >= total) {
    endDiscovery(
      total === 0
        ? "Discovery finished"
        : `Discovery finished — reviewed ${total} candidate(s)`,
    );
    return;
  }
  discovery.current = ensureEditablePolyline(
    discovery.candidates[i].map((p) => ({ ...p })),
    16,
  );
  discovery.candidates[i] = discovery.current;
  discovery.dragVertex = null;
  discoveryProgressEl.textContent = `(${i + 1} of ${total})`;
  discoveryHintEl.textContent =
    "Drag anchors to follow walls. Double-click an anchor to remove it, or Simplify to thin the polyline.";
  discoveryLabelInput.value = `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  discoveryDockEl.classList.remove("hidden");
  document.body.classList.add("discovery-active");
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
  scrollToRing(discovery.current);
}

async function startDiscovery(): Promise<void> {
  if (!cropBitmap || !activeSection) {
    setStatus(`Open a ${activePartNoun().title.toLowerCase()} first`, "err");
    return;
  }
  endCalibrate();
  clearPendingRoom();
  if (measure.tool !== "off") clearMeasure(false);
  discoverBtn.disabled = true;
  if (discoverBtnSide) discoverBtnSide.disabled = true;
  setStatus(`Discovering ${activePartNoun().plural}…`, "busy");
  const ctx = cropBitmap.getContext("2d", { willReadFrequently: true } as CanvasRenderingContext2DSettings);
  if (!ctx) {
    setStatus("Cannot read drawing image", "err");
    discoverBtn.disabled = false;
    if (discoverBtnSide) discoverBtnSide.disabled = false;
    return;
  }
  const img = ctx.getImageData(0, 0, cropBitmap.width, cropBitmap.height);
  let found: ReturnType<typeof discoverRoomPolylines> = [];
  try {
    found = discoverRoomPolylines(img);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Discovery failed", "err");
    discoverBtn.disabled = false;
    if (discoverBtnSide) discoverBtnSide.disabled = false;
    return;
  }
  let norms = found.map((r) =>
    ensureEditablePolyline(
      pixelsToSectionNorm(r.points, cropBitmap!.width, cropBitmap!.height),
      16,
    ),
  );
  let seeded = false;
  if (norms.length === 0) {
    // Same review UX as sections: always present an editable closed outline
    norms = [seedStarterRoom()];
    seeded = true;
  }
  discovery = { candidates: norms, index: 0, current: [], dragVertex: null };
  showDiscoveryCandidate();
  setStatus(
    seeded
      ? "No auto rooms found — adjust the red starter outline to fit a room, then Accept"
      : `${norms.length} room candidate(s) — drag the red dashed outline to fit, then Accept / Skip`,
    seeded ? "busy" : "ok",
  );
  discoverBtn.disabled = false;
  if (discoverBtnSide) discoverBtnSide.disabled = false;
}

async function acceptDiscovery(): Promise<void> {
  if (!discovery || !activeSection || !auth) return;
  const points = closeRing(discovery.current);
  const label =
    discoveryLabelInput.value.trim() ||
    `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  const level = discoveryLevelSelect.value || "OTHER";
  discoveryAcceptBtn.disabled = true;
  setStatus("Saving room…", "busy");
  try {
    const mpu = activeScaleMpu();
    await apiPost("/api/floormap/subsections", {
      section_id: activeSection.id,
      label,
      level_hint: level,
      points,
      metres_per_norm_unit: mpu ?? undefined,
    });
    await loadRooms();
    discovery.index += 1;
    showDiscoveryCandidate();
    if (discovery && discovery.index < discovery.candidates.length) {
      setStatus(`Saved ${label} — next candidate (${discovery.index + 1} of ${discovery.candidates.length})`, "ok");
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    discoveryAcceptBtn.disabled = false;
  }
}

function skipDiscovery(): void {
  if (!discovery) return;
  discovery.index += 1;
  showDiscoveryCandidate();
}

function removeVertexFromActiveOutline(index: number): boolean {
  if (discovery?.current) {
    const next = removeRingVertex(discovery.current, index);
    if (!next) {
      setStatus("Need at least 3 anchors", "err");
      return false;
    }
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    discovery.dragVertex = null;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(`Removed anchor (${ringVertexCount(next)} left)`, "ok");
    return true;
  }
  if (pendingRoom?.closed) {
    const next = removeRingVertex(pendingRoom.points, index);
    if (!next) {
      setStatus("Need at least 3 anchors", "err");
      return false;
    }
    pendingRoom.points = next;
    pendingRoom.dragVertex = null;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    drawOverlay();
    setStatus(`Removed anchor (${ringVertexCount(next)} left)`, "ok");
    return true;
  }
  return false;
}

function simplifyActiveOutline(): void {
  if (discovery?.current) {
    const before = ringVertexCount(discovery.current);
    const next = simplifyEditableRing(discovery.current);
    const after = ringVertexCount(next);
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(
      after < before ? `Simplified ${before} → ${after} anchors` : "Outline already simple",
      "ok",
    );
    return;
  }
  if (pendingRoom?.closed) {
    const before = ringVertexCount(pendingRoom.points);
    const next = simplifyEditableRing(pendingRoom.points);
    const after = ringVertexCount(next);
    pendingRoom.points = next;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    drawOverlay();
    setStatus(
      after < before ? `Simplified ${before} → ${after} anchors` : "Outline already simple",
      "ok",
    );
  }
}

function nudgeCurrent(dx: number, dy: number): void {
  if (discovery?.current) {
    discovery.current = translateRing(discovery.current, dx, dy);
    discovery.candidates[discovery.index] = closeRing(discovery.current);
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (pendingRoom?.closed) {
    pendingRoom.points = translateRing(pendingRoom.points, dx, dy);
    updateMeasureReadouts();
    drawOverlay();
  }
}

function endCalibrate(msg?: string): void {
  calibrate = null;
  calibrateMetresWrap.classList.add("hidden");
  updateScaleUi();
  drawOverlay();
  if (msg) setStatus(msg, "ok");
}

function startCalibrate(): void {
  endDiscovery();
  if (measure.tool !== "off") clearMeasure(false);
  if (calibrate) {
    endCalibrate("Calibration cancelled");
    return;
  }
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Click both ends of a known length on the floormap.";
  calibrateBtn.textContent = "Cancel calibrate";
  setStatus("Click first scale point", "busy");
  drawOverlay();
}

function repickCalibrate(): void {
  if (!calibrate) return;
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Click both ends of a known length on the floormap.";
  setStatus("Click first scale point", "busy");
  drawOverlay();
}

async function finishCalibrate(): Promise<void> {
  if (!calibrate || calibrate.points.length < 2 || !activeSection) return;
  const mm = Number(calibrateMetresInput.value);
  if (!(mm > 0)) {
    setStatus("Enter a positive length in millimetres", "err");
    return;
  }
  const a = calibrate.points[0];
  const b = calibrate.points[1];
  const normDist = Math.hypot(b.x - a.x, b.y - a.y);
  if (normDist < 1e-6) {
    setStatus("Calibration points too close", "err");
    return;
  }
  const mpu = mm / 1000 / normDist;
  try {
    await apiPost("/api/floormap/scale", {
      section_id: activeSection.id,
      metres_per_norm_unit: mpu,
      scale_ratio: null,
      scale_source: "CALIBRATED",
    });
    activeSection.metres_per_norm_unit = mpu;
    activeSection.scale_source = "CALIBRATED";
    const idx = sections.findIndex((s) => s.id === activeSection!.id);
    if (idx >= 0) sections[idx] = activeSection;
    endCalibrate(`Scale saved: marked line = ${mm} mm`);
    updateMeasureReadouts();
    updateToolHint();
    await loadRooms();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

async function deleteRoom(id: string): Promise<void> {
  try {
    await apiDelete(`/api/floormap/subsections?subsection_id=${encodeURIComponent(id)}`);
    if (pendingRoom?.editingId === id) clearPendingRoom();
    await loadRooms();
    setStatus("Room removed", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

function hitVertex(norm: Pt, points: Pt[], pxRadius = 8): number {
  const thresh = pxRadius / Math.max(canvasWidth, 1);
  const n = points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6
    ? points.length - 1
    : points.length;
  for (let i = 0; i < n; i++) {
    if (Math.hypot(points[i].x - norm.x, points[i].y - norm.y) <= thresh) return i;
  }
  return -1;
}

overlayCanvas.addEventListener("mousedown", (ev) => {
  const c = eventToCanvas(ev);
  const norm = canvasToNorm(c.x, c.y);

  if (calibrate) {
    if (calibrate.points.length >= 2) return;
    calibrate.points.push(norm);
    drawOverlay();
    if (calibrate.points.length === 1) {
      setStatus("Click second scale point", "busy");
      calibrateHintEl.textContent = "Click the other end of the known length.";
    } else if (calibrate.points.length >= 2) {
      calibrateMetresWrap.classList.remove("hidden");
      calibrateHintEl.textContent =
        "Enter the real length in millimetres, then Apply (or press Enter).";
      setStatus("Enter length in mm, then Apply", "ok");
      queueMicrotask(() => {
        calibrateMetresInput.focus();
        calibrateMetresInput.select();
      });
    }
    return;
  }

  if (pendingRoom?.drawing && !pendingRoom.closed) {
    if (pendingRoom.points.length >= 3) {
      const first = pendingRoom.points[0];
      if (Math.hypot(norm.x - first.x, norm.y - first.y) <= 10 / Math.max(canvasWidth, 1) || ev.detail === 2) {
        closePendingPolygon();
        return;
      }
    }
    pendingRoom.points.push(norm);
    syncPendingRoomButtons();
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    return;
  }

  if (pendingRoom?.closed) {
    const vi = hitVertex(norm, pendingRoom.points, 12);
    if (vi >= 0) {
      if (ev.detail === 2) {
        removeVertexFromActiveOutline(vi);
        return;
      }
      pendingRoom.dragVertex = vi;
      return;
    }
  }

  if (measure.tool === "length") {
    if (!activeScaleMpu()) {
      setStatus("Set scale first", "err");
      return;
    }
    if (measure.points.length >= 2) {
      measure.points = [norm];
    } else {
      measure.points.push(norm);
    }
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    return;
  }

  if (discovery) {
    const vi = hitVertex(norm, discovery.current, 12);
    if (vi >= 0) {
      if (ev.detail === 2) {
        removeVertexFromActiveOutline(vi);
        return;
      }
      discovery.dragVertex = vi;
      return;
    }
  }
});

overlayCanvas.addEventListener("dblclick", (ev) => {
  ev.preventDefault();
  // Handled on mousedown detail===2 for closed outlines; suppress browser select
});

overlayCanvas.addEventListener("mousemove", (ev) => {
  const c = eventToCanvas(ev);
  const norm = canvasToNorm(c.x, c.y);

  if (pendingRoom?.dragVertex != null) {
    const i = pendingRoom.dragVertex;
    pendingRoom.points[i] = norm;
    if (i === 0 && pendingRoom.closed) {
      pendingRoom.points[pendingRoom.points.length - 1] = { ...norm };
    }
    updateMeasureReadouts();
    drawOverlay();
    return;
  }

  if (measure.tool === "length" && measure.points.length < 2) {
    measure.cursor = norm;
    updateMeasureReadouts();
    drawOverlay();
    return;
  }

  if (!discovery || discovery.dragVertex == null) return;
  const i = discovery.dragVertex;
  discovery.current[i] = norm;
  if (i === 0) discovery.current[discovery.current.length - 1] = { ...norm };
  discovery.candidates[discovery.index] = closeRing(discovery.current);
  updateMeasureReadouts();
  drawOverlay();
});

overlayCanvas.addEventListener("mouseup", () => {
  if (discovery) {
    if (discovery.dragVertex != null) {
      discovery.candidates[discovery.index] = closeRing(discovery.current);
    }
    discovery.dragVertex = null;
  }
  if (pendingRoom) pendingRoom.dragVertex = null;
});

overlayCanvas.addEventListener("mouseleave", () => {
  if (discovery) discovery.dragVertex = null;
  if (pendingRoom) pendingRoom.dragVertex = null;
});

loginForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(loginForm);
  const username = String(fd.get("username") || "");
  const password = String(fd.get("password") || "");
  void (async () => {
    try {
      setStatus("Signing in…", "busy");
      await bootstrapAndLogin(username, password);
      setStatus("Signed in", "ok");
      if (buildingId) await loadFloormapSections(buildingId);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
      showLogin();
    }
  })();
});

logoutBtn.addEventListener("click", () => {
  showLogin();
  setStatus("Signed out", "ok");
});

loadBuildingBtn.addEventListener("click", () => {
  void loadFloormapSections(buildingInput.value);
});

backPickerBtn.addEventListener("click", () => {
  endDiscovery();
  endCalibrate();
  clearMeasure(false);
  workspacePanelEl.classList.add("hidden");
  pickerPanelEl.classList.remove("hidden");
  activeSection = null;
  renderSectionList();
});

zoomOutBtn.addEventListener("click", () => void setViewZoom(viewZoom - ZOOM_STEP));
zoomInBtn.addEventListener("click", () => void setViewZoom(viewZoom + ZOOM_STEP));
zoomBtn.addEventListener("click", () => void setViewZoom(1));
zoomFitBtn.addEventListener("click", () => void zoomToFit());
discoverBtn.addEventListener("click", () => void startDiscovery());
discoverBtnSide?.addEventListener("click", () => void startDiscovery());
calibrateBtn.addEventListener("click", () => startCalibrate());
calibrateApplyBtn.addEventListener("click", () => void finishCalibrate());
calibrateRepickBtn.addEventListener("click", () => repickCalibrate());
calibrateMetresInput.addEventListener("keydown", (evt) => {
  if (evt.key === "Enter") {
    evt.preventDefault();
    void finishCalibrate();
  }
});

roomDrawBtn.addEventListener("click", () => startDrawRoom());
roomCloseBtn.addEventListener("click", () => closePendingPolygon());
roomSimplifyBtn?.addEventListener("click", () => simplifyActiveOutline());
roomSaveBtn.addEventListener("click", () => void savePendingRoom());
roomClearBtn.addEventListener("click", () => {
  clearPendingRoom();
  setStatus("Room mark cleared", "ok");
});

document.querySelectorAll<HTMLButtonElement>(".tool-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMeasureTool((btn.dataset.tool || "off") as ToolMode);
  });
});
toolClearBtn?.addEventListener("click", () => {
  if (pendingRoom) {
    clearPendingRoom();
    setStatus("Room mark cleared", "ok");
    return;
  }
  clearMeasure(true);
  setStatus("Measure cleared", "ok");
});
window.addEventListener("keydown", (evt) => {
  if (evt.key !== "Escape") return;
  if (pendingRoom) {
    clearPendingRoom();
    setStatus("Room mark cleared", "ok");
  } else if (measure.tool !== "off") {
    clearMeasure(true);
    setStatus("Measure cleared", "ok");
  }
});

discoveryAcceptBtn.addEventListener("click", () => void acceptDiscovery());
discoverySkipBtn.addEventListener("click", () => skipDiscovery());
discoveryCancelBtn.addEventListener("click", () => endDiscovery("Discovery cancelled"));
discoverySimplifyBtn?.addEventListener("click", () => simplifyActiveOutline());
nudgeLeftBtn.addEventListener("click", () => nudgeCurrent(-0.01, 0));
nudgeRightBtn.addEventListener("click", () => nudgeCurrent(0.01, 0));
nudgeUpBtn.addEventListener("click", () => nudgeCurrent(0, -0.01));
nudgeDownBtn.addEventListener("click", () => nudgeCurrent(0, 0.01));

syncPendingRoomButtons();

function connect(): void {
  setStatus("Connecting…", "busy");
  setConnLed(false);
  ws = new WebSocket(BPP_WS);
  ws.addEventListener("open", () => {
    setConnLed(true);
    void (async () => {
      try {
        await send("session.open", { client: "acoustics-floormap" }, "session.opened");
        const stored = loadStoredAuth();
        if (stored?.token) {
          await loadSharedApi();
          const ret = await invokeString("API_ValidateSession", [stored.token]);
          if (ret.startsWith("ERROR")) {
            showLogin();
            setStatus("Session expired — sign in", "err");
            return;
          }
          showPanel(stored);
          setStatus("Ready", "ok");
          buildingInput.value = buildingId;
          if (buildingId) await loadFloormapSections(buildingId);
        } else {
          showLogin();
          setStatus("Connected — sign in", "ok");
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "err");
        showLogin();
      }
    })();
  });
  ws.addEventListener("message", (ev) => onMessage(String(ev.data)));
  ws.addEventListener("close", () => {
    setConnLed(false);
    setStatus("Disconnected", "err");
  });
  ws.addEventListener("error", () => setStatus("WebSocket error", "err"));
}

buildingInput.value = buildingId;
connect();
