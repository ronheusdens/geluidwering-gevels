import { loadAuth, storeAuth as persistAuth, syncSessionCookie } from "./auth-store";
import { resolveBppWsUrl } from "./ws-url";
import { initPasswordToggles } from "./password-toggle";
import {
  MATERIAL_RUBRIEKEN,
  formatRubriekLabel,
  formatSubrubriekLabel,
  rubriekByName,
  subrubriekenFor,
} from "../lib/material-taxonomy.mjs";

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

type Material = {
  material_id: string;
  catalog_id: string;
  material_no: number | string;
  master_category: string;
  name: string;
  category: string;
  thickness_mm: string;
  weight_kg_m2: string;
  ra_dba: string;
  source_ref?: string;
  glass_t1_mm?: string;
  glass_cavity_mm?: string;
  glass_t2_mm?: string;
  spectrum_ok: string;
  r_63_hz: string;
  r_125_hz: string;
  r_250_hz: string;
  r_500_hz: string;
  r_1000_hz: string;
  r_2000_hz: string;
  r_4000_hz: string;
  rw_db: string;
  c_db: string;
  ctr_db: string;
  source: string;
};

const BPP_WS = resolveBppWsUrl();
const AUTH_KEY = "app_gevelwering_admin_auth";

const bootParams = new URLSearchParams(location.search);
const deepMaterialId = (bootParams.get("material_id") || bootParams.get("id") || "").trim();
const deepQ = (bootParams.get("q") || "").trim();
const returnHref = safeSameOriginPath(bootParams.get("return"));
const returnLabel = (bootParams.get("return_label") || "Terug naar toekennen vlak (gevel)").trim();
const returnLinkEl = document.getElementById("mat-return-link") as HTMLAnchorElement | null;
const pickBarEl = document.getElementById("mat-pick-bar") as HTMLElement | null;
const pickBtnEl = document.getElementById("mat-pick-btn") as HTMLButtonElement | null;
const pickBtnEditorEl = document.getElementById("mat-pick-btn-editor") as HTMLButtonElement | null;
const pickHintEl = document.getElementById("mat-pick-hint") as HTMLElement | null;
const PICK_STORAGE_KEY = "app-gevelwering-material-pick";

