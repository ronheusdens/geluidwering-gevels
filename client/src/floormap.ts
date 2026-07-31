/**
 * Section drawing analysis workspace — engineer-only.
 * Crop viewer, scale calibrate, polyline discovery review, saved rooms/components.
 * Works for FLOORMAP, FACADE, SECTION, and CROSS_SECTION.
 */
import { initEngineerLayoutSplit, getEngineerSidebarWidthPx, setEngineerSidebarWidthPx } from "./layout-split";
import {
  clampPath,
  closeRing,
  ensureEditablePolyline,
  metresPerNormFromCalibration,
  metresPerNormFromPaperScale,
  normalizeAspectYx,
  openPolylineLength,
  parseScaleRatioFromText,
  polylinePerimeter,
  removeRingVertex,
  ringVertexCount,
  scaledAreaM2,
  scaledPathLength,
  shoelaceArea,
  simplifyEditableRing,
  translateRing,
  type Pt,
} from "./geom";
import {
  booleanCombineLargest,
  composeSigned,
  ringFullyContained,
  type BooleanOp,
  type BooleanPolygon,
  type ComposeSign,
} from "./polygon-boolean";
import { collectBooleanSourceIds, collectSupersededSourceIds } from "./ga-vr-components";
import { isLengthQuantityRubriek } from "../lib/material-taxonomy.mjs";
import { discoverRoomPolylines, pixelsToSectionNorm } from "./room-discover";
import { loadAuth, storeAuth as persistAuth, syncSessionCookie, apiAuthHeaders } from "./auth-store";
import { resolveBppWsUrl } from "./ws-url";
import { initPasswordToggles } from "./password-toggle";

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
  /** Crop height/width; pairs with metres_per_norm_unit (width-based). */
  scale_aspect_yx: number | null;
  scale_source: string;
  room_count: number;
};

type CatalogMaterial = {
  material_id: string;
  catalog_id: string;
  material_no: number;
  rubriek_nr?: number | null;
  master_category: string;
  name: string;
  category: string;
  source?: string;
  thickness_mm: number | null;
  ra_dba: number | null;
  r_125_hz?: number | null;
  r_250_hz?: number | null;
  r_500_hz?: number | null;
  r_1000_hz?: number | null;
  r_2000_hz?: number | null;
};

type SubsectionAnalysis = {
  /** Catalog material UUID — preferred for GA transfer calc */
  material_id?: string;
  master_category?: string;
  material_name?: string;
  catalog_id?: string;
  /** Subrubriek name (GG taxonomy) */
  category?: string;
  /** Legacy fixed kinds (glas / kozijnhout / metselwerk) */
  material_kind?: string;
  boolean_op?: BooleanOp | string;
  source_subsection_ids?: string[];
  source_labels?: string[];
  /** Outer contour id for compose (shared across multiple material compositions). */
  outer_subsection_id?: string;
  /** Per-source sign for compose: "+" include, "-" subtract. */
  constituent_signs?: Record<string, ComposeSign | string>;
  /** Hole rings for difference/compose results (net area = outer − holes). */
  holes?: Pt[][];
  area_norm?: number;
  area_m2?: number;
  /** Rubriek 9 (kierdichting): length in metres, not area. */
  quantity_kind?: "area" | "length" | string;
  length_m?: number;
  length_norm?: number;
  open_path?: boolean;
  rubriek_nr?: number;
};

type RoomSubsection = {
  id: string;
  section_id: string;
  label: string;
  level_hint: string;
  vg_nr: number | null;
  vr_nr: string | null;
  points: Pt[];
  area_norm: number | null;
  perimeter_norm: number | null;
  area_m2: number | null;
  perimeter_m: number | null;
  /** Scale snapshot stored with the room (metres per section-local unit). */
  metres_per_norm_unit: number | null;
  analysis_status: string;
  sort_order: number;
  analysis?: SubsectionAnalysis | null;
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
  getViewport: (opts: { scale: number; rotation?: number }) => { width: number; height: number };
  render: (ctx: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
    promise: Promise<void>;
  };
  getTextContent: () => Promise<{ items: Array<{ str?: string; transform?: number[] }> }>;
  rotate?: number;
};

const params = new URLSearchParams(location.search);
const BPP_WS = resolveBppWsUrl();

const AUTH_KEY = "app_gevelwering_engineer_auth";
const URL_BUILDING = params.get("building_id") || "";
const URL_SECTION = params.get("section_id") || "";
const COMPONENT_DRAFT_KEY = "app-gevelwering-fm-component-draft";
const MATERIAL_PICK_KEY = "app-gevelwering-material-pick";

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
const roomVgInput = document.getElementById("fm-room-vg") as HTMLInputElement;
const roomVrInput = document.getElementById("fm-room-vr") as HTMLInputElement;
const vgVrRowEl = document.getElementById("fm-vg-vr-row") as HTMLElement | null;
const vgVrHintEl = document.getElementById("fm-vg-vr-hint") as HTMLElement | null;
const roomLevelSelect = document.getElementById("fm-room-level") as HTMLSelectElement;
const roomPendingHintEl = document.getElementById("fm-room-pending-hint") as HTMLElement;
const roomDrawBtn = document.getElementById("fm-room-draw-btn") as HTMLButtonElement;
const roomCloseBtn = document.getElementById("fm-room-close-btn") as HTMLButtonElement;
const roomSimplifyBtn = document.getElementById("fm-room-simplify-btn") as HTMLButtonElement | null;
const roomSaveBtn = document.getElementById("fm-room-save-btn") as HTMLButtonElement;
const roomClearBtn = document.getElementById("fm-room-clear-btn") as HTMLButtonElement;
const discoverBtnSide = document.getElementById("fm-discover-btn-side") as HTMLButtonElement | null;
const setOpsFieldset = document.getElementById("fm-set-ops-fieldset") as HTMLElement | null;
const materialBlockEl = document.getElementById("fm-material-block") as HTMLElement | null;
const composePartsEl = document.getElementById("fm-compose-parts") as HTMLUListElement | null;
const composeFeedbackEl = document.getElementById("fm-compose-feedback") as HTMLElement | null;
const materialCategoryEl = document.getElementById("fm-material-category") as HTMLSelectElement | null;
const materialSubcategoryEl = document.getElementById(
  "fm-material-subcategory",
) as HTMLSelectElement | null;
const materialFilterEl = document.getElementById("fm-material-filter") as HTMLInputElement | null;
const materialEigenOnlyEl = document.getElementById("fm-material-eigen-only") as HTMLInputElement | null;
const materialEigenFilterLabelEl = document.getElementById("fm-eigen-filter-label") as HTMLElement | null;
const materialEigenFilterStateEl = document.getElementById("fm-eigen-filter-state") as HTMLElement | null;
const materialIdEl = document.getElementById("fm-material-id") as HTMLSelectElement | null;
const openMatCatalogBtn = document.getElementById("fm-open-mat-btn") as HTMLButtonElement | null;
const customMatToggleBtn = document.getElementById("fm-custom-mat-toggle") as HTMLButtonElement | null;
const customMatPanelEl = document.getElementById("fm-custom-mat-panel") as HTMLElement | null;
const customMatForm = document.getElementById("fm-custom-mat-form") as HTMLFormElement | null;
const customMatRubriekEl = document.getElementById("fm-custom-mat-rubriek") as HTMLSelectElement | null;
const customMatNameEl = document.getElementById("fm-custom-mat-name") as HTMLInputElement | null;
const customMatRaEl = document.getElementById("fm-custom-mat-ra") as HTMLInputElement | null;
const customMatCancelBtn = document.getElementById("fm-custom-mat-cancel") as HTMLButtonElement | null;
const materialSpectrumEl = document.getElementById("fm-material-spectrum") as HTMLElement | null;
const materialR125El = document.getElementById("fm-r125") as HTMLElement | null;
const materialR250El = document.getElementById("fm-r250") as HTMLElement | null;
const materialR500El = document.getElementById("fm-r500") as HTMLElement | null;
const materialR1000El = document.getElementById("fm-r1000") as HTMLElement | null;
const materialR2000El = document.getElementById("fm-r2000") as HTMLElement | null;
const materialRaEl = document.getElementById("fm-ra") as HTMLElement | null;
const setApplyBtn = document.getElementById("fm-set-apply-btn") as HTMLButtonElement | null;
const setClearSelBtn = document.getElementById("fm-set-clear-sel-btn") as HTMLButtonElement | null;
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
const roomCountEl = document.getElementById("fm-room-count") as HTMLElement | null;
const roomsHintEl = document.getElementById("fm-rooms-hint") as HTMLElement | null;
const roomListEl = document.getElementById("fm-room-list") as HTMLUListElement | null;
const gaLinkEl = document.getElementById("fm-ga-link") as HTMLAnchorElement | null;
const markRoomLegendEl = document.querySelector("#fm-mark-room-fieldset legend") as HTMLElement | null;
const savedRoomsHeadingEl = document.getElementById("fm-saved-heading") as HTMLElement | null;
const pickerHeadingEl = document.querySelector("#fm-picker-panel h2") as HTMLElement | null;
const pickerHintEl = document.querySelector("#fm-picker-panel > .hint") as HTMLElement | null;
const pageTitleEl = document.querySelector("h1") as HTMLElement | null;

function partNoun(kind?: string | null): { singular: string; plural: string; title: string; kindLabel: string } {
  const k = String(kind || "FLOORMAP").toUpperCase();
  if (k === "FLOORMAP") {
    return { singular: "ruimte", plural: "ruimten", title: "Plattegrond", kindLabel: "Plattegrond" };
  }
  if (k === "FACADE") {
    return { singular: "component", plural: "componenten", title: "Gevel", kindLabel: "Gevel" };
  }
  if (k === "CROSS_SECTION") {
    return {
      singular: "component",
      plural: "componenten",
      title: "Dwarsdoorsnede",
      kindLabel: "Dwarsdoorsnede",
    };
  }
  if (k === "SECTION") {
    return {
      singular: "component",
      plural: "componenten",
      title: "Doorsnede",
      kindLabel: "Doorsnede",
    };
  }
  return { singular: "component", plural: "componenten", title: "Tekening", kindLabel: "Tekening" };
}

function activePartNoun() {
  return partNoun(activeSection?.region_kind);
}

function levelLabel(hint?: string | null): string {
  switch (String(hint || "").toUpperCase()) {
    case "GROUND":
      return "Begane vloer";
    case "FIRST":
      return "Verdieping";
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

function isFloormapKind(kind?: string | null): boolean {
  return String(kind || activeSection?.region_kind || "FLOORMAP").toUpperCase() === "FLOORMAP";
}


function parseVgVrInputs(): { vg_nr: number | null; vr_nr: string | null; error?: string } {
  const vgRaw = roomVgInput.value.trim();
  const vrRaw = roomVrInput.value.trim();
  if (!vgRaw && !vrRaw) return { vg_nr: null, vr_nr: null };
  if (!vgRaw || !vrRaw) return { vg_nr: null, vr_nr: null, error: "Vul zowel VG als VR in" };
  const vg = Number(vgRaw);
  if (!Number.isInteger(vg) || vg < 1) {
    return { vg_nr: null, vr_nr: null, error: "VG moet een geheel getal ≥ 1 zijn" };
  }
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,15}$/.test(vrRaw)) {
    return {
      vg_nr: null,
      vr_nr: null,
      error: "VR moet een id zijn zoals 3 of 3A (letters/cijfers, max. 16)",
    };
  }
  return { vg_nr: vg, vr_nr: vrRaw };
}

function subsectionAreaNorm(r: RoomSubsection): number {
  return r.area_norm != null ? Number(r.area_norm) : shoelaceArea(r.points);
}

