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
  insertRingVertex,
  parseScaleRatioFromText,
  polylinePerimeter,
  removeRingVertex,
  ringVertexCount,
  scaledAreaM2,
  scaledPathLength,
  shoelaceArea,
  simplifyEditableRing,
  translateRing,
  translateRingUnclamped,
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
import {
  DEFAULT_KOZIJN_WIDTH_M,
  closestPointOnSegment,
  collectKozijnSnapTargets,
  evaluateKozijnFrame,
  kozijnEdgePieces,
  kozijnWeldTolFromPixels,
  kozijnWoodBeamMetrics,
  newKozijnSegmentId,
  openingAreaNormInsideWall,
  orthoSnapPoint,
  parseKozijnFrame,
  serializeKozijnFrame,
  snapPointToKozijnEdge,
  weldKozijnPoints,
  type KozijnEval,
  type KozijnSegment,
} from "./kozijn-frame";
import {
  collectBooleanSourceIds,
  collectSupersededSourceIds,
  composeConstituentsMissingMaterial,
} from "./ga-vr-components";
import {
  gevelMaterialExceedsContour,
  type GevelCoverageRow,
} from "./gevel-coverage.ts";
import {
  buildSealPayload,
  clearSealPayload,
  componentSealEnabled,
  isLegacySealSibling,
  KIER_SEAL_STROKE,
  KIER_SEAL_STROKE_SELECTED,
  KIER_SEAL_STROKE_TOUCHED,
  mergeAnalysisWithSeal,
  readComponentSeal,
  sealCatalogLabel,
  sealMaterialKeyFromSeal,
  type ComponentSeal,
} from "./floormap-seal";
import {
  isGlassFrameMaterial,
  isKozijnFrameMaterial,
  isLengthQuantityRubriek,
  MATERIAL_RUBRIEKEN,
} from "../lib/material-taxonomy.mjs";
import {
  discoverInteriorOpenings,
  discoverRoomPolylines,
  pixelsToSectionNorm,
  type DiscoveredOpening,
  type DiscoverInteriorMeta,
  type OpeningKind,
  type OpeningShape,
} from "./room-discover";
import {
  collectAvailableVrNrs,
  compareVrNr,
  inferLevelHintFromLabel,
  levelLabel,
  levelSortRank,
  normalizeOrientatieCode,
  normalizeVrNr,
  partNoun,
  roomListCountLabel as formatRoomListCountLabel,
  roomMatchesVrFilter,
} from "./floormap-helpers";
import { formatVrVgLabel } from "./ga-labels";
import {
  canvasToNorm as canvasToNormCore,
  canvasToNormUnclamped as canvasToNormUnclampedCore,
  eventToCanvas as eventToCanvasCore,
  hitNearPolyline as hitNearPolylineCore,
  hitPolylineEdge as hitPolylineEdgeCore,
  hitVertex as hitVertexCore,
  normRectRing,
  normRectSizeOk,
  normToCanvas as normToCanvasCore,
  normalizeNormRect,
  pointInRing as pointInRingCore,
  polylineHitRadiusPx as polylineHitRadiusPxCore,
  canClosePolygonAtCursor as canClosePolygonAtCursorCore,
  normDistancePx as normDistancePxCore,
  vertexHandleRadiusPx as vertexHandleRadiusPxCore,
  vertexHitRadiusPx as vertexHitRadiusPxCore,
} from "./floormap-canvas";
import {
  buildDiscoveryLabel,
  discoverMinAreaFractionFromPercent,
  discoveredOpeningToSectionPoints,
  openingOverlapsExisting as openingOverlapsExistingCore,
  resolveDiscoveryOuter as resolveDiscoveryOuterCore,
} from "./floormap-discovery";

import { materialKindInline } from "../lib/material-kind-labels.mjs";
import { apiAuthHeaders, loadAuth } from "./auth-store";
import {
  normalizeFlowVrNr,
  persistFlowVr,
  pickFlowVrNr,
  readFlowVr,
} from "./flow-vr";
import { resolveBppWsUrl } from "./ws-url";
import { initPasswordToggles } from "./password-toggle";
import { mountProjectMenu, type ProjectMenuApi } from "./project-menu";
import { BppSession, type AuthInfo } from "./shared/bpp-session";
import {
  fetchArrayBufferWithProgress,
  startConnLoadProgress,
  type ConnLoadProgress,
} from "./shared/conn-load-progress";
import {
  bppAddMaterialFavorite,
  bppDeleteDrawingSubsection,
  bppGetFloormapSection,
  bppListDrawingSubsections,
  bppListFloormapSections,
  bppListMaterialCategories,
  bppListMaterialFavoritePresets,
  bppListMaterialFavorites,
  bppListMaterials,
  bppMaterialFavoritePresetAction,
  bppPhase1Enabled,
  bppRemoveMaterialFavorite,
  bppReorderDrawingSubsections,
  bppSaveDrawingSubsection,
  bppSaveFloormapScale,
  bppSaveSubsectionMaterial,
} from "./bpp-api";

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
  /** Extra CW degrees on top of PDF page /Rotate (same as engineer view_rotate). */
  view_rotate?: number;
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
  material_kind?: string;
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
  /** Legacy: aparte kier-subsection gekoppeld aan dit vlak (migratie). */
  seal_for_subsection_id?: string;
  /** Kierdichting als kenmerk van dit component (omtrek). */
  seal?: ComponentSeal | null;
  length_m?: number;
  length_norm?: number;
  open_path?: boolean;
  rubriek_nr?: number;
  /** Compass codes expected for this VR’s gevelvlakken (floormap room definition). */
  expected_orientaties?: string[];
  /** CL/Cg per geveloriëntatie (dB) — vast op plattegrond, read-only in GA. */
  orientatie_correcties?: Record<string, { cl_db?: number; cg_db?: number }>;
  /** Windrichting van één gevelcomponent (FACADE/SECTION/CROSS_SECTION). */
  orientatie?: string;
  /** Gevelgroep 1–3 binnen dezelfde ori (default 1 = niet opslaan). Voor bel-etage e.d. */
  gevelgroep_nr?: number;
  /** Hoe vaak dit component meetelt in GA (oppervlak/lengte/seal); default 1. */
  repeat_count?: number;
  discovered_from_outer_id?: string;
  discovery_kind?: string;
  /** Kozijn-tekentool: hartlijnen + breedtes + opening (op hout-component). */
  kozijn_frame?: {
    assembly_id: string;
    segments: Array<{ id: string; width_m: number; points: Pt[] }>;
    opening?: Pt[][];
    opening_area_norm?: number;
    opening_area_m2?: number | null;
    wood_beam_length_m?: number | null;
    wood_area_m2?: number | null;
  };
  kozijn_assembly_id?: string;
  kozijn_role?: "wood" | "glass" | string;
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
const COMPONENT_DRAFT_KEY = "app-gevelwering-fm-component-draft";
const FM_LAST_SECTION_PREFIX = "app-gevelwering-fm-last-section:";

function urlSectionId(): string {
  return new URLSearchParams(location.search).get("section_id")?.trim() || "";
}

function lastSectionStorageKey(bid: string): string {
  return `${FM_LAST_SECTION_PREFIX}${bid.trim().toLowerCase()}`;
}

function readLastSectionId(bid: string): string {
  if (!bid) return "";
  try {
    return sessionStorage.getItem(lastSectionStorageKey(bid))?.trim() || "";
  } catch {
    return "";
  }
}

function persistLastSectionId(bid: string, sectionId: string): void {
  if (!bid || !sectionId) return;
  try {
    sessionStorage.setItem(lastSectionStorageKey(bid), sectionId);
  } catch {
    /* ignore quota */
  }
}

function clearLastSectionId(bid: string): void {
  if (!bid) return;
  try {
    sessionStorage.removeItem(lastSectionStorageKey(bid));
  } catch {
    /* ignore */
  }
}

/** Keep building_id + active section + VR in the address bar so refresh restores context. */
function syncFloormapLocation(sectionId: string | null): void {
  const url = new URL(location.href);
  if (buildingId) url.searchParams.set("building_id", buildingId);
  else url.searchParams.delete("building_id");
  if (sectionId) url.searchParams.set("section_id", sectionId);
  else url.searchParams.delete("section_id");
  url.searchParams.delete("work_mode");
  const vr = normalizeFlowVrNr(roomListVrFilter);
  if (vr) {
    url.searchParams.set("vr_nr", vr);
    const vg = buildingVrToVg.get(vr);
    if (vg != null) url.searchParams.set("vg_nr", String(vg));
    else url.searchParams.delete("vg_nr");
    if (buildingId) persistFlowVr(buildingId, vr, vg ?? null);
  } else {
    url.searchParams.delete("vr_nr");
    url.searchParams.delete("vg_nr");
  }
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function resolveSectionToOpen(bid: string): string {
  const fromUrl = urlSectionId();
  if (fromUrl) return fromUrl;
  return readLastSectionId(bid);
}

/** Geveltekening-sectie voor een plattegrond-VR (voor stap 3 vanuit Opgeslagen ruimten). */
function resolveGevelSectionIdForVr(vr: string | null | undefined): string {
  const want = normalizeVrNr(vr);
  const last = buildingId ? readLastSectionId(buildingId) : "";
  if (want && gevelCopySources?.length) {
    const hits = gevelCopySources.filter((s) => normalizeVrNr(s.vr) === want);
    if (hits.length) {
      return hits.find((h) => h.sectionId === last)?.sectionId || hits[0].sectionId;
    }
  }
  if (last) {
    const sec = sections.find((s) => s.id === last && !isFloormapKind(s.region_kind));
    if (sec) return sec.id;
  }
  return sections.find((s) => !isFloormapKind(s.region_kind))?.id || "";
}

/** Van plattegrond-ruimte → geveltekening stap 3 (materiaal / componenten vastleggen). */
async function openGevelStep3ForRoom(room: RoomSubsection): Promise<void> {
  if (!buildingId) {
    setStatus("Kies eerst een project", "err");
    return;
  }
  const vr = normalizeVrNr(room.vr_nr);
  if (!vr) {
    setStatus("Geen VR op deze ruimte — vul VG/VR eerst in", "err");
    return;
  }
  persistFlowVr(buildingId, vr, room.vg_nr);
  pendingFlowVrNr = vr;
  if (!gevelCopySources) {
    try {
      await refreshGevelCopySources();
    } catch {
      /* optioneel */
    }
  }
  const sectionId = resolveGevelSectionIdForVr(vr);
  if (!sectionId) {
    setStatus("Nog geen geveltekening — maak eerst een gevelsectie (stap 2)", "err");
    return;
  }
  setSidebarWorkMode("assign");
  setStatus(`Stap 3 · componenten vastleggen (materiaal) voor VR ${vr}…`, "busy");
  if (activeSection?.id !== sectionId) {
    await openSection(sectionId);
  } else {
    roomListVrFilter = vr;
    if (roomVrFilterEl && [...roomVrFilterEl.options].some((o) => o.value === vr)) {
      roomVrFilterEl.value = vr;
    }
    syncVgVrFormFromListFilter();
    syncFloormapLocation(sectionId);
    renderRoomList();
    drawOverlay();
  }
  setStatus(`Stap 3 · VR ${vr} — koppel materiaal aan gevelcomponenten`, "ok");
}
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
const discoverMinWrapEl = document.getElementById("fm-discover-min-wrap") as HTMLElement | null;
const discoverMinSizeEl = document.getElementById("fm-discover-min-size") as HTMLInputElement | null;
const discoverHintEl = document.getElementById("fm-discover-hint") as HTMLElement | null;
const calibrateBtn = document.getElementById("fm-calibrate-btn") as HTMLButtonElement;
const calibrateLedEl = document.getElementById("fm-calibrate-led") as HTMLElement | null;
const detailBtn = document.getElementById("fm-detail-btn") as HTMLButtonElement | null;
const detailDockEl = document.getElementById("fm-detail-dock") as HTMLElement | null;
const detailHintEl = document.getElementById("fm-detail-hint") as HTMLElement | null;
const detailRepickBtn = document.getElementById("fm-detail-repick-btn") as HTMLButtonElement | null;
const detailCloseBtn = document.getElementById("fm-detail-close-btn") as HTMLButtonElement | null;
const scaleStatusEl = document.getElementById("fm-scale-status") as HTMLElement;
const calibrateMetresWrap = document.getElementById("fm-calibrate-metres-wrap") as HTMLElement;
const calibrateMetresInput = document.getElementById("fm-calibrate-metres") as HTMLInputElement;
const calibrateApplyBtn = document.getElementById("fm-calibrate-apply-btn") as HTMLButtonElement;
const calibrateRepickBtn = document.getElementById("fm-calibrate-repick-btn") as HTMLButtonElement;
const calibrateHintEl = document.getElementById("fm-calibrate-hint") as HTMLElement;
const copyLayoutBarEl = document.getElementById("fm-copy-layout-bar") as HTMLElement | null;
const copyLayoutCb = document.getElementById("fm-copy-layout-cb") as HTMLInputElement | null;
const copyLayoutControlsEl = document.getElementById("fm-copy-layout-controls") as HTMLElement | null;
const copyLayoutSourceEl = document.getElementById("fm-copy-layout-source") as HTMLSelectElement | null;
const copyLayoutRemapVgCb = document.getElementById(
  "fm-copy-layout-remap-vg",
) as HTMLInputElement | null;
const copyLayoutBtn = document.getElementById("fm-copy-layout-btn") as HTMLButtonElement | null;
const copyGevelBarEl = document.getElementById("fm-copy-gevel-bar") as HTMLElement | null;
const copyGevelCb = document.getElementById("fm-copy-gevel-cb") as HTMLInputElement | null;
const copyGevelControlsEl = document.getElementById("fm-copy-gevel-controls") as HTMLElement | null;
const copyGevelSourceEl = document.getElementById("fm-copy-gevel-source") as HTMLSelectElement | null;
const copyGevelBtn = document.getElementById("fm-copy-gevel-btn") as HTMLButtonElement | null;

type GevelCopySource = {
  key: string;
  sectionId: string;
  sectionLabel: string;
  vr: string;
  ori: string;
  count: number;
};

/** Cached VR·ori stacks on façade drawings (for copy-bar). */
let gevelCopySources: GevelCopySource[] | null = null;
let gevelCopySourcesLoading = false;
const toolClearBtn = document.getElementById("fm-tool-clear-btn") as HTMLButtonElement | null;
const toolHintEl = document.getElementById("fm-tool-hint") as HTMLElement;
const toolLengthMmEl = document.getElementById("fm-tool-length-mm") as HTMLInputElement;
const toolCircMmEl = document.getElementById("fm-tool-circ-mm") as HTMLInputElement;
const toolAreaMm2El = document.getElementById("fm-tool-area-mm2") as HTMLInputElement;
const kozijnPanelEl = document.getElementById("fm-kozijn-panel") as HTMLElement | null;
const kozijnWidthMmEl = document.getElementById("fm-kozijn-width-mm") as HTMLInputElement | null;
const kozijnClosureEl = document.getElementById("fm-kozijn-closure") as HTMLElement | null;
const kozijnAreaEl = document.getElementById("fm-kozijn-area") as HTMLElement | null;
const kozijnNewLineBtn = document.getElementById("fm-kozijn-new-line") as HTMLButtonElement | null;
const kozijnFillGlassBtn = document.getElementById("fm-kozijn-fill-glass") as HTMLButtonElement | null;
const kozijnSaveBtn = document.getElementById("fm-kozijn-save") as HTMLButtonElement | null;
const roomLabelInput = document.getElementById("fm-room-label") as HTMLInputElement;
const roomVgInput = document.getElementById("fm-room-vg") as HTMLInputElement;
const roomVrInput = document.getElementById("fm-room-vr") as HTMLInputElement;
const vgVrRowEl = document.getElementById("fm-vg-vr-row") as HTMLElement | null;
const vgVrHintEl = document.getElementById("fm-vg-vr-hint") as HTMLElement | null;
const expectedOriBlockEl = document.getElementById("fm-expected-ori-block") as HTMLElement | null;
const expectedOriRowEl = document.getElementById("fm-expected-ori-row") as HTMLElement | null;
const expectedOriCorrEl = document.getElementById("fm-ori-corr-rows") as HTMLElement | null;
const componentOriBlockEl = document.getElementById("fm-component-ori-block") as HTMLElement | null;
const componentOriEl = document.getElementById("fm-component-ori") as HTMLSelectElement | null;
const roomLevelSelect = document.getElementById("fm-room-level") as HTMLSelectElement;
const roomPendingHintEl = document.getElementById("fm-room-pending-hint") as HTMLElement;
const roomDrawBtn = document.getElementById("fm-room-draw-btn") as HTMLButtonElement;
const roomCloseBtn = document.getElementById("fm-room-close-btn") as HTMLButtonElement;
const roomSimplifyBtn = document.getElementById("fm-room-simplify-btn") as HTMLButtonElement | null;
const roomSaveBtn = document.getElementById("fm-room-save-btn") as HTMLButtonElement;
const roomDuplicateBtn = document.getElementById("fm-room-duplicate-btn") as HTMLButtonElement | null;
const roomClearBtn = document.getElementById("fm-room-clear-btn") as HTMLButtonElement;
const roomDeleteBtn = document.getElementById("fm-room-delete-btn") as HTMLButtonElement | null;
const discoverBtnSide = document.getElementById("fm-discover-btn-side") as HTMLButtonElement | null;
const setOpsFieldset = document.getElementById("fm-set-ops-fieldset") as HTMLElement | null;
const workModeEl = document.getElementById("fm-work-mode") as HTMLElement | null;
const processDockCollapseBtn = document.getElementById(
  "fm-process-dock-collapse",
) as HTMLButtonElement | null;
const processDockDragEl = document.getElementById("fm-process-dock-drag") as HTMLElement | null;
const PROCESS_DOCK_POS_KEY = "app-gevelwering-process-dock-pos";
const PROCESS_DOCK_COLLAPSE_KEY = "app-gevelwering-process-dock-collapsed";
const materialBlockEl = document.getElementById("fm-material-block") as HTMLElement | null;
const materialCatalogBrowseEl = document.getElementById("fm-material-catalog-browse") as HTMLElement | null;
const picklistIntroEl = document.getElementById("fm-picklist-intro") as HTMLElement | null;
const materialBlockHintEl = document.getElementById("fm-material-block-hint") as HTMLElement | null;
const assignMatBlockEl = document.getElementById("fm-assign-mat-block") as HTMLElement | null;
const assignPicklistEl = document.getElementById("fm-assign-picklist") as HTMLSelectElement | null;
const assignMatBtn = document.getElementById("fm-assign-mat-btn") as HTMLButtonElement | null;
const assignClearSelBtn = document.getElementById("fm-assign-clear-sel-btn") as HTMLButtonElement | null;
const assignSelHintEl = document.getElementById("fm-assign-sel-hint") as HTMLElement | null;
const componentActionsEl = document.getElementById("fm-component-actions") as HTMLElement | null;
const drawOpsClusterEl = document.getElementById("fm-draw-ops-cluster") as HTMLElement | null;
const roomLabelWrapEl = document.getElementById("fm-room-label-wrap") as HTMLElement | null;
const roomLevelWrapEl = document.getElementById("fm-room-level-wrap") as HTMLElement | null;
const toolsBarEl = document.getElementById("fm-tools-bar") as HTMLElement | null;
const kierSuggestEl = document.getElementById("fm-kier-suggest") as HTMLElement | null;
const kierSuggestCb = document.getElementById("fm-kier-suggest-cb") as HTMLInputElement | null;
const kierSuggestHintEl = document.getElementById("fm-kier-suggest-hint") as HTMLElement | null;
const kierSuggestMatEl = document.getElementById("fm-kier-suggest-mat") as HTMLSelectElement | null;
const kierSuggestNewBtn = document.getElementById("fm-kier-suggest-new") as HTMLButtonElement | null;
/** Stap 1 picklist — verwerkingsregel 2 (kier rond kozijn). */
const regel2KierEl = document.getElementById("fm-regel2-kier") as HTMLElement | null;
const regel2KierCb = document.getElementById("fm-regel2-kier-cb") as HTMLInputElement | null;
const regel2KierHintEl = document.getElementById("fm-regel2-kier-hint") as HTMLElement | null;
const regel2KierMatEl = document.getElementById("fm-regel2-kier-mat") as HTMLSelectElement | null;
const assignRegel2HintEl = document.getElementById("fm-assign-regel2-hint") as HTMLElement | null;
const composePartsEl = document.getElementById("fm-compose-parts") as HTMLUListElement | null;
const composeFeedbackEl = document.getElementById("fm-compose-feedback") as HTMLElement | null;
const materialCategoryEl = document.getElementById("fm-material-category") as HTMLSelectElement | null;
const materialSubcategoryEl = document.getElementById(
  "fm-material-subcategory",
) as HTMLSelectElement | null;
const materialFilterEl = document.getElementById("fm-material-filter") as HTMLInputElement | null;
const materialFavoriteEl = document.getElementById("fm-material-favorite") as HTMLSelectElement | null;
const favoriteAddBtn = document.getElementById("fm-favorite-add-btn") as HTMLButtonElement | null;
const favoriteRemoveBtn = document.getElementById("fm-favorite-remove-btn") as HTMLButtonElement | null;
const presetSaveBtn = document.getElementById("fm-preset-save-btn") as HTMLButtonElement | null;
const presetApplyBtn = document.getElementById("fm-preset-apply-btn") as HTMLButtonElement | null;
const materialIdEl = document.getElementById("fm-material-id") as HTMLSelectElement | null;
const openMatCatalogBtn = document.getElementById("fm-open-mat-btn") as HTMLButtonElement | null;
const customMatToggleBtn = document.getElementById("fm-custom-mat-toggle") as HTMLButtonElement | null;
const replaceMatEl = document.getElementById("fm-replace-mat") as HTMLElement | null;
const replaceMatCb = document.getElementById("fm-replace-mat-cb") as HTMLInputElement | null;
const replaceMatControlsEl = document.getElementById("fm-replace-mat-controls") as HTMLElement | null;
const replaceMatFromEl = document.getElementById("fm-replace-mat-from") as HTMLSelectElement | null;
const replaceMatToEl = document.getElementById("fm-replace-mat-to") as HTMLSelectElement | null;
const replaceMatHintEl = document.getElementById("fm-replace-mat-hint") as HTMLElement | null;
const replaceMatBtn = document.getElementById("fm-replace-mat-btn") as HTMLButtonElement | null;
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
const editDockEl = document.getElementById("fm-edit-dock") as HTMLElement | null;
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
const editNudgeLeftBtn = document.getElementById("fm-edit-nudge-left") as HTMLButtonElement | null;
const editNudgeRightBtn = document.getElementById("fm-edit-nudge-right") as HTMLButtonElement | null;
const editNudgeUpBtn = document.getElementById("fm-edit-nudge-up") as HTMLButtonElement | null;
const editNudgeDownBtn = document.getElementById("fm-edit-nudge-down") as HTMLButtonElement | null;
const roomCountEl = document.getElementById("fm-room-count") as HTMLElement | null;
const roomsHintEl = document.getElementById("fm-rooms-hint") as HTMLElement | null;
const roomListEl = document.getElementById("fm-room-list") as HTMLUListElement | null;
const gaLinkEl = document.getElementById("fm-ga-link") as HTMLAnchorElement | null;
const fileMenuRoot = document.getElementById("fm-file-menu") as HTMLElement | null;
const markRoomLegendEl = document.querySelector("#fm-mark-room-fieldset legend") as HTMLElement | null;
const savedRoomsHeadingEl = document.getElementById("fm-saved-heading") as HTMLElement | null;
const savedHeadingTextEl = document.getElementById("fm-saved-heading-text") as HTMLElement | null;
const roomVrFilterEl = document.getElementById("fm-room-vr-filter") as HTMLSelectElement | null;
const roomGroepFilterEl = document.getElementById(
  "fm-room-groep-filter",
) as HTMLSelectElement | null;
const savedVrFilterWrapEl = document.querySelector(".saved-vr-filter") as HTMLElement | null;
const savedGroepFilterWrapEl = document.querySelector(".saved-groep-filter") as HTMLElement | null;
const pickerHeadingEl = document.querySelector("#fm-picker-panel h2") as HTMLElement | null;
const pickerHintEl = document.querySelector("#fm-picker-panel .fm-picker-head .hint") as HTMLElement | null;
const vgVrOverviewBtn = document.getElementById("fm-vgvr-overview-btn") as HTMLButtonElement | null;
const vgVrOverviewDialog = document.getElementById("fm-vgvr-overview-dialog") as HTMLDialogElement | null;
const vgVrOverviewTitleEl = document.getElementById("fm-vgvr-overview-title") as HTMLElement | null;
const vgVrOverviewMetaEl = document.getElementById("fm-vgvr-overview-meta") as HTMLElement | null;
const vgVrOverviewBodyEl = document.getElementById("fm-vgvr-overview-body") as HTMLElement | null;
const vgVrOverviewCopyBtn = document.getElementById("fm-vgvr-overview-copy") as HTMLButtonElement | null;
const pageTitleEl = document.querySelector("h1") as HTMLElement | null;

function activePartNoun() {
  return partNoun(activeSection?.region_kind);
}

function isFloormapKind(kind?: string | null): boolean {
  return String(kind || activeSection?.region_kind || "FLOORMAP").toUpperCase() === "FLOORMAP";
}

const ORIENTATIE_CODES = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"] as const;

function readExpectedOrientaties(): string[] {
  if (!expectedOriRowEl) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const input of expectedOriRowEl.querySelectorAll("input[type=checkbox]")) {
    const el = input as HTMLInputElement;
    if (!el.checked) continue;
    const code = normalizeOrientatieCode(el.value);
    if (!(ORIENTATIE_CODES as readonly string[]).includes(code) || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function readOrientatieCorrecties(): Record<string, { cl_db: number; cg_db: number }> {
  const out: Record<string, { cl_db: number; cg_db: number }> = {};
  for (const code of readExpectedOrientaties()) {
    const clEl = document.getElementById(`fm-ori-cl-${code}`) as HTMLInputElement | null;
    const cgEl = document.getElementById(`fm-ori-cg-${code}`) as HTMLInputElement | null;
    const cl = clEl?.value.trim() === "" ? 0 : Number(clEl?.value);
    const cg = cgEl?.value.trim() === "" ? 0 : Number(cgEl?.value);
    out[code] = {
      cl_db: Number.isFinite(cl) ? Math.round(cl) : 0,
      cg_db: Number.isFinite(cg) ? cg : 0,
    };
  }
  return out;
}

function syncOriCorrRows(
  preserve?: Record<string, { cl_db?: number; cg_db?: number }> | null,
): void {
  if (!expectedOriCorrEl) return;
  const codes = readExpectedOrientaties();
  const prev: Record<string, { cl_db: number; cg_db: number }> = {};
  for (const code of ORIENTATIE_CODES) {
    const clEl = document.getElementById(`fm-ori-cl-${code}`) as HTMLInputElement | null;
    const cgEl = document.getElementById(`fm-ori-cg-${code}`) as HTMLInputElement | null;
    if (!clEl && !cgEl) continue;
    prev[code] = {
      cl_db: Number(clEl?.value) || 0,
      cg_db: Number(cgEl?.value) || 0,
    };
  }
  expectedOriCorrEl.innerHTML = "";
  if (!codes.length) {
    expectedOriCorrEl.classList.add("hidden");
    return;
  }
  expectedOriCorrEl.classList.remove("hidden");
  const head = document.createElement("p");
  head.className = "fm-ori-corr-label";
  head.textContent = "CL / Cg per geveloriëntatie (dB) — CL op geluidbelasting (ruimtesom); Cg in D2m,nT";
  expectedOriCorrEl.appendChild(head);
  for (const code of codes) {
    const fromPreserve = preserve?.[code];
    const fromDom = prev[code];
    const cl =
      fromPreserve?.cl_db != null && Number.isFinite(Number(fromPreserve.cl_db))
        ? Number(fromPreserve.cl_db)
        : fromDom?.cl_db ?? 0;
    const cg =
      fromPreserve?.cg_db != null && Number.isFinite(Number(fromPreserve.cg_db))
        ? Number(fromPreserve.cg_db)
        : fromDom?.cg_db ?? 0;
    const row = document.createElement("div");
    row.className = "fm-ori-corr-row";
    row.innerHTML = `
      <span class="fm-ori-corr-code">${code}</span>
      <label>CL <input id="fm-ori-cl-${code}" type="text" inputmode="numeric" value="${Math.round(cl)}" aria-label="CL ${code}" /></label>
      <label>Cg <input id="fm-ori-cg-${code}" type="text" inputmode="decimal" value="${cg}" aria-label="Cg ${code}" /></label>
    `;
    expectedOriCorrEl.appendChild(row);
  }
}

function setExpectedOrientaties(
  codes: string[] | null | undefined,
  correcties?: Record<string, { cl_db?: number; cg_db?: number }> | null,
): void {
  if (!expectedOriRowEl) return;
  const want = new Set(
    (codes || [])
      .map((c) => normalizeOrientatieCode(c))
      .filter((c) => (ORIENTATIE_CODES as readonly string[]).includes(c)),
  );
  for (const input of expectedOriRowEl.querySelectorAll("input[type=checkbox]")) {
    const el = input as HTMLInputElement;
    el.checked = want.has(normalizeOrientatieCode(el.value));
  }
  syncOriCorrRows(correcties || null);
}

function clearExpectedOrientaties(): void {
  setExpectedOrientaties([], {});
}

function readComponentOrientatie(): string {
  const raw = componentOriEl?.value || "";
  const code = normalizeOrientatieCode(raw);
  return (ORIENTATIE_CODES as readonly string[]).includes(code) ? code : "";
}

const LAST_COMPONENT_ORI_KEY = "app-gevelwering-last-component-ori";

function lastComponentOriStorageKey(): string {
  return buildingId ? `${LAST_COMPONENT_ORI_KEY}:${buildingId}` : LAST_COMPONENT_ORI_KEY;
}

function loadLastComponentOrientatie(): string {
  try {
    const raw = sessionStorage.getItem(lastComponentOriStorageKey()) || "";
    const code = normalizeOrientatieCode(raw);
    return (ORIENTATIE_CODES as readonly string[]).includes(code) ? code : "";
  } catch {
    return "";
  }
}

let lastComponentOrientatie = "";

function rememberComponentOrientatie(code: string | null | undefined): void {
  const want = normalizeOrientatieCode(code || "");
  if (!(ORIENTATIE_CODES as readonly string[]).includes(want)) return;
  lastComponentOrientatie = want;
  try {
    sessionStorage.setItem(lastComponentOriStorageKey(), want);
  } catch {
    /* quota / private mode */
  }
}

function refreshLastComponentOrientatieFromStorage(): void {
  lastComponentOrientatie = loadLastComponentOrientatie();
}

function setComponentOrientatie(code: string | null | undefined): void {
  if (!componentOriEl) return;
  const want = normalizeOrientatieCode(code || "");
  componentOriEl.value =
    want && (ORIENTATIE_CODES as readonly string[]).includes(want) ? want : "";
}

/** Form: saved ori on component, else laatst gekozen (sneller batch-toekenning). */
function applyComponentOrientatieForEdit(saved?: string | null): void {
  const fromSaved = normalizeOrientatieCode(saved || "");
  const hasSaved = (ORIENTATIE_CODES as readonly string[]).includes(fromSaved);
  if (hasSaved) {
    setComponentOrientatie(fromSaved);
    rememberComponentOrientatie(fromSaved);
    return;
  }
  setComponentOrientatie(lastComponentOrientatie);
}

function clearComponentOrientatie(): void {
  setComponentOrientatie("");
}

/** Actieve lijstfilter → gevelgroep voor nieuwe componenten (1 = default, niet opslaan). */
function activeListGevelgroepNr(): number {
  const n = Number(roomListGroepFilter);
  return n === 2 || n === 3 ? n : 1;
}

/**
 * Gevelgroep voor ±-resultaat: bronnen delen die, anders +contour, anders lijstfilter.
 * Zonder dit verdwijnt het resultaat bij filter «groep 2» terwijl bronnen wél groep 2 zijn.
 */
function resolveComposeGevelgroepNr(
  selected: RoomSubsection[],
  outer: RoomSubsection,
): number {
  const counts = new Map<number, number>();
  for (const r of selected) {
    const n = readGevelgroepNr(r.analysis);
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  if (counts.size === 1) return [...counts.keys()][0];
  const outerN = readGevelgroepNr(outer.analysis);
  if (counts.has(outerN)) return outerN;
  let best = outerN;
  let bestC = -1;
  for (const [n, c] of counts) {
    if (c > bestC) {
      best = n;
      bestC = c;
    }
  }
  if (bestC > 0) return best;
  return activeListGevelgroepNr();
}

/** Sync VG/VR-formulier vanuit de actieve VR-lijstfilter (sticky context). */
function syncVgVrFormFromListFilter(): void {
  if (isFloormapKind() || !roomListVrFilter) return;
  roomVrInput.value = roomListVrFilter;
  const vg = buildingVrToVg.get(roomListVrFilter);
  if (vg != null) roomVgInput.value = String(vg);
}

/** Merge gevel-component analysis on save; keeps material/boolean fields from prev. */
function gevelAnalysisForSave(
  prev?: SubsectionAnalysis | null,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const ori = readComponentOrientatie();
  if (!ori) {
    throw new Error("Kies een geveloriëntatie (N…NW) voor dit component");
  }
  const base =
    prev && typeof prev === "object"
      ? { ...(prev as Record<string, unknown>) }
      : ({} as Record<string, unknown>);
  delete base.expected_orientaties;
  delete base.orientatie_correcties;
  const out: Record<string, unknown> = {
    ...base,
    ...(extra || {}),
    orientatie: ori,
  };
  // Nieuwe componenten: gevelgroep volgt de lijstfilter (VR5 · groep 2 → groep 2).
  if (!prev && !Object.prototype.hasOwnProperty.call(extra || {}, "gevelgroep_nr")) {
    const gn = activeListGevelgroepNr();
    if (gn > 1) out.gevelgroep_nr = gn;
    else delete out.gevelgroep_nr;
  }
  return out;
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

/** VG/VR from sources (unanimous or grootste buitencontour); form only if sources lack VG/VR. */
function resolveComponentVgVr(selected: RoomSubsection[]): {
  vg_nr: number | null;
  vr_nr: string | null;
  error?: string;
} {
  const form = parseVgVrInputs();
  if (form.error) return form;

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
  const subj = differenceSubject(selected);

  let inherited: { vg_nr: number; vr_nr: string } | null = null;
  if (vrs.length === 1 && vgs.length === 1) {
    inherited = { vg_nr: vgs[0], vr_nr: vrs[0] };
  } else if (subj?.vg_nr != null && subj.vr_nr) {
    // Grootste (buitencontour) bepaalt VG/VR als bronnen gedeeltelijk leeg zijn.
    inherited = { vg_nr: Number(subj.vg_nr), vr_nr: String(subj.vr_nr).trim() };
  } else if (vrs.length === 1 && subj?.vg_nr != null) {
    inherited = { vg_nr: Number(subj.vg_nr), vr_nr: vrs[0] };
  } else if (vrs.length > 1) {
    return {
      vg_nr: null,
      vr_nr: null,
      error: `Geselecteerde bronnen hebben verschillende VR’s (${vrs.join(", ")}). Maak die gelijk vóór compositie.`,
    };
  }

  if (inherited) {
    if (
      form.vg_nr != null &&
      form.vr_nr != null &&
      (form.vg_nr !== inherited.vg_nr || form.vr_nr !== inherited.vr_nr)
    ) {
      return {
        vg_nr: null,
        vr_nr: null,
        error: `Geselecteerde bronnen zijn VG ${inherited.vg_nr} · VR ${inherited.vr_nr}, maar het formulier heeft VG ${form.vg_nr} · VR ${form.vr_nr}. Zet het formulier gelijk of leeg VG/VR.`,
      };
    }
    return inherited;
  }

  if (form.vg_nr != null && form.vr_nr != null) return form;
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
  const filterVr = normalizeVrNr(roomListVrFilter) || normalizeVrNr(roomVrInput.value);
  if (filterVr && buildingVrToVg.has(filterVr)) return buildingVrToVg.get(filterVr)!;
  return 1;
}

/** Most-used VR on this gevel/section, else active list filter, else empty. */
function suggestFacadeVrNr(): string {
  if (roomListVrFilter) return roomListVrFilter;
  const counts = new Map<string, number>();
  for (const r of rooms) {
    const vr = normalizeVrNr(r.vr_nr);
    if (!vr) continue;
    counts.set(vr, (counts.get(vr) || 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [vr, n] of counts) {
    if (n > bestN) {
      best = vr;
      bestN = n;
    }
  }
  return best;
}

function fillVgVrSuggestions(): void {
  if (!isFloormapKind()) {
    // Keep sticky VG/VR across successive gevel-componenten; only fill gaps.
    if (!roomVgInput.value.trim()) roomVgInput.value = String(suggestVgNr());
    if (!roomVrInput.value.trim()) roomVrInput.value = suggestFacadeVrNr();
    return;
  }
  roomVgInput.value = String(suggestVgNr());
  roomVrInput.value = String(suggestNextVrNr());
}

function vgVrPairKey(vg: number, vr: string): string {
  return `${vg}\0${normalizeVrNr(vr) || ""}`;
}

/** Other FLOORMAP sections in this project that already have rooms. */
function floormapCopySourceCandidates(): FloormapSection[] {
  if (!activeSection) return [];
  return sections
    .filter(
      (s) =>
        isFloormapKind(s.region_kind) &&
        s.id !== activeSection!.id &&
        (s.room_count || 0) >= 1,
    )
    .slice()
    .sort((a, b) => (a.label || "").localeCompare(b.label || "", "nl"));
}

function syncCopyLayoutUi(): void {
  if (!copyLayoutBarEl) return;
  const show = Boolean(activeSection && isFloormapKind());
  copyLayoutBarEl.classList.toggle("hidden", !show);
  if (!show) {
    if (copyLayoutCb) copyLayoutCb.checked = false;
    copyLayoutControlsEl?.classList.add("hidden");
    return;
  }
  const enabled = Boolean(copyLayoutCb?.checked);
  copyLayoutControlsEl?.classList.toggle("hidden", !enabled);
  if (!copyLayoutSourceEl) return;
  const prev = copyLayoutSourceEl.value;
  const sources = floormapCopySourceCandidates();
  copyLayoutSourceEl.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = sources.length
    ? "— kies plattegrond —"
    : "— geen andere plattegrond met ruimten —";
  copyLayoutSourceEl.appendChild(placeholder);
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s.id;
    const n = s.room_count || 0;
    opt.textContent = `${s.label || "Plattegrond"} (${n} ruimte${n === 1 ? "" : "n"})`;
    copyLayoutSourceEl.appendChild(opt);
  }
  if (prev && sources.some((s) => s.id === prev)) copyLayoutSourceEl.value = prev;
  if (copyLayoutBtn) {
    copyLayoutBtn.disabled = !(enabled && copyLayoutSourceEl.value);
  }
}

async function fetchSectionRooms(sectionId: string): Promise<RoomSubsection[]> {
  if (!auth()?.token) return [];
  const raw = bppPhase1Enabled()
    ? (await bppListDrawingSubsections(invokeString, auth()!.token, sectionId)).subsections
    : (
        await apiGet<{ subsections: RoomSubsection[] }>(
          `/api/floormap/subsections?section_id=${encodeURIComponent(sectionId)}`,
        )
      ).subsections;
  return mapSubsectionRows(raw as Array<Record<string, unknown>>).sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl"),
  );
}

/**
 * VG+VR usage on FLOORMAP rooms in this project.
 * `pairs` omits `excludeSectionId` (so a source floor does not “conflict with itself”);
 * `maxVg` always considers every floor (needed when assigning new VG numbers).
 */
async function collectProjectVgVrPairs(excludeSectionId?: string): Promise<{
  pairs: Set<string>;
  maxVg: number;
}> {
  const pairs = new Set<string>();
  let maxVg = 0;
  for (const s of sections) {
    if (!isFloormapKind(s.region_kind)) continue;
    if ((s.room_count || 0) < 1 && s.id !== activeSection?.id) continue;
    const list =
      s.id === activeSection?.id ? rooms : await fetchSectionRooms(s.id);
    const skipPairs = Boolean(excludeSectionId && s.id === excludeSectionId);
    for (const r of list) {
      if (r.vg_nr == null || !normalizeVrNr(r.vr_nr)) continue;
      const vg = Number(r.vg_nr);
      if (vg > maxVg) maxVg = vg;
      if (!skipPairs) pairs.add(vgVrPairKey(vg, String(r.vr_nr)));
    }
  }
  return { pairs, maxVg };
}

function invalidateGevelCopySources(): void {
  gevelCopySources = null;
}

function parseGevelCopySourceKey(
  raw: string,
): { sectionId: string; vr: string; ori: string } | null {
  const parts = (raw || "").split("|");
  if (parts.length < 3) return null;
  const sectionId = parts[0].trim();
  const vr = normalizeVrNr(parts[1]);
  const ori = normalizeOrientatieCode(parts[2]);
  if (!sectionId || !vr || !ori) return null;
  return { sectionId, vr, ori };
}

async function refreshGevelCopySources(): Promise<void> {
  if (!auth()?.token || gevelCopySourcesLoading) return;
  gevelCopySourcesLoading = true;
  try {
    const out: GevelCopySource[] = [];
    for (const s of sections) {
      if (isFloormapKind(s.region_kind)) continue;
      if ((s.room_count || 0) < 1 && s.id !== activeSection?.id) continue;
      let list: RoomSubsection[];
      try {
        list = s.id === activeSection?.id ? rooms : await fetchSectionRooms(s.id);
      } catch {
        continue;
      }
      const groups = new Map<string, number>();
      for (const r of list) {
        if (isLegacySealSibling(r.analysis)) continue;
        const vr = normalizeVrNr(r.vr_nr);
        const ori = normalizeOrientatieCode(r.analysis?.orientatie || "");
        if (!vr || !ori || !(ORIENTATIE_CODES as readonly string[]).includes(ori)) continue;
        const k = `${vr}|${ori}`;
        groups.set(k, (groups.get(k) || 0) + 1);
      }
      for (const [k, count] of groups) {
        const [vr, ori] = k.split("|");
        out.push({
          key: `${s.id}|${vr}|${ori}`,
          sectionId: s.id,
          sectionLabel: (s.label || "Gevel").trim() || "Gevel",
          vr,
          ori,
          count,
        });
      }
    }
    out.sort((a, b) => {
      const la = `${a.sectionLabel} · VR ${a.vr} · ${a.ori}`;
      const lb = `${b.sectionLabel} · VR ${b.vr} · ${b.ori}`;
      return la.localeCompare(lb, "nl");
    });
    gevelCopySources = out;
  } finally {
    gevelCopySourcesLoading = false;
  }
  syncCopyGevelUi();
}

function syncCopyGevelUi(): void {
  if (!copyGevelBarEl) return;
  const show = Boolean(activeSection && !isFloormapKind());
  copyGevelBarEl.classList.toggle("hidden", !show);
  if (!show) {
    if (copyGevelCb) copyGevelCb.checked = false;
    copyGevelControlsEl?.classList.add("hidden");
    if (copyGevelBtn) copyGevelBtn.disabled = true;
    return;
  }
  const enabled = Boolean(copyGevelCb?.checked);
  copyGevelControlsEl?.classList.toggle("hidden", !enabled);
  if (!copyGevelSourceEl) return;

  if (enabled && gevelCopySources == null && !gevelCopySourcesLoading) {
    void refreshGevelCopySources();
  }

  const prev = copyGevelSourceEl.value;
  const sources = gevelCopySources || [];
  copyGevelSourceEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = gevelCopySourcesLoading
    ? "— bronnen laden… —"
    : sources.length
      ? "— kies bron (VR · ori) —"
      : "— geen VR · ori-stack gevonden —";
  copyGevelSourceEl.appendChild(ph);
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s.key;
    opt.textContent = `${s.sectionLabel} · VR ${s.vr} · ${s.ori} · ${s.count} component${s.count === 1 ? "" : "en"}`;
    copyGevelSourceEl.appendChild(opt);
  }
  if (prev && sources.some((s) => s.key === prev)) copyGevelSourceEl.value = prev;
  if (copyGevelBtn) {
    copyGevelBtn.disabled = !(enabled && copyGevelSourceEl.value);
  }
}

function unionStackBBox(stack: RoomSubsection[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let any = false;
  const consider = (pts: Pt[]) => {
    for (const p of pts) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      any = true;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  };
  for (const r of stack) {
    consider(r.points || []);
    if (Array.isArray(r.analysis?.holes)) {
      for (const h of r.analysis!.holes!) consider(coerceRingPoints(h));
    }
  }
  if (!any) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

/** Topological order: compose-sources before ±-results. */
function topoSortFacadeStack(items: RoomSubsection[]): RoomSubsection[] {
  const byId = new Map(items.map((r) => [r.id, r]));
  const remaining = new Set(items.map((r) => r.id));
  const out: RoomSubsection[] = [];
  while (remaining.size) {
    let progress = false;
    for (const id of [...remaining]) {
      const r = byId.get(id)!;
      const deps = isComposeResultRoom(r)
        ? (r.analysis?.source_subsection_ids || []).filter((d) => byId.has(d))
        : [];
      if (deps.every((d) => !remaining.has(d))) {
        out.push(r);
        remaining.delete(id);
        progress = true;
      }
    }
    if (progress) continue;
    for (const id of [...remaining]) {
      const r = byId.get(id)!;
      if (!isComposeResultRoom(r)) {
        out.push(r);
        remaining.delete(id);
        progress = true;
      }
    }
    if (progress) continue;
    for (const id of [...remaining]) {
      out.push(byId.get(id)!);
      remaining.delete(id);
    }
  }
  return out;
}

/**
 * Collect VR·ori stack from a façade section, including compose sources
 * referenced by ±-results even if they somehow lack ori.
 */
async function collectFacadeStackForCopy(
  sectionId: string,
  vr: string,
  ori: string,
): Promise<RoomSubsection[]> {
  const list =
    sectionId === activeSection?.id ? rooms.slice() : await fetchSectionRooms(sectionId);
  const wantVr = normalizeVrNr(vr);
  const wantOri = normalizeOrientatieCode(ori);
  const primary = list.filter((r) => {
    if (isLegacySealSibling(r.analysis)) return false;
    if (normalizeVrNr(r.vr_nr) !== wantVr) return false;
    return normalizeOrientatieCode(r.analysis?.orientatie || "") === wantOri;
  });
  if (!primary.length) return [];
  const byId = new Map(list.map((r) => [r.id, r]));
  const stack = new Map<string, RoomSubsection>();
  for (const r of primary) stack.set(r.id, r);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of [...stack.values()]) {
      if (!isComposeResultRoom(r)) continue;
      for (const sid of r.analysis?.source_subsection_ids || []) {
        if (!sid || stack.has(sid)) continue;
        const src = byId.get(sid);
        if (!src || isLegacySealSibling(src.analysis)) continue;
        stack.set(sid, src);
        grew = true;
      }
    }
  }
  return topoSortFacadeStack([...stack.values()]);
}

function analysisForFacadeStackClone(
  src: SubsectionAnalysis | null | undefined,
  idMap: Map<string, string>,
  targetOri: string,
  translatedHoles: Pt[][],
): Record<string, unknown> {
  const analysis: Record<string, unknown> = {};
  if (src?.material_id) analysis.material_id = src.material_id;
  if (src?.master_category) analysis.master_category = src.master_category;
  if (src?.material_name) analysis.material_name = src.material_name;
  if (src?.catalog_id) analysis.catalog_id = src.catalog_id;
  if (src?.category) analysis.category = src.category;
  if (src?.rubriek_nr != null) analysis.rubriek_nr = src.rubriek_nr;
  if (src?.material_kind) analysis.material_kind = src.material_kind;
  if (src?.repeat_count != null && Number(src.repeat_count) > 1) {
    analysis.repeat_count = Math.max(1, Math.min(99, Math.round(Number(src.repeat_count))));
  }
  {
    const gn = Number(src?.gevelgroep_nr);
    if (gn === 2 || gn === 3) analysis.gevelgroep_nr = gn;
  }
  if (src?.quantity_kind === "length") {
    analysis.quantity_kind = "length";
    if (src.length_m != null) analysis.length_m = src.length_m;
    if (src.length_norm != null) analysis.length_norm = src.length_norm;
    if (src.open_path) analysis.open_path = true;
  }
  analysis.orientatie = targetOri;

  const seal = readComponentSeal(src);
  if (seal?.enabled) {
    analysis.seal = {
      enabled: true,
      material_id: seal.material_id,
      catalog_id: seal.catalog_id,
      material_name: seal.material_name,
      master_category: seal.master_category,
      category: seal.category,
      rubriek_nr: seal.rubriek_nr,
      length_m: seal.length_m,
    };
  }

  const op = parseBooleanOp(src?.boolean_op);
  if (op === "compose" || op === "difference") {
    analysis.boolean_op = op;
    const srcIds = (src?.source_subsection_ids || [])
      .map((id) => idMap.get(id) || "")
      .filter(Boolean);
    if (srcIds.length) analysis.source_subsection_ids = srcIds;
    if (src?.outer_subsection_id) {
      const mapped = idMap.get(src.outer_subsection_id);
      if (mapped) analysis.outer_subsection_id = mapped;
    }
    if (src?.constituent_signs && typeof src.constituent_signs === "object") {
      const signs: Record<string, string> = {};
      for (const [oldId, sign] of Object.entries(src.constituent_signs)) {
        const nid = idMap.get(oldId);
        if (nid && (sign === "+" || sign === "-")) signs[nid] = sign;
      }
      if (Object.keys(signs).length) analysis.constituent_signs = signs;
    }
    if (Array.isArray(src?.source_labels) && src!.source_labels!.length) {
      analysis.source_labels = src!.source_labels!.slice();
    }
  }
  if (translatedHoles.length) analysis.holes = translatedHoles;
  return analysis;
}

/**
 * Exacte gevelstack (vormen + materialen + ±) van bron VR·ori → open gevel,
 * gecentreerd in het crop. Doel-VG/VR/ori uit het formulier.
 */
async function copyGevelStackFromSource(sourceKey: string): Promise<void> {
  if (!activeSection || !auth()?.token) {
    setStatus("Geen geveltekening actief", "err");
    return;
  }
  if (isFloormapKind()) {
    setStatus("Gevelstack kopiëren kan alleen op een open geveltekening", "err");
    return;
  }
  const parsed = parseGevelCopySourceKey(sourceKey);
  if (!parsed) {
    setStatus("Kies een bron VR · ori", "err");
    return;
  }

  const targetVgRaw = roomVgInput.value.trim();
  const targetVr = normalizeVrNr(roomVrInput.value);
  const targetVg = targetVgRaw ? Number(targetVgRaw) : NaN;
  const targetOri = readComponentOrientatie();
  if (!Number.isFinite(targetVg) || targetVg <= 0 || !targetVr) {
    setStatus("Vul rechts VG en VR in voor de doelstack", "err");
    return;
  }
  if (!targetOri || !(ORIENTATIE_CODES as readonly string[]).includes(targetOri)) {
    setStatus("Kies rechts de geveloriëntatie voor de doelstack", "err");
    return;
  }

  if (
    parsed.sectionId === activeSection.id &&
    parsed.vr === targetVr &&
    parsed.ori === targetOri
  ) {
    setStatus("Bron en doel zijn dezelfde VR · ori op deze gevel — kies een andere bron of ori", "err");
    return;
  }

  setStatus("Bronstack laden…", "busy");
  const stack = await collectFacadeStackForCopy(parsed.sectionId, parsed.vr, parsed.ori);
  if (!stack.length) {
    setStatus(`Geen componenten voor VR ${parsed.vr} · ${parsed.ori}`, "err");
    return;
  }

  const conflict = rooms.filter((r) => {
    if (isLegacySealSibling(r.analysis)) return false;
    if (normalizeVrNr(r.vr_nr) !== targetVr) return false;
    return normalizeOrientatieCode(r.analysis?.orientatie || "") === targetOri;
  });
  if (conflict.length) {
    const ok = window.confirm(
      `Op deze gevel staan al ${conflict.length} component(en) voor VR ${targetVr} · ${targetOri}.\n\n` +
        `Toch ${stack.length} component(en) van VR ${parsed.vr} · ${parsed.ori} toevoegen (gecentreerd)?`,
    );
    if (!ok) {
      setStatus("Kopiëren geannuleerd", "err");
      return;
    }
  } else {
    const srcSec = sections.find((s) => s.id === parsed.sectionId);
    const ok = window.confirm(
      `${stack.length} component(en) kopiëren van VR ${parsed.vr} · ${parsed.ori}` +
        `${srcSec ? ` («${srcSec.label || "bron"}»)` : ""} ` +
        `naar VG ${targetVg} · VR ${targetVr} · ${targetOri} op deze gevel (gecentreerd)?`,
    );
    if (!ok) {
      setStatus("Kopiëren geannuleerd", "err");
      return;
    }
  }

  const box = unionStackBBox(stack);
  const dx = 0.5 - (box.minX + box.maxX) / 2;
  const dy = 0.5 - (box.minY + box.maxY) / 2;
  const mpu = activeScaleMpu();
  const idMap = new Map<string, string>();
  let savedN = 0;
  if (copyGevelBtn) copyGevelBtn.disabled = true;

  try {
    for (let i = 0; i < stack.length; i++) {
      const r = stack[i];
      setStatus(`Component ${i + 1}/${stack.length} kopiëren…`, "busy");
      const asLength =
        componentIsLengthQuantity(r) ||
        r.analysis?.quantity_kind === "length" ||
        isLengthQuantityRubriek(r.analysis?.rubriek_nr ?? r.analysis?.master_category);
      const openPath = Boolean(asLength && r.analysis?.open_path);
      const srcPoints = (r.points || []).map((p) => ({ ...p }));
      const copyPoints = openPath
        ? clampPath(srcPoints.map((p) => ({ x: p.x + dx, y: p.y + dy })))
        : translateRing(srcPoints, dx, dy);
      if (openPath) {
        if (copyPoints.length < 2) {
          throw new Error(`«${r.label}»: kierdichting heeft te weinig punten`);
        }
      } else if (copyPoints.length < 4) {
        throw new Error(`«${r.label}»: polygon heeft te weinig punten`);
      }

      const holesSrc = asLength
        ? []
        : (Array.isArray(r.analysis?.holes) ? r.analysis!.holes! : [])
            .map((h) => coerceRingPoints(h))
            .filter((h) => h.length >= 3)
            .map((h) => translateRing(h, dx, dy));

      const analysis = analysisForFacadeStackClone(
        r.analysis,
        idMap,
        targetOri,
        holesSrc,
      );
      const body: Record<string, unknown> = {
        section_id: activeSection.id,
        label: r.label,
        level_hint: r.level_hint || "OTHER",
        vg_nr: targetVg,
        vr_nr: targetVr,
        points: copyPoints,
        holes: holesSrc,
        metres_per_norm_unit: mpu ?? undefined,
        scale_aspect_yx: activeScaleAspect(),
      };
      if (openPath) body.open_path = true;
      if (Object.keys(analysis).length) body.analysis = analysis;

      const saved = await saveDrawingSubsection(body);
      idMap.set(r.id, saved.subsection_id);
      upsertOptimisticRoom({
        id: saved.subsection_id,
        section_id: activeSection.id,
        label: r.label,
        level_hint: r.level_hint || "OTHER",
        vg_nr: targetVg,
        vr_nr: targetVr,
        points: copyPoints.map((p) => ({ ...p })),
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : r.area_m2,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : r.area_norm,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : r.perimeter_m,
        perimeter_norm: null,
        metres_per_norm_unit: mpu,
        analysis_status: "ok",
        sort_order: rooms.length,
        analysis: (body.analysis as SubsectionAnalysis | undefined) ?? null,
      });
      savedN += 1;
    }

    await loadRooms({ preserveOrder: true });
    invalidateGevelCopySources();
    try {
      const fresh = await fetchFloormapSections(buildingId);
      sections = fresh;
    } catch {
      if (activeSection) {
        activeSection.room_count = rooms.length;
        const idx = sections.findIndex((s) => s.id === activeSection!.id);
        if (idx >= 0) sections[idx] = activeSection;
      }
    }
    renderRoomList();
    drawOverlay();
    if (copyGevelCb) copyGevelCb.checked = false;
    syncCopyGevelUi();
    setStatus(
      `${savedN} component(en) gekopieerd (VR ${parsed.vr} · ${parsed.ori} → VR ${targetVr} · ${targetOri}, gecentreerd). Sleep hoekpunten om bij te stellen.`,
      "ok",
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    try {
      await loadRooms();
    } catch {
      /* keep partial */
    }
    renderRoomList();
    drawOverlay();
    syncCopyGevelUi();
  }
}

function isSimpleLayoutRoom(r: RoomSubsection): boolean {
  if (componentIsLengthQuantity(r)) return false;
  if (isComposeResultRoom(r)) return false;
  if (!r.points || r.points.length < 3) return false;
  return true;
}

/**
 * Copy all simple rooms from another FLOORMAP onto the active section.
 * Default: remap VG numbers (keep VR) so VG+VR stays unique project-wide.
 */
async function copyLayoutFromSection(sourceSectionId: string): Promise<void> {
  if (!activeSection || !auth()?.token) {
    setStatus("Geen plattegrond actief", "err");
    return;
  }
  if (!isFloormapKind()) {
    setStatus("Ruimte-indeling kopiëren kan alleen op een plattegrond", "err");
    return;
  }
  if (sourceSectionId === activeSection.id) {
    setStatus("Kies een andere plattegrond als bron", "err");
    return;
  }
  const sourceSec = sections.find((s) => s.id === sourceSectionId);
  if (!sourceSec) {
    setStatus("Bronplattegrond niet gevonden", "err");
    return;
  }

  setStatus("Bronindeling laden…", "busy");
  const sourceRooms = (await fetchSectionRooms(sourceSectionId)).filter(isSimpleLayoutRoom);
  if (!sourceRooms.length) {
    setStatus("Bronplattegrond heeft geen kopieerbare ruimten", "err");
    return;
  }

  if (rooms.length > 0) {
    const ok = window.confirm(
      `Deze plattegrond heeft al ${rooms.length} ruimte(n).\n\n` +
        `Toch ${sourceRooms.length} ruimte(n) van «${sourceSec.label || "bron"}» toevoegen?`,
    );
    if (!ok) {
      setStatus("Kopiëren geannuleerd", "err");
      return;
    }
  } else {
    const ok = window.confirm(
      `${sourceRooms.length} ruimte(n) kopiëren van «${sourceSec.label || "bron"}» ` +
        `naar «${activeSection.label || "deze plattegrond"}»?`,
    );
    if (!ok) {
      setStatus("Kopiëren geannuleerd", "err");
      return;
    }
  }

  const remapVg = copyLayoutRemapVgCb?.checked !== false;
  // Exclude source floor from pair conflicts; maxVg still includes it.
  const { pairs: usedPairs, maxVg } = await collectProjectVgVrPairs(sourceSectionId);

  const srcVgs = [
    ...new Set(
      sourceRooms
        .map((r) => (r.vg_nr != null ? Number(r.vg_nr) : null))
        .filter((v): v is number => v != null && v > 0),
    ),
  ].sort((a, b) => a - b);

  const vgMap = new Map<number, number>();
  if (remapVg) {
    let next = Math.max(0, maxVg) + 1;
    for (const vg of srcVgs) {
      vgMap.set(vg, next++);
    }
  } else {
    for (const vg of srcVgs) vgMap.set(vg, vg);
    const conflicts: string[] = [];
    for (const r of sourceRooms) {
      if (r.vg_nr == null || !normalizeVrNr(r.vr_nr)) continue;
      const key = vgVrPairKey(Number(r.vg_nr), String(r.vr_nr));
      if (usedPairs.has(key)) {
        conflicts.push(`VG ${r.vg_nr} · VR ${normalizeVrNr(r.vr_nr)}`);
      }
    }
    if (conflicts.length) {
      setStatus(
        `VG/VR al in gebruik — vink «Nieuwe VG-nummers» aan, of kies andere nummers. Conflict: ${conflicts.slice(0, 4).join(", ")}${conflicts.length > 4 ? "…" : ""}`,
        "err",
      );
      return;
    }
  }

  // Optional: inherit scale when this floor has none yet.
  if (
    !(activeSection.metres_per_norm_unit != null && activeSection.metres_per_norm_unit > 0) &&
    sourceSec.metres_per_norm_unit != null &&
    sourceSec.metres_per_norm_unit > 0
  ) {
    try {
      const aspect =
        sourceSec.scale_aspect_yx != null && sourceSec.scale_aspect_yx > 0
          ? Number(sourceSec.scale_aspect_yx)
          : activeScaleAspect();
      await persistSectionScale({
        section_id: activeSection.id,
        metres_per_norm_unit: Number(sourceSec.metres_per_norm_unit),
        scale_ratio: sourceSec.scale_ratio,
        scale_source: sourceSec.scale_source || "CALIBRATED",
        scale_aspect_yx: aspect,
      });
      activeSection.metres_per_norm_unit = Number(sourceSec.metres_per_norm_unit);
      activeSection.scale_aspect_yx = aspect;
      activeSection.scale_source = sourceSec.scale_source || "CALIBRATED";
      activeSection.scale_ratio = sourceSec.scale_ratio;
      const idx = sections.findIndex((s) => s.id === activeSection!.id);
      if (idx >= 0) sections[idx] = activeSection;
      updateScaleUi();
    } catch {
      /* geometry copy can still proceed without scale */
    }
  }

  const level = roomLevelSelect.value || "OTHER";
  const mpu = activeScaleMpu();
  let savedN = 0;
  if (copyLayoutBtn) copyLayoutBtn.disabled = true;
  try {
    for (let i = 0; i < sourceRooms.length; i++) {
      const r = sourceRooms[i];
      setStatus(`Ruimte ${i + 1}/${sourceRooms.length} kopiëren…`, "busy");
      const srcVg = r.vg_nr != null ? Number(r.vg_nr) : null;
      const vr = normalizeVrNr(r.vr_nr);
      if (srcVg == null || !vr) {
        throw new Error(`Ruimte «${r.label}» mist VG/VR`);
      }
      const vg = vgMap.get(srcVg) ?? srcVg;
      const holes = Array.isArray(r.analysis?.holes)
        ? r.analysis!.holes!.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
        : [];
      const analysis = analysisForDuplicate(r.analysis);
      const body: Record<string, unknown> = {
        section_id: activeSection.id,
        label: r.label,
        level_hint: level,
        vg_nr: vg,
        vr_nr: vr,
        points: r.points.map((p) => ({ ...p })),
        holes,
        metres_per_norm_unit: mpu ?? undefined,
        scale_aspect_yx: activeScaleAspect(),
      };
      if (analysis) {
        const a = { ...analysis };
        if (holes.length) a.holes = holes;
        body.analysis = a;
      } else if (holes.length) {
        body.analysis = { holes };
      }
      const saved = await postNewSubsection(body);
      upsertOptimisticRoom({
        id: saved.subsection_id,
        section_id: activeSection.id,
        label: r.label,
        level_hint: level,
        vg_nr: vg,
        vr_nr: vr,
        points: r.points.map((p) => ({ ...p })),
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : r.area_m2,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : r.area_norm,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : r.perimeter_m,
        perimeter_norm: null,
        metres_per_norm_unit: mpu,
        analysis_status: "ok",
        sort_order: rooms.length,
        analysis: analysis ?? null,
      });
      usedPairs.add(vgVrPairKey(vg, vr));
      savedN += 1;
    }

    await loadRooms({ preserveOrder: true });
    // Refresh room_count badges on the picker cards.
    try {
      const fresh = await fetchFloormapSections(buildingId);
      sections = fresh;
      syncCopyLayoutUi();
    } catch {
      if (activeSection) {
        activeSection.room_count = rooms.length;
        const idx = sections.findIndex((s) => s.id === activeSection!.id);
        if (idx >= 0) sections[idx] = activeSection;
      }
    }
    renderRoomList();
    drawOverlay();
    const vgNote = remapVg
      ? ` VG herschikt vanaf ${Math.max(0, maxVg) + 1}`
      : " (zelfde VG/VR als bron)";
    setStatus(
      `${savedN} ruimte(n) gekopieerd van «${sourceSec.label || "bron"}».${vgNote}. Controleer labels/oriëntaties.`,
      "ok",
    );
    if (copyLayoutCb) copyLayoutCb.checked = false;
    syncCopyLayoutUi();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    try {
      await loadRooms();
    } catch {
      /* keep partial */
    }
    renderRoomList();
    drawOverlay();
    syncCopyLayoutUi();
  }
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
  discoverBtn.textContent = floormap ? `Ontdek ${n.plural}` : "Ontdek openingen";
  if (discoverBtnSide) {
    discoverBtnSide.textContent = floormap ? "Ontdek" : "Ontdek in";
    discoverBtnSide.title = floormap
      ? `Ontdek ${n.plural} automatisch`
      : "Ontdek openingen (kozijnen e.d.) binnen de geselecteerde buitencontour";
  }
  if (discoverMinWrapEl) discoverMinWrapEl.classList.toggle("hidden", floormap);
  if (discoverHintEl) {
    discoverHintEl.textContent = floormap
      ? `Plattegrond: ruimten op de crop.`
      : "Gevel: selecteer buitencontour (VR), stel filtergrootte in (grof → fijn), daarna Ontdek openingen — hi-res H/V-lijnen via server, fallback lokaal.";
  }
  syncCopyLayoutUi();
  syncCopyGevelUi();
  if (markRoomLegendEl) markRoomLegendEl.textContent = cap;
  roomDrawBtn.textContent = `Teken ${n.singular}`;
  roomSaveBtn.textContent = "Opslaan";
  roomLabelInput.placeholder =
    floormap ? "bijv. slaapkamer 1" : "bijv. raamstrook / paneel";
  roomPendingHintEl.textContent = `Gebruik Teken ${n.singular} in Gereedschap, klik hoekpunten, sluit af en sla op. Dubbelklik een rand om een anker toe te voegen; dubbelklik een anker om te verwijderen; Vereenvoudig dunt de omtrek.`;
  if (roomDeleteBtn) {
    roomDeleteBtn.textContent = "Verwijderen";
    roomDeleteBtn.title = `Opgeslagen ${n.singular} permanent verwijderen`;
  }
  // Never pass a null node into replaceChildren — that aborts openSection before loadRooms.
  if (savedHeadingTextEl) {
    savedHeadingTextEl.textContent = `Opgeslagen ${n.plural}`;
  } else if (savedRoomsHeadingEl) {
    savedRoomsHeadingEl.textContent = `Opgeslagen ${n.plural} `;
  }
  if (savedRoomsHeadingEl && roomCountEl && document.body.contains(roomCountEl)) {
    const main = savedRoomsHeadingEl.querySelector(".saved-list-heading-main");
    if (main && !main.contains(roomCountEl)) {
      main.appendChild(roomCountEl);
    } else if (!main && !savedRoomsHeadingEl.contains(roomCountEl)) {
      savedRoomsHeadingEl.appendChild(roomCountEl);
    }
    roomCountEl.className = "region-count-badge";
    roomCountEl.id = "fm-room-count";
  }
  if (roomsHintEl) {
    roomsHintEl.textContent = floormap
      ? `Elke ${n.singular} toont VG/VR, oppervlakte (m²) en omtrek (m) bij ingestelde schaal.`
      : `Kleuren: rood = in bewerking · teal = bewerkt/opgeslagen · paars = nog open. Zwarte badge = VG/VR. Oranje/groene led = materiaal. Hiërarchie gevel > kozijn > ruit is automatisch; modus 4 alleen bij uitzonderingen.`;
  }
  if (vgVrHintEl) {
    vgVrHintEl.textContent = floormap
      ? "Zelfde VG + andere VR = ruimten in hetzelfde verblijfsgebied. De combinatie VG+VR is uniek (zelfde VR in een andere VG mag)."
      : "Koppel aan een VR (zelfde als plattegrond). Meerdere composities (materialen) binnen dezelfde buitencontour zijn mogelijk.";
  }
  expectedOriBlockEl?.classList.toggle("hidden", !floormap);
  if (!floormap) {
    clearExpectedOrientaties();
    setComponentOrientatie(lastComponentOrientatie);
  } else {
    clearComponentOrientatie();
  }
  if (floormap) {
    selectedSetIds.clear();
    selectedAssignIds.clear();
    constituentSigns.clear();
    booleanPreview = null;
    projectMaterialUsages = null;
    kierSuggestEl?.classList.add("hidden");
    materialBlockEl?.classList.add("hidden");
    assignMatBlockEl?.classList.add("hidden");
    setOpsFieldset?.classList.add("hidden");
    vgVrRowEl?.classList.remove("hidden");
    vgVrHintEl?.classList.remove("hidden");
    componentOriBlockEl?.classList.add("hidden");
  } else {
    materialCategoriesLoaded = false;
    void ensureMaterialCategories();
  }
  syncSidebarWorkMode();
  syncReplaceMaterialUi();
  renderComposeParts();
}

let roomListVrFilter = "";
/** URL/flow-VR om toe te passen zodra de VR-filteropties bekend zijn. */
let pendingFlowVrNr =
  normalizeFlowVrNr(params.get("vr_nr")) ||
  normalizeFlowVrNr(readFlowVr(URL_BUILDING)?.vr_nr) ||
  "";
/** "" = alle groepen; anders "1" | "2" | "3" (alleen geveltekening). */
let roomListGroepFilter = "";
/** VR-nrs from plattegrond (and other gevels) so the filter lists all project VRs, not only this section. */
let buildingVrCatalog: string[] = [];
const buildingVrToVg = new Map<string, number>();

async function refreshBuildingVrCatalog(): Promise<void> {
  if (!auth()?.token || !buildingId) {
    buildingVrCatalog = [];
    buildingVrToVg.clear();
    return;
  }
  const set = new Set<string>();
  buildingVrToVg.clear();
  const floormapSecs = sections.filter((s) => isFloormapKind(s.region_kind));
  // Prefer plattegrond rooms as the canonical VG/VR list; fall back to all sections.
  const targets = floormapSecs.length ? floormapSecs : sections;
  for (const sec of targets) {
    try {
      const raw = bppPhase1Enabled()
        ? (await bppListDrawingSubsections(invokeString, auth()!.token, sec.id)).subsections
        : (
            await apiGet<{
              subsections: Array<{ vr_nr?: string | null; vg_nr?: number | null }>;
            }>(`/api/floormap/subsections?section_id=${encodeURIComponent(sec.id)}`)
          ).subsections;
      for (const row of raw || []) {
        const vr = normalizeVrNr(row.vr_nr);
        if (!vr) continue;
        set.add(vr);
        if (row.vg_nr != null && Number.isFinite(Number(row.vg_nr)) && !buildingVrToVg.has(vr)) {
          buildingVrToVg.set(vr, Number(row.vg_nr));
        }
      }
    } catch (err) {
      console.warn("building VR catalog: section failed", sec.id, err);
    }
  }
  buildingVrCatalog = [...set].sort(compareVrNr);
}

function syncRoomListVrFilterOptions(items: RoomSubsection[]): void {
  if (!roomVrFilterEl) return;
  const onSection = collectAvailableVrNrs(items);
  const merged = new Set<string>([...buildingVrCatalog, ...onSection]);
  // Also pick up VG hints from components on this section.
  for (const r of items) {
    const vr = normalizeVrNr(r.vr_nr);
    if (!vr || r.vg_nr == null) continue;
    if (!buildingVrToVg.has(vr)) buildingVrToVg.set(vr, Number(r.vg_nr));
  }
  const vrs = [...merged].sort(compareVrNr);
  const prev = roomListVrFilter;
  roomVrFilterEl.replaceChildren();
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "Alle VR's";
  roomVrFilterEl.appendChild(allOpt);
  for (const vr of vrs) {
    const opt = document.createElement("option");
    opt.value = vr;
    const onThis = onSection.includes(vr);
    const vg = buildingVrToVg.get(vr);
    const base = formatVrVgLabel(vr, vg ?? null);
    opt.textContent = onThis ? base : `${base} (nog niet op deze gevel)`;
    roomVrFilterEl.appendChild(opt);
  }
  // Flow-VR uit URL/session alleen één keer toepassen bij aankomst — niet bij elke
  // lijst-refresh (anders kan de gebruiker de VR-filter niet wijzigen).
  if (pendingFlowVrNr) {
    const fromFlow = pickFlowVrNr(vrs, pendingFlowVrNr);
    pendingFlowVrNr = "";
    if (fromFlow) roomListVrFilter = fromFlow;
    else if (prev && vrs.includes(prev)) roomListVrFilter = prev;
    else roomListVrFilter = "";
  } else if (prev && vrs.includes(prev)) {
    roomListVrFilter = prev;
  } else if (prev && pickFlowVrNr(vrs, prev)) {
    roomListVrFilter = pickFlowVrNr(vrs, prev);
  } else {
    roomListVrFilter = "";
  }
  roomVrFilterEl.value = roomListVrFilter;
  if (buildingId) {
    persistFlowVr(
      buildingId,
      roomListVrFilter || null,
      roomListVrFilter ? buildingVrToVg.get(roomListVrFilter) ?? null : null,
    );
  }
  if (roomListVrFilter && !isFloormapKind()) {
    roomVrInput.value = roomListVrFilter;
    const vg = buildingVrToVg.get(roomListVrFilter);
    if (vg != null) roomVgInput.value = String(vg);
  }
  savedVrFilterWrapEl?.classList.toggle("hidden", vrs.length === 0);
  syncRoomListGroepFilterOptions(items);
  if (activeSection) syncFloormapLocation(activeSection.id);
}

function roomMatchesGroepFilter(room: RoomSubsection, filter: string): boolean {
  const n = Number(filter);
  if (n !== 1 && n !== 2 && n !== 3) return true;
  return readGevelgroepNr(room.analysis) === n;
}

function roomMatchesListFilters(room: RoomSubsection): boolean {
  return (
    roomMatchesVrFilter(room, roomListVrFilter) &&
    roomMatchesGroepFilter(room, roomListGroepFilter)
  );
}

/** Groep-filter naast VR — alleen op geveltekening. */
function syncRoomListGroepFilterOptions(items: RoomSubsection[]): void {
  if (!roomGroepFilterEl) return;
  const onGevel = !isFloormapKind();
  if (!onGevel || !items.length) {
    roomListGroepFilter = "";
    roomGroepFilterEl.value = "";
    savedGroepFilterWrapEl?.classList.add("hidden");
    return;
  }
  const inVr = items.filter((r) => roomMatchesVrFilter(r, roomListVrFilter));
  const nrs = new Set<number>();
  for (const r of inVr) nrs.add(readGevelgroepNr(r.analysis));
  if (!nrs.size) nrs.add(1);
  const sorted = [...nrs].sort((a, b) => a - b);
  const prev = roomListGroepFilter;
  roomGroepFilterEl.replaceChildren();
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = "Alle";
  roomGroepFilterEl.appendChild(allOpt);
  for (const n of sorted) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    roomGroepFilterEl.appendChild(o);
  }
  // Houd keuze vast als die groep nog bestaat; anders Alle.
  roomListGroepFilter =
    prev === "1" || prev === "2" || prev === "3"
      ? sorted.includes(Number(prev))
        ? prev
        : ""
      : "";
  roomGroepFilterEl.value = roomListGroepFilter;
  savedGroepFilterWrapEl?.classList.remove("hidden");
}

/** Top-level rows for the current VR · groep filter. */
function visibleTopLevelRooms(items: RoomSubsection[]): RoomSubsection[] {
  return items.filter((r) => roomMatchesListFilters(r));
}

function roomListCountLabel(visible: number, total: number): string {
  const active = Boolean(roomListVrFilter || roomListGroepFilter);
  return formatRoomListCountLabel(active ? "1" : "", visible, total);
}


let buildingId = URL_BUILDING;
refreshLastComponentOrientatieFromStorage();
let buildingLabel = "";
let buildingExternalRef = "";
let projectMenu: ProjectMenuApi | null = null;
let sections: FloormapSection[] = [];
let activeSection: FloormapSection | null = null;
let rooms: RoomSubsection[] = [];
/**
 * Monotonic epoch for loadRooms — discard late/stale list replies that would
 * overwrite a fresher in-memory save (classic race after Opslaan).
 */
let roomsLoadEpoch = 0;
/**
 * Just-saved geometry kept briefly so a stale ListDrawingSubsections cannot
 * roll the overlay/list back to the pre-edit shape (seen on Firefox after save).
 */
const localRoomPatches = new Map<
  string,
  {
    at: number;
    points: Pt[];
    label: string;
    level_hint: string;
    vg_nr: number | null;
    vr_nr: string | null;
    area_m2: number | null;
    area_norm: number | null;
    perimeter_m: number | null;
    analysis: SubsectionAnalysis | null | undefined;
  }
>();
const LOCAL_ROOM_PATCH_TTL_MS = 45_000;
/** Only overlay list geometry while a save/list race is likely (ms). */
const LOCAL_ROOM_PATCH_APPLY_MS = 15_000;
/** Only inject brand-new ids missing from a stale list (ms). */
const LOCAL_ROOM_PATCH_READD_MS = 12_000;
/** Ids removed locally; hide them if a stale List still includes them. */
const localRoomDeletions = new Map<string, number>();
/**
 * Last in-memory room list per section when leaving the workspace (e.g. ← Overzicht).
 * VG/VR-overzicht fetches all floors from the server; merge with patches + this snapshot
 * so label/VG/VR edits stay visible without a full page refresh.
 */
const sectionRoomsSnapshot = new Map<string, RoomSubsection[]>();

function captureSectionRoomsSnapshot(sectionId: string): void {
  if (!sectionId || !rooms.length) return;
  sectionRoomsSnapshot.set(
    sectionId,
    rooms.map((r) => ({
      ...r,
      points: r.points.map((p) => ({ ...p })),
      analysis: r.analysis ? { ...r.analysis } : r.analysis,
    })),
  );
}

function overlaySectionRoomsSnapshot(sectionId: string, list: RoomSubsection[]): RoomSubsection[] {
  const snap = sectionRoomsSnapshot.get(sectionId);
  if (!snap?.length) return list;
  const snapById = new Map(snap.map((r) => [normRoomId(r.id), r]));
  const merged = list.map((r) => {
    const s = snapById.get(normRoomId(r.id));
    if (!s) return r;
    const snapVr = normalizeVrNr(s.vr_nr);
    const serverVr = normalizeVrNr(r.vr_nr);
    const staleLabel = (s.label || "").trim() !== (r.label || "").trim();
    const staleVgVr = s.vg_nr !== r.vg_nr || snapVr !== serverVr;
    const useSnap =
      touchedRoomIds.has(normRoomId(r.id)) ||
      localRoomPatches.has(r.id) ||
      localRoomPatches.has(normRoomId(r.id)) ||
      localLabelOverrides.has(normRoomId(r.id)) ||
      staleLabel ||
      staleVgVr;
    if (!useSnap) return r;
    return {
      ...r,
      label: s.label,
      level_hint: s.level_hint || r.level_hint,
      vg_nr: s.vg_nr,
      vr_nr: s.vr_nr,
    };
  });
  const present = new Set(merged.map((r) => normRoomId(r.id)));
  for (const s of snap) {
    const id = normRoomId(s.id);
    if (present.has(id) || isLocallyDeleted(s.id)) continue;
    if (
      !touchedRoomIds.has(normRoomId(s.id)) &&
      !localRoomPatches.has(id) &&
      !localLabelOverrides.has(id)
    ) {
      continue;
    }
    merged.push(s);
  }
  return merged.sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl"),
  );
}

async function listSectionRoomsForOverview(sectionId: string): Promise<RoomSubsection[]> {
  if (sectionId === activeSection?.id && rooms.length) {
    const fetched = await fetchSectionRooms(sectionId);
    let list = mergeRoomsWithLocalPatches(fetched);
    const byId = new Map(list.map((r) => [normRoomId(r.id), r]));
    for (const r of rooms) byId.set(normRoomId(r.id), r);
    list = [...byId.values()].sort(
      (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl"),
    );
    return overlaySectionRoomsSnapshot(sectionId, list);
  }
  let list = mergeRoomsWithLocalPatches(await fetchSectionRooms(sectionId));
  return overlaySectionRoomsSnapshot(sectionId, list);
}

function upsertOptimisticRoom(room: RoomSubsection): void {
  rooms = [...rooms.filter((r) => normRoomId(r.id) !== normRoomId(room.id)), room];
  noteLocalRoomPatch(room);
  markRoomTouched(room.id);
}

function noteLocalRoomPatch(room: {
  id: string;
  points: Pt[];
  label: string;
  level_hint: string;
  vg_nr: number | null;
  vr_nr: string | null;
  area_m2: number | null;
  area_norm: number | null;
  perimeter_m: number | null;
  analysis?: SubsectionAnalysis | null;
}): void {
  const sid = normRoomId(room.id);
  if (!sid || !room.points?.length) return;
  noteLocalLabel(room.id, room.label);
  localRoomPatches.set(sid, {
    at: Date.now(),
    points: room.points.map((p) => ({ ...p })),
    label: room.label,
    level_hint: room.level_hint,
    vg_nr: room.vg_nr,
    vr_nr: room.vr_nr,
    area_m2: room.area_m2,
    area_norm: room.area_norm,
    perimeter_m: room.perimeter_m,
    analysis: room.analysis
      ? {
          ...room.analysis,
          holes: Array.isArray(room.analysis.holes)
            ? room.analysis.holes.map((h) => h.map((p) => ({ ...p })))
            : room.analysis.holes,
        }
      : room.analysis,
  });
}

function pruneLocalRoomPatches(): void {
  const now = Date.now();
  for (const [id, p] of localRoomPatches) {
    if (now - p.at > LOCAL_ROOM_PATCH_TTL_MS) localRoomPatches.delete(id);
  }
  for (const [id, at] of localRoomDeletions) {
    if (now - at > LOCAL_ROOM_PATCH_TTL_MS) localRoomDeletions.delete(id);
  }
}

function normRoomId(id: unknown): string {
  return String(id ?? "").trim().toLowerCase();
}

function isLocallyDeleted(id: unknown): boolean {
  const k = normRoomId(id);
  return Boolean(k) && localRoomDeletions.has(k);
}

function noteLocalRoomDeletion(id: string): void {
  const sid = normRoomId(id);
  if (!sid) return;
  for (const key of [...localRoomPatches.keys()]) {
    if (normRoomId(key) === sid) localRoomPatches.delete(key);
  }
  localRoomDeletions.set(sid, Date.now());
}

/** Label typed in the edit dock → in-memory list (until Opslaan hits the server). */
function syncPendingLabelToRooms(): void {
  if (!pendingRoom) return;
  const label = roomLabelInput.value.trim();
  pendingRoom.label = label;
  if (!pendingRoom.editingId || !label) return;
  const i = rooms.findIndex((r) => normRoomId(r.id) === normRoomId(pendingRoom!.editingId));
  if (i < 0) return;
  if (rooms[i].label === label) {
    noteLocalLabel(rooms[i].id, label);
    return;
  }
  const next = { ...rooms[i], label };
  rooms[i] = next;
  noteLocalRoomPatch(next);
}

function roomListDisplayLabel(r: RoomSubsection): string {
  if (pendingRoom?.editingId && normRoomId(pendingRoom.editingId) === normRoomId(r.id)) {
    const live = (pendingRoom.label || roomLabelInput.value).trim();
    if (live) return live;
  }
  const override = localLabelOverrides.get(normRoomId(r.id));
  if (override) return override;
  return r.label || "(zonder label)";
}

function dropLocallyDeletedRooms(list: RoomSubsection[]): RoomSubsection[] {
  if (!localRoomDeletions.size) return list;
  return list.filter((r) => !isLocallyDeleted(r.id));
}

function ringsApproxEqual(a: Pt[] | undefined, b: Pt[] | undefined): boolean {
  if (!a?.length || !b?.length || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i].x - b[i].x) > 1e-9 || Math.abs(a[i].y - b[i].y) > 1e-9) return false;
  }
  return true;
}

/** True when the server list already reflects this local patch (safe to drop). */
function localPatchCaughtUp(
  server: RoomSubsection,
  p: {
    points: Pt[];
    label: string;
    vg_nr: number | null;
    vr_nr: string | null;
    analysis: SubsectionAnalysis | null | undefined;
  },
): boolean {
  if (!ringsApproxEqual(server.points, p.points)) return false;
  if ((p.label || "") && (server.label || "") !== (p.label || "")) return false;
  if (p.vg_nr !== server.vg_nr) return false;
  if ((p.vr_nr || null) !== (server.vr_nr || null)) return false;
  const sSeal = readComponentSeal(server.analysis);
  const pSeal = readComponentSeal(p.analysis);
  const sOn = Boolean(sSeal?.enabled);
  const pOn = Boolean(pSeal?.enabled);
  if (sOn !== pOn) return false;
  if (pOn) {
    if ((sSeal?.material_id || "") !== (pSeal?.material_id || "")) return false;
    if ((sSeal?.catalog_id || "") !== (pSeal?.catalog_id || "")) return false;
  }
  // Ori-only / materiaal-only saves keep the same geometry — without these checks a
  // stale ListDrawingSubsections reply looks "caught up" and the LED flips green→orange.
  const sOri = normalizeOrientatieCode(server.analysis?.orientatie || "");
  const pOri = normalizeOrientatieCode(p.analysis?.orientatie || "");
  if (sOri !== pOri) return false;
  const sMat = String(server.analysis?.material_id || "").trim();
  const pMat = String(p.analysis?.material_id || "").trim();
  if (sMat !== pMat) return false;
  const sCat = String(server.analysis?.catalog_id || "").trim();
  const pCat = String(p.analysis?.catalog_id || "").trim();
  if (sCat !== pCat) return false;
  return true;
}

function mergeAnalysisPreferPatch(
  server: SubsectionAnalysis | null | undefined,
  patch: SubsectionAnalysis | null | undefined,
): SubsectionAnalysis | null | undefined {
  if (!patch) return server;
  const merged: SubsectionAnalysis = { ...(server || {}), ...patch };
  // Only drop seal when the patch explicitly clears it. A geometry/label patch that
  // simply omits `seal` must keep the server (or prior) seal — otherwise the dock
  // checkbox looks off and «Opslaan» wrongly removes kierdichting.
  if (Object.prototype.hasOwnProperty.call(patch, "seal") && !componentSealEnabled(patch)) {
    delete merged.seal;
  } else if (
    !Object.prototype.hasOwnProperty.call(patch, "seal") &&
    componentSealEnabled(server)
  ) {
    merged.seal = server!.seal;
  }
  if (Array.isArray(patch.holes)) merged.holes = patch.holes;
  else if (server?.holes) merged.holes = server.holes;
  return merged;
}

/** Apply recent local saves on top of a server list (geometry/label/VG-VR/seal). */
function mergeRoomsWithLocalPatches(incoming: RoomSubsection[]): RoomSubsection[] {
  pruneLocalRoomPatches();
  const visible = dropLocallyDeletedRooms(incoming);
  if (!localRoomPatches.size) return applyLocalLabelOverrides(visible);
  const now = Date.now();
  const out = visible.map((r) => {
    const p = localRoomPatches.get(r.id) || localRoomPatches.get(normRoomId(r.id));
    if (!p) return r;
    const age = now - p.at;
    if (localPatchCaughtUp(r, p)) {
      localRoomPatches.delete(normRoomId(r.id));
      return r;
    }
    const labelStillStale =
      Boolean((p.label || "").trim()) && (p.label || "").trim() !== (r.label || "").trim();
    // Geometry patches may expire, but never drop a still-stale custom label.
    if (age > LOCAL_ROOM_PATCH_TTL_MS && !labelStillStale) {
      localRoomPatches.delete(normRoomId(r.id));
      return r;
    }
    // Keep overlaying geometry/label until the server list catches up.
    // Metrics (m²/m / schaal) altijd van de server wanneer die ze al heeft — anders blijft
    // een pre-kalibratie-patch "geen schaal" tonen na Schaal kalibreren.
    return {
      ...r,
      points: p.points.map((pt) => ({ ...pt })),
      label: p.label || r.label,
      level_hint: p.level_hint || r.level_hint,
      vg_nr: p.vg_nr,
      vr_nr: p.vr_nr,
      area_m2: r.area_m2 != null ? r.area_m2 : p.area_m2,
      area_norm: r.area_norm != null ? r.area_norm : p.area_norm,
      perimeter_m: r.perimeter_m != null ? r.perimeter_m : p.perimeter_m,
      metres_per_norm_unit:
        r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0
          ? r.metres_per_norm_unit
          : activeScaleMpu(),
      analysis: mergeAnalysisPreferPatch(r.analysis, p.analysis),
    };
  });
  // If a brand-new save is missing from a stale list, keep it visible (short window only).
  // Never inject a patch that belongs to another section (stale map after section switch).
  const activeId = activeSection?.id || "";
  for (const [id, p] of localRoomPatches) {
    if (isLocallyDeleted(id)) continue;
    const touched = touchedRoomIds.has(normRoomId(id));
    if (now - p.at > LOCAL_ROOM_PATCH_READD_MS && !touched) {
      localRoomPatches.delete(normRoomId(id));
      continue;
    }
    if (out.some((r) => normRoomId(r.id) === normRoomId(id))) continue;
    if (!activeId) {
      localRoomPatches.delete(normRoomId(id));
      continue;
    }
    out.push({
      id,
      section_id: activeId,
      label: p.label,
      level_hint: p.level_hint,
      vg_nr: p.vg_nr,
      vr_nr: p.vr_nr,
      points: p.points.map((pt) => ({ ...pt })),
      area_m2: p.area_m2,
      area_norm: p.area_norm,
      perimeter_m: p.perimeter_m,
      perimeter_norm: null,
      metres_per_norm_unit: activeScaleMpu(),
      analysis_status: "ok",
      sort_order: out.length,
      analysis: p.analysis ?? null,
    });
  }
  return applyLocalLabelOverrides(out);
}

/** Multi-select for gevel compose (component ids). */
let selectedSetIds = new Set<string>();
/** Multi-select for material assign mode (component ids). */
let selectedAssignIds = new Set<string>();
/** Per selected id: + include / − subtract. Defaults applied when selecting. */
let constituentSigns = new Map<string, ComposeSign>();
let booleanPreview: BooleanPolygon | null = null;

type SidebarWorkMode = "picklist" | "draw" | "assign" | "compose";
const SIDEBAR_WORK_MODE_KEY = "app-gevelwering-sidebar-work-mode";
function parseSidebarWorkMode(raw: string | null | undefined): SidebarWorkMode | null {
  const v = String(raw || "").trim();
  if (v === "picklist" || v === "draw" || v === "assign" || v === "compose") return v;
  return null;
}
let sidebarWorkMode: SidebarWorkMode = (() => {
  // Van GA-procesdock: ?work_mode=… heeft voorrang op sessionStorage.
  const fromUrl = parseSidebarWorkMode(params.get("work_mode"));
  if (fromUrl) {
    try {
      sessionStorage.setItem(SIDEBAR_WORK_MODE_KEY, fromUrl);
    } catch {
      /* ignore */
    }
    return fromUrl;
  }
  try {
    const v = parseSidebarWorkMode(sessionStorage.getItem(SIDEBAR_WORK_MODE_KEY));
    if (v) return v;
  } catch {
    /* ignore */
  }
  return "draw";
})();

function persistSidebarWorkMode(mode: SidebarWorkMode): void {
  try {
    sessionStorage.setItem(SIDEBAR_WORK_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function setSidebarWorkMode(mode: SidebarWorkMode): void {
  if (sidebarWorkMode === mode) {
    syncSidebarWorkMode();
    return;
  }
  sidebarWorkMode = mode;
  persistSidebarWorkMode(mode);
  if (mode !== "compose") {
    selectedSetIds.clear();
    constituentSigns.clear();
    booleanPreview = null;
  }
  if (mode !== "assign") {
    selectedAssignIds.clear();
  }
  syncSidebarWorkMode();
  renderComposeParts();
  renderRoomList();
  drawOverlay();
  syncPendingRoomButtons();
  syncToolButtons();
}

function syncAssignSelectionHint(): void {
  const n = selectedAssignIds.size;
  if (assignSelHintEl) {
    assignSelHintEl.textContent =
      n === 0
        ? "0 componenten geselecteerd"
        : n === 1
          ? "1 component geselecteerd"
          : `${n} componenten geselecteerd`;
  }
  const matId = (assignPicklistEl?.value || "").trim();
  if (assignMatBtn) {
    assignMatBtn.disabled = n === 0 || !matId || !favoriteMaterials.some((m) => m.material_id === matId);
  }
}

function renderAssignPicklistOptions(selectedId?: string | null): void {
  if (!assignPicklistEl) return;
  const keep = selectedId ?? assignPicklistEl.value;
  assignPicklistEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = favoriteMaterials.length
    ? "— kies uit project-picklist —"
    : "— stel eerst een picklist samen (modus 1) —";
  assignPicklistEl.appendChild(ph);
  for (const m of favoriteMaterials) {
    const opt = document.createElement("option");
    opt.value = m.material_id;
    const code = (m.catalog_id || "").trim();
    const ra = m.ra_dba != null ? ` · RA ${m.ra_dba}` : "";
    opt.textContent = code ? `${code} · ${m.name}${ra}` : `${m.name}${ra}`;
    assignPicklistEl.appendChild(opt);
  }
  assignPicklistEl.disabled = favoriteMaterials.length === 0;
  if (keep && favoriteMaterials.some((m) => m.material_id === keep)) {
    assignPicklistEl.value = keep;
  }
  syncAssignSelectionHint();
}

function syncProcessDockVisibility(): void {
  if (!workModeEl) return;
  const floormap = isFloormapKind();
  const inWorkspace =
    Boolean(activeSection) &&
    workspacePanelEl &&
    !workspacePanelEl.classList.contains("hidden");
  const show = !floormap && Boolean(inWorkspace);
  workModeEl.classList.toggle("hidden", !show);
  if (show) workModeEl.removeAttribute("hidden");
  else workModeEl.setAttribute("hidden", "");
}

function applyProcessDockCollapsed(collapsed: boolean): void {
  if (!workModeEl) return;
  workModeEl.classList.toggle("is-collapsed", collapsed);
  if (processDockCollapseBtn) {
    processDockCollapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    processDockCollapseBtn.textContent = collapsed ? "+" : "−";
    processDockCollapseBtn.title = collapsed ? "Uitklappen" : "Inklappen";
  }
  try {
    sessionStorage.setItem(PROCESS_DOCK_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function restoreProcessDockLayout(): void {
  if (!workModeEl) return;
  try {
    if (sessionStorage.getItem(PROCESS_DOCK_COLLAPSE_KEY) === "1") {
      applyProcessDockCollapsed(true);
    }
    const raw = sessionStorage.getItem(PROCESS_DOCK_POS_KEY);
    if (raw) {
      const pos = JSON.parse(raw) as { left?: number; top?: number };
      if (Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
        workModeEl.style.left = `${Math.max(8, Number(pos.left))}px`;
        workModeEl.style.top = `${Math.max(8, Number(pos.top))}px`;
        workModeEl.style.right = "auto";
      }
    }
  } catch {
    /* ignore */
  }
}

function initProcessDockChrome(): void {
  restoreProcessDockLayout();
  processDockCollapseBtn?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const next = !workModeEl?.classList.contains("is-collapsed");
    applyProcessDockCollapsed(next);
  });
  if (!workModeEl || !processDockDragEl) return;
  let drag: { ox: number; oy: number; sl: number; st: number } | null = null;
  processDockDragEl.addEventListener("pointerdown", (ev) => {
    if ((ev.target as HTMLElement | null)?.closest?.("button")) return;
    const rect = workModeEl.getBoundingClientRect();
    drag = {
      ox: ev.clientX,
      oy: ev.clientY,
      sl: rect.left,
      st: rect.top,
    };
    processDockDragEl.setPointerCapture(ev.pointerId);
    ev.preventDefault();
  });
  processDockDragEl.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const left = Math.min(
      window.innerWidth - 48,
      Math.max(8, drag.sl + (ev.clientX - drag.ox)),
    );
    const top = Math.min(
      window.innerHeight - 40,
      Math.max(8, drag.st + (ev.clientY - drag.oy)),
    );
    workModeEl.style.left = `${left}px`;
    workModeEl.style.top = `${top}px`;
    workModeEl.style.right = "auto";
  });
  const endDrag = (ev: PointerEvent) => {
    if (!drag) return;
    drag = null;
    try {
      processDockDragEl.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    const left = parseFloat(workModeEl.style.left || "0");
    const top = parseFloat(workModeEl.style.top || "0");
    try {
      sessionStorage.setItem(PROCESS_DOCK_POS_KEY, JSON.stringify({ left, top }));
    } catch {
      /* ignore */
    }
  };
  processDockDragEl.addEventListener("pointerup", endDrag);
  processDockDragEl.addEventListener("pointercancel", endDrag);
}

/** Gevel sidebar: only show controls relevant to the current work mode. */
function syncSidebarWorkMode(): void {
  const floormap = isFloormapKind();
  syncProcessDockVisibility();
  if (floormap) {
    assignMatBlockEl?.classList.add("hidden");
    materialCatalogBrowseEl?.classList.remove("hidden");
    picklistIntroEl?.classList.add("hidden");
    drawOpsClusterEl?.classList.remove("hidden");
    componentActionsEl?.classList.remove("hidden");
    roomLabelWrapEl?.classList.remove("hidden");
    roomLevelWrapEl?.classList.remove("hidden");
    toolsBarEl?.classList.remove("hidden");
    roomPendingHintEl?.classList.remove("hidden");
    return;
  }

  const mode = sidebarWorkMode;
  for (const btn of workModeEl?.querySelectorAll<HTMLButtonElement>(".fm-work-mode-btn") || []) {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  }

  const isPicklist = mode === "picklist";
  const isDraw = mode === "draw";
  const isAssign = mode === "assign";
  const isCompose = mode === "compose";

  if (markRoomLegendEl) {
    markRoomLegendEl.textContent = isPicklist
      ? "Picklist"
      : isAssign
        ? "Materiaal koppelen"
        : isCompose
          ? "Compositie (optioneel)"
          : "Component";
  }

  // Picklist (1): catalog + favorites. Stap 4 = optionele handmatige ±.
  materialBlockEl?.classList.toggle("hidden", !isPicklist);
  picklistIntroEl?.classList.toggle("hidden", !isPicklist);
  materialCatalogBrowseEl?.classList.toggle("hidden", !isPicklist);
  replaceMatEl?.classList.toggle("hidden", !isPicklist);
  const favoriteActions = document.getElementById("fm-favorite-actions");
  favoriteActions?.classList.toggle("hidden", !isPicklist);
  if (materialBlockHintEl) {
    if (isPicklist) {
      materialBlockHintEl.classList.remove("hidden");
      materialBlockHintEl.textContent =
        "Kies uit de catalogus en voeg toe aan de picklist. Materiaal koppelen = modus 3. Regel 1: hiërarchie gevel ⊃ kozijn ⊃ ruit. Regel 2: kierdichting rond kozijn (vinkje hieronder) → automatisch bij stap 3.";
    } else {
      materialBlockHintEl.classList.add("hidden");
    }
  }

  if (isPicklist) {
    void syncRegel2KierPicklistUi();
  }

  assignMatBlockEl?.classList.toggle("hidden", !isAssign);
  if (isAssign) {
    renderAssignPicklistOptions(assignPicklistEl?.value || materialFavoriteEl?.value || null);
    const mid = (assignPicklistEl?.value || "").trim();
    const mat = favoriteMaterials.find((m) => m.material_id === mid) || null;
    updateMaterialSpectrumPreview(mat);
    materialSpectrumEl?.classList.toggle("hidden", !mat);
    syncAssignRegel2Hint();
  } else if (!isPicklist) {
    materialSpectrumEl?.classList.add("hidden");
  }

  // Spectrum: picklist → material block; assign → assign block
  if (isAssign && materialSpectrumEl && assignMatBlockEl && materialSpectrumEl.parentElement !== assignMatBlockEl) {
    assignMatBlockEl.appendChild(materialSpectrumEl);
  } else if (
    isPicklist &&
    materialSpectrumEl &&
    materialBlockEl &&
    materialSpectrumEl.parentElement !== materialBlockEl
  ) {
    materialBlockEl.appendChild(materialSpectrumEl);
  }

  drawOpsClusterEl?.classList.toggle("hidden", !isDraw);
  roomLabelWrapEl?.classList.toggle("hidden", !isDraw);
  roomLevelWrapEl?.classList.toggle("hidden", !isDraw);
  componentOriBlockEl?.classList.toggle("hidden", !isDraw);
  vgVrRowEl?.classList.toggle("hidden", !isDraw);
  if (vgVrHintEl) vgVrHintEl.classList.toggle("hidden", !isDraw);
  if (isDraw) {
    syncCopyGevelUi();
  } else {
    copyGevelBarEl?.classList.add("hidden");
  }
  componentActionsEl?.classList.toggle("hidden", !isDraw);
  roomPendingHintEl?.classList.toggle("hidden", !isDraw);
  toolsBarEl?.classList.toggle("hidden", !isDraw);
  setOpsFieldset?.classList.toggle("hidden", !isCompose);
  if (isCompose && setOpsFieldset instanceof HTMLDetailsElement) {
    setOpsFieldset.open = true;
  }
  if (!isDraw && !isCompose) {
    kierSuggestEl?.classList.add("hidden");
  }

  if (roomsHintEl) {
    roomsHintEl.textContent = isAssign
      ? "Checkbox = selectie voor materiaal. Oranje/groene led = materiaalstatus. Kozijn + regel 2 → kierdichting automatisch. Eerste toewijzing zonder bevestiging; vervanging vraagt om bevestiging."
      : isPicklist
        ? "Picklist + regel 2 (kier rond kozijn). Schakel naar modus 2–5 om verder te gaan."
        : isCompose
          ? "Optioneel: checkbox = selectie voor handmatige +/− (bijv. muurdelen verenigen). Standaard geldt hiërarchie gevel ⊃ kozijn ⊃ ruit automatisch — geen ± nodig."
          : `Kleuren: rood = in bewerking · teal = bewerkt/opgeslagen · paars = nog open. Zwarte badge = VG/VR. Oranje/groene led = materiaal. Hiërarchie gevel ⊃ kozijn ⊃ ruit is automatisch; modus 4 alleen bij uitzonderingen.`;
  }

  syncAssignSelectionHint();
  syncVgVrFormFromListFilter();
}
/** Twee-staps bevestiging voor Verwijderen (window.confirm wordt soms stil geblokkeerd). */
let pendingDeleteId: string | null = null;
let pendingDeleteTimer: number | null = null;
/** True while add/remove seal runs — syncKierSuggestUi must not fight the checkbox. */
let kierToggleInFlight = false;
/** Samengestelde resultaten waarvan het Bronnen-paneel open staat (verwijzingen, geen nesting). */
const expandedComposeSourcePanels = new Set<string>();
let composeFlashTimer: number | null = null;
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
/** Favorites for the current building ("meest gebruikt"). */
let favoriteMaterials: CatalogMaterial[] = [];
const DEFAULT_KIER_CATALOG_ID = "D02408";
const KIER_RUBRIEK_NAME =
  MATERIAL_RUBRIEKEN.find((r) => r.nr === 9)?.name || "Kier- en naaddichtingsprofielen";
let kierMaterials: CatalogMaterial[] = [];
let kierMaterialsLoaded = false;
let materialFilterTimer: ReturnType<typeof setTimeout> | null = null;
/** subsection_id → VR omschrijving when linked in GA model */
let linkedRooms = new Map<string, string>();
/**
 * Components saved/edited in this browser session — drawn teal so “nog open”
 * (purple) stays visually distinct from “al bewerkt”.
 */
const TOUCHED_ROOMS_KEY = "app-gevelwering-touched-rooms";
const LABEL_OVERRIDES_KEY = "app-gevelwering-label-overrides";
const touchedRoomIds = loadTouchedRoomIds();
/** Session-scoped labels that win over a stale ListDrawingSubsections reply. */
const localLabelOverrides = loadLabelOverrides();

function loadTouchedRoomIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(TOUCHED_ROOMS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(
      arr
        .filter((x): x is string => typeof x === "string" && x.length > 0)
        .map((x) => normRoomId(x))
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function persistTouchedRoomIds(): void {
  try {
    sessionStorage.setItem(TOUCHED_ROOMS_KEY, JSON.stringify([...touchedRoomIds]));
  } catch {
    /* ignore */
  }
}

function loadLabelOverrides(): Map<string, string> {
  try {
    const raw = sessionStorage.getItem(LABEL_OVERRIDES_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return new Map();
    const out = new Map<string, string>();
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const id = normRoomId(k);
      const label = typeof v === "string" ? v.trim() : "";
      if (id && label) out.set(id, label);
    }
    return out;
  } catch {
    return new Map();
  }
}

function persistLabelOverrides(): void {
  try {
    sessionStorage.setItem(
      LABEL_OVERRIDES_KEY,
      JSON.stringify(Object.fromEntries(localLabelOverrides)),
    );
  } catch {
    /* ignore */
  }
}

function noteLocalLabel(id: string | null | undefined, label: string | null | undefined): void {
  const sid = normRoomId(id);
  const text = (label || "").trim();
  if (!sid || !text) return;
  if (localLabelOverrides.get(sid) === text) return;
  localLabelOverrides.set(sid, text);
  persistLabelOverrides();
}

/** Prefer session labels over a stale server list; drop overrides once the server catches up. */
function applyLocalLabelOverrides(list: RoomSubsection[]): RoomSubsection[] {
  if (!localLabelOverrides.size) return list;
  let changed = false;
  const out = list.map((r) => {
    const sid = normRoomId(r.id);
    const want = localLabelOverrides.get(sid);
    if (!want) return r;
    if ((r.label || "").trim() === want) {
      localLabelOverrides.delete(sid);
      changed = true;
      return r;
    }
    return { ...r, label: want };
  });
  if (changed) persistLabelOverrides();
  return out;
}

function markRoomTouched(id: string | null | undefined): void {
  const sid = normRoomId(id);
  if (!sid || touchedRoomIds.has(sid)) return;
  touchedRoomIds.add(sid);
  persistTouchedRoomIds();
}

function markRoomsTouched(ids: Iterable<string | null | undefined>): void {
  let changed = false;
  for (const id of ids) {
    const sid = normRoomId(id);
    if (!sid || touchedRoomIds.has(sid)) continue;
    touchedRoomIds.add(sid);
    changed = true;
  }
  if (changed) persistTouchedRoomIds();
}
let pdfDoc: PdfDocument | null = null;
/** Cropped floormap bitmap at base resolution (before display zoom). */
let cropBitmap: HTMLCanvasElement | null = null;
let cropWidthPdfPts = 0;

const SECTION_THUMB_W = 128;
const SECTION_THUMB_H = 96;
const sectionThumbUrlCache = new Map<string, string>();
const pdfDocByDocumentId = new Map<string, PdfDocument>();
const pdfDocLoadPromises = new Map<string, Promise<PdfDocument>>();
let thumbCacheBuildingId = "";

function ensurePdfjsWorker(): void {
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
}

function clearSectionThumbnailCachesForBuilding(bid: string): void {
  if (thumbCacheBuildingId === bid) return;
  sectionThumbUrlCache.clear();
  pdfDocByDocumentId.clear();
  pdfDocLoadPromises.clear();
  thumbCacheBuildingId = bid;
}

async function loadPdfDocumentCached(documentId: string): Promise<PdfDocument> {
  ensurePdfjsWorker();
  const cached = pdfDocByDocumentId.get(documentId);
  if (cached) return cached;
  let pending = pdfDocLoadPromises.get(documentId);
  if (!pending) {
    pending = (async () => {
      const res = await fetch(`/api/drawings/download?document_id=${encodeURIComponent(documentId)}`, {
        credentials: "include",
        headers: apiAuthHeaders(auth()!.token),
      });
      if (!res.ok) throw new Error(`PDF laden mislukt (HTTP ${res.status})`);
      const buf = await res.arrayBuffer();
      const doc = await window.pdfjsLib!.getDocument({ data: buf }).promise;
      pdfDocByDocumentId.set(documentId, doc);
      pdfDocLoadPromises.delete(documentId);
      return doc;
    })();
    pdfDocLoadPromises.set(documentId, pending);
  }
  return pending;
}

async function sectionThumbnailDataUrl(sec: FloormapSection): Promise<string | null> {
  const hit = sectionThumbUrlCache.get(sec.id);
  if (hit) return hit;
  if (!auth()?.token) return null;
  try {
    const pdf = await loadPdfDocumentCached(sec.document_id);
    const pageNum = Math.min(pdf.numPages, Math.max(1, sec.page_index + 1));
    const page = await pdf.getPage(pageNum);
    const pageRotate = typeof page.rotate === "number" ? page.rotate : 0;
    const viewRotate = Number(sec.view_rotate) || 0;
    const rotation = (pageRotate + viewRotate) % 360;
    const baseVp = page.getViewport({ scale: 1, rotation });
    const cropWNorm = Math.max(0.001, sec.x_max - sec.x_min);
    const cropPxW = cropWNorm * baseVp.width;
    const renderScale = Math.min(2.5, Math.max(1, (SECTION_THUMB_W * 2) / cropPxW));
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
    thumb.width = SECTION_THUMB_W;
    thumb.height = SECTION_THUMB_H;
    const tctx = thumb.getContext("2d");
    if (!tctx) return null;
    tctx.fillStyle = "#fff";
    tctx.fillRect(0, 0, SECTION_THUMB_W, SECTION_THUMB_H);
    const fit = Math.min(SECTION_THUMB_W / cw, SECTION_THUMB_H / ch);
    const dw = cw * fit;
    const dh = ch * fit;
    tctx.drawImage(off, x0, y0, cw, ch, (SECTION_THUMB_W - dw) / 2, (SECTION_THUMB_H - dh) / 2, dw, dh);

    const dataUrl = thumb.toDataURL("image/jpeg", 0.82);
    sectionThumbUrlCache.set(sec.id, dataUrl);
    return dataUrl;
  } catch (err) {
    console.warn("section thumbnail failed", sec.id, err);
    return null;
  }
}

function mountSectionThumbnail(sec: FloormapSection, img: HTMLImageElement): void {
  const cached = sectionThumbUrlCache.get(sec.id);
  if (cached) {
    img.src = cached;
    img.classList.remove("is-loading");
    return;
  }
  void sectionThumbnailDataUrl(sec).then((url) => {
    if (!img.isConnected) return;
    if (!url) {
      img.classList.remove("is-loading");
      img.classList.add("is-error");
      img.alt = "Voorbeeld niet beschikbaar";
      return;
    }
    img.src = url;
    img.classList.remove("is-loading");
  });
}
let canvasWidth = 0;
let canvasHeight = 0;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
/** Detailgebied may zoom further than the normal +/- buttons. */
const ZOOM_MAX_DETAIL = 8;
const ZOOM_STEP = 0.1;
const ZOOM_STORAGE_KEY = "app-gevelwering-floormap-view-zoom";
const DETAIL_FACTOR_DEFAULT = 1 as const;
type DetailFactor = 1 | 2 | 3 | 4;

function loadStoredViewZoom(): number {
  try {
    const raw = Number(localStorage.getItem(ZOOM_STORAGE_KEY));
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.min(ZOOM_MAX_DETAIL, Math.max(ZOOM_MIN, Math.round(raw * 100) / 100));
  } catch {
    return 1;
  }
}

function persistViewZoom(z: number): void {
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(z));
  } catch {
    /* ignore quota / private mode */
  }
}

let viewZoom = loadStoredViewZoom();

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

type NormRect = { x0: number; y0: number; x1: number; y1: number };

/** Active detail framing (region in section-local 0–1). */
type DetailState = {
  rect: NormRect;
  factor: DetailFactor;
  /** View zoom when the region was marked — factors multiply this. */
  baseZoom: number;
  baseScrollLeft: number;
  baseScrollTop: number;
};

/** While dragging a new detail rectangle. */
type DetailPickState = {
  start: Pt;
  current: Pt;
  /** Waiting for first mousedown. */
  armed: boolean;
};

let detail: DetailState | null = null;
let detailPick: DetailPickState | null = null;

type MeasureTool = "off" | "length";
type ToolMode = "off" | "length" | "room" | "kozijn";
type MeasureState = {
  tool: MeasureTool;
  /** Section-local 0–1 points. */
  points: Pt[];
  cursor: Pt | null;
};
let measure: MeasureState = { tool: "off", points: [], cursor: null };

type KozijnDraft = {
  segments: KozijnSegment[];
  /** Index of segment receiving clicks; -1 = none. */
  activeIndex: number;
  /** Points of the line currently being drawn (not yet committed as segment). */
  livePoints: Pt[];
  cursor: Pt | null;
  defaultWidthM: number;
  /** Last evaluation for draw/save. */
  eval: KozijnEval | null;
  /** Kozijnmateriaal (vastgelegd bij start / eerste keuze; snapshot blijft geldig na wissel naar glas). */
  woodMaterialId: string | null;
  woodMaterial: CatalogMaterial | null;
  /** frame = buitenste kader; mullion = dwarsbalken na eerste opslaan. */
  phase: "frame" | "mullion";
  /** Buitenste kader gesloten (snap terug naar start). */
  frameClosed: boolean;
  /** Opgeslagen hout-component (update bij dwarsbalken). */
  woodSubsectionId: string | null;
  assemblyId: string | null;
};
let kozijnDraft: KozijnDraft | null = null;
/** Space ingedrukt → pannen zonder rubberband / nieuwe punten. */
let kozijnPanKey = false;
/** Space+sleep: scroll-offset van de PDF-view. */
let kozijnPanDrag: { x: number; y: number; left: number; top: number } | null = null;

/** Manual room mark / edit (section-local 0–1). */
type PendingRoom = {
  points: Pt[];
  /** Preserved holes when editing a difference result. */
  holes: Pt[][];
  closed: boolean;
  editingId: string | null;
  dragVertex: number | null;
  /** Whole-polygon drag: last cursor in section-local coords. */
  dragBodyLast: Pt | null;
  drawing: boolean;
  /** Live cursor while placing corners (section-local 0–1). */
  drawCursor: Pt | null;
  /** Omschrijving typed in the dock — survives accidental input resets until Opslaan. */
  label: string;
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

function showLogin(): void {
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
  if (fileMenuRoot) fileMenuRoot.hidden = true;
  projectMenu?.setEnabled(false);
}

function showPanel(info: AuthInfo): void {
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
  if (fileMenuRoot) fileMenuRoot.hidden = false;
  projectMenu?.setEnabled(true);
  projectMenu?.refreshTitle();
}

const session = new BppSession({
  wsUrl: resolveBppWsUrl(),
  authKey: AUTH_KEY,
  clientName: "app-gevelwering-floormap",
  callbacks: {
    onStatus: setStatus,
    onConnLed: setConnLed,
    onLogin: (info) => showPanel(info),
    onLogout: () => showLogin(),
    onReady: async () => {
      if (session.auth) {
        buildingInput.value = buildingId;
        if (buildingId) await loadFloormapSections(buildingId);
      }
    },
  },
});

function invokeString(target: string, args: unknown[]): Promise<string> {
  return session.invokeString(target, args);
}

function auth(): AuthInfo | null {
  return session.auth;
}

async function refreshBuildingMeta(): Promise<void> {
  if (!auth()?.token || !buildingId) {
    buildingLabel = "";
    buildingExternalRef = "";
    return;
  }
  try {
    const ret = await invokeString("API_EngineerGetProject", [auth()!.token, buildingId]);
    if (ret.startsWith("ERROR")) return;
    const data = JSON.parse(ret) as { label?: string; external_ref?: string };
    buildingLabel = data.label || "";
    buildingExternalRef = data.external_ref || "";
  } catch {
    /* keep previous */
  }
}

function authHeaders(): HeadersInit {
  return apiAuthHeaders(auth()!.token, true);
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: apiAuthHeaders(auth()!.token),
  });
  const body = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return body;
}

async function readJsonResponse<T>(res: Response): Promise<T & { ok?: boolean; error?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`HTTP ${res.status}: lege response (herstart Node serve.mjs?)`);
  }
  try {
    return JSON.parse(text) as T & { ok?: boolean; error?: string };
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(`HTTP ${res.status}: geen JSON (${snippet})`);
  }
}

async function apiPost<T>(url: string, payload: unknown, opts?: { timeoutMs?: number }): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 0;
  const signal =
    timeoutMs > 0 && typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? (AbortSignal as typeof AbortSignal & { timeout(ms: number): AbortSignal }).timeout(timeoutMs)
      : undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      err instanceof TypeError ||
      /networkerror|failed to fetch|load failed|network request failed/i.test(msg)
    ) {
      throw new Error(
        "Node-server niet bereikbaar (poort 4173) — herstart ./start.sh en controleer of serve.mjs draait",
      );
    }
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new Error("Server discover-time-out (>3 min) — PDF render duurt te lang");
    }
    throw err;
  }
  const body = await readJsonResponse<T>(res);
  if (!res.ok || (body as { ok?: boolean }).ok === false) {
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return body;
}

async function apiDelete<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers: apiAuthHeaders(auth()!.token),
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
    scaleStatusEl.textContent = "Niet gezet";
    calibrateHintEl.textContent = "Klik op Schaal kalibreren wanneer u klaar bent.";
    if (roomsHintEl) roomsHintEl.textContent = `Zet de tekeningsschaal om ${n.singular}-oppervlakten in m² te krijgen.`;
    setCalibrateLed(false);
    return;
  }
  const mpu = activeSection.metres_per_norm_unit;
  const ratio = activeSection.scale_ratio;
  const src = (activeSection.scale_source || "NONE").toUpperCase();
  if (mpu != null && mpu > 0) {
    if (ratio != null && ratio > 0) {
      const from = src === "PDF_TEXT" ? " (uit tekeningtekst)" : src === "CALIBRATED" ? " (gekalibreerd)" : "";
      scaleStatusEl.textContent = `Papierschaal 1:${ratio}${from}`;
    } else {
      scaleStatusEl.textContent =
        src === "CALIBRATED"
          ? "Schaal gezet via gemarkeerde lengte"
          : `Schaal gezet — ${n.singular}-maten in m² / m`;
    }
    calibrateHintEl.textContent = `Schaal is klaar. Gebruik Lengte om een afstand te controleren, of Teken ${n.singular} — omtrek/oppervlakte volgen uit de polygoon.`;
    if (roomsHintEl) {
      roomsHintEl.textContent = `Oppervlakte (m²) en omtrek (m) van de ${n.singular} gebruiken deze schaal.`;
    }
    calibrateBtn.textContent = "Schaal opnieuw kalibreren";
    setCalibrateLed(true, src === "PDF_TEXT" ? "Schaal gezet (uit tekeningtekst)" : "Kalibratie uitgevoerd");
  } else {
    scaleStatusEl.textContent = "Niet gezet — markeer een bekende lengte, of gebruik gedetecteerde 1:N";
    calibrateHintEl.textContent = "Klik Schaal kalibreren, markeer twee punten, en voer die lengte in mm in.";
    if (roomsHintEl) roomsHintEl.textContent = "Zonder schaal worden alleen relatieve maten getoond.";
    calibrateBtn.textContent = "Schaal kalibreren";
    setCalibrateLed(false);
  }
  updateToolHint();
}

function setCalibrateLed(on: boolean, titleWhenOn = "Kalibratie uitgevoerd"): void {
  if (!calibrateLedEl) return;
  calibrateLedEl.classList.toggle("is-on", on);
  calibrateLedEl.title = on ? titleWhenOn : "Schaal niet gezet";
  calibrateLedEl.setAttribute("aria-label", on ? titleWhenOn : "Schaal niet gezet");
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

/** Live polyline while drawing a component (committed corners + rubber-band cursor). */
function pendingDrawDisplayPoints(): Pt[] | null {
  if (!pendingRoom?.drawing || pendingRoom.closed) return null;
  if (!pendingRoom.points.length) return null;
  const pts = pendingRoom.points.map((p) => ({ ...p }));
  if (pendingRoom.drawCursor) pts.push({ ...pendingRoom.drawCursor });
  return pts;
}

function ringForMetrics(): { pts: Pt[]; closed: boolean } | null {
  if (pendingRoom?.closed && pendingRoom.points.length >= 2) {
    return { pts: pendingRoom.points, closed: true };
  }
  const drawing = pendingDrawDisplayPoints();
  if (drawing && drawing.length >= 2) {
    return { pts: drawing, closed: false };
  }
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
  } else if (pendingRoom?.drawing && !pendingRoom.closed) {
    // Live segment length: last corner → cursor (helps place the next point accurately).
    const pts = pendingDrawDisplayPoints();
    if (pts && pts.length >= 2) {
      const a = pts[pts.length - 2]!;
      const b = pts[pts.length - 1]!;
      toolLengthMmEl.value = fmtMeasure(pathLengthM([a, b], mpu, false), 2);
    } else {
      toolLengthMmEl.value = "—";
    }
  } else {
    toolLengthMmEl.value = "—";
  }

  const ring = ringForMetrics();
  if (ring) {
    toolCircMmEl.value = fmtMeasure(pathLengthM(ring.pts, mpu, ring.closed), 2);
    // Area only when the polygon is closed (provisional open area is confusing while placing edges).
    toolAreaMm2El.value =
      ring.closed && ring.pts.length >= 3 ? fmtMeasure(pathAreaM2(ring.pts, mpu), 2) : "—";
  } else {
    toolCircMmEl.value = "—";
    toolAreaMm2El.value = "—";
  }
}

function updateToolHint(): void {
  if (!toolHintEl) return;
  const n = activePartNoun();
  if (!activeScaleMpu()) {
    toolHintEl.textContent = `Zet eerst de schaal, meet daarna een lengte of teken een ${n.singular}.`;
    return;
  }
  if (kozijnDraft) {
    toolHintEl.textContent =
      kozijnDraft.phase === "mullion"
        ? "Dwarsbalk: klik op kader → andere zijde (groen snap). Dubbelklik = opslaan. Daarna: glas kiezen + kozijn selecteren → Vul glas."
        : "Buitenste kader: klik hoeken (H/V). Snap groen op startpunt om te sluiten, daarna Opslaan.";
    return;
  }
  if (pendingRoom?.drawing && !pendingRoom.closed) {
    toolHintEl.textContent =
      pendingRoom.points.length === 0
        ? `Klik hoeken van de ${n.singular}. Lengte toont het actieve segment; omtrek loopt mee.`
        : `${pendingRoom.points.length} hoekpunt(en). Lengte = huidig segment; sluit bij het startkruis (groen) voor oppervlakte.`;
    return;
  }
  if (pendingRoom?.closed) {
    toolHintEl.textContent = `Polygoon van ${n.singular} klaar — omtrek/oppervlakte getoond. Sleep hoeken of sla ${n.singular} op.`;
    return;
  }
  if (measure.tool === "length") {
    toolHintEl.textContent =
      measure.points.length < 2
        ? "Klik twee punten om lengte te meten (live bij bewegen)."
        : "Lengte klaar. Wissen of opnieuw klikken om opnieuw te beginnen.";
    return;
  }
  toolHintEl.textContent = `Kies Lengte, Teken ${n.singular} of Kozijn.`;
}

function activeToolMode(): ToolMode {
  if (kozijnDraft) return "kozijn";
  if (pendingRoom?.drawing || pendingRoom?.closed) return "room";
  if (measure.tool === "length") return "length";
  return "off";
}

function hasSelectedWoodKozijn(): boolean {
  if (
    pendingRoom?.editingId &&
    rooms.some((r) => r.id === pendingRoom!.editingId && r.analysis?.kozijn_role === "wood")
  ) {
    return true;
  }
  return rooms.some((r) => selectedSetIds.has(r.id) && r.analysis?.kozijn_role === "wood");
}

function syncToolButtons(): void {
  const mode = activeToolMode();
  const n = activePartNoun();
  document.querySelectorAll<HTMLButtonElement>(".tool-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn.dataset.tool || "off") === mode);
    if (btn.dataset.tool === "room") btn.textContent = `Teken ${n.singular}`;
  });
  const showKozijn =
    !isFloormapKind() && (mode === "kozijn" || hasSelectedWoodKozijn() || Boolean(kozijnDraft));
  kozijnPanelEl?.classList.toggle("hidden", !showKozijn);
  syncKozijnUi();
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

function readKozijnWidthM(): number {
  const mm = Number(kozijnWidthMmEl?.value);
  if (Number.isFinite(mm) && mm >= 10 && mm <= 300) return mm / 1000;
  return DEFAULT_KOZIJN_WIDTH_M;
}

function clearKozijnDraft(): void {
  kozijnDraft = null;
  syncKozijnUi();
  syncToolButtons();
  updateToolHint();
  drawOverlay();
}

const KOZIJN_MAT_REQUIRED_MSG =
  "Kies eerst een kozijnmateriaal (subrubriek Kozijnen) voordat de kozijn-tool actief wordt.";

/** Vastleggen kozijnmateriaal; `force` overschrijft (bv. bij Opslaan zonder glas). */
function lockKozijnWoodMaterial(mat: CatalogMaterial | null, force = false): void {
  if (!kozijnDraft || !mat || !isKozijnFrameMaterial(mat)) return;
  if (!force && kozijnDraft.woodMaterialId) return;
  kozijnDraft.woodMaterialId = mat.material_id;
  kozijnDraft.woodMaterial = { ...mat };
}

function requireKozijnMaterialSelected(): CatalogMaterial | null {
  const mat = selectedCatalogMaterial();
  if (!isKozijnFrameMaterial(mat)) {
    setStatus(KOZIJN_MAT_REQUIRED_MSG, "err");
    return null;
  }
  return mat;
}

function resolveKozijnWoodMaterial(): CatalogMaterial | null {
  if (!kozijnDraft) return null;
  if (kozijnDraft.woodMaterial?.material_id) return kozijnDraft.woodMaterial;
  const id = (kozijnDraft.woodMaterialId || "").trim();
  if (!id) return null;
  return (
    resolveCatalogMaterial(id) ||
    favoriteMaterials.find((m) => m.material_id === id) ||
    null
  );
}

function beginKozijnDraft(fromRoom?: RoomSubsection | null): boolean {
  if (isFloormapKind()) {
    setStatus("Kozijn-tool is alleen op de geveltekening", "err");
    return false;
  }
  if (pendingRoom) clearPendingRoom();
  measure = { tool: "off", points: [], cursor: null };
  const w = readKozijnWidthM();

  // Hervat bestaand kozijn (dwarsbalken / verder bewerken).
  if (fromRoom?.analysis?.kozijn_role === "wood" && fromRoom.analysis.kozijn_frame) {
    const parsed = parseKozijnFrame(fromRoom.analysis.kozijn_frame);
    if (!parsed?.segments.length) {
      setStatus("Dit kozijn heeft geen bewerkbare hartlijnen", "err");
      return false;
    }
    const wood =
      resolveCatalogMaterial(fromRoom.analysis.material_id) ||
      favoriteMaterials.find((m) => m.material_id === fromRoom.analysis?.material_id) ||
      (isKozijnFrameMaterial(selectedCatalogMaterial()) ? selectedCatalogMaterial() : null);
    kozijnDraft = {
      segments: parsed.segments.map((s) => ({
        ...s,
        points: s.points.map((p) => ({ ...p })),
      })),
      activeIndex: parsed.segments.length - 1,
      livePoints: [],
      cursor: null,
      defaultWidthM: w,
      eval: null,
      woodMaterialId: wood?.material_id || fromRoom.analysis.material_id || null,
      woodMaterial: wood ? { ...wood } : null,
      phase: "mullion",
      frameClosed: true,
      woodSubsectionId: fromRoom.id,
      assemblyId: parsed.assemblyId || fromRoom.analysis.kozijn_assembly_id || null,
    };
    syncKozijnEval();
    syncToolButtons();
    updateToolHint();
    drawOverlay();
    setStatus("Kozijn hervat — teken dwarsbalken (kader → kader), dubbelklik = opslaan", "busy");
    return true;
  }

  const wood = requireKozijnMaterialSelected();
  if (!wood) return false;
  kozijnDraft = {
    segments: [],
    activeIndex: -1,
    livePoints: [],
    cursor: null,
    defaultWidthM: w,
    eval: null,
    woodMaterialId: wood.material_id,
    woodMaterial: { ...wood },
    phase: "frame",
    frameClosed: false,
    woodSubsectionId: null,
    assemblyId: null,
  };
  syncKozijnEval();
  syncToolButtons();
  updateToolHint();
  drawOverlay();
  setStatus(
    `Kozijn: teken buitenste kader (${wood.name || wood.catalog_id || "kozijn"}) — sluit op startpunt`,
    "busy",
  );
  return true;
}

/** Snap terug naar eerste punt van het buitenste kader (≥3 hoeken). */
function kozijnFrameCloseSnap(raw: Pt): Pt | null {
  if (!kozijnDraft || kozijnDraft.phase !== "frame" || kozijnDraft.frameClosed) return null;
  if (kozijnDraft.livePoints.length < 3) return null;
  const first = kozijnDraft.livePoints[0];
  const tolPx = kozijnJunctionSnapPx();
  if (normDistancePxCore(raw, first, canvasWidth, canvasHeight) > tolPx) return null;
  return { ...first };
}

function closeKozijnOuterFrame(): void {
  if (!kozijnDraft || kozijnDraft.livePoints.length < 3) return;
  const first = kozijnDraft.livePoints[0];
  const last = kozijnDraft.livePoints[kozijnDraft.livePoints.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) > 1e-9) {
    kozijnDraft.livePoints.push({ ...first });
  }
  commitKozijnLiveLine();
  kozijnDraft.frameClosed = true;
  syncKozijnEval();
  const ev = kozijnDraft.eval;
  if (ev?.closure === "closed") {
    setStatus("Kader gesloten — klik Opslaan, daarna dwarsbalken tekenen", "ok");
  } else {
    setStatus(
      `Kader vastgelegd (${ev?.closureHint || "controleer aansluiting"}). Opslaan als de omtrek klopt.`,
      "busy",
    );
  }
  updateToolHint();
}

function syncKozijnEval(): void {
  if (!kozijnDraft) return;
  // Weld vóór evaluatie zodat bijna-raak eindpunten als gesloten tellen.
  const tol = kozijnWeldTolFromPixels(12, canvasWidth, canvasHeight);
  const welded = weldKozijnPoints(kozijnDraft.segments, kozijnDraft.livePoints, tol);
  const segs = welded.segments.slice();
  if (welded.extraPoints.length >= 2) {
    segs.push({
      id: "_live",
      points: welded.extraPoints.map((p) => ({ ...p })),
      width_m: kozijnDraft.defaultWidthM,
    });
  }
  kozijnDraft.eval = evaluateKozijnFrame(segs, activeScaleMpu(), activeScaleAspect());
  syncKozijnUi();
}

function syncKozijnUi(): void {
  if (!kozijnDraft) {
    if (kozijnClosureEl) kozijnClosureEl.textContent = "Sluitstatus: —";
    if (kozijnAreaEl) kozijnAreaEl.textContent = "Kozijnopp.: — · Opening: —";
    if (kozijnSaveBtn) {
      kozijnSaveBtn.disabled = true;
      kozijnSaveBtn.textContent = "Opslaan kozijn";
    }
    if (kozijnFillGlassBtn) {
      const ready =
        isGlassFrameMaterial(selectedCatalogMaterial()) && hasSelectedWoodKozijn();
      kozijnFillGlassBtn.disabled = !ready;
      kozijnFillGlassBtn.title = ready
        ? "Vul alle ingesloten vlakken van het geselecteerde kozijn met glas"
        : "Kies glasmateriaal en selecteer een kozijn in de lijst";
    }
    return;
  }
  const ev = kozijnDraft.eval;
  if (kozijnClosureEl) {
    kozijnClosureEl.textContent = ev
      ? `Sluitstatus: ${ev.closure === "closed" ? "gesloten" : ev.closure === "warn" ? "bijna" : "open"} — ${ev.closureHint}`
      : "Sluitstatus: —";
  }
  if (kozijnAreaEl) {
    const wood = ev?.woodAreaM2 != null ? `${ev.woodAreaM2.toFixed(2)} m²` : "—";
    const len =
      ev?.woodBeamLengthM != null ? `${ev.woodBeamLengthM.toFixed(2)} m × b` : null;
    const open = ev?.openingAreaM2 != null ? `${ev.openingAreaM2.toFixed(2)} m²` : "—";
    kozijnAreaEl.textContent = len
      ? `Kozijnopp.: ${wood} (${len}) · Opening: ${open}`
      : `Kozijnopp.: ${wood} · Opening: ${open}`;
  }
  const canSave = Boolean(
    kozijnDraft.frameClosed &&
      ev &&
      ev.woodPolygons.length &&
      (ev.closure === "closed" || ev.closure === "warn"),
  );
  if (kozijnSaveBtn) {
    kozijnSaveBtn.disabled = !canSave;
    kozijnSaveBtn.textContent =
      kozijnDraft.phase === "mullion" && kozijnDraft.woodSubsectionId
        ? "Opslaan dwarsbalken"
        : "Opslaan kozijn";
  }
  const glassReady =
    isGlassFrameMaterial(selectedCatalogMaterial()) &&
    (Boolean(ev && ev.glassPolygons.length > 0 && kozijnDraft.woodSubsectionId) ||
      rooms.some(
        (r) =>
          r.analysis?.kozijn_role === "wood" &&
          (selectedSetIds.has(r.id) || pendingRoom?.editingId === r.id),
      ));
  if (kozijnFillGlassBtn) {
    kozijnFillGlassBtn.disabled = !glassReady;
    kozijnFillGlassBtn.title = glassReady
      ? "Vul alle ingesloten vlakken van het geselecteerde/opgeslagen kozijn met glas"
      : "Kies glasmateriaal en selecteer een opgeslagen kozijn (of sla eerst het kader op)";
  }
}

/** Generous junction snap (zoals sluit-snap bij teken-polygoon). */
function kozijnJunctionSnapPx(): number {
  return Boolean(detail) ? 36 : 28;
}

function weldKozijnDraftGeometry(): void {
  if (!kozijnDraft) return;
  const tol = kozijnWeldTolFromPixels(12, canvasWidth, canvasHeight);
  const welded = weldKozijnPoints(kozijnDraft.segments, kozijnDraft.livePoints, tol);
  kozijnDraft.segments = welded.segments;
  kozijnDraft.livePoints = welded.extraPoints;
}

function commitKozijnLiveLine(): void {
  if (!kozijnDraft || kozijnDraft.livePoints.length < 2) return;
  kozijnDraft.segments.push({
    id: newKozijnSegmentId(),
    points: kozijnDraft.livePoints.map((p) => ({ ...p })),
    width_m: kozijnDraft.defaultWidthM,
  });
  kozijnDraft.activeIndex = kozijnDraft.segments.length - 1;
  kozijnDraft.livePoints = [];
  weldKozijnDraftGeometry();
  syncKozijnEval();
  drawOverlay();
}

function kozijnSnapTargets(): Pt[] {
  if (!kozijnDraft) return [];
  return collectKozijnSnapTargets(kozijnDraft.segments, kozijnDraft.livePoints);
}

/** Bijna H/V in pixels (niet micro-norm) — anders sluit je nooit. */
function kozijnNearlyAxisAlignedPx(from: Pt, t: Pt, tolPx: number): boolean {
  const dx = Math.abs(t.x - from.x) * Math.max(1, canvasWidth);
  const dy = Math.abs(t.y - from.y) * Math.max(1, canvasHeight);
  return dx <= tolPx || dy <= tolPx;
}

/**
 * Auto-snap: sluit-kader → H/V-ortho → hoeken/kruisingen → T-kruising op kaderlijn.
 */
function effectiveKozijnDrawPoint(raw: Pt): { pt: Pt; atJunction: boolean } {
  if (!kozijnDraft) return { pt: raw, atJunction: false };
  const closePt = kozijnFrameCloseSnap(raw);
  if (closePt) return { pt: closePt, atJunction: true };
  const from =
    kozijnDraft.livePoints.length > 0
      ? kozijnDraft.livePoints[kozijnDraft.livePoints.length - 1]
      : null;
  const ortho = from ? orthoSnapPoint(from, raw) : raw;
  const targets = kozijnSnapTargets();
  const tolPx = kozijnJunctionSnapPx();
  const w = Math.max(1, canvasWidth);
  const h = Math.max(1, canvasHeight);
  const edgeTolNorm = kozijnWeldTolFromPixels(tolPx, w, h);

  let best: Pt | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    if (from && Math.hypot(t.x - from.x, t.y - from.y) < 1e-9) continue;
    if (from && !kozijnNearlyAxisAlignedPx(from, t, tolPx)) continue;
    const d = Math.min(
      normDistancePxCore(raw, t, w, h),
      normDistancePxCore(ortho, t, w, h),
    );
    if (d <= tolPx && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  if (best) return { pt: { ...best }, atJunction: true };

  // T-kruising: snij H/V-rail met bestaande balk (dwarsbalk midden in een zijde).
  if (from && kozijnDraft.segments.length) {
    const isHoriz = Math.abs(ortho.y - from.y) < 1e-12;
    let edgeBest: Pt | null = null;
    let edgeD = Infinity;
    for (const e of kozijnEdgePieces(kozijnDraft.segments)) {
      // Snij horizontaal/verticaal door `from` met rand e.
      let hit: Pt | null = null;
      if (isHoriz) {
        const y = from.y;
        const minY = Math.min(e.a.y, e.b.y);
        const maxY = Math.max(e.a.y, e.b.y);
        if (y < minY - edgeTolNorm || y > maxY + edgeTolNorm) continue;
        if (Math.abs(e.a.x - e.b.x) < 1e-12) {
          // Verticale rand
          hit = { x: e.a.x, y };
        } else if (Math.abs(e.a.y - e.b.y) < 1e-12) {
          // Horizontale rand — alleen als op dezelfde y (overlap)
          if (Math.abs(e.a.y - y) > edgeTolNorm) continue;
          hit = closestPointOnSegment(ortho, e.a, e.b);
        } else {
          // Schuin: projecteer
          const q = closestPointOnSegment({ x: ortho.x, y }, e.a, e.b);
          if (Math.abs(q.y - y) <= edgeTolNorm) hit = { x: q.x, y };
        }
      } else {
        const x = from.x;
        const minX = Math.min(e.a.x, e.b.x);
        const maxX = Math.max(e.a.x, e.b.x);
        if (x < minX - edgeTolNorm || x > maxX + edgeTolNorm) continue;
        if (Math.abs(e.a.y - e.b.y) < 1e-12) {
          hit = { x, y: e.a.y };
        } else if (Math.abs(e.a.x - e.b.x) < 1e-12) {
          if (Math.abs(e.a.x - x) > edgeTolNorm) continue;
          hit = closestPointOnSegment(ortho, e.a, e.b);
        } else {
          const q = closestPointOnSegment({ x, y: ortho.y }, e.a, e.b);
          if (Math.abs(q.x - x) <= edgeTolNorm) hit = { x, y: q.y };
        }
      }
      if (!hit) continue;
      if (Math.hypot(hit.x - from.x, hit.y - from.y) < 1e-9) continue;
      // Alleen in de tekenrichting (niet terug naar from).
      if (isHoriz && (hit.x - from.x) * (ortho.x - from.x) < 0) continue;
      if (!isHoriz && (hit.y - from.y) * (ortho.y - from.y) < 0) continue;
      const d = normDistancePxCore(ortho, hit, w, h);
      if (d <= tolPx * 1.25 && d < edgeD) {
        edgeBest = hit;
        edgeD = d;
      }
    }
    if (edgeBest) return { pt: { ...edgeBest }, atJunction: true };
  }

  // Eerste punt op een bestaande balk (start dwarsbalk).
  if (!from && kozijnDraft.segments.length) {
    const onEdge = snapPointToKozijnEdge(raw, kozijnDraft.segments, edgeTolNorm);
    if (onEdge) {
      const d = normDistancePxCore(raw, onEdge, w, h);
      if (d <= tolPx) return { pt: { ...onEdge }, atJunction: true };
    }
    for (const t of targets) {
      const d = normDistancePxCore(raw, t, w, h);
      if (d <= tolPx && d < bestD) {
        best = t;
        bestD = d;
      }
    }
    if (best) return { pt: { ...best }, atJunction: true };
  }

  return { pt: ortho, atJunction: false };
}

function reportKozijnClosureAfterCommit(): void {
  const ev = kozijnDraft?.eval;
  if (!ev) {
    setStatus("Lijn vastgelegd", "ok");
    return;
  }
  if (kozijnDraft?.phase === "mullion") {
    if (ev.closure === "closed") {
      setStatus(`${ev.closureHint}. Dubbelklik of «Opslaan dwarsbalken».`, "ok");
    } else {
      setStatus(
        `Dwarsbalk gezet (${ev.closureHint}). Snap beide einden op het kader (groen).`,
        "busy",
      );
    }
    return;
  }
  if (ev.closure === "closed") {
    setStatus(`Kader gesloten — ${ev.closureHint}. Klik Opslaan.`, "ok");
  } else if (ev.closure === "warn") {
    setStatus(
      `Lijn vastgelegd (${ev.closureHint}). Trek open einden groen naar de kaderlijn.`,
      "busy",
    );
  } else {
    setStatus(`Lijn vastgelegd — ${ev.closureHint}`, "busy");
  }
}

/** Dubbelklik: in frame-fase sluiten; in mullion-fase lijn + opslaan. */
function closeKozijnAtJunction(raw: Pt): boolean {
  if (!kozijnDraft) return false;
  if (kozijnDraft.phase === "frame" && !kozijnDraft.frameClosed && kozijnFrameCloseSnap(raw)) {
    closeKozijnOuterFrame();
    return true;
  }
  const { pt, atJunction } = effectiveKozijnDrawPoint(raw);
  if (kozijnDraft.livePoints.length === 0) {
    if (!atJunction) return false;
    kozijnDraft.livePoints.push({ ...pt });
    kozijnDraft.cursor = null;
    syncKozijnEval();
    drawOverlay();
    setStatus("Start op kader — klik andere zijde (groen)", "busy");
    return true;
  }
  const last = kozijnDraft.livePoints[kozijnDraft.livePoints.length - 1];
  if (Math.hypot(pt.x - last.x, pt.y - last.y) > 1e-9) {
    kozijnDraft.livePoints.push({ ...pt });
  }
  if (kozijnDraft.livePoints.length < 2) {
    kozijnDraft.cursor = null;
    syncKozijnEval();
    drawOverlay();
    return true;
  }
  commitKozijnLiveLine();
  if (kozijnDraft.phase === "mullion" && kozijnDraft.woodSubsectionId) {
    void saveKozijnDraft({ keepOpen: true });
    return true;
  }
  reportKozijnClosureAfterCommit();
  return true;
}

function setMeasureTool(tool: ToolMode): void {
  if (tool === "room") {
    if (kozijnDraft) clearKozijnDraft();
    if (pendingRoom?.drawing) {
      syncToolButtons();
      updateToolHint();
      return;
    }
    beginDrawRoom();
    return;
  }

  if (tool === "kozijn") {
    if (calibrate) endCalibrate();
    if (discovery) {
      setStatus("Rond ontdekken eerst af of annuleer", "err");
      syncToolButtons();
      return;
    }
    if (!activeScaleMpu()) {
      setStatus("Zet eerst de schaal", "err");
      syncToolButtons();
      return;
    }
    if (kozijnDraft) {
      syncToolButtons();
      updateToolHint();
      return;
    }
    const selectedWood =
      (pendingRoom?.editingId &&
        rooms.find(
          (r) => r.id === pendingRoom!.editingId && r.analysis?.kozijn_role === "wood",
        )) ||
      rooms.find((r) => selectedSetIds.has(r.id) && r.analysis?.kozijn_role === "wood") ||
      null;
    if (!beginKozijnDraft(selectedWood)) {
      syncToolButtons();
    }
    return;
  }

  if (tool !== "off") {
    if (calibrate) endCalibrate();
    if (discovery) {
      setStatus("Rond ontdekken eerst af of annuleer voordat u meet", "err");
      syncToolButtons();
      return;
    }
    if (!activeScaleMpu()) {
      setStatus("Zet eerst de schaal", "err");
      measure.tool = "off";
      syncToolButtons();
      updateToolHint();
      return;
    }
  }

  if (kozijnDraft) clearKozijnDraft();
  if (pendingRoom) clearPendingRoom();
  measure = { tool: tool === "length" ? "length" : "off", points: [], cursor: null };
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
  if (tool === "length") setStatus("Lengte meten: klik twee punten", "busy");
}

/** Openingsopp. (norm) van kozijn-assemblies volledig binnen deze muur. */
function kozijnOpeningNormInsideRoom(wall: RoomSubsection, wallPts?: Pt[]): number {
  if (wall.analysis?.kozijn_role === "wood" || wall.analysis?.kozijn_role === "glass") {
    return 0;
  }
  const ring = wallPts && wallPts.length >= 3 ? wallPts : wall.points;
  if (!ring || ring.length < 3) return 0;
  const openings: Array<{ ring: Pt[]; areaNorm?: number }> = [];
  for (const r of rooms) {
    if (r.id === wall.id) continue;
    if (r.analysis?.kozijn_role !== "wood") continue;
    const frame = r.analysis?.kozijn_frame;
    if (!frame?.opening?.length) continue;
    for (const op of frame.opening) {
      if (!Array.isArray(op) || op.length < 3) continue;
      openings.push({
        ring: op,
        areaNorm:
          frame.opening_area_norm != null && frame.opening.length === 1
            ? Number(frame.opening_area_norm)
            : undefined,
      });
    }
  }
  return openingAreaNormInsideWall(ring, openings);
}

function resolveCatalogMaterial(id: string | null | undefined): CatalogMaterial | null {
  const mid = (id || "").trim();
  if (!mid) return null;
  return catalogMaterials.find((m) => m.material_id === mid) || null;
}

function collectKozijnSaveContext(opts?: { withGlass?: boolean }): {
  label: string;
  level: string;
  vg_nr: number | null;
  vr_nr: string | null;
  gevelgroep_nr: number;
  ori: string;
  woodMat: CatalogMaterial;
  glassMat: CatalogMaterial | null;
} | null {
  if (!activeSection || !auth() || isFloormapKind() || !kozijnDraft) return null;
  // Lijstfilter VR5 · groep 2 = waar het component terecht moet komen.
  syncVgVrFormFromListFilter();
  const vgVr = parseVgVrInputs();
  if (vgVr.error) {
    setStatus(vgVr.error, "err");
    return null;
  }
  if (vgVr.vg_nr == null || !vgVr.vr_nr) {
    setStatus(
      roomListVrFilter
        ? `VG/VR ontbreekt voor filter VR ${roomListVrFilter} — vul VG/VR in het formulier`
        : "Vul VG en VR in (of kies een VR-filter) zodat het kozijn bij de juiste ruimte hoort",
      "err",
    );
    return null;
  }
  const ori = readComponentOrientatie();
  if (!ori) {
    setStatus("Kies een geveloriëntatie (N…NW) voor dit kozijn", "err");
    componentOriBlockEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return null;
  }
  const picked = selectedCatalogMaterial();
  if (!opts?.withGlass && picked) {
    // Opslaan kozijn (zonder glas): huidige selectie = kozijnmateriaal.
    lockKozijnWoodMaterial(picked, true);
  } else if (picked && !kozijnDraft.woodMaterialId) {
    // Nog geen kozijnmateriaal vastgelegd — eerste keuze telt als hout.
    lockKozijnWoodMaterial(picked, false);
  }
  const woodMat =
    resolveKozijnWoodMaterial() ||
    (!opts?.withGlass && isKozijnFrameMaterial(picked) ? picked : null);
  if (!woodMat || !isKozijnFrameMaterial(woodMat)) {
    setStatus(
      opts?.withGlass
        ? "Geen kozijnmateriaal vastgelegd — kies subrubriek Kozijnen, start de tool opnieuw"
        : KOZIJN_MAT_REQUIRED_MSG,
      "err",
    );
    return null;
  }
  // Houd snapshot synchroon (ook als resolve via favorieten ging).
  lockKozijnWoodMaterial(woodMat, true);
  let glassMat: CatalogMaterial | null = null;
  if (opts?.withGlass) {
    glassMat = picked;
    if (!glassMat) {
      setStatus("Kies een glasmateriaal in de catalogus, daarna «Vul glas»", "err");
      return null;
    }
    if (glassMat.material_id === woodMat.material_id) {
      setStatus(
        `Nog kozijnmateriaal geselecteerd (${woodMat.name || woodMat.catalog_id}). Wissel naar een glasmateriaal, dan «Vul glas».`,
        "err",
      );
      return null;
    }
    if (!isGlassFrameMaterial(glassMat)) {
      setStatus(
        `«Vul glas» vereist een glasmateriaal — nu geselecteerd: ${glassMat.name || glassMat.category || "onbekend"}`,
        "err",
      );
      return null;
    }
  }
  return {
    label: (roomLabelInput.value || "").trim() || "Kozijn",
    level: roomLevelSelect.value || "OTHER",
    vg_nr: vgVr.vg_nr,
    vr_nr: vgVr.vr_nr,
    gevelgroep_nr: activeListGevelgroepNr(),
    ori,
    woodMat,
    glassMat,
  };
}

async function saveKozijnDraft(opts?: {
  withGlass?: boolean;
  /** Na opslaan tool open houden (dwarsbalken). */
  keepOpen?: boolean;
}): Promise<void> {
  if (!kozijnDraft || !activeSection || !auth()) return;
  commitKozijnLiveLine();
  syncKozijnEval();
  const ev = kozijnDraft.eval;
  if (!ev?.woodPolygons.length) {
    setStatus("Geen kozijnoppervlak — teken eerst het kader", "err");
    return;
  }
  if (!kozijnDraft.frameClosed) {
    setStatus("Sluit eerst het buitenste kader (snap op startpunt)", "err");
    return;
  }
  if (ev.closure === "open") {
    setStatus("Kader is nog open — sluit de omtrek eerst", "err");
    return;
  }
  if (ev.closure === "warn" && !window.confirm(`${ev.closureHint}. Toch opslaan?`)) {
    return;
  }
  const ctx = collectKozijnSaveContext(opts);
  if (!ctx) return;
  const mpu = activeScaleMpu();
  const assemblyId =
    kozijnDraft.assemblyId ||
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `kz-asm-${Date.now().toString(36)}`);
  const framePayload = {
    ...serializeKozijnFrame(kozijnDraft.segments, assemblyId, ev),
    opening_area_m2: ev.openingAreaM2,
    wood_beam_length_m: ev.woodBeamLengthM,
    wood_area_m2: ev.woodAreaM2,
  };
  const existingWood = kozijnDraft.woodSubsectionId
    ? rooms.find((r) => r.id === kozijnDraft!.woodSubsectionId)
    : null;
  const gevelExtra = gevelAnalysisForSave(existingWood?.analysis || null, {
    ...(ctx.gevelgroep_nr > 1 ? { gevelgroep_nr: ctx.gevelgroep_nr } : {}),
  });
  const whereBit = `VG ${ctx.vg_nr} · VR ${ctx.vr_nr}${
    ctx.gevelgroep_nr > 1 ? ` · groep ${ctx.gevelgroep_nr}` : ""
  }`;
  const updating = Boolean(kozijnDraft.woodSubsectionId);
  setStatus(updating ? `Dwarsbalken opslaan bij ${whereBit}…` : `Kozijn opslaan bij ${whereBit}…`, "busy");
  if (kozijnSaveBtn) kozijnSaveBtn.disabled = true;

  const pushOptimisticRoom = (
    saved: SubsectionSaveResult,
    body: {
      label: string;
      points: Pt[];
      holes?: Pt[][];
      analysis: SubsectionAnalysis;
      area_m2?: number | null;
      area_norm?: number | null;
    },
  ): void => {
    const savedId = saved.subsection_id;
    const savedVg =
      saved.vg_nr != null && Number.isFinite(Number(saved.vg_nr))
        ? Number(saved.vg_nr)
        : ctx.vg_nr;
    const savedVr =
      saved.vr_nr != null && String(saved.vr_nr).trim()
        ? String(saved.vr_nr).trim()
        : ctx.vr_nr;
    const holes = (body.holes || []).filter((h) => h.length >= 3);
    const patched: RoomSubsection = {
      id: savedId,
      section_id: activeSection!.id,
      label: body.label,
      level_hint: ctx.level,
      vg_nr: savedVg,
      vr_nr: savedVr,
      points: body.points.map((p) => ({ ...p })),
      area_m2:
        saved.area_m2 != null
          ? Number(saved.area_m2)
          : body.area_m2 != null
            ? Number(body.area_m2)
            : null,
      area_norm:
        saved.area_norm != null
          ? Number(saved.area_norm)
          : body.area_norm != null
            ? Number(body.area_norm)
            : null,
      perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
      perimeter_norm: null,
      metres_per_norm_unit: mpu,
      analysis_status: "ok",
      sort_order: rooms.length,
      analysis: {
        ...body.analysis,
        ...(saved.analysis || {}),
        holes: holes.length ? holes : undefined,
      },
    };
    const idx = rooms.findIndex((r) => normRoomId(r.id) === normRoomId(savedId));
    if (idx >= 0) rooms[idx] = { ...rooms[idx], ...patched, analysis: patched.analysis };
    else rooms = [...rooms, patched];
    markRoomTouched(savedId);
    noteLocalRoomPatch(patched);
  };

  try {
    const woodRing = ev.woodPolygons[0];
    const woodHoles = [
      ...(ev.woodHoles || []),
      ...ev.woodPolygons.slice(1),
    ].filter((h) => h.length >= 3);
    const woodAnalysis: SubsectionAnalysis = {
      ...(gevelExtra as SubsectionAnalysis),
      material_id: ctx.woodMat.material_id,
      master_category: ctx.woodMat.master_category,
      material_name: ctx.woodMat.name,
      catalog_id: ctx.woodMat.catalog_id,
      category: ctx.woodMat.category,
      rubriek_nr: ctx.woodMat.rubriek_nr,
      orientatie: ctx.ori,
      kozijn_role: "wood",
      kozijn_assembly_id: assemblyId,
      kozijn_frame: framePayload,
      area_norm: ev.woodAreaNorm,
      area_m2: ev.woodAreaM2 ?? undefined,
    };
    const woodSaved = await saveDrawingSubsection({
      section_id: activeSection.id,
      subsection_id: kozijnDraft.woodSubsectionId || undefined,
      label: ctx.label,
      level_hint: ctx.level,
      vg_nr: ctx.vg_nr,
      vr_nr: ctx.vr_nr,
      points: woodRing,
      holes: woodHoles,
      metres_per_norm_unit: mpu ?? undefined,
      scale_aspect_yx: activeScaleAspect(),
      analysis: woodAnalysis,
      // Server gebruikt dit voor kozijn_role=wood (lengte × breedte).
      area_m2: ev.woodAreaM2 ?? undefined,
      perimeter_m: ev.woodBeamLengthM ?? undefined,
    });
    const woodAreaM2 =
      ev.woodAreaM2 != null
        ? ev.woodAreaM2
        : woodSaved.area_m2 != null
          ? Number(woodSaved.area_m2)
          : null;
    const woodPeriM =
      ev.woodBeamLengthM != null
        ? ev.woodBeamLengthM
        : woodSaved.perimeter_m != null
          ? Number(woodSaved.perimeter_m)
          : null;
    pushOptimisticRoom(
      {
        ...woodSaved,
        area_m2: woodAreaM2,
        perimeter_m: woodPeriM,
      },
      {
        label: ctx.label,
        points: woodRing,
        holes: woodHoles,
        analysis: woodAnalysis,
        area_m2: woodAreaM2,
        area_norm: ev.woodAreaNorm,
      },
    );

    kozijnDraft.woodSubsectionId = woodSaved.subsection_id;
    kozijnDraft.assemblyId = assemblyId;
    kozijnDraft.phase = "mullion";
    kozijnDraft.frameClosed = true;

    let regel2Bit = "";
    try {
      const sealed = await applyRegel2KozijnSeal(woodSaved.subsection_id, ctx.woodMat);
      if (sealed) regel2Bit = " · kier (regel 2)";
    } catch (sealErr) {
      console.warn("regel 2 na kozijn-opslag mislukt", sealErr);
    }

    roomsLoadEpoch += 1;
    const stayOpen = opts?.keepOpen !== false && !opts?.withGlass;
    if (!stayOpen) {
      clearKozijnDraft();
    } else {
      kozijnDraft.livePoints = [];
      kozijnDraft.cursor = null;
      syncKozijnEval();
      syncToolButtons();
      updateToolHint();
    }
    renderRoomList();
    drawOverlay();
    setStatus(
      stayOpen
        ? updating
          ? `Dwarsbalken opgeslagen bij ${whereBit}. Teken verder of Vul glas.${regel2Bit}`
          : `Kader opgeslagen bij ${whereBit}. Teken nu dwarsbalken (kader → kader); dubbelklik = opslaan.${regel2Bit}`
        : `Kozijn opgeslagen bij ${whereBit}.${regel2Bit}`,
      "ok",
    );
    try {
      await loadRooms({ preserveOrder: true });
    } catch (reloadErr) {
      console.warn("loadRooms after kozijn save failed", reloadErr);
    }
    renderRoomList();
    drawOverlay();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncKozijnUi();
  }
}

/** Vul glas: glasmateriaal + geselecteerd/actief kozijn → alle ingesloten vlakken. */
async function fillKozijnGlass(): Promise<void> {
  if (!activeSection || !auth()) return;
  const glassMat = selectedCatalogMaterial();
  if (!isGlassFrameMaterial(glassMat)) {
    setStatus("Kies eerst een glasmateriaal, selecteer daarna het kozijn en klik «Vul glas».", "err");
    return;
  }

  // Zorg dat actuele dwarsbalken eerst opgeslagen zijn.
  if (kozijnDraft?.woodSubsectionId && kozijnDraft.frameClosed) {
    await saveKozijnDraft({ keepOpen: true });
  }

  const woodRoom =
    (kozijnDraft?.woodSubsectionId &&
      rooms.find((r) => r.id === kozijnDraft!.woodSubsectionId)) ||
    rooms.find((r) => selectedSetIds.has(r.id) && r.analysis?.kozijn_role === "wood") ||
    (pendingRoom?.editingId
      ? rooms.find((r) => r.id === pendingRoom!.editingId && r.analysis?.kozijn_role === "wood")
      : null) ||
    null;
  if (!woodRoom?.analysis?.kozijn_frame) {
    setStatus("Selecteer een opgeslagen kozijn in de lijst, daarna «Vul glas».", "err");
    return;
  }
  if (glassMat!.material_id === woodRoom.analysis.material_id) {
    setStatus("Kies een ander glasmateriaal dan het kozijnmateriaal", "err");
    return;
  }

  const parsed = parseKozijnFrame(woodRoom.analysis.kozijn_frame);
  if (!parsed?.segments.length) {
    setStatus("Kozijn heeft geen hartlijnen om glasvlakken uit te vullen", "err");
    return;
  }
  const mpu = activeScaleMpu() ?? woodRoom.metres_per_norm_unit;
  const ev = evaluateKozijnFrame(parsed.segments, mpu, activeScaleAspect());
  if (!ev.glassPolygons.length) {
    setStatus("Geen ingesloten vlakken — teken eerst een gesloten kader (en dwarsbalken)", "err");
    return;
  }

  const assemblyId =
    parsed.assemblyId ||
    woodRoom.analysis.kozijn_assembly_id ||
    woodRoom.id;
  const ori = String(woodRoom.analysis.orientatie || readComponentOrientatie() || "").trim();
  if (!ori) {
    setStatus("Kozijn mist geveloriëntatie — bewerk het kozijn eerst", "err");
    return;
  }

  // Verwijder oude glasvlakken van deze assembly.
  const oldGlass = rooms.filter(
    (r) =>
      r.analysis?.kozijn_role === "glass" &&
      (r.analysis.kozijn_assembly_id === assemblyId ||
        r.analysis.kozijn_assembly_id === woodRoom.analysis?.kozijn_assembly_id),
  );
  setStatus(`Glas vullen (${ev.glassPolygons.length} vlakken)…`, "busy");
  try {
    for (const g of oldGlass) {
      try {
        await deleteDrawingSubsection(g.id);
        noteLocalRoomDeletion(g.id);
        rooms = rooms.filter((r) => r.id !== g.id);
      } catch (delErr) {
        console.warn("delete old glass failed", g.id, delErr);
      }
    }

    const gg = readGevelgroepNr(woodRoom.analysis);
    let glassN = 0;
    for (let i = 0; i < ev.glassPolygons.length; i++) {
      const gRing = ev.glassPolygons[i];
      const glassAnalysis: SubsectionAnalysis = {
        material_id: glassMat!.material_id,
        master_category: glassMat!.master_category,
        material_name: glassMat!.name,
        catalog_id: glassMat!.catalog_id,
        category: glassMat!.category,
        rubriek_nr: glassMat!.rubriek_nr,
        orientatie: ori,
        ...(gg > 1 ? { gevelgroep_nr: gg } : {}),
        kozijn_role: "glass",
        kozijn_assembly_id: assemblyId,
      };
      const glassSaved = await saveDrawingSubsection({
        section_id: activeSection.id,
        label: `${woodRoom.label || "Kozijn"} · glas ${i + 1}`,
        level_hint: woodRoom.level_hint || "OTHER",
        vg_nr: woodRoom.vg_nr,
        vr_nr: woodRoom.vr_nr,
        points: gRing,
        metres_per_norm_unit: mpu ?? undefined,
        scale_aspect_yx: activeScaleAspect(),
        analysis: glassAnalysis,
      });
      const patched: RoomSubsection = {
        id: glassSaved.subsection_id,
        section_id: activeSection.id,
        label: `${woodRoom.label || "Kozijn"} · glas ${i + 1}`,
        level_hint: woodRoom.level_hint || "OTHER",
        vg_nr: woodRoom.vg_nr,
        vr_nr: woodRoom.vr_nr,
        points: gRing.map((p) => ({ ...p })),
        area_m2: glassSaved.area_m2 != null ? Number(glassSaved.area_m2) : null,
        area_norm: glassSaved.area_norm != null ? Number(glassSaved.area_norm) : null,
        perimeter_m: null,
        perimeter_norm: null,
        metres_per_norm_unit: mpu,
        analysis_status: "ok",
        sort_order: rooms.length,
        analysis: { ...glassAnalysis, ...(glassSaved.analysis || {}) },
      };
      rooms = [...rooms, patched];
      markRoomTouched(patched.id);
      noteLocalRoomPatch(patched);
      glassN += 1;
    }

    roomsLoadEpoch += 1;
    clearKozijnDraft();
    renderRoomList();
    drawOverlay();
    setStatus(`Klaar: ${glassN} glasvlak(ken) gevuld (blauw gearceerd).`, "ok");
    try {
      await loadRooms({ preserveOrder: true });
    } catch (reloadErr) {
      console.warn("loadRooms after fill glass failed", reloadErr);
    }
    renderRoomList();
    drawOverlay();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncKozijnUi();
  }
}

function sectionKindOrder(kind?: string | null): number {
  switch (String(kind || "").toUpperCase()) {
    case "FLOORMAP":
      return 0;
    case "FACADE":
      return 1;
    case "SECTION":
      return 2;
    case "CROSS_SECTION":
      return 3;
    default:
      return 9;
  }
}

function dominantLevelHint(roomsList: RoomSubsection[], sectionLabel: string): string {
  const counts = new Map<string, number>();
  for (const r of roomsList) {
    const h = String(r.level_hint || "").toUpperCase();
    if (!h || h === "OTHER") continue;
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [h, n] of counts) {
    if (n > bestN) {
      best = h;
      bestN = n;
    }
  }
  if (best) return best;
  return inferLevelHintFromLabel(sectionLabel) || "OTHER";
}

function compareVrForOverview(a: string, b: string): number {
  try {
    return compareVrNr(a, b);
  } catch {
    return a.localeCompare(b, "nl", { numeric: true, sensitivity: "base" });
  }
}

type VgVrOverviewRoom = {
  vg: number;
  vr: string;
  label: string;
};

type VgVrOverviewFloor = {
  sectionId: string;
  sectionLabel: string;
  levelHint: string;
  pageIndex: number;
  rooms: VgVrOverviewRoom[];
};

/** Last rendered overview — used by «Naar clipboard». */
let lastVgVrOverviewFloors: VgVrOverviewFloor[] = [];

function vgVrOverviewSummaryText(floors: VgVrOverviewFloor[]): string {
  const nVr = floors.reduce((sum, f) => sum + f.rooms.length, 0);
  const vgSet = new Set<number>();
  for (const f of floors) {
    for (const r of f.rooms) vgSet.add(r.vg);
  }
  const nVg = vgSet.size;
  const vrLabel = nVr === 1 ? "toegekende verblijfsruimte" : "toegekende verblijfsruimten";
  const vgLabel = nVg === 1 ? "verblijfsgebied" : "verblijfsgebieden";
  return `${nVr} ${vrLabel} in ${nVg} ${vgLabel}.`;
}

/** Plain text suitable for Word/Excel paste (tabs + blank lines between floors). */
function formatVgVrOverviewClipboard(floors: VgVrOverviewFloor[]): string {
  const title = buildingLabel || buildingExternalRef || buildingId || "Project";
  const lines: string[] = [`VG/VR — ${title}`, vgVrOverviewSummaryText(floors), ""];
  const withRooms = floors.filter((f) => f.rooms.length > 0);
  const empty = floors.filter((f) => f.rooms.length === 0);
  if (!withRooms.length) {
    lines.push(floors.length ? "Nog geen VG/VR toegekend op plattegronden." : "Geen plattegronden in dit project.");
    return lines.join("\n").trimEnd() + "\n";
  }
  for (const floor of withRooms) {
    lines.push(`${levelLabel(floor.levelHint)} — ${floor.sectionLabel}`);
    lines.push("VG\tVR\tRuimte");
    for (const r of floor.rooms) {
      lines.push(`${r.vg}\t${r.vr}\t${r.label}`);
    }
    lines.push("");
  }
  if (empty.length) {
    lines.push("Zonder VG/VR");
    for (const floor of empty) {
      lines.push(`- ${levelLabel(floor.levelHint)} — ${floor.sectionLabel}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("Clipboard niet beschikbaar");
}

async function copyVgVrOverviewToClipboard(): Promise<void> {
  if (!lastVgVrOverviewFloors.length && !sections.some((s) => isFloormapKind(s.region_kind))) {
    setStatus("Geen VG/VR-overzicht om te kopiëren", "err");
    return;
  }
  try {
    await copyTextToClipboard(formatVgVrOverviewClipboard(lastVgVrOverviewFloors));
    setStatus("VG/VR-overzicht gekopieerd naar clipboard", "ok");
    if (vgVrOverviewCopyBtn) {
      const prev = vgVrOverviewCopyBtn.textContent;
      vgVrOverviewCopyBtn.textContent = "Gekopieerd";
      window.setTimeout(() => {
        if (vgVrOverviewCopyBtn) vgVrOverviewCopyBtn.textContent = prev || "Naar clipboard";
      }, 1400);
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

async function buildVgVrOverview(): Promise<VgVrOverviewFloor[]> {
  const floors: VgVrOverviewFloor[] = [];
  for (const s of sections) {
    if (!isFloormapKind(s.region_kind)) continue;
    const list = await listSectionRoomsForOverview(s.id);
    const assigned: VgVrOverviewRoom[] = [];
    for (const r of list) {
      if (r.vg_nr == null || !normalizeVrNr(r.vr_nr)) continue;
      if (componentIsLengthQuantity(r) || isComposeResultRoom(r)) continue;
      assigned.push({
        vg: Number(r.vg_nr),
        vr: normalizeVrNr(r.vr_nr)!,
        label: (r.label || "").trim() || "—",
      });
    }
    assigned.sort(
      (a, b) => a.vg - b.vg || compareVrForOverview(a.vr, b.vr) || a.label.localeCompare(b.label, "nl"),
    );
    floors.push({
      sectionId: s.id,
      sectionLabel: s.label || "Plattegrond",
      levelHint: dominantLevelHint(list, s.label || ""),
      pageIndex: s.page_index,
      rooms: assigned,
    });
  }
  floors.sort(
    (a, b) =>
      levelSortRank(a.levelHint) - levelSortRank(b.levelHint) ||
      a.pageIndex - b.pageIndex ||
      a.sectionLabel.localeCompare(b.sectionLabel, "nl"),
  );
  return floors;
}

function renderVgVrOverviewBody(floors: VgVrOverviewFloor[]): void {
  if (!vgVrOverviewBodyEl) return;
  vgVrOverviewBodyEl.replaceChildren();
  const withRooms = floors.filter((f) => f.rooms.length > 0);
  const empty = floors.filter((f) => f.rooms.length === 0);
  if (!withRooms.length && !empty.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Geen plattegronden in dit project.";
    vgVrOverviewBodyEl.appendChild(p);
    return;
  }
  if (!withRooms.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "Nog geen VG/VR toegekend op plattegronden.";
    vgVrOverviewBodyEl.appendChild(p);
  }
  for (const floor of withRooms) {
    const block = document.createElement("section");
    block.className = "fm-vgvr-floor";
    const h = document.createElement("h3");
    h.textContent = `${levelLabel(floor.levelHint)} — ${floor.sectionLabel}`;
    block.appendChild(h);
    const meta = document.createElement("p");
    meta.className = "hint";
    meta.textContent = `${floor.rooms.length} ruimte(n) met VG/VR · pagina ${floor.pageIndex + 1}`;
    block.appendChild(meta);
    const table = document.createElement("table");
    table.className = "fm-vgvr-table";
    table.innerHTML = "<thead><tr><th>VG</th><th>VR</th><th>Ruimte</th></tr></thead>";
    const tbody = document.createElement("tbody");
    for (const r of floor.rooms) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${r.vg}</td><td>${r.vr}</td><td></td>`;
      const tdLabel = tr.cells[2];
      tdLabel.textContent = r.label;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    block.appendChild(table);
    vgVrOverviewBodyEl.appendChild(block);
  }
  if (empty.length) {
    const block = document.createElement("section");
    block.className = "fm-vgvr-floor";
    const h = document.createElement("h3");
    h.textContent = "Zonder VG/VR";
    block.appendChild(h);
    const ul = document.createElement("ul");
    ul.className = "hint";
    ul.style.margin = "0";
    ul.style.paddingLeft = "1.1rem";
    for (const floor of empty) {
      const li = document.createElement("li");
      li.textContent = `${levelLabel(floor.levelHint)} — ${floor.sectionLabel}`;
      ul.appendChild(li);
    }
    block.appendChild(ul);
    vgVrOverviewBodyEl.appendChild(block);
  }
}

async function openVgVrOverview(): Promise<void> {
  if (!vgVrOverviewDialog || !auth()?.token) {
    setStatus("Open eerst een project", "err");
    return;
  }
  if (!sections.some((s) => isFloormapKind(s.region_kind))) {
    setStatus("Geen plattegronden in dit project", "err");
    return;
  }
  if (vgVrOverviewBtn) vgVrOverviewBtn.disabled = true;
  setStatus("VG/VR-overzicht laden…", "busy");
  try {
    const floors = await buildVgVrOverview();
    lastVgVrOverviewFloors = floors;
    const title = buildingLabel || buildingExternalRef || buildingId || "Project";
    if (vgVrOverviewTitleEl) vgVrOverviewTitleEl.textContent = `VG/VR — ${title}`;
    if (vgVrOverviewMetaEl) {
      vgVrOverviewMetaEl.textContent = vgVrOverviewSummaryText(floors);
    }
    if (vgVrOverviewCopyBtn) {
      vgVrOverviewCopyBtn.disabled = floors.every((f) => f.rooms.length === 0);
    }
    renderVgVrOverviewBody(floors);
    if (!vgVrOverviewDialog.open) vgVrOverviewDialog.showModal();
    setStatus("VG/VR-overzicht klaar", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    if (vgVrOverviewBtn) vgVrOverviewBtn.disabled = false;
  }
}

function renderSectionList(): void {
  sectionListEl.innerHTML = "";
  sectionListEl.className = "fm-section-picker";
  if (vgVrOverviewBtn) {
    vgVrOverviewBtn.disabled = !sections.some((s) => isFloormapKind(s.region_kind));
  }
  if (sections.length === 0) {
    sectionListEl.innerHTML = `<p class="hint">Geen schaalbare secties (plattegrond / gevel / doorsnede) voor dit project.</p>`;
    return;
  }

  const byKind = new Map<string, FloormapSection[]>();
  for (const s of sections) {
    const kind = String(s.region_kind || "FLOORMAP").toUpperCase();
    const list = byKind.get(kind) || [];
    list.push(s);
    byKind.set(kind, list);
  }
  const kinds = [...byKind.keys()].sort((a, b) => sectionKindOrder(a) - sectionKindOrder(b) || a.localeCompare(b));

  for (const kind of kinds) {
    const group = byKind.get(kind) || [];
    const n = partNoun(kind);
    const row = document.createElement("section");
    row.className = "fm-section-type-row";
    row.setAttribute("aria-label", n.kindLabel);

    const head = document.createElement("h3");
    head.className = "fm-section-type-heading";
    head.textContent = `${n.kindLabel}${group.length > 1 ? ` (${group.length})` : ""}`;
    row.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "fm-section-type-grid";

    for (const s of group) {
      const card = document.createElement("article");
      card.className = "fm-section-card panel";
      const hasComponents = (s.room_count || 0) >= 1;
      const scale =
        s.metres_per_norm_unit != null && s.metres_per_norm_unit > 0
          ? `schaal gezet (${s.scale_source})`
          : "geen schaal";
      const countLabel =
        s.room_count === 1 ? `1 ${n.singular}` : `${s.room_count} ${n.plural}`;

      const title = document.createElement("h4");
      title.textContent = s.label || n.title;
      card.appendChild(title);

      const meta = document.createElement("p");
      meta.className = "hint";
      meta.textContent = `pagina ${s.page_index + 1} · ${countLabel} · ${scale}`;
      card.appendChild(meta);

      const media = document.createElement("div");
      media.className = "fm-section-card-media";
      const thumb = document.createElement("img");
      thumb.className = "section-thumb is-loading";
      thumb.alt = s.label || n.title;
      thumb.width = SECTION_THUMB_W;
      thumb.height = SECTION_THUMB_H;
      media.appendChild(thumb);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = hasComponents
        ? "section-open-btn section-open-btn--filled"
        : "section-open-btn section-open-btn--empty";
      btn.textContent = `${n.title} openen`;
      btn.addEventListener("click", () => {
        void openSection(s.id);
      });
      media.appendChild(btn);
      card.appendChild(media);

      grid.appendChild(card);
      mountSectionThumbnail(s, thumb);
    }

    row.appendChild(grid);
    sectionListEl.appendChild(row);
  }
}

function selectedIsKierdichting(): boolean {
  const mat = selectedCatalogMaterial();
  if (!mat) return false;
  return isLengthQuantityRubriek(mat.rubriek_nr ?? mat.master_category);
}

function pendingIsLengthComponent(): boolean {
  if (pendingRoom?.editingId) {
    const editing = rooms.find((x) => x.id === pendingRoom!.editingId);
    if (editing) return componentIsLengthQuantity(editing);
  }
  if (selectedIsKierdichting()) return true;
  return false;
}

/** Length vs area for save/UI: prefer the component being edited, not the material dropdown. */
function pendingSaveIsLength(): boolean {
  return pendingIsLengthComponent() || (!pendingRoom?.editingId && selectedIsKierdichting());
}

function perimeterMOfRing(points: Pt[]): number | null {
  const mpu = activeScaleMpu();
  if (!mpu || !points || points.length < 2) return null;
  const ring = points.length >= 3 ? closeRing(points) : points;
  return Math.round(scaledPathLength(ring, mpu, activeScaleAspect(), ring.length >= 3) * 100) / 100;
}

function existingSealFor(parentId: string): RoomSubsection | undefined {
  if (!parentId) return undefined;
  return rooms.find((r) => (r.analysis?.seal_for_subsection_id || "") === parentId);
}

function componentHasSeal(r: RoomSubsection): boolean {
  if (componentSealEnabled(r.analysis)) return true;
  return Boolean(existingSealFor(r.id));
}

function sealLengthMForRoom(r: RoomSubsection): number | null {
  const s = readComponentSeal(r.analysis);
  if (s?.enabled && s.length_m != null && Number.isFinite(s.length_m)) return Number(s.length_m);
  const legacy = existingSealFor(r.id);
  if (legacy?.analysis?.length_m != null && Number.isFinite(legacy.analysis.length_m)) {
    return Number(legacy.analysis.length_m);
  }
  return perimeterMOfRing(r.points);
}

function renderKierMaterialOptions(selectedId?: string | null): void {
  fillKierMaterialSelect(kierSuggestMatEl, selectedId);
  // Keep picklist regel-2 select in sync when materials reload.
  const pref = loadRegel2KozijnSealPref();
  fillKierMaterialSelect(regel2KierMatEl, selectedId ?? pref.material_id ?? null);
}

async function ensureKierMaterials(): Promise<void> {
  if (!auth()?.token || kierMaterialsLoaded) {
    renderKierMaterialOptions();
    return;
  }
  try {
    const data = bppPhase1Enabled()
      ? await bppListMaterials(invokeString, auth()!.token, {
          master_category: KIER_RUBRIEK_NAME,
          limit: 1000,
        })
      : await apiGet<{ materials: CatalogMaterial[] }>(
          `/api/floormap/materials?master_category=${encodeURIComponent(KIER_RUBRIEK_NAME)}&limit=1000`,
        );
    kierMaterials = (data.materials || []) as CatalogMaterial[];
    if (!kierMaterials.some((m) => (m.catalog_id || "") === DEFAULT_KIER_CATALOG_ID)) {
      const extra = bppPhase1Enabled()
        ? await bppListMaterials(invokeString, auth()!.token, {
            q: DEFAULT_KIER_CATALOG_ID,
            limit: 20,
          })
        : await apiGet<{ materials: CatalogMaterial[] }>(
            `/api/floormap/materials?q=${encodeURIComponent(DEFAULT_KIER_CATALOG_ID)}&limit=20`,
          );
      for (const m of (extra.materials || []) as CatalogMaterial[]) {
        if ((m.catalog_id || "") === DEFAULT_KIER_CATALOG_ID) {
          kierMaterials = [m, ...kierMaterials];
          break;
        }
      }
    }
    kierMaterialsLoaded = true;
  } catch (err) {
    console.warn("kier materials load failed", err);
    kierMaterials = [];
  }
  renderKierMaterialOptions();
}

function resolveKierSuggestMaterial(preferredId?: string | null): CatalogMaterial | null {
  const id = (preferredId || kierSuggestMatEl?.value || "").trim();
  if (id) return kierMaterials.find((m) => m.material_id === id) || null;
  return (
    kierMaterials.find((m) => (m.catalog_id || "") === DEFAULT_KIER_CATALOG_ID) ||
    kierMaterials[0] ||
    null
  );
}

type Regel2KozijnSealPref = {
  /** Default true — «rond een kozijn altijd kierdichting». */
  enabled: boolean;
  material_id?: string;
};

function regel2KozijnSealPrefKey(): string {
  const bid = (buildingId || "").trim() || "none";
  return `app-gevelwering-regel2-kozijn-seal:${bid}`;
}

function loadRegel2KozijnSealPref(): Regel2KozijnSealPref {
  try {
    const raw = localStorage.getItem(regel2KozijnSealPrefKey());
    if (!raw) return { enabled: true };
    const p = JSON.parse(raw) as { enabled?: boolean; material_id?: string };
    return {
      enabled: p.enabled !== false,
      material_id: typeof p.material_id === "string" ? p.material_id : undefined,
    };
  } catch {
    return { enabled: true };
  }
}

function saveRegel2KozijnSealPref(pref: Regel2KozijnSealPref): void {
  try {
    localStorage.setItem(regel2KozijnSealPrefKey(), JSON.stringify(pref));
  } catch {
    /* ignore quota */
  }
}

function fillKierMaterialSelect(
  selectEl: HTMLSelectElement | null,
  selectedId?: string | null,
): void {
  if (!selectEl) return;
  const keep = selectedId ?? selectEl.value;
  selectEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = kierMaterials.length
    ? `— ${DEFAULT_KIER_CATALOG_ID} (standaard) —`
    : `— ${DEFAULT_KIER_CATALOG_ID} —`;
  selectEl.appendChild(ph);
  const sorted = [...kierMaterials].sort((a, b) => {
    const aDef = (a.catalog_id || "") === DEFAULT_KIER_CATALOG_ID ? 0 : 1;
    const bDef = (b.catalog_id || "") === DEFAULT_KIER_CATALOG_ID ? 0 : 1;
    if (aDef !== bDef) return aDef - bDef;
    return (a.catalog_id || a.name).localeCompare(b.catalog_id || b.name, "nl");
  });
  for (const m of sorted) {
    const opt = document.createElement("option");
    opt.value = m.material_id;
    const code = (m.catalog_id || "").trim();
    const ra = m.ra_dba != null ? ` · RA ${m.ra_dba}` : "";
    opt.textContent = code ? `${code} · ${m.name}${ra}` : `${m.name}${ra}`;
    selectEl.appendChild(opt);
  }
  const def = kierMaterials.find((m) => (m.catalog_id || "") === DEFAULT_KIER_CATALOG_ID);
  if (keep && kierMaterials.some((m) => m.material_id === keep)) {
    selectEl.value = keep;
  } else if (def) {
    selectEl.value = def.material_id;
  } else {
    selectEl.value = "";
  }
}

function renderRegel2KierMaterialOptions(selectedId?: string | null): void {
  fillKierMaterialSelect(regel2KierMatEl, selectedId);
}

async function syncRegel2KierPicklistUi(): Promise<void> {
  if (!regel2KierEl) return;
  regel2KierEl.classList.remove("hidden");
  await ensureKierMaterials();
  const pref = loadRegel2KozijnSealPref();
  if (regel2KierCb) regel2KierCb.checked = pref.enabled;
  renderRegel2KierMaterialOptions(pref.material_id || null);
  if (regel2KierMatEl) regel2KierMatEl.disabled = !pref.enabled;
  if (regel2KierHintEl) {
    const mat = resolveKierSuggestMaterial(pref.material_id || regel2KierMatEl?.value || null);
    const code = mat?.catalog_id || DEFAULT_KIER_CATALOG_ID;
    regel2KierHintEl.innerHTML = pref.enabled
      ? `<strong>Verwerkingsregel 2 aan:</strong> bij stap 3 krijgt elk kozijn omtrek-kierdichting «${code}». Zichtbaar in stap 5 (GA-materiaallijst).`
      : `<strong>Verwerkingsregel 2 uit:</strong> geen automatische kierdichting bij kozijn-toewijzing. Je kunt kier later per vlak zetten.`;
  }
}

function syncAssignRegel2Hint(): void {
  if (!assignRegel2HintEl) return;
  const pref = loadRegel2KozijnSealPref();
  const mid = (assignPicklistEl?.value || "").trim();
  const mat = favoriteMaterials.find((m) => m.material_id === mid) || null;
  const kozijnInPick = Boolean(mat && isKozijnFrameMaterial(mat));
  if (!pref.enabled) {
    assignRegel2HintEl.textContent =
      "Verwerkingsregel 2 staat uit in de picklist — geen automatische kierdichting.";
    return;
  }
  if (kozijnInPick) {
    const sealMat = resolveKierSuggestMaterial(pref.material_id || null);
    const code = sealMat?.catalog_id || DEFAULT_KIER_CATALOG_ID;
    assignRegel2HintEl.textContent = `Verwerkingsregel 2: «${mat!.name}» is kozijnmateriaal → kierdichting ${code} wordt bij Toewijzen op de omtrek gezet.`;
  } else {
    assignRegel2HintEl.textContent =
      "Verwerkingsregel 2: bij kozijnmateriaal uit de picklist wordt kierdichting (omtrek) automatisch gezet.";
  }
}

/** Kozijn-hout of toegewezen kozijnmateriaal (niet glas/ruit). */
function componentIsKozijnForRegel2(
  room: RoomSubsection,
  mat?: CatalogMaterial | null,
): boolean {
  const role = String(room.analysis?.kozijn_role || "").trim().toLowerCase();
  if (role === "glass") return false;
  if (role === "wood") return true;
  if (mat && isKozijnFrameMaterial(mat)) return true;
  return isKozijnFrameMaterial({
    category: room.analysis?.category,
    master_category: room.analysis?.master_category,
    rubriek_nr: room.analysis?.rubriek_nr,
    name: room.analysis?.material_name,
  });
}

/**
 * Verwerkingsregel 2: zet analysis.seal (omtrek) op het kozijn-component.
 * @returns true als seal is gezet/bijgewerkt
 */
async function applyRegel2KozijnSeal(roomId: string, mat?: CatalogMaterial | null): Promise<boolean> {
  if (isFloormapKind() || !roomId) return false;
  const pref = loadRegel2KozijnSealPref();
  if (!pref.enabled) return false;
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return false;
  if (!componentIsKozijnForRegel2(room, mat)) return false;
  if (componentIsLengthQuantity(room) || isLegacySealSibling(room.analysis)) return false;
  if (!Array.isArray(room.points) || room.points.length < 3) return false;
  await ensureKierMaterials();
  const sealMat = resolveKierSuggestMaterial(pref.material_id || regel2KierMatEl?.value || null);
  if (!sealMat) {
    console.warn("regel 2: geen kierdichtingsmateriaal beschikbaar");
    return false;
  }
  await saveComponentSealAttribute(room, true, sealMat);
  return true;
}

function sealMaterialKey(a?: SubsectionAnalysis | null): string {
  if (!a) return "";
  if ((a.material_id || "").trim()) return `id:${a.material_id!.trim()}`;
  if ((a.catalog_id || "").trim()) return `cat:${a.catalog_id!.trim().toUpperCase()}`;
  return "";
}

/** Sum seal lengths (attribute + legacy siblings) for the same kier material. */
function sumSealLengthsForType(materialKey: string): number {
  if (!materialKey) return 0;
  let sum = 0;
  for (const r of rooms) {
    if (isLegacySealSibling(r.analysis)) {
      if (sealMaterialKey(r.analysis) !== materialKey) continue;
      if (r.analysis?.length_m != null && Number.isFinite(r.analysis.length_m)) {
        sum += Number(r.analysis.length_m);
      }
      continue;
    }
    const seal = readComponentSeal(r.analysis);
    if (!seal?.enabled) continue;
    if (sealMaterialKeyFromSeal(seal) !== materialKey) continue;
    const live = pendingRoom?.editingId === r.id ? pendingRoom : null;
    const pts = live ? live.points : r.points;
    const mpu =
      r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0
        ? r.metres_per_norm_unit
        : activeScaleMpu();
    if (pts?.length >= 3 && mpu) {
      sum += scaledPathLength(pts, mpu, activeScaleAspect(), true);
    } else if (seal.length_m != null && Number.isFinite(seal.length_m)) {
      sum += Number(seal.length_m);
    }
  }
  return Math.round(sum * 100) / 100;
}

function syncKierSuggestUi(): void {
  if (!kierSuggestEl) return;
  const editing = pendingRoom?.editingId
    ? rooms.find((r) => r.id === pendingRoom!.editingId)
    : undefined;
  const closedArea =
    Boolean(pendingRoom?.closed && pendingRoom.points.length >= 3) &&
    !selectedIsKierdichting() &&
    !(editing && componentIsLengthQuantity(editing)) &&
    !(editing && isLegacySealSibling(editing.analysis));
  const show = !isFloormapKind() && closedArea;
  kierSuggestEl.classList.toggle("hidden", !show);
  if (!show) return;
  void ensureKierMaterials();
  const peri = pendingRoom ? perimeterMOfRing(pendingRoom.points) : null;
  const hasSeal = editing ? componentHasSeal(editing) : false;
  const sealAttr = editing ? readComponentSeal(editing.analysis) : null;
  const setSelected = Boolean(editing && selectedSetIds.has(editing.id));
  // Saved component open for edit, OR a new closed polygon (intent applied on Opslaan).
  const canToggle = Boolean(
    (editing && (setSelected || pendingRoom?.editingId === editing.id)) ||
      (!editing && pendingRoom?.closed && (pendingRoom.points.length || 0) >= 3),
  );
  const pendingIntent =
    Boolean(kierSuggestCb?.dataset.userTouched === "1" && !editing && kierSuggestCb?.checked);
  if (kierSuggestCb && !kierToggleInFlight) {
    if (!pendingIntent) {
      kierSuggestCb.checked = hasSeal;
      delete kierSuggestCb.dataset.userTouched;
    }
    kierSuggestCb.disabled = !canToggle && !hasSeal && !pendingIntent;
    kierSuggestCb.title = canToggle
      ? editing
        ? "Kierdichting (omtrek) voor dit component — meestal op een samengesteld ±-resultaat"
        : "Kierdichting (omtrek) — wordt bij Opslaan op dit nieuwe vlak gezet"
      : hasSeal
        ? "Uitvinken zet kierdichting uit"
        : "Open of selecteer het component om kierdichting aan/uit te zetten";
    const mid = sealAttr?.material_id || existingSealFor(editing?.id || "")?.analysis?.material_id;
    if (mid) renderKierMaterialOptions(mid);
  }
  if (kierSuggestHintEl) {
    const periBit =
      peri != null ? ` Omtrek ≈ ${peri.toFixed(2)} m.` : " Zet eerst de schaal voor een omtrek in meters.";
    const mat = resolveKierSuggestMaterial(sealAttr?.material_id);
    const key = mat
      ? sealMaterialKey({
          material_id: mat.material_id,
          catalog_id: mat.catalog_id,
        } as SubsectionAnalysis)
      : sealMaterialKeyFromSeal(sealAttr);
    const typeSum = key ? sumSealLengthsForType(key) : 0;
    const typeBit =
      typeSum > 0
        ? ` Totaal ${(mat?.catalog_id || DEFAULT_KIER_CATALOG_ID)} ≈ ${typeSum.toFixed(2)} m.`
        : "";
    const composeHint = editing && !isComposeResultRoom(editing)
      ? " Meestal op een samengesteld (±) component."
      : "";
    if (hasSeal) {
      kierSuggestHintEl.textContent =
        `Kierdichting aan — vink uit om uit te zetten. Opslaan werkt de omtreklengte bij.${periBit}${typeBit}${composeHint}`;
    } else if (pendingIntent) {
      kierSuggestHintEl.textContent =
        `Kierdichting aangevinkt — wordt bij Opslaan toegevoegd.${periBit}${typeBit}`;
    } else if (!canToggle) {
      kierSuggestHintEl.textContent =
        `Open of selecteer het component om kierdichting (omtrek) aan te zetten.${periBit}${composeHint}`;
    } else if (!editing) {
      kierSuggestHintEl.textContent =
        `Optioneel. Vink aan vóór Opslaan om omtrek als kierdichting te koppelen (standaard ${DEFAULT_KIER_CATALOG_ID}).${periBit}${typeBit}`;
    } else {
      kierSuggestHintEl.textContent =
        `Optioneel kenmerk. Standaard ${DEFAULT_KIER_CATALOG_ID}. Lengtes van hetzelfde type worden opgeteld.${periBit}${typeBit}${composeHint}`;
    }
  }
}

/** Persist seal kenmerk on the component (no sibling subsection). */
async function saveComponentSealAttribute(
  room: RoomSubsection,
  want: boolean,
  material?: CatalogMaterial | null,
): Promise<{ length_m: number | null; created: boolean; material: CatalogMaterial | null }> {
  if (!activeSection || !auth()) {
    throw new Error("Geen actieve sectie");
  }
  const lengthM = perimeterMOfRing(room.points);
  let mat: CatalogMaterial | null = null;
  let seal: ComponentSeal;
  if (want) {
    await ensureKierMaterials();
    mat = material || resolveKierSuggestMaterial();
    if (!mat) {
      throw new Error(`Kierdichtingsmateriaal ${DEFAULT_KIER_CATALOG_ID} niet gevonden in de catalogus`);
    }
    seal = buildSealPayload(mat, lengthM, true);
  } else {
    seal = clearSealPayload();
  }
  const wasOn = componentHasSeal(room);
  const analysis = mergeAnalysisWithSeal(room.analysis, want ? seal : null);
  // Keep geometry/material/boolean fields; saveDrawingSubsection merges analysis.
  const saved = await saveDrawingSubsection({
    section_id: activeSection.id,
    subsection_id: room.id,
    label: room.label,
    level_hint: room.level_hint || "OTHER",
    vg_nr: room.vg_nr,
    vr_nr: room.vr_nr,
    points: room.points,
    holes: Array.isArray(room.analysis?.holes) ? room.analysis!.holes : [],
    metres_per_norm_unit: room.metres_per_norm_unit ?? activeScaleMpu() ?? undefined,
    scale_aspect_yx: activeScaleAspect(),
    analysis,
  });
  markRoomTouched(room.id);
  const idx = rooms.findIndex((r) => r.id === room.id);
  if (idx >= 0) {
    const nextAnalysis: SubsectionAnalysis = {
      ...(rooms[idx].analysis || {}),
      ...(saved.analysis || {}),
      ...(analysis as SubsectionAnalysis),
    };
    if (!want) delete nextAnalysis.seal;
    rooms[idx] = {
      ...rooms[idx],
      analysis: nextAnalysis,
    };
    noteLocalRoomPatch(rooms[idx]);
  }
  // Cleanup legacy sibling if present.
  const legacy = existingSealFor(room.id);
  if (legacy) {
    try {
      await deleteDrawingSubsection(legacy.id);
      noteLocalRoomDeletion(legacy.id);
      rooms = rooms.filter((r) => r.id !== legacy.id);
      selectedSetIds.delete(legacy.id);
      constituentSigns.delete(legacy.id);
    } catch (err) {
      console.warn("legacy seal cleanup failed", err);
    }
  }
  return {
    length_m: want ? lengthM : null,
    created: want && !wasOn,
    material: mat,
  };
}

async function removeSealForParent(parentId: string): Promise<boolean> {
  const room = rooms.find((r) => r.id === parentId);
  if (!room) {
    const seal = existingSealFor(parentId);
    if (!seal) return false;
    await deleteDrawingSubsection(seal.id);
    if (pendingRoom?.editingId === seal.id) clearPendingRoom();
    if (touchedRoomIds.delete(seal.id)) persistTouchedRoomIds();
    selectedSetIds.delete(seal.id);
    constituentSigns.delete(seal.id);
    noteLocalRoomDeletion(seal.id);
    rooms = rooms.filter((r) => r.id !== seal.id);
    return true;
  }
  if (!componentHasSeal(room) && !existingSealFor(parentId)) return false;
  await saveComponentSealAttribute(room, false);
  return true;
}

async function toggleKierSealForRoom(room: RoomSubsection, want: boolean): Promise<void> {
  if (isFloormapKind() || componentIsLengthQuantity(room) || isLegacySealSibling(room.analysis)) {
    return;
  }
  if (!Array.isArray(room.points) || room.points.length < 3) {
    setStatus("Gesloten vlak nodig voor kierdichting (omtrek)", "err");
    if (kierSuggestCb) kierSuggestCb.checked = componentHasSeal(room);
    return;
  }
  const canToggle =
    selectedSetIds.has(room.id) || pendingRoom?.editingId === room.id;
  if (want && !canToggle) {
    setStatus("Open of selecteer het component om kierdichting toe te voegen", "err");
    if (kierSuggestCb && pendingRoom?.editingId === room.id) {
      kierSuggestCb.checked = componentHasSeal(room);
    }
    renderRoomList();
    return;
  }
  kierToggleInFlight = true;
  try {
    setStatus(want ? "Kierdichting zetten…" : "Kierdichting uitzetten…", "busy");
    const result = await saveComponentSealAttribute(room, want);
    renderRoomList();
    drawOverlay();
    requestAnimationFrame(() => drawOverlay());
    if (kierSuggestCb && pendingRoom?.editingId === room.id) {
      kierSuggestCb.checked = want;
      delete kierSuggestCb.dataset.userTouched;
    }
    if (!want) {
      setStatus("Kierdichting uit", "ok");
      return;
    }
    const mat = result.material;
    const code = mat?.catalog_id || DEFAULT_KIER_CATALOG_ID;
    const key = mat
      ? sealMaterialKey({
          material_id: mat.material_id,
          catalog_id: mat.catalog_id,
        } as SubsectionAnalysis)
      : "";
    const typeSum = key ? sumSealLengthsForType(key) : 0;
    const lenTxt = result.length_m != null ? ` · ${result.length_m.toFixed(2)} m` : "";
    const sumTxt = typeSum > 0 ? ` · totaal ${code} ${typeSum.toFixed(2)} m` : "";
    setStatus(
      result.created
        ? `Kierdichting (${code}) aan op «${room.label || "vlak"}»${lenTxt}${sumTxt}`
        : `Kierdichting (${code}) bijgewerkt${lenTxt}${sumTxt}`,
      "ok",
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    if (kierSuggestCb && pendingRoom?.editingId === room.id) {
      kierSuggestCb.checked = componentHasSeal(room);
      delete kierSuggestCb.dataset.userTouched;
    }
    renderRoomList();
    drawOverlay();
  } finally {
    kierToggleInFlight = false;
    if (pendingRoom?.editingId === room.id) syncKierSuggestUi();
  }
}

function componentIsLengthQuantity(r: RoomSubsection): boolean {
  const a = r.analysis;
  if (a?.quantity_kind === "length") return true;
  if (a?.length_m != null && Number.isFinite(a.length_m)) return true;
  return isLengthQuantityRubriek(a?.rubriek_nr ?? a?.master_category);
}


const REPEAT_COUNT_MAX = 99;

function readRepeatCount(analysis?: SubsectionAnalysis | null): number {
  const n = Number(analysis?.repeat_count);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(REPEAT_COUNT_MAX, Math.round(n)));
}

function repeatCountBit(analysis?: SubsectionAnalysis | null): string {
  const n = readRepeatCount(analysis);
  return n > 1 ? `×${n}` : "";
}

async function saveRepeatCountForRoom(room: RoomSubsection, next: number): Promise<void> {
  if (!activeSection || !auth()?.token) return;
  const n = Math.max(1, Math.min(REPEAT_COUNT_MAX, Math.round(next)));
  const prev = room.analysis || {};
  const analysis: SubsectionAnalysis = { ...prev, repeat_count: n };
  if (n <= 1) delete analysis.repeat_count;
  setStatus(n > 1 ? `Herhaling ×${n}…` : "Herhaling 1×…", "busy");
  try {
    const saved = await saveDrawingSubsection({
      section_id: activeSection.id,
      subsection_id: room.id,
      label: room.label,
      level_hint: room.level_hint || "OTHER",
      vg_nr: room.vg_nr,
      vr_nr: room.vr_nr,
      points: room.points,
      holes: Array.isArray(room.analysis?.holes) ? room.analysis!.holes : [],
      metres_per_norm_unit: room.metres_per_norm_unit ?? activeScaleMpu() ?? undefined,
      scale_aspect_yx: activeScaleAspect(),
      analysis,
    });
    const idx = rooms.findIndex((r) => r.id === room.id);
    if (idx >= 0) {
      const nextA: SubsectionAnalysis = {
        ...(rooms[idx].analysis || {}),
        ...(saved.analysis || {}),
        ...analysis,
      };
      if (n <= 1) delete nextA.repeat_count;
      rooms[idx] = { ...rooms[idx], analysis: nextA };
      noteLocalRoomPatch(rooms[idx]);
    }
    markRoomTouched(room.id);
    renderRoomList();
    drawOverlay();
    setStatus(
      n > 1
        ? `«${room.label || "component"}» telt ×${n} mee in GA`
        : `«${room.label || "component"}» telt 1× mee in GA`,
      "ok",
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    renderRoomList();
  }
}

function gevelCoverageRowsFromRooms(list: RoomSubsection[]): GevelCoverageRow[] {
  return list.map((r) => ({
    id: r.id,
    area_m2: r.area_m2,
    kozijn_role: r.analysis?.kozijn_role,
    boolean_op: r.analysis?.boolean_op,
    material_id: r.analysis?.material_id,
    orientatie: r.analysis?.orientatie,
    gevelgroep_nr: readGevelgroepNr(r.analysis),
    quantity_kind: r.analysis?.quantity_kind,
  }));
}

function gevelGroepOverStotaalForRoom(r: RoomSubsection): boolean {
  if (isFloormapKind()) return false;
  const ori = normalizeOrientatieCode(r.analysis?.orientatie || "");
  if (!(ORIENTATIE_CODES as readonly string[]).includes(ori)) return false;
  const gg = readGevelgroepNr(r.analysis);
  const vr = normalizeVrNr(r.vr_nr);
  if (!vr) return false;
  const peers = rooms.filter(
    (p) =>
      normalizeVrNr(p.vr_nr) === vr &&
      Boolean((p.analysis?.material_id || "").trim()) &&
      String(p.analysis?.quantity_kind || "area") !== "length",
  );
  return gevelMaterialExceedsContour(gevelCoverageRowsFromRooms(peers), ori, gg);
}

function readGevelgroepNr(analysis?: SubsectionAnalysis | null): number {
  const n = Number(analysis?.gevelgroep_nr);
  return n === 2 || n === 3 ? n : 1;
}

async function saveGevelgroepNrForRoom(room: RoomSubsection, next: number): Promise<void> {
  if (!activeSection || !auth()?.token) return;
  const n = next === 2 || next === 3 ? next : 1;
  const prev = room.analysis || {};
  const analysis: SubsectionAnalysis = { ...prev };
  if (n > 1) analysis.gevelgroep_nr = n;
  else delete analysis.gevelgroep_nr;
  setStatus(n > 1 ? `Gevelgroep ${n}…` : "Gevelgroep 1…", "busy");
  try {
    const saved = await saveDrawingSubsection({
      section_id: activeSection.id,
      subsection_id: room.id,
      label: room.label,
      level_hint: room.level_hint || "OTHER",
      vg_nr: room.vg_nr,
      vr_nr: room.vr_nr,
      points: room.points,
      holes: Array.isArray(room.analysis?.holes) ? room.analysis!.holes : [],
      metres_per_norm_unit: room.metres_per_norm_unit ?? activeScaleMpu() ?? undefined,
      scale_aspect_yx: activeScaleAspect(),
      analysis,
    });
    const idx = rooms.findIndex((r) => r.id === room.id);
    if (idx >= 0) {
      const nextA: SubsectionAnalysis = {
        ...(rooms[idx].analysis || {}),
        ...(saved.analysis || {}),
        ...analysis,
      };
      if (n <= 1) delete nextA.gevelgroep_nr;
      rooms[idx] = { ...rooms[idx], analysis: nextA };
      noteLocalRoomPatch(rooms[idx]);
    }
    markRoomTouched(room.id);
    renderRoomList();
    drawOverlay();
    setStatus(
      n > 1
        ? `«${room.label || "component"}» → gevelgroep ${n} (eigen CL in GA)`
        : `«${room.label || "component"}» → gevelgroep 1`,
      "ok",
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    renderRoomList();
  }
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

  try {
    if (componentIsLengthQuantity(r) || (live && !closed && selectedIsKierdichting())) {
      let len: string | null = null;
      if (pts?.length >= 2 && mpu) {
        len = `${scaledPathLength(pts, mpu, aspect, closed).toFixed(2)} m`;
      } else if (r.analysis?.length_m != null && Number.isFinite(r.analysis.length_m) && !live) {
        len = `${Number(r.analysis.length_m).toFixed(2)} m`;
      } else if (r.perimeter_m != null && Number.isFinite(r.perimeter_m) && !live) {
        len = `${r.perimeter_m.toFixed(2)} m`;
      }
      const key = sealMaterialKey(r.analysis);
      const typeSum = key ? sumSealLengthsForType(key) : 0;
      const code = (r.analysis?.catalog_id || "").trim() || DEFAULT_KIER_CATALOG_ID;
      const sumBit =
        typeSum > 0 && (!len || Math.abs(typeSum - Number.parseFloat(len)) > 0.005)
          ? ` · Σ ${code} ${typeSum.toFixed(2)} m`
          : "";
      const nLen = readRepeatCount(r.analysis);
      const repLen = nLen > 1 ? ` · ×${nLen}` : "";
      return len ? `lengte ${len}${repLen}${sumBit}` : "lengte —";
    }

    let area = "—";
    let circ = "—";
    let netBit = "";
    // Kozijnhout: altijd L×balkbreedte — niet de gevulde openingscontour (polygon).
    if (r.analysis?.kozijn_role === "wood" && r.analysis.kozijn_frame && mpu) {
      const parsed = parseKozijnFrame(r.analysis.kozijn_frame);
      if (parsed?.segments.length) {
        const beam = kozijnWoodBeamMetrics(parsed.segments, mpu, aspect);
        if (beam.areaM2 != null) {
          area = `${beam.areaM2.toFixed(2)} m²`;
          circ = `${beam.lengthM.toFixed(2)} m`;
        }
      }
    }
    // ±-resultaat: opgeslagen netto (outer − holes). Geen tweede openingsaftrek.
    if (area === "—" && isComposeResultRoom(r) && r.area_m2 != null && Number.isFinite(r.area_m2)) {
      area = `${Number(r.area_m2).toFixed(2)} m² netto`;
      if (r.perimeter_m != null && Number.isFinite(r.perimeter_m)) {
        circ = `${r.perimeter_m.toFixed(2)} m`;
      } else if (pts?.length >= 3 && mpu) {
        circ = `${scaledPathLength(pts, mpu, aspect, true).toFixed(2)} m`;
      }
    }
    if (area === "—" && pts?.length >= 3 && mpu && r.analysis?.kozijn_role !== "wood") {
      const safeHoles = holes.filter((h) => Array.isArray(h) && h.length >= 3);
      const holesSum = safeHoles.reduce((s, h) => s + shoelaceArea(h), 0);
      let areaNorm = Math.max(0, shoelaceArea(pts) - holesSum);
      // Alleen op bruto muur zonder ±: opening aftrekken. Bronnen van ± en ± zelf niet
      // (anders 5,59 → 2,20 en lijkt GA “bruto” te gebruiken).
      const isComposeSource = rooms.some(
        (c) =>
          isComposeResultRoom(c) &&
          Array.isArray(c.analysis?.source_subsection_ids) &&
          c.analysis!.source_subsection_ids!.includes(r.id),
      );
      const openingDeduct =
        !isComposeResultRoom(r) && !isComposeSource && !r.analysis?.kozijn_role
          ? kozijnOpeningNormInsideRoom(r, pts)
          : 0;
      if (openingDeduct > 0) {
        areaNorm = Math.max(0, areaNorm - openingDeduct);
        netBit = " netto";
      }
      area = `${scaledAreaM2(areaNorm, mpu, aspect).toFixed(2)} m²${netBit}`;
      circ = `${scaledPathLength(pts, mpu, aspect, true).toFixed(2)} m`;
    } else if (area === "—" && r.area_m2 != null && Number.isFinite(r.area_m2)) {
      area = `${r.area_m2.toFixed(2)} m²`;
      if (r.perimeter_m != null && Number.isFinite(r.perimeter_m)) {
        circ = `${r.perimeter_m.toFixed(2)} m`;
      }
    } else if (area === "—" && r.area_norm != null && mpu) {
      area = `${scaledAreaM2(r.area_norm, mpu, aspect).toFixed(2)} m²`;
    } else if (area === "—" && r.area_norm != null) {
      area = `${r.area_norm.toFixed(4)} (geen schaal)`;
    }

    const n = readRepeatCount(r.analysis);
    const rep = n > 1 ? ` · ×${n}` : "";
    return `${area}${rep} · omtrek ${circ}`;
  } catch {
    return "—";
  }
}

let roomListRefreshTimer: ReturnType<typeof setTimeout> | null = null;
/** When true, renderRoomList keeps list scroll and skips scroll-into-view (drag refresh). */
let roomListRefreshQuiet = false;
/** Refresh “Opgeslagen ruimten” while dragging an edited outline. */
function scheduleRoomListRefresh(): void {
  if (!pendingRoom?.editingId) return;
  if (roomListRefreshTimer) clearTimeout(roomListRefreshTimer);
  roomListRefreshTimer = setTimeout(() => {
    roomListRefreshTimer = null;
    roomListRefreshQuiet = true;
    try {
      syncPendingGeometryToRooms();
      renderRoomList();
    } finally {
      roomListRefreshQuiet = false;
    }
  }, 40);
}

function syncPendingRoomButtons(): void {
  const n = activePartNoun();
  const has = Boolean(pendingRoom && pendingRoom.points.length > 0);
  const closed = Boolean(pendingRoom?.closed);
  const kier = !isFloormapKind() && pendingSaveIsLength();
  const editingId = pendingRoom?.editingId || null;
  roomCloseBtn.disabled = !(pendingRoom?.drawing && pendingRoom.points.length >= 3 && !closed);
  const canSaveClosed = Boolean(closed && pendingRoom && pendingRoom.points.length >= 3);
  const canSaveOpenKier = Boolean(
    kier && pendingRoom && !closed && pendingRoom.points.length >= 2,
  );
  roomSaveBtn.disabled = !(canSaveClosed || canSaveOpenKier);
  if (roomDuplicateBtn) {
    // Only closed area components (e.g. glaspartijen); open kier paths skip.
    roomDuplicateBtn.disabled = !(canSaveClosed && !kier);
  }
  roomClearBtn.disabled = !has && !pendingRoom?.drawing;
  if (roomDeleteBtn) {
    const deleteIds = deleteTargetIds();
    const confirming = pendingDeleteId != null && pendingDeleteId === deleteConfirmKey(deleteIds);
    roomDeleteBtn.disabled = deleteIds.length === 0;
    if (confirming) {
      roomDeleteBtn.textContent = "Bevestig wissen";
      roomDeleteBtn.title =
        deleteIds.length > 1
          ? `Nogmaals klikken wist ${deleteIds.length} aangevinkte componenten permanent`
          : "Nogmaals klikken wist dit component permanent";
      roomDeleteBtn.classList.remove("secondary");
    } else {
      roomDeleteBtn.textContent = "Verwijderen";
      roomDeleteBtn.title =
        deleteIds.length > 1
          ? `Verwijder ${deleteIds.length} aangevinkte componenten (twee keer klikken)`
          : (() => {
              const editingRoom = editingId ? rooms.find((r) => r.id === editingId) : null;
              return editingRoom && isComposeResultRoom(editingRoom)
                ? "Verwijdert alleen dit samengestelde resultaat; broncomponenten blijven bestaan"
                : `Opgeslagen ${n.singular} permanent verwijderen`;
            })();
      roomDeleteBtn.classList.add("secondary");
    }
  }
  if (roomSimplifyBtn) {
    roomSimplifyBtn.disabled = !(closed && pendingRoom && ringVertexCount(pendingRoom.points) > 3);
  }
  if (!pendingRoom) {
    roomPendingHintEl.textContent = kier
      ? `Kierdichting: teken een pad (≥2 punten) of gesloten omtrek; lengte in meters wordt opgeslagen.`
      : `Gebruik Teken ${n.singular} (Gereedschap of hier), klik hoekpunten. Dubbelklik een rand om een anker toe te voegen; dubbelklik een anker om te verwijderen; Vereenvoudig dunt de omtrek.`;
    roomDrawBtn.textContent = `Teken ${n.singular}`;
    roomSaveBtn.textContent = "Opslaan";
    return;
  }
  if (pendingRoom.drawing && !pendingRoom.closed) {
    roomPendingHintEl.textContent = kier
      ? `${pendingRoom.points.length} punt(en). Opslaan mag vanaf 2 punten (lengte), of sluit polygoon voor omtrek.`
      : `${pendingRoom.points.length} hoekpunt(en). Omtrek/oppervlakte hierboven; sluit polygoon als klaar (≥3).`;
    roomDrawBtn.textContent = "Annuleren";
  } else if (pendingRoom.closed) {
    roomPendingHintEl.textContent = pendingRoom.editingId
      ? "Bewerken: sleep vlak/ankers; dubbelklik op een rand voor extra anker; dubbelklik anker om te wissen; daarna Opslaan."
      : kier
        ? "Polygoon klaar — omtrek (m) wordt als lengte opgeslagen voor kierdichting."
        : "Polygoon klaar — sleep vlak/ankers; dubbelklik op een rand voor extra anker; daarna Opslaan.";
    roomDrawBtn.textContent = `Teken ${n.singular}`;
  }
  roomSaveBtn.textContent = editingId ? "Wijzigingen opslaan" : "Opslaan";
  if (markRoomLegendEl) {
    const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
    markRoomLegendEl.textContent = cap;
  }
  syncEditDock();
  syncKierSuggestUi();
}

function syncEditDock(): void {
  if (!editDockEl) return;
  const show = Boolean(pendingRoom?.closed && !discovery);
  editDockEl.classList.toggle("hidden", !show);
}

function clearPendingRoom(): void {
  pendingRoom = null;
  if (kierSuggestCb) {
    kierSuggestCb.checked = false;
    delete kierSuggestCb.dataset.userTouched;
  }
  syncPendingRoomButtons();
  syncEditDock();
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
  const defaultLabel = `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  pendingRoom = {
    points: [],
    holes: [],
    closed: false,
    editingId: null,
    dragVertex: null,
    dragBodyLast: null,
    drawing: true,
    drawCursor: null,
    label: defaultLabel,
  };
  roomLabelInput.value = defaultLabel;
  fillVgVrSuggestions();
  clearExpectedOrientaties();
  if (!isFloormapKind()) setComponentOrientatie(lastComponentOrientatie);
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  setStatus("Klik hoeken van de ruimte op de tekening", "busy");
  overlayCanvas.style.cursor = "crosshair";
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
  pendingRoom.drawCursor = null;
  syncPendingRoomButtons();
  syncEditDock();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  scheduleRoomListRefresh();
  setStatus(`Polygoon gesloten — sleep vlak/ankers of gebruik pijltjes; sla op als klaar`, "ok");
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
  const parts = selected.map((room) => ({
    room,
    sign: (constituentSigns.get(room.id) || (room.id === outer.id ? "+" : "-")) as ComposeSign,
  }));
  if (!parts.some((p) => p.sign === "+")) {
    throw new Error("Minstens één deel met + is verplicht");
  }

  const plusParts = parts.filter((p) => p.sign === "+");
  const minusParts = parts.filter((p) => p.sign === "-");
  /* Multiple + parts may be adjacent (union of wall segments). Only − parts
   * must lie fully inside some + contour — not every non-outer inside the largest. */
  const plusArea = plusParts.reduce((s, p) => s + subsectionAreaNorm(p.room), 0);
  for (const m of minusParts) {
    const mArea = subsectionAreaNorm(m.room);
    const mLabel = m.room.label || m.room.id;
    if (mArea >= plusArea - 1e-12) {
      const plusLabels = plusParts.map((p) => `“${p.room.label || p.room.id}”`).join(", ");
      throw new Error(
        `Kan “${mLabel}” niet aftrekken van kleinere + deel(en) (${plusLabels}). Trek alleen kleinere objecten af die volledig binnen de + contour(en) liggen.`,
      );
    }
    const fitsInPlus = plusParts.some((p) => ringFullyContained(m.room.points, p.room.points));
    if (!fitsInPlus) {
      throw new Error(
        `“${mLabel}” past niet volledig binnen de + deel(en) — grotere of buitenliggende objecten kunnen niet worden afgetrokken.`,
      );
    }
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

function isComposeResultRoom(r: RoomSubsection): boolean {
  const op = parseBooleanOp(r.analysis?.boolean_op);
  return op === "compose" || op === "difference";
}

type ComposeSourceRef = {
  id: string;
  label: string;
  sign: string;
  missing: boolean;
};

/** Bronnen van een ±-resultaat — verwijzingen naar top-level rijen (niet nesten). */
function collectComposeSourceRefs(
  compose: RoomSubsection,
  allItems: RoomSubsection[],
): ComposeSourceRef[] {
  const src = compose.analysis?.source_subsection_ids;
  if (!Array.isArray(src) || src.length < 2) return [];
  const byId = new Map(allItems.map((x) => [x.id, x]));
  const signs = compose.analysis?.constituent_signs || {};
  const storedLabels = Array.isArray(compose.analysis?.source_labels)
    ? compose.analysis!.source_labels!
    : [];
  const out: ComposeSourceRef[] = [];
  const seen = new Set<string>();
  src.forEach((sid, i) => {
    if (!sid || seen.has(sid)) return;
    seen.add(sid);
    const room = byId.get(sid);
    const rawSign = signs[sid];
    const sign = rawSign === "+" || rawSign === "-" ? rawSign : "?";
    let label = (room?.label || "").trim();
    if (!label && storedLabels[i]) {
      label = String(storedLabels[i]).replace(/^[±+\-]\s*/, "").trim();
    }
    if (!label) label = sid.slice(0, 8);
    out.push({ id: sid, label, sign, missing: !room });
  });
  return out;
}

function composeParentsOfSource(
  sourceId: string,
  allItems: RoomSubsection[],
): RoomSubsection[] {
  return allItems.filter(
    (r) =>
      isComposeResultRoom(r) &&
      Array.isArray(r.analysis?.source_subsection_ids) &&
      r.analysis!.source_subsection_ids!.includes(sourceId),
  );
}

/** Scroll naar een top-level bronrij en markeer kort (geen nest-duplicaat). */
function focusComposeSourceInList(sourceId: string): void {
  const listEl = resolveRoomListEl();
  if (!listEl) return;
  const room = rooms.find((r) => r.id === sourceId);
  const li = listEl.querySelector(
    `.drawing-list-item[data-room-id="${CSS.escape(sourceId)}"]`,
  ) as HTMLElement | null;
  if (!li) {
    if (room && !roomMatchesListFilters(room)) {
      const bits: string[] = [];
      if (roomListVrFilter && !roomMatchesVrFilter(room, roomListVrFilter)) {
        bits.push(`VR ${normalizeVrNr(room.vr_nr) || "—"}`);
      }
      if (roomListGroepFilter && !roomMatchesGroepFilter(room, roomListGroepFilter)) {
        bits.push(`groep ${readGevelgroepNr(room.analysis)}`);
      }
      setStatus(
        `Bron «${room.label || sourceId}» hoort bij ${bits.join(" · ") || "andere filter"} — zet VR/groep-filter daarop of kies Alle`,
        "err",
      );
      return;
    }
    setStatus("Broncomponent niet gevonden in de lijst", "err");
    return;
  }
  scrollActiveRoomListItemIntoView(listEl, sourceId);
  listEl
    .querySelectorAll(".drawing-list-item--compose-flash")
    .forEach((el) => el.classList.remove("drawing-list-item--compose-flash"));
  li.classList.add("drawing-list-item--compose-flash");
  if (composeFlashTimer != null) window.clearTimeout(composeFlashTimer);
  composeFlashTimer = window.setTimeout(() => {
    li.classList.remove("drawing-list-item--compose-flash");
    composeFlashTimer = null;
  }, 1800);
  setStatus(`Bron: «${room?.label || sourceId}»`, "ok");
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
  if (!activeSection || !auth()?.token || !rootId) return 0;
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
          const plusRings = signed.filter((s) => s.sign === "+").map((s) => s.ring);
          for (let i = 0; i < signed.length; i++) {
            if (signed[i].sign !== "-") continue;
            const fits = plusRings.some((pr) => ringFullyContained(signed[i].ring, pr));
            if (!fits) {
              const lab = srcRooms[i]?.label || "deel";
              throw new Error(`“${lab}” past niet meer binnen de + deel(en) van de compositie`);
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
        await saveDrawingSubsection({
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
        noteLocalRoomPatch(dep);
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
  if (!pendingRoom || !activeSection || !auth()) {
    setStatus("Niets om op te slaan — open eerst een component om te bewerken", "err");
    return;
  }
  const kier = !isFloormapKind() && pendingSaveIsLength();
  const openPath = Boolean(kier && !pendingRoom.closed && pendingRoom.points.length >= 2);
  if (!openPath && !pendingRoom.closed) {
    setStatus("Sluit eerst de polygoon (≥3 punten) voordat je opslaat", "err");
    return;
  }
  // Snapshot geometry now — async work must not read a cleared/replaced pendingRoom.
  const pointsSnap = openPath
    ? clampPath(pendingRoom.points.map((p) => ({ ...p })))
    : closeRing(pendingRoom.points.map((p) => ({ ...p })));
  const holesSnap = openPath
    ? []
    : (pendingRoom.holes || []).map((h) => h.map((p) => ({ ...p })));
  const editingId = pendingRoom.editingId;
  const points = pointsSnap;
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
    (pendingRoom.label || roomLabelInput.value).trim() ||
    `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  // Keep dock + pending in sync so a late input-reset cannot wipe the name mid-save.
  roomLabelInput.value = label;
  pendingRoom.label = label;
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
  if (isFloormapKind()) {
    const oris = readExpectedOrientaties();
    if (!oris.length) {
      setStatus(
        "Vink minstens één geveloriëntatie aan (N…NW) — verplicht voor deze VR voordat je opslaat",
        "err",
      );
      expectedOriBlockEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
  } else if (!readComponentOrientatie()) {
    setStatus("Kies een geveloriëntatie (N…NW) voor dit component", "err");
    componentOriBlockEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }
  const mat = !isFloormapKind() ? selectedCatalogMaterial() : null;
  if (kier && !mat) {
    setStatus("Kies een kierdichtingsmateriaal (rubriek 9)", "err");
    return;
  }
  // New or existing closed area: dock checkbox (same as list «Kier» on saved rows).
  const wantSeal =
    !isFloormapKind() &&
    !kier &&
    Boolean(pendingRoom.closed) &&
    Boolean(kierSuggestCb?.checked);
  if (wantSeal) {
    await ensureKierMaterials();
    if (!resolveKierSuggestMaterial()) {
      setStatus(
        `Kierdichting aangevinkt, maar ${DEFAULT_KIER_CATALOG_ID} (of een ander kierprofiel) is niet beschikbaar`,
        "err",
      );
      return;
    }
  }
  roomSaveBtn.disabled = true;
  setStatus(editingId ? "Geometrie bijwerken…" : "Opslaan…", "busy");
  try {
    const body: Record<string, unknown> = {
      section_id: activeSection.id,
      subsection_id: editingId || undefined,
      label,
      level_hint: level,
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points,
      holes: holesSnap,
      metres_per_norm_unit: mpu ?? undefined,
      open_path: openPath || undefined,
      scale_aspect_yx: activeScaleAspect(),
    };
    const prevAnalysis = editingId ? rooms.find((r) => r.id === editingId)?.analysis : null;
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
      body.analysis = isFloormapKind()
        ? analysis
        : gevelAnalysisForSave(prevAnalysis, analysis);
      if (!editingId && !(pendingRoom.label || roomLabelInput.value).trim()) {
        body.label = `${mat.master_category}: ${mat.name}`;
      }
    } else if (isFloormapKind()) {
      body.analysis = {
        expected_orientaties: readExpectedOrientaties(),
        orientatie_correcties: readOrientatieCorrecties(),
      };
    } else {
      body.analysis = gevelAnalysisForSave(prevAnalysis);
    }
    const saved = await saveDrawingSubsection(body);
    const wasEdit = Boolean(editingId);
    const savedId = saved.subsection_id;
    markRoomTouched(savedId);
    noteLocalLabel(savedId, String(body.label || label));
    // Prefer server-echoed VG/VR when present (same as DB).
    const savedVg =
      saved.vg_nr != null && Number.isFinite(Number(saved.vg_nr))
        ? Number(saved.vg_nr)
        : vgVr.vg_nr;
    const savedVr =
      saved.vr_nr != null && String(saved.vr_nr).trim()
        ? String(saved.vr_nr).trim()
        : vgVr.vr_nr;
    // Optimistic local update so the overlay/list show new data even if reload is slow.
    const idx = rooms.findIndex((r) => normRoomId(r.id) === normRoomId(savedId));
    let patched: RoomSubsection;
    if (idx >= 0) {
      const prev = rooms[idx];
      patched = {
        ...prev,
        points: points.map((p) => ({ ...p })),
        label: String(body.label || prev.label),
        level_hint: level,
        vg_nr: savedVg,
        vr_nr: savedVr,
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : prev.area_m2,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : prev.area_norm,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : prev.perimeter_m,
        analysis: {
          ...(prev.analysis || {}),
          ...(typeof body.analysis === "object" && body.analysis
            ? (body.analysis as SubsectionAnalysis)
            : {}),
          ...(saved.analysis || {}),
          holes: holesSnap.length ? holesSnap : undefined,
        },
      };
      rooms[idx] = patched;
    } else {
      patched = {
        id: savedId,
        section_id: activeSection.id,
        label: String(body.label || label),
        level_hint: level,
        vg_nr: savedVg,
        vr_nr: savedVr,
        points: points.map((p) => ({ ...p })),
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
        perimeter_norm: null,
        metres_per_norm_unit: mpu,
        analysis_status: "ok",
        sort_order: rooms.length,
        analysis: {
          ...(typeof body.analysis === "object" && body.analysis
            ? (body.analysis as SubsectionAnalysis)
            : {}),
          ...(saved.analysis || {}),
          holes: holesSnap.length ? holesSnap : undefined,
        },
      };
      rooms = [...rooms, patched];
    }
    noteLocalRoomPatch(patched);
    // Invalidate in-flight lists so they cannot clobber this save.
    roomsLoadEpoch += 1;
    renderRoomList();
    drawOverlay();
    let sealBit = "";
    let sealMatForSum: CatalogMaterial | null = null;
    const savedRoomForSeal = rooms.find((r) => r.id === savedId);
    if (wantSeal && savedRoomForSeal) {
      const seal = await saveComponentSealAttribute(
        {
          ...savedRoomForSeal,
          points: points.map((p) => ({ ...p })),
          label: String(body.label || label),
          vg_nr: savedVg,
          vr_nr: savedVr,
          level_hint: level,
        },
        true,
      );
      sealMatForSum = seal.material;
      const lenTxt = seal.length_m != null ? ` ${seal.length_m.toFixed(2)} m` : "";
      sealBit = seal.created
        ? ` · kierdichting aan${lenTxt}`
        : ` · kierdichting bijgewerkt${lenTxt}`;
      const afterSeal = rooms.find((r) => r.id === savedId);
      if (afterSeal) patched = { ...patched, analysis: afterSeal.analysis };
      if (kierSuggestCb) delete kierSuggestCb.dataset.userTouched;
    } else if (
      editingId &&
      !wantSeal &&
      (componentSealEnabled(savedRoomForSeal?.analysis) ||
        componentSealEnabled(
          rooms.find((r) => r.id === editingId)?.analysis,
        ) ||
        existingSealFor(editingId))
    ) {
      // Only strip seal when the dock checkbox is off (explicit). Do not treat a
      // missing/stale local analysis as “user unchecked”.
      const removed = await removeSealForParent(editingId);
      if (removed) sealBit = " · kierdichting uit";
      const afterSeal = rooms.find((r) => r.id === savedId);
      if (afterSeal) patched = { ...patched, analysis: afterSeal.analysis };
    }
    clearPendingRoom();
    // Keep VG/VR on gevel/section so successive components can share the same VR.
    if (isFloormapKind()) {
      roomVgInput.value = "";
      roomVrInput.value = "";
      clearExpectedOrientaties();
    } else {
      if (savedVg != null) roomVgInput.value = String(savedVg);
      if (savedVr) roomVrInput.value = savedVr;
      rememberComponentOrientatie(readComponentOrientatie());
      setComponentOrientatie(lastComponentOrientatie);
    }
    // Re-assert patch after clearPendingRoom (it redraws from `rooms`).
    noteLocalRoomPatch(patched);
    renderRoomList();
    drawOverlay();
    try {
      await loadRooms({ preserveOrder: true });
    } catch (reloadErr) {
      renderRoomList();
      drawOverlay();
      console.warn("loadRooms after save failed", reloadErr);
    }
    // Guarantee post-reload UI still shows what we just wrote (stale list → patch).
    {
      const i = rooms.findIndex((r) => normRoomId(r.id) === normRoomId(savedId));
      if (i >= 0) {
        rooms[i] = {
          ...rooms[i],
          points: patched.points.map((p) => ({ ...p })),
          label: patched.label,
          level_hint: patched.level_hint,
          vg_nr: patched.vg_nr,
          vr_nr: patched.vr_nr,
          area_m2: patched.area_m2 != null ? patched.area_m2 : rooms[i].area_m2,
          area_norm: patched.area_norm != null ? patched.area_norm : rooms[i].area_norm,
          perimeter_m: patched.perimeter_m != null ? patched.perimeter_m : rooms[i].perimeter_m,
          analysis: patched.analysis
            ? { ...(rooms[i].analysis || {}), ...patched.analysis }
            : rooms[i].analysis,
        };
        noteLocalRoomPatch(rooms[i]);
        noteLocalLabel(rooms[i].id, patched.label);
      }
      renderRoomList();
      drawOverlay();
    }
    requestAnimationFrame(() => drawOverlay());
    if (sealMatForSum && sealBit) {
      const key = sealMaterialKey({
        material_id: sealMatForSum.material_id,
        catalog_id: sealMatForSum.catalog_id,
      } as SubsectionAnalysis);
      const typeSum = sumSealLengthsForType(key);
      const code = sealMatForSum.catalog_id || DEFAULT_KIER_CATALOG_ID;
      if (typeSum > 0) sealBit += ` · totaal ${code} ${typeSum.toFixed(2)} m`;
    }
    let depCount = 0;
    let depErr = "";
    if (wasEdit && editingId) {
      setStatus("Afgeleide setbewerkingen herberekenen…", "busy");
      try {
        depCount = await recalculateBooleanDependents(editingId);
        if (depCount > 0) {
          await loadRooms();
          // Stale list na afgeleide herberekening mag ori/materiaal niet terugdraaien.
          const i = rooms.findIndex((r) => normRoomId(r.id) === normRoomId(savedId));
          if (i >= 0 && patched.analysis) {
            rooms[i] = {
              ...rooms[i],
              points: patched.points.map((p) => ({ ...p })),
              label: patched.label,
              level_hint: patched.level_hint,
              vg_nr: patched.vg_nr,
              vr_nr: patched.vr_nr,
              analysis: { ...(rooms[i].analysis || {}), ...patched.analysis },
            };
            noteLocalRoomPatch(rooms[i]);
            noteLocalLabel(rooms[i].id, patched.label);
          }
          renderRoomList();
          drawOverlay();
        }
      } catch (err) {
        depErr = err instanceof Error ? err.message : String(err);
      }
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
    const noMatBit =
      !isFloormapKind() && !mat && !kier ? " · nog geen materiaal (oranje)" : "";
    const vgBit =
      savedVg != null && savedVr
        ? ` · VG ${savedVg} · VR ${savedVr}`
        : !isFloormapKind()
          ? " · zonder VG/VR"
          : "";
    const oriCodes = isFloormapKind() ? readExpectedOrientaties() : [];
    const oriBit =
      isFloormapKind()
        ? oriCodes.length
          ? ` · ori ${oriCodes.join(",")}`
          : " · ori ontbreekt"
        : "";
    setStatus(
      wasEdit
        ? kier && lenM != null
          ? `Geometrie bijgewerkt · lengte ${lenM.toFixed(2)} m${vgBit}${oriBit}${depBit}${sealBit}`
          : m2 != null
            ? `Geometrie bijgewerkt · ${m2.toFixed(2)} m²${vgBit}${oriBit}${depBit}${sealBit}${noMatBit}`
            : `Geometrie bijgewerkt${vgBit}${oriBit}${depBit}${sealBit}${noMatBit}`
        : kier && lenM != null
          ? `Opgeslagen ${String(body.label)} · lengte ${lenM.toFixed(2)} m${vgBit}${oriBit}`
          : m2 != null
            ? `Opgeslagen ${String(body.label)} · ${m2.toFixed(2)} m²${vgBit}${oriBit}${noMatBit}${sealBit}`
            : `Opgeslagen ${String(body.label)}${vgBit}${oriBit}${noMatBit}${sealBit}`,
      depErr ? "err" : "ok",
    );
    if (depErr) {
      setStatus(
        `Geometrie opgeslagen, maar afgeleide setbewerking faalde: ${depErr}`,
        "err",
      );
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncPendingRoomButtons();
    renderRoomList();
    drawOverlay();
  } finally {
    roomSaveBtn.disabled = false;
  }
}

function ringBBox(points: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (maxX < minX || maxY < minY) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/** Offsets around the original so copies sit in a ring (1 copy → to the right). */
function copyOffsetsAround(
  points: Pt[],
  count: number,
  mode: "around" | "nudge" = "around",
): Array<{ dx: number; dy: number }> {
  const n = Math.max(1, Math.min(20, Math.floor(count)));
  const box = ringBBox(points);
  const w = Math.max(0.01, box.maxX - box.minX);
  const h = Math.max(0.01, box.maxY - box.minY);
  const span = Math.max(w, h);
  const gap = Math.max(0.012, span * 0.12);
  if (mode === "nudge") {
    const step = Math.max(0.012, Math.min(0.028, span * 0.08));
    const out: Array<{ dx: number; dy: number }> = [];
    for (let i = 0; i < n; i++) {
      const k = i + 1;
      out.push({ dx: step * k, dy: step * k * 0.35 });
    }
    return out;
  }
  if (n === 1) return [{ dx: w + gap, dy: 0 }];
  const radius = span * 0.55 + gap;
  const out: Array<{ dx: number; dy: number }> = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
    out.push({ dx: radius * Math.cos(ang), dy: radius * Math.sin(ang) });
  }
  return out;
}

function promptCopyCount(defaultCount = 1): number | null {
  const raw = window.prompt("Aantal kopieën rond het origineel (1–20):", String(defaultCount));
  if (raw == null) return null;
  const n = Math.floor(Number(String(raw).trim().replace(",", ".")));
  if (!Number.isFinite(n) || n < 1 || n > 20) {
    setStatus("Voer een getal tussen 1 en 20 in", "err");
    return null;
  }
  return n;
}

function copyLabelBase(label: string): string {
  const t = (label || "").trim() || activePartNoun().singular;
  return t.replace(/\s*\(kopie(?:\s+\d+)?\)\s*$/i, "").trim() || t;
}

function analysisForDuplicate(src?: SubsectionAnalysis | null): Record<string, unknown> | undefined {
  const oris = Array.isArray(src?.expected_orientaties)
    ? src!.expected_orientaties!.map((c) => normalizeOrientatieCode(c)).filter((c) =>
        (ORIENTATIE_CODES as readonly string[]).includes(c),
      )
    : [];
  const compOri = normalizeOrientatieCode(src?.orientatie || "");
  const hasCompOri = (ORIENTATIE_CODES as readonly string[]).includes(compOri);
  if (!src?.material_id && !src?.catalog_id && !src?.master_category && !oris.length && !hasCompOri) {
    return undefined;
  }
  const analysis: Record<string, unknown> = {};
  if (src?.material_id) analysis.material_id = src.material_id;
  if (src?.master_category) analysis.master_category = src.master_category;
  if (src?.material_name) analysis.material_name = src.material_name;
  if (src?.catalog_id) analysis.catalog_id = src.catalog_id;
  if (src?.category) analysis.category = src.category;
  if (src?.rubriek_nr != null) analysis.rubriek_nr = src.rubriek_nr;
  if (src?.quantity_kind === "length") {
    analysis.quantity_kind = "length";
    if (src.length_m != null) analysis.length_m = src.length_m;
    if (src.length_norm != null) analysis.length_norm = src.length_norm;
    if (src.open_path) analysis.open_path = true;
  }
  if (hasCompOri) analysis.orientatie = compOri;
  if (oris.length) analysis.expected_orientaties = oris;
  if (src?.orientatie_correcties && typeof src.orientatie_correcties === "object") {
    analysis.orientatie_correcties = src.orientatie_correcties;
  }
  // Standalone geometry copy — do not keep boolean provenance.
  return analysis;
}

async function postNewSubsection(body: Record<string, unknown>): Promise<{ subsection_id: string }> {
  const saved = await saveDrawingSubsection(body);
  return { subsection_id: saved.subsection_id };
}

/**
 * Duplicate a closed component: N copies placed around the original.
 * Façade: keeps VR + material. Floormap: new VR numbers per copy.
 */
async function duplicateClosedComponent(opts: {
  points: Pt[];
  holes?: Pt[][];
  label: string;
  level_hint: string;
  vg_nr: number | null;
  vr_nr: string | null;
  analysis?: SubsectionAnalysis | null;
  count: number;
  offsetMode?: "around" | "nudge";
}): Promise<string | null> {
  if (!activeSection || !auth()) throw new Error("Geen actieve sectie");
  const asLength =
    opts.analysis?.quantity_kind === "length" ||
    isLengthQuantityRubriek(opts.analysis?.rubriek_nr ?? opts.analysis?.master_category);
  const openPath = Boolean(asLength && opts.analysis?.open_path);
  const points = openPath
    ? opts.points.map((p) => ({ ...p }))
    : closeRing(opts.points);
  if (openPath) {
    if (points.length < 2) throw new Error("Kierdichting heeft minstens 2 punten nodig om te kopiëren");
  } else if (points.length < 4 || (!asLength && shoelaceArea(points) < 1e-8)) {
    throw new Error("Alleen gesloten componenten met oppervlak kunnen worden gekopieerd");
  }
  const holesSrc = asLength
    ? []
    : (opts.holes || [])
        .map((h) => closeRing(h))
        .filter((h) => h.length >= 4 && shoelaceArea(h) >= 1e-8);
  const offsets = copyOffsetsAround(points, opts.count, opts.offsetMode ?? (asLength ? "nudge" : "around"));
  const mpu = activeScaleMpu();
  const base = copyLabelBase(opts.label);
  const analysisBase = analysisForDuplicate(opts.analysis);
  let lastId: string | null = null;
  let nextVr = opts.vr_nr;

  for (let i = 0; i < offsets.length; i++) {
    const { dx, dy } = offsets[i];
    const copyPoints = openPath
      ? points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
      : translateRing(points, dx, dy);
    const copyHoles = holesSrc.map((h) => translateRing(h, dx, dy));
    let vg = opts.vg_nr;
    let vr = opts.vr_nr;
    if (isFloormapKind()) {
      vg = opts.vg_nr ?? suggestVgNr();
      // Unique VR among floormap rooms: bump from current suggestion each time.
      if (i === 0) {
        roomVgInput.value = String(vg);
        roomVrInput.value = "";
        nextVr = suggestNextVrNr();
      } else {
        const n = Number(nextVr);
        nextVr = Number.isFinite(n) ? String(n + 1) : suggestNextVrNr();
      }
      vr = String(nextVr);
    }
    const label = offsets.length === 1 ? `${base} (kopie)` : `${base} (kopie ${i + 1})`;
    const body: Record<string, unknown> = {
      section_id: activeSection.id,
      label,
      level_hint: opts.level_hint || "OTHER",
      vg_nr: vg,
      vr_nr: vr,
      points: copyPoints,
      holes: copyHoles,
      metres_per_norm_unit: mpu ?? undefined,
      scale_aspect_yx: activeScaleAspect(),
    };
    if (analysisBase) {
      const analysis = { ...analysisBase };
      if (copyHoles.length) analysis.holes = copyHoles;
      body.analysis = analysis;
    } else if (copyHoles.length) {
      body.analysis = { holes: copyHoles };
    }
    const saved = await postNewSubsection(body);
    lastId = saved.subsection_id;
    upsertOptimisticRoom({
      id: saved.subsection_id,
      section_id: activeSection.id,
      label,
      level_hint: opts.level_hint || "OTHER",
      vg_nr: vg,
      vr_nr: vr,
      points: copyPoints.map((p) => ({ ...p })),
      area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
      area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
      perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
      perimeter_norm: null,
      metres_per_norm_unit: mpu,
      analysis_status: "ok",
      sort_order: rooms.length,
      analysis: (body.analysis as SubsectionAnalysis | undefined) ?? null,
    });
  }
  return lastId;
}

async function duplicateFromRoom(room: RoomSubsection, count?: number): Promise<void> {
  const n = count ?? promptCopyCount(1);
  if (n == null) return;
  const holes = Array.isArray(room.analysis?.holes)
    ? room.analysis!.holes!.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
    : [];
  setStatus(`Kopiëren (${n})…`, "busy");
  try {
    const lengthDup = componentIsLengthQuantity(room);
    const lastId = await duplicateClosedComponent({
      points: room.points,
      holes,
      label: room.label,
      level_hint: room.level_hint,
      vg_nr: room.vg_nr,
      vr_nr: room.vr_nr,
      analysis: room.analysis,
      count: n,
      offsetMode: lengthDup ? "nudge" : "around",
    });
    await loadRooms();
    if (lastId) {
      const created = rooms.find((r) => r.id === lastId);
      if (created) editRoom(created);
    }
    setStatus(
      n === 1
        ? lengthDup
          ? `1 kopie van «${copyLabelBase(room.label)}» — sleep de groene lijn of ankers naar de juiste plaats; daarna opslaan`
          : `1 kopie geplaatst naast «${copyLabelBase(room.label)}» — sleep het groene vlak of witte ankers; pijltjes om te schuiven; daarna opslaan`
        : `${n} kopieën rond «${copyLabelBase(room.label)}» — klik een kopie in de lijst om te slepen`,
      "ok",
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

async function duplicateFromPending(count?: number): Promise<void> {
  if (!pendingRoom || !activeSection) {
    setStatus("Sluit eerst een polygoon (of selecteer een opgeslagen component)", "err");
    return;
  }
  const kierDup = !isFloormapKind() && (selectedIsKierdichting() || pendingIsLengthComponent());
  if (!pendingRoom.closed && !kierDup) {
    setStatus("Sluit eerst een polygoon (of selecteer een opgeslagen component)", "err");
    return;
  }
  const n = count ?? promptCopyCount(1);
  if (n == null) return;

  const snapPoints = pendingRoom.points.map((p) => ({ ...p }));
  const snapHoles = (pendingRoom.holes || []).map((h) => h.map((p) => ({ ...p })));
  const editingId = pendingRoom.editingId;

  let analysis: SubsectionAnalysis | null | undefined = null;
  if (editingId) {
    const src = rooms.find((r) => r.id === editingId);
    analysis = src?.analysis ?? null;
  }
  if (!analysis && !isFloormapKind()) {
    const mat = selectedCatalogMaterial();
    if (mat) {
      analysis = {
        material_id: mat.material_id,
        master_category: mat.master_category,
        material_name: mat.name,
        catalog_id: mat.catalog_id,
        category: mat.category || undefined,
        rubriek_nr: mat.rubriek_nr ?? undefined,
      };
    }
  }
  if (isFloormapKind()) {
    const oris = readExpectedOrientaties();
    analysis = {
      ...(analysis || {}),
      expected_orientaties: oris,
      orientatie_correcties: readOrientatieCorrecties(),
    };
  }
  if (kierDup) {
    analysis = {
      ...(analysis || {}),
      quantity_kind: "length",
    };
    if (!pendingRoom.closed) analysis.open_path = true;
  }

  const vgVr = parseVgVrInputs();
  if (vgVr.error) {
    setStatus(vgVr.error, "err");
    return;
  }
  if (isFloormapKind() && (vgVr.vg_nr == null || vgVr.vr_nr == null)) {
    setStatus("Vul VG- en VR-nummer in vóór dupliceren", "err");
    return;
  }
  if (isFloormapKind() && !readExpectedOrientaties().length) {
    setStatus(
      "Vink minstens één geveloriëntatie aan vóór dupliceren",
      "err",
    );
    expectedOriBlockEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }

  const label =
    roomLabelInput.value.trim() ||
    `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  const level = roomLevelSelect.value || "OTHER";
  const vg = vgVr.vg_nr;
  const vr = vgVr.vr_nr;

  setStatus(`Kopiëren (${n})…`, "busy");
  try {
    // Unsaved draw: persist original in place first, then place copies around it.
    if (!editingId) {
      await savePendingRoom();
    }
    const lastId = await duplicateClosedComponent({
      points: snapPoints,
      holes: snapHoles,
      label,
      level_hint: level,
      vg_nr: vg,
      vr_nr: vr,
      analysis,
      count: n,
      offsetMode: kierDup ? "nudge" : "around",
    });
    await loadRooms();
    if (lastId) {
      const created = rooms.find((r) => r.id === lastId);
      if (created) editRoom(created);
    }
    setStatus(
      n === 1
        ? "1 kopie geplaatst — sleep het groene vlak of witte ankers; pijltjes om te schuiven; daarna opslaan"
        : `${n} kopieën geplaatst — klik een kopie in de lijst om te slepen`,
      "ok",
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncPendingRoomButtons();
  }
}

/** Push live edit geometry into `rooms` so leaving edit does not snap back to stale outline. */
function syncPendingGeometryToRooms(): void {
  if (!pendingRoom?.editingId || !pendingRoom.points.length) return;
  const id = pendingRoom.editingId;
  const i = rooms.findIndex((r) => r.id === id);
  if (i < 0) return;
  const prev = rooms[i];
  const holes = (pendingRoom.holes || []).map((h) => h.map((p) => ({ ...p })));
  const next: RoomSubsection = {
    ...prev,
    points: pendingRoom.points.map((p) => ({ ...p })),
    label: (pendingRoom.label || roomLabelInput.value).trim() || prev.label,
    level_hint: roomLevelSelect.value || prev.level_hint,
    analysis: {
      ...(prev.analysis || {}),
      holes: holes.length ? holes : undefined,
      open_path: pendingRoom.closed ? undefined : true,
    },
  };
  if (pendingRoom.closed) {
    if (next.analysis) delete next.analysis.open_path;
  }
  rooms[i] = next;
  noteLocalRoomPatch(next);
}

function editRoom(room: RoomSubsection): void {
  // Keep previous edit visible (and patched) when opening another component.
  if (pendingRoom?.editingId && pendingRoom.editingId !== room.id) {
    syncPendingGeometryToRooms();
  }
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
    dragBodyLast: null,
    drawing: false,
    drawCursor: null,
    label: (room.label || "").trim(),
  };
  roomLabelInput.value = pendingRoom.label || room.label;
  roomLevelSelect.value = room.level_hint || "OTHER";
  // Gevel: keep sticky VG/VR (or suggest) when opening a component that has none yet,
  // so «Opslaan» actually koppelt i.p.v. leeg terug te schrijven.
  if (room.vg_nr != null) {
    roomVgInput.value = String(room.vg_nr);
  } else if (isFloormapKind()) {
    roomVgInput.value = "";
  } else if (!roomVgInput.value.trim()) {
    roomVgInput.value = String(suggestVgNr());
  }
  if (room.vr_nr != null && String(room.vr_nr).trim()) {
    roomVrInput.value = String(room.vr_nr).trim();
  } else if (isFloormapKind()) {
    roomVrInput.value = "";
  } else if (!roomVrInput.value.trim()) {
    roomVrInput.value = suggestFacadeVrNr();
  }
  if (isFloormapKind()) {
    setExpectedOrientaties(
      room.analysis?.expected_orientaties,
      room.analysis?.orientatie_correcties,
    );
    clearComponentOrientatie();
  } else {
    clearExpectedOrientaties();
    applyComponentOrientatieForEdit(room.analysis?.orientatie);
  }
  void applyMaterialSelectionFromAnalysis(room.analysis);
  syncPendingRoomButtons();
  syncEditDock();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
  drawOverlay();
  // Scroll PDF after layout (edit dock / list) settles — avoids fighting scrollIntoView jumps.
  // Floormap: ook het oriëntatieblok in de zijbalk in beeld (staat boven de lijst).
  requestAnimationFrame(() => {
    if (isFloormapKind() && expectedOriBlockEl && !expectedOriBlockEl.classList.contains("hidden")) {
      expectedOriBlockEl.classList.add("fm-expected-ori-block--focus");
      expectedOriBlockEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      window.setTimeout(() => expectedOriBlockEl?.classList.remove("fm-expected-ori-block--focus"), 1400);
    }
    if (pendingRoom?.editingId === room.id && pendingRoom.points.length) {
      scrollToRing(pendingRoom.points);
    }
  });
  const oriN = isFloormapKind() ? readExpectedOrientaties().length : 0;
  setStatus(
    isFloormapKind()
      ? `Bewerken: ${room.label} — geveloriëntaties${oriN ? ` (${oriN})` : ""} bovenaan in de zijbalk aanpassen, daarna Opslaan`
      : `Bewerken: ${room.label} — sleep ankers; dubbelklik op een rand voor extra hoekpunt; daarna opslaan`,
    "ok",
  );
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
  // Open compose panel when multi-select is ready (panel defaults collapsed).
  if (setOpsFieldset instanceof HTMLDetailsElement && !setOpsFieldset.open) {
    setOpsFieldset.open = true;
    try {
      localStorage.setItem("app-gevelwering-compose-collapsed", "0");
    } catch {
      /* ignore */
    }
  }
  try {
    const selected = rooms.filter((r) => selectedSetIds.has(r.id));
    const { parts } = buildComposeParts(selected);
    booleanPreview = composeSigned(parts.map((p) => ({ ring: p.room.points, sign: p.sign })));
    if (composeFeedbackEl?.classList.contains("is-err")) {
      setComposeFeedback("", "clear");
    }
  } catch (err) {
    booleanPreview = null;
    const msg = err instanceof Error ? err.message : String(err);
    setComposeFeedback(msg, "err");
  }
  renderComposeParts();
  drawOverlay();
}

function materialAnalysisLabel(a?: SubsectionAnalysis | null, opts?: { skipOp?: boolean }): string {
  if (!a) return "";
  const op = opts?.skipOp ? "" : booleanOpSymbol(a.boolean_op);
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
  const id = (materialIdEl?.value || materialFavoriteEl?.value || "").trim();
  if (!id) return null;
  return (
    catalogMaterials.find((m) => m.material_id === id) ||
    favoriteMaterials.find((m) => m.material_id === id) ||
    null
  );
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
    const opbouw = materialKindInline(m.material_kind);
    const appBit =
      (m.source || "").trim().toLowerCase() === "app" ||
      (m.source || "").trim().toLowerCase() === "eigen"
        ? " · app"
        : "";
    opt.textContent = code
      ? `${code} · ${m.name}${sub} · ${opbouw}${ra}${appBit}`
      : `${m.name}${sub} · ${opbouw}${ra}${appBit}`;
    opt.title = code ? `${code} · ${m.name} (${opbouw})` : `${m.name} (${opbouw})`;
    materialIdEl.appendChild(opt);
  }
  materialIdEl.disabled = materials.length === 0;
  if (selectedId && materials.some((m) => m.material_id === selectedId)) {
    materialIdEl.value = selectedId;
  }
  syncFavoriteButtons();
}

function renderFavoriteOptions(selectedId?: string | null): void {
  if (!materialFavoriteEl) return;
  const keep = selectedId ?? materialFavoriteEl.value;
  materialFavoriteEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = favoriteMaterials.length
    ? "— kies uit project-picklist —"
    : "— picklist leeg voor dit project —";
  materialFavoriteEl.appendChild(ph);
  for (const m of favoriteMaterials) {
    const opt = document.createElement("option");
    opt.value = m.material_id;
    const code = (m.catalog_id || "").trim();
    const ra = m.ra_dba != null ? ` · RA ${m.ra_dba}` : "";
    opt.textContent = code ? `${code} · ${m.name}${ra}` : `${m.name}${ra}`;
    materialFavoriteEl.appendChild(opt);
  }
  materialFavoriteEl.disabled = favoriteMaterials.length === 0;
  if (keep && favoriteMaterials.some((m) => m.material_id === keep)) {
    materialFavoriteEl.value = keep;
  }
  syncFavoriteButtons();
  renderAssignPicklistOptions(keep);
}

function syncFavoriteButtons(): void {
  const hasBuilding = Boolean(buildingId);
  const mid = (materialIdEl?.value || materialFavoriteEl?.value || "").trim();
  const isFav = Boolean(mid && favoriteMaterials.some((m) => m.material_id === mid));
  // Knoppen blijven klikbaar voor statusfeedback; alleen echt blokkeren zonder project.
  if (favoriteAddBtn) {
    favoriteAddBtn.disabled = !hasBuilding;
    favoriteAddBtn.title = !hasBuilding
      ? "Open eerst een project"
      : !mid
        ? "Kies eerst een materiaal (rubriek + naam)"
        : isFav
          ? "Staat al bij meest gebruikt"
          : "Voeg het geselecteerde materiaal toe aan meest gebruikt";
  }
  if (favoriteRemoveBtn) {
    favoriteRemoveBtn.disabled = !hasBuilding;
    favoriteRemoveBtn.title = !hasBuilding
      ? "Open eerst een project"
      : !isFav
        ? "Dit materiaal staat niet bij meest gebruikt"
        : "Verwijder uit meest gebruikt";
  }
  if (presetSaveBtn) presetSaveBtn.disabled = !hasBuilding || favoriteMaterials.length === 0;
  if (presetApplyBtn) presetApplyBtn.disabled = !hasBuilding;
}

function materialFavoriteLabel(materialId: string): string {
  const mat =
    catalogMaterials.find((m) => m.material_id === materialId) ||
    favoriteMaterials.find((m) => m.material_id === materialId);
  if (!mat) return "materiaal";
  const code = (mat.catalog_id || "").trim();
  return code ? `${code} · ${mat.name}` : mat.name || "materiaal";
}

async function loadFavoriteMaterials(): Promise<void> {
  if (!auth()?.token || !buildingId) {
    favoriteMaterials = [];
    renderFavoriteOptions();
    return;
  }
  try {
    const data = bppPhase1Enabled()
      ? await bppListMaterialFavorites(invokeString, auth()!.token, buildingId)
      : await apiGet<{ materials: CatalogMaterial[] }>(
          `/api/floormap/material-favorites?building_id=${encodeURIComponent(buildingId)}`,
        );
    favoriteMaterials = (data.materials || []) as CatalogMaterial[];
    renderFavoriteOptions(materialIdEl?.value || null);
  } catch (err) {
    favoriteMaterials = [];
    renderFavoriteOptions();
    console.warn("load favorites failed", err);
  }
}

async function addMaterialFavorite(materialId: string): Promise<void> {
  if (!auth()?.token) {
    setStatus("Niet ingelogd — log opnieuw in", "err");
    return;
  }
  if (!buildingId) {
    setStatus("Geen project open — open eerst een gebouw", "err");
    return;
  }
  if (!materialId) {
    setStatus("Kies eerst een materiaal om toe te voegen aan meest gebruikt", "err");
    return;
  }
  if (favoriteMaterials.some((m) => m.material_id === materialId)) {
    setStatus(`Staat al bij meest gebruikt: ${materialFavoriteLabel(materialId)}`, "ok");
    return;
  }
  const label = materialFavoriteLabel(materialId);
  setStatus(`Toevoegen aan meest gebruikt: ${label}…`, "busy");
  try {
    if (bppPhase1Enabled()) {
      await bppAddMaterialFavorite(invokeString, auth()!.token, buildingId, materialId);
    } else {
      await apiPost("/api/floormap/material-favorites", {
        building_id: buildingId,
        material_id: materialId,
      });
    }
    await loadFavoriteMaterials();
    setStatus(`Toegevoegd aan meest gebruikt: ${label}`, "ok");
  } catch (err) {
    setStatus(
      `Meest gebruikt mislukt: ${err instanceof Error ? err.message : String(err)}`,
      "err",
    );
  }
}

async function removeMaterialFavorite(materialId: string): Promise<void> {
  if (!auth()?.token) {
    setStatus("Niet ingelogd — log opnieuw in", "err");
    return;
  }
  if (!buildingId) {
    setStatus("Geen project open — open eerst een gebouw", "err");
    return;
  }
  if (!materialId) {
    setStatus("Kies eerst een materiaal om te verwijderen uit meest gebruikt", "err");
    return;
  }
  if (!favoriteMaterials.some((m) => m.material_id === materialId)) {
    setStatus("Dit materiaal staat niet bij meest gebruikt", "err");
    return;
  }
  const label = materialFavoriteLabel(materialId);
  setStatus(`Verwijderen uit meest gebruikt: ${label}…`, "busy");
  try {
    if (bppPhase1Enabled()) {
      await bppRemoveMaterialFavorite(invokeString, auth()!.token, buildingId, materialId);
    } else {
      await apiDelete(
        `/api/floormap/material-favorites?building_id=${encodeURIComponent(buildingId)}&material_id=${encodeURIComponent(materialId)}`,
      );
    }
    await loadFavoriteMaterials();
    setStatus(`Verwijderd uit meest gebruikt: ${label}`, "ok");
  } catch (err) {
    setStatus(
      `Verwijderen mislukt: ${err instanceof Error ? err.message : String(err)}`,
      "err",
    );
  }
}

function ensureMaterialOption(mat: CatalogMaterial): void {
  if (!catalogMaterials.some((m) => m.material_id === mat.material_id)) {
    catalogMaterials = [mat, ...catalogMaterials];
  }
  if (!materialIdEl) return;
  if (![...materialIdEl.options].some((o) => o.value === mat.material_id)) {
    renderMaterialNameOptions(catalogMaterials, mat.material_id);
  }
  materialIdEl.value = mat.material_id;
  materialIdEl.disabled = false;
}

async function selectMaterialById(materialId: string, fromFavorite = false): Promise<void> {
  const mat =
    favoriteMaterials.find((m) => m.material_id === materialId) ||
    catalogMaterials.find((m) => m.material_id === materialId);
  if (!mat) {
    setStatus("Materiaal niet gevonden in meest gebruikt", "err");
    return;
  }
  if (materialFilterEl) materialFilterEl.value = "";
  if (mat.master_category && materialCategoryEl) {
    await ensureMaterialCategories();
    if (![...materialCategoryEl.options].some((o) => o.value === mat.master_category)) {
      const opt = document.createElement("option");
      opt.value = mat.master_category;
      opt.textContent = mat.master_category;
      materialCategoryEl.appendChild(opt);
    }
    materialCategoryEl.value = mat.master_category;
    renderMaterialSubcategoryOptions();
    // Hele rubriek laden (niet eerst subrubriek filteren) zodat het favoriet altijd in de lijst staat.
    if (materialSubcategoryEl) materialSubcategoryEl.value = "";
    await loadMaterialsForCategory(mat.master_category, "");
  }
  ensureMaterialOption(mat);
  if (mat.category && materialSubcategoryEl) {
    if (![...materialSubcategoryEl.options].some((o) => o.value === mat.category)) {
      const opt = document.createElement("option");
      opt.value = mat.category;
      opt.textContent = mat.category;
      materialSubcategoryEl.appendChild(opt);
    }
    materialSubcategoryEl.value = mat.category;
  }
  if (fromFavorite && materialFavoriteEl) materialFavoriteEl.value = materialId;
  updateMaterialSpectrumPreview(mat);
  syncFavoriteButtons();
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  fillReplaceToSelect(mat.material_id);
  updateReplaceMaterialBtn();
  if (kozijnDraft && !kozijnDraft.woodMaterialId) {
    lockKozijnWoodMaterial(mat, false);
  }
  await applyMaterialToEditingComponent(mat);
}

type ProjectMaterialUsage = {
  material_id: string;
  catalog_id: string;
  material_name: string;
  master_category: string;
  /** Subrubriek (bijv. «Kozijnen») — stuurt Naar-filter bij substitutie. */
  category: string;
  count: number;
  subsection_ids: string[];
};

let projectMaterialUsages: ProjectMaterialUsage[] | null = null;
let projectMaterialUsagesLoading = false;

function materialUsageLabel(u: ProjectMaterialUsage): string {
  const code = (u.catalog_id || "").trim();
  const name = (u.material_name || "").trim();
  const base = code && name ? `${code} · ${name}` : name || code || u.material_id.slice(0, 8);
  return `${base} · ${u.count}×`;
}

/** Scan alle geveltekeningen: welk materiaal zit waar (top-level analysis.material_id). */
async function collectProjectMaterialUsages(): Promise<ProjectMaterialUsage[]> {
  if (!auth()?.token || !buildingId) return [];
  const byId = new Map<string, ProjectMaterialUsage>();
  for (const s of sections) {
    if (isFloormapKind(s.region_kind)) continue;
    if ((s.room_count || 0) < 1 && s.id !== activeSection?.id) continue;
    let list: RoomSubsection[];
    try {
      list = s.id === activeSection?.id ? rooms : await fetchSectionRooms(s.id);
    } catch {
      continue;
    }
    for (const r of list) {
      if (isLegacySealSibling(r.analysis)) continue;
      const mid = String(r.analysis?.material_id || "").trim();
      if (!mid) continue;
      const cur = byId.get(mid);
      if (cur) {
        cur.count += 1;
        cur.subsection_ids.push(r.id);
        continue;
      }
      byId.set(mid, {
        material_id: mid,
        catalog_id: String(r.analysis?.catalog_id || "").trim(),
        material_name: String(r.analysis?.material_name || "").trim(),
        master_category: String(r.analysis?.master_category || "").trim(),
        category: String(r.analysis?.category || "").trim(),
        count: 1,
        subsection_ids: [r.id],
      });
    }
  }
  return [...byId.values()].sort((a, b) => {
    const la = `${a.catalog_id} ${a.material_name}`.trim();
    const lb = `${b.catalog_id} ${b.material_name}`.trim();
    return la.localeCompare(lb, "nl") || b.count - a.count;
  });
}

async function refreshProjectMaterialUsages(force = false): Promise<void> {
  if (!auth()?.token || !buildingId || projectMaterialUsagesLoading) return;
  if (!force && projectMaterialUsages) {
    syncReplaceMaterialUi();
    return;
  }
  projectMaterialUsagesLoading = true;
  try {
    projectMaterialUsages = await collectProjectMaterialUsages();
  } finally {
    projectMaterialUsagesLoading = false;
  }
  syncReplaceMaterialUi();
}

function replaceToCandidateMaterials(): CatalogMaterial[] {
  const byId = new Map<string, CatalogMaterial>();
  for (const m of favoriteMaterials) byId.set(m.material_id, m);
  for (const m of catalogMaterials) byId.set(m.material_id, m);
  // Also include currently selected catalog material if missing from lists.
  const sel = selectedCatalogMaterial();
  if (sel) byId.set(sel.material_id, sel);
  const fromId = (replaceMatFromEl?.value || "").trim();
  const fromUsage = projectMaterialUsages?.find((u) => u.material_id === fromId);
  const fromCat = (fromUsage?.category || materialSubcategoryEl?.value || "").trim().toLowerCase();
  return [...byId.values()].sort((a, b) => {
    // Zelfde subrubriek eerst; app-materialen (A#####) daarna vooraan — makkelijk als Naar-target.
    const aSame = fromCat && (a.category || "").trim().toLowerCase() === fromCat ? 0 : 1;
    const bSame = fromCat && (b.category || "").trim().toLowerCase() === fromCat ? 0 : 1;
    if (aSame !== bSame) return aSame - bSame;
    const aApp = (a.source || "") === "app" || (a.catalog_id || "").startsWith("A") ? 0 : 1;
    const bApp = (b.source || "") === "app" || (b.catalog_id || "").startsWith("A") ? 0 : 1;
    if (aApp !== bApp) return aApp - bApp;
    const la = `${a.catalog_id || ""} ${a.name || ""}`.trim();
    const lb = `${b.catalog_id || ""} ${b.name || ""}`.trim();
    return la.localeCompare(lb, "nl");
  });
}

function formatReplaceToOption(m: CatalogMaterial): string {
  const code = (m.catalog_id || "").trim();
  const name = (m.name || "").trim();
  const ra = m.ra_dba != null && Number.isFinite(Number(m.ra_dba)) ? ` · RA ${m.ra_dba}` : "";
  return (code && name ? `${code} · ${name}` : name || code || m.material_id.slice(0, 8)) + ra;
}

function resolveReplaceToMaterial(): CatalogMaterial | null {
  const id = (replaceMatToEl?.value || "").trim();
  if (!id) return null;
  return (
    catalogMaterials.find((m) => m.material_id === id) ||
    favoriteMaterials.find((m) => m.material_id === id) ||
    null
  );
}

function fillReplaceToSelect(preferId?: string | null): void {
  if (!replaceMatToEl) return;
  const prev = (preferId || replaceMatToEl.value || selectedCatalogMaterial()?.material_id || "").trim();
  const fromId = (replaceMatFromEl?.value || "").trim();
  const list = replaceToCandidateMaterials().filter((m) => m.material_id !== fromId);
  replaceMatToEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = list.length ? "— kies nieuw materiaal —" : "— kies eerst een rubriek hierboven —";
  replaceMatToEl.appendChild(ph);
  for (const m of list) {
    const opt = document.createElement("option");
    opt.value = m.material_id;
    opt.textContent = formatReplaceToOption(m);
    replaceMatToEl.appendChild(opt);
  }
  if (prev && list.some((m) => m.material_id === prev)) {
    replaceMatToEl.value = prev;
  }
}

/** When «Van» is gekozen: laad zelfde rubriek (+ subrubriek) zodat «Naar» vergelijkbare targets toont. */
async function ensureReplaceToCatalogForFrom(): Promise<void> {
  const fromId = (replaceMatFromEl?.value || "").trim();
  const usage = projectMaterialUsages?.find((u) => u.material_id === fromId);
  const master = (usage?.master_category || materialCategoryEl?.value || "").trim();
  let sub = (usage?.category || "").trim();
  if (!master || !auth()?.token) {
    fillReplaceToSelect();
    updateReplaceMaterialBtn();
    return;
  }
  try {
    await ensureMaterialCategories();
    if (materialCategoryEl && materialCategoryEl.value !== master) {
      if (![...materialCategoryEl.options].some((o) => o.value === master)) {
        const opt = document.createElement("option");
        opt.value = master;
        opt.textContent = master;
        materialCategoryEl.appendChild(opt);
      }
      materialCategoryEl.value = master;
      renderMaterialSubcategoryOptions();
    } else {
      renderMaterialSubcategoryOptions();
    }
    // Ontbrekende subrubriek: probeer via catalogus-id / naam (bijv. kozijn → Kozijnen).
    if (!sub && usage) {
      const q = (usage.catalog_id || usage.material_name || "").trim();
      if (q) {
        const probe = bppPhase1Enabled()
          ? await bppListMaterials(invokeString, auth()!.token, {
              master_category: master,
              q,
              limit: 20,
            })
          : await apiGet<{ materials: CatalogMaterial[] }>(
              `/api/floormap/materials?${new URLSearchParams({
                limit: "20",
                master_category: master,
                q,
              }).toString()}`,
            );
        const hit =
          (probe.materials || []).find((m) => m.material_id === fromId) ||
          (probe.materials || []).find(
            (m) => (m.catalog_id || "").trim() === (usage.catalog_id || "").trim(),
          );
        if (hit?.category) {
          sub = hit.category.trim();
          usage.category = sub;
        }
      }
    }
    if (materialSubcategoryEl) {
      if (sub) {
        if (![...materialSubcategoryEl.options].some((o) => o.value === sub)) {
          const opt = document.createElement("option");
          opt.value = sub;
          opt.textContent = sub;
          materialSubcategoryEl.appendChild(opt);
        }
        materialSubcategoryEl.value = sub;
      } else {
        materialSubcategoryEl.value = "";
      }
    }
    await loadMaterialsForCategory(master, "");
  } catch {
    /* keep whatever catalogMaterials we have */
  }
  fillReplaceToSelect();
  updateReplaceMaterialBtn();
}

function syncReplaceMaterialUi(): void {
  if (!replaceMatEl) return;
  const show = Boolean(activeSection && !isFloormapKind() && buildingId);
  replaceMatEl.classList.toggle("hidden", !show);
  if (!show) {
    if (replaceMatCb) replaceMatCb.checked = false;
    replaceMatControlsEl?.classList.add("hidden");
    if (replaceMatBtn) replaceMatBtn.disabled = true;
    return;
  }
  const open = Boolean(replaceMatCb?.checked);
  replaceMatControlsEl?.classList.toggle("hidden", !open);
  if (open && !projectMaterialUsages && !projectMaterialUsagesLoading) {
    void refreshProjectMaterialUsages(true);
  }
  if (!replaceMatFromEl) return;
  const prev = replaceMatFromEl.value;
  const usages = projectMaterialUsages || [];
  replaceMatFromEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = projectMaterialUsagesLoading
    ? "— laden… —"
    : usages.length
      ? "— kies te vervangen materiaal —"
      : "— nog geen materialen op gevels —";
  replaceMatFromEl.appendChild(ph);
  for (const u of usages) {
    const opt = document.createElement("option");
    opt.value = u.material_id;
    opt.textContent = materialUsageLabel(u);
    replaceMatFromEl.appendChild(opt);
  }
  if (prev && usages.some((u) => u.material_id === prev)) {
    replaceMatFromEl.value = prev;
  }
  fillReplaceToSelect();
  updateReplaceMaterialBtn();
}

function updateReplaceMaterialBtn(): void {
  if (!replaceMatBtn) return;
  const fromId = (replaceMatFromEl?.value || "").trim();
  const to = resolveReplaceToMaterial();
  const usage = projectMaterialUsages?.find((u) => u.material_id === fromId);
  const ok =
    Boolean(replaceMatCb?.checked) &&
    Boolean(fromId) &&
    Boolean(to?.material_id) &&
    Boolean(usage?.count) &&
    to!.material_id !== fromId;
  replaceMatBtn.disabled = !ok;
  if (replaceMatHintEl) {
    if (!fromId) {
      replaceMatHintEl.textContent =
        "Kies «Van» (huidig op gevels) en «Naar» (vervanging). Alle componenten met Van worden omgezet.";
    } else if (!to) {
      replaceMatHintEl.textContent = `«Van» geselecteerd (${usage?.count || 0}×). Kies hieronder «Naar».`;
    } else if (to.material_id === fromId) {
      replaceMatHintEl.textContent = "Van en Naar moeten verschillen.";
    } else {
      const fromLabel =
        [usage?.catalog_id, usage?.material_name].filter(Boolean).join(" · ") || fromId.slice(0, 8);
      const toLabel = [to.catalog_id, to.name].filter(Boolean).join(" · ") || to.name;
      replaceMatHintEl.textContent = `Vervangt ${usage?.count || 0}× «${fromLabel}» door «${toLabel}» op alle gevels in dit project.`;
    }
  }
  if (ok && usage) {
    replaceMatBtn.textContent = `Vervang ${usage.count}× in project`;
  } else {
    replaceMatBtn.textContent = "Vervangen…";
  }
}

function patchRoomMaterialLocal(roomId: string, mat: CatalogMaterial): void {
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;
  const prev =
    room.analysis && typeof room.analysis === "object"
      ? ({ ...room.analysis } as SubsectionAnalysis & { ra_dba?: number | null })
      : ({} as SubsectionAnalysis & { ra_dba?: number | null });
  room.analysis = {
    ...prev,
    material_id: mat.material_id,
    catalog_id: mat.catalog_id || prev.catalog_id,
    material_name: mat.name,
    master_category: mat.master_category || prev.master_category,
    category: mat.category || prev.category,
    rubriek_nr: mat.rubriek_nr ?? prev.rubriek_nr,
    ra_dba: mat.ra_dba ?? prev.ra_dba,
  } as SubsectionAnalysis;
  markRoomTouched(roomId);
}

function clearLocalRoomPatch(id: string): void {
  const sid = normRoomId(id);
  if (!sid) return;
  localRoomPatches.delete(sid);
  localRoomPatches.delete(id);
}

/** Update omschrijving als die nog de oude catalogusnaam/code bevat. */
function labelAfterMaterialSwap(
  label: string,
  fromCatalogId: string,
  fromName: string,
  to: CatalogMaterial,
): string {
  let out = (label || "").trim();
  if (!out) return out;
  const toCat = (to.catalog_id || "").trim();
  const toName = (to.name || "").trim();
  const fromCat = (fromCatalogId || "").trim();
  const fromMat = (fromName || "").trim();
  if (fromCat && toCat && out.includes(fromCat)) out = out.split(fromCat).join(toCat);
  if (fromMat && toName && out.includes(fromMat)) out = out.split(fromMat).join(toName);
  return out;
}

function applyMaterialSwapToRoom(
  room: RoomSubsection,
  to: CatalogMaterial,
  fromCatalogId: string,
  fromName: string,
): { room: RoomSubsection; labelChanged: boolean } {
  const prev =
    room.analysis && typeof room.analysis === "object"
      ? ({ ...room.analysis } as SubsectionAnalysis & { ra_dba?: number | null })
      : ({} as SubsectionAnalysis & { ra_dba?: number | null });
  const nextLabel = labelAfterMaterialSwap(room.label || "", fromCatalogId, fromName, to);
  const labelChanged = nextLabel !== (room.label || "").trim();
  const next: RoomSubsection = {
    ...room,
    label: labelChanged ? nextLabel : room.label,
    analysis: {
      ...prev,
      material_id: to.material_id,
      catalog_id: to.catalog_id || prev.catalog_id,
      material_name: to.name,
      master_category: to.master_category || prev.master_category,
      category: to.category || prev.category,
      rubriek_nr: to.rubriek_nr ?? prev.rubriek_nr,
      ra_dba: to.ra_dba ?? prev.ra_dba,
    } as SubsectionAnalysis,
  };
  return { room: next, labelChanged };
}

/**
 * Projectbreed: alle gevelcomponenten met materiaal A → materiaal B
 * (top-level analysis; kier-seal blijft onaangeroerd).
 */
async function replaceMaterialInProject(): Promise<void> {
  if (!auth()?.token || !buildingId) {
    setStatus("Geen project geladen", "err");
    return;
  }
  const fromId = (replaceMatFromEl?.value || "").trim();
  const to = resolveReplaceToMaterial();
  if (!fromId || !to) {
    setStatus("Kies «Van» en «Naar»", "err");
    return;
  }
  if (to.material_id === fromId) {
    setStatus("Van en Naar moeten verschillen", "err");
    return;
  }
  const usage = projectMaterialUsages?.find((u) => u.material_id === fromId);
  if (!usage?.subsection_ids.length) {
    setStatus("Geen componenten met dat materiaal gevonden", "err");
    return;
  }
  const fromLabel =
    [usage.catalog_id, usage.material_name].filter(Boolean).join(" · ") || fromId.slice(0, 8);
  const toLabel = [to.catalog_id, to.name].filter(Boolean).join(" · ") || to.name;
  const ok = window.confirm(
    `${usage.count} gevelcomponent(en) in dit project:\n\n` +
      `«${fromLabel}» → «${toLabel}»\n\n` +
      `Doorgaan? (kierdichting-kenmerk blijft ongewijzigd)`,
  );
  if (!ok) {
    setStatus("Vervangen geannuleerd", "err");
    return;
  }

  if (replaceMatBtn) replaceMatBtn.disabled = true;
  let done = 0;
  const failed: string[] = [];
  const replacedIds = new Set(usage.subsection_ids.map((id) => normRoomId(id)));
  try {
    for (let i = 0; i < usage.subsection_ids.length; i++) {
      const sid = usage.subsection_ids[i];
      setStatus(`Materiaal vervangen ${i + 1}/${usage.count}…`, "busy");
      try {
        if (bppPhase1Enabled()) {
          await bppSaveSubsectionMaterial(invokeString, auth()!.token, sid, to.material_id);
        } else {
          await apiPost("/api/floormap/subsection-material", {
            subsection_id: sid,
            material_id: to.material_id,
          });
        }
        clearLocalRoomPatch(sid);
        done += 1;
      } catch (err) {
        failed.push(`${sid.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Drop stale snapshot/patches so loadRooms niet het oude materiaal terugzet.
    if (activeSection) sectionRoomsSnapshot.delete(activeSection.id);
    for (const sid of usage.subsection_ids) clearLocalRoomPatch(sid);

    projectMaterialUsages = null;
    if (activeSection && !isFloormapKind()) {
      try {
        await loadRooms({ preserveOrder: true });
      } catch {
        /* apply in-memory below */
      }
    }

    // Forceer verse analysis + label in de huidige lijst (ook bij trage serverlijst).
    const mpu = activeScaleMpu();
    const aspect = activeScaleAspect();
    const labelChangedIds = new Set<string>();
    rooms = rooms.map((r) => {
      if (!replacedIds.has(normRoomId(r.id))) return r;
      const { room: next, labelChanged } = applyMaterialSwapToRoom(
        r,
        to,
        usage.catalog_id,
        usage.material_name,
      );
      if (labelChanged) labelChangedIds.add(normRoomId(next.id));
      noteLocalRoomPatch(next);
      markRoomTouched(next.id);
      return next;
    });

    // Persist labels die de oude materiaalnaam droegen (anders komt die terug bij herladen).
    if (labelChangedIds.size > 0 && activeSection && auth()?.token) {
      setStatus(`Labels bijwerken (${labelChangedIds.size})…`, "busy");
      for (const r of rooms) {
        if (!labelChangedIds.has(normRoomId(r.id))) continue;
        const holes = Array.isArray(r.analysis?.holes)
          ? r.analysis!.holes!.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
          : [];
        try {
          await saveDrawingSubsection({
            section_id: activeSection.id,
            subsection_id: r.id,
            label: r.label,
            level_hint: r.level_hint || "OTHER",
            vg_nr: r.vg_nr,
            vr_nr: r.vr_nr,
            points: r.points,
            holes,
            metres_per_norm_unit: mpu ?? undefined,
            scale_aspect_yx: aspect,
            analysis: r.analysis || undefined,
          });
        } catch {
          /* analysis al gezet via SaveSubsectionMaterial */
        }
      }
    }

    renderRoomList();
    drawOverlay();
    await refreshProjectMaterialUsages(true);
    if (replaceMatCb) replaceMatCb.checked = false;
    syncReplaceMaterialUi();
    if (failed.length) {
      setStatus(
        `${done} vervangen, ${failed.length} mislukt (${failed.slice(0, 2).join("; ")}${failed.length > 2 ? "…" : ""})`,
        "err",
      );
    } else {
      setStatus(
        `${done} component(en): «${fromLabel}» → «${toLabel}»` +
          (labelChangedIds.size ? ` · ${labelChangedIds.size} label(s) bijgewerkt` : ""),
        "ok",
      );
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncReplaceMaterialUi();
  }
}

/** Persist materiaal op één component (zonder UI-feedback). */
async function applyMaterialToComponentId(componentId: string, mat: CatalogMaterial): Promise<void> {
  if (!componentId || !auth()?.token) return;
  if (bppPhase1Enabled()) {
    await bppSaveSubsectionMaterial(invokeString, auth()!.token, componentId, mat.material_id);
  } else {
    await apiPost("/api/floormap/subsection-material", {
      subsection_id: componentId,
      material_id: mat.material_id,
    });
  }
  const room = rooms.find((r) => r.id === componentId);
  if (room) {
    const prev = room.analysis && typeof room.analysis === "object" ? { ...room.analysis } : {};
    room.analysis = {
      ...prev,
      material_id: mat.material_id,
      catalog_id: mat.catalog_id || prev.catalog_id,
      material_name: mat.name,
      master_category: mat.master_category || prev.master_category,
      category: mat.category || prev.category,
      rubriek_nr: mat.rubriek_nr ?? prev.rubriek_nr,
      ra_dba: mat.ra_dba ?? prev.ra_dba,
    };
  }
  markRoomTouched(componentId);
  // Verwerkingsregel 2 — alleen bij stap 3 (assign) of expliciete kozijn-toewijzing.
  if (sidebarWorkMode === "assign" || isKozijnFrameMaterial(mat)) {
    try {
      await applyRegel2KozijnSeal(componentId, mat);
    } catch (err) {
      console.warn("regel 2 kierdichting mislukt", err);
    }
  }
}

/** Favorite/cataloguskeuze tijdens bewerken: materiaal direct op het component zetten. */
async function applyMaterialToEditingComponent(mat: CatalogMaterial): Promise<void> {
  const editingId = pendingRoom?.editingId || "";
  if (!editingId || isFloormapKind() || !auth()?.token) {
    setStatus(`Materiaal «${mat.name}» geselecteerd`, "ok");
    return;
  }
  try {
    await applyMaterialToComponentId(editingId, mat);
    renderRoomList();
    drawOverlay();
    const room = rooms.find((r) => r.id === editingId);
    const missing = room ? composeConstituentsMissingMaterial(room, rooms) : [];
    setStatus(
      missing.length
        ? `Materiaal «${mat.name}» toegepast — led blijft oranje tot bronnen materiaal hebben: ${missing.map((s) => s.label || "?").join(", ")}`
        : `Materiaal «${mat.name}» toegepast op component`,
      "ok",
    );
  } catch (err) {
    setStatus(
      `Materiaal geselecteerd — opslaan mislukt: ${err instanceof Error ? err.message : String(err)}`,
      "err",
    );
  }
}

/**
 * Modus «Materiaal koppelen»: picklist → multi-select.
 * Virgin (geen materiaal) = direct; vervanging = één bevestiging.
 */
async function assignPicklistMaterialToSelection(): Promise<void> {
  const matId = (assignPicklistEl?.value || "").trim();
  const mat = favoriteMaterials.find((m) => m.material_id === matId);
  const ids = [...selectedAssignIds];
  if (!mat) {
    setStatus("Kies eerst een materiaal uit de project-picklist", "err");
    return;
  }
  if (!ids.length) {
    setStatus("Selecteer één of meer componenten in de lijst", "err");
    return;
  }
  if (!auth()?.token) {
    setStatus("Niet ingelogd", "err");
    return;
  }

  const replaceIds: string[] = [];
  const virginIds: string[] = [];
  const sameIds: string[] = [];
  for (const id of ids) {
    const room = rooms.find((r) => r.id === id);
    const cur = (room?.analysis?.material_id || "").trim();
    if (!cur) virginIds.push(id);
    else if (cur === mat.material_id) sameIds.push(id);
    else replaceIds.push(id);
  }

  if (replaceIds.length) {
    const labels = replaceIds
      .map((id) => {
        const r = rooms.find((x) => x.id === id);
        const old = materialAnalysisLabel(r?.analysis, { skipOp: true }) || "ander materiaal";
        return `• ${r?.label || id.slice(0, 8)} (${old})`;
      })
      .slice(0, 8)
      .join("\n");
    const more = replaceIds.length > 8 ? `\n… +${replaceIds.length - 8} meer` : "";
    const ok = window.confirm(
      `${replaceIds.length} component(en) hebben al een materiaal.\nVervangen door «${mat.name}»?\n\n${labels}${more}`,
    );
    if (!ok) {
      setStatus("Vervanging geannuleerd", "ok");
      return;
    }
  }

  const applyIds = [...virginIds, ...replaceIds];
  if (!applyIds.length) {
    setStatus(
      sameIds.length
        ? `Alle geselecteerde componenten hebben al «${mat.name}»`
        : "Niets toe te wijzen",
      "ok",
    );
    return;
  }

  assignMatBtn && (assignMatBtn.disabled = true);
  try {
    let sealCount = 0;
    for (const id of applyIds) {
      await applyMaterialToComponentId(id, mat);
      if (componentSealEnabled(rooms.find((r) => r.id === id)?.analysis)) sealCount += 1;
    }
    selectedAssignIds.clear();
    renderRoomList();
    drawOverlay();
    syncAssignSelectionHint();
    const bits = [
      virginIds.length ? `${virginIds.length} nieuw` : "",
      replaceIds.length ? `${replaceIds.length} vervangen` : "",
      sameIds.length ? `${sameIds.length} ongewijzigd` : "",
      sealCount && isKozijnFrameMaterial(mat)
        ? `${sealCount}× kier (regel 2)`
        : "",
    ].filter(Boolean);
    setStatus(`«${mat.name}» toegewezen (${bits.join(" · ")})`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    syncAssignSelectionHint();
  }
}

async function ensureMaterialCategories(): Promise<void> {
  if (!auth()?.token || !materialCategoryEl) return;
  if (materialCategoriesLoaded && materialCategoryEl.options.length > 1) return;
  try {
    const data = bppPhase1Enabled()
      ? await bppListMaterialCategories(invokeString, auth()!.token)
      : await apiGet<{
          categories: MaterialCategoryOpt[];
        }>("/api/floormap/material-categories");
    renderMaterialCategoryOptions((data.categories || []) as MaterialCategoryOpt[]);
    materialCategoriesLoaded = true;
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

async function loadMaterialsForCategory(category: string, q = ""): Promise<void> {
  if (!auth()?.token || !materialIdEl) return;
  const keep = materialIdEl.value;
  if (!category) {
    catalogMaterials = [];
    renderMaterialNameOptions([]);
    materialIdEl.disabled = true;
    updateMaterialSpectrumPreview(null);
    return;
  }
  materialIdEl.disabled = true;
  try {
    const sub = (materialSubcategoryEl?.value || "").trim();
    const data = bppPhase1Enabled()
      ? await bppListMaterials(invokeString, auth()!.token, {
          master_category: category,
          category: sub || undefined,
          q: q.trim() || undefined,
          limit: 1000,
        })
      : await apiGet<{ materials: CatalogMaterial[] }>(
          `/api/floormap/materials?${new URLSearchParams({
            limit: "1000",
            master_category: category,
            ...(sub ? { category: sub } : {}),
            ...(q.trim() ? { q: q.trim() } : {}),
          }).toString()}`,
        );
    catalogMaterials = (data.materials || []) as CatalogMaterial[];
    renderMaterialNameOptions(catalogMaterials, keep);
    updateMaterialSpectrumPreview();
    if (replaceMatCb?.checked) {
      fillReplaceToSelect();
      updateReplaceMaterialBtn();
    }
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
  if (!activeSection || !auth() || isFloormapKind()) return;
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
  // Stap 4: materiaal/ori/VG/VR van de bronnen (stap 2–3), geen aparte invoer.
  await defaultMaterialFromDifferenceSubject();
  let mat =
    catalogMaterialFromAnalysis(differenceSubject(selected)?.analysis) ||
    selectedCatalogMaterial();
  if (!mat) {
    const msg =
      "Geen materiaal op de +bron — koppel materiaal in modus 3 aan het component dat je meeneemt (+)";
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
    if (vgVr.vg_nr == null || !normalizeVrNr(vgVr.vr_nr)) {
      const msg =
        "Samengesteld component heeft VG/VR nodig — ken die toe aan de bronnen of vul VG/VR in het formulier in";
      setComposeFeedback(msg, "err");
      setStatus(msg, "err");
      return;
    }
    const composeOri =
      readComponentOrientatie() ||
      normalizeOrientatieCode(outer.analysis?.orientatie || "") ||
      "";
    if (!composeOri || !(ORIENTATIE_CODES as readonly string[]).includes(composeOri)) {
      const msg =
        "Geen oriëntatie op de buitencontour — zet geveloriëntatie in modus 2 op het +component";
      setComposeFeedback(msg, "err");
      setStatus(msg, "err");
      return;
    }
    const composeGg = resolveComposeGevelgroepNr(selected, outer);
    const composeAnalysis: SubsectionAnalysis = {
      material_id: mat.material_id,
      master_category: mat.master_category,
      material_name: mat.name,
      catalog_id: mat.catalog_id,
      category: mat.category || undefined,
      orientatie: composeOri,
      boolean_op: "compose",
      outer_subsection_id: outer.id,
      constituent_signs: signs,
      source_subsection_ids: selected.map((r) => r.id),
      source_labels: nameParts,
      holes: result.holes,
      area_norm: result.areaNorm,
      area_m2: areaM2 ?? undefined,
      ...(composeGg > 1 ? { gevelgroep_nr: composeGg } : {}),
    };
    const saved = await saveDrawingSubsection({
      section_id: activeSection.id,
      label,
      level_hint: "OTHER",
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points: result.outer,
      holes: result.holes,
      metres_per_norm_unit: mpu ?? undefined,
      scale_aspect_yx: activeScaleAspect(),
      analysis: composeAnalysis,
    });
    const savedId = saved.subsection_id;
    const savedVg =
      saved.vg_nr != null && Number.isFinite(Number(saved.vg_nr))
        ? Number(saved.vg_nr)
        : vgVr.vg_nr;
    const savedVr =
      saved.vr_nr != null && String(saved.vr_nr).trim()
        ? String(saved.vr_nr).trim()
        : vgVr.vr_nr;
    const patched: RoomSubsection = {
      id: savedId,
      section_id: activeSection.id,
      label,
      level_hint: "OTHER",
      vg_nr: savedVg,
      vr_nr: savedVr,
      points: result.outer.map((p) => ({ ...p })),
      area_m2: saved.area_m2 != null ? Number(saved.area_m2) : areaM2,
      area_norm: saved.area_norm != null ? Number(saved.area_norm) : result.areaNorm,
      perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
      perimeter_norm: null,
      metres_per_norm_unit: mpu,
      analysis_status: "ok",
      sort_order: rooms.length,
      analysis: {
        ...composeAnalysis,
        holes: result.holes.map((h) => h.map((p) => ({ ...p }))),
        ...(saved.analysis || {}),
        ...(composeGg > 1 ? { gevelgroep_nr: composeGg } : {}),
        orientatie: composeOri,
        boolean_op: "compose",
      },
    };
    rooms = [...rooms.filter((r) => r.id !== savedId), patched];
    noteLocalRoomPatch(patched);
    // Drop in-flight lists that would overwrite this insert with a stale reply.
    roomsLoadEpoch += 1;
    booleanPreview = null;
    selectedSetIds.clear();
    constituentSigns.clear();
    // Toon meteen onder de geërfde VR · gevelgroep (anders verdwijnt ± bij filter groep 2).
    const inheritVr = normalizeVrNr(savedVr)!;
    roomListVrFilter = inheritVr;
    roomListGroepFilter = composeGg > 1 ? String(composeGg) : roomListGroepFilter || "";
    roomVgInput.value = savedVg != null ? String(savedVg) : "";
    roomVrInput.value = inheritVr;
    renderRoomList();
    drawOverlay();
    try {
      await loadRooms({ preserveOrder: true });
    } catch (reloadErr) {
      console.warn("loadRooms after compose failed", reloadErr);
    }
    // Re-assert after reload (stale list must not hide the new ± result).
    {
      const i = rooms.findIndex((r) => r.id === savedId);
      if (i < 0) {
        rooms = [...rooms, patched];
      } else {
        rooms[i] = {
          ...rooms[i],
          ...patched,
          analysis: {
            ...(rooms[i].analysis || {}),
            ...(patched.analysis || {}),
            ...(composeGg > 1 ? { gevelgroep_nr: composeGg } : {}),
          },
        };
      }
      noteLocalRoomPatch(rooms.find((r) => r.id === savedId)!);
    }
    roomListVrFilter = inheritVr;
    if (composeGg > 1) roomListGroepFilter = String(composeGg);
    if (roomVrFilterEl) {
      if (![...roomVrFilterEl.options].some((o) => o.value === inheritVr)) {
        const opt = document.createElement("option");
        opt.value = inheritVr;
        opt.textContent = `VR ${inheritVr}`;
        roomVrFilterEl.appendChild(opt);
      }
      roomVrFilterEl.value = inheritVr;
    }
    renderRoomList();
    drawOverlay();
    updateBooleanPreview();
    markRoomTouched(savedId);
    const listEl = resolveRoomListEl();
    if (listEl) scrollActiveRoomListItemIntoView(listEl, savedId);
    const savedM2 = saved.area_m2 != null ? Number(saved.area_m2) : areaM2;
    const orangeParts = selected.filter((r) => !(r.analysis?.material_id || "").trim());
    const orangeBit = orangeParts.length
      ? ` Led blijft oranje tot bronnen materiaal hebben: ${orangeParts.map((r) => r.label || "?").join(", ")}.`
      : "";
    const okMsg =
      savedM2 != null
        ? `Opgeslagen: ${label} (netto ${savedM2.toFixed(2)} m²) · VR ${inheritVr}.${orangeBit}`
        : `Opgeslagen: ${label} · VR ${inheritVr}.${orangeBit}`;
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

function resolveRoomListEl(): HTMLUListElement | null {
  const live = document.getElementById("fm-room-list") as HTMLUListElement | null;
  if (live) return live;
  return roomListEl && document.body.contains(roomListEl) ? roomListEl : null;
}

function resolveRoomCountEl(): HTMLElement | null {
  const live = document.getElementById("fm-room-count") as HTMLElement | null;
  if (live) return live;
  return roomCountEl && document.body.contains(roomCountEl) ? roomCountEl : null;
}

function renderRoomList(): void {
  const listEl = resolveRoomListEl();
  const countEl = resolveRoomCountEl();
  if (!listEl) return;
  const listScroller = resolveRoomListScrollParent(listEl);
  const scrollTop = listScroller.scrollTop;
  const items = rooms.filter(
    (r): r is RoomSubsection =>
      Boolean(r?.id) && !isLocallyDeleted(r.id) && !isLegacySealSibling(r.analysis),
  );
  if (items.length !== rooms.length) {
    rooms = items;
  }
  const allowSetSelect = !isFloormapKind() && sidebarWorkMode === "compose";
  const allowAssignSelect = !isFloormapKind() && sidebarWorkMode === "assign";
  listEl.replaceChildren();
  syncRoomListVrFilterOptions(items);
  const topLevelTotal = items.length;
  const visibleTopLevel = visibleTopLevelRooms(items);
  if (countEl) {
    countEl.textContent = roomListCountLabel(visibleTopLevel.length, topLevelTotal);
    const filterBits: string[] = [];
    if (roomListVrFilter) filterBits.push(`VR ${roomListVrFilter}`);
    if (roomListGroepFilter) filterBits.push(`groep ${roomListGroepFilter}`);
    countEl.title =
      filterBits.length && visibleTopLevel.length !== topLevelTotal
        ? `${visibleTopLevel.length} van ${topLevelTotal} zichtbaar (filter ${filterBits.join(" · ")})`
        : "";
  }
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "hint drawing-list-empty";
    li.textContent = `Nog geen ${activePartNoun().plural} — Teken ${activePartNoun().singular} of Ontdek.`;
    listEl.appendChild(li);
    return;
  }
  if (visibleTopLevel.length === 0) {
    const li = document.createElement("li");
    li.className = "hint drawing-list-empty";
    const bits: string[] = [];
    if (roomListVrFilter) bits.push(`VR ${roomListVrFilter}`);
    if (roomListGroepFilter) bits.push(`groep ${roomListGroepFilter}`);
    li.textContent = bits.length
      ? `Geen ${activePartNoun().plural} voor ${bits.join(" · ")}.`
      : `Geen ${activePartNoun().plural} zichtbaar.`;
    listEl.appendChild(li);
    return;
  }
  let booleanSourceIds = new Set<string>();
  let supersededIds = new Set<string>();
  let boolGroups = new Map<string, BoolListRole>();
  try {
    if (allowSetSelect) {
      booleanSourceIds = collectBooleanSourceIds(items);
      supersededIds = collectSupersededSourceIds(items);
      boolGroups = assignBooleanListGroups(items);
    }
  } catch (err) {
    console.warn("renderRoomList: boolean metadata failed", err);
  }
  for (const id of [...expandedComposeSourcePanels]) {
    const still = items.some((r) => r.id === id && isComposeResultRoom(r));
    if (!still) expandedComposeSourcePanels.delete(id);
  }
  items.forEach((r, index) => {
    if (!roomMatchesListFilters(r)) return;
    try {
      renderRoomListItem(listEl, r, index, items.length, {
        allowSetSelect,
        allowAssignSelect,
        booleanSourceIds,
        supersededIds,
        boolGroups,
        allItems: items,
      });
    } catch (err) {
      console.warn("renderRoomList: item failed", r.id, err);
      const fallback = document.createElement("li");
      fallback.className = "drawing-list-item";
      fallback.textContent = r.label || r.id;
      listEl.appendChild(fallback);
    }
  });
  if (pendingRoom?.editingId && !roomListRefreshQuiet) {
    // Keep the active (red) component row in view; ignore prior scroll restore.
    scrollActiveRoomListItemIntoView(listEl, pendingRoom.editingId);
  } else {
    listScroller.scrollTop = scrollTop;
  }
}

/** Sidebar (of de lijst zelf) is de scroller — niet een krappe geneste list-viewport. */
function resolveRoomListScrollParent(listEl: HTMLElement): HTMLElement {
  return (listEl.closest(".engineer-sidebar") as HTMLElement | null) || listEl;
}

/** Ensure the currently edited component stays visible in the saved-components list. */
function scrollActiveRoomListItemIntoView(listEl: HTMLUListElement, roomId: string): void {
  const run = (): void => {
    const li =
      (listEl.querySelector(
        `.drawing-list-item[data-room-id="${CSS.escape(roomId)}"]`,
      ) as HTMLElement | null) ||
      (listEl.querySelector(".drawing-list-item.selected") as HTMLElement | null);
    if (!li) return;
    // Scroll de rechterkolom — nooit li.scrollIntoView (dat springt de pagina/PDF).
    const scroller = resolveRoomListScrollParent(listEl);
    const scrollerRect = scroller.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const viewTop = scroller.scrollTop;
    const liTop = viewTop + (liRect.top - scrollerRect.top);
    const liBottom = liTop + liRect.height;
    const viewBottom = viewTop + scroller.clientHeight;
    const pad = 8;
    if (liTop < viewTop + pad) {
      scroller.scrollTop = Math.max(0, liTop - pad);
    } else if (liBottom > viewBottom - pad) {
      scroller.scrollTop = Math.max(0, liBottom - scroller.clientHeight + pad);
    }
  };
  // After DOM replace + layout; double-rAF covers sticky sidebar measure.
  requestAnimationFrame(() => requestAnimationFrame(run));
}

function renderRoomListItem(
  listEl: HTMLUListElement,
  r: RoomSubsection,
  index: number,
  total: number,
  meta: {
    allowSetSelect: boolean;
    allowAssignSelect: boolean;
    booleanSourceIds: Set<string>;
    supersededIds: Set<string>;
    boolGroups: Map<string, BoolListRole>;
    allItems: RoomSubsection[];
  },
): void {
  const { allowSetSelect, allowAssignSelect, booleanSourceIds, supersededIds, boolGroups, allItems } =
    meta;
    const li = document.createElement("li");
    li.className = "drawing-list-item room-list-sortable";
    li.dataset.roomId = r.id;
    if (allowSetSelect) li.classList.add("drawing-list-item--set");
    if (pendingRoom?.editingId === r.id) li.classList.add("selected");
    if (touchedRoomIds.has(normRoomId(r.id))) li.classList.add("drawing-list-item--touched");
    if (allowSetSelect && selectedSetIds.has(r.id)) li.classList.add("set-selected");
    if (allowAssignSelect && selectedAssignIds.has(r.id)) {
      li.classList.add("drawing-list-item--assign-sel");
    }
    if (allowSetSelect && booleanSourceIds.has(r.id)) li.classList.add("drawing-list-item--ga-source");
    const boolRole = boolGroups.get(r.id);
    if (boolRole) applyBooleanListColors(li, boolRole);
    const boolOp = parseBooleanOp(r.analysis?.boolean_op);
    if (boolOp === "compose" || boolOp === "difference") {
      li.classList.add("drawing-list-item--composed");
    }
    // Groene markering: origineel dat deel uitmaakt van een ±-compositie (blijft top-level).
    if (allowSetSelect && booleanSourceIds.has(r.id) && !isComposeResultRoom(r)) {
      li.classList.add("drawing-list-item--compose-source");
    }

    // Zelfde sleep-handle als engineer sectielijst (⋮⋮); alleen via handle draggable.
    const dragHandle = document.createElement("span");
    dragHandle.className = "region-drag-handle";
    dragHandle.title = "Verslepen om volgorde te wijzigen";
    dragHandle.setAttribute("aria-hidden", "true");
    dragHandle.textContent = "⋮⋮";
    dragHandle.addEventListener("mousedown", () => {
      li.draggable = true;
    });
    li.appendChild(dragHandle);

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
        syncPendingRoomButtons();
        syncToolButtons();
        if (pendingRoom?.editingId === r.id) syncKierSuggestUi();
      });
      li.appendChild(cb);
    } else if (allowAssignSelect) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "assign-select-cb";
      cb.checked = selectedAssignIds.has(r.id);
      cb.title = "Selecteer voor materiaal toewijzen";
      cb.addEventListener("change", () => {
        if (cb.checked) selectedAssignIds.add(r.id);
        else selectedAssignIds.delete(r.id);
        syncAssignSelectionHint();
        renderRoomList();
      });
      li.appendChild(cb);
    }

    const info = document.createElement("button");
    info.type = "button";
    info.className = "drawing-list-select";
    const linked = linkedRooms.get(r.id);
    const hasMaterial = Boolean((r.analysis?.material_id || "").trim());
    const missingSources = isComposeResultRoom(r)
      ? composeConstituentsMissingMaterial(r, allItems)
      : [];
    const hasVg =
      r.vg_nr != null && Number.isFinite(Number(r.vg_nr)) && Number(r.vg_nr) > 0;
    const hasVr = Boolean(normalizeVrNr(r.vr_nr));
    const hasVgVr = hasVg && hasVr;
    const oriCodes = Array.isArray(r.analysis?.expected_orientaties)
      ? r.analysis!.expected_orientaties!
          .map((c) => normalizeOrientatieCode(c))
          .filter((c) => (ORIENTATIE_CODES as readonly string[]).includes(c))
      : [];
    const compOri = normalizeOrientatieCode(r.analysis?.orientatie || "");
    const compOriOk = (ORIENTATIE_CODES as readonly string[]).includes(compOri);
    const onGevel = !isFloormapKind();
    const groepOverStotaal = onGevel && compOriOk && gevelGroepOverStotaalForRoom(r);
    // Gevel: groen = materiaal + oriëntatie; oranje als ori ontbreekt of oppervlakte > Stotaal (ori·groep).
    const ledGreen =
      hasMaterial &&
      missingSources.length === 0 &&
      (!onGevel || (compOriOk && !groepOverStotaal));
    const oriBit =
      isFloormapKind()
        ? oriCodes.length
          ? `ori ${oriCodes.join(",")}`
          : "ori ontbreekt"
        : "";
    const isComposed = boolOp === "compose" || boolOp === "difference";
    const matBit = materialAnalysisLabel(r.analysis, { skipOp: isComposed });
    let gaBit = "";
    if (allowSetSelect) {
      if (supersededIds.has(r.id)) {
        gaBit = " · bron van ± (zelfde materiaal → netto)";
      } else if (booleanSourceIds.has(r.id)) {
        gaBit = " · bron van ±";
      } else if (missingSources.length) {
        gaBit = ` · bronnen zonder materiaal: ${missingSources.map((s) => s.label || "?").join(", ")}`;
      } else if (hasVr && hasMaterial && !compOriOk) {
        gaBit = " · berekening: nog oriëntatie kiezen";
      } else if (hasVr && hasMaterial) {
        gaBit = " · in berekening";
      } else if (hasVr) {
        gaBit = " · berekening: nog materiaal toevoegen";
      }
    }
    const linkBit =
      activeSection?.region_kind === "FLOORMAP" && linked
        ? ` · berekening: ${linked}`
        : activeSection?.region_kind === "FLOORMAP"
          ? " · niet in berekening"
          : "";
    const parts = [
      roomListDisplayLabel(r),
      repeatCountBit(r.analysis),
      matBit,
      // Oriëntatie staat apart als badge (floormap); niet ook in de tekstregel.
      isFloormapKind() ? "" : oriBit,
      levelLabel(r.level_hint),
      roomMetricsLabel(r),
    ].filter(Boolean);

    // Inner wrapper: flex/grid on <button> is unreliable in WebKit — children (VG/VR) can vanish.
    const inner = document.createElement("span");
    inner.className = "drawing-list-select-inner";

    const metaRow = document.createElement("span");
    metaRow.className = "drawing-list-meta";

    if (isComposed) {
      const composedBadge = document.createElement("span");
      composedBadge.className = "drawing-list-composed-badge";
      composedBadge.textContent = "± samengesteld";
      composedBadge.title = "Netto-resultaat van +/− compositie";
      metaRow.appendChild(composedBadge);
    }

    const vgVrBadge = document.createElement("span");
    vgVrBadge.className = hasVgVr
      ? "drawing-list-vgvr"
      : "drawing-list-vgvr drawing-list-vgvr--missing";
    if (hasVgVr) {
      vgVrBadge.textContent = formatVrVgLabel(normalizeVrNr(r.vr_nr), r.vg_nr);
    } else if (hasVg || hasVr) {
      vgVrBadge.textContent = formatVrVgLabel(
        hasVr ? normalizeVrNr(r.vr_nr) : null,
        hasVg ? r.vg_nr : null,
      );
      vgVrBadge.classList.add("drawing-list-vgvr--partial");
    } else {
      vgVrBadge.textContent = "geen VG/VR";
    }
    metaRow.appendChild(vgVrBadge);

    if (isFloormapKind()) {
      const oriBadge = document.createElement("span");
      oriBadge.className = oriCodes.length
        ? "drawing-list-ori"
        : "drawing-list-ori drawing-list-ori--missing";
      oriBadge.textContent = oriCodes.length ? `ori ${oriCodes.join(",")}` : "ori ontbreekt";
      oriBadge.title = "Klik de regel om geveloriëntaties te bewerken (bovenaan in de zijbalk)";
      metaRow.appendChild(oriBadge);
    } else if (allowSetSelect) {
      const oriBadge = document.createElement("span");
      oriBadge.className = compOriOk
        ? "drawing-list-ori"
        : "drawing-list-ori drawing-list-ori--missing";
      oriBadge.textContent = compOriOk ? `ori ${compOri}` : "ori ontbreekt";
      oriBadge.title = compOriOk
        ? "Geveloriëntatie van dit component"
        : "Kies geveloriëntatie bovenaan in de zijbalk";
      metaRow.appendChild(oriBadge);

      const ggNr = readGevelgroepNr(r.analysis);
      const ggWrap = document.createElement("label");
      ggWrap.className =
        ggNr > 1 ? "drawing-list-gevelgroep is-extra" : "drawing-list-gevelgroep";
      ggWrap.title =
        "Gevelgroep binnen deze oriëntatie. Leeg/1 = standaard. Zet 2 (of 3) voor bel-etage e.d. met andere CL — in GA kies je die groep en zie je alleen deze componenten.";
      const ggLab = document.createElement("span");
      ggLab.className = "drawing-list-gevelgroep-lab";
      ggLab.textContent = "groep";
      const ggSel = document.createElement("select");
      ggSel.className = "drawing-list-gevelgroep-sel";
      ggSel.setAttribute("aria-label", `Gevelgroep ${r.label || ""}`);
      for (const optN of [1, 2, 3] as const) {
        const o = document.createElement("option");
        o.value = String(optN);
        o.textContent = String(optN);
        if (optN === ggNr) o.selected = true;
        ggSel.appendChild(o);
      }
      ggSel.addEventListener("click", (ev) => ev.stopPropagation());
      ggSel.addEventListener("change", (ev) => {
        ev.stopPropagation();
        void saveGevelgroepNrForRoom(r, Number(ggSel.value) || 1);
      });
      ggWrap.appendChild(ggLab);
      ggWrap.appendChild(ggSel);
      metaRow.appendChild(ggWrap);
    }
    if (allowSetSelect) {
      // Not the scale/kalibratie-LED — that lives next to «Schaal kalibreren».
      const led = document.createElement("span");
      led.className = "ga-ready-led";
      led.setAttribute("role", "status");
      if (ledGreen) {
        led.classList.add("is-on");
        led.title = "Materiaal + oriëntatie — kiesbaar in GA";
        led.setAttribute("aria-label", "Compleet voor GA");
      } else {
        led.classList.add("is-warn");
        led.title = groepOverStotaal
          ? `Oppervlakte op de tekening > 100% Stotaal voor ori ${compOri} · groep ${readGevelgroepNr(r.analysis)} — hiërarchie gevel ⊃ kozijn ⊃ ruit klopt niet (of muurdelen moeten samengevoegd)`
          : missingSources.length
          ? `Samengesteld component blijft oranje tot bronnen materiaal hebben: ${missingSources.map((s) => s.label || "?").join(", ")}`
          : !hasMaterial
            ? "Nog geen materiaal — koppel later voor vlakdelen"
            : allowSetSelect && !compOriOk
              ? "Nog geen geveloriëntatie — kies N…NW bovenaan; zonder ori niet kiesbaar in GA"
              : "Nog onvolledig voor GA";
        led.setAttribute(
          "aria-label",
          groepOverStotaal
            ? "Oppervlakte tekening boven Stotaal"
            : missingSources.length
              ? "Nog oranje bronnen zonder materiaal"
              : !hasMaterial
                ? "Nog geen materiaal"
                : allowSetSelect && !compOriOk
                  ? "Nog geen oriëntatie"
                  : "Nog onvolledig",
        );
      }
      metaRow.appendChild(led);
    }
    inner.appendChild(metaRow);

    const labelSpan = document.createElement("span");
    labelSpan.className = "drawing-list-select-label";
    labelSpan.textContent = `${parts.join(" · ")}${gaBit}${linkBit}`;
    inner.appendChild(labelSpan);
    info.appendChild(inner);
    info.title = missingSources.length
      ? `Samengesteld component: eerst materiaal op bronnen (${missingSources.map((s) => s.label || "?").join(", ")})`
      : boolOp === "compose" || boolOp === "difference"
      ? "Samengesteld component (+/−) — netto uit geselecteerde delen; Bronnen verwijst naar de originelen in de lijst"
      : booleanSourceIds.has(r.id)
      ? (() => {
          const parents = composeParentsOfSource(r.id, allItems);
          const names = parents.map((p) => p.label || "±").join(", ");
          return names
            ? `Bron van samengesteld component: ${names} (blijft in de lijst, kiesbaar voor vlaktoekenning)`
            : "Bron van een setbewerking — blijft in de lijst en kiesbaar voor vlaktoekenning";
        })()
      : allowSetSelect && !hasMaterial
          ? "Nog geen materiaal (oranje) — klik om te bewerken of materiaal te koppelen"
          : "Klik om geometrie te bewerken";
    info.addEventListener("click", () => editRoom(r));
    li.appendChild(info);

    const actions = document.createElement("span");
    actions.className = "drawing-list-actions";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "secondary drawing-list-move drawing-list-move-icon";
    upBtn.textContent = "▲";
    upBtn.setAttribute("aria-label", "Verplaats omhoog in de lijst");
    upBtn.title = "Omhoog";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void moveRoom(r.id, -1);
    });
    actions.appendChild(upBtn);

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "secondary drawing-list-move drawing-list-move-icon";
    downBtn.textContent = "▼";
    downBtn.setAttribute("aria-label", "Verplaats omlaag in de lijst");
    downBtn.title = "Omlaag";
    downBtn.disabled = index >= total - 1;
    downBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void moveRoom(r.id, 1);
    });
    actions.appendChild(downBtn);

    // GA-herhaling: zelfde tekening ×N zonder extra lijstrijen.
    if (allowSetSelect && !isLegacySealSibling(r.analysis)) {
      const n = readRepeatCount(r.analysis);
      const wrap = document.createElement("span");
      wrap.className = "drawing-list-repeat";
      wrap.title =
        "Hoe vaak dit component meetelt in de GA-berekening (oppervlak/lengte/kier). Lijst blijft één regel.";
      const dec = document.createElement("button");
      dec.type = "button";
      dec.className = "secondary drawing-list-repeat-btn";
      dec.textContent = "−";
      dec.setAttribute("aria-label", "Minder herhalingen");
      dec.disabled = n <= 1;
      dec.addEventListener("click", (ev) => {
        ev.stopPropagation();
        void saveRepeatCountForRoom(r, n - 1);
      });
      const mid = document.createElement("span");
      mid.className = "drawing-list-repeat-val";
      mid.textContent = `${n}×`;
      mid.setAttribute("aria-label", `Herhaling ${n} keer`);
      const inc = document.createElement("button");
      inc.type = "button";
      inc.className = "secondary drawing-list-repeat-btn";
      inc.textContent = "+";
      inc.setAttribute("aria-label", "Meer herhalingen");
      inc.disabled = n >= REPEAT_COUNT_MAX;
      inc.addEventListener("click", (ev) => {
        ev.stopPropagation();
        void saveRepeatCountForRoom(r, n + 1);
      });
      wrap.appendChild(dec);
      wrap.appendChild(mid);
      wrap.appendChild(inc);
      actions.appendChild(wrap);
    }

    if (activeSection?.region_kind === "FLOORMAP" && buildingId) {
      const ga = document.createElement("a");
      ga.className = "secondary-link";
      if (linked) {
        // Stap 3 op de geveltekening (niet GA-vlakken / stap 5).
        const vr = normalizeVrNr(r.vr_nr);
        const sectionId = resolveGevelSectionIdForVr(vr);
        const q = new URLSearchParams({ building_id: buildingId, work_mode: "assign" });
        if (sectionId) q.set("section_id", sectionId);
        if (vr) q.set("vr_nr", vr);
        if (r.vg_nr != null) q.set("vg_nr", String(r.vg_nr));
        ga.href = `/floormap.html?${q.toString()}`;
        ga.textContent = "Definieer gevelvlakken";
        ga.title = "Open geveltekening · stap 3 (materiaal koppelen / componenten vastleggen) voor dit VG/VR";
        ga.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          void openGevelStep3ForRoom(r);
        });
      } else {
        const q = new URLSearchParams({ building_id: buildingId, subsection_id: r.id });
        if (r.vg_nr != null) q.set("vg_nr", String(r.vg_nr));
        if (r.vr_nr != null && String(r.vr_nr).trim()) q.set("vr_nr", String(r.vr_nr).trim());
        ga.href = `/ga.html?${q.toString()}`;
        ga.textContent = "Koppel aan berekening gevelwering";
        ga.title = "Neem VG/VR over in de berekening gevelwering";
      }
      actions.appendChild(ga);
    }

    const isClosedArea =
      !(r.analysis?.quantity_kind === "length" && r.analysis?.open_path) &&
      Array.isArray(r.points) &&
      r.points.length >= 3;
    const canDuplicate =
      isClosedArea ||
      (componentIsLengthQuantity(r) && Array.isArray(r.points) && r.points.length >= 2);
    if (canDuplicate) {
      const dup = document.createElement("button");
      dup.type = "button";
      dup.className = "secondary";
      dup.textContent = "Kopie";
      dup.title = "Dupliceer rond dit component (Shift+klik: vraag aantal)";
      dup.addEventListener("click", (ev) => {
        ev.stopPropagation();
        void duplicateFromRoom(r, ev.shiftKey ? undefined : 1);
      });
      actions.appendChild(dup);
    }

    const hasSeal = componentHasSeal(r);
    const setSelected = selectedSetIds.has(r.id);
    const editingThisRow = pendingRoom?.editingId === r.id;
    const canOfferKier =
      allowSetSelect &&
      !componentIsLengthQuantity(r) &&
      !isLegacySealSibling(r.analysis) &&
      isClosedArea &&
      !isOpenComponent(r) &&
      (hasSeal || (ledGreen && (setSelected || editingThisRow)));
    if (canOfferKier) {
      const wrap = document.createElement("label");
      wrap.className = "drawing-list-kier";
      const canCheck = setSelected || editingThisRow || hasSeal;
      const code = sealCatalogLabel(r.analysis, DEFAULT_KIER_CATALOG_ID);
      wrap.title = hasSeal
        ? `Kierdichting aan (${code}). Uitvinken zet het kenmerk uit.`
        : setSelected || editingThisRow
          ? `Kierdichting (omtrek) — standaard ${DEFAULT_KIER_CATALOG_ID}. Meestal op een samengesteld ±-component.`
          : "Open of selecteer het component om kierdichting aan te zetten";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "drawing-list-kier-cb";
      cb.checked = hasSeal;
      cb.disabled = !canCheck;
      cb.addEventListener("click", (ev) => ev.stopPropagation());
      cb.addEventListener("change", (ev) => {
        ev.stopPropagation();
        if (cb.checked && !selectedSetIds.has(r.id) && pendingRoom?.editingId !== r.id) {
          cb.checked = componentHasSeal(r);
          setStatus("Open of selecteer het component om kierdichting toe te voegen", "err");
          return;
        }
        if (pendingRoom?.editingId === r.id && kierSuggestCb) {
          kierSuggestCb.checked = cb.checked;
          kierSuggestCb.dataset.userTouched = "1";
        }
        void toggleKierSealForRoom(r, cb.checked).then(() => {
          if (pendingRoom?.editingId === r.id) syncKierSuggestUi();
        });
      });
      wrap.appendChild(cb);
      const txt = document.createElement("span");
      txt.textContent = `Kier ${code}`;
      wrap.appendChild(txt);
      actions.appendChild(wrap);
      void ensureKierMaterials();
    }

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Opslaan";
    const editingThis = pendingRoom?.editingId === r.id;
    const kier = !isFloormapKind() && pendingSaveIsLength();
    const canSaveThis = Boolean(
      editingThis &&
        pendingRoom &&
        ((pendingRoom.closed && pendingRoom.points.length >= 3) ||
          (kier && !pendingRoom.closed && pendingRoom.points.length >= 2)),
    );
    saveBtn.disabled = !canSaveThis;
    saveBtn.className = canSaveThis ? "" : "secondary";
    saveBtn.title = editingThis
      ? canSaveThis
        ? "Sla de huidige bewerking op"
        : "Nog niet opslaanbaar — sluit de polygoon of teken verder"
      : "Open dit component (klik de regel) om te bewerken, daarna Opslaan";
    saveBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      if (!pendingRoom || pendingRoom.editingId !== r.id) {
        setStatus("Open dit component eerst (klik de regel) om te bewerken", "err");
        return;
      }
      void savePendingRoom();
    });
    actions.appendChild(saveBtn);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = pendingDeleteId === r.id ? "Bevestig wissen" : "Verwijderen";
    if (pendingDeleteId === r.id) {
      btn.classList.remove("secondary");
      btn.title = "Nogmaals klikken wist dit component permanent";
    } else {
      btn.title = isComposeResultRoom(r)
        ? "Verwijdert alleen dit samengestelde resultaat; broncomponenten blijven bestaan"
        : "Permanent verwijderen";
    }
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void deleteRoom(r.id);
    });
    actions.appendChild(btn);

    const sourceRefs =
      allowSetSelect && isComposed ? collectComposeSourceRefs(r, allItems) : [];
    if (sourceRefs.length) {
      const expanded = expandedComposeSourcePanels.has(r.id);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "secondary drawing-list-compose-toggle";
      toggle.textContent = expanded
        ? `▾ Bronnen (${sourceRefs.length})`
        : `▸ Bronnen (${sourceRefs.length})`;
      toggle.title =
        "Toon welke originelen in de lijst bij dit samengestelde component horen (klik een naam om ernaar te springen)";
      toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      toggle.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (expandedComposeSourcePanels.has(r.id)) expandedComposeSourcePanels.delete(r.id);
        else expandedComposeSourcePanels.add(r.id);
        renderRoomList();
      });
      actions.insertBefore(toggle, actions.firstChild);
    }

    li.appendChild(actions);

    if (sourceRefs.length && expandedComposeSourcePanels.has(r.id)) {
      const refs = document.createElement("div");
      refs.className = "drawing-list-compose-refs";
      refs.setAttribute("role", "group");
      refs.setAttribute(
        "aria-label",
        `Bronnen van ${r.label || "samengesteld component"} (verwijzingen naar de lijst)`,
      );
      const intro = document.createElement("p");
      intro.className = "drawing-list-compose-refs-hint";
      intro.textContent =
        "Originelen blijven in de lijst (groene markering). Klik een bron om ernaar te springen:";
      refs.appendChild(intro);
      for (const ref of sourceRefs) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "drawing-list-compose-ref";
        if (ref.missing) row.classList.add("is-missing");
        row.title = ref.missing
          ? "Bron ontbreekt in deze sectie"
          : `Ga naar «${ref.label}» in de lijst`;
        const signEl = document.createElement("span");
        signEl.className = "drawing-list-compose-ref-sign";
        signEl.textContent = ref.sign;
        const nameEl = document.createElement("span");
        nameEl.className = "drawing-list-compose-ref-label";
        nameEl.textContent = ref.missing ? `${ref.label} (ontbreekt)` : ref.label;
        row.appendChild(signEl);
        row.appendChild(nameEl);
        row.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (ref.missing) {
            setStatus(`Bron «${ref.label}» ontbreekt in deze sectie`, "err");
            return;
          }
          focusComposeSourceInList(ref.id);
        });
        refs.appendChild(row);
      }
      li.appendChild(refs);
    }

    li.addEventListener("dragstart", (ev) => {
      roomDragId = r.id;
      li.classList.add("is-dragging");
      ev.dataTransfer?.setData("text/plain", r.id);
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    });
    li.addEventListener("dragend", () => {
      roomDragId = null;
      li.draggable = false;
      li.classList.remove("is-dragging");
      listEl.querySelectorAll(".room-list-sortable.drag-over").forEach((el) => {
        el.classList.remove("drag-over");
      });
    });
    li.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
      if (roomDragId && roomDragId !== r.id) li.classList.add("drag-over");
    });
    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over");
    });
    li.addEventListener("drop", (ev) => {
      ev.preventDefault();
      li.classList.remove("drag-over");
      const fromId = roomDragId || ev.dataTransfer?.getData("text/plain") || "";
      void reorderRoomsByDrag(fromId, r.id);
    });

    listEl.appendChild(li);
}

async function refreshLinkedRooms(): Promise<void> {
  linkedRooms = new Map();
  if (!auth()?.token || !buildingId) return;
  try {
    const ret = await invokeString("API_ListLinkedSubsections", [auth()!.token, buildingId]);
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
  const viewRot = Number(s.view_rotate);
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
    view_rotate:
      viewRot === 90 || viewRot === 180 || viewRot === 270 ? viewRot : 0,
    room_count: Number(s.room_count) || 0,
  };
}

async function ensureSectionInList(sectionId: string): Promise<boolean> {
  if (sections.some((s) => s.id === sectionId)) return true;
  try {
    const data = bppPhase1Enabled()
      ? await bppGetFloormapSection(invokeString, auth()!.token, sectionId)
      : await apiGet<{ section: FloormapSection }>(
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

type SubsectionSaveResult = {
  subsection_id: string;
  area_m2?: number | null;
  perimeter_m?: number | null;
  analysis?: SubsectionAnalysis;
  area_norm?: number;
  vg_nr?: number | null;
  vr_nr?: string | null;
};

async function saveDrawingSubsection(body: Record<string, unknown>): Promise<SubsectionSaveResult> {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  if (bppPhase1Enabled()) {
    const saved = await bppSaveDrawingSubsection(invokeString, auth()!.token, body);
    return {
      subsection_id: saved.subsection_id,
      area_m2: saved.area_m2,
      perimeter_m: saved.perimeter_m,
      analysis: saved.analysis as SubsectionAnalysis | undefined,
      area_norm: saved.area_norm,
      vg_nr: saved.vg_nr != null ? Number(saved.vg_nr) : null,
      vr_nr: saved.vr_nr != null && String(saved.vr_nr).trim() ? String(saved.vr_nr).trim() : null,
    };
  }
  return apiPost<SubsectionSaveResult>("/api/floormap/subsections", body);
}

async function deleteDrawingSubsection(subsectionId: string): Promise<void> {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  if (bppPhase1Enabled()) {
    await bppDeleteDrawingSubsection(invokeString, auth()!.token, subsectionId);
    return;
  }
  await apiDelete(`/api/floormap/subsections?subsection_id=${encodeURIComponent(subsectionId)}`);
}

async function reorderDrawingSubsections(sectionId: string, orderedIds: string[]): Promise<void> {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  if (bppPhase1Enabled()) {
    await bppReorderDrawingSubsections(invokeString, auth()!.token, sectionId, orderedIds);
    return;
  }
  await apiPost("/api/floormap/subsections/reorder", {
    section_id: sectionId,
    ordered_ids: orderedIds,
  });
}

/** Server requires every subsection id — include hidden rows (kier, pending delete, …). */
async function allSubsectionIdsForSection(sectionId: string): Promise<string[]> {
  if (!auth()?.token) return [];
  const raw = bppPhase1Enabled()
    ? (await bppListDrawingSubsections(invokeString, auth()!.token, sectionId)).subsections
    : (
        await apiGet<{ subsections: RoomSubsection[] }>(
          `/api/floormap/subsections?section_id=${encodeURIComponent(sectionId)}`,
        )
      ).subsections;
  return mapSubsectionRows(raw as Array<Record<string, unknown>>)
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
    .map((r) => r.id)
    .filter(Boolean);
}

function mergeReorderIds(visibleOrder: string[], allIds: string[]): string[] {
  const vis = visibleOrder.filter(Boolean);
  const visSet = new Set(vis);
  const tail = allIds.filter((id) => !visSet.has(id));
  return [...vis, ...tail];
}

function mapSubsectionRows(raw: Array<Record<string, unknown>>): RoomSubsection[] {
  const aspect = activeScaleAspect();
  return (raw || []).map((r) => {
    const mpu =
      r.metres_per_norm_unit != null && Number(r.metres_per_norm_unit) > 0
        ? Number(r.metres_per_norm_unit)
        : null;
    let areaM2 = r.area_m2 != null ? Math.round(Number(r.area_m2) * 100) / 100 : null;
    let periM = r.perimeter_m != null ? Math.round(Number(r.perimeter_m) * 100) / 100 : null;
    let areaNorm = r.area_norm != null ? Number(r.area_norm) : null;
    let analysis: SubsectionAnalysis | null = null;
    if (r.analysis && typeof r.analysis === "object") {
      const a = r.analysis as SubsectionAnalysis;
      const holes = Array.isArray(a.holes)
        ? a.holes.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
        : undefined;
      analysis = { ...a, holes };
      // Kozijnhout: altijd lengte × balkbreedte (niet gevulde openingscontour).
      if (analysis.kozijn_role === "wood" && analysis.kozijn_frame && mpu) {
        const parsed = parseKozijnFrame(analysis.kozijn_frame);
        if (parsed?.segments.length) {
          const beam = kozijnWoodBeamMetrics(parsed.segments, mpu, aspect);
          areaM2 = beam.areaM2;
          periM = beam.lengthM;
          areaNorm = beam.areaNorm;
          analysis = {
            ...analysis,
            area_m2: beam.areaM2 ?? undefined,
            area_norm: beam.areaNorm,
            kozijn_frame: {
              ...analysis.kozijn_frame,
              wood_beam_length_m: beam.lengthM,
              wood_area_m2: beam.areaM2,
            },
          };
        }
      }
    }
    return {
      ...(r as unknown as RoomSubsection),
      points: coerceRingPoints(r.points),
      vg_nr: r.vg_nr != null ? Number(r.vg_nr) : null,
      vr_nr: r.vr_nr != null && String(r.vr_nr).trim() ? String(r.vr_nr).trim() : null,
      area_norm: areaNorm,
      perimeter_norm: r.perimeter_norm != null ? Number(r.perimeter_norm) : null,
      area_m2: areaM2,
      perimeter_m: periM,
      metres_per_norm_unit: mpu,
      sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : 0,
      analysis,
    };
  });
}

type ScaleSaveResult = {
  ok?: boolean;
  section_id?: string;
  metres_per_norm_unit?: number;
  scale_aspect_yx?: number;
  subsections?: number;
  verblijfsruimten_vloer?: number;
  vlakken?: number;
  ga_cleared?: number;
};

function formatScaleRecomputeMsg(stats: ScaleSaveResult | null | undefined, mmLabel?: string): string {
  const n = Number(stats?.subsections) || 0;
  const ga = Number(stats?.ga_cleared) || 0;
  const bits = [`${n} component${n === 1 ? "" : "en"} herberekend`];
  if (ga > 0) bits.push(`GA gewist voor ${ga} VR${ga === 1 ? "" : "’s"}`);
  else bits.push("GA opnieuw berekenen indien van toepassing");
  const head = mmLabel ? `Schaal opgeslagen (${mmLabel}). ` : "Schaal opgeslagen. ";
  return `${head}${bits.join(" · ")}.`;
}

async function persistSectionScale(opts: {
  section_id: string;
  metres_per_norm_unit: number;
  scale_ratio?: number | null;
  scale_source: string;
  scale_aspect_yx?: number | null;
}): Promise<ScaleSaveResult> {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  if (bppPhase1Enabled()) {
    return bppSaveFloormapScale(invokeString, auth()!.token, opts);
  }
  return apiPost<ScaleSaveResult>("/api/floormap/scale", {
    section_id: opts.section_id,
    metres_per_norm_unit: opts.metres_per_norm_unit,
    scale_ratio: opts.scale_ratio ?? null,
    scale_source: opts.scale_source,
    scale_aspect_yx: opts.scale_aspect_yx ?? null,
  });
}

async function fetchFloormapSections(buildingId: string): Promise<FloormapSection[]> {
  if (bppPhase1Enabled()) {
    const data = await bppListFloormapSections(invokeString, auth()!.token, buildingId);
    return (data.sections || []).map((s) => normalizeSection(s));
  }
  const data = await apiGet<{ sections: FloormapSection[] }>(
    `/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`,
  );
  return (data.sections || []).map((s) => normalizeSection(s));
}

async function loadFloormapSections(bid: string): Promise<void> {
  if (!auth()?.token) return;
  buildingId = bid.trim();
  refreshLastComponentOrientatieFromStorage();
  clearSectionThumbnailCachesForBuilding(buildingId);
  if (!buildingId) {
    setStatus("Voer een project-id in", "err");
    return;
  }
  buildingInput.value = buildingId;
  if (gaLinkEl) {
    gaLinkEl.href = `/ga.html?building_id=${encodeURIComponent(buildingId)}`;
  }
  const listLoad = startConnLoadProgress(
    { bar: connBarEl, status: connStatusEl },
    "Secties laden…",
  );
  try {
    await refreshBuildingMeta();
    await refreshLinkedRooms();
    const data = await fetchFloormapSections(buildingId);
    sections = data;
    const sectionToOpen = resolveSectionToOpen(buildingId);
    if (sectionToOpen) {
      await ensureSectionInList(sectionToOpen);
    }
    syncWorkspaceLabels(sections[0]?.region_kind || "FLOORMAP");
    renderSectionList();
    // New project/list load: never keep the previous section's crop/rooms on screen.
    sectionRoomsSnapshot.clear();
    resetSectionWorkspace();
    activeSection = null;
    updateScaleUi();
    pickerPanelEl.classList.remove("hidden");
    workspacePanelEl.classList.add("hidden");
    syncProcessDockVisibility();
    syncFloormapLocation(sectionToOpen || null);
    projectMenu?.rememberCurrent();
    projectMenu?.refreshTitle();
    void loadFavoriteMaterials();
    listLoad.done();
    setStatus(`${sections.length} sectie(s)`, "ok");
    if (sectionToOpen && sections.some((s) => s.id === sectionToOpen)) {
      await openSection(sectionToOpen);
    } else if (sectionToOpen) {
      setStatus("Sectie niet gevonden of niet schaalbaar — controleer de engineer-beoordelingslink", "err");
    }
  } catch (err) {
    listLoad.done();
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}

/** Keep the user's list order after a reload; place new rows after preferred order. */
function applyPreferredRoomOrder(
  incoming: RoomSubsection[],
  preferredIds: string[],
): RoomSubsection[] {
  if (!preferredIds.length) {
    return [...incoming].sort(
      (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl"),
    );
  }
  const byId = new Map(incoming.map((r) => [r.id, r]));
  const out: RoomSubsection[] = [];
  for (const id of preferredIds) {
    const r = byId.get(id);
    if (!r) continue;
    out.push(r);
    byId.delete(id);
  }
  const rest = [...byId.values()].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "nl"),
  );
  out.push(...rest);
  out.forEach((r, i) => {
    r.sort_order = i;
  });
  return out;
}

async function loadRooms(opts?: { preserveOrder?: boolean }): Promise<void> {
  if (!auth()?.token || !activeSection) return;
  const preferredIds = opts?.preserveOrder ? rooms.map((r) => r.id) : [];
  const prevRooms = rooms.map((r) => ({
    ...r,
    points: r.points.map((p) => ({ ...p })),
  }));
  const epoch = ++roomsLoadEpoch;
  const sectionId = activeSection.id;
  try {
    const raw = bppPhase1Enabled()
      ? (await bppListDrawingSubsections(invokeString, auth()!.token, sectionId)).subsections
      : (
          await apiGet<{ subsections: RoomSubsection[] }>(
            `/api/floormap/subsections?section_id=${encodeURIComponent(sectionId)}`,
          )
        ).subsections;
    // A newer load (or save patch) won the race — drop this reply.
    if (epoch !== roomsLoadEpoch || activeSection?.id !== sectionId) return;
    let mapped = mapSubsectionRows(raw as Array<Record<string, unknown>>);
    mapped = dropLocallyDeletedRooms(mergeRoomsWithLocalPatches(mapped));
    const mappedIds = new Set(mapped.map((r) => normRoomId(r.id)));
    for (const r of prevRooms) {
      const id = normRoomId(r.id);
      if (mappedIds.has(id) || isLocallyDeleted(r.id)) continue;
      if (r.section_id && r.section_id !== sectionId) continue;
      const hasPatch =
        localRoomPatches.has(r.id) ||
        localRoomPatches.has(id) ||
        touchedRoomIds.has(id) ||
        localLabelOverrides.has(id);
      if (!hasPatch) continue;
      mapped.push(r);
      mappedIds.add(id);
    }
    // Prefer fresher in-memory labels when the server list still lags after Opslaan.
    if (prevRooms.length) {
      const prevById = new Map(prevRooms.map((r) => [normRoomId(r.id), r]));
      mapped = mapped.map((r) => {
        const prev = prevById.get(normRoomId(r.id));
        if (!prev) return r;
        const prevLabel = (prev.label || "").trim();
        const curLabel = (r.label || "").trim();
        if (!prevLabel || prevLabel === curLabel) return r;
        if (
          !touchedRoomIds.has(normRoomId(r.id)) &&
          !localLabelOverrides.has(normRoomId(r.id)) &&
          !localRoomPatches.has(normRoomId(r.id))
        ) {
          return r;
        }
        noteLocalLabel(r.id, prevLabel);
        return { ...r, label: prevLabel };
      });
    }
    mapped = applyLocalLabelOverrides(mapped);
    if (preferredIds.length) {
      mapped = applyPreferredRoomOrder(mapped, preferredIds);
    } else {
      mapped.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
    }
    rooms = mapped;
    sectionRoomsSnapshot.delete(sectionId);
    selectedSetIds = new Set([...selectedSetIds].filter((id) => rooms.some((r) => r.id === id)));
    for (const id of [...constituentSigns.keys()]) {
      if (!selectedSetIds.has(id)) constituentSigns.delete(id);
    }
    renderRoomList();
    drawOverlay();
  } catch (err) {
    // Keep the previous in-memory list visible — never wipe the UI on a fetch error.
    if (epoch === roomsLoadEpoch) {
      renderRoomList();
      drawOverlay();
    }
    throw err;
  }
  if (epoch !== roomsLoadEpoch || activeSection?.id !== sectionId) return;
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
  if (epoch !== roomsLoadEpoch || activeSection?.id !== sectionId) return;
  try {
    await refreshLinkedRooms();
    if (epoch !== roomsLoadEpoch || activeSection?.id !== sectionId) return;
    renderRoomList();
    drawOverlay();
  } catch {
    /* optional GA overlay */
  }
  if (epoch === roomsLoadEpoch) {
    syncCopyLayoutUi();
    invalidateGevelCopySources();
    syncCopyGevelUi();
    requestAnimationFrame(() => {
      if (epoch === roomsLoadEpoch) drawOverlay();
    });
  }
}

/** If the floormap has no scale but rooms do, restore it so edits need no recalibration. */
async function restoreScaleFromRooms(): Promise<void> {
  if (!activeSection || !auth()?.token) return;
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
    await persistSectionScale({
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
  if (!activeSection || !auth()?.token) return;
  const mpu = activeSection.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0) || canvasWidth < 1 || canvasHeight < 1) return;
  const aspect = canvasHeight / canvasWidth;
  const prev = activeSection.scale_aspect_yx;
  if (prev != null && Math.abs(prev - aspect) < 1e-6) return;
  try {
    await persistSectionScale({
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

/**
 * Drop section-scoped UI so a previous plattegrond cannot flash (or stick)
 * onto the next crop — rooms/pendingRoom/overlay/PDF bitmap.
 */
function resetSectionWorkspace(opts?: { preserveLocalRoomState?: boolean }): void {
  endDiscovery();
  endCalibrate();
  void endDetail();
  if (measure.tool !== "off") clearMeasure(false);
  clearPendingDeleteConfirm();
  pendingRoom = null;
  if (kierSuggestCb) {
    kierSuggestCb.checked = false;
    delete kierSuggestCb.dataset.userTouched;
  }
  rooms = [];
  selectedSetIds.clear();
  constituentSigns.clear();
  booleanPreview = null;
  linkedRooms.clear();
  if (!opts?.preserveLocalRoomState) {
    localRoomPatches.clear();
    localRoomDeletions.clear();
  }
  roomsLoadEpoch += 1;
  cropBitmap = null;
  canvasWidth = 0;
  canvasHeight = 0;
  for (const c of [pdfCanvas, overlayCanvas]) {
    c.width = 1;
    c.height = 1;
    c.style.width = "1px";
    c.style.height = "1px";
    const ctx = c.getContext("2d");
    ctx?.clearRect(0, 0, 1, 1);
  }
  syncPendingRoomButtons();
  syncEditDock();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
}

async function openSection(sectionId: string): Promise<void> {
  const sec = sections.find((s) => s.id === sectionId);
  if (!sec || !auth()?.token) return;
  resetSectionWorkspace();
  activeSection = sec;
  persistLastSectionId(buildingId, sec.id);
  syncFloormapLocation(sec.id);
  const n = partNoun(sec.region_kind);
  syncWorkspaceLabels(sec.region_kind);
  sectionTitleEl.textContent = sec.label || n.title;
  sectionMetaEl.textContent = `${n.kindLabel} · pagina ${sec.page_index + 1} · ${sec.document_id.slice(0, 8)}…`;
  pickerPanelEl.classList.add("hidden");
  workspacePanelEl.classList.remove("hidden");
  syncProcessDockVisibility();
  updateScaleUi();
  const load = startConnLoadProgress(
    { bar: connBarEl, status: connStatusEl },
    `${n.title} binnenlezen…`,
  );
  let pdfErr: unknown = null;
  let roomsErr: unknown = null;
  try {
    try {
      await loadCroppedPdf(sec, load);
      load.setLabel("Schaal / pagina…");
      load.setFraction(null);
      await tryDetectPdfScale(sec);
      await ensureScaleAspectSynced();
      updateScaleUi();
    } catch (err) {
      pdfErr = err;
    }
    try {
      load.setLabel("Componenten laden…");
      load.setFraction(null);
      await loadRooms();
    } catch (err) {
      roomsErr = err;
    }
    // Fill VR-filter with all plattegrond VRs (not only those already on this gevel).
    try {
      await refreshBuildingVrCatalog();
      syncRoomListVrFilterOptions(rooms);
    } catch (err) {
      console.warn("building VR catalog refresh failed", err);
    }
  } finally {
    load.done();
  }
  // Guard against a late openSection race (user switched again).
  if (activeSection?.id !== sec.id) return;
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

async function loadCroppedPdf(sec: FloormapSection, load?: ConnLoadProgress): Promise<void> {
  load?.setLabel("Tekening downloaden…");
  let buf: ArrayBuffer;
  try {
    buf = await fetchArrayBufferWithProgress(
      `/api/drawings/download?document_id=${encodeURIComponent(sec.document_id)}`,
      {
        credentials: "include",
        headers: apiAuthHeaders(auth()!.token),
      },
      (received, total) => load?.setBytes(received, total),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(msg.replace(/^Download mislukt/, "PDF laden mislukt"));
  }
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded");
  ensurePdfjsWorker();
  load?.setLabel("PDF decoderen…");
  load?.setFraction(null);
  pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageNum = Math.min(pdfDoc.numPages, Math.max(1, sec.page_index + 1));
  const page = await pdfDoc.getPage(pageNum);
  const renderScale = CROP_VIEW_RENDER_SCALE;
  const pageRotate = typeof page.rotate === "number" ? page.rotate : 0;
  const viewRotate = Number(sec.view_rotate) || 0;
  const rotation = (pageRotate + viewRotate) % 360;
  const viewport = page.getViewport({ scale: renderScale, rotation });
  const off = document.createElement("canvas");
  off.width = Math.floor(viewport.width);
  off.height = Math.floor(viewport.height);
  const octx = off.getContext("2d");
  if (!octx) throw new Error("canvas context unavailable");
  octx.setTransform(1, 0, 0, 1, 0, 0);
  load?.setLabel("Pagina renderen…");
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

  // Crop width in PDF user space at scale=1, in the same rotated viewport as region norms.
  const baseVp = page.getViewport({ scale: 1, rotation });
  cropWidthPdfPts = (sec.x_max - sec.x_min) * baseVp.width;

  viewZoom = loadStoredViewZoom();
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
    await persistSectionScale({
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
    calibrateHintEl.textContent = `Gedetecteerde papierschaal 1:${found} uit PDF-tekst.`;
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
  const cssW = `${canvasWidth}px`;
  const cssH = `${canvasHeight}px`;
  pdfCanvas.style.width = cssW;
  pdfCanvas.style.height = cssH;
  overlayCanvas.style.width = cssW;
  overlayCanvas.style.height = cssH;
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
  drawOverlay();
}

function updateZoomLabel(): void {
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
}

async function setViewZoom(next: number, maxZoom = ZOOM_MAX_DETAIL): Promise<void> {
  // Snap +/- steps to whole 10% when close; keep exact values from zoom-to-fit / detail.
  const rounded = Math.round(next * 100) / 100;
  viewZoom = Math.min(maxZoom, Math.max(ZOOM_MIN, rounded));
  persistViewZoom(viewZoom);
  updateZoomLabel();
  await paintCropView();
}

async function zoomToFit(): Promise<void> {
  if (!cropBitmap) return;
  const avail = Math.max(200, pdfScrollEl.clientWidth - 16);
  await setViewZoom(avail / cropBitmap.width, ZOOM_MAX);
}

function canvasToNorm(cx: number, cy: number): Pt {
  return canvasToNormCore(cx, cy, canvasWidth, canvasHeight);
}

/** Pointer in section-norm space without clamping — used for drag deltas so the shape stays rigid. */
function canvasToNormUnclamped(cx: number, cy: number): Pt {
  return canvasToNormUnclampedCore(cx, cy, canvasWidth, canvasHeight);
}

function normToCanvas(p: Pt): { x: number; y: number } {
  return normToCanvasCore(p, canvasWidth, canvasHeight);
}

function eventToCanvas(ev: MouseEvent): { x: number; y: number } {
  return eventToCanvasCore(ev, overlayCanvas.getBoundingClientRect(), canvasWidth, canvasHeight);
}

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  stroke: string,
  fill: string,
  lineWidth: number,
  opts?: {
    vertexHandles?: boolean;
    dash?: number[];
    label?: string;
    holes?: Pt[][];
    open?: boolean;
    strokeOnly?: boolean;
  },
): void {
  if (points.length < 2) return;
  const holes = (opts?.holes || []).filter((h) => h.length >= 3);
  const open = Boolean(opts?.open);
  const strokeOnly = Boolean(opts?.strokeOnly) || !fill;
  ctx.beginPath();
  const first = normToCanvas(points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = normToCanvas(points[i]);
    ctx.lineTo(p.x, p.y);
  }
  if (!open) ctx.closePath();
  for (const hole of holes) {
    const h0 = normToCanvas(hole[0]);
    ctx.moveTo(h0.x, h0.y);
    for (let i = 1; i < hole.length; i++) {
      const p = normToCanvas(hole[i]);
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  }
  if (fill && !strokeOnly) {
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
    const hr = vertexHandleRadiusPx();
    for (const pt of verts) {
      const c = normToCanvas(pt);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.strokeStyle = "#00bcd4";
      ctx.lineWidth = detail ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(c.x, c.y, hr, 0, Math.PI * 2);
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

/** Diagonale arcering binnen een ring (ingesloten glasvlak). */
function hatchRing(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  color: string,
  stepPx = 7,
): void {
  if (points.length < 3) return;
  const cs = points.map((p) => normToCanvas(p));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cs) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x);
    maxY = Math.max(maxY, c.y);
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cs[0].x, cs[0].y);
  for (let i = 1; i < cs.length; i++) ctx.lineTo(cs[i].x, cs[i].y);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  const span = maxX - minX + maxY - minY;
  for (let d = -span; d <= span; d += stepPx) {
    ctx.beginPath();
    ctx.moveTo(minX + d, minY);
    ctx.lineTo(minX + d + (maxY - minY), maxY);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Bronnen tijdelijk niet tekenen wanneer een ±-resultaat in focus is,
 * zodat alleen het netto-oppervlak (outer − holes) zichtbaar is.
 * Uitzondering: als bronnen zelf ook in de set-selectie staan (nieuwe compositie).
 */
function sourceIdsHiddenForComposeNetPreview(): Set<string> {
  const hide = new Set<string>();
  const addSourcesOf = (compose: RoomSubsection) => {
    const src = compose.analysis?.source_subsection_ids;
    if (!Array.isArray(src)) return;
    for (const sid of src) {
      if (sid && sid !== compose.id) hide.add(sid);
    }
  };

  if (pendingRoom?.editingId) {
    const editing = rooms.find((r) => r.id === pendingRoom!.editingId);
    if (editing && isComposeResultRoom(editing)) addSourcesOf(editing);
  }

  for (const id of selectedSetIds) {
    const r = rooms.find((x) => x.id === id);
    if (!r || !isComposeResultRoom(r)) continue;
    const src = r.analysis?.source_subsection_ids || [];
    // Niet verbergen als de gebruiker bronnen mee-selecteert voor een volgende ±.
    if (src.some((sid) => sid && selectedSetIds.has(sid))) continue;
    addSourcesOf(r);
  }
  return hide;
}

function drawOverlay(): void {
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Bij focus op een ±-resultaat: verberg bronnen zodat alleen het netto-vlak (outer − holes) zichtbaar is.
  const hideSourceIds = sourceIdsHiddenForComposeNetPreview();

  const drawSavedRoom = (r: RoomSubsection): void => {
    if (!r.points?.length) return;
    if (isLocallyDeleted(r.id)) return;
    if (pendingRoom?.editingId === r.id) return;
    if (!roomMatchesListFilters(r)) return;
    if (hideSourceIds.has(r.id)) return;
    const selected = selectedSetIds.has(r.id);
    const touched = touchedRoomIds.has(normRoomId(r.id));
    const holes = Array.isArray(r.analysis?.holes)
      ? r.analysis!.holes!.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
      : [];
    const lengthComp = componentIsLengthQuantity(r);
    const role = String(r.analysis?.kozijn_role || "");
    let stroke = selected ? "#1565c0" : touched ? "#00838f" : "#6a1b9a";
    let fill = lengthComp
      ? ""
      : selected
        ? "rgba(21,101,192,0.22)"
        : touched
          ? "rgba(0,131,143,0.16)"
          : "rgba(106,27,154,0.12)";
    let width = selected ? 2.6 : touched ? 2.2 : 2;
    let label: string | undefined;
    if (role === "glass") {
      stroke = selected ? "#01579b" : "#0277bd";
      fill = selected ? "rgba(2,119,189,0.38)" : "rgba(3,169,244,0.28)";
      width = selected ? 2.4 : 1.8;
      label = "glas";
    } else if (role === "wood") {
      stroke = selected ? "#4e342e" : "#5d4037";
      fill = selected ? "rgba(109,76,65,0.42)" : "rgba(141,110,99,0.32)";
      width = selected ? 2.6 : 2.2;
      label = "kozijn";
    }
    drawPolyline(ctx, r.points, stroke, fill, width, {
      holes: lengthComp ? undefined : holes.length ? holes : undefined,
      open: Boolean(r.analysis?.open_path) || (lengthComp && r.points.length < 3),
      strokeOnly: lengthComp,
      label,
      dash: role === "glass" ? [5, 3] : undefined,
    });
    if (role === "glass" && r.points.length >= 3) {
      hatchRing(ctx, r.points, selected ? "rgba(1,87,155,0.55)" : "rgba(2,119,189,0.45)");
    }
  };

  const drawSealStroke = (r: RoomSubsection, points: Pt[]): void => {
    if (!points?.length) return;
    if (!roomMatchesListFilters(r)) return;
    if (hideSourceIds.has(r.id)) return;
    const selected = selectedSetIds.has(r.id);
    const touched = touchedRoomIds.has(normRoomId(r.id));
    const stroke = selected
      ? KIER_SEAL_STROKE_SELECTED
      : touched
        ? KIER_SEAL_STROKE_TOUCHED
        : KIER_SEAL_STROKE;
    const holes = Array.isArray(r.analysis?.holes)
      ? r.analysis!.holes!.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
      : [];
    const live = pendingRoom?.editingId === r.id ? pendingRoom : null;
    const liveHoles = live?.holes;
    drawPolyline(ctx, points, stroke, "", 3.4, {
      holes: liveHoles && liveHoles.length ? liveHoles : holes.length ? holes : undefined,
      open: Boolean(r.analysis?.open_path) || (live ? !live.closed : false),
      strokeOnly: true,
    });
  };

  // Vlakken eerst — oranje kier-omtrek ná edit-stroke (anders dekt groen de oranje lijn).
  for (const r of rooms) {
    if (isLegacySealSibling(r.analysis)) continue;
    drawSavedRoom(r);
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

  // Dim/frame under interactive edit so anchors stay on top and easy to grab.
  drawDetailOverlay(ctx);

  if (discovery) {
    discovery.candidates.forEach((ring, i) => {
      if (i === discovery!.index) return;
      drawPolyline(ctx, ring, "#9e9e9e", "rgba(158,158,158,0.06)", 1.5, { dash: [4, 4] });
    });
    if (discovery.current.length >= 2) {
      drawPolyline(ctx, discovery.current, "#c62828", "rgba(198,40,40,0.12)", 2.5, {
        dash: [8, 4],
        vertexHandles: true,
        label: `Kandidaat ${discovery.index + 1}`,
      });
    }
  }

  if (pendingRoom?.points.length) {
    const lengthEdit = pendingIsLengthComponent();
    const drawingOpen = Boolean(pendingRoom.drawing && !pendingRoom.closed);
    drawPolyline(
      ctx,
      pendingRoom.points,
      "#b71c1c",
      lengthEdit || !pendingRoom.closed ? "" : "rgba(183, 28, 28, 0.28)",
      lengthEdit ? 3.2 : 2.8,
      {
        vertexHandles: !drawingOpen && (pendingRoom.closed || pendingRoom.points.length >= 2),
        holes: lengthEdit ? undefined : pendingRoom.holes,
        open: !pendingRoom.closed,
        strokeOnly: lengthEdit || !pendingRoom.closed,
      },
    );
    if (drawingOpen) drawOpenPolygonDraft(ctx, pendingRoom);
  }

  // Kierdichting altijd bovenop (ook boven groene edit-stroke).
  for (const r of rooms) {
    if (isLocallyDeleted(r.id)) continue;
    if (isLegacySealSibling(r.analysis)) {
      if (r.points?.length) drawSealStroke(r, r.points);
      continue;
    }
    if (!componentSealEnabled(r.analysis)) continue;
    const pts =
      pendingRoom?.editingId === r.id && pendingRoom.points.length
        ? pendingRoom.points
        : r.points;
    if (pts?.length) drawSealStroke(r, pts);
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

  if (kozijnDraft) {
    const ev = kozijnDraft.eval;
    if (ev) {
      for (const ring of ev.woodPolygons) {
        drawPolyline(ctx, ring, "#6d4c41", "rgba(141,110,99,0.45)", 1.5);
      }
      for (const ring of ev.glassPolygons) {
        drawPolyline(ctx, ring, "#0277bd", "rgba(3,169,244,0.32)", 1.5, {
          dash: [5, 3],
          label: "glas",
        });
        hatchRing(ctx, ring, "rgba(2,119,189,0.5)");
      }
    }
    const drawSeg = (pts: Pt[], color: string) => {
      if (pts.length < 1) return;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      const a0 = normToCanvas(pts[0]);
      ctx.moveTo(a0.x, a0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = normToCanvas(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      if (kozijnDraft!.cursor && pts === kozijnDraft!.livePoints) {
        const c = normToCanvas(kozijnDraft!.cursor);
        ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
      for (const pt of pts) {
        const c = normToCanvas(pt);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    for (const seg of kozijnDraft.segments) drawSeg(seg.points, "#5d4037");
    if (kozijnDraft.livePoints.length || kozijnDraft.cursor) {
      drawSeg(kozijnDraft.livePoints, "#e65100");
    }
    // Startpunt + «Sluiten» bij buitenste kader.
    if (
      kozijnDraft.phase === "frame" &&
      !kozijnDraft.frameClosed &&
      kozijnDraft.livePoints.length >= 1
    ) {
      const first = kozijnDraft.livePoints[0];
      const fc = normToCanvas(first);
      const closing =
        kozijnDraft.cursor != null && kozijnFrameCloseSnap(kozijnDraft.cursor) != null;
      ctx.beginPath();
      ctx.arc(fc.x, fc.y, closing ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = closing ? "#1b5e20" : "rgba(46,125,50,0.85)";
      ctx.fill();
      if (kozijnDraft.livePoints.length >= 3) {
        ctx.fillStyle = closing ? "#1b5e20" : "#2e7d32";
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(closing ? "Sluiten" : "start", fc.x, fc.y - 12);
      }
    }
    // Junction markers; highlight when cursor snaps.
    const targets = collectKozijnSnapTargets(kozijnDraft.segments, kozijnDraft.livePoints);
    const cursor = kozijnDraft.cursor;
    for (const t of targets) {
      const c = normToCanvas(t);
      const hot =
        cursor != null &&
        normDistancePxCore(cursor, t, canvasWidth, canvasHeight) <= 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, hot ? 6 : 3, 0, Math.PI * 2);
      ctx.fillStyle = hot ? "#1b5e20" : "rgba(93,64,55,0.55)";
      ctx.fill();
      if (hot) {
        ctx.strokeStyle = "#1b5e20";
        ctx.lineWidth = 1.5;
        ctx.stroke();
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
  const xs = points.map((p) => p.x * canvasWidth);
  const ys = points.map((p) => p.y * canvasHeight);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const viewL = pdfScrollEl.scrollLeft;
  const viewT = pdfScrollEl.scrollTop;
  const viewW = pdfScrollEl.clientWidth;
  const viewH = pdfScrollEl.clientHeight;
  const viewR = viewL + viewW;
  const viewB = viewT + viewH;
  const pad = 32;
  const visible =
    maxX >= viewL + pad &&
    minX <= viewR - pad &&
    maxY >= viewT + pad &&
    minY <= viewB - pad;
  if (visible) return;
  let left = viewL;
  let top = viewT;
  if (minX < viewL + pad) left = Math.max(0, minX - pad);
  else if (maxX > viewR - pad) left = Math.max(0, maxX - viewW + pad);
  if (minY < viewT + pad) top = Math.max(0, minY - pad);
  else if (maxY > viewB - pad) top = Math.max(0, maxY - viewH + pad);
  if (left !== viewL || top !== viewT) {
    pdfScrollEl.scrollTo({ top, left, behavior: "auto" });
  }
}

function syncDetailFactorButtons(): void {
  const factor = detail?.factor ?? DETAIL_FACTOR_DEFAULT;
  document.querySelectorAll<HTMLButtonElement>(".detail-factor-btn").forEach((btn) => {
    const f = Number(btn.dataset.factor);
    btn.classList.toggle("active", f === factor);
  });
}

function updateDetailDock(): void {
  if (!detailDockEl) return;
  const picking = Boolean(detailPick);
  const active = Boolean(detail);
  detailDockEl.classList.toggle("hidden", !picking && !active);
  if (detailBtn) {
    detailBtn.classList.toggle("active", picking || active);
    detailBtn.textContent = picking ? "Annuleer markeren" : active ? "Detailgebied aan" : "Detailgebied";
  }
  if (detailHintEl) {
    if (picking) {
      detailHintEl.textContent =
        "Sleep een rechthoek over het gebied met kleine componenten, laat los om te vergroten.";
    } else if (detail) {
      const pct = Math.round(detail.baseZoom * detail.factor * 100);
      detailHintEl.textContent =
        detail.factor === 1
          ? `Actief · 1× (${pct}%) — overzicht bij markeren; kies 2×/3×/4× om in te zoomen.`
          : `Actief · ${detail.factor}× (${pct}%) — 1× keert terug naar overzicht; Sluiten wist het kader.`;
    } else {
      detailHintEl.textContent =
        "Start op 1× (overzicht). Sleep een rechthoek; daarna 2×/3×/4× t.o.v. dat overzicht. Rechterlijst blijft zichtbaar.";
    }
  }
  syncDetailFactorButtons();
  if (detailRepickBtn) detailRepickBtn.disabled = picking;
}

async function applyDetailView(opts?: { scroll?: boolean }): Promise<void> {
  if (!detail || !cropBitmap) return;
  // True Nx relative to overview zoom when the region was marked.
  const target = detail.baseZoom * detail.factor;
  await setViewZoom(target, ZOOM_MAX_DETAIL);
  if (opts?.scroll !== false) {
    scrollToRing(normRectRing(detail.rect));
  }
  updateDetailDock();
  drawOverlay();
  setStatus(
    detail.factor === 1
      ? `Detailgebied 1× (${Math.round(viewZoom * 100)}% — overzicht)`
      : `Detailgebied ${detail.factor}× (${Math.round(viewZoom * 100)}%)`,
    "ok",
  );
}

async function endDetail(msg?: string): Promise<void> {
  const restore = detail
    ? {
        z: detail.baseZoom,
        left: detail.baseScrollLeft,
        top: detail.baseScrollTop,
      }
    : null;
  detail = null;
  detailPick = null;
  overlayCanvas.style.cursor = "";
  if (restore) {
    await setViewZoom(restore.z);
    pdfScrollEl.scrollTo({
      left: restore.left,
      top: restore.top,
      behavior: "auto",
    });
  }
  updateDetailDock();
  drawOverlay();
  if (msg) setStatus(msg, "ok");
}

async function beginDetailPick(): Promise<void> {
  endCalibrate();
  if (discovery) {
    setStatus("Rond ontdekken eerst af of annuleer vóór detailzoom", "err");
    return;
  }
  // Always start marking from overview (1× / passend) — leftover 2–4× zoom blocks region pick.
  if (cropBitmap) {
    await zoomToFit();
  } else {
    await setViewZoom(1, ZOOM_MAX);
  }
  pdfScrollEl.scrollTo({ left: 0, top: 0, behavior: "auto" });
  detailPick = {
    start: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    armed: true,
  };
  overlayCanvas.style.cursor = "crosshair";
  updateDetailDock();
  setStatus("Detailgebied 1× — sleep een rechthoek op het overzicht", "busy");
  drawOverlay();
}

function startDetailTool(): void {
  void (async () => {
    if (detailPick) {
      await endDetail("Detailgebied geannuleerd");
      return;
    }
    if (detail) {
      await endDetail("Detailgebied gesloten");
      return;
    }
    await beginDetailPick();
  })();
}

function repickDetail(): void {
  void (async () => {
    // Drop active frame without restoring old high zoom — beginDetailPick resets to overview.
    detail = null;
    await beginDetailPick();
  })();
}

async function commitDetailRect(
  rect: NormRect,
  factor: DetailFactor = DETAIL_FACTOR_DEFAULT,
): Promise<void> {
  if (!normRectSizeOk(rect)) {
    setStatus("Gebied te klein — sleep een grotere rechthoek", "err");
    detailPick = null;
    void beginDetailPick();
    return;
  }
  detailPick = null;
  overlayCanvas.style.cursor = "";
  // Capture zoom/scroll before applying magnification so 1× can restore exactly.
  detail = {
    rect,
    factor,
    baseZoom: viewZoom,
    baseScrollLeft: pdfScrollEl.scrollLeft,
    baseScrollTop: pdfScrollEl.scrollTop,
  };
  await applyDetailView();
}

function drawDetailOverlay(ctx: CanvasRenderingContext2D): void {
  const live =
    detailPick && !detailPick.armed
      ? normalizeNormRect(detailPick.start, detailPick.current)
      : detail?.rect || null;
  if (!live) return;
  const x = live.x0 * canvasWidth;
  const y = live.y0 * canvasHeight;
  const w = (live.x1 - live.x0) * canvasWidth;
  const h = (live.y1 - live.y0) * canvasHeight;
  if (w < 1 || h < 1) return;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 32, 0.28)";
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  ctx.rect(x, y, w, h);
  ctx.fill("evenodd");

  ctx.strokeStyle = detailPick ? "#0288d1" : "#1565c0";
  ctx.lineWidth = 2;
  ctx.setLineDash(detailPick ? [7, 4] : []);
  ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
  ctx.setLineDash([]);
  ctx.restore();
}

function endDiscovery(msg?: string): void {
  discovery = null;
  discoveryDockEl.classList.add("hidden");
  document.body.classList.remove("discovery-active");
  syncEditDock();
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
        ? "Ontdekken afgerond"
        : `Ontdekken afgerond — ${total} kandidaat(en) beoordeeld`,
    );
    return;
  }
  discovery.current = ensureEditablePolyline(
    discovery.candidates[i].map((p) => ({ ...p })),
    16,
  );
  discovery.candidates[i] = discovery.current;
  discovery.dragVertex = null;
  discoveryProgressEl.textContent = `(${i + 1} van ${total})`;
  discoveryHintEl.textContent =
    "Sleep ankers langs de muren. Dubbelklik op een rand om een anker toe te voegen; dubbelklik een anker om te verwijderen; of Vereenvoudigen.";
  discoveryLabelInput.value = buildDiscoveryLabel(activePartNoun().singular, rooms.length);
  discoveryDockEl.classList.remove("hidden");
  document.body.classList.add("discovery-active");
  if (editDockEl) editDockEl.classList.add("hidden");
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
  scrollToRing(discovery.current);
}

/** Slider: links grof (grote openingen), rechts fijn (ook kleine). */
function discoverMinAreaFraction(): number {
  if (!discoverMinSizeEl) return 0;
  const pos = Number(discoverMinSizeEl.value);
  const inverted = Number.isFinite(pos) ? 100 - pos : 100;
  return discoverMinAreaFractionFromPercent(inverted);
}

function updateDiscoverFilterAria(): void {
  if (!discoverMinSizeEl) return;
  const pos = Number(discoverMinSizeEl.value);
  if (!Number.isFinite(pos)) return;
  const coarse = pos <= 33;
  const fine = pos >= 67;
  discoverMinSizeEl.setAttribute(
    "aria-valuetext",
    coarse ? "Grof" : fine ? "Fijn" : "Middel",
  );
}

/** Outer contour for façade interior discovery: editing room, or selected set (largest). */
function resolveDiscoveryOuter(): RoomSubsection | null {
  return resolveDiscoveryOuterCore({
    isFloormapKind: isFloormapKind(),
    pendingRoom,
    rooms,
    selectedSetIds,
    closeRing,
    isLengthComponent: componentIsLengthQuantity,
    differenceSubject,
  });
}

function openingOverlapsExisting(normRing: Pt[], outerId: string): boolean {
  return openingOverlapsExistingCore(normRing, outerId, rooms, shoelaceArea, componentIsLengthQuantity);
}

async function autoSaveDiscoveredOpenings(
  openings: DiscoveredOpening[],
  outer: RoomSubsection,
): Promise<number> {
  if (!activeSection || !auth() || !cropBitmap) return 0;
  const mpu = activeScaleMpu();
  const aspect = activeScaleAspect();
  const level = outer.level_hint || roomLevelSelect.value || "OTHER";
  const vg = outer.vg_nr != null ? Number(outer.vg_nr) : parseVgVrInputs().vg_nr;
  const vr =
    outer.vr_nr != null && String(outer.vr_nr).trim()
      ? String(outer.vr_nr).trim()
      : parseVgVrInputs().vr_nr;
  let savedN = 0;
  for (const o of openings) {
    const points = discoveredOpeningToSectionPoints(
      pixelsToSectionNorm(o.points, cropBitmap.width, cropBitmap.height),
      o.shape,
    );
    if (!ringFullyContained(points, outer.points)) continue;
    if (openingOverlapsExisting(points, outer.id)) continue;
    const body: Record<string, unknown> = {
      section_id: activeSection.id,
      label: o.suggestedLabel,
      level_hint: level,
      vg_nr: vg,
      vr_nr: vr,
      points,
      metres_per_norm_unit: mpu ?? undefined,
      scale_aspect_yx: aspect,
      analysis: {
        discovered_from_outer_id: outer.id,
        discovery_kind: o.kind,
      },
    };
    const saved = await saveDrawingSubsection(body);
    const savedId = (saved.subsection_id || "").trim();
    if (!savedId) continue;
    markRoomTouched(savedId);
    const analysis: SubsectionAnalysis = {
      discovered_from_outer_id: outer.id,
      discovery_kind: o.kind,
      ...(saved.analysis || {}),
    };
    const patched: RoomSubsection = {
      id: savedId,
      section_id: activeSection.id,
      label: o.suggestedLabel,
      level_hint: level,
      vg_nr: vg,
      vr_nr: vr,
      points: points.map((p) => ({ ...p })),
      area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
      area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
      perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
      perimeter_norm: null,
      metres_per_norm_unit: mpu,
      analysis_status: "ok",
      sort_order: rooms.length,
      analysis,
    };
    rooms = [...rooms.filter((r) => r.id !== savedId), patched];
    noteLocalRoomPatch(patched);
    savedN++;
  }
  if (savedN > 0) {
    roomsLoadEpoch += 1;
    renderRoomList();
    drawOverlay();
  }
  return savedN;
}

const DISCOVER_PRESS_MS = 180;
/** Display crop raster scale (PDF points → px). */
const CROP_VIEW_RENDER_SCALE = 2.5;
/** Hi-res crop for server-side H/V line discovery (~2.4× display pixels). */
const DISCOVER_HIRES_RENDER_SCALE = 6;
/** Server work bitmap — finer axes than client default 640. */
const DISCOVER_SERVER_MAX_WORK_DIM = 2048;
let discoverPressUntil = 0;

function setDiscoverBusy(on: boolean): void {
  for (const btn of [discoverBtn, discoverBtnSide]) {
    if (!btn) continue;
    btn.classList.toggle("is-busy", on);
    btn.disabled = on;
    btn.setAttribute("aria-busy", on ? "true" : "false");
  }
}

function beginDiscoverPress(): void {
  setDiscoverBusy(true);
  discoverPressUntil = Date.now() + DISCOVER_PRESS_MS;
}

function endDiscoverPress(): void {
  const left = discoverPressUntil - Date.now();
  if (left > 0) {
    window.setTimeout(() => setDiscoverBusy(false), left);
  } else {
    setDiscoverBusy(false);
  }
}

type ServerDiscoverOpening = {
  points: Pt[];
  areaPx: number;
  kind: string;
  shape: string;
  circularity: number;
  suggestedLabel: string;
};

type ServerDiscoverResponse = {
  ok?: boolean;
  error?: string;
  openings: ServerDiscoverOpening[];
  width: number;
  height: number;
  max_work_dim?: number;
  max_line_work_dim?: number;
  render_source?: string;
  meta?: DiscoverInteriorMeta;
};

type ServerDiscoverResult = {
  openings: DiscoveredOpening[] | null;
  meta?: DiscoverInteriorMeta;
  error?: string;
  serverWidth?: number;
  serverHeight?: number;
};

function formatDiscoverKindCounts(meta?: DiscoverInteriorMeta): string {
  if (!meta?.kindCounts) return "";
  const parts: string[] = [];
  const { kindCounts } = meta;
  if (kindCounts.line_rect) parts.push(`${kindCounts.line_rect}× lijn-kader`);
  if (kindCounts.dark_fill) parts.push(`${kindCounts.dark_fill}× vulling`);
  if (kindCounts.paper_pocket) parts.push(`${kindCounts.paper_pocket}× pocket`);
  return parts.join(", ");
}

function formatDiscoverDiag(
  usedServer: boolean,
  meta?: DiscoverInteriorMeta,
  serverError?: string,
): string {
  if (serverError) return `server mislukt (${serverError}) · lokaal`;
  if (!meta) return usedServer ? "hi-res server" : "lokaal";
  const kinds = formatDiscoverKindCounts(meta);
  const axes = `lijn-assen ${meta.lineWorkW}×${meta.lineWorkH}px`;
  const input = `invoer ${meta.inputW}×${meta.inputH}px`;
  const src = usedServer ? "server" : "lokaal";
  return [src, input, axes, kinds].filter(Boolean).join(" · ");
}

/** Server hi-res discovery — PDF render on Node (small JSON body). */
async function discoverFacadeOpeningsViaServer(
  outer: RoomSubsection,
): Promise<ServerDiscoverResult> {
  if (!activeSection || !auth()?.token) {
    return { openings: null, error: "niet ingelogd" };
  }
  try {
    const body = await apiPost<ServerDiscoverResponse>(
      "/api/floormap/discover-openings",
      {
        section_id: activeSection.id,
        outer_points: outer.points,
        min_area_fraction: discoverMinAreaFraction(),
        max_work_dim: DISCOVER_SERVER_MAX_WORK_DIM,
        max_line_work_dim: DISCOVER_SERVER_MAX_WORK_DIM,
        render_scale: DISCOVER_HIRES_RENDER_SCALE,
      },
      { timeoutMs: 180_000 },
    );
    return {
      openings: (body.openings || []).map((o) => ({
        points: o.points.map((p) => ({ x: p.x, y: p.y })),
        areaPx: o.areaPx,
        kind: o.kind as OpeningKind,
        shape: o.shape as OpeningShape,
        circularity: o.circularity,
        suggestedLabel: o.suggestedLabel,
      })),
      meta: body.meta,
      serverWidth: body.width,
      serverHeight: body.height,
    };
  } catch (err) {
    return {
      openings: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function mapHiResOpeningsToCrop(
  openings: DiscoveredOpening[],
  hiResW: number,
  hiResH: number,
  cropW: number,
  cropH: number,
): DiscoveredOpening[] {
  const scaleX = cropW / Math.max(1, hiResW);
  const scaleY = cropH / Math.max(1, hiResH);
  const areaScale = scaleX * scaleY;
  return openings.map((o) => ({
    ...o,
    points: o.points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY })),
    areaPx: o.areaPx * areaScale,
  }));
}

async function startDiscovery(): Promise<void> {
  beginDiscoverPress();
  try {
    // Let the lowered/busy style paint before the (sync) bitmap scan.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (!cropBitmap || !activeSection) {
      setStatus(`Open eerst een ${activePartNoun().title.toLowerCase()}`, "err");
      return;
    }
    endCalibrate();
    void endDetail();
    if (measure.tool !== "off") clearMeasure(false);

    // Sample from an offscreen copy — never getImageData on the live view canvas.
    const sample = document.createElement("canvas");
    sample.width = cropBitmap.width;
    sample.height = cropBitmap.height;
    const sampleCtx = sample.getContext("2d", { willReadFrequently: true } as CanvasRenderingContext2DSettings);
    if (!sampleCtx) {
      setStatus("Tekeningbeeld kan niet worden gelezen", "err");
      return;
    }
    sampleCtx.drawImage(cropBitmap, 0, 0);
    const img = sampleCtx.getImageData(0, 0, sample.width, sample.height);

    // Gevel: ontdek openingen binnen een outer VR-component (bitmap-analyse).
    if (!isFloormapKind()) {
      const outer = resolveDiscoveryOuter();
      if (!outer || outer.points.length < 3) {
        setStatus(
          "Selecteer eerst de buitencontour in de lijst (checkbox), of open die ter bewerking — daarna Ontdek openingen",
          "err",
        );
        return;
      }
      setStatus(`Openingen zoeken (hi-res) in «${outer.label || "buitencontour"}»…`, "busy");
      let found: DiscoveredOpening[] = [];
      let usedServer = false;
      let discoverMeta: DiscoverInteriorMeta | undefined;
      let serverError: string | undefined;
      try {
        const serverResult = await discoverFacadeOpeningsViaServer(outer);
        serverError = serverResult.error;
        if (serverResult.openings !== null && serverResult.serverWidth && serverResult.serverHeight) {
          found = mapHiResOpeningsToCrop(
            serverResult.openings,
            serverResult.serverWidth,
            serverResult.serverHeight,
            cropBitmap.width,
            cropBitmap.height,
          );
          discoverMeta = serverResult.meta;
          usedServer = true;
        }
      } catch (err) {
        serverError = err instanceof Error ? err.message : String(err);
      }
      if (!usedServer) {
        if (serverError) {
          setStatus(`Server ontdekken mislukt (${serverError}) — lokaal…`, "busy");
        } else {
          setStatus(`Openingen zoeken (lokaal) in «${outer.label || "buitencontour"}»…`, "busy");
        }
        const localMeta: DiscoverInteriorMeta = {
          inputW: 0,
          inputH: 0,
          workW: 0,
          workH: 0,
          lineWorkW: 0,
          lineWorkH: 0,
          kindCounts: { dark_fill: 0, paper_pocket: 0, line_rect: 0 },
        };
        try {
          found = discoverInteriorOpenings(img, outer.points, {
            minAreaFraction: discoverMinAreaFraction(),
            meta: localMeta,
          });
          discoverMeta = localMeta;
        } catch (err) {
          setStatus(err instanceof Error ? err.message : "Ontdekken mislukt", "err");
          return;
        }
      }
      await paintCropView();
      if (!found.length) {
        setStatus(
          "Geen openingen in de bitmap gevonden binnen deze buitencontour — teken handmatig of controleer contrast",
          "err",
        );
        return;
      }
      try {
        const n = await autoSaveDiscoveredOpenings(found, outer);
        selectedSetIds.clear();
        constituentSigns.clear();
        booleanPreview = null;
        await loadRooms();
        fillVgVrSuggestions();
        drawOverlay();
        syncPendingRoomButtons();
        const diag = formatDiscoverDiag(usedServer, discoverMeta, usedServer ? undefined : serverError);
        setStatus(
          n > 0
            ? `${n} opening(en) toegevoegd onder VG ${outer.vg_nr ?? "?"} · VR ${outer.vr_nr ?? "?"} (${diag})`
            : `Kandidaten overlapten bestaande componenten — niets nieuws (${diag})`,
          n > 0 ? "ok" : "busy",
        );
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "err");
      }
      return;
    }

    clearPendingRoom();
    setStatus(`${activePartNoun().plural.charAt(0).toUpperCase() + activePartNoun().plural.slice(1)} ontdekken…`, "busy");
    let found: ReturnType<typeof discoverRoomPolylines> = [];
    try {
      found = discoverRoomPolylines(img);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Ontdekken mislukt", "err");
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
        ? "Geen ruimten automatisch gevonden — pas de rode startomtrek aan op een ruimte, daarna Accepteren"
        : `${norms.length} ruimte-kandidaat(en) — sleep de rode stippellijn passend, daarna Accepteren / Overslaan`,
      seeded ? "busy" : "ok",
    );
  } finally {
    endDiscoverPress();
  }
}

async function acceptDiscovery(): Promise<void> {
  if (!discovery || !activeSection || !auth()) return;
  const points = closeRing(discovery.current);
  const label =
    discoveryLabelInput.value.trim() ||
    buildDiscoveryLabel(activePartNoun().singular, rooms.length);
  const level = discoveryLevelSelect.value || "OTHER";
  if (isFloormapKind()) {
    let nums = parseVgVrInputs();
    if (nums.vg_nr == null || nums.vr_nr == null) {
      fillVgVrSuggestions();
      nums = parseVgVrInputs();
    }
    if (nums.error || nums.vg_nr == null || nums.vr_nr == null) {
      setStatus(nums.error || "Vul VG- en VR-nummer in (zijbalk) vóór Accepteren", "err");
      return;
    }
    discoveryAcceptBtn.disabled = true;
    setStatus("Ruimte opslaan…", "busy");
    try {
      const mpu = activeScaleMpu();
      const saved = await saveDrawingSubsection({
        section_id: activeSection.id,
        label,
        level_hint: level,
        vg_nr: nums.vg_nr,
        vr_nr: nums.vr_nr,
        points,
        metres_per_norm_unit: mpu ?? undefined,
        scale_aspect_yx: activeScaleAspect(),
      });
      markRoomTouched(saved.subsection_id);
      noteLocalLabel(saved.subsection_id, label);
      upsertOptimisticRoom({
        id: saved.subsection_id,
        section_id: activeSection.id,
        label,
        level_hint: level,
        vg_nr: nums.vg_nr,
        vr_nr: nums.vr_nr,
        points: points.map((p) => ({ ...p })),
        area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
        area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
        perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
        perimeter_norm: null,
        metres_per_norm_unit: mpu,
        analysis_status: "ok",
        sort_order: rooms.length,
        analysis: saved.analysis || null,
      });
      roomsLoadEpoch += 1;
      await loadRooms({ preserveOrder: true });
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
  const vgVr = parseVgVrInputs();
  if (vgVr.error) {
    setStatus(vgVr.error, "err");
    return;
  }
  discoveryAcceptBtn.disabled = true;
  setStatus("Component opslaan…", "busy");
  try {
    const mpu = activeScaleMpu();
    const saved = await saveDrawingSubsection({
      section_id: activeSection.id,
      label,
      level_hint: level,
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points,
      metres_per_norm_unit: mpu ?? undefined,
      scale_aspect_yx: activeScaleAspect(),
    });
    markRoomTouched(saved.subsection_id);
    noteLocalLabel(saved.subsection_id, label);
    upsertOptimisticRoom({
      id: saved.subsection_id,
      section_id: activeSection.id,
      label,
      level_hint: level,
      vg_nr: vgVr.vg_nr,
      vr_nr: vgVr.vr_nr,
      points: points.map((p) => ({ ...p })),
      area_m2: saved.area_m2 != null ? Number(saved.area_m2) : null,
      area_norm: saved.area_norm != null ? Number(saved.area_norm) : null,
      perimeter_m: saved.perimeter_m != null ? Number(saved.perimeter_m) : null,
      perimeter_norm: null,
      metres_per_norm_unit: mpu,
      analysis_status: "ok",
      sort_order: rooms.length,
      analysis: saved.analysis || null,
    });
    roomsLoadEpoch += 1;
    await loadRooms({ preserveOrder: true });
    discovery.index += 1;
    showDiscoveryCandidate();
    if (discovery && discovery.index < discovery.candidates.length) {
      const vgBit =
        vgVr.vg_nr != null && vgVr.vr_nr
          ? ` · VG ${vgVr.vg_nr} · VR ${vgVr.vr_nr}`
          : " · nog geen VG/VR";
      setStatus(
        `Opgeslagen ${label}${vgBit} — volgende kandidaat (${discovery.index + 1} van ${discovery.candidates.length})`,
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
      setStatus("Minstens 3 ankers nodig", "err");
      return false;
    }
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    discovery.dragVertex = null;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(`Anker verwijderd (${ringVertexCount(next)} over)`, "ok");
    return true;
  }
  if (pendingRoom?.closed) {
    const next = removeRingVertex(pendingRoom.points, index);
    if (!next) {
      setStatus("Minstens 3 ankers nodig", "err");
      return false;
    }
    pendingRoom.points = next;
    pendingRoom.dragVertex = null;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
    setStatus(`Anker verwijderd (${ringVertexCount(next)} over)`, "ok");
    return true;
  }
  return false;
}

/** Insert a corner on the edge under the cursor (between two existing anchors). */
function insertVertexOnActiveOutline(norm: Pt): boolean {
  const maxPx = polylineHitRadiusPx();
  if (discovery?.current) {
    const edge = hitPolylineEdgeCore(norm, discovery.current, maxPx, canvasWidth, canvasHeight);
    if (!edge) return false;
    const next = insertRingVertex(discovery.current, edge.segmentIndex, edge.point);
    if (!next) return false;
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    discovery.dragVertex = edge.segmentIndex + 1;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(`Anker toegevoegd (${ringVertexCount(next)} totaal) — sleep naar de juiste plek`, "ok");
    return true;
  }
  if (pendingRoom?.closed) {
    const edge = hitPolylineEdgeCore(norm, pendingRoom.points, maxPx, canvasWidth, canvasHeight);
    if (!edge) return false;
    const next = insertRingVertex(pendingRoom.points, edge.segmentIndex, edge.point);
    if (!next) return false;
    pendingRoom.points = next;
    pendingRoom.dragVertex = edge.segmentIndex + 1;
    pendingRoom.dragBodyLast = null;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
    setStatus(`Anker toegevoegd (${ringVertexCount(next)} totaal) — sleep naar de juiste plek`, "ok");
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
      after < before ? `Vereenvoudigd ${before} → ${after} ankers` : "Omtrek is al eenvoudig",
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
      after < before ? `Vereenvoudigd ${before} → ${after} ankers` : "Omtrek is al eenvoudig",
      "ok",
    );
  }
}

function nudgeCurrent(dx: number, dy: number): void {
  if (discovery?.current) {
    discovery.current = translateRingUnclamped(discovery.current, dx, dy);
    discovery.candidates[discovery.index] = closeRing(discovery.current);
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (pendingRoom?.closed) {
    pendingRoom.points = translateRingUnclamped(pendingRoom.points, dx, dy);
    if (pendingRoom.holes?.length) {
      pendingRoom.holes = pendingRoom.holes.map((h) => translateRingUnclamped(h, dx, dy));
    }
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
  void endDetail();
  if (measure.tool !== "off") clearMeasure(false);
  if (calibrate) {
    endCalibrate("Kalibratie geannuleerd");
    return;
  }
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Klik beide uiteinden van een bekende lengte op de plattegrond.";
  calibrateBtn.textContent = "Kalibratie annuleren";
  setStatus("Klik eerste schaalpunt", "busy");
  drawOverlay();
}

function repickCalibrate(): void {
  if (!calibrate) return;
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Klik beide uiteinden van een bekende lengte op de plattegrond.";
  setStatus("Klik eerste schaalpunt", "busy");
  drawOverlay();
}

function formatScaleSaveError(err: unknown): string {
  let raw = err instanceof Error ? err.message : String(err);
  raw = raw.replace(/^ERROR:\s*/i, "").trim();
  // Postgres nested detail is noisy; keep the actionable first line.
  const first = raw.split(/\r?\n/)[0] || raw;
  if (/record .* is not assigned/i.test(first) || /metrics recompute failed/i.test(first)) {
    return "Schaal opslaan mislukt: databasefunctie voor herberekening faalde. Vernieuw de pagina of herstart de server.";
  }
  return first.length > 220 ? `${first.slice(0, 217)}…` : first;
}

async function finishCalibrate(): Promise<void> {
  if (!activeSection) {
    setStatus("Geen plattegrond actief — open eerst een sectie", "err");
    return;
  }
  if (!calibrate || calibrate.points.length < 2) {
    setStatus("Markeer eerst twee schaalpunten op de tekening", "err");
    return;
  }
  const mm = Number(calibrateMetresInput.value);
  if (!(mm > 0)) {
    setStatus("Voer een positieve lengte in millimeters in", "err");
    return;
  }
  const a = calibrate.points[0];
  const b = calibrate.points[1];
  const aspect = activeScaleAspect();
  const mpu = metresPerNormFromCalibration(mm / 1000, a, b, aspect);
  if (!(mpu > 0) || !Number.isFinite(mpu)) {
    setStatus("Kalibratiepunten te dicht bij elkaar", "err");
    return;
  }
  const hadScale =
    activeSection.metres_per_norm_unit != null && Number(activeSection.metres_per_norm_unit) > 0;
  const nComp = rooms.length;
  if (hadScale || nComp > 0) {
    const ok = window.confirm(
      `Nieuwe schaal toepassen en alle maten op deze tekening herberekenen?\n\n` +
        `• ${nComp} component(en) / ruimte(n) krijgen nieuwe m² of m\n` +
        `• Kierlengtes worden bijgewerkt\n` +
        `• Opgeslagen GA-resultaten voor geraakte VR’s worden gewist (daarna opnieuw Herberekenen)\n\n` +
        `Contouren en materialen blijven behouden.`,
    );
    if (!ok) {
      setStatus("Schaalwijziging geannuleerd", "err");
      return;
    }
  }
  try {
    setStatus("Schaal opslaan en maten herberekenen…", "busy");
    const stats = await persistSectionScale({
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
    // Stale local saves must not keep pre-scale "geen schaal" metrics in the list.
    localRoomPatches.clear();
    applyScaleToInMemoryRooms(mpu);
    const msg = formatScaleRecomputeMsg(stats, `lijn = ${mm} mm`);
    endCalibrate(msg);
    updateMeasureReadouts();
    updateToolHint();
    renderRoomList();
    await loadRooms();
    renderRoomList();
    setStatus(msg, "ok");
  } catch (err) {
    const msg = formatScaleSaveError(err);
    setStatus(msg, "err");
    scaleStatusEl.textContent = "Opslaan mislukt — schaal niet gezet";
    setCalibrateLed(false);
  }
}

/** Immediate list feedback after scale save (before server list round-trip). */
function applyScaleToInMemoryRooms(mpu: number): void {
  const aspect = activeScaleAspect();
  for (const r of rooms) {
    r.metres_per_norm_unit = mpu;
    if (!r.points?.length) continue;
    try {
      if (componentIsLengthQuantity(r)) {
        const len = scaledPathLength(r.points, mpu, aspect, true);
        r.perimeter_m = Math.round(len * 100) / 100;
        r.area_m2 = null;
        if (r.analysis) {
          r.analysis = { ...r.analysis, length_m: r.perimeter_m };
        }
        continue;
      }
      if (r.analysis?.kozijn_role === "wood" && r.analysis.kozijn_frame) {
        const parsed = parseKozijnFrame(r.analysis.kozijn_frame);
        if (parsed?.segments.length) {
          const beam = kozijnWoodBeamMetrics(parsed.segments, mpu, aspect);
          r.area_norm = beam.areaNorm;
          r.area_m2 = beam.areaM2;
          r.perimeter_m = beam.lengthM;
          r.analysis = {
            ...r.analysis,
            area_norm: beam.areaNorm,
            area_m2: beam.areaM2 ?? undefined,
            kozijn_frame: {
              ...r.analysis.kozijn_frame,
              wood_beam_length_m: beam.lengthM,
              wood_area_m2: beam.areaM2,
            },
          };
          continue;
        }
      }
      const holes = Array.isArray(r.analysis?.holes) ? r.analysis!.holes! : [];
      const holesSum = holes
        .filter((h) => Array.isArray(h) && h.length >= 3)
        .reduce((s, h) => s + shoelaceArea(h), 0);
      const areaNorm = Math.max(0, shoelaceArea(r.points) - holesSum);
      r.area_norm = areaNorm;
      r.area_m2 = Math.round(scaledAreaM2(areaNorm, mpu, aspect) * 100) / 100;
      r.perimeter_m = Math.round(scaledPathLength(r.points, mpu, aspect, true) * 100) / 100;
    } catch {
      /* keep previous metrics */
    }
  }
}

function deleteTargetIds(): string[] {
  if (!isFloormapKind() && selectedSetIds.size > 0) {
    return rooms.filter((r) => selectedSetIds.has(r.id)).map((r) => r.id);
  }
  if (pendingRoom?.editingId) return [pendingRoom.editingId];
  return [];
}

function deleteConfirmKey(ids: string[]): string {
  return ids.slice().sort().join("\n");
}

function deleteConfirmLabel(ids: string[]): string {
  const names = ids.map((id) => rooms.find((r) => r.id === id)?.label || "component");
  if (names.length === 1) return `«${names[0]}»`;
  const shown = names.slice(0, 4).join(", ");
  const extra = names.length > 4 ? ` +${names.length - 4}` : "";
  return `${names.length} componenten (${shown}${extra})`;
}

function clearPendingDeleteConfirm(): void {
  pendingDeleteId = null;
  if (pendingDeleteTimer != null) {
    window.clearTimeout(pendingDeleteTimer);
    pendingDeleteTimer = null;
  }
}

async function deleteRooms(ids: string[]): Promise<void> {
  if (!ids.length) {
    setStatus("Vink componenten aan of open er één om te verwijderen", "err");
    return;
  }
  const key = deleteConfirmKey(ids);
  const uniqueComposed = ids.length === 1 && rooms.some((r) => r.id === ids[0] && isComposeResultRoom(r));
  if (pendingDeleteId !== key) {
    clearPendingDeleteConfirm();
    pendingDeleteId = key;
    pendingDeleteTimer = window.setTimeout(() => {
      pendingDeleteId = null;
      pendingDeleteTimer = null;
      renderRoomList();
      syncPendingRoomButtons();
    }, 8000);
    renderRoomList();
    syncPendingRoomButtons();
    setStatus(
      uniqueComposed
        ? `Bevestig wissen van ${deleteConfirmLabel(ids)} (bronnen blijven behouden) — klik nogmaals op Bevestig wissen`
        : `Bevestig wissen van ${deleteConfirmLabel(ids)} — klik nogmaals op Bevestig wissen`,
      "busy",
    );
    return;
  }
  clearPendingDeleteConfirm();
  syncPendingRoomButtons();
  const failed: string[] = [];
  try {
    setStatus(
      ids.length === 1
        ? `Verwijderen: ${deleteConfirmLabel(ids)}…`
        : `Verwijderen: ${ids.length} componenten…`,
      "busy",
    );
    const snapshots = ids
      .map((id) => rooms.find((r) => r.id === id))
      .filter((r): r is RoomSubsection => Boolean(r));
    for (const id of ids) {
      rooms = rooms.filter((r) => r.id !== id);
      noteLocalRoomDeletion(id);
      if (pendingRoom?.editingId === id) clearPendingRoom();
      if (touchedRoomIds.delete(id)) persistTouchedRoomIds();
      selectedSetIds.delete(id);
      constituentSigns.delete(id);
    }
    roomsLoadEpoch += 1;
    renderRoomList();
    drawOverlay();
    for (const id of ids) {
      const label = snapshots.find((r) => r.id === id)?.label || id;
      try {
        await deleteDrawingSubsection(id);
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        const msg = /restrict|foreign key|verblijfsruimte/i.test(raw)
          ? `«${label}» is nog gekoppeld aan een verblijfsruimte of andere data`
          : `«${label}»: ${raw}`;
        failed.push(msg);
        const snap = snapshots.find((r) => r.id === id);
        if (snap) {
          localRoomDeletions.delete(normRoomId(id));
          if (!rooms.some((r) => r.id === snap.id)) rooms = [...rooms, snap];
        }
      }
    }
    rooms = dropLocallyDeletedRooms(rooms);
    renderRoomList();
    drawOverlay();
    if (!failed.length) {
      // Server list is authoritative after delete — drop stale discovery/save patches
      // that would resurrect removed rooms or roll geometry back (e.g. round → rect).
      localRoomPatches.clear();
    }
    await loadRooms();
    if (failed.length) {
      setStatus(
        failed.length === ids.length
          ? `Verwijderen mislukt. ${failed[0]}`
          : `${ids.length - failed.length} verwijderd, ${failed.length} mislukt. ${failed[0]}`,
        "err",
      );
      return;
    }
    setStatus(
      uniqueComposed
        ? `Samengesteld component verwijderd (bronnen blijven behouden)`
        : ids.length > 1
          ? `${ids.length} componenten verwijderd`
          : "Component verwijderd",
      "ok",
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    setStatus(raw, "err");
    renderRoomList();
  }
}

async function deleteRoom(id: string): Promise<void> {
  await deleteRooms([id]);
}

async function deletePendingRoom(): Promise<void> {
  const ids = deleteTargetIds();
  if (!ids.length) {
    setStatus("Vink componenten aan (checkbox) of open er één om te verwijderen", "err");
    return;
  }
  await deleteRooms(ids);
}

let roomDragId: string | null = null;

type RoomOrderSnapshot = { room: RoomSubsection; sort_order: number };

async function commitRoomOrder(prevOrder: RoomOrderSnapshot[]): Promise<void> {
  if (!auth()?.token || !activeSection) return;
  try {
    renderRoomList();
    drawOverlay();
  } catch (err) {
    console.warn("commitRoomOrder: local render failed", err);
  }
  try {
    const allIds = await allSubsectionIdsForSection(activeSection.id);
    const orderedIds = mergeReorderIds(
      rooms.map((r) => r.id),
      allIds,
    );
    if (orderedIds.length !== allIds.length) {
      throw new Error(
        `Volgorde opslaan mislukt: lijst out of sync (${orderedIds.length}/${allIds.length} componenten) — herlaad de sectie`,
      );
    }
    await reorderDrawingSubsections(activeSection.id, orderedIds);
    setStatus("Volgorde opgeslagen", "ok");
  } catch (err) {
    rooms = prevOrder.map((p) => {
      p.room.sort_order = p.sort_order;
      return p.room;
    });
    try {
      renderRoomList();
      drawOverlay();
    } catch {
      /* keep restored rooms even if render glitches */
    }
    setStatus(err instanceof Error ? err.message : String(err), "err");
    try {
      await loadRooms();
    } catch {
      /* keep reverted local order — do not clear the list */
    }
  }
}

/** Persist list order after swapping two adjacent components (delta = −1 or +1). */
async function moveRoom(roomId: string, delta: -1 | 1): Promise<void> {
  if (!auth()?.token || !activeSection) return;
  syncPendingLabelToRooms();
  const index = rooms.findIndex((r) => r.id === roomId);
  const j = index + delta;
  if (index < 0 || j < 0 || index >= rooms.length || j >= rooms.length) return;

  const prevOrder = rooms.map((r) => ({ room: r, sort_order: r.sort_order }));
  const next = rooms.slice();
  const tmp = next[index];
  if (!tmp || !next[j]) return;
  next[index] = next[j];
  next[j] = tmp;
  next.forEach((r, i) => {
    r.sort_order = i;
  });
  rooms = next;
  await commitRoomOrder(prevOrder);
}

/** Drop `fromId` onto `toId` in the saved-components list (same UX as engineer regions). */
async function reorderRoomsByDrag(fromId: string, toId: string): Promise<void> {
  if (!fromId || !toId || fromId === toId) return;
  if (!auth()?.token || !activeSection) return;
  syncPendingLabelToRooms();
  const fromIdx = rooms.findIndex((r) => r.id === fromId);
  const toIdx = rooms.findIndex((r) => r.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;

  const prevOrder = rooms.map((r) => ({ room: r, sort_order: r.sort_order }));
  const next = rooms.slice();
  const [moved] = next.splice(fromIdx, 1);
  if (!moved) return;
  next.splice(toIdx, 0, moved);
  next.forEach((r, i) => {
    r.sort_order = i;
  });
  rooms = next;
  await commitRoomOrder(prevOrder);
}

function hitVertex(norm: Pt, points: Pt[], pxRadius = 8): number {
  return hitVertexCore(norm, points, canvasWidth, canvasHeight, pxRadius);
}

/** Larger grab targets while detail-zoom is active (small components). */
function vertexHitRadiusPx(): number {
  return vertexHitRadiusPxCore(Boolean(detail));
}

function vertexHandleRadiusPx(): number {
  return vertexHandleRadiusPxCore(Boolean(detail));
}

function canClosePolygonAtCursor(norm: Pt, points: Pt[]): boolean {
  return canClosePolygonAtCursorCore(norm, points, canvasWidth, canvasHeight, Boolean(detail));
}

function pendingDrawCanClose(): boolean {
  return Boolean(
    pendingRoom?.drawing &&
      !pendingRoom.closed &&
      pendingRoom.points.length >= 3 &&
      pendingRoom.drawCursor &&
      canClosePolygonAtCursor(pendingRoom.drawCursor, pendingRoom.points),
  );
}

/** Snap the live draw cursor onto the first vertex when closing is available. */
function effectivePendingDrawCursor(norm: Pt): Pt {
  if (!pendingRoom?.drawing || pendingRoom.closed) return norm;
  if (canClosePolygonAtCursor(norm, pendingRoom.points)) {
    return { ...pendingRoom.points[0] };
  }
  return norm;
}

function drawCanvasCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  lineWidth = 1.5,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(x - size, y);
  ctx.lineTo(x + size, y);
  ctx.moveTo(x, y - size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
  ctx.restore();
}

function drawOpenPolygonDraft(ctx: CanvasRenderingContext2D, room: PendingRoom): void {
  const pts = room.points;
  if (!pts.length) return;
  const canClose = pts.length >= 3;
  const snap = canClose && room.drawCursor != null && canClosePolygonAtCursor(room.drawCursor, pts);
  const cursorNorm = room.drawCursor ? (snap ? pts[0] : room.drawCursor) : null;
  const firstC = normToCanvas(pts[0]);
  const lastC = normToCanvas(pts[pts.length - 1]);
  const cursorC = cursorNorm ? normToCanvas(cursorNorm) : null;
  const hr = vertexHandleRadiusPx();

  if (cursorC) {
    ctx.strokeStyle = snap ? "#1b5e20" : "#43a047";
    ctx.lineWidth = snap ? 2.5 : 1.5;
    ctx.setLineDash(snap ? [5, 3] : [6, 4]);
    ctx.beginPath();
    ctx.moveTo(lastC.x, lastC.y);
    ctx.lineTo(cursorC.x, cursorC.y);
    if (snap) ctx.lineTo(firstC.x, firstC.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (let i = 0; i < pts.length; i++) {
    const c = normToCanvas(pts[i]);
    const isFirst = i === 0;
    const r = isFirst ? (snap ? hr * 2.4 : canClose ? hr * 1.75 : hr * 1.25) : hr;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    if (isFirst) {
      ctx.fillStyle = snap ? "rgba(27,94,32,0.42)" : canClose ? "rgba(46,125,50,0.22)" : "rgba(255,255,255,0.35)";
      ctx.strokeStyle = snap ? "#1b5e20" : canClose ? "#2e7d32" : "#00bcd4";
      ctx.lineWidth = snap ? 2.5 : 2;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.strokeStyle = "#00bcd4";
      ctx.lineWidth = detail ? 1.5 : 1;
    }
    ctx.fill();
    ctx.stroke();
    if (isFirst) {
      drawCanvasCrosshair(ctx, c.x, c.y, snap ? 11 : canClose ? 8 : 5, isFirst && snap ? "#1b5e20" : "#2e7d32", snap ? 2 : 1.25);
      if (snap) {
        ctx.fillStyle = "#1b5e20";
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Sluiten", c.x, c.y - r - 7);
      } else if (canClose) {
        ctx.fillStyle = "#2e7d32";
        ctx.font = "500 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("start", c.x, c.y - r - 6);
      }
    }
  }

  if (cursorC && !snap) {
    drawCanvasCrosshair(ctx, cursorC.x, cursorC.y, 7, "#43a047", 1.25);
  }
}

function polylineHitRadiusPx(): number {
  return polylineHitRadiusPxCore(Boolean(detail));
}

function hitNearPolyline(norm: Pt, points: Pt[], maxPx: number): boolean {
  return hitNearPolylineCore(norm, points, maxPx, canvasWidth, canvasHeight);
}

/** Ray-cast point-in-polygon for a (possibly closed) ring. */
function pointInRing(pt: Pt, points: Pt[]): boolean {
  return pointInRingCore(pt, points);
}

function roomIsOpenPath(room: RoomSubsection): boolean {
  if (room.analysis?.open_path) return true;
  if (room.analysis?.quantity_kind === "length" && room.points.length >= 2) {
    const a = room.points[0];
    const b = room.points[room.points.length - 1];
    return Math.hypot(a.x - b.x, a.y - b.y) > 1e-4;
  }
  return ringVertexCount(room.points) < 3;
}

/** True if `norm` hits this room (fill, or near open polyline). Holes exclude the outer. */
function roomHitByNorm(room: RoomSubsection, norm: Pt, points: Pt[], holes: Pt[][]): boolean {
  if (!points.length) return false;
  const open =
    roomIsOpenPath(room) ||
    (ringVertexCount(points) < 3 && points.length >= 2);
  if (open) {
    return hitNearPolyline(norm, points, polylineHitRadiusPx());
  }
  if (ringVertexCount(points) < 3) return false;
  if (!pointInRing(norm, points)) return false;
  for (const h of holes) {
    if (ringVertexCount(h) >= 3 && pointInRing(norm, h)) return false;
  }
  return true;
}

/**
 * Pick the most specific component under the cursor (smallest area among hits).
 * Uses live pending geometry for the room being edited.
 */
function pickRoomAtNorm(norm: Pt): RoomSubsection | null {
  const hits: RoomSubsection[] = [];
  for (const r of rooms) {
    const live = pendingRoom?.editingId === r.id ? pendingRoom : null;
    const pts = live ? live.points : r.points;
    const holes = live
      ? live.holes || []
      : Array.isArray(r.analysis?.holes)
        ? r.analysis!.holes!.map((h) => coerceRingPoints(h)).filter((h) => h.length >= 3)
        : [];
    const probe: RoomSubsection = live
      ? {
          ...r,
          points: pts,
          analysis: {
            ...(r.analysis || {}),
            open_path: !live.closed,
            holes: live.closed ? holes : undefined,
          },
        }
      : r;
    if (roomHitByNorm(probe, norm, pts, holes)) hits.push(r);
  }
  if (!hits.length) return null;
  hits.sort((a, b) => {
    const aa = subsectionAreaNorm(a);
    const ab = subsectionAreaNorm(b);
    if (aa > 1e-12 && ab > 1e-12) return aa - ab;
    if (aa > 1e-12) return -1;
    if (ab > 1e-12) return 1;
    return (a.label || "").localeCompare(b.label || "", "nl");
  });
  return hits[0];
}

overlayCanvas.addEventListener("mousedown", (ev) => {
  const c = eventToCanvas(ev);
  const norm = canvasToNorm(c.x, c.y);

  if (detailPick) {
    detailPick.armed = false;
    detailPick.start = { ...norm };
    detailPick.current = { ...norm };
    drawOverlay();
    return;
  }

  if (calibrate) {
    if (calibrate.points.length >= 2) return;
    calibrate.points.push(norm);
    drawOverlay();
    if (calibrate.points.length === 1) {
      setStatus("Klik tweede schaalpunt", "busy");
      calibrateHintEl.textContent = "Klik het andere uiteinde van de bekende lengte.";
    } else if (calibrate.points.length >= 2) {
      calibrateMetresWrap.classList.remove("hidden");
      calibrateHintEl.textContent =
        "Voer de werkelijke lengte in millimeters in, daarna Toepassen (of druk Enter).";
      setStatus("Voer lengte in mm in, daarna Toepassen", "ok");
      queueMicrotask(() => {
        calibrateMetresInput.focus();
        calibrateMetresInput.select();
      });
    }
    return;
  }

  if (kozijnDraft) {
    // Space+sleep = pannen; alleen linkerknop plaatst punten.
    if (ev.button !== 0) return;
    if (kozijnPanKey) {
      ev.preventDefault();
      kozijnPanDrag = {
        x: ev.clientX,
        y: ev.clientY,
        left: pdfScrollEl.scrollLeft,
        top: pdfScrollEl.scrollTop,
      };
      overlayCanvas.style.cursor = "grabbing";
      return;
    }
    ev.preventDefault();
    if (ev.detail === 2) {
      if (closeKozijnAtJunction(norm)) return;
      if (kozijnDraft.livePoints.length >= 2) {
        commitKozijnLiveLine();
        if (kozijnDraft.phase === "mullion" && kozijnDraft.woodSubsectionId) {
          void saveKozijnDraft({ keepOpen: true });
        } else {
          reportKozijnClosureAfterCommit();
        }
      }
      return;
    }
    // 1) Buitenste kader: snap op startpunt → sluiten.
    if (
      kozijnDraft.phase === "frame" &&
      !kozijnDraft.frameClosed &&
      kozijnFrameCloseSnap(norm)
    ) {
      closeKozijnOuterFrame();
      return;
    }
    if (kozijnDraft.phase === "frame" && kozijnDraft.frameClosed) {
      setStatus("Kader is gesloten — klik Opslaan, daarna dwarsbalken tekenen", "busy");
      return;
    }
    const { pt, atJunction } = effectiveKozijnDrawPoint(norm);
    // 3) Dwarsbalk: klik op tweede kaderzijde → lijn vast.
    if (kozijnDraft.phase === "mullion" && atJunction && kozijnDraft.livePoints.length >= 1) {
      const last = kozijnDraft.livePoints[kozijnDraft.livePoints.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 1e-9) {
        kozijnDraft.livePoints.push({ ...pt });
      }
      if (kozijnDraft.livePoints.length >= 2) {
        commitKozijnLiveLine();
        reportKozijnClosureAfterCommit();
        return;
      }
    }
    kozijnDraft.livePoints.push({ ...pt });
    kozijnDraft.cursor = null;
    syncKozijnEval();
    drawOverlay();
    return;
  }

  if (pendingRoom?.drawing && !pendingRoom.closed) {
    if (pendingRoom.points.length >= 3 && (canClosePolygonAtCursor(norm, pendingRoom.points) || ev.detail === 2)) {
      closePendingPolygon();
      return;
    }
    pendingRoom.drawCursor = null;
    pendingRoom.points.push(norm);
    syncPendingRoomButtons();
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    return;
  }

  if (pendingRoom && !pendingRoom.drawing) {
    // Prefer corner grab over body-drag; larger hit target in detail-zoom.
    const vertexHitPx = vertexHitRadiusPx();
    const vi = hitVertex(norm, pendingRoom.points, vertexHitPx);
    if (vi >= 0) {
      ev.preventDefault();
      if (ev.detail === 2 && pendingRoom.closed) {
        removeVertexFromActiveOutline(vi);
        return;
      }
      pendingRoom.dragVertex = vi;
      pendingRoom.dragBodyLast = null;
      overlayCanvas.style.cursor = "grabbing";
      return;
    }
    // Double-click on an edge inserts a corner between the two endpoints.
    if (ev.detail === 2 && pendingRoom.closed && insertVertexOnActiveOutline(norm)) {
      ev.preventDefault();
      return;
    }
    const nearLine = hitNearPolyline(norm, pendingRoom.points, polylineHitRadiusPx());
    const inside = pendingRoom.closed && pointInRing(norm, pendingRoom.points);
    if (nearLine || inside) {
      ev.preventDefault();
      pendingRoom.dragBodyLast = canvasToNormUnclamped(c.x, c.y);
      pendingRoom.dragVertex = null;
      overlayCanvas.style.cursor = "grabbing";
      return;
    }
    // Click outside the edited outline → select another component under the cursor.
  }

  if (measure.tool === "length") {
    if (!activeScaleMpu()) {
      setStatus("Zet eerst de schaal", "err");
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
    if (ev.detail === 2 && insertVertexOnActiveOutline(norm)) {
      ev.preventDefault();
      return;
    }
    return;
  }

  // Idle / editing: click a drawn component to select it (activates list + edit dock).
  if (!pendingRoom?.drawing && measure.tool === "off" && !calibrate && !detailPick) {
    const hit = pickRoomAtNorm(norm);
    if (hit && pendingRoom?.editingId !== hit.id) {
      ev.preventDefault();
      editRoom(hit);
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

  if (detailPick && !detailPick.armed) {
    detailPick.current = { ...norm };
    drawOverlay();
    return;
  }

  // Vertex/body drag is handled on window so it survives leaving the overlay
  // (detail-zoom edges / sidebar). Skip while dragging.
  if (pendingRoom?.dragVertex != null || pendingRoom?.dragBodyLast) return;

  if (kozijnDraft) {
    if (kozijnPanDrag) {
      const dx = ev.clientX - kozijnPanDrag.x;
      const dy = ev.clientY - kozijnPanDrag.y;
      pdfScrollEl.scrollLeft = kozijnPanDrag.left - dx;
      pdfScrollEl.scrollTop = kozijnPanDrag.top - dy;
      overlayCanvas.style.cursor = "grabbing";
      return;
    }
    if (kozijnPanKey || ev.buttons !== 0) {
      // Pannen / sleep: rubberband niet meeslepen.
      overlayCanvas.style.cursor = kozijnPanKey ? "grab" : "crosshair";
      return;
    }
    const { pt, atJunction } = effectiveKozijnDrawPoint(norm);
    kozijnDraft.cursor = pt;
    overlayCanvas.style.cursor = atJunction ? "pointer" : "crosshair";
    syncKozijnEval();
    drawOverlay();
    return;
  }

  if (pendingRoom?.drawing && !pendingRoom.closed) {
    pendingRoom.drawCursor = effectivePendingDrawCursor(norm);
    overlayCanvas.style.cursor = pendingDrawCanClose() ? "pointer" : "crosshair";
    updateMeasureReadouts();
    drawOverlay();
    return;
  }

  if (pendingRoom?.closed) {
    const onVertex = hitVertex(norm, pendingRoom.points, vertexHitRadiusPx()) >= 0;
    const inside = pointInRing(norm, pendingRoom.points);
    if (onVertex || inside) {
      overlayCanvas.style.cursor = "grab";
    } else {
      const hover = pickRoomAtNorm(norm);
      overlayCanvas.style.cursor =
        hover && hover.id !== pendingRoom.editingId ? "pointer" : "";
    }
  } else if (
    !pendingRoom?.drawing &&
    measure.tool === "off" &&
    !calibrate &&
    !detailPick &&
    !discovery
  ) {
    overlayCanvas.style.cursor = pickRoomAtNorm(norm) ? "pointer" : "";
  }

  if (measure.tool === "length" && measure.points.length < 2) {
    measure.cursor = norm;
    updateMeasureReadouts();
    drawOverlay();
    return;
  }

  if (discovery?.dragVertex != null) return;
});

overlayCanvas.addEventListener("mouseup", () => {
  if (kozijnPanDrag) {
    kozijnPanDrag = null;
    if (kozijnDraft) overlayCanvas.style.cursor = kozijnPanKey ? "grab" : "crosshair";
  }
  if (detailPick && !detailPick.armed) {
    const rect = normalizeNormRect(detailPick.start, detailPick.current);
    const keepFactor = detail?.factor ?? DETAIL_FACTOR_DEFAULT;
    void commitDetailRect(rect, keepFactor);
    return;
  }
  if (discovery) {
    if (discovery.dragVertex != null) {
      discovery.candidates[discovery.index] = closeRing(discovery.current);
      discovery.dragVertex = null;
      updateMeasureReadouts();
      drawOverlay();
    }
    return;
  }
  if (pendingRoom?.dragVertex != null || pendingRoom?.dragBodyLast) {
    pendingRoom.dragVertex = null;
    pendingRoom.dragBodyLast = null;
    overlayCanvas.style.cursor = "grab";
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
  }
});

overlayCanvas.addEventListener("mouseleave", () => {
  if (detailPick && !detailPick.armed) {
    // Cancel incomplete drag when pointer leaves the canvas
    detailPick.armed = true;
    drawOverlay();
    setStatus("Detailgebied: sleep opnieuw een rechthoek", "busy");
    return;
  }
  // Keep pendingRoom / discovery vertex drags alive across scroll-edge exits;
  // window mouseup ends them (see below).
  // Note: dragVertex can be 0 — never use truthy checks on the index.
  if (pendingRoom?.dragVertex == null && !pendingRoom?.dragBodyLast && discovery?.dragVertex == null) {
    if (pendingRoom?.drawing && !pendingRoom.closed) {
      pendingRoom.drawCursor = null;
      drawOverlay();
    }
    overlayCanvas.style.cursor = "";
  }
});

window.addEventListener("mouseup", () => {
  if (kozijnPanDrag) {
    kozijnPanDrag = null;
    if (kozijnDraft) overlayCanvas.style.cursor = kozijnPanKey ? "grab" : "crosshair";
  }
  if (pendingRoom?.dragVertex != null || pendingRoom?.dragBodyLast) {
    pendingRoom.dragVertex = null;
    pendingRoom.dragBodyLast = null;
    overlayCanvas.style.cursor = pendingRoom.closed ? "grab" : "";
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
  }
  if (discovery?.dragVertex != null) {
    discovery.candidates[discovery.index] = closeRing(discovery.current);
    discovery.dragVertex = null;
    updateMeasureReadouts();
    drawOverlay();
  }
});

// Continue vertex/body drag even when the pointer leaves the overlay (detail-zoom edges).
window.addEventListener("mousemove", (ev) => {
  if (kozijnPanDrag) {
    const dx = ev.clientX - kozijnPanDrag.x;
    const dy = ev.clientY - kozijnPanDrag.y;
    pdfScrollEl.scrollLeft = kozijnPanDrag.left - dx;
    pdfScrollEl.scrollTop = kozijnPanDrag.top - dy;
    return;
  }
  // dragVertex === 0 is valid (often top-left); must use != null, not truthy checks.
  if (pendingRoom?.dragVertex == null && !pendingRoom?.dragBodyLast && discovery?.dragVertex == null) {
    return;
  }
  if (!overlayCanvas.isConnected) return;
  const c = eventToCanvas(ev);
  const norm = canvasToNormUnclamped(c.x, c.y);

  if (pendingRoom?.dragVertex != null) {
    const i = pendingRoom.dragVertex;
    pendingRoom.points[i] = { x: norm.x, y: norm.y };
    if (i === 0 && pendingRoom.closed) {
      pendingRoom.points[pendingRoom.points.length - 1] = { ...norm };
    }
    updateMeasureReadouts();
    scheduleRoomListRefresh();
    drawOverlay();
    return;
  }

  if (pendingRoom?.dragBodyLast) {
    const dx = norm.x - pendingRoom.dragBodyLast.x;
    const dy = norm.y - pendingRoom.dragBodyLast.y;
    if (Math.hypot(dx, dy) > 1e-9) {
      if (pendingRoom.closed) {
        pendingRoom.points = translateRingUnclamped(pendingRoom.points, dx, dy);
        if (pendingRoom.holes?.length && !pendingIsLengthComponent()) {
          pendingRoom.holes = pendingRoom.holes.map((h) => translateRingUnclamped(h, dx, dy));
        }
      } else {
        pendingRoom.points = pendingRoom.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      pendingRoom.dragBodyLast = { ...norm };
      updateMeasureReadouts();
      scheduleRoomListRefresh();
      drawOverlay();
    }
    return;
  }

  if (discovery?.dragVertex != null) {
    const i = discovery.dragVertex;
    discovery.current[i] = norm;
    if (i === 0) discovery.current[discovery.current.length - 1] = { ...norm };
    discovery.candidates[discovery.index] = closeRing(discovery.current);
    updateMeasureReadouts();
    drawOverlay();
  }
});

loginForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(loginForm);
  const username = String(fd.get("username") || "");
  const password = String(fd.get("password") || "");
  void (async () => {
    try {
      setStatus("Inloggen…", "busy");
      await session.bootstrapAndLogin(username, password);
      setStatus("Ingelogd", "ok");
      if (buildingId) await loadFloormapSections(buildingId);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
      showLogin();
    }
  })();
});

logoutBtn.addEventListener("click", () => {
  session.logout();
  setStatus("Uitgelogd", "ok");
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
roomVrFilterEl?.addEventListener("change", () => {
  roomListVrFilter = roomVrFilterEl.value;
  // Sticky VG/VR for new components when filtering to a plattegrond-VR on this gevel.
  if (!isFloormapKind() && roomListVrFilter) {
    roomVrInput.value = roomListVrFilter;
    const vg = buildingVrToVg.get(roomListVrFilter);
    if (vg != null) roomVgInput.value = String(vg);
  }
  if (buildingId) {
    persistFlowVr(
      buildingId,
      roomListVrFilter || null,
      roomListVrFilter ? buildingVrToVg.get(roomListVrFilter) ?? null : null,
    );
  }
  if (activeSection) syncFloormapLocation(activeSection.id);
  renderRoomList();
  drawOverlay();
});
roomGroepFilterEl?.addEventListener("change", () => {
  const v = (roomGroepFilterEl.value || "").trim();
  roomListGroepFilter = v === "1" || v === "2" || v === "3" ? v : "";
  renderRoomList();
  drawOverlay();
  setStatus(
    roomListGroepFilter
      ? `Filter gevelgroep ${roomListGroepFilter} — nieuwe componenten (kozijn/glas) komen hier terecht`
      : "Alle gevelgroepen",
    "ok",
  );
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
materialFavoriteEl?.addEventListener("change", () => {
  const id = (materialFavoriteEl.value || "").trim();
  if (!id) {
    syncFavoriteButtons();
    updateMaterialSpectrumPreview(null);
    return;
  }
  // In picklist-modus: alleen preview + klaarzetten voor «+ Aan picklist»; niet toewijzen aan component.
  if (sidebarWorkMode === "picklist" && !isFloormapKind()) {
    const mat = favoriteMaterials.find((m) => m.material_id === id) || null;
    updateMaterialSpectrumPreview(mat);
    syncFavoriteButtons();
    if (assignPicklistEl && favoriteMaterials.some((m) => m.material_id === id)) {
      assignPicklistEl.value = id;
    }
    setStatus(`Picklist: «${mat?.name || id}» geselecteerd`, "ok");
    return;
  }
  void selectMaterialById(id, true).catch((err) =>
    setStatus(err instanceof Error ? err.message : String(err), "err"),
  );
});

function gaCalcUrl(): string {
  if (!buildingId) return "/ga.html";
  const q = new URLSearchParams({ building_id: buildingId });
  const vr =
    normalizeFlowVrNr(roomListVrFilter) ||
    normalizeFlowVrNr(roomVrInput.value) ||
    normalizeFlowVrNr(readFlowVr(buildingId)?.vr_nr);
  if (vr) {
    q.set("vr_nr", vr);
    const vg = buildingVrToVg.get(vr) ?? Number(roomVgInput.value || NaN);
    if (Number.isFinite(vg) && vg >= 1) q.set("vg_nr", String(vg));
    persistFlowVr(buildingId, vr, Number.isFinite(vg) ? vg : null);
  }
  return `/ga.html?${q.toString()}`;
}

workModeEl?.addEventListener("click", (ev) => {
  const btn = (ev.target as HTMLElement | null)?.closest?.("button[data-mode]") as
    | HTMLButtonElement
    | null;
  if (!btn || !workModeEl.contains(btn)) return;
  const mode = btn.dataset.mode;
  if (mode === "ga") {
    if (!buildingId) {
      setStatus("Kies eerst een project om naar GA-berekening te gaan", "err");
      return;
    }
    setStatus("Naar GA-berekening…", "busy");
    window.location.assign(gaCalcUrl());
    return;
  }
  if (mode === "picklist" || mode === "draw" || mode === "assign" || mode === "compose") {
    setSidebarWorkMode(mode);
    setStatus(
      mode === "picklist"
        ? "Modus: picklist samenstellen"
        : mode === "assign"
          ? "Modus: materiaal koppelen — selecteer componenten + picklist"
          : mode === "compose"
            ? "Modus: finale oppervlakten — selecteer componenten voor +/− compositie"
            : "Modus: componenten tekenen",
      "ok",
    );
  }
});

assignPicklistEl?.addEventListener("change", () => {
  const id = (assignPicklistEl.value || "").trim();
  const mat = favoriteMaterials.find((m) => m.material_id === id) || null;
  updateMaterialSpectrumPreview(mat);
  materialSpectrumEl?.classList.toggle("hidden", !mat);
  syncAssignSelectionHint();
  syncAssignRegel2Hint();
});

assignMatBtn?.addEventListener("click", () => {
  void assignPicklistMaterialToSelection();
});

assignClearSelBtn?.addEventListener("click", () => {
  selectedAssignIds.clear();
  syncAssignSelectionHint();
  renderRoomList();
  setStatus("Materiaalselectie gewist", "ok");
});
favoriteAddBtn?.addEventListener("click", () => {
  const id = (materialIdEl?.value || materialFavoriteEl?.value || "").trim();
  void addMaterialFavorite(id);
});
favoriteRemoveBtn?.addEventListener("click", () => {
  const id = (materialIdEl?.value || materialFavoriteEl?.value || "").trim();
  void removeMaterialFavorite(id);
});
presetSaveBtn?.addEventListener("click", () => {
  if (!buildingId || !auth()?.token) return;
  const name = window.prompt("Naam voor deze favorieten-preset:");
  if (!name?.trim()) return;
  const run = bppPhase1Enabled()
    ? bppMaterialFavoritePresetAction(invokeString, auth()!.token, {
        action: "save",
        name: name.trim(),
        building_id: buildingId,
      })
    : apiPost("/api/floormap/material-favorite-presets", {
        action: "save",
        name: name.trim(),
        building_id: buildingId,
      });
  void run
    .then((data: { material_count?: number }) => {
      setStatus(`Preset opgeslagen (${data.material_count ?? "?"} materialen)`, "ok");
    })
    .catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
});
presetApplyBtn?.addEventListener("click", () => {
  if (!buildingId || !auth()?.token) return;
  void (async () => {
    const data = bppPhase1Enabled()
      ? await bppListMaterialFavoritePresets(invokeString, auth()!.token)
      : await apiGet<{
          presets: Array<{ preset_id: string; name: string; material_count: number }>;
        }>("/api/floormap/material-favorite-presets");
    const presets = data.presets || [];
    if (!presets.length) {
      setStatus("Geen presets beschikbaar", "err");
      return;
    }
    const lines = presets.map((p, i) => `${i + 1}. ${p.name} (${p.material_count})`).join("\n");
    const pick = window.prompt(`Kies preset-nummer:\n${lines}`);
    const idx = Number(pick) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= presets.length) return;
    const preset = presets[idx];
    if (
      !window.confirm(
        `Favorieten van dit project vervangen door «${preset.name}» (${preset.material_count} materialen)?`,
      )
    ) {
      return;
    }
    if (bppPhase1Enabled()) {
      await bppMaterialFavoritePresetAction(invokeString, auth()!.token, {
        action: "apply",
        preset_id: preset.preset_id,
        building_id: buildingId,
      });
    } else {
      await apiPost("/api/floormap/material-favorite-presets", {
        action: "apply",
        preset_id: preset.preset_id,
        building_id: buildingId,
      });
    }
    await loadFavoriteMaterials();
    setStatus(`Preset «${preset.name}» toegepast`, "ok");
  })().catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
});
materialIdEl?.addEventListener("change", () => {
  syncPendingRoomButtons();
  updateMaterialQuantityHint();
  updateMaterialSpectrumPreview();
  updateReplaceMaterialBtn();
  if (materialFavoriteEl && materialIdEl.value) {
    if (favoriteMaterials.some((m) => m.material_id === materialIdEl.value)) {
      materialFavoriteEl.value = materialIdEl.value;
    } else {
      materialFavoriteEl.value = "";
    }
  }
  syncFavoriteButtons();
  // Eerste materiaalkuze tijdens kozijn-tekenen = kozijnmateriaal (vóór wissel naar glas).
  if (kozijnDraft && !kozijnDraft.woodMaterialId) {
    lockKozijnWoodMaterial(selectedCatalogMaterial(), false);
  }
  syncToolButtons();
});
replaceMatCb?.addEventListener("change", () => {
  syncReplaceMaterialUi();
});
replaceMatFromEl?.addEventListener("change", () => {
  void ensureReplaceToCatalogForFrom();
});
replaceMatToEl?.addEventListener("change", () => {
  updateReplaceMaterialBtn();
});
replaceMatBtn?.addEventListener("click", () => {
  void replaceMaterialInProject();
});

function openMaterialCatalogEditor(opts?: { newMaterial?: boolean }): void {
  const matUrl = new URL("/materials.html", location.origin);
  if (opts?.newMaterial) {
    matUrl.searchParams.set("new", "1");
  } else {
    const mat = selectedCatalogMaterial();
    if (mat?.material_id) matUrl.searchParams.set("material_id", mat.material_id);
    if (mat?.catalog_id) matUrl.searchParams.set("q", mat.catalog_id);
  }
  if (buildingId) matUrl.searchParams.set("building_id", buildingId);
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
        dragBodyLast: null,
        drawing: !closed && Boolean(draft.pending.drawing),
        drawCursor: null,
        label: (draft.label || "").trim(),
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

  const pickIsKier = Boolean(
    pick?.master_category && isLengthQuantityRubriek(pick.master_category),
  );
  const wantKierSuggest =
    Boolean(pickIsKier && pendingRoom?.closed && !isFloormapKind()) ||
    sessionStorage.getItem("app-gevelwering-kier-suggest-new") === "1";
  sessionStorage.removeItem("app-gevelwering-kier-suggest-new");

  if (pick?.material_id && wantKierSuggest && !isFloormapKind()) {
    if (kierSuggestCb) {
      kierSuggestCb.checked = true;
      kierSuggestCb.dataset.userTouched = "1";
    }
    await ensureKierMaterials();
    if (!kierMaterials.some((m) => m.material_id === pick.material_id)) {
      kierMaterials = [
        {
          material_id: pick.material_id,
          catalog_id: pick.catalog_id || "",
          material_no: 0,
          master_category: pick.master_category,
          name: pick.name || pick.material_id,
          category: pick.category || "",
          thickness_mm: null,
          ra_dba: null,
        },
        ...kierMaterials,
      ];
    }
    renderKierMaterialOptions(pick.material_id);
    syncKierSuggestUi();
    const label = (pick.name || pick.catalog_id || pick.material_id).trim();
    setStatus(`Kierdichting «${label}» gekozen — sla het vlak op om de omtrek toe te voegen`, "ok");
  } else if (pick?.material_id && pick.master_category && !isFloormapKind()) {
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

openMatCatalogBtn?.addEventListener("click", () => {
  openMaterialCatalogEditor();
});

customMatToggleBtn?.addEventListener("click", () => {
  openMaterialCatalogEditor({ newMaterial: true });
});

kierSuggestCb?.addEventListener("change", () => {
  if (!kierSuggestCb) return;
  kierSuggestCb.dataset.userTouched = "1";
  const editingId = pendingRoom?.editingId;
  if (editingId) {
    const room = rooms.find((r) => r.id === editingId);
    if (room && !componentIsLengthQuantity(room)) {
      // Same action as the list «Kier» checkbox — persist immediately.
      void toggleKierSealForRoom(room, kierSuggestCb.checked).then(() => {
        syncKierSuggestUi();
      });
      return;
    }
  }
  // New (unsaved) closed polygon: keep checkbox intent until Opslaan.
  // Do not call syncKierSuggestUi here — it used to clear the tick immediately.
  if (kierSuggestHintEl) {
    const peri = pendingRoom ? perimeterMOfRing(pendingRoom.points) : null;
    const periBit =
      peri != null ? ` Omtrek ≈ ${peri.toFixed(2)} m.` : " Zet eerst de schaal voor meters.";
    kierSuggestHintEl.textContent = kierSuggestCb.checked
      ? `Kierdichting aangevinkt — wordt bij Opslaan toegevoegd.${periBit}`
      : `Geen kierdichting bij Opslaan.${periBit}`;
  }
});
kierSuggestNewBtn?.addEventListener("click", () => {
  sessionStorage.setItem("app-gevelwering-kier-suggest-new", "1");
  openMaterialCatalogEditor({ newMaterial: true });
});

regel2KierCb?.addEventListener("change", () => {
  const pref = loadRegel2KozijnSealPref();
  pref.enabled = Boolean(regel2KierCb?.checked);
  if (regel2KierMatEl?.value) pref.material_id = regel2KierMatEl.value;
  saveRegel2KozijnSealPref(pref);
  void syncRegel2KierPicklistUi();
  syncAssignRegel2Hint();
});
regel2KierMatEl?.addEventListener("change", () => {
  const pref = loadRegel2KozijnSealPref();
  pref.material_id = (regel2KierMatEl?.value || "").trim() || undefined;
  saveRegel2KozijnSealPref(pref);
  void syncRegel2KierPicklistUi();
  syncAssignRegel2Hint();
});

function updateMaterialQuantityHint(): void {
  const hint = materialBlockEl?.querySelector(".hint:last-of-type") || materialBlockEl?.querySelector(".hint");
  if (!(hint instanceof HTMLElement)) return;
  if (selectedIsKierdichting()) {
    hint.textContent =
      "Rubriek 9 (kierdichting): lengte in meters wordt opgeslagen (pad ≥2 punten of gesloten omtrek). Geen oppervlakte.";
  } else {
    hint.textContent =
      "Materiaal is optioneel bij opslaan (oranje led). Koppel later voor de berekening; alleen complete componenten (groen) zijn kiesbaar bij vlakdelen.";
  }
}

backPickerBtn.addEventListener("click", () => {
  if (activeSection?.id) captureSectionRoomsSnapshot(activeSection.id);
  resetSectionWorkspace({ preserveLocalRoomState: true });
  activeSection = null;
  clearLastSectionId(buildingId);
  syncFloormapLocation(null);
  updateScaleUi();
  workspacePanelEl.classList.add("hidden");
  pickerPanelEl.classList.remove("hidden");
  syncProcessDockVisibility();
  renderSectionList();
});

zoomOutBtn.addEventListener("click", () => {
  const stepped = Math.round((viewZoom - ZOOM_STEP) * 10) / 10;
  void setViewZoom(stepped, detail ? ZOOM_MAX_DETAIL : ZOOM_MAX);
});
zoomInBtn.addEventListener("click", () => {
  const stepped = Math.round((viewZoom + ZOOM_STEP) * 10) / 10;
  void setViewZoom(stepped, detail ? ZOOM_MAX_DETAIL : ZOOM_MAX);
});
zoomBtn.addEventListener("click", () => {
  void endDetail();
  void setViewZoom(1, ZOOM_MAX);
});
zoomFitBtn.addEventListener("click", () => {
  void endDetail();
  void zoomToFit();
});
discoverBtn.addEventListener("click", () => void startDiscovery());
discoverBtnSide?.addEventListener("click", () => void startDiscovery());
discoverMinSizeEl?.addEventListener("input", updateDiscoverFilterAria);
updateDiscoverFilterAria();
calibrateBtn.addEventListener("click", () => startCalibrate());
vgVrOverviewBtn?.addEventListener("click", () => {
  void openVgVrOverview();
});
vgVrOverviewCopyBtn?.addEventListener("click", () => {
  void copyVgVrOverviewToClipboard();
});
copyLayoutCb?.addEventListener("change", () => {
  syncCopyLayoutUi();
});
copyLayoutSourceEl?.addEventListener("change", () => {
  if (copyLayoutBtn) {
    copyLayoutBtn.disabled = !(copyLayoutCb?.checked && copyLayoutSourceEl.value);
  }
});
copyLayoutBtn?.addEventListener("click", () => {
  const src = copyLayoutSourceEl?.value || "";
  if (!src) {
    setStatus("Kies eerst een bronplattegrond", "err");
    return;
  }
  void copyLayoutFromSection(src);
});
copyGevelCb?.addEventListener("change", () => {
  syncCopyGevelUi();
});
copyGevelSourceEl?.addEventListener("change", () => {
  if (copyGevelBtn) {
    copyGevelBtn.disabled = !(copyGevelCb?.checked && copyGevelSourceEl.value);
  }
});
copyGevelBtn?.addEventListener("click", () => {
  const src = copyGevelSourceEl?.value || "";
  if (!src) {
    setStatus("Kies eerst een bron VR · ori", "err");
    return;
  }
  void copyGevelStackFromSource(src);
});
detailBtn?.addEventListener("click", () => startDetailTool());
detailCloseBtn?.addEventListener("click", () => {
  void endDetail("Detailgebied gesloten");
});
detailRepickBtn?.addEventListener("click", () => repickDetail());
document.querySelectorAll<HTMLButtonElement>(".detail-factor-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!detail) return;
    const f = Number(btn.dataset.factor);
    if (f !== 1 && f !== 2 && f !== 3 && f !== 4) return;
    detail.factor = f as DetailFactor;
    void applyDetailView();
  });
});
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
roomLabelInput.addEventListener("input", () => {
  syncPendingLabelToRooms();
  scheduleRoomListRefresh();
});
expectedOriRowEl?.addEventListener("change", (ev) => {
  const t = ev.target as HTMLElement | null;
  if (t instanceof HTMLInputElement && t.type === "checkbox") {
    syncOriCorrRows();
  }
});
componentOriEl?.addEventListener("change", () => {
  rememberComponentOrientatie(readComponentOrientatie());
});
roomDuplicateBtn?.addEventListener("click", () => {
  void duplicateFromPending();
});
roomClearBtn.addEventListener("click", () => {
  clearPendingRoom();
  setStatus("Markering gewist", "ok");
});
roomDeleteBtn?.addEventListener("click", () => {
  void deletePendingRoom();
});

document.querySelectorAll<HTMLButtonElement>(".tool-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMeasureTool((btn.dataset.tool || "off") as ToolMode);
  });
});
toolClearBtn?.addEventListener("click", () => {
  if (kozijnDraft) {
    clearKozijnDraft();
    setStatus("Kozijn-markering gewist", "ok");
    return;
  }
  if (pendingRoom) {
    clearPendingRoom();
    setStatus("Markering gewist", "ok");
    return;
  }
  clearMeasure(true);
  setStatus("Meting gewist", "ok");
});

kozijnWidthMmEl?.addEventListener("change", () => {
  if (!kozijnDraft) return;
  kozijnDraft.defaultWidthM = readKozijnWidthM();
  const ai = kozijnDraft.activeIndex;
  if (ai >= 0 && kozijnDraft.segments[ai]) {
    kozijnDraft.segments[ai].width_m = kozijnDraft.defaultWidthM;
  }
  syncKozijnEval();
  drawOverlay();
});
kozijnNewLineBtn?.addEventListener("click", () => {
  if (!kozijnDraft) return;
  commitKozijnLiveLine();
  kozijnDraft.livePoints = [];
  kozijnDraft.cursor = null;
  setStatus("Nieuwe balk — klik hoeken", "busy");
  drawOverlay();
});
kozijnSaveBtn?.addEventListener("click", () => {
  void saveKozijnDraft();
});
kozijnFillGlassBtn?.addEventListener("click", () => {
  void fillKozijnGlass();
});

(() => {
  const panel = document.getElementById("fm-tools-bar") as HTMLDetailsElement | null;
  if (!panel) return;
  const key = "app-gevelwering-tools-collapsed";
  // Default open — live lengte/oppervlakte blijven zichtbaar tijdens tekenen.
  panel.open = localStorage.getItem(key) !== "1";
  panel.addEventListener("toggle", () => {
    localStorage.setItem(key, panel.open ? "0" : "1");
  });
})();
(() => {
  const panel = document.getElementById("fm-set-ops-fieldset") as HTMLDetailsElement | null;
  if (!panel) return;
  const key = "app-gevelwering-compose-collapsed";
  // Default collapsed — frees sidebar space; expand when composing.
  panel.open = localStorage.getItem(key) === "0";
  panel.addEventListener("toggle", () => {
    localStorage.setItem(key, panel.open ? "0" : "1");
  });
})();
/** Ctrl/Cmd+Z: laatste tekenactie ongedaan (kozijn / ruimte / lengte). */
function undoLastDrawAction(): boolean {
  if (kozijnDraft) {
    if (kozijnDraft.livePoints.length > 0) {
      kozijnDraft.livePoints.pop();
      kozijnDraft.cursor = null;
      syncKozijnEval();
      drawOverlay();
      setStatus(
        kozijnDraft.livePoints.length
          ? `Ongedaan: punt · nog ${kozijnDraft.livePoints.length} op deze lijn`
          : "Ongedaan: punt",
        "ok",
      );
      return true;
    }
    if (kozijnDraft.segments.length > 0) {
      const last = kozijnDraft.segments.pop()!;
      kozijnDraft.livePoints = last.points.map((p) => ({ ...p }));
      kozijnDraft.activeIndex = kozijnDraft.segments.length - 1;
      kozijnDraft.defaultWidthM = last.width_m;
      if (kozijnWidthMmEl) kozijnWidthMmEl.value = String(Math.round(last.width_m * 1000));
      // Eén Ctrl+Z = commit terugdraaien; tweede haalt het laatste punt van die lijn weg.
      syncKozijnEval();
      drawOverlay();
      setStatus("Ongedaan: laatste lijn weer actief", "ok");
      return true;
    }
    return false;
  }
  if (pendingRoom?.drawing && !pendingRoom.closed && pendingRoom.points.length > 0) {
    pendingRoom.points.pop();
    pendingRoom.drawCursor = null;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    setStatus(
      pendingRoom.points.length
        ? `Ongedaan: punt · nog ${pendingRoom.points.length}`
        : "Ongedaan: punt",
      "ok",
    );
    return true;
  }
  if (measure.tool === "length" && measure.points.length > 0) {
    measure.points.pop();
    measure.cursor = null;
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    setStatus("Ongedaan: meetpunt", "ok");
    return true;
  }
  return false;
}

window.addEventListener("keydown", (evt) => {
  const tag = (evt.target as HTMLElement | null)?.tagName;
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  if (!typing && (evt.code === "Space" || evt.key === " ")) {
    if (kozijnDraft) {
      evt.preventDefault();
      if (!kozijnPanKey) {
        kozijnPanKey = true;
        if (kozijnDraft.cursor) {
          kozijnDraft.cursor = null;
          syncKozijnEval();
          drawOverlay();
        }
        overlayCanvas.style.cursor = "grab";
      }
      return;
    }
  }
  if ((evt.metaKey || evt.ctrlKey) && (evt.key === "z" || evt.key === "Z") && !evt.shiftKey) {
    if (typing) return;
    if (undoLastDrawAction()) {
      evt.preventDefault();
      return;
    }
  }
  if ((evt.metaKey || evt.ctrlKey) && (evt.key === "d" || evt.key === "D")) {
    if (typing) return;
    if (pendingRoom?.closed) {
      evt.preventDefault();
      void duplicateFromPending(evt.shiftKey ? undefined : 1);
      return;
    }
  }
  if (!typing && pendingRoom?.closed && !evt.metaKey && !evt.ctrlKey && !evt.altKey) {
    const step = evt.shiftKey ? 0.02 : 0.01;
    if (evt.key === "ArrowLeft") {
      evt.preventDefault();
      nudgeCurrent(-step, 0);
      return;
    }
    if (evt.key === "ArrowRight") {
      evt.preventDefault();
      nudgeCurrent(step, 0);
      return;
    }
    if (evt.key === "ArrowUp") {
      evt.preventDefault();
      nudgeCurrent(0, -step);
      return;
    }
    if (evt.key === "ArrowDown") {
      evt.preventDefault();
      nudgeCurrent(0, step);
      return;
    }
  }
  if (evt.key !== "Escape") return;
  if (detailPick || detail) {
    void endDetail("Detailgebied gesloten");
    return;
  }
  if (kozijnDraft) {
    clearKozijnDraft();
    kozijnPanKey = false;
    kozijnPanDrag = null;
    setStatus("Kozijn-markering gewist", "ok");
  } else if (pendingRoom) {
    clearPendingRoom();
    setStatus("Markering gewist", "ok");
  } else if (measure.tool !== "off") {
    clearMeasure(true);
    setStatus("Meting gewist", "ok");
  }
});

window.addEventListener("keyup", (evt) => {
  if (evt.code === "Space" || evt.key === " ") {
    kozijnPanKey = false;
    kozijnPanDrag = null;
    if (kozijnDraft) overlayCanvas.style.cursor = "crosshair";
  }
});

discoveryAcceptBtn.addEventListener("click", () => void acceptDiscovery());
discoverySkipBtn.addEventListener("click", () => skipDiscovery());
discoveryCancelBtn.addEventListener("click", () => endDiscovery("Ontdekken geannuleerd"));
discoverySimplifyBtn?.addEventListener("click", () => simplifyActiveOutline());
nudgeLeftBtn.addEventListener("click", () => nudgeCurrent(-0.01, 0));
nudgeRightBtn.addEventListener("click", () => nudgeCurrent(0.01, 0));
nudgeUpBtn.addEventListener("click", () => nudgeCurrent(0, -0.01));
nudgeDownBtn.addEventListener("click", () => nudgeCurrent(0, 0.01));
editNudgeLeftBtn?.addEventListener("click", () => nudgeCurrent(-0.01, 0));
editNudgeRightBtn?.addEventListener("click", () => nudgeCurrent(0.01, 0));
editNudgeUpBtn?.addEventListener("click", () => nudgeCurrent(0, -0.01));
editNudgeDownBtn?.addEventListener("click", () => nudgeCurrent(0, 0.01));

syncPendingRoomButtons();
syncFavoriteButtons();


buildingInput.value = buildingId;
initPasswordToggles();
initEngineerLayoutSplit();

if (fileMenuRoot) {
  projectMenu = mountProjectMenu(fileMenuRoot, {
    getToken: () => auth()?.token ?? null,
    getBuildingId: () => buildingId,
    getProjectMeta: () => ({ label: buildingLabel, external_ref: buildingExternalRef }),
    invokeString: (name, args) => invokeString(name, args),
    apiAuthHeaders: () => (auth ? apiAuthHeaders(auth()!.token, true) : {}),
    openBuilding: (id) => loadFloormapSections(id),
    saveProject: async () => {
      if (!buildingId) throw new Error("Geen project geselecteerd");
      setStatus("Plattegrond/gevel worden per actie opgeslagen — projectcontext bewaard", "ok");
    },
    onProjectRenamed: (meta) => {
      buildingLabel = meta.label;
      buildingExternalRef = meta.external_ref;
    },
    onProjectDeleted: async () => {
      const deletedBid = buildingId;
      clearLastSectionId(deletedBid);
      buildingId = "";
      buildingLabel = "";
      buildingExternalRef = "";
      buildingInput.value = "";
      sections = [];
      rooms = [];
      pickerPanelEl.classList.add("hidden");
      workspacePanelEl.classList.add("hidden");
      syncProcessDockVisibility();
      const url = new URL(location.href);
      url.searchParams.delete("building_id");
      url.searchParams.delete("section_id");
      history.replaceState(null, "", url.toString());
      if (gaLinkEl) gaLinkEl.href = "/ga.html";
    },
    onStatus: (state, text) => setStatus(text, state),
    setTitle: (title) => {
      document.title =
        title === "Geen project" ? "Stilte advies en meten — Tekeninganalyse" : `${title} — Plattegrond`;
    },
  });
  fileMenuRoot.hidden = true;
}

initProcessDockChrome();
{
  const stored = loadAuth(AUTH_KEY);
  if (stored?.token) showPanel(stored);
}
session.connect();
