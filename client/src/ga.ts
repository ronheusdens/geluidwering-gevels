/**
 * GA projectmodel — fase B: variant / VG / VR (floormap) / vlak (façade).
 * Engineer-only. Reuses shared_building_api (+ ga_model_api).
 * Rekenkern: GA / Lbi / GA;k conform NPR 5272 / NEN 5077 (DGMR-voorbeeld).
 */
import { loadAuth, apiAuthHeaders } from "./auth-store";
import { resolveBppWsUrl } from "./ws-url";
import { initPasswordToggles } from "./password-toggle";
import { computeVrGa, grenswaardeLbik, minRaDeltaForRprime, round1, type GaVrResult } from "./ga-calc";
import { mountProjectMenu, type ProjectMenuApi } from "./project-menu";
import {
  bppListDrawingSubsections,
  bppListFloormapSections,
  bppListMaterialAlternatives,
  bppListVrFacadeComponents,
  bppPhase1Enabled,
  bppSaveSubsectionMaterial,
} from "./bpp-api";
import {
  formatRoomSummary,
  formatVrListLine,
  isGroundLevel,
  levelLabel,
  parseVgNrFromText,
  sortByLabelAz,
  vgLabelFromNr,
  vrLabelFromNr,
} from "./ga-labels";
import {
  defaultOrientatieForMaterial as defaultOrientatieForMaterialCore,
  facadeMatchesOrientatie,
  facadeOrientatie,
  formatFacadeGroupOption as formatFacadeGroupOptionCore,
  groupOrientatie,
  materialHasFreeOrientatie as materialHasFreeOrientatieCore,
  materialOrientatieTaken as materialOrientatieTakenCore,
  missingOrientations,
  normalizeOrientatie,
  ORIENTATIE_ALL,
  ORIENTATIE_LABELS,
  orientatieTakenOnVr as orientatieTakenOnVrCore,
  orisUsedForMaterial as orisUsedForMaterialCore,
  presentVlakOrientaties as presentVlakOrientatiesCore,
  resolveOrientatieForNewVlak as resolveOrientatieForNewVlakCore,
} from "./ga-orientation";
import { BppSession, type AuthInfo } from "./shared/bpp-session";

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

type OrientatieCode = "" | "N" | "NO" | "O" | "ZO" | "Z" | "ZW" | "W" | "NW";

type Vlak = {
  vlak_id: string;
  omschrijving: string;
  area_m2: number;
  length_m?: number | null;
  quantity_kind?: "area" | "length" | string;
  orientatie?: OrientatieCode | string;
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
  /** From plattegrond VR-definitie: expected gevel orientations. */
  expected_orientaties?: string[];
  /** CL/Cg per oriëntatie (van plattegrond). */
  orientatie_correcties?: Record<string, { cl_db?: number; cg_db?: number }>;
};

type VrFacadeConstituent = {
  id: string;
  sign: "+" | "-" | string;
  label: string;
  catalog_id: string | null;
  material_name: string | null;
  area_m2: number | null;
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
  catalog_id: string | null;
  master_category: string | null;
  material_id: string | null;
  ra_dba: number | null;
  boolean_op: string | null;
  repeat_count?: number | null;
  orientatie?: string | null;
  /** Derived kier length from analysis.seal (pick id may be `{uuid}#seal`). */
  from_seal?: boolean;
  /** Real drawing_subsection id for FK / live qty (equals id when not from_seal). */
  source_subsection_id?: string | null;
  constituents: VrFacadeConstituent[];
};

function facadeSourceId(f: Pick<VrFacadeOpt, "id" | "source_subsection_id" | "from_seal">): string {
  const src = (f.source_subsection_id || "").trim();
  if (src) return src;
  const id = (f.id || "").trim();
  if (id.endsWith("#seal")) return id.slice(0, -5);
  return id;
}

/** Pick-ids already linked as vlak (area vs seal length are independent). */
function usedFacadePickIds(): Set<string> {
  const used = new Set<string>();
  for (const v of vlakken) {
    const sid = (v.facade_subsection_id || "").trim();
    if (!sid) continue;
    if (v.quantity_kind === "length") {
      const seal = vrFacades.find(
        (f) => f.from_seal && facadeSourceId(f) === sid,
      );
      if (seal) {
        used.add(seal.id);
      } else if (sid.endsWith("#seal")) {
        used.add(sid);
      }
      // Never mark the parent area uuid as used for a length/seal vlak —
      // that would hide glas/muur when kier is already assigned on the same contour.
    } else {
      used.add(sid);
    }
  }
  return used;
}

function findFacadeForVlak(v: Vlak): VrFacadeOpt | null {
  const sid = (v.facade_subsection_id || "").trim();
  if (!sid) return null;
  if (v.quantity_kind === "length") {
    return (
      vrFacades.find((f) => f.from_seal && facadeSourceId(f) === sid) ||
      vrFacades.find((f) => f.id === sid && f.quantity_kind === "length") ||
      null
    );
  }
  return (
    vrFacades.find((f) => !f.from_seal && f.id === sid) ||
    vrFacades.find((f) => f.id === sid) ||
    null
  );
}

type LinkedSub = {
  subsection_id: string;
  verblijfsruimte_id: string;
  verblijfsgebied_id: string;
  omschrijving: string;
  variant_id?: string;
};

type CompareRow = {
  subsection_id: string;
  verblijfsruimte_id: string;
  omschrijving: string;
  vr_nr: string;
  variant_id: string;
  variant_omschrijving: string;
  geluidsbelasting_dba: number;
  spectrum_kind: string;
  gebruiksfunctie: string;
  ga_dba: number | null;
  lbi_dba: number | null;
  gak_dba: number | null;
};

type QueueProject = {
  building_id: string;
  label: string;
  customer_name: string;
  project_status: string;
};

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
const buildingMetaSummaryEl = document.getElementById("ga-building-meta-summary") as HTMLElement | null;
const projectIdBarEl = document.getElementById("ga-project-id-bar") as HTMLDetailsElement | null;
const queueBtn = document.getElementById("ga-queue-btn") as HTMLButtonElement;
const queueListEl = document.getElementById("ga-queue-list") as HTMLElement;
const modelPanelEl = document.getElementById("ga-model-panel") as HTMLElement;
const floormapLinkEl = document.getElementById("ga-floormap-link") as HTMLAnchorElement;
const fileMenuRoot = document.getElementById("ga-file-menu") as HTMLElement | null;

const variantForm = document.getElementById("ga-variant-form") as HTMLFormElement;
const variantListEl = document.getElementById("ga-variant-list") as HTMLUListElement;
const variantNameEl = document.getElementById("ga-variant-name") as HTMLInputElement;
const variantFunctieEl = document.getElementById("ga-variant-functie") as HTMLSelectElement;
const variantLbEl = document.getElementById("ga-variant-lb") as HTMLInputElement;
const variantSpectrumEl = document.getElementById("ga-variant-spectrum") as HTMLSelectElement;
const variantNewBtn = document.getElementById("ga-variant-new-btn") as HTMLButtonElement;
const variantCloneBtn = document.getElementById("ga-variant-clone-btn") as HTMLButtonElement | null;
const variantDelBtn = document.getElementById("ga-variant-del-btn") as HTMLButtonElement;
const comparePickEl = document.getElementById("ga-compare-pick") as HTMLElement | null;
const compareBtn = document.getElementById("ga-compare-btn") as HTMLButtonElement | null;
const compareWrapEl = document.getElementById("ga-compare-table-wrap") as HTMLElement | null;
const compareTableEl = document.getElementById("ga-compare-table") as HTMLTableElement | null;

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
const vlakComponentFieldset = document.getElementById("ga-vlak-component-fieldset") as HTMLElement | null;
const vlakPropsGateHintEl = document.getElementById("ga-vlak-props-gate-hint") as HTMLElement | null;
const vlakFacadeLabelEl = document.getElementById("ga-vlak-facade-label") as HTMLElement | null;
const vlakFacadeLinkedEl = document.getElementById("ga-vlak-facade-linked") as HTMLElement | null;
const vlakFacadeComposeEl = document.getElementById("ga-vlak-facade-compose") as HTMLElement | null;
const vlakInventoryEl = document.getElementById("ga-vlak-inventory") as HTMLElement | null;
const vlakCoverageEl = document.getElementById("ga-vlak-coverage") as HTMLElement | null;
const vlakCoveragePctEl = document.getElementById("ga-vlak-coverage-pct") as HTMLElement | null;
const vlakCoverageBarEl = document.getElementById("ga-vlak-coverage-bar") as HTMLElement | null;
const vlakCoverageMetaEl = document.getElementById("ga-vlak-coverage-meta") as HTMLElement | null;
const vlakAreaEl = document.getElementById("ga-vlak-area") as HTMLInputElement;
const vlakQtyLabelEl = document.getElementById("ga-vlak-qty-label") as HTMLElement | null;
const vlakOrientatieEl = document.getElementById("ga-vlak-orientatie") as HTMLSelectElement | null;
const vlakOrientatieDisplayEl = document.getElementById("ga-vlak-orientatie-display") as HTMLElement | null;
const vlakClEl = document.getElementById("ga-vlak-cl") as HTMLInputElement | null;
const vlakCgEl = document.getElementById("ga-vlak-cg") as HTMLInputElement | null;
const vlakOriStatusEl = document.getElementById("ga-vlak-ori-status") as HTMLElement | null;
const vlakEditHintEl = document.getElementById("ga-vlak-edit-hint") as HTMLElement | null;
const vlakGakEl = document.getElementById("ga-vlak-gak") as HTMLInputElement;
const vlakSaveBtn = document.getElementById("ga-vlak-save-btn") as HTMLButtonElement | null;
const vlakCancelBtn = document.getElementById("ga-vlak-cancel-btn") as HTMLButtonElement | null;
const vlakListEl = document.getElementById("ga-vlak-list") as HTMLUListElement;
const vlakPickEl = document.getElementById("ga-vlak-pick") as HTMLUListElement | null;
const recalcBtn = document.getElementById("ga-recalc-btn") as HTMLButtonElement | null;
const analyzeBtn = document.getElementById("ga-analyze-btn") as HTMLButtonElement | null;
const analyzePanelEl = document.getElementById("ga-analyze-panel") as HTMLElement | null;
const analyzeHintEl = document.getElementById("ga-analyze-hint") as HTMLElement | null;
const analyzeCausesEl = document.getElementById("ga-analyze-causes") as HTMLUListElement | null;
const analyzeSuggestionsEl = document.getElementById("ga-analyze-suggestions") as HTMLElement | null;
const reportBtn = document.getElementById("ga-report-btn") as HTMLButtonElement | null;
const reportInboxBtn = document.getElementById("ga-report-inbox-btn") as HTMLButtonElement | null;
const reportKindEl = document.getElementById("ga-report-kind") as HTMLSelectElement | null;
const reportHintEl = document.getElementById("ga-report-hint") as HTMLElement | null;
const vrResultsHintEl = document.getElementById("ga-vr-results-hint") as HTMLElement | null;
const vrResultsWerknummerEl = document.getElementById("ga-vr-results-werknummer") as HTMLElement | null;
const resSEl = document.getElementById("ga-res-s") as HTMLElement | null;
const resRpEl = document.getElementById("ga-res-rp") as HTMLElement | null;
const resDEl = document.getElementById("ga-res-d") as HTMLElement | null;
const resGaEl = document.getElementById("ga-res-ga") as HTMLElement | null;
const resLbiEl = document.getElementById("ga-res-lbi") as HTMLElement | null;
const resGakEl = document.getElementById("ga-res-gak") as HTMLElement | null;
const resLbikEl = document.getElementById("ga-res-lbik") as HTMLElement | null;
const resToetsEl = document.getElementById("ga-res-toets") as HTMLElement | null;


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
/** When set, vlak form updates this vlak instead of inserting. */
let selectedVlakId: string | null = null;
let vlakPickSyncLock = false;
/** Selected value in ori listbox (`ori:ZO` or ""). */
let vlakPickValue = "";
let vlakken: Vlak[] = [];
/** Per VR: orientaties met ≥1 gekoppeld vlak (voor LED-strip). */
const vrOriPresentById = new Map<string, Set<string>>();
/** VR ids whose GA/Lbi/GA;k were computed in this browser session (live, not only DB). */
const freshResultVrIds = new Set<string>();
/** Session toets result per VR (Lbi;k ≤ grens). */
const vrVoldoet = new Map<string, boolean>();
/** True when live preview or failed persist left results ahead of DB. */
let resultsDirty = false;
/** Laatste verse GA-resultaat voor Analyseer (alleen als berekening ok). */
let lastFreshGaResult: GaVrResult | null = null;
/** Bumped when results must stay hidden (lege ori) or a newer calc supersedes an in-flight one. */
let calcRevealEpoch = 0;
let freeRooms: RoomOpt[] = [];
let floormapRoomsById = new Map<string, RoomOpt>();
let vrFacades: VrFacadeOpt[] = [];
let allLinks: LinkedSub[] = [];
let linkedBySub = new Map<string, LinkedSub>();
let linkedSubIds = new Set<string>();
let compareSelectedIds = new Set<string>();
/** Current project label for header / recent list. */
let buildingLabel = "";
let buildingExternalRef = "";
let projectMenu: ProjectMenuApi | null = null;

function setConn(state: "ok" | "busy" | "err", text: string): void {
  connLedEl.className = `conn-led ${state === "ok" ? "connected" : state === "busy" ? "busy" : "disconnected"}`;
  connStatusEl.textContent = text;
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
    },
  },
});

function invokeString(target: string, args: unknown[]): Promise<string> {
  return session.invokeString(target, args);
}

function auth(): AuthInfo | null {
  return session.auth;
}

function storeAuth(info: AuthInfo | null): void {
  session.storeAuth(info);
  session.auth = info;
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: apiAuthHeaders(auth()!.token) });
  const body = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function apiPost<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...apiAuthHeaders(auth()!.token), "Content-Type": "application/json" },
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
  if (!buildingId || !auth()) return;
  const ret = await invokeString("API_ListLinkedSubsections", [auth()!.token, buildingId]);
  const data = parseJsonOk<{ links: LinkedSub[] }>(ret);
  allLinks = data.links || [];
  rebuildLinkedForSelectedVariant();
}

/** Free rooms / link map are scoped to the active variant (same room may exist in other variants). */
function rebuildLinkedForSelectedVariant(): void {
  linkedBySub = new Map();
  linkedSubIds = new Set();
  for (const l of allLinks) {
    if (!l?.subsection_id) continue;
    if (selectedVariantId && l.variant_id && l.variant_id !== selectedVariantId) continue;
    linkedBySub.set(l.subsection_id, l);
    linkedSubIds.add(l.subsection_id);
  }
}