/** Largest area first — for − the first item is the subject (kozijn). */
function sortByAreaDesc(selected: RoomSubsection[]): RoomSubsection[] {
  return selected.slice().sort((a, b) => subsectionAreaNorm(b) - subsectionAreaNorm(a));
}

function differenceSubject(selected: RoomSubsection[]): RoomSubsection | null {
  if (!selected.length) return null;
  return sortByAreaDesc(selected)[0] ?? null;
}

/** Prefer sidebar VG/VR; else inherit when all selected sources agree (or subject for −). */
function resolveComponentVgVr(selected: RoomSubsection[]): {
  vg_nr: number | null;
  vr_nr: string | null;
  error?: string;
} {
  const form = parseVgVrInputs();
  if (form.error) return form;
  if (form.vg_nr != null && form.vr_nr != null) return form;

  const subj = differenceSubject(selected);
  if (subj?.vg_nr != null && subj.vr_nr) {
    return { vg_nr: Number(subj.vg_nr), vr_nr: String(subj.vr_nr) };
  }

  const vrs = [
    ...new Set(
      selected
        .map((r) => (r.vr_nr != null && String(r.vr_nr).trim() ? String(r.vr_nr).trim() : null))
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  const vgs = [
    ...new Set(
      selected
        .map((r) => (r.vg_nr != null ? Number(r.vg_nr) : null))
        .filter((v): v is number => v != null && Number.isFinite(v)),
    ),
  ];
  if (vrs.length === 1 && vgs.length === 1) {
    return { vg_nr: vgs[0], vr_nr: vrs[0] };
  }
  return { vg_nr: null, vr_nr: null };
}

function suggestNextVrNr(): string {
  const ids = rooms
    .map((r) => r.vr_nr)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
  const pureNums = ids
    .filter((id) => /^\d+$/.test(id))
    .map((id) => Number(id))
    .filter((n) => Number.isFinite(n));
  if (pureNums.length === ids.length) {
    return String((pureNums.length ? Math.max(...pureNums) : 0) + 1);
  }
  return "";
}

function suggestVgNr(): number {
  for (let i = rooms.length - 1; i >= 0; i--) {
    if (rooms[i].vg_nr != null) return rooms[i].vg_nr as number;
  }
  return 1;
}

function fillVgVrSuggestions(): void {
  if (!isFloormapKind()) {
    roomVgInput.value = "";
    roomVrInput.value = "";
    return;
  }
  roomVgInput.value = String(suggestVgNr());
  roomVrInput.value = String(suggestNextVrNr());
}

/** Keep toolbar / sidebar copy in sync with floormap vs gevel/section. */
function syncWorkspaceLabels(kind?: string | null): void {
  const n = partNoun(kind ?? activeSection?.region_kind);
  const floormap = isFloormapKind(kind ?? activeSection?.region_kind);
  const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
  if (pageTitleEl) pageTitleEl.textContent = `${n.title} analyseren`;
  if (pickerHeadingEl) pickerHeadingEl.textContent = "Schaalbare secties";
  if (pickerHintEl) {
    pickerHintEl.textContent =
      "Kies een plattegrond, gevel of doorsnede om te meten en componenten te markeren.";
  }
  if (loadBuildingBtn) loadBuildingBtn.textContent = "Ophalen";
  if (backPickerBtn) backPickerBtn.textContent = "← Overzicht";
  discoverBtn.textContent = `Ontdek ${n.plural}`;
  if (discoverBtnSide) discoverBtnSide.textContent = `Ontdek ${n.plural}`;
  if (markRoomLegendEl) markRoomLegendEl.textContent = cap;
  roomDrawBtn.textContent = `Teken ${n.singular}`;
  roomSaveBtn.textContent = `${cap} opslaan`;
  roomLabelInput.placeholder =
    floormap ? "bijv. slaapkamer 1" : "bijv. raamstrook / paneel";
  roomPendingHintEl.textContent = `Gebruik Teken ${n.singular} in Tools, klik hoekpunten, sluit af en sla op. Dubbelklik een anker om te verwijderen; Vereenvoudig dunt de omtrek.`;
  // Never pass a null node into replaceChildren — that aborts openSection before loadRooms.
  if (savedRoomsHeadingEl) {
    const badge =
      (roomCountEl && document.body.contains(roomCountEl) ? roomCountEl : null) ||
      (document.getElementById("fm-room-count") as HTMLElement | null);
    savedRoomsHeadingEl.textContent = `Opgeslagen ${n.plural} `;
    if (badge) {
      badge.className = "region-count-badge";
      badge.id = "fm-room-count";
      savedRoomsHeadingEl.appendChild(badge);
    }
  }
  if (roomsHintEl) {
    roomsHintEl.textContent = floormap
      ? `Elke ${n.singular} toont VG/VR, oppervlakte (m²) en omtrek (m) bij ingestelde schaal.`
      : `Elke ${n.singular} met VG/VR telt later mee in de berekening gevelwering voor die VR. Alleen bronnen met hetzelfde materiaal (of zonder materiaal) worden vervangen door een compositie — andere materialen blijven beschikbaar. Selecteer voor +/− compositie.`;
  }
  vgVrRowEl?.classList.remove("hidden");
  if (vgVrHintEl) {
    vgVrHintEl.classList.remove("hidden");
    vgVrHintEl.textContent = floormap
      ? "Zelfde VG + andere VR = ruimten in hetzelfde verblijfsgebied. VR is uniek per project (bijv. 1, 3A)."
      : "Koppel aan een VR (zelfde als plattegrond). Meerdere composities (materialen) binnen dezelfde buitencontour zijn mogelijk.";
  }
  setOpsFieldset?.classList.toggle("hidden", floormap);
  materialBlockEl?.classList.toggle("hidden", floormap);
  if (floormap) {
    selectedSetIds.clear();
    constituentSigns.clear();
    booleanPreview = null;
  } else {
    materialCategoriesLoaded = false;
    void ensureMaterialCategories();
  }
  renderComposeParts();
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
/** Multi-select for gevel compose (component ids). */
let selectedSetIds = new Set<string>();
/** Per selected id: + include / − subtract. Defaults applied when selecting. */
let constituentSigns = new Map<string, ComposeSign>();
let booleanPreview: BooleanPolygon | null = null;
type MaterialCategoryOpt = {
  rubriek_nr?: number | null;
  master_category: string;
  label?: string;
  material_count: number;
  subrubrieken?: Array<{ subrubriek_nr: number; category: string; label: string }>;
};

let materialCategoriesLoaded = false;
let materialCategoryMeta: MaterialCategoryOpt[] = [];
let catalogMaterials: CatalogMaterial[] = [];
let materialFilterTimer: ReturnType<typeof setTimeout> | null = null;
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
  /** Preserved holes when editing a difference result. */
  holes: Pt[][];
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
    { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
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
    if (roomsHintEl) roomsHintEl.textContent = `Set drawing scale to get ${n.singular} areas in m².`;
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
    if (roomsHintEl) {
      roomsHintEl.textContent = `${n.singular.charAt(0).toUpperCase() + n.singular.slice(1)} area (m²) and perimeter (m) use this scale.`;
    }
    calibrateBtn.textContent = "Recalibrate scale";
  } else {
    scaleStatusEl.textContent = "Not set — mark a known length, or use detected 1:N";
    calibrateHintEl.textContent = "Click Calibrate scale, mark two points, then enter that length in mm.";
    if (roomsHintEl) roomsHintEl.textContent = "Without scale, only relative sizes are shown.";
    calibrateBtn.textContent = "Calibrate scale";
  }
  updateToolHint();
}

function activeScaleMpu(): number | null {
  const mpu = activeSection?.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0)) return null;
  return mpu;
}

/** Pixel aspect H/W of the loaded crop (or stored section value). */
function activeScaleAspect(): number {
  if (canvasWidth > 0 && canvasHeight > 0) {
    return canvasHeight / canvasWidth;
  }
  return normalizeAspectYx(activeSection?.scale_aspect_yx);
}