function safeSameOriginPath(raw: string | null): string | null {
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

function setupReturnNav(): void {
  if (!returnLinkEl) return;
  if (!returnHref) {
    returnLinkEl.classList.add("hidden");
    return;
  }
  returnLinkEl.href = returnHref;
  returnLinkEl.textContent = `← ${returnLabel}`;
  returnLinkEl.classList.remove("hidden");
}

function syncPickUi(): void {
  const canPick = Boolean(returnHref && selectedId);
  if (pickBarEl) pickBarEl.classList.toggle("hidden", !returnHref);
  if (pickBtnEl) pickBtnEl.disabled = !canPick;
  if (pickBtnEditorEl) {
    pickBtnEditorEl.classList.toggle("hidden", !returnHref);
    pickBtnEditorEl.disabled = !canPick;
  }
  if (pickHintEl && returnHref) {
    pickHintEl.textContent = canPick
      ? "Geselecteerd materiaal wordt in het componentformulier gezet (ook als dat nog niet is opgeslagen)."
      : "Zoek en selecteer een materiaal, daarna overnemen om terug te gaan naar het component.";
  }
}

function pickMaterialForCaller(): void {
  if (!returnHref || !selectedId) return;
  const row =
    listRows.find((m) => m.material_id === selectedId) ||
    ({
      material_id: selectedId,
      catalog_id: catalogIdEl.value.trim(),
      master_category: masterEl.value.trim(),
      category: catEl.value.trim(),
      name: nameEl.value.trim(),
    } as Partial<Material>);
  const payload: Record<string, unknown> = {
    material_id: String(row.material_id || selectedId).trim(),
    catalog_id: String(row.catalog_id || "").trim(),
    master_category: String(row.master_category || "").trim(),
    category: String(row.category || "").trim(),
    name: String(row.name || "").trim(),
  };
  if (!payload.material_id || !payload.master_category) {
    setStatus("Selecteer een materiaal met rubriek om over te nemen", "err");
    return;
  }
  // Keep unsaved component geometry with the pick (same tab / storage).
  try {
    const draftRaw = sessionStorage.getItem("app-gevelwering-fm-component-draft");
    if (draftRaw) payload.draft = JSON.parse(draftRaw);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
  location.assign(returnHref);
}

const connBarEl = document.getElementById("mat-conn-bar") as HTMLElement;
const connLedEl = document.getElementById("mat-conn-led") as HTMLElement;
const connStatusEl = document.getElementById("mat-conn-status") as HTMLElement;
const loginPanelEl = document.getElementById("mat-login-panel") as HTMLElement;
const loginForm = document.getElementById("mat-login-form") as HTMLFormElement;
const loginBtn = document.getElementById("mat-login-btn") as HTMLButtonElement;
const panelEl = document.getElementById("mat-panel") as HTMLElement;
const userLabelEl = document.getElementById("mat-user-label") as HTMLElement;
const logoutBtn = document.getElementById("mat-logout-btn") as HTMLButtonElement;
const filterForm = document.getElementById("mat-filter-form") as HTMLFormElement;
const qEl = document.getElementById("mat-q") as HTMLInputElement;
const categoryEl = document.getElementById("mat-category") as HTMLSelectElement;
const subcategoryFilterEl = document.getElementById("mat-subcategory") as HTMLSelectElement;
const sourceFilterEl = document.getElementById("mat-source-filter") as HTMLSelectElement;
const pagerLabelEl = document.getElementById("mat-pager-label") as HTMLElement;
const prevBtn = document.getElementById("mat-prev-btn") as HTMLButtonElement;
const nextBtn = document.getElementById("mat-next-btn") as HTMLButtonElement;
const newBtn = document.getElementById("mat-new-btn") as HTMLButtonElement;
const listboxEl = document.getElementById("mat-listbox") as HTMLElement;
const tbodyEl = document.getElementById("mat-tbody") as HTMLTableSectionElement;
const editorTitleEl = document.getElementById("mat-editor-title") as HTMLElement;
const editorForm = document.getElementById("mat-editor-form") as HTMLFormElement;
const idEl = document.getElementById("mat-id") as HTMLInputElement;
const catalogIdEl = document.getElementById("mat-catalog-id") as HTMLInputElement;
const noEl = document.getElementById("mat-no") as HTMLInputElement;
const masterEl = document.getElementById("mat-master") as HTMLSelectElement;
const nameEl = document.getElementById("mat-name") as HTMLInputElement;
const catEl = document.getElementById("mat-cat") as HTMLSelectElement;
const sourceRefEl = document.getElementById("mat-source-ref") as HTMLInputElement;
const sourceEl = document.getElementById("mat-source") as HTMLSelectElement | HTMLInputElement;
const spectrumOkEl = document.getElementById("mat-spectrum-ok") as HTMLInputElement;
const thickEl = document.getElementById("mat-thick") as HTMLInputElement;
const weightEl = document.getElementById("mat-weight") as HTMLInputElement;
const raEl = document.getElementById("mat-ra") as HTMLInputElement;
const t1El = document.getElementById("mat-t1") as HTMLInputElement;
const cavEl = document.getElementById("mat-cav") as HTMLInputElement;
const t2El = document.getElementById("mat-t2") as HTMLInputElement;
const r63El = document.getElementById("mat-r63") as HTMLInputElement;
const r125El = document.getElementById("mat-r125") as HTMLInputElement;
const r250El = document.getElementById("mat-r250") as HTMLInputElement;
const r500El = document.getElementById("mat-r500") as HTMLInputElement;
const r1000El = document.getElementById("mat-r1000") as HTMLInputElement;
const r2000El = document.getElementById("mat-r2000") as HTMLInputElement;
const r4000El = document.getElementById("mat-r4000") as HTMLInputElement;
const rwEl = document.getElementById("mat-rw") as HTMLInputElement;
const cEl = document.getElementById("mat-c") as HTMLInputElement;
const ctrEl = document.getElementById("mat-ctr") as HTMLInputElement;
const saveBtn = document.getElementById("mat-save-btn") as HTMLButtonElement;
const deleteBtn = document.getElementById("mat-delete-btn") as HTMLButtonElement;
const clearBtn = document.getElementById("mat-clear-btn") as HTMLButtonElement;

let ws: WebSocket | null = null;
let sessionId: string | null = null;
let auth: AuthInfo | null = null;
let reqCounter = 0;
let offset = 0;
let total = 0;
let selectedId: string | null = null;
let listRows: Material[] = [];
const PAGE_SIZE = 10;
const pending = new Map<string, { resolve: (env: Envelope) => void; reject: (err: Error) => void; want: string }>();

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

function showAdmin(info: AuthInfo): void {
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
  if (typeof ret !== "string") throw new Error(`Unexpected return from ${target}: ${JSON.stringify(inv.payload)}`);
  return ret;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fillFilterRubrieken(): void {
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

function fillFilterSubrubrieken(): void {
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

function fillEditorRubrieken(): void {
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

function fillEditorSubrubrieken(): void {
  const rub = rubriekByName(masterEl.value);
  const keep = catEl.value;
  catEl.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "— kies subrubriek —";
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

function listCategoryFilter(): string {
  const master = categoryEl.value.trim();
  if (!master) return "";
  const sub = subcategoryFilterEl.value.trim();
  return sub ? `${master}::${sub}` : master;
}

function ensureSourceOption(value: string): void {
  const v = (value || "eigen").trim() || "eigen";
  if (sourceEl instanceof HTMLSelectElement) {
    if (![...sourceEl.options].some((o) => o.value === v)) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sourceEl.appendChild(opt);
    }
    sourceEl.value = v;
  } else {
    sourceEl.value = v;
  }
}

/** Custom catalog ids (P…/E…, not DGMR D…) must use source=eigen so ./start.sh seed keeps them. */
function resolveSaveSource(): string {
  const cid = catalogIdEl.value.trim().toUpperCase();
  const isNew = !idEl.value.trim();
  let src = (sourceEl.value || "").trim() || "eigen";
  if (isNew) src = "eigen";
  if ((src === "catalogusGG.pdf" || src === "GL.cat") && cid && !cid.startsWith("D")) {
    src = "eigen";
  }
  ensureSourceOption(src);
  return src;
}

function clearEditor(): void {
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
  ensureSourceOption("eigen");
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
  editorTitleEl.textContent = "New material";
  deleteBtn.disabled = true;
  syncPickUi();
}

function fillEditor(m: Material): void {
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
  ensureSourceOption(m.source || "eigen");
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
  editorTitleEl.textContent = m.material_id ? `Edit · ${m.catalog_id || ""} · ${m.name}` : "New material";
  deleteBtn.disabled = !m.material_id;
  highlightSelection();
  syncPickUi();
}

function highlightSelection(): void {
  for (const tr of tbodyEl.querySelectorAll<HTMLTableRowElement>("tr[data-id]")) {
    const on = !!selectedId && tr.dataset.id === selectedId;
    tr.classList.toggle("selected", on);
    tr.setAttribute("aria-selected", on ? "true" : "false");
    if (on) tr.scrollIntoView({ block: "nearest" });
  }
}

function limit(): number {
  return PAGE_SIZE;
}

function updatePager(): void {
  const lim = limit();
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + lim, total);
  pagerLabelEl.textContent = total === 0 ? "No materials match." : `Showing ${from}–${to} of ${total}`;
  prevBtn.disabled = offset <= 0;
  nextBtn.disabled = offset + lim >= total;
}

function selectFromList(id: string, opts?: { focusFieldId?: string | null }): void {
  const row = listRows.find((m) => m.material_id === id);
  if (!row) return;
  fillEditor(row);
  setStatus(`Selected ${row.name}`, "ok");
  const fieldId = opts?.focusFieldId;
  if (fieldId) {
    const el = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
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

function moveSelection(delta: number): void {
  if (listRows.length === 0) return;
  const idx = selectedId ? listRows.findIndex((m) => m.material_id === selectedId) : -1;
  let next = idx + delta;
  if (idx < 0) next = delta > 0 ? 0 : listRows.length - 1;
  if (next < 0) next = 0;
  if (next >= listRows.length) next = listRows.length - 1;
  const row = listRows[next];
  if (row) selectFromList(row.material_id);
}

async function loadList(preferId?: string | null): Promise<void> {
  if (!auth?.token) return;
  const lim = limit();
  const ret = await invokeString("API_AdminListMaterials", [
    auth.token,
    qEl.value.trim(),
    listCategoryFilter(),
    String(lim),
    String(offset),
    (sourceFilterEl?.value || "").trim(),
  ]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("admin")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret) as { total: number; materials: Material[] };
  total = Number(parsed.total) || 0;
  listRows = parsed.materials ?? [];
  tbodyEl.innerHTML = listRows
    .map((m) => {
      const eigen = (m.source || "").trim().toLowerCase() === "eigen";
      const nameCell = eigen
        ? `${esc(m.name)} <span class="mat-eigen-badge">eigen</span>`
        : esc(m.name);
      return `
      <tr data-id="${esc(m.material_id)}" role="option" tabindex="-1" title="Dubbelklik om te bewerken"${eigen ? ' class="mat-row-eigen"' : ""}>
        <td data-field="mat-catalog-id">${esc(m.catalog_id || "")}</td>
        <td data-field="mat-master">${esc(m.master_category || "")}</td>
        <td data-field="mat-cat">${esc(m.category || "")}</td>
        <td class="mat-name-cell" data-field="mat-name">${nameCell}</td>
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
      </tr>`;
    })
    .join("");
  updatePager();

  const want = preferId ?? selectedId;
  const pick =
    (want && listRows.find((m) => m.material_id === want)) || listRows[0] || null;
  if (pick) {
    fillEditor(pick);
    setStatus(`Loaded ${listRows.length} · ${pick.name}`, "ok");
  } else {
    clearEditor();
    setStatus(total === 0 ? "No materials match" : `Loaded ${listRows.length} materials`, "ok");
  }
}

/** Deep-link from GA: open editor for a specific material_id. */
async function applyDeepLink(): Promise<void> {
  if (!auth?.token || !deepMaterialId) return;
  if (deepQ && !qEl.value.trim()) qEl.value = deepQ;
  setStatus("Loading material…", "busy");
  const ret = await invokeString("API_AdminGetMaterial", [auth.token, deepMaterialId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    await loadList();
    return;
  }
  const m = JSON.parse(ret) as Material;
  if (m.catalog_id && !qEl.value.trim()) qEl.value = m.catalog_id;
  offset = 0;
  await loadList(m.material_id);
  if (!listRows.some((r) => r.material_id === m.material_id)) {
    fillEditor(m);
  }
  editorForm.scrollIntoView({ block: "nearest", behavior: "smooth" });
  nameEl.focus({ preventScroll: true });
  setStatus(`Opened ${m.catalog_id || ""} · ${m.name}`, "ok");
}

async function bootstrapSession(): Promise<void> {
  setStatus(`Connecting to ${BPP_WS}…`, "busy");
  ws = new WebSocket(BPP_WS);
  setConnLed(false);
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("WebSocket connect timeout")), 8000);
    ws!.onopen = () => {
      window.clearTimeout(t);
      setConnLed(true);
      resolve();
    };
    ws!.onerror = () => {
      window.clearTimeout(t);
      setConnLed(false);
      reject(new Error("WebSocket connection failed — is bppServer running on port 18080?"));
    };
  });
  ws.onmessage = (ev) => onMessage(String(ev.data));
  ws.onclose = () => {
    setConnLed(false);
    setStatus("Disconnected from bppServer", "err");
  };

  await send("session.open", { client_name: "app-gevelwering-materials-web", client_version: "0.2.12" }, "session.opened");
  await send("exec.request", { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' }, "exec.completed");
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap failed: ${bootRet}`);
  setStatus(`Connected · session ${sessionId ?? "?"} · Postgres ready`, "ok");

  const stored = loadStoredAuth();
  if (stored?.token) {
    const validated = await invokeString("API_ValidateSession", [stored.token]);
    if (!validated.startsWith("ERROR")) {
      const info = JSON.parse(validated) as AuthInfo;
      if (info.username === "admin") {
        showAdmin({ token: stored.token, username: info.username, display_name: info.display_name });
        if (deepMaterialId) await applyDeepLink();
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
  setStatus("Signing in…", "busy");
  try {
    const fd = new FormData(loginForm);
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const ret = await invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const info = JSON.parse(ret) as AuthInfo;
    if (info.username !== "admin") {
      setStatus("Material editor is restricted to user 'admin'", "err");
      return;
    }
    showAdmin(info);
    offset = 0;
    if (deepMaterialId) await applyDeepLink();
    else await loadList();
    setStatus("Admin signed in", "ok");
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
    /* ignore */
  }
  showLogin();
  setStatus("Signed out", "ok");
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

pickBtnEl?.addEventListener("click", () => pickMaterialForCaller());
pickBtnEditorEl?.addEventListener("click", () => pickMaterialForCaller());

tbodyEl.addEventListener("click", (ev) => {
  const tr = (ev.target as HTMLElement).closest("tr[data-id]");
  if (!tr) return;
  selectFromList(tr.getAttribute("data-id") || "");
});

tbodyEl.addEventListener("dblclick", (ev) => {
  const td = (ev.target as HTMLElement).closest("td[data-field]");
  const tr = (ev.target as HTMLElement).closest("tr[data-id]");
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
  setStatus("Saving material…", "busy");
  try {
    const ret = await invokeString("API_AdminSaveMaterial", [
      auth.token,
      idEl.value.trim(),
      catalogIdEl.value.trim(),
      masterEl.value.trim(),
      noEl.value.trim(),
      nameEl.value.trim(),
      catEl.value.trim(),
      thickEl.value.trim(),
      weightEl.value.trim(),
      raEl.value.trim(),
      sourceRefEl.value.trim(),
      spectrumOkEl.checked ? "true" : "false",
      r63El.value.trim(),
      r125El.value.trim(),
      r250El.value.trim(),
      r500El.value.trim(),
      r1000El.value.trim(),
      r2000El.value.trim(),
      r4000El.value.trim(),
      rwEl.value.trim(),
      cEl.value.trim(),
      ctrEl.value.trim(),
      t1El.value.trim(),
      cavEl.value.trim(),
      t2El.value.trim(),
      resolveSaveSource(),
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const saved = JSON.parse(ret) as { material_id: string; created: boolean };
    setStatus(saved.created ? "Material created" : "Material updated", "ok");
    await loadList(saved.material_id || null);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    saveBtn.disabled = false;
  }
});

deleteBtn.addEventListener("click", async () => {
  if (!auth?.token || !idEl.value) return;
  if (!window.confirm(`Delete material “${nameEl.value || idEl.value}”?`)) return;
  deleteBtn.disabled = true;
  setStatus("Deleting…", "busy");
  try {
    const ret = await invokeString("API_AdminDeleteMaterial", [auth.token, idEl.value]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    selectedId = null;
    await loadList();
    setStatus("Material deleted", "ok");
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