/** Floormap rooms already linked into a GA verblijfsgebied (current or any matching VG id). */
function roomsForVg(vgId: string): RoomOpt[] {
  const out: RoomOpt[] = [];
  for (const l of allLinks) {
    if (l.verblijfsgebied_id !== vgId) continue;
    const room = floormapRoomsById.get(l.subsection_id);
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
  if (!buildingId || !auth()) return;
  const sectionRows = bppPhase1Enabled()
    ? (await bppListFloormapSections(invokeString, auth()!.token, buildingId)).sections
    : (
        await apiGet<{
          sections: Array<{ id: string; label: string; region_kind: string }>;
        }>(`/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`)
      ).sections;
  const rooms: RoomOpt[] = [];
  floormapRoomsById = new Map();
  for (const sec of sectionRows || []) {
    const kind = String(sec.region_kind || "").toUpperCase();
    // GA only needs plattegrond rooms (VG/VR + oriëntaties). Skip façades —
    // their subsection JSON (points) easily exceeds bpp invoke payload limits.
    if (kind !== "FLOORMAP") continue;
    const sub = bppPhase1Enabled()
      ? await bppListDrawingSubsections(invokeString, auth()!.token, sec.id)
      : await apiGet<{
          subsections: Array<{
            id: string;
            label: string;
            area_m2: number | null;
            vg_nr?: number | null;
            vr_nr?: string | null;
            level_hint?: string | null;
            analysis?: {
              expected_orientaties?: string[];
              orientatie_correcties?: Record<string, { cl_db?: number; cg_db?: number }>;
            } | null;
          }>;
        }>(`/api/floormap/subsections?section_id=${encodeURIComponent(sec.id)}`);
    for (const s of sub.subsections || []) {
      const expected = Array.isArray(s.analysis?.expected_orientaties)
        ? s.analysis!.expected_orientaties!
            .map((c) => normalizeOrientatie(c))
            .filter((c) =>
              ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"].includes(c),
            )
        : [];
      const corrRaw = s.analysis?.orientatie_correcties;
      const orientatie_correcties: Record<string, { cl_db?: number; cg_db?: number }> = {};
      if (corrRaw && typeof corrRaw === "object" && !Array.isArray(corrRaw)) {
        for (const [k, v] of Object.entries(corrRaw)) {
          const code = normalizeOrientatie(k);
          if (!code || !v || typeof v !== "object") continue;
          orientatie_correcties[code] = {
            cl_db: Number((v as { cl_db?: number }).cl_db) || 0,
            cg_db: Number((v as { cg_db?: number }).cg_db) || 0,
          };
        }
      }
      const opt: RoomOpt = {
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
        orientatie_correcties,
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
  // Geen open vlak → geen rekenuitkomst (voorkomt oude VR-cijfers bij oriëntatiekeuze).
  if (selectedVlakId) await refreshVrCalc();
  else blankResultsUntilVlakSelected();
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
  // Oriëntatie hoort niet in de materiaal-key (anders breekt "vrij ori"-logica);
  // splitsing per ori gebeurt in groupFacadesForPick.
  if (f.material_id) return `id:${f.material_id}|${kind}`;
  const name = (f.material_name || "").trim().toLowerCase();
  const cat = (f.master_category || "").trim().toLowerCase();
  if (!name && !cat) return null;
  const ra = f.ra_dba != null && Number.isFinite(f.ra_dba) ? String(f.ra_dba) : "";
  return `name:${cat}|${name}|${ra}|${kind}`;
}

function filterFacadeGroupsByOrientatie(groups: FacadePickGroup[], wantOri: string): FacadePickGroup[] {
  const want = normalizeOrientatie(wantOri);
  if (!want) return groups;
  return groups.filter((g) => groupOrientatie(g) === want);
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
  orientatie: string;
};

/** Same material (+ quantity kind) → one pick with summed S or l of still-free members. */
function groupFacadesForPick(facades: VrFacadeOpt[], usedIds: Set<string>): FacadePickGroup[] {
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
    // Prefer free geometry; if none left, group is exhausted (avoid double-counting one component).
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
        orientatie: groupOrientatie({ members, orientatie: facadeOrientatie(members[0]) } as FacadePickGroup),
      });
      return;
    }
    const pool = available;
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
      orientatie: groupOrientatie({ members: pool, orientatie: facadeOrientatie(pool[0]) } as FacadePickGroup),
    });
  };

  for (const [key, members] of groups) {
    // Zelfde materiaal, verschillende gevelori → aparte keuzes (NW vs ZW).
    const byOri = new Map<string, VrFacadeOpt[]>();
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
    return (a.label || "").localeCompare(b.label || "", undefined, { sensitivity: "base" });
  });
  return out;
}

/** CL/Cg vast per plattegrond-oriëntatie (niet live te wijzigen in GA). */
function correctionsForOrientatie(ori: string | null | undefined): { cl: string; cg: string } {
  const code = normalizeOrientatie(ori);
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  const room = vr ? roomFromVr(vr) : null;
  const c = code && room?.orientatie_correcties ? room.orientatie_correcties[code] : null;
  if (c) {
    return {
      cl: String(Number(c.cl_db) || 0),
      cg: String(Number(c.cg_db) || 0),
    };
  }
  return { cl: "0", cg: "0" };
}

function applyClCgFromOrientatie(ori: string | null | undefined): void {
  const c = correctionsForOrientatie(ori);
  if (vlakClEl) {
    vlakClEl.value = c.cl;
    vlakClEl.readOnly = true;
    vlakClEl.title = "CL vast per geveloriëntatie (plattegrond) — niet live te wijzigen";
  }
  if (vlakCgEl) {
    vlakCgEl.value = c.cg;
    vlakCgEl.readOnly = true;
    vlakCgEl.title = "Cg vast per geveloriëntatie (plattegrond) — niet live te wijzigen";
  }
}

/** Plattegrond-ori’s aanwezig → materialen mogen; CL/Cg komen uit plattegrond. */
function vlakPropsComplete(): boolean {
  if (selectedVlakId) return true;
  return expectedOrientatiesForSelectedVr().length > 0;
}

function assertVlakPropsOrThrow(): void {
  const expected = expectedOrientatiesForSelectedVr();
  if (!expected.length) {
    throw new Error(
      "Geen geveloriëntaties op de plattegrond voor deze VR — vink die eerst aan bij Opgeslagen ruimten",
    );
  }
}