function fmtMeasure(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function pathLengthM(pts: Pt[], mpu: number, closed: boolean): number {
  return Math.round(scaledPathLength(pts, mpu, activeScaleAspect(), closed) * 100) / 100;
}

function pathAreaM2(pts: Pt[], mpu: number): number {
  return Math.round(scaledAreaM2(shoelaceArea(pts), mpu, activeScaleAspect()) * 100) / 100;
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
    if (btn.dataset.tool === "room") btn.textContent = `Teken ${n.singular}`;
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
    sectionListEl.innerHTML = `<p class="hint">Geen schaalbare secties (plattegrond / gevel / doorsnede) voor dit project.</p>`;
    return;
  }
  for (const s of sections) {
    const card = document.createElement("article");
    card.className = "admin-project-card panel";
    const hasComponents = (s.room_count || 0) >= 1;
    const n = partNoun(s.region_kind);
    const scale =
      s.metres_per_norm_unit != null && s.metres_per_norm_unit > 0
        ? `schaal gezet (${s.scale_source})`
        : "geen schaal";
    const countLabel =
      s.room_count === 1 ? `1 ${n.singular}` : `${s.room_count} ${n.plural}`;
    card.innerHTML = `
      <h3>${s.label || n.title}</h3>
      <p class="hint">${n.kindLabel} · pagina ${s.page_index + 1} · ${countLabel} · ${scale}</p>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = hasComponents ? "section-open-btn section-open-btn--filled" : "section-open-btn section-open-btn--empty";
    btn.textContent = `Open ${n.title.toLowerCase()}`;
    btn.addEventListener("click", () => {
      void openSection(s.id);
    });
    card.appendChild(btn);
    sectionListEl.appendChild(card);
  }
}

function selectedIsKierdichting(): boolean {
  const mat = selectedCatalogMaterial();
  if (!mat) return false;
  return isLengthQuantityRubriek(mat.rubriek_nr ?? mat.master_category);
}

function componentIsLengthQuantity(r: RoomSubsection): boolean {
  const a = r.analysis;
  if (a?.quantity_kind === "length") return true;
  if (a?.length_m != null && Number.isFinite(a.length_m)) return true;
  return isLengthQuantityRubriek(a?.rubriek_nr ?? a?.master_category);
}

function roomMetricsLabel(r: RoomSubsection): string {
  const mpu =
    r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0
      ? r.metres_per_norm_unit
      : activeScaleMpu();
  const aspect = activeScaleAspect();
  const live = pendingRoom?.editingId === r.id ? pendingRoom : null;
  const pts = live ? live.points : r.points;
  const holes = live
    ? live.holes || []
    : Array.isArray(r.analysis?.holes)
      ? r.analysis!.holes!
      : [];
  const closed = live ? live.closed : true;

  if (componentIsLengthQuantity(r) || (live && !closed && selectedIsKierdichting())) {
    let len: string | null = null;
    if (pts?.length >= 2 && mpu) {
      len = `${scaledPathLength(pts, mpu, aspect, closed).toFixed(2)} m`;
    } else if (r.analysis?.length_m != null && Number.isFinite(r.analysis.length_m) && !live) {
      len = `${Number(r.analysis.length_m).toFixed(2)} m`;
    } else if (r.perimeter_m != null && Number.isFinite(r.perimeter_m) && !live) {
      len = `${r.perimeter_m.toFixed(2)} m`;
    }
    return len ? `lengte ${len}` : "lengte —";
  }

  let area = "—";
  let circ = "—";
  if (pts?.length >= 3 && mpu) {
    const holesSum = holes.reduce((s, h) => s + shoelaceArea(h), 0);
    const areaNorm = Math.max(0, shoelaceArea(pts) - holesSum);
    area = `${scaledAreaM2(areaNorm, mpu, aspect).toFixed(2)} m²`;
    circ = `${scaledPathLength(pts, mpu, aspect, true).toFixed(2)} m`;
  } else if (r.area_m2 != null && Number.isFinite(r.area_m2)) {
    area = `${r.area_m2.toFixed(2)} m²`;
    if (r.perimeter_m != null && Number.isFinite(r.perimeter_m)) {
      circ = `${r.perimeter_m.toFixed(2)} m`;
    }
  } else if (r.area_norm != null && mpu) {
    area = `${scaledAreaM2(r.area_norm, mpu, aspect).toFixed(2)} m²`;
  } else if (r.area_norm != null) {
    area = `${r.area_norm.toFixed(4)} (no scale)`;
  }

  return `${area} · circ ${circ}`;
}

let roomListRefreshTimer: ReturnType<typeof setTimeout> | null = null;
/** Refresh “Opgeslagen ruimten” while dragging an edited outline. */
function scheduleRoomListRefresh(): void {
  if (!pendingRoom?.editingId) return;
  if (roomListRefreshTimer) clearTimeout(roomListRefreshTimer);
  roomListRefreshTimer = setTimeout(() => {
    roomListRefreshTimer = null;
    renderRoomList();
  }, 40);
}

function syncPendingRoomButtons(): void {
  const n = activePartNoun();
  const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
  const has = Boolean(pendingRoom && pendingRoom.points.length > 0);
  const closed = Boolean(pendingRoom?.closed);
  const kier = !isFloormapKind() && selectedIsKierdichting();
  roomCloseBtn.disabled = !(pendingRoom?.drawing && pendingRoom.points.length >= 3 && !closed);
  const canSaveClosed = Boolean(closed && pendingRoom && pendingRoom.points.length >= 3);
  const canSaveOpenKier = Boolean(
    kier && pendingRoom && !closed && pendingRoom.points.length >= 2,
  );
  roomSaveBtn.disabled = !(canSaveClosed || canSaveOpenKier);
  roomClearBtn.disabled = !has && !pendingRoom?.drawing;
  if (roomSimplifyBtn) {
    roomSimplifyBtn.disabled = !(closed && pendingRoom && ringVertexCount(pendingRoom.points) > 3);
  }
  if (!pendingRoom) {
    roomPendingHintEl.textContent = kier
      ? `Kierdichting: teken een pad (≥2 punten) of gesloten omtrek; lengte in meters wordt opgeslagen.`
      : `Gebruik Teken ${n.singular} (Tools of hier), klik hoekpunten. Dubbelklik een anker om te verwijderen; Vereenvoudig dunt de omtrek.`;
    roomDrawBtn.textContent = `Teken ${n.singular}`;
    return;
  }
  if (pendingRoom.drawing && !pendingRoom.closed) {
    roomPendingHintEl.textContent = kier
      ? `${pendingRoom.points.length} punt(en). Opslaan mag vanaf 2 punten (lengte), of sluit polygoon voor omtrek.`
      : `${pendingRoom.points.length} hoekpunt(en). Omtrek/oppervlakte hierboven; sluit polygoon als klaar (≥3).`;
    roomDrawBtn.textContent = "Tekenen annuleren";
  } else if (pendingRoom.closed) {
    roomPendingHintEl.textContent = pendingRoom.editingId
      ? "Bewerken geometrie — sleep witte ankers, daarna Opslaan. (Labeltekst hierboven aanpassen kan ook.)"
      : kier
        ? "Polygoon klaar — omtrek (m) wordt als lengte opgeslagen voor kierdichting."
        : "Polygoon klaar — dubbelklik ankers om te verwijderen, of Vereenvoudig, daarna Opslaan.";
    roomDrawBtn.textContent = `Teken ${n.singular}`;
  }
  roomSaveBtn.textContent = `${cap} opslaan`;
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
    holes: [],
    closed: false,
    editingId: null,
    dragVertex: null,
    drawing: true,
  };
  roomLabelInput.value = `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  fillVgVrSuggestions();
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  setStatus("Klik hoeken van de ruimte op de tekening", "busy");
  drawOverlay();
}

function startDrawRoom(): void {
  if (pendingRoom?.drawing) {
    clearPendingRoom();
    setStatus("Tekenen geannuleerd", "ok");
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
  scheduleRoomListRefresh();
  setStatus(`Polygoon gesloten — sla ${activePartNoun().singular} op als klaar`, "ok");
  drawOverlay();
}

function parseBooleanOp(raw: unknown): BooleanOp | null {
  if (raw === "intersect" || raw === "union" || raw === "difference" || raw === "compose") {
    return raw;
  }
  return null;
}

function isOpenComponent(r: RoomSubsection): boolean {
  if (r.analysis?.open_path) return true;
  if (r.analysis?.quantity_kind === "length") return true;
  return ringVertexCount(r.points) < 3;
}

function ensureDefaultSigns(selected: RoomSubsection[]): void {
  if (selected.length < 1) return;
  const outer = differenceSubject(selected);
  for (const r of selected) {
    if (constituentSigns.has(r.id)) continue;
    constituentSigns.set(r.id, outer && r.id === outer.id ? "+" : "-");
  }
  for (const id of [...constituentSigns.keys()]) {
    if (!selectedSetIds.has(id)) constituentSigns.delete(id);
  }
}

function buildComposeParts(selected: RoomSubsection[]): {
  outer: RoomSubsection;
  parts: Array<{ room: RoomSubsection; sign: ComposeSign }>;
  signs: Record<string, ComposeSign>;
} {
  if (selected.length < 2) throw new Error("Selecteer minstens 2 componenten");
  for (const r of selected) {
    if (isOpenComponent(r)) {
      throw new Error(`“${r.label || r.id}” is geen gesloten vlak`);
    }
  }
  ensureDefaultSigns(selected);
  const outer = differenceSubject(selected);
  if (!outer) throw new Error("Geen buitencontour");
  for (const r of selected) {
    if (r.id === outer.id) continue;
    if (!ringFullyContained(r.points, outer.points)) {
      throw new Error(
        `“${r.label || r.id}” past niet volledig binnen de buitencontour “${outer.label || outer.id}”`,
      );
    }
  }
  const parts = selected.map((room) => ({
    room,
    sign: (constituentSigns.get(room.id) || (room.id === outer.id ? "+" : "-")) as ComposeSign,
  }));
  if (!parts.some((p) => p.sign === "+")) {
    throw new Error("Minstens één deel met + is verplicht");
  }
  const signs: Record<string, ComposeSign> = {};
  for (const p of parts) signs[p.room.id] = p.sign;
  return { outer, parts, signs };
}

function renderComposeParts(): void {
  if (!composePartsEl) return;
  composePartsEl.replaceChildren();
  if (isFloormapKind()) return;
  const selected = rooms.filter((r) => selectedSetIds.has(r.id));
  if (selected.length < 1) return;
  ensureDefaultSigns(selected);
  const outer = differenceSubject(selected);
  for (const r of sortByAreaDesc(selected)) {
    const li = document.createElement("li");
    li.className = "compose-part-row";
    if (outer && r.id === outer.id) li.classList.add("is-outer");
    const label = document.createElement("span");
    label.className = "compose-part-label";
    label.textContent = r.label || "(zonder label)";
    label.title = label.textContent;
    li.appendChild(label);
    if (outer && r.id === outer.id) {
      const badge = document.createElement("span");
      badge.className = "compose-part-badge";
      badge.textContent = "buiten";
      li.appendChild(badge);
    }
    const btns = document.createElement("div");
    btns.className = "compose-sign-btns";
    const sign = constituentSigns.get(r.id) || (outer && r.id === outer.id ? "+" : "-");
    for (const s of ["+", "-"] as ComposeSign[]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `compose-sign-btn secondary ${s === "+" ? "sign-plus" : "sign-minus"}`;
      if (sign === s) b.classList.add("active");
      b.textContent = s === "+" ? "+" : "−";
      b.title = s === "+" ? "Meenemen in compositie" : "Aftrekken van compositie";
      b.addEventListener("click", () => {
        constituentSigns.set(r.id, s);
        renderComposeParts();
        updateBooleanPreview();
      });
      btns.appendChild(b);
    }
    li.appendChild(btns);
    composePartsEl.appendChild(li);
  }
}

/** Palette for ∩/∪/− result + matching lighter source tint. */
const BOOL_LIST_PALETTE: Array<{
  accent: string;
  border: string;
  bg: string;
  accentSource: string;
  borderSource: string;
  bgSource: string;
}> = [
  {
    accent: "#1565c0",
    border: "#90caf9",
    bg: "#e3f2fd",
    accentSource: "#64b5f6",
    borderSource: "#bbdefb",
    bgSource: "#f3f9fe",
  },
  {
    accent: "#2e7d32",
    border: "#a5d6a7",
    bg: "#e8f5e9",
    accentSource: "#81c784",
    borderSource: "#c8e6c9",
    bgSource: "#f4faf4",
  },
  {
    accent: "#c62828",
    border: "#ef9a9a",
    bg: "#ffebee",
    accentSource: "#e57373",
    borderSource: "#ffcdd2",
    bgSource: "#fff6f6",
  },
  {
    accent: "#ef6c00",
    border: "#ffcc80",
    bg: "#fff3e0",
    accentSource: "#ffb74d",
    borderSource: "#ffe0b2",
    bgSource: "#fffaf3",
  },
  {
    accent: "#00838f",
    border: "#80deea",
    bg: "#e0f7fa",
    accentSource: "#4dd0e1",
    borderSource: "#b2ebf2",
    bgSource: "#f2fbfc",
  },
  {
    accent: "#455a64",
    border: "#b0bec5",
    bg: "#eceff1",
    accentSource: "#90a4ae",
    borderSource: "#cfd8dc",
    bgSource: "#f7f9fa",
  },
];

type BoolListRole = { role: "result" | "source"; group: number };

/** Map subsection id → setbewerking family (result strong / source lighter). */
function assignBooleanListGroups(items: RoomSubsection[]): Map<string, BoolListRole> {
  const map = new Map<string, BoolListRole>();
  let group = 0;
  for (const r of items) {
    const op = parseBooleanOp(r.analysis?.boolean_op);
    const src = r.analysis?.source_subsection_ids;
    if (!op || !Array.isArray(src) || src.length < 2) continue;
    map.set(r.id, { role: "result", group });
    for (const sid of src) {
      if (!sid || sid === r.id) continue;
      const existing = map.get(sid);
      if (existing?.role === "result") continue;
      if (!existing) map.set(sid, { role: "source", group });
    }
    group += 1;
  }
  return map;
}

function applyBooleanListColors(li: HTMLElement, role: BoolListRole): void {
  const pal = BOOL_LIST_PALETTE[role.group % BOOL_LIST_PALETTE.length];
  if (role.role === "result") {
    li.classList.add("drawing-list-item--bool-result");
    li.style.setProperty("--bool-accent", pal.accent);
    li.style.setProperty("--bool-border", pal.border);
    li.style.setProperty("--bool-bg", pal.bg);
  } else {
    li.classList.add("drawing-list-item--bool-source");
    li.style.setProperty("--bool-accent-source", pal.accentSource);
    li.style.setProperty("--bool-border-source", pal.borderSource);
    li.style.setProperty("--bool-bg-source", pal.bgSource);
  }
  li.dataset.boolGroup = String(role.group);
}

/**
 * When a source component's geometry changes, recompute dependents that list it
 * in analysis.source_subsection_ids (e.g. metselwerk = gevel − kozijnen).
 * Cascades in waves until no further dependents change.
 */
async function recalculateBooleanDependents(rootId: string): Promise<number> {
  if (!activeSection || !auth?.token || !rootId) return 0;
  let changed = new Set<string>([rootId]);
  let updated = 0;
  for (let wave = 0; wave < 24 && changed.size > 0; wave++) {
    const dependents = rooms.filter((r) => {
      if (r.id === rootId && wave === 0) return false;
      const op = parseBooleanOp(r.analysis?.boolean_op);
      const src = r.analysis?.source_subsection_ids;
      return Boolean(op && Array.isArray(src) && src.some((id) => changed.has(id)));
    });
    if (dependents.length === 0) break;
    const nextChanged = new Set<string>();
    for (const dep of dependents) {
      const op = parseBooleanOp(dep.analysis?.boolean_op);
      const srcIds = dep.analysis?.source_subsection_ids || [];
      if (!op || srcIds.length < 2) continue;
      const srcRooms = srcIds
        .map((id) => rooms.find((r) => r.id === id))
        .filter((r): r is RoomSubsection => Boolean(r?.points?.length));
      if (srcRooms.length < 2) {
        setStatus(`Kan “${dep.label}” niet herberekenen — broncomponent ontbreekt`, "err");
        continue;
      }
      try {
        let result: BooleanPolygon;
        if (op === "compose") {
          const stored = dep.analysis?.constituent_signs || {};
          const outerId = dep.analysis?.outer_subsection_id || differenceSubject(srcRooms)?.id;
          const signed = srcRooms.map((r) => {
            const raw = stored[r.id];
            const sign: ComposeSign =
              raw === "+" || raw === "-"
                ? raw
                : outerId && r.id === outerId
                  ? "+"
                  : "-";
            return { ring: r.points, sign };
          });
          const outer = outerId ? srcRooms.find((r) => r.id === outerId) : differenceSubject(srcRooms);
          if (outer) {
            for (const r of srcRooms) {
              if (r.id === outer.id) continue;
              if (!ringFullyContained(r.points, outer.points)) {
                throw new Error(
                  `“${r.label}” past niet meer binnen buitencontour “${outer.label}”`,
                );
              }
            }
          }
          result = composeSigned(signed);
        } else {
          result = booleanCombineLargest(
            op,
            srcRooms.map((r) => r.points),
          );
        }
        const mpu =
          dep.metres_per_norm_unit != null && dep.metres_per_norm_unit > 0
            ? dep.metres_per_norm_unit
            : activeScaleMpu();
        const areaM2 =
          mpu != null
            ? Math.round(scaledAreaM2(result.areaNorm, mpu, activeScaleAspect()) * 100) / 100
            : null;
        const prev = dep.analysis || {};
        await apiPost("/api/floormap/subsections", {
          section_id: activeSection.id,
          subsection_id: dep.id,
          label: dep.label,
          level_hint: dep.level_hint || "OTHER",
          vg_nr: dep.vg_nr,
          vr_nr: dep.vr_nr,
          points: result.outer,
          holes: result.holes,
          metres_per_norm_unit: mpu ?? undefined,
          scale_aspect_yx: activeScaleAspect(),
          analysis: {
            ...prev,
            boolean_op: op,
            source_subsection_ids: srcIds,
            holes: result.holes,
            area_norm: result.areaNorm,
            area_m2: areaM2,
          },
        });
        dep.points = result.outer;
        dep.area_norm = result.areaNorm;
        dep.area_m2 = areaM2;
        dep.analysis = {
          ...prev,
          boolean_op: op,
          source_subsection_ids: srcIds,
          holes: result.holes,
          area_norm: result.areaNorm,
          area_m2: areaM2 ?? undefined,
        };
        nextChanged.add(dep.id);
        updated += 1;
      } catch (err) {
        setStatus(
          `Herberekenen “${dep.label}” mislukt: ${err instanceof Error ? err.message : String(err)}`,
          "err",
        );
      }
    }
    changed = nextChanged;
  }
  return updated;
}

async function savePendingRoom(): Promise<void> {
  if (!pendingRoom || !activeSection || !auth) return;
  const kier = !isFloormapKind() && selectedIsKierdichting();
  const openPath = Boolean(kier && !pendingRoom.closed && pendingRoom.points.length >= 2);
  if (!openPath && !pendingRoom.closed) return;
  const points = openPath ? clampPath(pendingRoom.points) : closeRing(pendingRoom.points);
  const mpu = activeScaleMpu();
  if (kier) {
    const lenNorm = openPath ? openPolylineLength(points) : polylinePerimeter(points);
    if (lenNorm < 1e-8) {
      setStatus("Lengte te klein", "err");
      return;
    }
  } else if (shoelaceArea(points) < 1e-8) {
    setStatus("Ruimte te klein", "err");
    return;
  }
  const label =
    roomLabelInput.value.trim() ||
    `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  const level = roomLevelSelect.value || "OTHER";
  const vgVr = parseVgVrInputs();
  if (vgVr.error) {
    setStatus(vgVr.error, "err");
    return;
  }
  if (isFloormapKind() && (vgVr.vg_nr == null || vgVr.vr_nr == null)) {
    setStatus("Vul VG- en VR-nummer in", "err");
    return;
  }
  const mat = !isFloormapKind() ? selectedCatalogMaterial() : null;
  if (kier && !mat) {
    setStatus("Kies een kierdichtingsmateriaal (rubriek 9)", "err");
    return;
  }
  roomSaveBtn.disabled = true;
  setStatus(pendingRoom.editingId ? "Geometrie bijwerken…" : "Opslaan…", "busy");
  try {
    const holes = openPath ? [] : pendingRoom.holes || [];
    const editingId = pendingRoom.editingId;
    const body: Record<string, unknown> = {
      section_id: activeSection.id,
      subsection_id: editingId || undefined,
      label,
      level_hint: level,
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points,
      holes,
      metres_per_norm_unit: mpu ?? undefined,
      open_path: openPath || undefined,
      scale_aspect_yx: activeScaleAspect(),
    };
    if (mat) {
      const analysis: Record<string, unknown> = {
        material_id: mat.material_id,
        master_category: mat.master_category,
        material_name: mat.name,
        catalog_id: mat.catalog_id,
        category: mat.category || undefined,
        rubriek_nr: mat.rubriek_nr ?? undefined,
      };
      if (kier) {
        const lengthM =
          mpu != null
            ? Math.round(
                scaledPathLength(points, mpu, activeScaleAspect(), !openPath) * 100,
              ) / 100
            : undefined;
        analysis.quantity_kind = "length";
        analysis.length_norm = openPath ? openPolylineLength(points) : polylinePerimeter(points);
        if (lengthM != null) analysis.length_m = lengthM;
        analysis.open_path = openPath;
      }
      body.analysis = analysis;
      if (!editingId && !roomLabelInput.value.trim()) {
        body.label = `${mat.master_category}: ${mat.name}`;
      }
    }
    const saved = await apiPost<{
      subsection_id: string;
      area_m2: number | null;
      perimeter_m: number | null;
      analysis?: SubsectionAnalysis;
    }>("/api/floormap/subsections", body);
    const wasEdit = Boolean(editingId);
    clearPendingRoom();
    // Keep VG/VR on gevel/section so successive components can share the same VR.
    if (isFloormapKind()) {
      roomVgInput.value = "";
      roomVrInput.value = "";
    }
    await loadRooms();
    let depCount = 0;
    if (wasEdit && editingId) {
      setStatus("Afgeleide setbewerkingen herberekenen…", "busy");
      depCount = await recalculateBooleanDependents(editingId);
      if (depCount > 0) await loadRooms();
    }
    const m2 = saved.area_m2 != null ? Number(saved.area_m2) : null;
    const lenM =
      saved.analysis?.length_m != null
        ? Number(saved.analysis.length_m)
        : saved.perimeter_m != null
          ? Number(saved.perimeter_m)
          : null;
    const depBit =
      depCount > 0
        ? ` · ${depCount} afgeleide${depCount === 1 ? "" : "n"} herberekend`
        : "";
    setStatus(
      wasEdit
        ? kier && lenM != null
          ? `Geometrie bijgewerkt · lengte ${lenM.toFixed(2)} m${depBit}`
          : m2 != null
            ? `Geometrie bijgewerkt · ${m2.toFixed(2)} m²${depBit}`
            : `Geometrie bijgewerkt${depBit}`
        : kier && lenM != null
          ? `Opgeslagen ${String(body.label)} · lengte ${lenM.toFixed(2)} m`
          : m2 != null
            ? `Opgeslagen ${String(body.label)} · ${m2.toFixed(2)} m²`
            : `Opgeslagen ${String(body.label)}`,
      "ok",
    );
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
  const holes = Array.isArray(room.analysis?.holes)
    ? room.analysis!.holes!.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
    : [];
  // Prefer explicit open_path flag; otherwise treat unclosed length comps as open.
  const asOpen =
    Boolean(room.analysis?.open_path) ||
    (Boolean(room.analysis?.quantity_kind === "length") &&
      room.points.length >= 2 &&
      Math.hypot(
        room.points[0].x - room.points[room.points.length - 1].x,
        room.points[0].y - room.points[room.points.length - 1].y,
      ) > 1e-4);
  pendingRoom = {
    points: asOpen
      ? clampPath(room.points.map((p) => ({ ...p })))
      : closeRing(room.points.map((p) => ({ ...p }))),
    holes: asOpen ? [] : holes,
    closed: !asOpen,
    editingId: room.id,
    dragVertex: null,
    drawing: false,
  };
  roomLabelInput.value = room.label;
  roomLevelSelect.value = room.level_hint || "OTHER";
  roomVgInput.value = room.vg_nr != null ? String(room.vg_nr) : "";
  roomVrInput.value = room.vr_nr != null ? String(room.vr_nr) : "";
  void applyMaterialSelectionFromAnalysis(room.analysis);
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
  const selectedLi = document.querySelector("#fm-room-list .drawing-list-item.selected");
  selectedLi?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  scrollToRing(pendingRoom.points);
  setStatus(
    `Bewerken: ${room.label} — sleep ankers op de tekening, daarna «${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} opslaan»`,
    "ok",
  );
  drawOverlay();
}

async function applyMaterialSelectionFromAnalysis(a?: SubsectionAnalysis | null): Promise<void> {
  if (isFloormapKind() || !materialCategoryEl) return;
  await ensureMaterialCategories();
  const master = (a?.master_category || "").trim();
  const sub = (a?.category || "").trim();
  const mid = (a?.material_id || "").trim();
  if (materialFilterEl) materialFilterEl.value = "";
  if (!master) {
    materialCategoryEl.value = "";
    renderMaterialSubcategoryOptions();
    catalogMaterials = [];
    renderMaterialNameOptions([]);
    updateMaterialSpectrumPreview(null);
    return;
  }
  if (![...materialCategoryEl.options].some((o) => o.value === master)) {
    const opt = document.createElement("option");
    opt.value = master;
    opt.textContent = master;
    materialCategoryEl.appendChild(opt);
  }
  materialCategoryEl.value = master;
  renderMaterialSubcategoryOptions();
  // Load whole rubriek first so a deep-linked material_id is always selectable.
  if (materialSubcategoryEl) materialSubcategoryEl.value = "";
  await loadMaterialsForCategory(master, "");
  if (mid) renderMaterialNameOptions(catalogMaterials, mid);
  if (sub && materialSubcategoryEl) {
    if (![...materialSubcategoryEl.options].some((o) => o.value === sub)) {
      const opt = document.createElement("option");
      opt.value = sub;
      opt.textContent = sub;
      materialSubcategoryEl.appendChild(opt);
    }
    materialSubcategoryEl.value = sub;
  }
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  updateMaterialSpectrumPreview();
}

/** Prefer material from outer (largest) selected component. */
async function defaultMaterialFromDifferenceSubject(): Promise<void> {
  if (isFloormapKind()) return;
  const selected = rooms.filter((r) => selectedSetIds.has(r.id));
  if (!selected.length) return;
  const subj = differenceSubject(selected);
  if (!subj?.analysis?.material_id && !subj?.analysis?.master_category) return;
  await applyMaterialSelectionFromAnalysis(subj.analysis);
}

function catalogMaterialFromAnalysis(a?: SubsectionAnalysis | null): CatalogMaterial | null {
  const mid = (a?.material_id || "").trim();
  const master = (a?.master_category || "").trim();
  const name = (a?.material_name || a?.material_kind || "").trim();
  if (!mid || !master || !name) return null;
  const fromCat = catalogMaterials.find((m) => m.material_id === mid);
  if (fromCat) return fromCat;
  return {
    material_id: mid,
    catalog_id: (a?.catalog_id || "").trim(),
    material_no: 0,
    master_category: master,
    name,
    category: (a?.category || "").trim(),
    thickness_mm: null,
    ra_dba: null,
  };
}

function fmtArea(r: RoomSubsection): string {
  return roomMetricsLabel(r);
}

function fmtPerim(_r: RoomSubsection): string {
  return "";
}

function updateBooleanPreview(): void {
  booleanPreview = null;
  if (isFloormapKind() || selectedSetIds.size < 2) {
    renderComposeParts();
    drawOverlay();
    return;
  }
  try {
    const selected = rooms.filter((r) => selectedSetIds.has(r.id));
    const { parts } = buildComposeParts(selected);
    booleanPreview = composeSigned(parts.map((p) => ({ ring: p.room.points, sign: p.sign })));
  } catch {
    booleanPreview = null;
  }
  renderComposeParts();
  drawOverlay();
}

function materialAnalysisLabel(a?: SubsectionAnalysis | null): string {
  if (!a) return "";
  const op = booleanOpSymbol(a.boolean_op);
  const code = (a.catalog_id || "").trim();
  const name = a.material_name || a.material_kind || "";
  const mat = code && name ? `${code} · ${name}` : code || name;
  const cat = a.master_category || "";
  if (mat && cat) return `${op} ${cat}: ${mat}`.trim();
  if (mat) return `${op} ${mat}`.trim();
  if (cat) return `${op} ${cat}`.trim();
  return op;
}

function selectedCatalogMaterial(): CatalogMaterial | null {
  const id = (materialIdEl?.value || "").trim();
  if (!id) return null;
  return catalogMaterials.find((m) => m.material_id === id) || null;
}

function fmtSpectrumDb(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function updateMaterialSpectrumPreview(mat?: CatalogMaterial | null): void {
  if (!materialSpectrumEl) return;
  const m = mat === undefined ? selectedCatalogMaterial() : mat;
  if (!m) {
    materialSpectrumEl.classList.add("hidden");
    if (materialR125El) materialR125El.textContent = "—";
    if (materialR250El) materialR250El.textContent = "—";
    if (materialR500El) materialR500El.textContent = "—";
    if (materialR1000El) materialR1000El.textContent = "—";
    if (materialR2000El) materialR2000El.textContent = "—";
    if (materialRaEl) materialRaEl.textContent = "—";
    return;
  }
  if (materialR125El) materialR125El.textContent = fmtSpectrumDb(m.r_125_hz);
  if (materialR250El) materialR250El.textContent = fmtSpectrumDb(m.r_250_hz);
  if (materialR500El) materialR500El.textContent = fmtSpectrumDb(m.r_500_hz);
  if (materialR1000El) materialR1000El.textContent = fmtSpectrumDb(m.r_1000_hz);
  if (materialR2000El) materialR2000El.textContent = fmtSpectrumDb(m.r_2000_hz);
  if (materialRaEl) materialRaEl.textContent = fmtSpectrumDb(m.ra_dba);
  materialSpectrumEl.classList.remove("hidden");
}

function renderMaterialCategoryOptions(categories: MaterialCategoryOpt[]): void {
  if (!materialCategoryEl) return;
  const keep = materialCategoryEl.value;
  materialCategoryMeta = categories;
  materialCategoryEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— kies rubriek —";
  materialCategoryEl.appendChild(ph);
  for (const c of categories) {
    const opt = document.createElement("option");
    opt.value = c.master_category;
    opt.textContent = `${c.label || c.master_category} (${c.material_count})`;
    materialCategoryEl.appendChild(opt);
  }
  if (keep && categories.some((c) => c.master_category === keep)) {
    materialCategoryEl.value = keep;
  }
  renderMaterialSubcategoryOptions();
}

function renderMaterialSubcategoryOptions(): void {
  if (!materialSubcategoryEl) return;
  const master = (materialCategoryEl?.value || "").trim();
  const meta = materialCategoryMeta.find((c) => c.master_category === master);
  const keep = materialSubcategoryEl.value;
  materialSubcategoryEl.replaceChildren();
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "0 - Alle subrubrieken";
  materialSubcategoryEl.appendChild(all);
  const subs = meta?.subrubrieken || [];
  for (const s of subs) {
    const opt = document.createElement("option");
    opt.value = s.category;
    opt.textContent = s.label || `${s.subrubriek_nr} - ${s.category}`;
    materialSubcategoryEl.appendChild(opt);
  }
  materialSubcategoryEl.disabled = !master;
  if (keep && subs.some((s) => s.category === keep)) {
    materialSubcategoryEl.value = keep;
  } else {
    materialSubcategoryEl.value = "";
  }
}

function renderMaterialNameOptions(materials: CatalogMaterial[], selectedId?: string | null): void {
  if (!materialIdEl) return;
  materialIdEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = materials.length ? "— kies materiaal —" : "— geen materialen —";
  materialIdEl.appendChild(ph);
  for (const m of materials) {
    const opt = document.createElement("option");
    opt.value = m.material_id;
    const code = (m.catalog_id || "").trim();
    const ra = m.ra_dba != null ? ` · RA ${m.ra_dba}` : "";
    const sub = m.category ? ` · ${m.category}` : "";
    const eigen = (m.source || "").trim().toLowerCase() === "eigen" ? " · eigen" : "";
    opt.textContent = code ? `${code} · ${m.name}${sub}${ra}${eigen}` : `${m.name}${sub}${ra}${eigen}`;
    opt.title = code ? `${code} · ${m.name}` : m.name;
    materialIdEl.appendChild(opt);
  }
  materialIdEl.disabled = materials.length === 0;
  if (selectedId && materials.some((m) => m.material_id === selectedId)) {
    materialIdEl.value = selectedId;
  }
}

async function ensureMaterialCategories(): Promise<void> {
  if (!auth?.token || !materialCategoryEl) return;
  if (materialCategoriesLoaded && materialCategoryEl.options.length > 1) return;
  try {
    const data = await apiGet<{
      categories: MaterialCategoryOpt[];
    }>("/api/floormap/material-categories");
    renderMaterialCategoryOptions(data.categories || []);
    materialCategoriesLoaded = true;
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

async function loadMaterialsForCategory(category: string, q = ""): Promise<void> {
  if (!auth?.token || !materialIdEl) return;
  const keep = materialIdEl.value;
  const eigenOnly = Boolean(materialEigenOnlyEl?.checked);
  if (!category && !eigenOnly) {
    catalogMaterials = [];
    renderMaterialNameOptions([]);
    materialIdEl.disabled = true;
    updateMaterialSpectrumPreview(null);
    return;
  }
  materialIdEl.disabled = true;
  try {
    const params = new URLSearchParams({
      limit: "1000",
    });
    if (category) params.set("master_category", category);
    if (eigenOnly) params.set("source", "eigen");
    const sub = (materialSubcategoryEl?.value || "").trim();
    if (sub && category) params.set("category", sub);
    if (q.trim()) params.set("q", q.trim());
    const data = await apiGet<{ materials: CatalogMaterial[] }>(
      `/api/floormap/materials?${params.toString()}`,
    );
    catalogMaterials = data.materials || [];
    renderMaterialNameOptions(catalogMaterials, keep);
    updateMaterialSpectrumPreview();
  } catch (err) {
    catalogMaterials = [];
    renderMaterialNameOptions([]);
    updateMaterialSpectrumPreview(null);
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

function scheduleMaterialFilterReload(): void {
  if (materialFilterTimer) clearTimeout(materialFilterTimer);
  materialFilterTimer = setTimeout(() => {
    const cat = (materialCategoryEl?.value || "").trim();
    const q = (materialFilterEl?.value || "").trim();
    void loadMaterialsForCategory(cat, q);
  }, 250);
}

function booleanOpSymbol(op?: string | null): string {
  if (op === "union") return "∪";
  if (op === "intersect") return "∩";
  if (op === "difference" || op === "compose") return "±";
  return "";
}

function setComposeFeedback(text: string, kind: "ok" | "err" | "busy" | "clear" = "clear"): void {
  if (!composeFeedbackEl) return;
  composeFeedbackEl.classList.remove("is-ok", "is-err", "is-busy");
  if (kind === "clear" || !text) {
    composeFeedbackEl.textContent = "";
    return;
  }
  composeFeedbackEl.textContent = text;
  composeFeedbackEl.classList.add(kind === "ok" ? "is-ok" : kind === "err" ? "is-err" : "is-busy");
}

async function applyBooleanSet(): Promise<void> {
  if (!activeSection || !auth || isFloormapKind()) return;
  if (selectedSetIds.size < 2) {
    const msg = "Selecteer minstens 2 componenten";
    setComposeFeedback(msg, "err");
    setStatus(msg, "err");
    return;
  }
  const selected = rooms.filter((r) => selectedSetIds.has(r.id));
  if (selected.length < 2) {
    const msg = "Selecteer minstens 2 componenten";
    setComposeFeedback(msg, "err");
    setStatus(msg, "err");
    return;
  }
  if (!selectedCatalogMaterial()) {
    await defaultMaterialFromDifferenceSubject();
  }
  let mat = selectedCatalogMaterial();
  if (!mat) {
    mat = catalogMaterialFromAnalysis(differenceSubject(selected)?.analysis);
  }
  if (!mat) {
    const msg = "Kies rubriek, subrubriek en materiaal (boven bij component)";
    setComposeFeedback(msg, "err");
    setStatus(msg, "err");
    return;
  }
  setApplyBtn && (setApplyBtn.disabled = true);
  setComposeFeedback("Compositie berekenen en opslaan…", "busy");
  setStatus("Compositie berekenen…", "busy");
  try {
    const { outer, parts, signs } = buildComposeParts(selected);
    const result = composeSigned(parts.map((p) => ({ ring: p.room.points, sign: p.sign })));
    const nameParts = sortByAreaDesc(selected).map((r) => {
      const s = signs[r.id] || "-";
      return `${s}${r.label || "?"}`;
    });
    const mpu = activeScaleMpu();
    const areaM2 =
      mpu != null
        ? Math.round(scaledAreaM2(result.areaNorm, mpu, activeScaleAspect()) * 100) / 100
        : null;
    const areaBit = areaM2 != null ? ` · ${areaM2.toFixed(2)} m²` : "";
    const label = `${mat.master_category}: ${mat.name}${areaBit}`;
    const vgVr = resolveComponentVgVr(selected);
    if (vgVr.error) {
      setComposeFeedback(vgVr.error, "err");
      setStatus(vgVr.error, "err");
      return;
    }
    const saved = await apiPost<{
      subsection_id: string;
      area_m2: number | null;
      area_norm: number;
    }>("/api/floormap/subsections", {
      section_id: activeSection.id,
      label,
      level_hint: "OTHER",
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points: result.outer,
      holes: result.holes,
      metres_per_norm_unit: mpu ?? undefined,
      scale_aspect_yx: activeScaleAspect(),
      analysis: {
        material_id: mat.material_id,
        master_category: mat.master_category,
        material_name: mat.name,
        catalog_id: mat.catalog_id,
        category: mat.category || undefined,
        boolean_op: "compose",
        outer_subsection_id: outer.id,
        constituent_signs: signs,
        source_subsection_ids: selected.map((r) => r.id),
        source_labels: nameParts,
        holes: result.holes,
        area_norm: result.areaNorm,
        area_m2: areaM2,
      },
    });
    // Keep selection so another material compose can be made in the same outer.
    booleanPreview = null;
    await loadRooms();
    updateBooleanPreview();
    const savedM2 = saved.area_m2 != null ? Number(saved.area_m2) : areaM2;
    const okMsg =
      savedM2 != null
        ? `Opgeslagen: ${label} (netto ${savedM2.toFixed(2)} m²). Selectie blijft staan voor een volgende compositie.`
        : `Opgeslagen: ${label}. Selectie blijft staan voor een volgende compositie.`;
    setComposeFeedback(okMsg, "ok");
    setStatus(okMsg, "ok");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setComposeFeedback(msg, "err");
    setStatus(msg, "err");
  } finally {
    if (setApplyBtn) setApplyBtn.disabled = false;
  }
}

function coerceRingPoints(raw: unknown): Pt[] {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const out: Pt[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as { x?: unknown; y?: unknown };
    const x = Number(rec.x);
    const y = Number(rec.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y });
  }
  return out;
}

function renderRoomList(): void {
  const listEl =
    roomListEl || (document.getElementById("fm-room-list") as HTMLUListElement | null);
  const countEl =
    (roomCountEl && document.body.contains(roomCountEl) ? roomCountEl : null) ||
    (document.getElementById("fm-room-count") as HTMLElement | null);
  if (!listEl) return;
  listEl.replaceChildren();
  if (countEl) countEl.textContent = String(rooms.length);
  if (rooms.length === 0) {
    const li = document.createElement("li");
    li.className = "hint drawing-list-empty";
    li.textContent = `Nog geen ${activePartNoun().plural} — Teken ${activePartNoun().singular} of Ontdek.`;
    listEl.appendChild(li);
    return;
  }
  const allowSetSelect = !isFloormapKind();
  const booleanSourceIds = allowSetSelect ? collectBooleanSourceIds(rooms) : new Set<string>();
  const supersededIds = allowSetSelect ? collectSupersededSourceIds(rooms) : new Set<string>();
  const boolGroups = allowSetSelect ? assignBooleanListGroups(rooms) : new Map<string, BoolListRole>();
  rooms.forEach((r, index) => {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (allowSetSelect) li.classList.add("drawing-list-item--set");
    if (pendingRoom?.editingId === r.id) li.classList.add("selected");
    if (allowSetSelect && selectedSetIds.has(r.id)) li.classList.add("set-selected");
    if (allowSetSelect && booleanSourceIds.has(r.id)) li.classList.add("drawing-list-item--ga-source");
    const boolRole = boolGroups.get(r.id);
    if (boolRole) applyBooleanListColors(li, boolRole);

    if (allowSetSelect) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "set-select-cb";
      cb.checked = selectedSetIds.has(r.id);
      cb.title = "Selecteer voor +/− compositie";
      cb.addEventListener("change", () => {
        if (cb.checked) selectedSetIds.add(r.id);
        else {
          selectedSetIds.delete(r.id);
          constituentSigns.delete(r.id);
        }
        updateBooleanPreview();
        void defaultMaterialFromDifferenceSubject();
        renderRoomList();
      });
      li.appendChild(cb);
    }

    const info = document.createElement("button");
    info.type = "button";
    info.className = "drawing-list-select";
    const linked = linkedRooms.get(r.id);
    const nrBit =
      r.vg_nr != null && r.vr_nr != null
        ? `VG ${r.vg_nr} · VR ${r.vr_nr}`
        : "geen VG/VR";
    const matBit = materialAnalysisLabel(r.analysis);
    let gaBit = "";
    if (allowSetSelect) {
      if (supersededIds.has(r.id)) {
        gaBit = " · bron (vervangen in berekening)";
      } else if (booleanSourceIds.has(r.id)) {
        gaBit = " · bron (blijft in berekening)";
      } else if (r.vr_nr && r.analysis?.material_id) {
        gaBit = " · in berekening";
      } else if (r.vr_nr) {
        gaBit = " · berekening: nog materiaal";
      }
    }
    const linkBit =
      activeSection?.region_kind === "FLOORMAP" && linked
        ? ` · berekening: ${linked}`
        : activeSection?.region_kind === "FLOORMAP"
          ? " · niet in berekening"
          : "";
    const parts = [r.label || "(zonder label)", matBit, nrBit, levelLabel(r.level_hint), roomMetricsLabel(r)].filter(
      Boolean,
    );
    info.textContent = `${parts.join(" · ")}${gaBit}${linkBit}`;
    info.title = supersededIds.has(r.id)
      ? "Bron van een setbewerking met hetzelfde materiaal — vervangen door het netto-component"
      : booleanSourceIds.has(r.id)
        ? "Bron van een setbewerking met ander materiaal — blijft beschikbaar in de berekening (bijv. glas)"
        : "Klik om geometrie te bewerken";
    info.addEventListener("click", () => editRoom(r));
    li.appendChild(info);
    const actions = document.createElement("span");
    actions.className = "drawing-list-actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "secondary drawing-list-move";
    upBtn.textContent = "Omhoog";
    upBtn.title = "Verplaats omhoog in de lijst";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => {
      void moveRoom(index, -1);
    });
    actions.appendChild(upBtn);

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "secondary drawing-list-move";
    downBtn.textContent = "Omlaag";
    downBtn.title = "Verplaats omlaag in de lijst";
    downBtn.disabled = index >= rooms.length - 1;
    downBtn.addEventListener("click", () => {
      void moveRoom(index, 1);
    });
    actions.appendChild(downBtn);

    if (activeSection?.region_kind === "FLOORMAP" && buildingId) {
      const ga = document.createElement("a");
      ga.className = "secondary-link";
      const q = new URLSearchParams({ building_id: buildingId, subsection_id: r.id });
      if (r.vg_nr != null) q.set("vg_nr", String(r.vg_nr));
      if (r.vr_nr != null && String(r.vr_nr).trim()) q.set("vr_nr", String(r.vr_nr).trim());
      ga.href = `/ga.html?${q.toString()}`;
      ga.textContent = linked ? "Open berekening gevelwering" : "Koppel aan berekening gevelwering";
      ga.title = linked
        ? "Open dit VG/VR in de berekening gevelwering"
        : "Neem VG/VR over in de berekening gevelwering";
      actions.appendChild(ga);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = "Verwijderen";
    btn.addEventListener("click", () => {
      void deleteRoom(r.id);
    });
    actions.appendChild(btn);
    li.appendChild(actions);
    listEl.appendChild(li);
  });
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
    scale_aspect_yx:
      s.scale_aspect_yx != null && Number(s.scale_aspect_yx) > 0 ? Number(s.scale_aspect_yx) : null,
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
  try {
    const data = await apiGet<{ subsections: RoomSubsection[] }>(
      `/api/floormap/subsections?section_id=${encodeURIComponent(activeSection.id)}`,
    );
    rooms = (data.subsections || []).map((r) => ({
      ...r,
      points: coerceRingPoints(r.points),
      vg_nr: r.vg_nr != null ? Number(r.vg_nr) : null,
      vr_nr: r.vr_nr != null && String(r.vr_nr).trim() ? String(r.vr_nr).trim() : null,
      area_norm: r.area_norm != null ? Number(r.area_norm) : null,
      perimeter_norm: r.perimeter_norm != null ? Number(r.perimeter_norm) : null,
      area_m2: r.area_m2 != null ? Math.round(Number(r.area_m2) * 100) / 100 : null,
      perimeter_m: r.perimeter_m != null ? Math.round(Number(r.perimeter_m) * 100) / 100 : null,
      metres_per_norm_unit:
        r.metres_per_norm_unit != null && Number(r.metres_per_norm_unit) > 0
          ? Number(r.metres_per_norm_unit)
          : null,
      sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
      analysis: (() => {
        if (!(r.analysis && typeof r.analysis === "object")) return null;
        const a = r.analysis as SubsectionAnalysis;
        const holes = Array.isArray(a.holes)
          ? a.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
          : undefined;
        return { ...a, holes };
      })(),
    }));
    rooms.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
    selectedSetIds = new Set([...selectedSetIds].filter((id) => rooms.some((r) => r.id === id)));
    for (const id of [...constituentSigns.keys()]) {
      if (!selectedSetIds.has(id)) constituentSigns.delete(id);
    }
    renderRoomList();
  } catch (err) {
    rooms = [];
    renderRoomList();
    throw err;
  }
  try {
    updateBooleanPreview();
  } catch {
    booleanPreview = null;
  }
  try {
    await restoreScaleFromRooms();
  } catch {
    /* in-memory scale is enough */
  }
  try {
    await refreshLinkedRooms();
    renderRoomList();
  } catch {
    /* optional GA overlay */
  }
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
      scale_aspect_yx: activeScaleAspect(),
    });
  } catch {
    // In-memory restore is enough for this session if persist fails
  }
}

async function ensureScaleAspectSynced(): Promise<void> {
  if (!activeSection || !auth?.token) return;
  const mpu = activeSection.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0) || canvasWidth < 1 || canvasHeight < 1) return;
  const aspect = canvasHeight / canvasWidth;
  const prev = activeSection.scale_aspect_yx;
  if (prev != null && Math.abs(prev - aspect) < 1e-6) return;
  try {
    await apiPost("/api/floormap/scale", {
      section_id: activeSection.id,
      metres_per_norm_unit: mpu,
      scale_ratio: activeSection.scale_ratio,
      scale_source: activeSection.scale_source || "CALIBRATED",
      scale_aspect_yx: aspect,
    });
    activeSection.scale_aspect_yx = aspect;
    const idx = sections.findIndex((s) => s.id === activeSection!.id);
    if (idx >= 0) sections[idx] = activeSection;
    await loadRooms();
  } catch {
    activeSection.scale_aspect_yx = aspect;
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
  setStatus(`${n.title} laden…`, "busy");
  let pdfErr: unknown = null;
  let roomsErr: unknown = null;
  try {
    await loadCroppedPdf(sec);
    await tryDetectPdfScale(sec);
    await ensureScaleAspectSynced();
    updateScaleUi();
  } catch (err) {
    pdfErr = err;
  }
  try {
    await loadRooms();
  } catch (err) {
    roomsErr = err;
  }
  drawOverlay();
  if (roomsErr && pdfErr) {
    setStatus(
      `${roomsErr instanceof Error ? roomsErr.message : String(roomsErr)} · ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`,
      "err",
    );
  } else if (roomsErr) {
    setStatus(roomsErr instanceof Error ? roomsErr.message : String(roomsErr), "err");
  } else if (pdfErr) {
    setStatus(pdfErr instanceof Error ? pdfErr.message : String(pdfErr), "err");
  } else {
    setStatus(
      `${n.title} klaar — ${rooms.length} ${rooms.length === 1 ? n.singular : n.plural}`,
      "ok",
    );
  }
  await restoreAfterCatalogReturn();
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
  const rotation = typeof page.rotate === "number" ? page.rotate : 0;
  const viewport = page.getViewport({ scale: renderScale, rotation });
  const off = document.createElement("canvas");
  off.width = Math.floor(viewport.width);
  off.height = Math.floor(viewport.height);
  const octx = off.getContext("2d");
  if (!octx) throw new Error("canvas context unavailable");
  octx.setTransform(1, 0, 0, 1, 0, 0);
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
    const aspect = activeScaleAspect();
    await apiPost("/api/floormap/scale", {
      section_id: sec.id,
      metres_per_norm_unit: mpu,
      scale_ratio: found,
      scale_source: "PDF_TEXT",
      scale_aspect_yx: aspect,
    });
    sec.metres_per_norm_unit = mpu;
    sec.scale_aspect_yx = aspect;
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
  opts?: { vertexHandles?: boolean; dash?: number[]; label?: string; holes?: Pt[][] },
): void {
  if (points.length < 2) return;
  const holes = (opts?.holes || []).filter((h) => h.length >= 3);
  ctx.beginPath();
  const first = normToCanvas(points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = normToCanvas(points[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  for (const hole of holes) {
    const h0 = normToCanvas(hole[0]);
    ctx.moveTo(h0.x, h0.y);
    for (let i = 1; i < hole.length; i++) {
      const p = normToCanvas(hole[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(holes.length ? "evenodd" : "nonzero");
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
    const selected = selectedSetIds.has(r.id);
    const holes = Array.isArray(r.analysis?.holes)
      ? r.analysis!.holes!.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
      : [];
    drawPolyline(
      ctx,
      r.points,
      selected ? "#1565c0" : "#6a1b9a",
      selected ? "rgba(21,101,192,0.18)" : "rgba(106,27,154,0.12)",
      selected ? 2.2 : 1.5,
      holes.length ? { holes } : undefined,
    );
  }

  if (booleanPreview && booleanPreview.outer.length >= 3) {
    const mpu = activeScaleMpu();
    const areaBit =
      mpu != null
        ? ` ${scaledAreaM2(booleanPreview.areaNorm, mpu, activeScaleAspect()).toFixed(2)} m²`
        : "";
    drawPolyline(ctx, booleanPreview.outer, "#2e7d32", "rgba(46,125,50,0.28)", 2.5, {
      dash: [6, 3],
      label: `±${areaBit}`,
      holes: booleanPreview.holes,
    });
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
      {
        vertexHandles: pendingRoom.closed || pendingRoom.points.length >= 2,
        holes: pendingRoom.holes,
      },
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
  // Sample from an offscreen copy — never getImageData on the live view canvas.
  const sample = document.createElement("canvas");
  sample.width = cropBitmap.width;
  sample.height = cropBitmap.height;
  const sampleCtx = sample.getContext("2d", { willReadFrequently: true } as CanvasRenderingContext2DSettings);
  if (!sampleCtx) {
    setStatus("Cannot read drawing image", "err");
    discoverBtn.disabled = false;
    if (discoverBtnSide) discoverBtnSide.disabled = false;
    return;
  }
  sampleCtx.drawImage(cropBitmap, 0, 0);
  const img = sampleCtx.getImageData(0, 0, sample.width, sample.height);
  let found: ReturnType<typeof discoverRoomPolylines> = [];
  try {
    found = discoverRoomPolylines(img);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Discovery failed", "err");
    discoverBtn.disabled = false;
    if (discoverBtnSide) discoverBtnSide.disabled = false;
    return;
  }
  await paintCropView();
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
  if (isFloormapKind()) {
    let nums = parseVgVrInputs();
    if (nums.vg_nr == null || nums.vr_nr == null) {
      fillVgVrSuggestions();
      nums = parseVgVrInputs();
    }
    if (nums.error || nums.vg_nr == null || nums.vr_nr == null) {
      setStatus(nums.error || "Vul VG- en VR-nummer in (zijbalk) vóór Accept", "err");
      return;
    }
    discoveryAcceptBtn.disabled = true;
    setStatus("Ruimte opslaan…", "busy");
    try {
      const mpu = activeScaleMpu();
      await apiPost("/api/floormap/subsections", {
        section_id: activeSection.id,
        label,
        level_hint: level,
        vg_nr: nums.vg_nr,
        vr_nr: nums.vr_nr,
        points,
        metres_per_norm_unit: mpu ?? undefined,
        scale_aspect_yx: activeScaleAspect(),
      });
      await loadRooms();
      fillVgVrSuggestions();
      discovery.index += 1;
      showDiscoveryCandidate();
      if (discovery && discovery.index < discovery.candidates.length) {
        setStatus(
          `Opgeslagen ${label} — volgende kandidaat (${discovery.index + 1} van ${discovery.candidates.length})`,
          "ok",
        );
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
    } finally {
      discoveryAcceptBtn.disabled = false;
    }
    return;
  }
  discoveryAcceptBtn.disabled = true;
  setStatus("Component opslaan…", "busy");
  try {
    const mpu = activeScaleMpu();
    await apiPost("/api/floormap/subsections", {
      section_id: activeSection.id,
      label,
      level_hint: level,
      points,
      metres_per_norm_unit: mpu ?? undefined,
      scale_aspect_yx: activeScaleAspect(),
    });
    await loadRooms();
    discovery.index += 1;
    showDiscoveryCandidate();
    if (discovery && discovery.index < discovery.candidates.length) {
      setStatus(
        `Opgeslagen ${label} — volgende kandidaat (${discovery.index + 1} van ${discovery.candidates.length})`,
        "ok",
      );
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
    scheduleRoomListRefresh();
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
    scheduleRoomListRefresh();
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
    scheduleRoomListRefresh();
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
  const aspect = activeScaleAspect();
  const mpu = metresPerNormFromCalibration(mm / 1000, a, b, aspect);
  if (!(mpu > 0) || !Number.isFinite(mpu)) {
    setStatus("Calibration points too close", "err");
    return;
  }
  try {
    await apiPost("/api/floormap/scale", {
      section_id: activeSection.id,
      metres_per_norm_unit: mpu,
      scale_ratio: null,
      scale_source: "CALIBRATED",
      scale_aspect_yx: aspect,
    });
    activeSection.metres_per_norm_unit = mpu;
    activeSection.scale_aspect_yx = aspect;
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

/** Persist list order after swapping two adjacent components (delta = −1 or +1). */
async function moveRoom(index: number, delta: -1 | 1): Promise<void> {
  if (!auth?.token || !activeSection) return;
  const j = index + delta;
  if (index < 0 || j < 0 || index >= rooms.length || j >= rooms.length) return;
  const prev = rooms.slice();
  const next = rooms.slice();
  const tmp = next[index];
  next[index] = next[j];
  next[j] = tmp;
  next.forEach((r, i) => {
    r.sort_order = i;
  });
  rooms = next;
  renderRoomList();
  drawOverlay();
  try {
    await apiPost("/api/floormap/subsections/reorder", {
      section_id: activeSection.id,
      ordered_ids: rooms.map((r) => r.id),
    });
    setStatus("Volgorde opgeslagen", "ok");
  } catch (err) {
    rooms = prev;
    renderRoomList();
    drawOverlay();
    setStatus(err instanceof Error ? err.message : String(err), "err");
    try {
      await loadRooms();
    } catch {
      /* keep reverted local order */
    }
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
    scheduleRoomListRefresh();
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
      discovery.dragVertex = null;
      updateMeasureReadouts();
      drawOverlay();
    }
    return;
  }
  if (pendingRoom?.dragVertex != null) {
    pendingRoom.dragVertex = null;
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
  }
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

setApplyBtn?.addEventListener("click", () => {
  void applyBooleanSet();
});
setClearSelBtn?.addEventListener("click", () => {
  selectedSetIds.clear();
  constituentSigns.clear();
  booleanPreview = null;
  setComposeFeedback("", "clear");
  renderComposeParts();
  renderRoomList();
  drawOverlay();
  setStatus("Selectie gewist", "ok");
});
materialCategoryEl?.addEventListener("change", () => {
  if (materialFilterEl) materialFilterEl.value = "";
  renderMaterialSubcategoryOptions();
  void loadMaterialsForCategory((materialCategoryEl.value || "").trim());
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  updateMaterialSpectrumPreview(null);
});
materialSubcategoryEl?.addEventListener("change", () => {
  void loadMaterialsForCategory((materialCategoryEl?.value || "").trim(), (materialFilterEl?.value || "").trim());
});
materialFilterEl?.addEventListener("input", () => {
  scheduleMaterialFilterReload();
});
materialEigenOnlyEl?.addEventListener("change", () => {
  syncEigenOnlyFilterUi();
  // Turning the filter off should show the full category again (not a sticky eigen-id search).
  if (!materialEigenOnlyEl.checked && materialFilterEl?.value.trim()) {
    materialFilterEl.value = "";
  }
  void loadMaterialsForCategory(
    (materialCategoryEl?.value || "").trim(),
    (materialFilterEl?.value || "").trim(),
  );
});

function syncEigenOnlyFilterUi(): void {
  const on = Boolean(materialEigenOnlyEl?.checked);
  materialEigenFilterLabelEl?.classList.toggle("is-on", on);
  if (materialEigenFilterStateEl) materialEigenFilterStateEl.textContent = on ? "aan" : "uit";
  if (materialEigenOnlyEl) {
    materialEigenOnlyEl.setAttribute("aria-checked", on ? "true" : "false");
  }
}
materialIdEl?.addEventListener("change", () => {
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  updateMaterialSpectrumPreview();
});

function openMaterialCatalogEditor(): void {
  const mat = selectedCatalogMaterial();
  const matUrl = new URL("/materials.html", location.origin);
  if (mat?.material_id) matUrl.searchParams.set("material_id", mat.material_id);
  if (mat?.catalog_id) matUrl.searchParams.set("q", mat.catalog_id);
  stashComponentDraftForCatalog();
  matUrl.searchParams.set("return", componentReturnPath());
  matUrl.searchParams.set("return_label", "Terug naar gevelcomponent");
  location.assign(matUrl.toString());
}

function componentReturnPath(): string {
  const u = new URL("/floormap.html", location.origin);
  if (buildingId) u.searchParams.set("building_id", buildingId);
  if (activeSection?.id) u.searchParams.set("section_id", activeSection.id);
  u.searchParams.set("from_catalog", "1");
  return `${u.pathname}${u.search}`;
}

type ComponentDraft = {
  v: 1;
  buildingId: string;
  sectionId: string;
  pending: {
    points: Pt[];
    holes: Pt[][];
    closed: boolean;
    editingId: string | null;
    drawing: boolean;
  } | null;
  label: string;
  vg: string;
  vr: string;
  level: string;
  /** View state before opening materials catalog. */
  viewZoom?: number;
  scrollLeft?: number;
  scrollTop?: number;
  sidebarWidthPx?: number;
};

type MaterialPickPayload = {
  material_id: string;
  catalog_id?: string;
  master_category: string;
  category?: string;
  name?: string;
  /** Optional draft bundled at pick-time so geometry survives return. */
  draft?: ComponentDraft | null;
};

function stashComponentDraftForCatalog(): void {
  if (!activeSection || !buildingId) return;
  const sidebarWidthPx = getEngineerSidebarWidthPx() ?? undefined;
  const draft: ComponentDraft = {
    v: 1,
    buildingId,
    sectionId: activeSection.id,
    pending: pendingRoom
      ? {
          points: pendingRoom.points.map((p) => ({ ...p })),
          holes: (pendingRoom.holes || []).map((ring) => ring.map((p) => ({ ...p }))),
          closed: pendingRoom.closed,
          editingId: pendingRoom.editingId,
          drawing: pendingRoom.drawing,
        }
      : null,
    label: (roomLabelInput?.value || "").trim(),
    vg: (roomVgInput?.value || "").trim(),
    vr: (roomVrInput?.value || "").trim(),
    level: (roomLevelSelect?.value || "").trim() || "OTHER",
    viewZoom,
    scrollLeft: pdfScrollEl?.scrollLeft ?? 0,
    scrollTop: pdfScrollEl?.scrollTop ?? 0,
    sidebarWidthPx,
  };
  try {
    sessionStorage.setItem(COMPONENT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

function readSessionJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function coerceDraftPoints(raw: unknown): Pt[] {
  if (!Array.isArray(raw)) return [];
  const out: Pt[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const x = Number((p as Pt).x);
    const y = Number((p as Pt).y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y });
  }
  return out;
}

function coerceDraftHoles(raw: unknown): Pt[][] {
  if (!Array.isArray(raw)) return [];
  return raw.map((ring) => coerceDraftPoints(ring)).filter((ring) => ring.length >= 3);
}

function idsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function restoreAfterCatalogReturn(): Promise<void> {
  if (!activeSection || !buildingId) return;
  const urlParams = new URLSearchParams(location.search);
  const fromCatalog = urlParams.get("from_catalog") === "1";
  const pick = readSessionJson<MaterialPickPayload>(MATERIAL_PICK_KEY);
  if (!fromCatalog && !pick) return;

  if (fromCatalog) {
    urlParams.delete("from_catalog");
    const qs = urlParams.toString();
    history.replaceState({}, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
  }

  const storedDraft = readSessionJson<ComponentDraft>(COMPONENT_DRAFT_KEY);
  if (storedDraft) sessionStorage.removeItem(COMPONENT_DRAFT_KEY);
  if (pick) sessionStorage.removeItem(MATERIAL_PICK_KEY);

  const draft = (pick?.draft && pick.draft.v === 1 ? pick.draft : null) || storedDraft;

  const draftOk =
    Boolean(draft) &&
    draft!.v === 1 &&
    idsMatch(draft!.sectionId, activeSection.id) &&
    (!draft!.buildingId || idsMatch(draft!.buildingId, buildingId));

  if (draftOk && draft?.pending) {
    const points = coerceDraftPoints(draft.pending.points);
    if (points.length > 0) {
      const holes = coerceDraftHoles(draft.pending.holes);
      // Keep only short in-progress draws open; ≥3 pts → closed so Opslaan werkt.
      const keepOpen = Boolean(draft.pending.drawing) && !draft.pending.closed && points.length < 3;
      const closed = !keepOpen && (Boolean(draft.pending.closed) || points.length >= 3);
      pendingRoom = {
        points: closed ? closeRing(points) : points,
        holes: closed ? holes : [],
        closed,
        editingId: draft.pending.editingId || null,
        dragVertex: null,
        drawing: !closed && Boolean(draft.pending.drawing),
      };
      if (roomLabelInput) roomLabelInput.value = draft.label || "";
      if (roomVgInput) roomVgInput.value = draft.vg || "";
      if (roomVrInput) roomVrInput.value = draft.vr || "";
      if (roomLevelSelect) roomLevelSelect.value = draft.level || "OTHER";
      syncToolButtons();
      updateMeasureReadouts();
      updateToolHint();
      renderRoomList();
      drawOverlay();
    }
  } else if (draftOk && draft) {
    if (roomLabelInput && draft.label) roomLabelInput.value = draft.label;
    if (roomVgInput && draft.vg) roomVgInput.value = draft.vg;
    if (roomVrInput && draft.vr) roomVrInput.value = draft.vr;
    if (roomLevelSelect && draft.level) roomLevelSelect.value = draft.level;
  }

  if (pick?.material_id && pick.master_category && !isFloormapKind()) {
    await applyMaterialSelectionFromAnalysis({
      material_id: pick.material_id,
      master_category: pick.master_category,
      category: pick.category || "",
      material_name: pick.name || "",
      catalog_id: pick.catalog_id || "",
    });
    if (materialIdEl && pick.material_id && materialIdEl.value !== pick.material_id) {
      if (![...materialIdEl.options].some((o) => o.value === pick.material_id)) {
        const opt = document.createElement("option");
        opt.value = pick.material_id;
        opt.textContent = `${pick.catalog_id || pick.material_id} · ${pick.name || "materiaal"}`;
        materialIdEl.appendChild(opt);
        if (!catalogMaterials.some((m) => m.material_id === pick.material_id)) {
          catalogMaterials.push({
            material_id: pick.material_id,
            catalog_id: pick.catalog_id || "",
            material_no: 0,
            master_category: pick.master_category,
            name: pick.name || pick.material_id,
            category: pick.category || "",
            thickness_mm: null,
            ra_dba: null,
          });
        }
      }
      materialIdEl.value = pick.material_id;
      materialIdEl.disabled = false;
      updateMaterialSpectrumPreview();
    }
    const label = (pick.name || pick.catalog_id || pick.material_id).trim();
    setStatus(
      pendingRoom
        ? `Materiaal «${label}» overgenomen — sla het component op om te koppelen`
        : `Materiaal «${label}» geselecteerd voor het component`,
      "ok",
    );
  } else if (draftOk && pendingRoom) {
    setStatus("Componentconcept hersteld na catalogus", "ok");
  }

  if (draftOk && draft) await restoreViewStateFromDraft(draft);
  syncPendingRoomButtons();
}

async function restoreViewStateFromDraft(draft: ComponentDraft): Promise<void> {
  if (draft.sidebarWidthPx != null && draft.sidebarWidthPx > 0) {
    setEngineerSidebarWidthPx(draft.sidebarWidthPx);
  }

  const z = Number(draft.viewZoom);
  if (Number.isFinite(z) && z > 0) {
    await setViewZoom(z);
  }

  const left = Number(draft.scrollLeft);
  const top = Number(draft.scrollTop);
  const hasScroll = (Number.isFinite(left) && left > 0) || (Number.isFinite(top) && top > 0);
  if (hasScroll && pdfScrollEl) {
    const applyScroll = () => {
      pdfScrollEl.scrollLeft = Math.max(0, left || 0);
      pdfScrollEl.scrollTop = Math.max(0, top || 0);
    };
    applyScroll();
    requestAnimationFrame(applyScroll);
  } else if (pendingRoom?.points.length) {
    queueMicrotask(() => {
      if (pendingRoom?.points.length) scrollToRing(pendingRoom.points);
    });
  }
}

function setCustomMatPanelOpen(open: boolean): void {
  if (!customMatPanelEl) return;
  customMatPanelEl.classList.toggle("hidden", !open);
  if (open) void ensureCustomMatRubrieken();
}

async function ensureCustomMatRubrieken(): Promise<void> {
  if (!customMatRubriekEl || !auth) return;
  await ensureMaterialCategories();
  if (customMatRubriekEl.options.length > 1) return;
  customMatRubriekEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "— kies rubriek —";
  customMatRubriekEl.appendChild(ph);
  for (const c of materialCategoryMeta) {
    if (c.rubriek_nr == null) continue;
    const o = document.createElement("option");
    o.value = String(c.rubriek_nr);
    o.textContent = c.label || c.master_category;
    customMatRubriekEl.appendChild(o);
  }
  const current = materialCategoryMeta.find((c) => c.master_category === (materialCategoryEl?.value || "").trim());
  if (current?.rubriek_nr != null) customMatRubriekEl.value = String(current.rubriek_nr);
}

openMatCatalogBtn?.addEventListener("click", () => {
  openMaterialCatalogEditor();
});

customMatToggleBtn?.addEventListener("click", () => {
  setCustomMatPanelOpen(true);
  if (customMatNameEl && !customMatNameEl.value.trim()) {
    customMatNameEl.value = (roomLabelInput?.value || "").trim();
  }
});

customMatCancelBtn?.addEventListener("click", () => {
  setCustomMatPanelOpen(false);
});

customMatForm?.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth?.token) throw new Error("Niet ingelogd");
    const rubriek = Number(customMatRubriekEl?.value || "");
    const name = (customMatNameEl?.value || "").trim();
    const ra = Number(customMatRaEl?.value);
    if (!Number.isInteger(rubriek) || rubriek < 1) throw new Error("Kies een rubriek");
    if (!name) throw new Error("Naam is verplicht");
    if (!Number.isFinite(ra) || ra < 0 || ra > 100) throw new Error("RA moet tussen 0 en 100 liggen");

    const subsectionId = pendingRoom?.editingId || "";
    setStatus("Eigen materiaal opslaan…", "busy");
    const data = await apiPost<{
      material: {
        material_id: string;
        name: string;
        ra_dba: number;
        catalog_id: string;
        master_category: string;
        rubriek_nr?: number;
      };
      assigned: boolean;
    }>("/api/floormap/materials", {
      name,
      ra_dba: ra,
      rubriek_nr: rubriek,
      subsection_id: subsectionId || undefined,
    });

    const master =
      data.material.master_category ||
      materialCategoryMeta.find((c) => c.rubriek_nr === rubriek)?.master_category ||
      "";
    await ensureMaterialCategories();
    if (materialCategoryEl && master) {
      if (![...materialCategoryEl.options].some((o) => o.value === master)) {
        const opt = document.createElement("option");
        opt.value = master;
        opt.textContent = master;
        materialCategoryEl.appendChild(opt);
      }
      materialCategoryEl.value = master;
      renderMaterialSubcategoryOptions();
    }
    if (materialEigenOnlyEl) {
      // Keep full catalog visible; the new eigen row is selected below.
      materialEigenOnlyEl.checked = false;
      syncEigenOnlyFilterUi();
    }
    if (materialFilterEl) materialFilterEl.value = "";
    await loadMaterialsForCategory(master, "");
    if (materialIdEl) {
      if (![...materialIdEl.options].some((o) => o.value === data.material.material_id)) {
        const opt = document.createElement("option");
        opt.value = data.material.material_id;
        opt.textContent = `${data.material.catalog_id} · ${data.material.name} · eigen`;
        materialIdEl.appendChild(opt);
        if (!catalogMaterials.some((m) => m.material_id === data.material.material_id)) {
          catalogMaterials.push({
            material_id: data.material.material_id,
            catalog_id: data.material.catalog_id,
            material_no: 0,
            master_category: master,
            name: data.material.name,
            category: "",
            thickness_mm: null,
            ra_dba: data.material.ra_dba,
          });
        }
      }
      materialIdEl.value = data.material.material_id;
      materialIdEl.disabled = false;
    }
    updateMaterialSpectrumPreview();
    syncPendingRoomButtons();
    setCustomMatPanelOpen(false);
    if (customMatNameEl) customMatNameEl.value = "";
    if (data.assigned && subsectionId) {
      await loadRooms();
      setStatus(`Materiaal «${data.material.name}» opgeslagen en gekoppeld aan component`, "ok");
    } else {
      setStatus(
        `Materiaal «${data.material.name}» opgeslagen — kies Component opslaan om te koppelen`,
        "ok",
      );
    }
  })().catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
});

function updateMaterialQuantityHint(): void {
  const hint = materialBlockEl?.querySelector(".hint:last-of-type") || materialBlockEl?.querySelector(".hint");
  if (!(hint instanceof HTMLElement)) return;
  if (selectedIsKierdichting()) {
    hint.textContent =
      "Rubriek 9 (kierdichting): lengte in meters wordt opgeslagen (pad ≥2 punten of gesloten omtrek). Geen oppervlakte.";
  } else {
    hint.textContent =
      "Kies rubriek + subrubriek en een catalogusmateriaal, of maak een eigen materiaal. Nodig voor de berekening gevelwering per VR.";
  }
}

backPickerBtn.addEventListener("click", () => {
  endDiscovery();
  endCalibrate();
  clearMeasure(false);
  selectedSetIds.clear();
  constituentSigns.clear();
  booleanPreview = null;
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

(() => {
  const panel = document.getElementById("fm-tools-bar") as HTMLDetailsElement | null;
  if (!panel) return;
  const key = "app-gevelwering-tools-collapsed";
  panel.open = localStorage.getItem(key) !== "1";
  panel.addEventListener("toggle", () => {
    localStorage.setItem(key, panel.open ? "0" : "1");
  });
})();
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
syncEigenOnlyFilterUi();

function connect(): void {
  setStatus("Connecting…", "busy");
  setConnLed(false);
  ws = new WebSocket(BPP_WS);
  ws.addEventListener("open", () => {
    setConnLed(true);
    void (async () => {
      try {
        await send("session.open", { client: "app-gevelwering-floormap" }, "session.opened");
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
initPasswordToggles();
initEngineerLayoutSplit();
connect();