/** Gate materiaalselectie: plattegrond-ori’s + vrije materialen. Meerdere materialen per ori zijn ok. */
function syncVlakMaterialGate(): void {
  const editing = Boolean(selectedVlakId);
  const expected = expectedOrientatiesForSelectedVr();
  const noPlattegrondOri = !expected.length;
  const used = usedFacadePickIds();
  const freeMats = groupFacadesForPick(vrFacades, used).filter(
    (g) =>
      g.ga_ready &&
      !g.used &&
      Boolean(groupOrientatie(g)) &&
      materialHasFreeOrientatie(g.materialKey),
  );
  const noFreeMat = !editing && vrFacades.length > 0 && freeMats.length === 0;
  const propsOk = editing || vlakPropsComplete();
  const ready = propsOk && !noPlattegrondOri && (!noFreeMat || editing);

  // Oriëntatie komt uit de listbox — niet terugzetten naar de eerste plattegrond-ori.
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
      vlakPropsGateHintEl.textContent = incomplete
        ? "Je bewerkt een bestaand vlak — de materiaallijst is vergrendeld. Klik «Annuleer bewerken» om een ander materiaal toe te voegen tot 100% Stotaal voor deze oriëntatie."
        : "";
    } else if (noPlattegrondOri) {
      vlakPropsGateHintEl.textContent =
        "Eerst geveloriëntaties + CL/Cg vastleggen op de plattegrond (Opgeslagen ruimten).";
    } else if (!vrFacades.some((f) => f.ga_ready)) {
      vlakPropsGateHintEl.textContent =
        "Nog geen complete gevelcomponenten voor deze VR — koppel materiaal én oriëntatie (N…NW) op de geveltekening.";
    } else if (noFreeMat) {
      const incomplete = Boolean(focusOri) && !vlakkenMatchFacadeStotaal(focusOri);
      vlakPropsGateHintEl.textContent = incomplete
        ? "Geen vrij materiaal meer voor deze oriëntatie, maar dekking is nog geen 100%. Controleer of alle gevelcomponenten een materiaal hebben op de geveltekening, of dat restoppervlak bij hetzelfde materiaal hoort."
        : "Alle gevelmaterialen voor deze oriëntatie zijn toebedeeld — zie toegevoegde vlakken.";
    } else {
      const wantOri = focusOri;
      const assignedForOri = wantOri ? vlakkenForOrientatie(wantOri) : [];
      const leftover = wantOri
        ? groupFacadesForPick(vrFacades, used).filter(
            (g) =>
              g.ga_ready &&
              !g.used &&
              groupOrientatie(g) === wantOri &&
              materialHasFreeOrientatie(g.materialKey),
          )
        : [];
      vlakPropsGateHintEl.textContent =
        wantOri && assignedForOri.length && leftover.length === 0
          ? `Alle materialen voor ${wantOri} zijn toebedeeld — zie toegevoegde vlakken.`
          : "Kies een nog niet gekoppeld materiaal van de geveltekening. Zelfde materiaal wordt opgeteld; zo vul je Stotaal tot 100%.";
    }
  }
  if (!ready) {
    vlakFacadeEl.title = noPlattegrondOri
      ? "Eerst oriëntaties op de plattegrond"
      : noFreeMat
        ? "Geen vrij materiaal meer"
        : "Eerst plattegrond-oriëntatie";
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

/** Expected orientations from plattegrond VR definition. */
function expectedOrientatiesForSelectedVr(): string[] {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (!vr) return [];
  const room = roomFromVr(vr);
  return Array.isArray(room?.expected_orientaties) ? [...room!.expected_orientaties!] : [];
}

function presentVlakOrientaties(): Set<string> {
  return presentVlakOrientatiesCore(vlakken);
}

function orientatieTakenOnVr(ori: string | null | undefined, exceptVlakId?: string | null): Vlak | null {
  return orientatieTakenOnVrCore(vlakken, ori, exceptVlakId);
}

function missingOrientationsForSelectedVr(): string[] {
  const expected = expectedOrientatiesForSelectedVr();
  const have = presentVlakOrientaties();
  return missingOrientations(expected, have);
}

function vlakMaterialLabel(v: Vlak): string {
  const fac = findFacadeForVlak(v);
  const name = (fac?.material_name || "").trim();
  const code = (fac?.catalog_id || "").trim();
  let base = code && name ? `${code} · ${name}` : name || code || v.omschrijving || "materiaal";
  if (fac?.from_seal || v.quantity_kind === "length") {
    if (!/kier/i.test(base)) base += " · kierdichting";
  }
  return base;
}

function vlakkenForOrientatie(ori: string): Vlak[] {
  const want = normalizeOrientatie(ori);
  if (!want) return [];
  return vlakken.filter((v) => normalizeOrientatie(v.orientatie) === want);
}

/** Oriëntaties met ≥1 vlak in een vlakkenlijst. */
function orisPresentInVlakken(list: Vlak[]): Set<string> {
  const out = new Set<string>();
  for (const v of list) {
    const o = normalizeOrientatie(v.orientatie);
    if (o) out.add(o);
  }
  return out;
}

function rememberVrOriPresent(vrId: string | null | undefined, list: Vlak[]): void {
  const id = (vrId || "").trim();
  if (!id) return;
  vrOriPresentById.set(id, orisPresentInVlakken(list));
}

/** Groen = materialen gekoppeld; oranje = plattegrond-ori nog open. */
function createOriStatusLed(ori: string, ready: boolean): HTMLSpanElement {
  const led = document.createElement("span");
  led.className = "scale-calibrated-led";
  led.classList.add(ready ? "is-on" : "is-warn");
  led.setAttribute("role", "status");
  const name = ORIENTATIE_LABELS[ori] || ori;
  const title = ready
    ? `${ori} (${name}): materialen gekoppeld`
    : `${ori} (${name}): nog niet berekend`;
  led.title = title;
  led.setAttribute("aria-label", title);
  return led;
}

function appendVrOriLedStrip(parent: HTMLElement, vr: Vr): void {
  const room = roomFromVr(vr);
  const expected = Array.isArray(room?.expected_orientaties)
    ? room!.expected_orientaties!.map((o) => normalizeOrientatie(o)).filter(Boolean) as string[]
    : [];
  if (!expected.length) return;
  const present = vrOriPresentById.get(vr.verblijfsruimte_id) || new Set<string>();
  const strip = document.createElement("span");
  strip.className = "ga-ori-led-strip";
  strip.setAttribute("aria-label", "Oriëntatie-status");
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

/** Laad ori-dekking voor alle VR’s in het huidige VG (LED-strip). */
async function hydrateVrOriCoverage(): Promise<void> {
  if (!auth() || !vrs.length) return;
  const token = auth()!.token;
  await Promise.all(
    vrs.map(async (r) => {
      const id = r.verblijfsruimte_id;
      if (id === selectedVrId) {
        rememberVrOriPresent(id, vlakken);
        return;
      }
      try {
        const ret = await invokeString("API_ListVlakken", [token, id]);
        const data = parseJsonOk<{ vlakken: Vlak[] }>(ret);
        rememberVrOriPresent(id, data.vlakken || []);
      } catch {
        /* behoud vorige cache */
      }
    }),
  );
}

function syncVlakPickDropdown(): void {
  if (!vlakPickEl) return;
  vlakPickSyncLock = true;
  try {
    const prev = vlakPickValue;
    vlakPickEl.replaceChildren();
    if (!selectedVrId) {
      vlakPickEl.setAttribute("aria-disabled", "true");
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "— selecteer eerst een VR —";
      vlakPickEl.appendChild(li);
      vlakPickValue = "";
      return;
    }
    const expected = expectedOrientatiesForSelectedVr();
    if (!expected.length) {
      vlakPickEl.setAttribute("aria-disabled", "true");
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "— eerst oriëntaties op de plattegrond —";
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
      label.textContent = ready
        ? `${code} · ${ORIENTATIE_LABELS[code] || code}`
        : `${code} · ${ORIENTATIE_LABELS[code] || code} · nog niet gespecificeerd`;
      inner.appendChild(label);
      btn.appendChild(inner);
      btn.addEventListener("click", () => {
        if (vlakPickSyncLock) return;
        const pick = btn.dataset.value || "";
        vlakPickValue = pick;
        for (const item of vlakPickEl.querySelectorAll(".drawing-list-item")) {
          item.classList.toggle(
            "selected",
            (item.querySelector("button") as HTMLButtonElement | null)?.dataset.value === pick,
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
      const val =
        (item.querySelector("button") as HTMLButtonElement | null)?.dataset.value || "";
      item.classList.toggle("selected", Boolean(vlakPickValue) && val === vlakPickValue);
    }
  } finally {
    vlakPickSyncLock = false;
  }
}

function prepareVlakForOrientatie(ori: string): void {
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
    vlakEditHintEl.textContent = assigned.length
      ? `Oriëntatie ${oriLabel} — resterende materialen bij 2; vastgelegde vlakken in de scrollbox hieronder.`
      : `Voeg een vlak toe voor ${oriLabel} — kies hieronder een gevelcomponent.`;
  }
  renderVlakken();
  // Lege ori: nooit de VR-berekening van een andere ori laten staan.
  blankResultsUntilVlakSelected(
    assigned.length
      ? undefined
      : `Oriëntatie ${oriLabel}: nog geen materialen — berekening wordt niet getoond tot je hier vlakken toevoegt.`,
  );
}

/** Restrict hidden ori-select to plattegrond-expected codes; display is read-only. */
function syncOrientatieSelectOptions(): void {
  if (!vlakOrientatieEl) return;
  const expected = expectedOrientatiesForSelectedVr();
  const codes = expected.length ? expected : [...ORIENTATIE_ALL];
  const prev = vlakOrientatieEl.value;
  vlakOrientatieEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "—";
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

function ensureOrientatieOption(code: string): void {
  if (!vlakOrientatieEl || !code) return;
  if (![...vlakOrientatieEl.options].some((o) => o.value === code)) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = ORIENTATIE_LABELS[code] || code;
    vlakOrientatieEl.appendChild(o);
  }
}

function syncOrientatieDisplay(): void {
  if (!vlakOrientatieDisplayEl) return;
  const expected = expectedOrientatiesForSelectedVr();
  if (selectedVlakId) {
    const ori = normalizeOrientatie(vlakOrientatieEl?.value);
    vlakOrientatieDisplayEl.textContent = ori
      ? `Oriëntatie: ${ORIENTATIE_LABELS[ori] || ori} (vastgelegd)`
      : "Oriëntatie: —";
    return;
  }
  if (!expected.length) {
    vlakOrientatieDisplayEl.textContent =
      "Oriëntatie: — (eerst vastleggen op de plattegrond)";
    return;
  }
  const matKey = (vlakFacadeEl.selectedOptions[0]?.dataset.materialKey || "").trim() || null;
  const chosen = normalizeOrientatie(vlakOrientatieEl?.value);
  const ori = chosen || resolveOrientatieForNewVlak("", matKey);
  const multi = expected.length > 1;
  if (!chosen && !ori) {
    vlakOrientatieDisplayEl.textContent =
      `Oriëntatie: — kies in de listbox hierboven (${expected.join(", ")})`;
    return;
  }
  vlakOrientatieDisplayEl.textContent = ori
    ? `Oriëntatie: ${ORIENTATIE_LABELS[ori] || ori} (uit plattegrond` +
      (matKey && multi ? ", per materiaal" : "") +
      `)` +
      (multi ? ` · plattegrond: ${expected.join(", ")}` : "")
    : `Oriëntatie: — · plattegrond: ${expected.join(", ")}`;
}

function updateVlakOriCompletenessHint(): void {
  if (!vlakOriStatusEl) return;
  const expected = expectedOrientatiesForSelectedVr();
  if (!selectedVrId) {
    vlakOriStatusEl.textContent = "";
    return;
  }
  if (!expected.length) {
    vlakOriStatusEl.textContent =
      "Geen geveloriëntaties op de plattegrond voor deze VR — verplicht bij Opgeslagen ruimten.";
    return;
  }
  const have = presentVlakOrientaties();
  const missing = expected.filter((o) => !have.has(o));
  const done = expected.filter((o) => have.has(o));
  if (!missing.length) {
    vlakOriStatusEl.textContent =
      `Plattegrond-oriëntaties gedekt (${expected.join(", ")}) — meerdere materialen per oriëntatie zijn toegestaan.`;
  } else {
    vlakOriStatusEl.textContent =
      `Nog geen vlak voor oriëntatie(s): ${missing.join(", ")}` +
      (done.length ? ` (al: ${done.join(", ")})` : "") +
      " — voeg per oriëntatie minstens één materiaal toe.";
  }
}

/** Eerste plattegrond-oriëntatie die nog geen vlak heeft (dekking). */
function nextFreeExpectedOrientatie(exceptVlakId?: string | null): string {
  const preferred = expectedOrientatiesForSelectedVr();
  if (!preferred.length) return "";
  for (const c of preferred) {
    if (!orientatieTakenOnVr(c, exceptVlakId)) return c;
  }
  return "";
}

/**
 * Oriëntatie voor een (nieuw) materiaal-vlak: eerste plattegrond-ori waar dit
 * materiaal nog niet staat. Meerdere materialen op dezelfde ori zijn ok.
 */
function defaultOrientatieForMaterial(matKey: string | null | undefined, exceptVlakId?: string | null): string {
  return defaultOrientatieForMaterialCore(
    expectedOrientatiesForSelectedVr(),
    vlakken,
    vrFacades,
    materialGroupKey,
    matKey,
    exceptVlakId,
  );
}

/** Respect listbox / form choice; only auto-pick when nothing valid is selected yet. */
function resolveOrientatieForNewVlak(
  currentOri: string | null | undefined,
  matKey: string | null | undefined,
  exceptVlakId?: string | null,
): string {
  return resolveOrientatieForNewVlakCore(
    expectedOrientatiesForSelectedVr(),
    currentOri,
    vlakken,
    vrFacades,
    materialGroupKey,
    matKey,
    exceptVlakId,
  );
}

function materialHasFreeOrientatie(matKey: string | null | undefined, exceptVlakId?: string | null): boolean {
  return materialHasFreeOrientatieCore(
    expectedOrientatiesForSelectedVr(),
    vlakken,
    vrFacades,
    materialGroupKey,
    matKey,
    exceptVlakId,
  );
}

/** @deprecated alias — auto-assign uses plattegrond expected only */
function firstFreeOrientatie(): string {
  return nextFreeExpectedOrientatie();
}

function materialOrientatieTaken(matKey: string, ori: string, exceptVlakId?: string | null): Vlak | null {
  return materialOrientatieTakenCore(vlakken, vrFacades, materialGroupKey, matKey, ori, exceptVlakId);
}

function orisUsedForMaterial(matKey: string, exceptVlakId?: string | null): string[] {
  return orisUsedForMaterialCore(vlakken, vrFacades, materialGroupKey, matKey, exceptVlakId);
}

function formatFacadeGroupOption(g: FacadePickGroup): string {
  return formatFacadeGroupOptionCore(g);
}

function fillFacadeSelect(): void {
  const prev = vlakFacadeEl.value;
  const used = usedFacadePickIds();
  const editing = Boolean(selectedVlakId);
  const propsReady = editing || vlakPropsComplete();
  const expected = expectedOrientatiesForSelectedVr();
  const canShowMaterials = propsReady && Boolean(expected.length);
  const wantOri = normalizeOrientatie(vlakOrientatieEl?.value);
  const allGroups = groupFacadesForPick(vrFacades, used);
  const readyGroups = allGroups.filter((g) => g.ga_ready);
  // Vrij = nog geometrie én vrije ori voor dit materiaal (component-ori indien vastgelegd).
  let available = readyGroups.filter((g) => {
    if (g.used) return false;
    // Alleen componenten mét geveloriëntatie (N…NW) — zonder ori: oranje op tekening, niet kiesbaar.
    const compOri = groupOrientatie(g);
    if (!compOri) return false;
    const matKey = g.materialKey;
    if (!matKey) return false;
    return !materialOrientatieTaken(matKey, compOri, selectedVlakId || null);
  });
  if (!wantOri) {
    available = [];
  } else {
    available = filterFacadeGroupsByOrientatie(available, wantOri);
  }
  const assignedForOri = wantOri ? vlakkenForOrientatie(wantOri) : [];
  const readyForOri = wantOri
    ? readyGroups.filter((g) => groupOrientatie(g) === wantOri)
    : [];
  const incompleteN = allGroups.filter((g) => !g.ga_ready).length;

  // Edit mode: toon gekoppelde component read-only — geen verwarrende "kies…"-lijst.
  if (editing) {
    const cur = vlakken.find((v) => v.vlak_id === selectedVlakId);
    const fac = cur ? findFacadeForVlak(cur) : null;
    const facId = fac?.id || cur?.facade_subsection_id || prev || "";
    const g = fac
      ? groupFacadesForPick(vrFacades, new Set()).find(
          (x) => x.primaryId === fac.id || x.memberIds.includes(fac.id),
        )
      : facId
        ? groupFacadesForPick(vrFacades, new Set()).find(
            (x) => x.primaryId === facId || x.memberIds.includes(facId),
          )
        : undefined;
    vlakFacadeEl.innerHTML = "";
    if (facId) {
      const o = document.createElement("option");
      o.value = facId;
      const base = g ? formatFacadeGroupOption(g) : fac?.material_name || facId.slice(0, 8);
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
      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "— geen component gekoppeld —";
      vlakFacadeEl.appendChild(ph);
      vlakFacadeEl.size = 1;
    }
    if (vlakFacadeLabelEl) {
      vlakFacadeLabelEl.classList.add("hidden");
    }
    if (vlakFacadeLinkedEl) {
      const label =
        vlakFacadeEl.selectedOptions[0]?.textContent?.trim() || "—";
      const composed =
        fac?.boolean_op === "compose" || fac?.boolean_op === "difference";
      vlakFacadeLinkedEl.hidden = false;
      vlakFacadeLinkedEl.textContent =
        fac?.from_seal || cur?.quantity_kind === "length"
          ? `Gekoppeld kierdichting: ${label}`
          : composed
            ? `Gekoppeld netto-component: ${label}`
            : `Gekoppeld aan dit vlak: ${label}`;
    }
    vlakFacadeEl.classList.add("ga-facade-select--locked");
    vlakFacadeEl.disabled = true;
    onFacadePick(false);
    updateFacadeHint();
    syncVlakMaterialGate();
    updateVlakInventory();
    return;
  }

  // Add mode: alleen nog niet als vlak gekoppelde componenten.
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
    ph.textContent = "— eerst oriëntaties op plattegrond —";
  } else if (!propsReady) {
    ph.textContent = "— eerst oriëntaties op plattegrond —";
  } else if (!available.length) {
    ph.textContent = !wantOri
      ? "— kies eerst een oriëntatie hierboven —"
      : assignedForOri.length
        ? `— alle materialen voor ${wantOri} zijn toebedeeld — zie toegevoegde vlakken —`
        : readyForOri.length
          ? `— geen vrij materiaal meer voor ${wantOri} —`
          : readyGroups.length
            ? `— geen componenten met oriëntatie ${wantOri} (leg ori vast op geveltekening) —`
            : incompleteN
              ? "— geen complete componenten (materiaal + oriëntatie op gevel vereist) —"
              : "— geen componenten voor deze VR —";
  } else {
    ph.textContent = wantOri
      ? `— kies materiaal voor ${ORIENTATIE_LABELS[wantOri] || wantOri} —`
      : "— kies een materiaal (zelfde materiaal wordt opgeteld) —";
  }
  vlakFacadeEl.appendChild(ph);

  const shown = canShowMaterials ? [...available] : [];
  for (const g of shown) {
    const o = document.createElement("option");
    o.value = g.primaryId;
    const base = formatFacadeGroupOption(g);
    o.textContent = base;
    o.title = base;
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

function updateVlakInventory(): void {
  if (!vlakInventoryEl) return;
  if (!selectedVrId) {
    vlakInventoryEl.textContent = "";
    if (vlakCoverageEl) vlakCoverageEl.hidden = true;
    syncRecalcEnabled();
    return;
  }

  const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
  const focusVlakken = focusOri ? vlakkenForOrientatie(focusOri) : [];
  // Actieve ori zonder vlakken: geen 100%-balk van een andere ori tonen.
  if (focusOri && focusVlakken.length === 0) {
    if (vlakCoverageEl) vlakCoverageEl.hidden = true;
    const oriLabel = ORIENTATIE_LABELS[focusOri] || focusOri;
    vlakInventoryEl.textContent = `Oriëntatie ${oriLabel}: nog geen toegevoegde vlakken.`;
    syncRecalcEnabled();
    return;
  }

  // Stotaal / dekking altijd per actieve oriëntatie — nooit VR-breed optellen.
  const stotaal = focusOri ? facadeStotaalM2(focusOri) : 0;
  const deel = focusOri ? vlakkenDeeloppervlakM2(focusOri) : 0;
  const oriBit = focusOri ? ` (${focusOri})` : "";
  const tol = 0.02;
  const complete = stotaal > 0 && Math.abs(stotaal - deel) <= tol;
  const over = stotaal > 0 && deel > stotaal + tol;
  let pct = 0;
  if (stotaal > 0) {
    pct = complete ? 100 : Math.max(0, Math.round((deel / stotaal) * 1000) / 10);
  }

  if (vlakCoverageEl && vlakCoveragePctEl && vlakCoverageBarEl && vlakCoverageMetaEl) {
    if (!(stotaal > 0) && !focusVlakken.length) {
      vlakCoverageEl.hidden = true;
    } else {
      vlakCoverageEl.hidden = false;
      vlakCoverageEl.classList.remove("is-complete", "is-partial", "is-over");
      if (!(stotaal > 0)) {
        vlakCoveragePctEl.textContent = "—";
        vlakCoverageBarEl.style.width = "0%";
        vlakCoverageMetaEl.textContent = focusOri
          ? `Nog geen complete geveloppervlakten (Stotaal) voor oriëntatie ${focusOri}.`
          : "Kies een oriëntatie om Stotaal-dekking te zien.";
      } else if (facadeOpeningsUncutFromWall(focusOri)) {
        const rawSum = facadeReadyAreaFacades(focusOri).reduce((a, f) => a + Number(f.area_m2), 0);
        vlakCoverageEl.classList.add("is-partial");
        vlakCoveragePctEl.textContent = `${pct}%`;
        vlakCoverageBarEl.style.width = `${Math.min(100, pct)}%`;
        vlakCoverageMetaEl.textContent =
          `Stotaal ${stotaal.toFixed(2)} m²${oriBit} is de gevelcontour. Kozijn/glas zitten daar nog in (som materialen zou ${rawSum.toFixed(2)} m² zijn). Maak op de geveltekening ± (gevel − kozijn) zodat muur + hout + glas optellen tot Stotaal.`;
      } else if (complete) {
        vlakCoverageEl.classList.add("is-complete");
        vlakCoveragePctEl.textContent = "100%";
        vlakCoverageBarEl.style.width = "100%";
        vlakCoverageMetaEl.textContent = `Volledige dekking${oriBit}: ${deel.toFixed(2)} / ${stotaal.toFixed(2)} m² — materialen tellen op tot 100% van dit gevelvlak.`;
      } else if (over) {
        vlakCoverageEl.classList.add("is-over");
        vlakCoveragePctEl.textContent = `${pct}%`;
        vlakCoverageBarEl.style.width = "100%";
        vlakCoverageMetaEl.textContent = `Te veel${oriBit}: ${deel.toFixed(2)} / ${stotaal.toFixed(2)} m² — deeloppervlakten overschrijden Stotaal (${(deel - stotaal).toFixed(2)} m² te veel).`;
      } else {
        vlakCoverageEl.classList.add("is-partial");
        vlakCoveragePctEl.textContent = `${pct}%`;
        vlakCoverageBarEl.style.width = `${Math.min(100, pct)}%`;
        const rest = Math.max(0, stotaal - deel);
        vlakCoverageMetaEl.textContent = `${deel.toFixed(2)} / ${stotaal.toFixed(2)} m² gedekt${oriBit} — nog ${rest.toFixed(2)} m² (${Math.max(0, Math.round((100 - pct) * 10) / 10)}%) nodig tot 100%.`;
      }
    }
  }

  const used = usedFacadePickIds();
  const groups = groupFacadesForPick(vrFacades, used).filter(
    (g) => g.ga_ready && Boolean(groupOrientatie(g)),
  );
  const linked = groups.filter(
    (g) => g.used || !materialHasFreeOrientatie(g.materialKey),
  ).length;
  const free = groups.filter(
    (g) => !g.used && materialHasFreeOrientatie(g.materialKey),
  ).length;
  const expected = expectedOrientatiesForSelectedVr();
  const missingOri = expected.filter((o) => !orientatieTakenOnVr(o, null));
  const bits = [
    `Geveltekening: ${groups.length} materiaal-groep(en)`,
    `${linked} als vlak gekoppeld`,
    free ? `${free} nog toe te kennen` : "geen vrij materiaal",
  ];
  if (focusOri) {
    bits.unshift(
      `ori ${focusOri}: ${focusVlakken.length} vlak${focusVlakken.length === 1 ? "" : "ken"}`,
    );
  }
  if (expected.length) {
    bits.push(
      missingOri.length
        ? `nog dekking nodig voor ori ${missingOri.join(", ")}`
        : `oriëntaties gedekt (${expected.join(", ")})`,
    );
  }
  if (focusOri && stotaal > 0) {
    bits.unshift(
      complete
        ? `ori ${focusOri}: 100% Stotaal`
        : `ori ${focusOri}: ${pct}% van Stotaal`,
    );
  }
  vlakInventoryEl.textContent = bits.join(" · ");
  syncRecalcEnabled();
}

function booleanOpShort(op?: string | null): string | null {
  if (op === "union") return "∪";
  if (op === "intersect") return "∩";
  if (op === "difference" || op === "compose") return "±";
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
    orientatie: facadeOrientatie(f),
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
    const data = bppPhase1Enabled()
      ? await bppListVrFacadeComponents(invokeString, auth()!.token, buildingId, vrNr)
      : await apiGet<{
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
            catalog_id?: string | null;
            master_category?: string | null;
            material_id?: string | null;
            ra_dba?: number | null;
            boolean_op?: string | null;
            repeat_count?: number | null;
            orientatie?: string | null;
            constituents?: Array<{
              id?: string;
              sign?: string;
              label?: string;
              catalog_id?: string | null;
              material_name?: string | null;
              area_m2?: number | null;
            }>;
          }>;
          counts?: { eligible?: number; ga_ready?: number; excluded_as_source?: number };
        }>(
          `/api/floormap/vr-components?building_id=${encodeURIComponent(buildingId)}&vr_nr=${encodeURIComponent(vrNr)}`,
        );
    vrFacades = (data.eligible || []).map((s) => {
      const rawId = String(s.id || "");
      const fromSeal = Boolean((s as { from_seal?: boolean }).from_seal) || rawId.endsWith("#seal");
      const sourceId = String(
        (s as { source_subsection_id?: string }).source_subsection_id ||
          (fromSeal && rawId.endsWith("#seal") ? rawId.slice(0, -5) : rawId),
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
      repeat_count:
        s.repeat_count != null && Number.isFinite(Number(s.repeat_count))
          ? Math.max(1, Math.min(99, Math.round(Number(s.repeat_count))))
          : 1,
      orientatie: normalizeOrientatie(s.orientatie) || null,
      from_seal: fromSeal,
      source_subsection_id: sourceId || null,
      constituents: Array.isArray(s.constituents)
        ? s.constituents.map((c) => ({
            id: String(c.id || ""),
            sign: c.sign === "-" ? "-" : "+",
            label: String(c.label || ""),
            catalog_id:
              c.catalog_id != null && String(c.catalog_id).trim()
                ? String(c.catalog_id).trim()
                : null,
            material_name: c.material_name != null ? String(c.material_name) : null,
            area_m2: c.area_m2 != null ? Number(c.area_m2) : null,
          }))
        : [],
    };
    });
    for (const f of vrFacades) {
      if (!facadeOrientatie(f)) f.ga_ready = false;
    }
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      const n = vrFacades.length;
      const ready = vrFacades.filter((f) => f.ga_ready).length;
      const excl = data.counts?.excluded_as_source ?? 0;
      const used = usedFacadePickIds();
      const pickGroups = groupFacadesForPick(vrFacades, used).filter(
        (g) => g.ga_ready && Boolean(groupOrientatie(g)),
      );
      const merged = pickGroups.filter((g) => g.members.length > 1).length;
      const pickN = pickGroups.filter(
        (g) => !g.used && materialHasFreeOrientatie(g.materialKey),
      ).length;
      const already = pickGroups.filter(
        (g) => g.used || !materialHasFreeOrientatie(g.materialKey),
      ).length;
      const incomplete = n - ready;
      const reusedMat = pickGroups.filter(
        (g) =>
          !g.used &&
          g.materialKey &&
          orisUsedForMaterial(g.materialKey).length > 0 &&
          materialHasFreeOrientatie(g.materialKey),
      ).length;
      vlakFacadeHintEl.textContent =
        n === 0
          ? `Geen gevelcomponenten voor VR ${vrNr}${excl ? ` (${excl} vervangen door zelfde-materiaal setbewerking)` : ""}.`
          : `VR ${vrNr}: ${ready} component(en) met materiaal + oriëntatie · ${pickN} materiaal-groep(en) kiesbaar` +
            (reusedMat ? ` · ${reusedMat}× zelfde materiaal opnieuw (andere oriëntatie)` : "") +
            (already ? ` · ${already} al gekoppeld` : "") +
            (merged ? ` · ${merged}× zelfde materiaal opgeteld` : "") +
            (incomplete ? ` · ${incomplete} zonder materiaal (niet selecteerbaar)` : "") +
            (excl ? ` · ${excl} vervangen (zelfde materiaal)` : "") +
            `. Meerdere materialen per oriëntatie; zelfde materiaal wordt opgeteld.`;
    }
  } catch (err) {
    vrFacades = [];
    fillFacadeSelect();
    if (vlakFacadeHintEl) {
      vlakFacadeHintEl.textContent = err instanceof Error ? err.message : String(err);
    }
  }
}

function formatConstituentLine(c: VrFacadeConstituent): string {
  const code = (c.catalog_id || "").trim();
  const name = (c.material_name || c.label || "").trim();
  const mat = code && name ? `${code} · ${name}` : code || name || c.id.slice(0, 8);
  const area =
    c.area_m2 != null && Number.isFinite(c.area_m2) ? ` · ${c.area_m2.toFixed(2)} m²` : "";
  return `${c.sign === "-" ? "−" : "+"} ${mat}${area}`;
}

/** Toon +/- opbouw van een samengesteld gevelcomponent (netto + bronnen). */
function renderFacadeComposeBreakdown(facId: string | null | undefined): void {
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
  head.textContent = "Opbouw gevelvlak (+/−):";
  vlakFacadeComposeEl.appendChild(head);

  // Netto-resultaat eerst (het gekoppelde materiaal), daarna bronnen.
  const netto = document.createElement("li");
  netto.className = "ga-facade-compose-netto";
  const code = (fac.catalog_id || "").trim();
  const name = (fac.material_name || fac.label || "").trim();
  const mat = code && name ? `${code} · ${name}` : code || name || "netto";
  const area =
    fac.area_m2 != null && Number.isFinite(fac.area_m2)
      ? ` · ${Number(fac.area_m2).toFixed(2)} m²`
      : "";
  netto.textContent = `= ${mat}${area} (netto in berekening)`;
  vlakFacadeComposeEl.appendChild(netto);

  for (const c of parts) {
    const li = document.createElement("li");
    li.className =
      c.sign === "-" ? "ga-facade-compose-minus" : "ga-facade-compose-plus";
    li.textContent = formatConstituentLine(c);
    vlakFacadeComposeEl.appendChild(li);
  }
  vlakFacadeComposeEl.hidden = false;
}

function updateFacadeHint(): void {
  if (!vlakFacadePreviewEl) return;
  const opt = vlakFacadeEl.selectedOptions[0];
  const id = (vlakFacadeEl.value || "").trim();
  if (!opt || !id) {
    vlakFacadePreviewEl.textContent = "—";
    vlakFacadePreviewEl.classList.add("is-empty");
    renderFacadeComposeBreakdown(null);
    return;
  }
  const fac = vrFacades.find((f) => f.id === id);
  const code = (fac?.catalog_id || opt.dataset.catalogId || "").trim();
  const name = (fac?.material_name || "").trim();
  const hasMat = Boolean((fac?.material_id || opt.dataset.materialId || "").trim());
  if (hasMat) {
    const matLabel = code && name ? `${code} · ${name}` : code || name || "materiaal gekoppeld";
    const composed =
      fac?.boolean_op === "compose" || fac?.boolean_op === "difference"
        ? " · samengesteld (±)"
        : "";
    const matKey =
      (opt.dataset.materialKey || "").trim() ||
      (fac ? materialGroupKey(fac) : null) ||
      "";
    const oris = matKey ? orisUsedForMaterial(matKey, selectedVlakId) : [];
    const oriBit = oris.length
      ? ` · al als vlak met ori ${oris.join(", ")}`
      : "";
    const chosen = normalizeOrientatie(vlakOrientatieEl?.value);
    const nextBit = chosen ? ` · dit vlak krijgt ori ${chosen}` : "";
    const nParts = Number(opt.dataset.count || "1");
    const sumBit =
      nParts > 1 ? ` · ${nParts} componenten opgeteld` : "";
    vlakFacadePreviewEl.textContent = `Netto-materiaal: ${matLabel}${composed}${sumBit} — RA op geveltekening; CL/Cg bij het vlak${oriBit}${nextBit}`;
  } else {
    vlakFacadePreviewEl.textContent =
      "Geen materiaal — incomplete componenten staan niet in de keuzelijst; koppel eerst op de geveltekening.";
  }
  vlakFacadePreviewEl.classList.toggle("is-empty", !hasMat);
  vlakFacadePreviewEl.classList.toggle("is-warn", !hasMat);
  renderFacadeComposeBreakdown(id);
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
    // Alleen hoeveelheid resetten — CL/Cg/omschrijving/Stot blijven staan.
    syncVlakQtyUi("area", "0", false);
    if (!selectedVlakId) syncVlakMaterialGate();
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
  // Oriëntatie blijft de listbox-keuze; materiaal volgt die filter.
  if (!selectedVlakId) {
    applyClCgFromOrientatie(vlakOrientatieEl?.value);
    syncOrientatieDisplay();
    syncVlakMaterialGate();
  }
}

function refreshFreeRoomsFromLinks(): void {
  rebuildLinkedForSelectedVariant();
  freeRooms = [...floormapRoomsById.values()].filter((r) => !linkedSubIds.has(r.id));
  fillRoomSelect();
}

async function loadVariants(): Promise<void> {
  if (!buildingId || !auth()) return;
  const ret = await invokeString("API_ListVariants", [auth()!.token, buildingId]);
  const data = parseJsonOk<{ variants: Variant[] }>(ret);
  variants = data.variants || [];
  if (!selectedVariantId && variants.length) selectedVariantId = variants[0].variant_id;
  if (selectedVariantId && !variants.some((v) => v.variant_id === selectedVariantId)) {
    selectedVariantId = variants[0]?.variant_id ?? null;
  }
  refreshFreeRoomsFromLinks();
  renderVariants();
  renderComparePick();
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
      refreshFreeRoomsFromLinks();
      renderVariants();
      renderComparePick();
      void loadVgs();
    });
    li.appendChild(btn);
    variantListEl.appendChild(li);
  }
}

function renderComparePick(): void {
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
        ` ${v.omschrijving} · Lb ${v.geluidsbelasting_dba} dB · ${v.spectrum_kind}`,
      ),
    );
    comparePickEl.appendChild(label);
  }
}

function fmtCompareNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return String(round1(Number(n)));
}

async function runVariantCompare(): Promise<void> {
  if (!auth() || !buildingId || !compareTableEl || !compareWrapEl) return;
  const ids = [...compareSelectedIds].filter((id) => variants.some((v) => v.variant_id === id));
  if (ids.length < 2) throw new Error("Selecteer minstens twee varianten");
  const ret = await invokeString("API_CompareVariants", [auth()!.token, buildingId, ids.join(",")]);
  const data = parseJsonOk<{ rows: CompareRow[] }>(ret);
  const rows = data.rows || [];

  const bySub = new Map<string, { label: string; byVariant: Map<string, CompareRow> }>();
  for (const r of rows) {
    let entry = bySub.get(r.subsection_id);
    if (!entry) {
      const room = floormapRoomsById.get(r.subsection_id);
      const label = r.vr_nr
        ? `VR ${r.vr_nr}${r.omschrijving ? ` · ${r.omschrijving}` : ""}`
        : r.omschrijving || r.subsection_id.slice(0, 8);
      entry = { label: room ? vrLabelFromNr(room.vr_nr || r.vr_nr, room.label) : label, byVariant: new Map() };
      bySub.set(r.subsection_id, entry);
    }
    entry.byVariant.set(r.variant_id, r);
  }

  const selectedVariants = ids
    .map((id) => variants.find((v) => v.variant_id === id))
    .filter((v): v is Variant => Boolean(v));

  const thead = compareTableEl.querySelector("thead");
  const tbody = compareTableEl.querySelector("tbody");
  if (!thead || !tbody) return;
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const hr = document.createElement("tr");
  hr.innerHTML = `<th>Ruimte</th>`;
  for (const v of selectedVariants) {
    const th = document.createElement("th");
    th.innerHTML = `${esc(v.omschrijving)}<br><span class="hint">Lb ${esc(String(v.geluidsbelasting_dba))} · ${esc(v.spectrum_kind)} · ${esc(v.gebruiksfunctie)}</span>`;
    hr.appendChild(th);
  }
  thead.appendChild(hr);

  const sortedSubs = [...bySub.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, "nl"));
  for (const [, entry] of sortedSubs) {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = entry.label;
    tr.appendChild(td0);

    const cellVals: { lbik: number | null; toets: boolean | null; text: string }[] = [];
    for (const v of selectedVariants) {
      const r = entry.byVariant.get(v.variant_id);
      const grens = grenswaardeLbik(v.gebruiksfunctie);
      const gak = r?.gak_dba != null ? Number(r.gak_dba) : null;
      const lb = Number(v.geluidsbelasting_dba);
      const lbik = gak != null && Number.isFinite(lb) ? round1(lb - gak) : null;
      const toets = lbik != null ? lbik <= grens : null;
      const ga = r?.ga_dba != null ? Number(r.ga_dba) : null;
      const text =
        `GA ${fmtCompareNum(ga)} · GA;k ${fmtCompareNum(gak)} · Lbi;k ${fmtCompareNum(lbik)}` +
        (toets == null ? " · —" : toets ? " · Voldoet" : " · Voldoet niet");
      cellVals.push({ lbik, toets, text });
    }
    const lbiks = cellVals.map((c) => c.lbik).filter((x): x is number => x != null);
    const allSame =
      lbiks.length <= 1 || lbiks.every((x) => Math.abs(x - lbiks[0]) < 0.05);
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

async function loadVgs(preferVgId?: string | null): Promise<void> {
  vgs = [];
  vrs = [];
  vlakken = [];
  vrOriPresentById.clear();
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
  const ret = await invokeString("API_ListVerblijfsgebieden", [auth()!.token, selectedVariantId]);
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
  if (!auth()) return;
  let changed = false;
  for (const g of vgs) {
    const nr = vgNrForVg(g.verblijfsgebied_id, g.omschrijving);
    if (nr == null) continue;
    const want = vgLabelFromNr(nr);
    if (g.omschrijving.trim() === want) continue;
    const ret = await invokeString("API_SaveVerblijfsgebied", [
      auth()!.token,
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
  if (!selectedVgId || !auth()) {
    renderVrs();
    renderVlakken();
    vrEditForm.classList.add("hidden");
    syncVrHeading();
    return;
  }
  const ret = await invokeString("API_ListVerblijfsruimten", [auth()!.token, selectedVgId]);
  const data = parseJsonOk<{ verblijfsruimten: Vr[] }>(ret);
  vrs = sortByLabelAz(data.verblijfsruimten || [], (r) => r.omschrijving || "");
  // Drop session “fresh” markers for VRs whose stored results were cleared server-side.
  for (const id of [...freshResultVrIds]) {
    const vr = vrs.find((r) => r.verblijfsruimte_id === id);
    if (!vr || (vr.ga_dba == null && vr.lbi_dba == null && vr.gak_dba == null)) {
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
    /* LED-strip is optioneel — geen blokkade bij WS-glitch */
  }
  renderVrs();
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
    const inner = document.createElement("span");
    inner.className = "drawing-list-select-inner";
    const label = document.createElement("span");
    label.className = "drawing-list-select-label";
    if (room) {
      const metrics = effectiveVrMetrics(r);
      label.textContent = formatVrListLine(room, metrics.volume);
    } else {
      const metrics = effectiveVrMetrics(r);
      label.textContent = `${r.omschrijving} · ${metrics.vloer.toFixed(2)} m² · V=${metrics.volume.toFixed(1)} m³`;
    }
    // Show stored and/or session-fresh GA/Lbi/GA;k (geometry invalidation clears DB columns).
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
        vrVoldoet.get(r.verblijfsruimte_id) === true
          ? "Voldoet"
          : vrVoldoet.get(r.verblijfsruimte_id) === false
            ? "Voldoet niet"
            : null,
      ].filter(Boolean);
      label.textContent += ` · ${bits.join(" · ")}${source}`;
    } else if (r.verblijfsruimte_id === selectedVrId) {
      label.textContent += " · herberekenen";
    }
    inner.appendChild(label);
    appendVrOriLedStrip(inner, r);
    btn.appendChild(inner);
    btn.addEventListener("click", () => {
      selectedVrId = r.verblijfsruimte_id;
      selectedVlakId = null;
      if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak toevoegen";
      vlakCancelBtn?.classList.add("hidden");
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

/** Prefer live façade geometry over stored vlak snapshot.
 * One vlak for a material → sum peers (combined plane). Multiple vlakken with same
 * material (different ori) → each uses only its linked component to avoid double-count. */
function liveVlakQty(v: Vlak): { kind: "area" | "length"; qty: number } {
  const kind = v.quantity_kind === "length" ? "length" : "area";
  const stored = kind === "length" ? Number(v.length_m ?? 0) : Number(v.area_m2 ?? 0);
  const facId = v.facade_subsection_id;
  if (!facId || !vrFacades.length) return { kind, qty: stored };
  const fac = findFacadeForVlak(v);
  if (!fac) return { kind, qty: stored };
  const key = materialGroupKey(fac);
  const ori = facadeOrientatie(fac);
  const peers = key
    ? vrFacades.filter(
        (f) => materialGroupKey(f) === key && facadeOrientatie(f) === ori,
      )
    : [fac];
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
    let sum = 0;
    let any = false;
    for (const p of sources) {
      if (p.length_m != null && Number.isFinite(Number(p.length_m))) {
        sum += Number(p.length_m);
        any = true;
      }
    }
    return { kind, qty: any ? Math.round(sum * 100) / 100 : stored };
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

async function loadVlakken(opts?: { resetForm?: boolean; openFirstVlak?: boolean }): Promise<void> {
  vlakken = [];
  if (!selectedVrId || !auth()) {
    renderVlakken();
    await loadFacadesForSelectedVr();
    syncOrientatieSelectOptions();
    updateVlakOriCompletenessHint();
    return;
  }
  const ret = await invokeString("API_ListVlakken", [auth()!.token, selectedVrId]);
  const data = parseJsonOk<{ vlakken: Vlak[] }>(ret);
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
  // Na VG/VR-keuze: bij volle Stotaal-dekking eerste vlak openen (resultaten).
  // Bij incomplete dekking juist in toevoeg-modus blijven — anders is
  // «2. Gevelcomponent» vergrendeld en kun je geen materiaal meer kiezen.
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
        vlakEditHintEl.textContent =
          "Oppervlaktedekking is nog geen 100%. Kies een oriëntatie en daarna bij 2. een nog vrij materiaal.";
      }
    }
    return;
  }
  if (!selectedVlakId) {
    if (opts?.resetForm) {
      applyVlakFormDefaultsFromExisting();
    } else {
      // Lijst vernieuwd (save/delete): houd gekozen oriëntatie vast.
      const expected = expectedOrientatiesForSelectedVr();
      const cur = normalizeOrientatie(vlakOrientatieEl?.value);
      if (vlakOrientatieEl) {
        if (cur && expected.includes(cur)) {
          ensureOrientatieOption(cur);
          vlakOrientatieEl.value = cur;
        }
      }
      fillFacadeSelect();
      syncVlakMaterialGate();
      updateVlakOriCompletenessHint();
      syncOrientatieDisplay();
    }
    // Deel ≠ Stotaal → leeg zonder melding; anders resultaten pas tonen na vlakkeuze.
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

function fmtRes(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(round1(v)) : "—";
}

function vrHasStoredResults(r: Vr): boolean {
  return r.ga_dba != null || r.lbi_dba != null || r.gak_dba != null;
}

function deriveToetsFromStored(vr: Vr): boolean | null {
  const variant = variants.find((v) => v.variant_id === selectedVariantId);
  const Lb = Number(variant?.geluidsbelasting_dba ?? 0);
  const gak = vr.gak_dba != null && Number.isFinite(Number(vr.gak_dba)) ? Number(vr.gak_dba) : null;
  if (gak == null || !Number.isFinite(Lb)) return null;
  const lbik = round1(Lb - gak);
  const grens = grenswaardeLbik(variant?.gebruiksfunctie);
  return lbik <= grens;
}

/** Show GA/Lbi/GA;k from Postgres after reload (S/R′ remain live-only). */
function hydrateStoredVrResults(vr: Vr, hintExtra?: string): boolean {
  if (!vrHasStoredResults(vr)) return false;
  const variant = variants.find((v) => v.variant_id === selectedVariantId);
  const Lb = Number(variant?.geluidsbelasting_dba ?? 0);
  const grens = grenswaardeLbik(variant?.gebruiksfunctie);
  const gak = vr.gak_dba != null && Number.isFinite(Number(vr.gak_dba)) ? Number(vr.gak_dba) : null;
  const lbik = gak != null && Number.isFinite(Lb) ? round1(Lb - gak) : null;
  const voldoet = deriveToetsFromStored(vr);
  if (voldoet != null) vrVoldoet.set(vr.verblijfsruimte_id, voldoet);
  else vrVoldoet.delete(vr.verblijfsruimte_id);

  if (resSEl) resSEl.textContent = "—";
  if (resRpEl) resRpEl.textContent = "—";
  if (resDEl) resDEl.textContent = "—";
  if (resGaEl) resGaEl.textContent = `${fmtRes(vr.ga_dba)} dB`;
  if (resLbiEl) resLbiEl.textContent = `${fmtRes(vr.lbi_dba)} dB`;
  if (resGakEl) resGakEl.textContent = `${fmtRes(vr.gak_dba)} dB`;
  if (resLbikEl) resLbikEl.textContent = lbik != null ? `${fmtRes(lbik)} dB` : "—";
  if (resToetsEl) {
    resToetsEl.classList.remove("toets-ok", "toets-fail");
    if (voldoet === true) {
      resToetsEl.textContent = "Voldoet";
      resToetsEl.classList.add("toets-ok");
    } else if (voldoet === false) {
      resToetsEl.textContent = "Voldoet niet";
      resToetsEl.classList.add("toets-fail");
    } else {
      resToetsEl.textContent = "—";
    }
  }
  const dirtyBit = resultsDirty ? " · niet opgeslagen" : " · opgeslagen";
  const req = gak != null ? ` · GA;k ≥ ${fmtRes(Lb - grens)} dB (Lb−${grens})` : "";
  if (vrResultsHintEl) {
    vrResultsHintEl.textContent = `Opgeslagen resultaten${dirtyBit} · grens Lbi;k ≤ ${grens} dB${req}${
      hintExtra ? ` · ${hintExtra}` : ""
    }`;
    vrResultsHintEl.classList.remove("hidden");
  }
  return true;
}

function clearVrResults(hint: string, opts?: { keepStored?: boolean }): void {
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  if (opts?.keepStored !== false && vr && vrHasStoredResults(vr)) {
    hydrateStoredVrResults(vr, hint);
    // Zonder verse element-berekening geen zinvolle Analyseer — alleen na Herberekenen.
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
  if (resSEl) resSEl.textContent = "—";
  if (resRpEl) resRpEl.textContent = "—";
  if (resDEl) resDEl.textContent = "—";
  if (resGaEl) resGaEl.textContent = "—";
  if (resLbiEl) resLbiEl.textContent = "—";
  if (resGakEl) resGakEl.textContent = "—";
  if (resLbikEl) resLbikEl.textContent = "—";
  if (resToetsEl) {
    resToetsEl.textContent = "—";
    resToetsEl.classList.remove("toets-ok", "toets-fail");
  }
}

/** Add/select mode: no vlak chosen yet → hide calc numbers (DB blijft intact). */
function blankResultsUntilVlakSelected(hint?: string): void {
  calcRevealEpoch += 1;
  clearVrResults(
    hint ||
      "Open een vlak in de lijst om de berekening te tonen, of voeg een nieuw vlak toe voor een vrije oriëntatie.",
    { keepStored: false },
  );
}

/** Whether the results panel may show VR-calc numbers for the current UI focus. */
function resultsRevealAllowed(opts?: {
  reveal?: boolean;
  useFormCorrections?: boolean;
}): boolean {
  if (opts?.reveal) return true;
  if (opts?.useFormCorrections && selectedVlakId) return true;
  const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
  if (focusOri && vlakkenForOrientatie(focusOri).length === 0) return false;
  return Boolean(selectedVlakId);
}

/** Clear on-screen and stored GA/Lbi/GA;k when a VR has no vlakken left. */
async function clearPersistedVrCalc(hint: string): Promise<void> {
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
      auth()!.token,
      vr.verblijfsruimte_id,
      "",
      "",
      "",
    ]);
    if (typeof ret === "string" && ret.startsWith("ERROR")) {
      setConn("err", `Resultaten niet gewist: ${ret}`);
    }
  } catch (err) {
    setConn("err", `Resultaten niet gewist: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Ready area façades for Stotaal (no seal lengths).
 * When `ori` is set, only that geveloriëntatie — Stotaal is never VR-wide.
 */
function facadeReadyAreaFacades(ori?: string | null): VrFacadeOpt[] {
  const want = normalizeOrientatie(ori);
  return vrFacades.filter((f) => {
    if (!f.ga_ready || f.quantity_kind === "length") return false;
    if (f.area_m2 == null || !Number.isFinite(Number(f.area_m2))) return false;
    if (want && facadeOrientatie(f) !== want) return false;
    return true;
  });
}

/** Oriëntaties met ≥1 ready area-façade (voor per-ori Stotaal-check). */
function facadeOrisWithArea(): string[] {
  const oris = new Set<string>();
  for (const f of facadeReadyAreaFacades()) {
    const o = facadeOrientatie(f);
    if (o) oris.add(o);
  }
  return [...oris];
}

function facadeIsComposeOp(f: VrFacadeOpt): boolean {
  const op = String(f.boolean_op || "").toLowerCase();
  return op === "compose" || op === "difference";
}

/**
 * 1× buitencontour van een opening (kozijn). Bij compose-bron: som van +constituenten.
 * Nodig omdat gevel geometrisch maar 1 gat heeft terwijl de opening ×N telt in GA.
 */
function facadeOpeningOuterArea1x(sourceId: string, fallbackArea: number | null): number {
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
  // Bron zelf (na ×N in eligible): deel door repeat_count voor 1×.
  if (src?.area_m2 != null && Number.isFinite(Number(src.area_m2))) {
    const rpt = Math.max(1, Number(src.repeat_count) || 1);
    return Number(src.area_m2) / rpt;
  }
  return fallbackArea != null && Number.isFinite(Number(fallbackArea)) ? Number(fallbackArea) : 0;
}

/**
 * Effectieve GA-oppervlakte: bij (gevel − kozijn) met kozijn×N ontbreken (N−1) gaten in de geometrie.
 * Trek die extra gaten af van het gevel-compose-resultaat zodat muur+hout+glas ≈ gevelcontour.
 */
function effectiveFacadeAreaM2(f: VrFacadeOpt): number {
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
    // Alleen extra gaten als de bron vaker telt dan deze compose (gevel×1 vs kozijn×4).
    const extra = Math.max(0, srcRpt - parentRpt);
    if (extra <= 0) continue;
    const hole1 = facadeOpeningOuterArea1x(sid, part.area_m2);
    if (hole1 > 0) area -= extra * hole1;
  }
  return Math.round(area * 100) / 100;
}

/**
 * Opening assemblies (kozijn±glas) that still sit inside a gross wall contour:
 * wall was never composed as (gevel − kozijn), so summing wall+openings double-counts.
 * Always evaluate within one oriëntatie (pass `ori`, or ready-set already filtered).
 */
function facadeUncutOpeningIds(ori?: string | null): Set<string> {
  const ready = facadeReadyAreaFacades(ori);
  const composes = ready.filter(facadeIsComposeOp);
  const constituentIds = new Set<string>();
  for (const c of composes) {
    for (const part of c.constituents || []) {
      const id = String(part.id || "").trim();
      if (id) constituentIds.add(id);
    }
  }
  // Host = simple wall/contour still eligible (not itself a compose, not a glass pane inside one).
  const hosts = ready.filter((f) => !facadeIsComposeOp(f) && !constituentIds.has(f.id));
  if (!hosts.length) return new Set();

  const uncut = new Set<string>();
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

function facadeOpeningsUncutFromWall(ori?: string | null): boolean {
  const want = normalizeOrientatie(ori);
  const oris = want ? [want] : facadeOrisWithArea();
  for (const o of oris) {
    const uncut = facadeUncutOpeningIds(o);
    if (!uncut.size) continue;
    if (facadeReadyAreaFacades(o).some((f) => uncut.has(f.id))) return true;
  }
  return false;
}

/**
 * Stotaal = bruto gevelcontour van één oriëntatie (nooit som over de hele VR).
 * Als kozijn/glas nog niet uit de muur is gesneden, tellen die openingen niet mee in Stotaal
 * (anders wall + hout + glas ≈ contour + openingen).
 */
function facadeStotaalM2(ori?: string | null): number {
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

/** Som deeloppervlakten van area-vlakken; optioneel beperkt tot één oriëntatie. */
function vlakkenDeeloppervlakM2(ori?: string | null): number {
  const want = normalizeOrientatie(ori);
  let sum = 0;
  for (const v of vlakken) {
    if (want && normalizeOrientatie(v.orientatie) !== want) continue;
    const live = liveVlakQty(v);
    if (live.kind !== "area") continue;
    if (Number.isFinite(live.qty) && live.qty > 0) sum += live.qty;
  }
  return Math.round(sum * 100) / 100;
}

/**
 * true als som deeloppervlakten == Stotaal (per ori) én openingen gesneden.
 * Zonder `ori`: alle façade-ori's van de VR moeten elk 100% zijn (voor herberekenen).
 */
function vlakkenMatchFacadeStotaal(ori?: string | null): boolean {
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

/** Herberekenen alleen als elke façade-ori 100% Stotaal dekt (geen VR-brede som). */
function syncRecalcEnabled(): void {
  if (!recalcBtn) return;
  const ok =
    Boolean(selectedVrId) &&
    vlakken.length > 0 &&
    vlakkenMatchFacadeStotaal();
  recalcBtn.disabled = !ok;
  const incompleteOri = facadeOrisWithArea().find((o) => !vlakkenMatchFacadeStotaal(o));
  recalcBtn.title = ok
    ? "Herbereken GA / GA;k voor deze VR"
    : !selectedVrId
      ? "Selecteer eerst een VR"
      : !vlakken.length
        ? "Voeg eerst vlakken toe"
        : incompleteOri && facadeOpeningsUncutFromWall(incompleteOri)
          ? `Eerst openingen uit de gevelcontour snijden op ori ${incompleteOri} (± op de geveltekening)`
          : incompleteOri
            ? `Eerst alle materialen toekennen tot 100% Stotaal voor ori ${incompleteOri}`
            : "Eerst alle materialen toekennen tot 100% Stotaal per oriëntatie";
}

async function refreshVrCalc(opts?: {
  useFormCorrections?: boolean;
  persist?: boolean;
  /** Explicit Herberekenen / analyse: toon VR-resultaten ook zonder open vlak. */
  reveal?: boolean;
}): Promise<void> {
  const epoch = ++calcRevealEpoch;
  const vr = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
  const variant = variants.find((v) => v.variant_id === selectedVariantId);
  if (!auth() || !vr) {
    clearVrResults("Selecteer een VR en voeg vlakken met materiaal toe.", { keepStored: false });
    return;
  }
  if (!vlakken.length) {
    await clearPersistedVrCalc("");
    return;
  }

  // Deeloppervlakten moeten Stotaal van het gevelvlak dekken — anders geen berekening, geen melding.
  if (!vlakkenMatchFacadeStotaal()) {
    await clearPersistedVrCalc("");
    return;
  }

  const calcVlakken = vlakken.map((v) => {
    // findFacadeForVlak: kier (`uuid#seal`) vs area (`uuid`) — niet alleen id-map.
    const fac = findFacadeForVlak(v) || undefined;
    const live = liveVlakQty(v);
    const kind = live.kind;
    const qty = live.qty;
    const editingThis = Boolean(selectedVlakId && v.vlak_id === selectedVlakId);
    const oriCode = normalizeOrientatie(v.orientatie);
    const room = roomFromVr(vr);
    const oriCorr =
      oriCode && room?.orientatie_correcties?.[oriCode]
        ? room.orientatie_correcties[oriCode]
        : null;
    return {
      label: v.omschrijving,
      ra_dba: fac?.ra_dba != null ? Number(fac.ra_dba) : NaN,
      quantity_kind: kind,
      area_m2: kind === "area" ? qty : null,
      length_m: kind === "length" ? qty : null,
      // While editing, form checkbox drives Stot / GA;k immediately.
      meenemen_gak: editingThis ? vlakGakEl.checked : v.meenemen_gak !== false,
      cl_db: oriCorr ? Number(oriCorr.cl_db) || 0 : Number(v.cl_db) || 0,
      cg_db: oriCorr ? Number(oriCorr.cg_db) || 0 : Number(v.cg_db) || 0,
    };
  });

  const missingRa = calcVlakken.filter((v) => !Number.isFinite(v.ra_dba));
  if (missingRa.length) {
    clearVrResults(
      `Geen RA voor: ${missingRa.map((v) => v.label).join(", ")} — materiaal ontbreekt of catalogus-id is verouderd. Koppel materiaal opnieuw op de geveltekening, daarna Herberekenen GA / GA;k.`,
      { keepStored: false },
    );
    return;
  }

  // useFormCorrections: live Stot-checkbox bij open vlak (CL/Cg al uit plattegrond-ori hierboven).
  const useForm = Boolean(opts?.useFormCorrections);

  const metrics = effectiveVrMetrics(vr);
  const result = computeVrGa({
    volume_m3: metrics.volume,
    t0_s: Number(vr.t0_s) || 0.5,
    geluidsbelasting_dba: Number(variant?.geluidsbelasting_dba ?? 0),
    vlakken: calcVlakken,
    gebruiksfunctie: variant?.gebruiksfunctie,
  });

  if (!result.ok) {
    clearVrResults(result.reason || "Berekening niet mogelijk.", { keepStored: false });
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
        auth()!.token,
        vr.verblijfsruimte_id,
        result.ga_dba != null ? String(round1(result.ga_dba)) : "",
        result.lbi_dba != null ? String(round1(result.lbi_dba)) : "",
        result.gak_dba != null ? String(round1(result.gak_dba)) : "",
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

  // Na awaits: ori-wissel of nieuwere calc mag deze paint niet meer doorzetten.
  if (epoch !== calcRevealEpoch) return;
  if (!resultsRevealAllowed(opts)) {
    const focusOri = normalizeOrientatie(vlakOrientatieEl?.value);
    const oriEmpty = Boolean(focusOri) && vlakkenForOrientatie(focusOri).length === 0;
    clearVrResults(
      oriEmpty && focusOri
        ? `Oriëntatie ${ORIENTATIE_LABELS[focusOri] || focusOri}: nog geen materialen — berekening wordt niet getoond tot je hier vlakken toevoegt.`
        : "Open een vlak in de lijst om de berekening te tonen, of voeg een nieuw vlak toe voor een vrije oriëntatie.",
      { keepStored: false },
    );
    return;
  }

  const statusBit = useForm
    ? " · (live Stot — niet opgeslagen)"
    : resultsDirty
      ? " · niet opgeslagen"
      : shouldPersist
        ? " · opgeslagen"
        : " · berekend";
  if (vrResultsHintEl) {
    const req =
      result.gak_required_dba != null ? ` · GA;k ≥ ${fmtRes(result.gak_required_dba)} dB (Lb−${grens})` : "";
    vrResultsHintEl.textContent = `Cr=${result.cr_db} dB · Ruimte=${fmtRes(result.ruimte_db)} dB · CL/Cg → GA;k (${round1(result.cl_db)} / ${round1(result.cg_db)} dB) · grens Lbi;k ≤ ${grens} dB${req}${statusBit}`;
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
      resToetsEl.textContent = "—";
    }
  }

  syncAnalyzeUi(result.voldoet === false);
}

/** After Lb/functie change: refresh stored Lbi from existing GA for all VRs in the variant. */
async function resyncStoredLbiForVariant(variantId: string): Promise<void> {
  if (!auth() || !variantId) return;
  const variant = variants.find((v) => v.variant_id === variantId);
  const Lb = Number(variant?.geluidsbelasting_dba ?? 0);
  if (!Number.isFinite(Lb)) return;
  const vgRet = await invokeString("API_ListVerblijfsgebieden", [auth()!.token, variantId]);
  const vgData = parseJsonOk<{ verblijfsgebieden: Vg[] }>(vgRet);
  for (const g of vgData.verblijfsgebieden || []) {
    const vrRet = await invokeString("API_ListVerblijfsruimten", [auth()!.token, g.verblijfsgebied_id]);
    const vrData = parseJsonOk<{ verblijfsruimten: Vr[] }>(vrRet);
    for (const vr of vrData.verblijfsruimten || []) {
      if (vr.ga_dba == null || !Number.isFinite(Number(vr.ga_dba))) continue;
      const ga = Number(vr.ga_dba);
      const gak = vr.gak_dba != null && Number.isFinite(Number(vr.gak_dba)) ? Number(vr.gak_dba) : null;
      const lbi = round1(Lb - ga);
      try {
        await invokeString("API_SaveVerblijfsruimteResults", [
          auth()!.token,
          vr.verblijfsruimte_id,
          String(round1(ga)),
          String(lbi),
          gak != null ? String(round1(gak)) : "",
        ]);
      } catch {
        /* continue */
      }
    }
  }
}

function applyVlakFormDefaultsFromExisting(keepOri?: string | null): void {
  if (selectedVlakId) return;
  syncOrientatieSelectOptions();
  const expected = expectedOrientatiesForSelectedVr();
  const missing = missingOrientationsForSelectedVr();
  const current = normalizeOrientatie(keepOri || vlakOrientatieEl?.value);
  const code =
    (current && expected.includes(current) ? current : "") ||
    missing[0] ||
    expected[0] ||
    "";
  if (vlakOrientatieEl) vlakOrientatieEl.value = code;
  applyClCgFromOrientatie(code);
  vlakGakEl.checked = true;
  fillFacadeSelect();
  syncVlakMaterialGate();
  updateVlakOriCompletenessHint();
  syncOrientatieDisplay();
}

function clearVlakEdit(keepOri?: string | null): void {
  selectedVlakId = null;
  vlakNameEl.value = "";
  applyVlakFormDefaultsFromExisting(keepOri);
  if (vlakSaveBtn) vlakSaveBtn.textContent = "Vlak toevoegen";
  vlakCancelBtn?.classList.add("hidden");
  if (vlakEditHintEl) {
    const code = normalizeOrientatie(keepOri || vlakOrientatieEl?.value);
    vlakEditHintEl.textContent = code
      ? `Oriëntatie ${ORIENTATIE_LABELS[code] || code} blijft geselecteerd — kies het volgende materiaal of een andere oriëntatie.`
      : "Kies een oriëntatie in de listbox, of open een vlak in «Toegevoegde vlakken» om te bewerken.";
  }
  renderVlakken();
  syncVlakMaterialGate();
  blankResultsUntilVlakSelected();
}

function fillVlakEdit(v: Vlak): void {
  selectedVlakId = v.vlak_id;
  syncOrientatieSelectOptions();
  vlakNameEl.value = v.omschrijving || "";
  const ori = normalizeOrientatie(v.orientatie);
  if (vlakOrientatieEl) {
    if (ori) ensureOrientatieOption(ori);
    vlakOrientatieEl.value = ori;
  }
  // CL/Cg vast per ori (plattegrond); fallback op opgeslagen vlakwaarden.
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
}

function renderVlakken(): void {
  vlakListEl.innerHTML = "";
  updateVlakInventory();
  syncVlakPickDropdown();
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
    li.textContent = "Kies eerst een geveloriëntatie hierboven.";
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
  const dominantId = dominantAreaVlakId(focusVlakken);

  const appendVlakRow = (host: HTMLElement, v: Vlak) => {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (v.vlak_id === selectedVlakId) li.classList.add("selected");
    const info = document.createElement("button");
    info.type = "button";
    info.className = "drawing-list-select";
    const live = liveVlakQty(v);
    const qtyTxt =
      live.kind === "length"
        ? `l=${live.qty.toFixed(2)} m`
        : `S=${live.qty.toFixed(2)} m²`;
    const mat = vlakMaterialLabel(v);
    const oriCorr = correctionsForOrientatie(v.orientatie);
    const vrRow = vrs.find((r) => r.verblijfsruimte_id === selectedVrId);
    const room = vrRow ? roomFromVr(vrRow) : null;
    const oriCode = normalizeOrientatie(v.orientatie);
    const hasOriMap = Boolean(oriCode && room?.orientatie_correcties?.[oriCode]);
    const clShow = hasOriMap ? Number(oriCorr.cl) || 0 : Number(v.cl_db) || 0;
    const cgShow = hasOriMap ? Number(oriCorr.cg) || 0 : Number(v.cg_db) || 0;
    const corrTxt = `CL=${round1(clShow)} · Cg=${round1(cgShow)}`;
    const domBit = v.vlak_id === dominantId ? " · CL/Cg → GA;k" : "";
    info.textContent = `${mat} · ${qtyTxt} · ${corrTxt} · Stot=${v.meenemen_gak ? "ja" : "nee"}${domBit}`;
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
        const ret = await invokeString("API_DeleteVlak", [auth()!.token, v.vlak_id]);
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
  title.textContent = `${focusOri} · ${ORIENTATIE_LABELS[focusOri] || focusOri} · ${focusVlakken.length} vlak${focusVlakken.length === 1 ? "" : "ken"}`;
  wrap.appendChild(title);
  const inner = document.createElement("ul");
  inner.className = "drawing-list";
  for (const v of focusVlakken) appendVlakRow(inner, v);
  wrap.appendChild(inner);
  vlakListEl.appendChild(wrap);
}

/** Largest area vlak supplies CL/Cg for GA;k only (not R′/D2m/GA). */
function dominantAreaVlakId(list: Vlak[]): string | null {
  let bestId: string | null = null;
  let best = -1;
  for (const v of list) {
    const live = liveVlakQty(v);
    if (live.kind !== "area") continue;
    if (live.qty > best) {
      best = live.qty;
      bestId = v.vlak_id;
    }
  }
  return bestId;
}

async function refreshBuildingMeta(): Promise<void> {
  if (!auth() || !buildingId) {
    buildingLabel = "";
    buildingExternalRef = "";
    return;
  }
  try {
    const ret = await invokeString("API_EngineerGetProject", [auth()!.token, buildingId]);
    if (ret.startsWith("ERROR")) return;
    const data = parseJsonOk<{
      label?: string;
      external_ref?: string;
      building?: { label?: string; external_ref?: string };
    }>(ret);
    buildingLabel = data.label || data.building?.label || "";
    buildingExternalRef = data.external_ref || data.building?.external_ref || "";
  } catch {
    /* keep previous */
  }
}

function setBuildingMetaText(text: string): void {
  buildingMetaEl.textContent = text;
  if (buildingMetaSummaryEl) {
    const compact = text === "—" ? "" : text;
    buildingMetaSummaryEl.textContent = compact ? `· ${compact}` : "";
  }
  syncResultsWerknummer();
}

function syncResultsWerknummer(): void {
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

function buildingMetaLine(): string {
  const title = buildingLabel || buildingExternalRef || (buildingId ? `${buildingId.slice(0, 8)}…` : "—");
  const wn = (buildingExternalRef || "").trim();
  const wnBit = wn && buildingLabel && wn !== buildingLabel ? ` · werknummer ${wn}` : "";
  return `${title}${wnBit} · ${freeRooms.length} vrije rooms`;
}

async function openBuilding(id: string): Promise<void> {
  buildingId = id.trim();
  buildingIdEl.value = buildingId;
  syncFloormapLink();
  if (!buildingId) {
    modelPanelEl.classList.add("hidden");
    setBuildingMetaText("—");
    buildingLabel = "";
    buildingExternalRef = "";
    syncResultsWerknummer();
    return;
  }
  setConn("busy", "Laden…");
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

/** Checkpoint: recompute + persist GA/Lbi/GA;k for every VR in the active variant. */
async function saveProjectCheckpoint(): Promise<void> {
  if (!auth() || !buildingId) throw new Error("Log in en selecteer een project");
  if (!selectedVariantId) throw new Error("Geen actieve variant");
  const keepVg = selectedVgId;
  const keepVr = selectedVrId;
  setConn("busy", "Project opslaan…");
  let saved = 0;
  let skipped = 0;
  let failed = 0;
  try {
    const vgRet = await invokeString("API_ListVerblijfsgebieden", [auth()!.token, selectedVariantId]);
    const vgData = parseJsonOk<{ verblijfsgebieden: Vg[] }>(vgRet);
    const allVgs = vgData.verblijfsgebieden || [];
    for (const g of allVgs) {
      selectedVgId = g.verblijfsgebied_id;
      const vrRet = await invokeString("API_ListVerblijfsruimten", [auth()!.token, g.verblijfsgebied_id]);
      const vrData = parseJsonOk<{ verblijfsruimten: Vr[] }>(vrRet);
      const list = vrData.verblijfsruimten || [];
      for (const vr of list) {
        selectedVrId = vr.verblijfsruimte_id;
        vrs = list;
        try {
          await loadVlakken();
          const cur = vrs.find((r) => r.verblijfsruimte_id === vr.verblijfsruimte_id);
          if (cur && vrHasStoredResults(cur) && !resultsDirty) saved += 1;
          else if (cur && vrHasStoredResults(cur)) saved += 1;
          else skipped += 1;
        } catch {
          failed += 1;
        }
      }
    }
    resultsDirty = false;
    if (keepVg) {
      selectedVgId = keepVg;
      await loadVgs(keepVg);
      if (keepVr) await loadVrs(keepVr);
    } else {
      await loadVgs();
    }
    const msg = `Project opgeslagen · ${saved} VR-resultaten${skipped ? ` · ${skipped} zonder berekening` : ""}${
      failed ? ` · ${failed} mislukt` : ""
    }`;
    setConn(failed ? "err" : "ok", msg);
  } catch (err) {
    setConn("err", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function ensureDefaultVariant(): Promise<string> {
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
    auth()!.token,
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
  if (!subId || !auth() || !buildingId) return;

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
      auth()!.token,
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
      auth()!.token,
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
  if (!auth()) return;
  const ret = await invokeString("API_EngineerListReviewQueue", [auth()!.token]);
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

loginForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(loginForm);
  void session.bootstrapAndLogin(
    String(fd.get("username") || ""),
    String(fd.get("password") || ""),
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
  // Prefer remembered preference; openBuilding will collapse after a successful open.
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
    if (!auth() || !selectedVariantId) throw new Error("Selecteer eerst een variant om te kopiëren");
    const src = variants.find((v) => v.variant_id === selectedVariantId);
    const name = `${src?.omschrijving || "Variant"} (kopie)`;
    const ret = await invokeString("API_CloneVariant", [auth()!.token, selectedVariantId, name]);
    const data = parseJsonOk<{
      variant_id: string;
      vg_count: number;
      vr_count: number;
      vlak_count: number;
    }>(ret);
    selectedVariantId = data.variant_id;
    compareSelectedIds.add(data.variant_id);
    if (src) compareSelectedIds.add(src.variant_id);
    await refreshLinks();
    await loadVariants();
    setConn(
      "ok",
      `Variant gekopieerd · ${data.vg_count} VG · ${data.vr_count} VR · ${data.vlak_count} vlakken`,
    );
  })().catch((e) => setConn("err", String(e)));
});

compareBtn?.addEventListener("click", () => {
  void runVariantCompare()
    .then(() => setConn("ok", "Variantvergelijking bijgewerkt"))
    .catch((e) => setConn("err", String(e)));
});

variantForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!auth() || !buildingId) return;
    const ret = await invokeString("API_SaveVariant", [
      auth()!.token,
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
    const ret = await invokeString("API_DeleteVariant", [auth()!.token, selectedVariantId]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    selectedVariantId = null;
    await loadVariants();
    await refreshLinks();
    await loadGeometryOptions();
  })().catch((e) => setConn("err", String(e)));
});

async function createVgFromSelectedRoom(): Promise<void> {
  if (!auth()) throw new Error("Niet ingelogd");
  const variantId = await ensureDefaultVariant();
  const room = selectedFreeRoom();
  if (!room) throw new Error("Kies een vrije plattegrondruimte");
  const { vgName, vrName } = labelsFromRoom(room);
  const ret = await invokeString("API_CreateVerblijfsgebied", [
    auth()!.token,
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
  const ret = await invokeString("API_AddVerblijfsruimte", [
    auth()!.token,
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
    if (!auth() || !selectedVrId) return;
    syncVrVolumeFromInputs();
    const ret = await invokeString("API_SaveVerblijfsruimte", [
      auth()!.token,
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
    if (!auth() || !selectedVrId) return;
    const ret = await invokeString("API_DeleteVerblijfsruimte", [auth()!.token, selectedVrId]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    await refreshLinks();
    await loadGeometryOptions();
    await loadVgs();
  })().catch((e) => setConn("err", String(e)));
});

vgDelBtn.addEventListener("click", () => {
  void (async () => {
    if (!auth() || !selectedVgId) return;
    if (!confirm("Verblijfsgebied en alle VR’s verwijderen?")) return;
    const ret = await invokeString("API_DeleteVerblijfsgebied", [auth()!.token, selectedVgId]);
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
    // Oriëntatie: listbox (plattegrond). Niet terugspringen naar de eerste vrije ori.
    let oriVal = "";
    if (editingId) {
      oriVal = normalizeOrientatie(vlakOrientatieEl?.value) ||
        normalizeOrientatie(vlakken.find((v) => v.vlak_id === editingId)?.orientatie);
    } else {
      oriVal = normalizeOrientatie(vlakOrientatieEl?.value);
      if (!oriVal) {
        throw new Error("Kies eerst een geveloriëntatie in de listbox");
      }
    }
    const expectedOris = expectedOrientatiesForSelectedVr();
    if (!expectedOris.length) {
      throw new Error(
        "Geen geveloriëntaties op de plattegrond — vink die eerst aan bij Opgeslagen ruimten",
      );
    }
    if (!expectedOris.includes(normalizeOrientatie(oriVal))) {
      throw new Error(
        `Oriëntatie ${normalizeOrientatie(oriVal)} staat niet in de plattegrond-definitie (${expectedOris.join(", ")})`,
      );
    }
    const matKeyForGuard = (() => {
      if (fac) {
        const optKey = (opt?.dataset.materialKey || "").trim();
        if (optKey) return optKey;
        return materialGroupKey(vrFacades.find((f) => f.id === fac) || ({} as VrFacadeOpt));
      }
      if (editingId) {
        const cur = vlakken.find((v) => v.vlak_id === editingId);
        const facId = cur?.facade_subsection_id;
        if (!facId) return null;
        const curV = vlakken.find((x) => x.vlak_id === editingId);
        const facOpt = curV ? findFacadeForVlak(curV) : null;
        return materialGroupKey(facOpt || ({} as VrFacadeOpt));
      }
      return null;
    })();
    if (!editingId) {
      const hasMat = Boolean((opt?.dataset.materialId || "").trim());
      if (!hasMat) {
        throw new Error(
          "Deze component heeft nog geen materiaal — koppel het op de geveltekening, daarna hier als vlak toevoegen",
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
          "Geen vrije gevelcomponent meer voor dit materiaal — teken een extra component of kies een ander materiaal",
        );
      }
    }
    if (matKeyForGuard) {
      const taken = materialOrientatieTaken(matKeyForGuard, oriVal, editingId);
      if (taken) {
        const oriLabel = normalizeOrientatie(oriVal) || "(geen)";
        throw new Error(
          `Dit materiaal heeft al een vlak met oriëntatie ${oriLabel} (“${taken.omschrijving}”). Kies een andere oriëntatie.`,
        );
      }
      if (orisUsedForMaterial(matKeyForGuard, editingId).length && !normalizeOrientatie(oriVal)) {
        throw new Error(
          "Dit materiaal is al als vlak gebruikt — voeg het toe voor een andere (vrije) plattegrond-oriëntatie",
        );
      }
    }
    const isLen =
      (opt?.dataset.quantityKind || vlakAreaEl.dataset.quantityKind) === "length";
    const qty = vlakAreaEl.value || "0";
    const pickFac = fac ? vrFacades.find((f) => f.id === fac) : undefined;
    const facadeId = pickFac ? facadeSourceId(pickFac) : fac || "";
    const oriCorr = correctionsForOrientatie(oriVal);
    applyClCgFromOrientatie(oriVal);
    const clVal = oriCorr.cl;
    const cgVal = oriCorr.cg;
    const ret = await invokeString("API_SaveVlak", [
      auth()!.token,
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
    ]);
    if (ret.startsWith("ERROR")) throw new Error(ret);

    const wasEdit = Boolean(editingId);
    await loadVlakken();
    clearVlakEdit(oriVal);
    // Persist VR-resultaten, maar toon ze pas als een vlak/oriëntatie is gekozen.
    await refreshVrCalc({ persist: true });
    if (!selectedVlakId) {
      blankResultsUntilVlakSelected(
        "Vlak opgeslagen. Open een vlak in de lijst om de berekening te tonen.",
      );
    }
    setConn(
      "ok",
      wasEdit
        ? `Vlak bijgewerkt (CL/Cg → GA;k)`
        : `Vlak toegevoegd · oriëntatie ${normalizeOrientatie(oriVal)} (uit plattegrond)`,
    );
  })().catch((e) => setConn("err", String(e)));
});

vlakCancelBtn?.addEventListener("click", () => {
  clearVlakEdit();
  setConn("ok", "Bewerken geannuleerd");
});

// Ori-listbox: clicks worden in syncVlakPickDropdown gebonden.

// CL/Cg zijn read-only (vast per plattegrond-oriëntatie) — geen live input-handlers.
vlakFacadeEl.addEventListener("change", () => {
  onFacadePick();
  syncVlakMaterialGate();
});
vlakGakEl.addEventListener("change", () => {
  if (!selectedVlakId) return;
  // Live Stot / GA;k while editing; persist via Opslaan or Herberekenen.
  void refreshVrCalc({ useFormCorrections: true, persist: false });
  resultsDirty = true;
  setConn("ok", vlakGakEl.checked ? "Meenemen in GA;k — nog opslaan" : "Niet in Stot/GA;k — nog opslaan");
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
        badOri && facadeOpeningsUncutFromWall(badOri)
          ? `Herberekenen niet mogelijk: snijd eerst openingen uit de gevelcontour op ori ${badOri} (± op de geveltekening)`
          : badOri
            ? `Herberekenen niet mogelijk: ori ${badOri} is nog geen 100% Stotaal`
            : "Herberekenen niet mogelijk: oppervlaktedekking is nog geen 100% Stotaal per oriëntatie",
      );
      syncRecalcEnabled();
      return;
    }
    // Persist form vlak-props only for the vlak being edited (CL/Cg uit plattegrond-ori).
    if (selectedVlakId) {
      assertVlakPropsOrThrow();
      const v = vlakken.find((x) => x.vlak_id === selectedVlakId);
      if (v) {
        const live = liveVlakQty(v);
        const oriVal = vlakOrientatieEl?.value || v.orientatie || "";
        const oriCorr = correctionsForOrientatie(oriVal);
        applyClCgFromOrientatie(oriVal);
        const syncRet = await invokeString("API_SaveVlak", [
          auth()!.token,
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
        ]);
        if (syncRet.startsWith("ERROR")) throw new Error(syncRet);
        await loadVlakken();
        clearVlakEdit();
      }
    }
    // Expliciet Herberekenen: resultaten tonen (ook zonder open vlak).
    await refreshVrCalc({ persist: true, reveal: true });
    setConn("ok", "GA / GA;k herberekend (CL/Cg per oriëntatie → GA;k)");
  })().catch((e) => setConn("err", String(e)));
});

function setAnalyzeEnabled(on: boolean): void {
  if (analyzeBtn) analyzeBtn.disabled = !on;
}

function hideAnalyzePanel(): void {
  analyzePanelEl?.classList.add("hidden");
  if (analyzeCausesEl) analyzeCausesEl.innerHTML = "";
  if (analyzeSuggestionsEl) analyzeSuggestionsEl.innerHTML = "";
  if (analyzeHintEl) analyzeHintEl.textContent = "";
}

function syncAnalyzeUi(fail: boolean): void {
  setAnalyzeEnabled(fail);
  if (!fail) hideAnalyzePanel();
}

type AnalyzeAlt = {
  material_id: string;
  catalog_id: string | null;
  name: string;
  ra_dba: number;
  delta_ra: number;
  thickness_mm: number | null;
};

/** Unique façade materials used in current vlakken, weakest first (lowest RAs). */
function materialsForAnalyze(result: GaVrResult): Array<{
  facadeId: string;
  materialId: string;
  materialName: string;
  catalogId: string | null;
  ra_dba: number;
  ras: number | null;
  elementIndex: number;
  label: string;
  area_m2: number;
}> {
  const byMat = new Map<
    string,
    {
      facadeId: string;
      materialId: string;
      materialName: string;
      catalogId: string | null;
      ra_dba: number;
      ras: number | null;
      elementIndex: number;
      label: string;
      area_m2: number;
    }
  >();
  // Mirror computeVrGa: only vlakken with geldige qty + RA zitten in result.elements (zelfde volgorde).
  let elIdx = 0;
  for (const v of vlakken) {
    const fac = findFacadeForVlak(v) || undefined;
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
    if (!prev || (ras != null && (prev.ras == null || ras < prev.ras))) {
      byMat.set(mid, {
        facadeId: v.facade_subsection_id,
        materialId: mid,
        materialName: fac?.material_name || v.omschrijving || "Materiaal",
        catalogId: fac?.catalog_id || null,
        ra_dba: ra,
        ras,
        elementIndex,
        label: v.omschrijving || fac?.label || "Vlak",
        area_m2: el?.area_for_s ?? (live.kind === "area" ? live.qty : 0),
      });
    }
  }
  return [...byMat.values()].sort((a, b) => {
    const ar = a.ras ?? Infinity;
    const br = b.ras ?? Infinity;
    return ar - br;
  });
}

async function runAnalyze(): Promise<void> {
  if (!auth()) return;
  if (!lastFreshGaResult || lastFreshGaResult.voldoet !== false) {
    await refreshVrCalc({ persist: false, reveal: true });
  }
  const result = lastFreshGaResult;
  if (!result || result.voldoet !== false) {
    setConn("ok", "Toets voldoet — Analyseer niet nodig");
    hideAnalyzePanel();
    setAnalyzeEnabled(false);
    return;
  }
  if (!analyzePanelEl || !analyzeCausesEl || !analyzeSuggestionsEl) return;

  const lbik = result.lbik_dba;
  const grens = result.grenswaarde_lbik_db;
  const deficit =
    lbik != null && Number.isFinite(lbik) ? Math.max(0, round1(lbik - grens)) : 0;
  const gak = result.gak_dba;
  const gakReq = result.gak_required_dba;

  const causes: string[] = [];
  if (deficit > 0) {
    causes.push(
      `Lbi;k = ${fmtRes(lbik)} dB overschrijdt de grens van ${fmtRes(grens)} dB met ${fmtRes(deficit)} dB.`,
    );
  } else {
    causes.push(`Lbi;k voldoet niet aan de grens van ${fmtRes(grens)} dB.`);
  }
  if (gak != null && gakReq != null && gak < gakReq) {
    causes.push(
      `GA;k = ${fmtRes(gak)} dB is lager dan vereist (${fmtRes(gakReq)} dB = Lb − grens).`,
    );
  }
  if (result.cl_db === 0 && result.cg_db === 0) {
    causes.push("CL en Cg zijn 0 dB — controleer of oriëntatiecorrecties op de plattegrond zijn gezet.");
  }

  const mats = materialsForAnalyze(result);
  if (!mats.length) {
    causes.push("Geen gekoppelde materialen gevonden op de vlakken — koppel materialen op de geveltekening.");
  } else {
    const weakest = mats.slice(0, 3);
    for (const m of weakest) {
      const rasTxt = m.ras != null ? `RAs ≈ ${fmtRes(m.ras)} dB` : "RAs onbekend";
      causes.push(
        `Zwak element: «${m.label}» (${m.materialName}, RA ${fmtRes(m.ra_dba)} dB, ${rasTxt}).`,
      );
    }
  }

  analyzeCausesEl.innerHTML = causes.map((c) => `<li>${esc(c)}</li>`).join("");
  if (analyzeHintEl) {
    analyzeHintEl.textContent =
      deficit > 0
        ? `Suggesties: equivalente materialen met hogere RA (zelfde rubriek). Richtwaarde ≈ +${fmtRes(deficit)} dB op R′/GA;k.`
        : "Suggesties: equivalente materialen met hogere RA (zelfde rubriek).";
  }
  analyzeSuggestionsEl.innerHTML = `<p class="hint">Alternatieven laden…</p>`;
  analyzePanelEl.classList.remove("hidden");

  const blocks: string[] = [];
  for (const m of mats) {
    const need =
      deficit > 0 ? minRaDeltaForRprime(result.elements, m.elementIndex, deficit) : 0;
    let alts: AnalyzeAlt[] = [];
    try {
      const data = bppPhase1Enabled()
        ? await bppListMaterialAlternatives(invokeString, auth()!.token, m.materialId, 8)
        : await apiGet<{
            alternatives?: AnalyzeAlt[];
            reason?: string;
          }>(
            `/api/floormap/material-alternatives?material_id=${encodeURIComponent(m.materialId)}&limit=8`,
          );
      alts = Array.isArray(data.alternatives)
        ? data.alternatives.map((alt) => ({
            material_id: alt.material_id,
            catalog_id: alt.catalog_id ?? null,
            name: alt.name ?? "",
            ra_dba: alt.ra_dba ?? 0,
            delta_ra: alt.delta_ra,
            thickness_mm: alt.thickness_mm ?? null,
          }))
        : [];
    } catch (err) {
      blocks.push(
        `<div class="ga-analyze-mat"><p class="ga-analyze-mat-title">${esc(m.materialName)}</p>` +
          `<p class="hint">Alternatieven ophalen mislukt: ${esc(err instanceof Error ? err.message : String(err))}</p></div>`,
      );
      continue;
    }

    // Prefer alts that alone could close the gap; still show others with higher RA.
    const ranked = [...alts].sort((a, b) => {
      const aOk = need != null && need > 0 ? a.delta_ra >= need : true;
      const bOk = need != null && need > 0 ? b.delta_ra >= need : true;
      if (aOk !== bOk) return aOk ? -1 : 1;
      return a.delta_ra - b.delta_ra;
    });

    const needTxt =
      need == null
        ? "Dit vlak alleen kan de norm niet redden — combineer met andere materialen."
        : need > 0
          ? `Voor dit vlak is circa +${fmtRes(need)} dB RA nodig om de overschrijding te dichten.`
          : "";

    const facadesWithMat = vrFacades
      .filter((f) => (f.material_id || "") === m.materialId)
      .map((f) => f.id);
    // Alle componenten met dit materiaal (niet alleen één vlak) — anders breekt
    // liveVlakQty-groepering en valt deeloppervlak ≠ Stotaal.
    const targetIds = facadesWithMat.length
      ? facadesWithMat
      : [
          ...new Set(
            vlakken
              .map((v) => v.facade_subsection_id)
              .filter(
                (id): id is string =>
                  typeof id === "string" && id.length > 0 && facadeByMaterial(id, m.materialId),
              ),
          ),
        ];

    let altHtml: string;
    if (!ranked.length) {
      altHtml = `<p class="hint">Geen materialen met hogere RA in dezelfde rubriek.</p>`;
    } else {
      altHtml =
        `<ul class="ga-analyze-alt-list">` +
        ranked
          .map((a) => {
            const enough = need != null && need > 0 && a.delta_ra >= need;
            const th =
              a.thickness_mm != null && Number.isFinite(a.thickness_mm)
                ? `, ${fmtRes(a.thickness_mm)} mm`
                : "";
            const cat = a.catalog_id ? ` · ${a.catalog_id}` : "";
            const cls = enough ? " ga-analyze-alt-enough" : "";
            const mark = enough ? " · voldoende ΔRA" : "";
            return (
              `<li class="ga-analyze-alt-item${cls}">` +
              `<span>${esc(a.name)}${esc(cat)} — RA ${fmtRes(a.ra_dba)} dB (+${fmtRes(a.delta_ra)})${esc(th)}${esc(mark)}</span>` +
              `<button type="button" class="secondary ga-analyze-apply" ` +
              `data-material-id="${esc(a.material_id)}" ` +
              `data-from-material-id="${esc(m.materialId)}" ` +
              `data-subsection-ids="${esc(targetIds.join(","))}" ` +
              `data-name="${esc(a.name)}">Pas toe</button>` +
              `</li>`
            );
          })
          .join("") +
        `</ul>`;
    }

    blocks.push(
      `<div class="ga-analyze-mat">` +
        `<p class="ga-analyze-mat-title">${esc(m.materialName)} <span class="ga-analyze-mat-meta">(RA ${fmtRes(m.ra_dba)} dB · ${esc(m.label)})</span></p>` +
        (needTxt ? `<p class="ga-analyze-mat-meta">${esc(needTxt)}</p>` : "") +
        altHtml +
        `</div>`,
    );
  }

  analyzeSuggestionsEl.innerHTML = blocks.length
    ? blocks.join("")
    : `<p class="hint">Geen materiaalsuggesties beschikbaar.</p>`;
  setConn("ok", "Analyse klaar — kies eventueel Pas toe");
}

function facadeByMaterial(facadeId: string, materialId: string): boolean {
  const fac = vrFacades.find((f) => f.id === facadeId);
  return (fac?.material_id || "") === materialId;
}

async function applyAnalyzeMaterial(
  subsectionIds: string[],
  materialId: string,
  name: string,
  fromMaterialId?: string,
): Promise<void> {
  if (!auth() || !materialId) return;

  const oldMat = (fromMaterialId || "").trim();
  const targets = new Set<string>(subsectionIds.filter(Boolean));
  // Cruciaal: alle VR-gevelcomponenten met het oude materiaal meenemen.
  // Anders splitst de materiaal-groep, liveVlakQty krimpt, Stotaal-gate wist de berekening.
  if (oldMat) {
    for (const f of vrFacades) {
      if ((f.material_id || "") === oldMat) targets.add(f.id);
    }
  }
  if (!targets.size) {
    setConn("err", "Geen gevelcomponenten om materiaal op toe te passen");
    return;
  }

  setConn("busy", `Materiaal toepassen: ${name}…`);
  let appliedRa: number | null = null;
  let appliedCatalog: string | null = null;
  let appliedName = name;
  for (const sid of targets) {
    const ret = bppPhase1Enabled()
      ? await bppSaveSubsectionMaterial(invokeString, auth()!.token, sid, materialId)
      : await apiPost<{
          material?: {
            material_id?: string;
            catalog_id?: string | null;
            name?: string | null;
            ra_dba?: number | null;
          };
        }>("/api/floormap/subsection-material", {
          subsection_id: sid,
          material_id: materialId,
        });
    const mat = ret.material;
    if (mat) {
      if (mat.ra_dba != null && Number.isFinite(Number(mat.ra_dba))) appliedRa = Number(mat.ra_dba);
      if (mat.catalog_id != null) appliedCatalog = String(mat.catalog_id);
      if (mat.name) appliedName = String(mat.name);
    }
    // Optimistic local patch zodat herberekening niet op oude RA blijft hangen.
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

  // Direct nieuwe uitkomst tonen — ook zonder open vlak (geen blankResults).
  await refreshVrCalc({ persist: true, reveal: true });

  if (!lastFreshGaResult?.ok) {
    // Stotaal/RA nog niet rond? Nog één keer na verse façade-data.
    await loadFacadesForSelectedVr();
    await refreshVrCalc({ persist: true, reveal: true });
  }

  const ok = lastFreshGaResult?.voldoet === true;
  const fail = lastFreshGaResult?.voldoet === false;
  syncAnalyzeUi(fail);
  setConn(
    "ok",
    ok
      ? `«${appliedName}» toegepast op ${targets.size} component(en) — toets voldoet`
      : fail
        ? `«${appliedName}» toegepast op ${targets.size} component(en) — toets nog niet voldoende (Analyseer opnieuw mogelijk)`
        : `«${appliedName}» toegepast op ${targets.size} component(en) — herberekend`,
  );
}

analyzeBtn?.addEventListener("click", () => {
  void runAnalyze().catch((e) => setConn("err", String(e)));
});

analyzeSuggestionsEl?.addEventListener("click", (ev) => {
  const t = ev.target as HTMLElement | null;
  const btn = t?.closest?.("button.ga-analyze-apply") as HTMLButtonElement | null;
  if (!btn) return;
  const materialId = (btn.dataset.materialId || "").trim();
  const fromMaterialId = (btn.dataset.fromMaterialId || "").trim();
  const ids = (btn.dataset.subsectionIds || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const name = (btn.dataset.name || "materiaal").trim();
  void applyAnalyzeMaterial(ids, materialId, name, fromMaterialId).catch((e) =>
    setConn("err", String(e)),
  );
});

async function saveProjectReport(force = false): Promise<string | null> {
  if (!auth() || !buildingId) throw new Error("Log in en selecteer een gebouw");
  if (!selectedVariantId) throw new Error("Selecteer eerst een variant");
  const status = reportKindEl?.value === "definitief" ? "definitief" : "concept";
  if (reportHintEl) reportHintEl.textContent = "Rapport wordt gegenereerd…";
  const res = await fetch("/api/reports/generate", {
    method: "POST",
    credentials: "include",
    headers: apiAuthHeaders(auth()!.token, true),
    body: JSON.stringify({
      building_id: buildingId,
      variant_id: selectedVariantId,
      status,
      force,
    }),
  });
  let parsed: {
    ok?: boolean;
    error?: string;
    identical?: boolean;
    skipped?: boolean;
    warning?: string;
    filename?: string;
    pdf_filename?: string;
    filename_pdf?: string;
    existing_filename?: string;
    relative_path?: string;
    project_folder?: string;
  };
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    throw new Error(`Rapport opslaan mislukt (HTTP ${res.status})`);
  }
  if (!res.ok || !parsed.ok) {
    throw new Error(parsed.error || `Rapport opslaan mislukt (HTTP ${res.status})`);
  }
  const pdfName = parsed.pdf_filename || parsed.filename_pdf || null;
  if (parsed.identical && parsed.skipped) {
    const existing = parsed.existing_filename || "bestaand bestand";
    const msg =
      parsed.warning ||
      `Identiek rapport bestaat al (${existing}) — er is niets weggeschreven.`;
    if (reportHintEl) reportHintEl.textContent = msg;
    setConn("err", msg);
    const forceAnyway = window.confirm(
      `${msg}\n\nToch een nieuw bestand schrijven?`,
    );
    if (forceAnyway) return saveProjectReport(true);
    // Prefer PDF for inbox publish; fall back to HTML (server maps to PDF).
    return pdfName || (existing.endsWith(".html") || existing.endsWith(".pdf") ? existing : null);
  }
  const pathHint = parsed.relative_path || pdfName || parsed.filename || "";
  const folder = parsed.project_folder ? ` · map ${parsed.project_folder}` : "";
  const okMsg = `Rapport opgeslagen (PDF): ${pathHint}${folder}`;
  if (reportHintEl) reportHintEl.textContent = okMsg;
  setConn("ok", okMsg);
  return pdfName || parsed.filename || null;
}

async function publishReportToInbox(filename: string): Promise<void> {
  if (!auth() || !buildingId) throw new Error("Log in en selecteer een gebouw");
  const reportKind = reportKindEl?.value === "definitief" ? "definitief" : "concept";
  if (reportHintEl) reportHintEl.textContent = "Publiceren naar inbox…";
  const res = await fetch("/api/reports/publish", {
    method: "POST",
    credentials: "include",
    headers: apiAuthHeaders(auth()!.token, true),
    body: JSON.stringify({
      building_id: buildingId,
      filename,
      report_kind: reportKind,
      version_label: "1.0",
    }),
  });
  let parsed: {
    ok?: boolean;
    error?: string;
    inbox?: { message?: string; report_kind?: string };
    project_status?: string;
  };
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    throw new Error(`Publiceren mislukt (HTTP ${res.status})`);
  }
  if (!res.ok || !parsed.ok) {
    throw new Error(parsed.error || `Publiceren mislukt (HTTP ${res.status})`);
  }
  const kindLabel = reportKind === "definitief" ? "definitieve" : "concept";
  const okMsg = `${kindLabel.charAt(0).toUpperCase()}${kindLabel.slice(1)} rapport in inbox opdrachtgever gezet${
    parsed.project_status ? ` · status ${parsed.project_status}` : ""
  }.`;
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
    apiAuthHeaders: () => (auth ? apiAuthHeaders(auth()!.token, true) : {}),
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
      setBuildingMetaText("—");
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
      document.title = title === "Geen project" ? "Stilte advies en meten — Berekening gevelwering" : `${title} — GA`;
    },
  });
  fileMenuRoot.hidden = true;
}

session.connect();
