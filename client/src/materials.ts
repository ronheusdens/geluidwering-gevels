import { apiAuthHeaders } from "./auth-store";
import { resolveBppWsUrl } from "./ws-url";
import { initPasswordToggles } from "./password-toggle";
import {
  MATERIAL_RUBRIEKEN,
  formatRubriekLabel,
  formatSubrubriekLabel,
  rubriekByName,
  subrubriekenFor,
} from "../lib/material-taxonomy.mjs";
import {
  materialKindBadgeHtml,
  materialKindTitle,
} from "../lib/material-kind-labels.mjs";
import {
  bppAddMaterialFavorite,
  bppListMaterialFavoritePresets,
  bppListMaterialFavorites,
  bppMaterialFavoritePresetAction,
  bppPhase1Enabled,
  bppRemoveMaterialFavorite,
} from "./bpp-api";
import { BppSession, type AuthInfo, type Envelope } from "./shared/bpp-session";
import { esc } from "./shared/dom-helpers";
import { initMaterialsStudioPanel, type MaterialsStudioPanel } from "./materials-studio-panel";

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
  material_kind?: string;
  /** EXTERIOR (gevel) | INTERIOR (isolatie / overdracht) */
  exposure?: string;
  /** Praktijkwaarde DnT,A,k [dB] — interior only */
  dnt_a_k_db?: string;
};

const AUTH_KEY = "app_gevelwering_admin_auth";

const bootParams = new URLSearchParams(location.search);
const deepMaterialId = (bootParams.get("material_id") || bootParams.get("id") || "").trim();
const deepQ = (bootParams.get("q") || "").trim();
const deepNew =
  bootParams.get("new") === "1" ||
  bootParams.get("new") === "true" ||
  bootParams.get("mode") === "new";
const returnHref = safeReturnHref(bootParams.get("return"));
const returnLabel = (bootParams.get("return_label") || "Terug naar toekennen vlak (gevel)").trim();
const pickTarget = (bootParams.get("pick_target") || "").trim().toLowerCase(); // rs | dl | …
const deepExposure = (bootParams.get("exposure") || "").trim().toUpperCase();
const deepRubriek = (bootParams.get("rubriek") || "").trim();
const deepSubrubriek = (bootParams.get("subrubriek") || "").trim();
const returnLinkEl = document.getElementById("mat-return-link") as HTMLAnchorElement | null;
const returnWrapEl = document.getElementById("mat-return-wrap") as HTMLElement | null;
const pickBarEl = document.getElementById("mat-pick-bar") as HTMLElement | null;
const pickBtnEl = document.getElementById("mat-pick-btn") as HTMLButtonElement | null;
const pickBtnEditorEl = document.getElementById("mat-pick-btn-editor") as HTMLButtonElement | null;
const pickHintEl = document.getElementById("mat-pick-hint") as HTMLElement | null;
const PICK_STORAGE_KEY = "app-gevelwering-material-pick";

function buildingIdFromContext(): string {
  const direct = (bootParams.get("building_id") || "").trim();
  if (direct) return direct;
  if (!returnHref) return "";
  try {
    return new URL(returnHref, location.href).searchParams.get("building_id")?.trim() || "";
  } catch {
    return "";
  }
}

const contextBuildingId = buildingIdFromContext();

function isLoopbackHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h === "[::1]" || h === "::1";
}

/** Same-origin path, or absolute loopback URL (isolatie :4174 ↔ gevel :4173). */
function safeReturnHref(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, location.origin);
    if (!u.pathname.startsWith("/")) return null;
    if (u.origin === location.origin) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
    if (isLoopbackHost(u.hostname) && isLoopbackHost(location.hostname)) {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function isCrossOriginReturn(href: string): boolean {
  try {
    return new URL(href, location.href).origin !== location.origin;
  } catch {
    return false;
  }
}

function setupReturnNav(): void {
  const wrap = returnWrapEl ?? returnLinkEl;
  if (!wrap) return;
  if (!returnHref) {
    wrap.classList.add("hidden");
    return;
  }
  if (returnLinkEl) {
    returnLinkEl.href = returnHref;
    returnLinkEl.textContent = `← ${returnLabel}`;
  }
  wrap.classList.remove("hidden");
}

type MatTab = "catalog" | "studio";
const initialTab: MatTab = bootParams.get("tab") === "studio" ? "studio" : "catalog";
const tabCatalogBtn = document.getElementById("mat-tab-catalog-btn") as HTMLButtonElement;
const tabStudioBtn = document.getElementById("mat-tab-studio-btn") as HTMLButtonElement;
const tabCatalogPane = document.getElementById("mat-tab-catalog") as HTMLElement;
const tabStudioPane = document.getElementById("mat-tab-studio") as HTMLElement;
let studioPanel: MaterialsStudioPanel | null = null;
let activeTab: MatTab = initialTab;

function setTab(tab: MatTab, opts?: { replaceUrl?: boolean }): void {
  activeTab = tab;
  tabCatalogBtn.classList.toggle("active", tab === "catalog");
  tabStudioBtn.classList.toggle("active", tab === "studio");
  tabCatalogBtn.setAttribute("aria-selected", tab === "catalog" ? "true" : "false");
  tabStudioBtn.setAttribute("aria-selected", tab === "studio" ? "true" : "false");
  tabCatalogPane.classList.toggle("hidden", tab !== "catalog");
  tabStudioPane.classList.toggle("hidden", tab !== "studio");
  tabStudioPane.hidden = tab !== "studio";
  if (tab === "studio") {
    void studioPanel?.load().catch((err) => {
      setStatus(err instanceof Error ? err.message : "Studio laden mislukt", "err");
    });
  }
  if (opts?.replaceUrl !== false) {
    const url = new URL(location.href);
    if (tab === "studio") url.searchParams.set("tab", "studio");
    else url.searchParams.delete("tab");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

function pickButtonLabel(): string {
  if (pickTarget === "dl") return "Neem over in ΔL vloerafwerking (isolatie)";
  if (pickTarget === "rs") return "Neem over in Rₛ scheidingswand (isolatie)";
  return "Neem dit materiaal over in component";
}

function syncPickUi(): void {
  const canPick = Boolean(returnHref && selectedId);
  if (pickBarEl) pickBarEl.classList.toggle("hidden", !returnHref);
  if (pickBtnEl) {
    pickBtnEl.disabled = !canPick;
    pickBtnEl.textContent = pickButtonLabel();
  }
  if (pickBtnEditorEl) {
    pickBtnEditorEl.classList.toggle("hidden", !returnHref);
    pickBtnEditorEl.disabled = !canPick;
    pickBtnEditorEl.textContent = pickButtonLabel();
  }
  if (pickHintEl && returnHref) {
    pickHintEl.textContent = canPick
      ? pickTarget === "dl" || pickTarget === "rs"
        ? "Geselecteerd materiaal (spectrum) wordt teruggezet in de isolatieberekening."
        : "Geselecteerd materiaal wordt in het componentformulier gezet (ook als dat nog niet is opgeslagen)."
      : "Zoek en selecteer een materiaal, daarna overnemen om terug te gaan.";
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
      r_125_hz: r125El.value.trim(),
      r_250_hz: r250El.value.trim(),
      r_500_hz: r500El.value.trim(),
      r_1000_hz: r1000El.value.trim(),
      r_2000_hz: r2000El.value.trim(),
      exposure: exposureEl?.value || "",
    } as Partial<Material>);
  const payload: Record<string, unknown> = {
    material_id: String(row.material_id || selectedId).trim(),
    catalog_id: String(row.catalog_id || catalogIdEl.value.trim()).trim(),
    master_category: String(row.master_category || masterEl.value.trim()).trim(),
    category: String(row.category || catEl.value.trim()).trim(),
    name: String(row.name || nameEl.value.trim()).trim(),
    exposure: String(row.exposure || exposureEl?.value || "").trim(),
    pick_target: pickTarget || "",
    r: [
      Number(row.r_125_hz ?? r125El.value),
      Number(row.r_250_hz ?? r250El.value),
      Number(row.r_500_hz ?? r500El.value),
      Number(row.r_1000_hz ?? r1000El.value),
      Number(row.r_2000_hz ?? r2000El.value),
    ],
  };
  if (!payload.material_id || !payload.master_category) {
    setStatus("Selecteer een materiaal met rubriek om over te nemen", "err");
    return;
  }

  // Cross-origin (isolatie :4174): pass pick via query params — storage is origin-scoped.
  if (isCrossOriginReturn(returnHref)) {
    try {
      const u = new URL(returnHref, location.href);
      u.searchParams.set("mat_pick", "1");
      u.searchParams.set("material_id", String(payload.material_id));
      u.searchParams.set("catalog_id", String(payload.catalog_id || ""));
      u.searchParams.set("name", String(payload.name || ""));
      u.searchParams.set("pick_target", pickTarget || "rs");
      u.searchParams.set("r", (payload.r as number[]).map((n) => (Number.isFinite(n) ? String(n) : "")).join(","));
      location.assign(u.toString());
      return;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Terugkeer-URL ongeldig", "err");
      return;
    }
  }

  // Same-origin floormap pick: sessionStorage + relative return path.
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

async function httpJson<T>(url: string, init?: RequestInit): Promise<T> {
  if (!auth()?.token) throw new Error("Niet ingelogd");
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...apiAuthHeaders(auth()!.token, Boolean(init?.body)),
      ...(init?.headers || {}),
    },
  });
  const body = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}

async function syncFavoriteCheckbox(): Promise<void> {
  if (!favoriteWrapEl || !favoriteEl) return;
  if (!contextBuildingId) {
    favoriteWrapEl.classList.add("hidden");
    favoriteEl.checked = false;
    return;
  }
  favoriteWrapEl.classList.remove("hidden");
  const mid = (selectedId || idEl.value || "").trim();
  if (!mid || !auth()?.token) {
    favoriteEl.checked = false;
    return;
  }
  try {
    const data = bppPhase1Enabled()
      ? await bppListMaterialFavorites(invokeString, auth()!.token, contextBuildingId)
      : await httpJson<{ materials: Array<{ material_id: string }> }>(
          `/api/floormap/material-favorites?building_id=${encodeURIComponent(contextBuildingId)}`,
        );
    favoriteEl.checked = (data.materials || []).some((m) => m.material_id === mid);
  } catch {
    favoriteEl.checked = false;
  }
}

async function setFavoriteForSelection(on: boolean): Promise<void> {
  if (!contextBuildingId || !auth()?.token) return;
  const mid = (selectedId || idEl.value || "").trim();
  if (!mid) return;
  if (on) {
    if (bppPhase1Enabled()) {
      await bppAddMaterialFavorite(invokeString, auth()!.token, contextBuildingId, mid);
    } else {
      await httpJson("/api/floormap/material-favorites", {
        method: "POST",
        body: JSON.stringify({ building_id: contextBuildingId, material_id: mid }),
      });
    }
  } else if (bppPhase1Enabled()) {
    await bppRemoveMaterialFavorite(invokeString, auth()!.token, contextBuildingId, mid);
  } else {
    await httpJson(
      `/api/floormap/material-favorites?building_id=${encodeURIComponent(contextBuildingId)}&material_id=${encodeURIComponent(mid)}`,
      { method: "DELETE" },
    );
  }
}

type FavoritePreset = {
  preset_id: string;
  name: string;
  material_count: number;
};

type PresetMaterial = {
  material_id: string;
  catalog_id: string;
  name: string;
  master_category?: string;
  ra_dba?: number | null;
  sort_order?: number;
};

let cachedPresets: FavoritePreset[] = [];
let expandedPresetId: string | null = null;
/** Preset IDs that already contain the selected material. */
let selectedMaterialPresetIds = new Set<string>();

async function presetAction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (bppPhase1Enabled()) {
    return bppMaterialFavoritePresetAction(invokeString, auth()!.token, body);
  }
  return httpJson("/api/floormap/material-favorite-presets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function fillPresetAddSelect(): void {
  if (!presetAddSelectEl) return;
  const keep = presetAddSelectEl.value;
  presetAddSelectEl.replaceChildren();
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = cachedPresets.length ? "— kies preset —" : "— geen presets —";
  presetAddSelectEl.appendChild(ph);
  for (const p of cachedPresets) {
    const opt = document.createElement("option");
    opt.value = p.preset_id;
    const inIt = selectedMaterialPresetIds.has(p.preset_id);
    opt.textContent = inIt
      ? `${p.name} (${p.material_count}) · al erin`
      : `${p.name} (${p.material_count})`;
    if (inIt) opt.disabled = true;
    presetAddSelectEl.appendChild(opt);
  }
  if (keep && [...presetAddSelectEl.options].some((o) => o.value === keep && !o.disabled)) {
    presetAddSelectEl.value = keep;
  } else {
    presetAddSelectEl.value = "";
  }
}

function syncPresetAddUi(): void {
  const mid = selectedId || idEl.value.trim();
  const hasMat = Boolean(mid);
  const hasPresets = cachedPresets.length > 0;
  if (presetAddSelectEl) presetAddSelectEl.disabled = !hasMat || !hasPresets;
  if (presetAddBtn) {
    presetAddBtn.disabled = !hasMat || !hasPresets || !presetAddSelectEl?.value;
  }
  if (presetAddNewBtn) presetAddNewBtn.disabled = !hasMat;
  if (presetAddHintEl) {
    if (!hasMat) {
      presetAddHintEl.textContent = "Selecteer of sla eerst een materiaal op.";
    } else if (!hasPresets) {
      presetAddHintEl.textContent = "Nog geen presets — maak er een met «Nieuwe preset…».";
    } else {
      const n = selectedMaterialPresetIds.size;
      presetAddHintEl.textContent =
        n > 0
          ? `Staat al in ${n} preset${n === 1 ? "" : "s"}. Kies een andere of maak een nieuwe.`
          : "Kies een preset en klik Toevoegen.";
    }
  }
}

async function refreshPresetsForSelectedMaterial(): Promise<void> {
  const mid = selectedId || idEl.value.trim();
  selectedMaterialPresetIds = new Set();
  if (!mid || !auth()?.token) {
    fillPresetAddSelect();
    syncPresetAddUi();
    return;
  }
  try {
    const data = (await presetAction({
      action: "presets_for_material",
      material_id: mid,
    })) as { preset_ids?: string[] };
    selectedMaterialPresetIds = new Set(data.preset_ids || []);
  } catch {
    selectedMaterialPresetIds = new Set();
  }
  fillPresetAddSelect();
  syncPresetAddUi();
  // Update checkmarks on expanded/list rows without full reload of details
  presetListEl?.querySelectorAll<HTMLElement>("[data-preset-id]").forEach((el) => {
    const pid = el.dataset.presetId || "";
    const mark = el.querySelector(".mat-preset-contains");
    if (!mark) return;
    mark.classList.toggle("hidden", !selectedMaterialPresetIds.has(pid));
  });
}

async function addSelectedToPreset(presetId: string): Promise<void> {
  const mid = selectedId || idEl.value.trim();
  if (!mid) throw new Error("Geen materiaal geselecteerd");
  const out = (await presetAction({
    action: "add_item",
    preset_id: presetId,
    material_id: mid,
  })) as { already_present?: boolean; name?: string; material_count?: number };
  await loadPresets();
  if (expandedPresetId === presetId) await expandPreset(presetId, true);
  await refreshPresetsForSelectedMaterial();
  const label = out.name || "preset";
  if (out.already_present) {
    setStatus(`Stond al in «${label}»`, "ok");
  } else {
    setStatus(`Toegevoegd aan «${label}» (${out.material_count ?? "?"} materialen)`, "ok");
  }
}

function setPresetFeedback(text: string, kind: "ok" | "err" | "busy" = "ok"): void {
  if (!presetFeedbackEl) return;
  presetFeedbackEl.textContent = text;
  presetFeedbackEl.classList.remove("ok", "err", "busy");
  presetFeedbackEl.classList.add(kind);
}

async function createPreset(name: string, withSelectedMaterial: boolean): Promise<string> {
  setPresetFeedback(`Preset «${name}» aanmaken…`, "busy");
  setStatus(`Preset «${name}» aanmaken…`, "busy");
  const created = (await presetAction({
    action: "create",
    name,
  })) as { preset_id?: string; name?: string; ok?: boolean };
  if (!created?.preset_id) {
    throw new Error("Preset aanmaken mislukt (geen preset_id in antwoord)");
  }
  if (withSelectedMaterial) {
    const mid = selectedId || idEl.value.trim();
    if (mid) {
      await presetAction({
        action: "add_item",
        preset_id: created.preset_id,
        material_id: mid,
      });
    }
  }
  expandedPresetId = created.preset_id;
  await loadPresets();
  await expandPreset(created.preset_id, true);
  const li = presetListEl?.querySelector<HTMLElement>(
    `[data-preset-id="${CSS.escape(created.preset_id)}"]`,
  );
  li?.classList.add("mat-preset-item-new");
  li?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  document.getElementById("mat-presets-panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  await refreshPresetsForSelectedMaterial();
  return created.preset_id;
}

async function expandPreset(presetId: string, force = false): Promise<void> {
  if (!presetListEl) return;
  const li = presetListEl.querySelector<HTMLElement>(`[data-preset-id="${CSS.escape(presetId)}"]`);
  if (!li) return;
  const detail = li.querySelector<HTMLElement>(".mat-preset-detail");
  if (!detail) return;

  if (!force && expandedPresetId === presetId && !detail.classList.contains("hidden")) {
    detail.classList.add("hidden");
    expandedPresetId = null;
    li.querySelector(".mat-preset-toggle")?.setAttribute("aria-expanded", "false");
    return;
  }

  // Collapse others
  presetListEl.querySelectorAll<HTMLElement>(".mat-preset-detail").forEach((d) => d.classList.add("hidden"));
  presetListEl.querySelectorAll(".mat-preset-toggle").forEach((b) => b.setAttribute("aria-expanded", "false"));

  expandedPresetId = presetId;
  detail.classList.remove("hidden");
  detail.innerHTML = `<p class="hint">Laden…</p>`;
  li.querySelector(".mat-preset-toggle")?.setAttribute("aria-expanded", "true");

  try {
    const data = (await presetAction({
      action: "get",
      preset_id: presetId,
    })) as { materials?: PresetMaterial[]; name?: string; material_count?: number };
    const mats = data.materials || [];
    const countEl = li.querySelector(".mat-preset-count");
    if (countEl) countEl.textContent = String(data.material_count ?? mats.length);

    if (!mats.length) {
      detail.innerHTML = `<p class="hint">Nog geen materialen in deze preset.</p>`;
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "mat-preset-materials";
    for (const m of mats) {
      const row = document.createElement("li");
      row.className = "mat-preset-material";
      const link = document.createElement("button");
      link.type = "button";
      link.className = "mat-preset-mat-link";
      const code = (m.catalog_id || "").trim();
      const ra = m.ra_dba != null ? ` · RA ${m.ra_dba}` : "";
      link.textContent = code ? `${code} · ${m.name}${ra}` : `${m.name}${ra}`;
      link.title = "Open in catalogus";
      link.addEventListener("click", () => {
        if (listRows.some((r) => r.material_id === m.material_id)) {
          selectFromList(m.material_id);
        } else {
          qEl.value = code || m.name;
          offset = 0;
          void loadList(m.material_id);
        }
      });
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "secondary danger";
      rm.textContent = "Verwijderen";
      rm.addEventListener("click", () => {
        void (async () => {
          try {
            await presetAction({
              action: "remove_item",
              preset_id: presetId,
              material_id: m.material_id,
            });
            setStatus(`Verwijderd uit preset`, "ok");
            await loadPresets();
            await expandPreset(presetId, true);
            await refreshPresetsForSelectedMaterial();
          } catch (err) {
            setStatus(err instanceof Error ? err.message : String(err), "err");
          }
        })();
      });
      row.append(link, rm);
      ul.appendChild(row);
    }
    detail.replaceChildren(ul);

    const addHere = document.createElement("div");
    addHere.className = "actions";
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "secondary";
    const mid = selectedId || idEl.value.trim();
    const already = mid && selectedMaterialPresetIds.has(presetId);
    addBtn.textContent = already
      ? "Geselecteerd materiaal staat al in deze preset"
      : "Geselecteerd materiaal hier toevoegen";
    addBtn.disabled = !mid || Boolean(already);
    addBtn.addEventListener("click", () => {
      void addSelectedToPreset(presetId).catch((err) =>
        setStatus(err instanceof Error ? err.message : String(err), "err"),
      );
    });
    addHere.appendChild(addBtn);
    detail.appendChild(addHere);
  } catch (err) {
    detail.innerHTML = `<p class="hint">${esc(err instanceof Error ? err.message : "laden mislukt")}</p>`;
  }
}

async function loadPresets(): Promise<void> {
  if (!presetListEl || !presetEmptyEl || !auth()?.token) return;
  try {
    const data = bppPhase1Enabled()
      ? await bppListMaterialFavoritePresets(invokeString, auth()!.token)
      : await httpJson<{
          presets: FavoritePreset[];
        }>("/api/floormap/material-favorite-presets");
    cachedPresets = data.presets || [];
    presetListEl.replaceChildren();
    presetEmptyEl.classList.toggle("hidden", cachedPresets.length > 0);
    fillPresetAddSelect();
    syncPresetAddUi();

    for (const p of cachedPresets) {
      const li = document.createElement("li");
      li.className = "mat-preset-item";
      li.dataset.presetId = p.preset_id;

      const head = document.createElement("div");
      head.className = "mat-preset-head";

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "mat-preset-toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.title = "Toon materialen";
      toggle.innerHTML = `<span class="mat-preset-chevron" aria-hidden="true">▸</span>`;
      toggle.addEventListener("click", () => {
        void expandPreset(p.preset_id);
      });

      const title = document.createElement("button");
      title.type = "button";
      title.className = "mat-preset-title";
      title.innerHTML = `${esc(p.name)} <span class="mat-preset-count-wrap">(<span class="mat-preset-count">${esc(String(p.material_count))}</span>)</span>`;
      title.addEventListener("click", () => {
        void expandPreset(p.preset_id);
      });

      const contains = document.createElement("span");
      contains.className = "mat-preset-contains mat-kind-badge mat-kind-single";
      contains.textContent = "bevat selectie";
      contains.title = "Het geselecteerde materiaal staat in deze preset";
      if (!selectedMaterialPresetIds.has(p.preset_id)) contains.classList.add("hidden");

      const actions = document.createElement("div");
      actions.className = "mat-preset-actions";

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "secondary";
      renameBtn.textContent = "Hernoemen";
      renameBtn.addEventListener("click", () => {
        const name = window.prompt("Nieuwe preset-naam:", p.name);
        if (!name?.trim() || name.trim() === p.name) return;
        void presetAction({ action: "rename", preset_id: p.preset_id, name: name.trim() })
          .then(() => loadPresets())
          .then(() => setStatus(`Preset hernoemd naar «${name.trim()}»`, "ok"))
          .catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
      });

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "secondary";
      addBtn.textContent = "+ Selectie";
      addBtn.title = "Geselecteerd materiaal aan deze preset toevoegen";
      addBtn.disabled = !(selectedId || idEl.value.trim()) || selectedMaterialPresetIds.has(p.preset_id);
      addBtn.addEventListener("click", () => {
        void addSelectedToPreset(p.preset_id).catch((err) =>
          setStatus(err instanceof Error ? err.message : String(err), "err"),
        );
      });

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "danger secondary";
      delBtn.textContent = "Verwijderen";
      delBtn.addEventListener("click", () => {
        if (!window.confirm(`Preset «${p.name}» en alle koppelingen verwijderen?`)) return;
        void presetAction({ action: "delete", preset_id: p.preset_id })
          .then(() => {
            if (expandedPresetId === p.preset_id) expandedPresetId = null;
            return loadPresets();
          })
          .then(() => setStatus(`Preset «${p.name}» verwijderd`, "ok"))
          .catch((err) => setStatus(err instanceof Error ? err.message : String(err), "err"));
      });

      actions.append(addBtn, renameBtn, delBtn);
      head.append(toggle, title, contains, actions);
      const detail = document.createElement("div");
      detail.className = "mat-preset-detail hidden";
      li.append(head, detail);
      presetListEl.appendChild(li);
    }

    if (expandedPresetId && cachedPresets.some((p) => p.preset_id === expandedPresetId)) {
      await expandPreset(expandedPresetId, true);
    } else {
      expandedPresetId = null;
    }
    await refreshPresetsForSelectedMaterial();
  } catch (err) {
    cachedPresets = [];
    presetListEl.replaceChildren();
    presetEmptyEl.classList.remove("hidden");
    presetEmptyEl.textContent =
      err instanceof Error ? `Presets laden mislukt: ${err.message}` : "Presets laden mislukt";
    fillPresetAddSelect();
    syncPresetAddUi();
  }
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
const exposureFilterEl = document.getElementById("mat-exposure-filter") as HTMLSelectElement | null;
const exposureEl = document.getElementById("mat-exposure") as HTMLSelectElement | null;
const pagerLabelEl = document.getElementById("mat-pager-label") as HTMLElement;
const prevBtn = document.getElementById("mat-prev-btn") as HTMLButtonElement;
const nextBtn = document.getElementById("mat-next-btn") as HTMLButtonElement;
const newBtn = document.getElementById("mat-new-btn") as HTMLButtonElement;
const listboxEl = document.getElementById("mat-listbox") as HTMLElement;
const tbodyEl = document.getElementById("mat-tbody") as HTMLTableSectionElement;
const editorTitleEl = document.getElementById("mat-editor-title") as HTMLElement;
const opbouwEl = document.getElementById("mat-opbouw") as HTMLElement;
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
const favoriteWrapEl = document.getElementById("mat-fav-wrap") as HTMLElement | null;
const favoriteEl = document.getElementById("mat-favorite") as HTMLInputElement | null;
const presetListEl = document.getElementById("mat-preset-list") as HTMLUListElement | null;
const presetEmptyEl = document.getElementById("mat-preset-empty") as HTMLElement | null;
const presetAddSelectEl = document.getElementById("mat-preset-add-select") as HTMLSelectElement | null;
const presetAddBtn = document.getElementById("mat-preset-add-btn") as HTMLButtonElement | null;
const presetAddNewBtn = document.getElementById("mat-preset-add-new-btn") as HTMLButtonElement | null;
const presetAddHintEl = document.getElementById("mat-preset-add-hint") as HTMLElement | null;
const presetCreateBtn = document.getElementById("mat-preset-create-btn") as HTMLButtonElement | null;
const presetCreateNameEl = document.getElementById("mat-preset-create-name") as HTMLInputElement | null;
const presetRefreshBtn = document.getElementById("mat-preset-refresh-btn") as HTMLButtonElement | null;
const presetFeedbackEl = document.getElementById("mat-preset-feedback") as HTMLElement | null;
const thickEl = document.getElementById("mat-thick") as HTMLInputElement;
const weightEl = document.getElementById("mat-weight") as HTMLInputElement;
const raEl = document.getElementById("mat-ra") as HTMLInputElement;
const glassFieldsEl = document.getElementById("mat-glass-fields") as HTMLElement | null;
const t1El = document.getElementById("mat-t1") as HTMLInputElement;
const cavEl = document.getElementById("mat-cav") as HTMLInputElement;
const t2El = document.getElementById("mat-t2") as HTMLInputElement;
const dntakEl = document.getElementById("mat-dntak") as HTMLInputElement | null;
const spectrumIntHintEl = document.getElementById("mat-spectrum-int-hint") as HTMLElement | null;

function isGlassRubriek(master?: string): boolean {
  const name = (master ?? masterEl.value).trim();
  if (!name) return false;
  if (name === "Glas") return true;
  const rub = rubriekByName(name);
  return rub?.nr === 2;
}

function syncGlassFieldsVisibility(): void {
  const show = isGlassRubriek();
  glassFieldsEl?.classList.toggle("hidden", !show);
  if (!show) {
    // Keep stored values when switching away; only hide UI.
    t1El.removeAttribute("required");
    cavEl.removeAttribute("required");
    t2El.removeAttribute("required");
  }
}

function editorIsInterior(): boolean {
  if (exposureEl?.value === "INTERIOR") return true;
  if (masterEl.value.trim() === "Interieur") return true;
  return false;
}

/** Interior: hide RA/C/Ctr (façade corrections), show praktijkwaarde DnT,A,k. */
function syncInteriorSpectrumUi(): void {
  const interior = editorIsInterior();
  const filter = (exposureFilterEl?.value || "").trim();
  const spectrumEl = document.getElementById("mat-spectrum");
  spectrumEl?.classList.toggle("is-interior", interior);
  document.querySelectorAll("#mat-editor-panel .mat-col-int").forEach((el) => {
    el.classList.toggle("hidden", !interior);
  });
  document.querySelectorAll("#mat-editor-panel .mat-col-ext").forEach((el) => {
    el.classList.toggle("hidden", interior);
  });
  // Table: INTERIOR filter → praktijkwaarde; EXTERIOR → RA/C/Ctr; Alle → both.
  document.querySelectorAll("#mat-table .mat-col-int").forEach((el) => {
    el.classList.toggle("hidden", filter === "EXTERIOR");
  });
  document.querySelectorAll("#mat-table .mat-col-ext").forEach((el) => {
    el.classList.toggle("hidden", filter === "INTERIOR");
  });
  spectrumIntHintEl?.classList.toggle("hidden", !interior);
}
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

let offset = 0;
let total = 0;
let selectedId: string | null = null;
let listRows: Material[] = [];
const PAGE_SIZE = 10;

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
}

function showAdmin(info: AuthInfo): void {
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
  if (favoriteWrapEl) favoriteWrapEl.classList.toggle("hidden", !contextBuildingId);
  if (!studioPanel) {
    studioPanel = initMaterialsStudioPanel({ getToken: () => session.auth?.token });
  }
  setTab(activeTab, { replaceUrl: false });
  void loadPresets();
}

const session = new BppSession({
  wsUrl: resolveBppWsUrl(),
  authKey: AUTH_KEY,
  clientName: "app-gevelwering-materials-web",
  callbacks: {
    onStatus: setStatus,
    onConnLed: setConnLed,
    onLogin: (info) => showAdmin(info),
    onLogout: () => showLogin(),
    onReady: async () => {
      if (session.auth) {
        if (activeTab === "studio") return;
        if (deepMaterialId || deepNew) await applyDeepLink();
        else await loadList();
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

/** NL/EN decimal → canonieke vorm voor API/Postgres (`42,6` → `42.6`). Leeg blijft leeg. */
function normalizeDecimalInput(raw: string): string {
  let s = raw.trim().replace(/\s/g, "");
  if (!s) return "";
  if (s.includes(",") && s.includes(".")) {
    // 1.234,5 → duizendtallen-punt + decimale komma
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Ongeldig getal: “${raw.trim()}” (gebruik bijv. 42,6 of 42.6)`);
  }
  return s;
}

function decimalField(el: HTMLInputElement, label: string): string {
  try {
    return normalizeDecimalInput(el.value);
  } catch (err) {
    throw new Error(`${label}: ${err instanceof Error ? err.message : String(err)}`);
  }
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

function syncListFilterToEditorTaxonomy(): void {
  const master = masterEl.value.trim();
  const sub = catEl.value.trim();
  if (master && [...categoryEl.options].some((o) => o.value === master)) {
    categoryEl.value = master;
  }
  fillFilterSubrubrieken();
  if (sub && [...subcategoryFilterEl.options].some((o) => o.value === sub)) {
    subcategoryFilterEl.value = sub;
  } else {
    subcategoryFilterEl.value = "";
  }
}

/** After save: show the row in the list (filter + search), then ensure editor has it. */
async function focusSavedMaterial(
  materialId: string,
  hint: { catalog_id?: string; name?: string; created: boolean },
): Promise<void> {
  offset = 0;
  syncListFilterToEditorTaxonomy();
  const qHint = (hint.catalog_id || hint.name || "").trim();
  if (qHint) qEl.value = qHint;
  await loadList(materialId);
  if (!listRows.some((m) => m.material_id === materialId)) {
    const ret = await invokeString("API_AdminGetMaterial", [auth()!.token, materialId]);
    if (!ret.startsWith("ERROR")) {
      fillEditor(JSON.parse(ret) as Material);
    }
  }
  const label = (catalogIdEl.value || hint.catalog_id || hint.name || materialId).trim();
  setStatus(
    hint.created ? `Materiaal aangemaakt · ${label}` : `Materiaal bijgewerkt · ${label}`,
    "ok",
  );
  highlightSelection();
}

function ensureSourceOption(value: string): void {
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

/** App-owned rows use source=app (A#####). DGMR D… stay on catalogusGG.pdf. */
function resolveSaveSource(): string {
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

/** On create: catalog-id + nr are server-assigned (A#####). On edit: unlock for corrections. */
function setIdentityFieldsForMode(mode: "create" | "edit"): void {
  const creating = mode === "create";
  catalogIdEl.readOnly = creating;
  noEl.readOnly = creating;
  catalogIdEl.classList.toggle("mat-field-readonly", creating);
  noEl.classList.toggle("mat-field-readonly", creating);
  if (creating) {
    catalogIdEl.value = "";
    noEl.value = "";
    catalogIdEl.placeholder = "wordt toegewezen";
    noEl.placeholder = "auto";
  } else {
    catalogIdEl.placeholder = "";
    noEl.placeholder = "";
  }
  if (sourceEl instanceof HTMLSelectElement) {
    sourceEl.disabled = creating;
  }
}

function applyFilterTaxonomyToEditor(): void {
  const filterRubriek = categoryEl.value.trim();
  const filterSub = subcategoryFilterEl.value.trim();
  if (filterRubriek && [...masterEl.options].some((o) => o.value === filterRubriek)) {
    masterEl.value = filterRubriek;
  } else if (![...masterEl.options].some((o) => o.value === masterEl.value)) {
    masterEl.value = MATERIAL_RUBRIEKEN[0]?.name || "";
  }
  fillEditorSubrubrieken();
  if (filterSub && [...catEl.options].some((o) => o.value === filterSub)) {
    catEl.value = filterSub;
  }
}

function clearEditor(): void {
  selectedId = null;
  highlightSelection();
  idEl.value = "";
  setIdentityFieldsForMode("create");
  nameEl.value = "";
  sourceRefEl.value = "";
  ensureSourceOption("app");
  if (exposureEl) {
    const fromFilter = (exposureFilterEl?.value || "").trim();
    exposureEl.value = fromFilter === "INTERIOR" ? "INTERIOR" : "EXTERIOR";
  }
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
  if (dntakEl) dntakEl.value = "";
  applyFilterTaxonomyToEditor();
  syncGlassFieldsVisibility();
  syncInteriorSpectrumUi();
  editorTitleEl.textContent = "Nieuw materiaal";
  opbouwEl.classList.add("hidden");
  opbouwEl.innerHTML = "";
  deleteBtn.disabled = true;
  syncPickUi();
  if (favoriteEl) favoriteEl.checked = false;
  if (favoriteWrapEl) favoriteWrapEl.classList.toggle("hidden", !contextBuildingId);
  selectedMaterialPresetIds = new Set();
  fillPresetAddSelect();
  syncPresetAddUi();
}

function fillEditor(m: Material): void {
  selectedId = m.material_id || null;
  idEl.value = m.material_id || "";
  setIdentityFieldsForMode(m.material_id ? "edit" : "create");
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
  if (exposureEl) {
    exposureEl.value = m.exposure === "INTERIOR" ? "INTERIOR" : "EXTERIOR";
  }
  spectrumOkEl.checked = m.spectrum_ok === "true" || m.spectrum_ok === "t";
  thickEl.value = m.thickness_mm || "";
  weightEl.value = m.weight_kg_m2 || "";
  raEl.value = m.ra_dba || "";
  t1El.value = m.glass_t1_mm || "";
  cavEl.value = m.glass_cavity_mm || "";
  t2El.value = m.glass_t2_mm || "";
  syncGlassFieldsVisibility();
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
  if (dntakEl) dntakEl.value = m.dnt_a_k_db || "";
  syncInteriorSpectrumUi();
  editorTitleEl.textContent = m.material_id ? `Bewerken · ${m.catalog_id || ""} · ${m.name}` : "Nieuw materiaal";
  if (m.material_id) {
    opbouwEl.classList.remove("hidden");
    opbouwEl.innerHTML = `Opbouw: ${materialKindBadgeHtml(m.material_kind, esc)} <span class="hint-inline">${esc(materialKindTitle(m.material_kind))}</span>`;
  } else {
    opbouwEl.classList.add("hidden");
    opbouwEl.innerHTML = "";
  }
  deleteBtn.disabled = !m.material_id;
  highlightSelection();
  syncPickUi();
  void syncFavoriteCheckbox();
  void refreshPresetsForSelectedMaterial();
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
  const q = qEl.value.trim();
  pagerLabelEl.textContent =
    total === 0
      ? q
        ? `materiaal '${q}' niet gevonden.`
        : "Geen materialen gevonden."
      : `Weergave ${from}–${to} van ${total}`;
  prevBtn.disabled = offset <= 0;
  nextBtn.disabled = offset + lim >= total;
}

function selectFromList(id: string, opts?: { focusFieldId?: string | null }): void {
  const row = listRows.find((m) => m.material_id === id);
  if (!row) return;
  fillEditor(row);
  setStatus(`Geselecteerd: ${row.name}`, "ok");
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
  if (!auth()?.token) return;
  const lim = limit();
  const ret = await invokeString("API_AdminListMaterials", [
    auth()!.token,
    qEl.value.trim(),
    listCategoryFilter(),
    String(lim),
    String(offset),
    "",
    (exposureFilterEl?.value || "").trim(),
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
    .map(
      (m) => `
      <tr data-id="${esc(m.material_id)}" role="option" tabindex="-1" title="Dubbelklik om te bewerken">
        <td data-field="mat-catalog-id">${esc(m.catalog_id || "")}</td>
        <td data-field="mat-master">${esc(m.master_category || "")}</td>
        <td data-field="mat-cat">${esc(m.category || "")}</td>
        <td class="mat-name-cell" data-field="mat-name">${esc(m.name)}</td>
        <td class="mat-kind-cell">${materialKindBadgeHtml(m.material_kind, esc)}</td>
        <td class="mat-exposure-cell" data-field="mat-exposure">${esc(m.exposure === "INTERIOR" ? "Interieur" : "Exterieur")}</td>
        <td data-field="mat-thick">${esc(m.thickness_mm || "")}</td>
        <td data-field="mat-weight">${esc(m.weight_kg_m2 || "")}</td>
        <td class="mat-col-ext" data-field="mat-ra">${esc(m.exposure === "INTERIOR" ? "" : m.ra_dba || "")}</td>
        <td data-field="mat-r63">${esc(m.r_63_hz || "")}</td>
        <td data-field="mat-r125">${esc(m.r_125_hz || "")}</td>
        <td data-field="mat-r250">${esc(m.r_250_hz || "")}</td>
        <td data-field="mat-r500">${esc(m.r_500_hz || "")}</td>
        <td data-field="mat-r1000">${esc(m.r_1000_hz || "")}</td>
        <td data-field="mat-r2000">${esc(m.r_2000_hz || "")}</td>
        <td data-field="mat-r4000">${esc(m.r_4000_hz || "")}</td>
        <td data-field="mat-rw">${esc(m.rw_db || "")}</td>
        <td class="mat-col-ext" data-field="mat-c">${esc(m.exposure === "INTERIOR" ? "" : m.c_db || "")}</td>
        <td class="mat-col-ext" data-field="mat-ctr">${esc(m.exposure === "INTERIOR" ? "" : m.ctr_db || "")}</td>
        <td class="mat-col-int" data-field="mat-dntak">${esc(m.exposure === "INTERIOR" ? m.dnt_a_k_db || "" : "")}</td>
      </tr>`,
    )
    .join("");
  syncInteriorSpectrumUi();
  updatePager();

  const want = preferId ?? selectedId;
  const preferred = want ? listRows.find((m) => m.material_id === want) : null;
  if (preferred) {
    fillEditor(preferred);
    setStatus(`Geladen ${listRows.length} · ${preferred.name}`, "ok");
    return;
  }
  // Explicit preferId missing from this page: do not silently select another row.
  if (preferId) {
    highlightSelection();
    const q = qEl.value.trim();
    if (total === 0 && q) setStatus(`materiaal '${q}' niet gevonden.`, "err");
    else setStatus(`${listRows.length} materialen geladen`, "ok");
    return;
  }
  const pick = listRows[0] || null;
  if (pick) {
    fillEditor(pick);
    setStatus(`Geladen ${listRows.length} · ${pick.name}`, "ok");
  } else {
    clearEditor();
    const q = qEl.value.trim();
    if (total === 0 && q) {
      setStatus(`materiaal '${q}' niet gevonden.`, "err");
    } else if (total === 0) {
      setStatus("Geen materialen gevonden", "ok");
    } else {
      setStatus(`${listRows.length} materialen geladen`, "ok");
    }
  }
}

/** Deep-link from GA/floormap: open editor for a material, or start a new one. */
async function applyDeepLink(): Promise<void> {
  if (!auth()?.token) return;
  if (deepNew && !deepMaterialId) {
    await loadList();
    clearEditor();
    editorForm.scrollIntoView({ block: "nearest", behavior: "smooth" });
    nameEl.focus({ preventScroll: true });
    setStatus(
      "Nieuw materiaal — catalogus-id/nr automatisch; rubriek/subrubriek overgenomen uit filter waar mogelijk",
      "ok",
    );
    return;
  }
  if (!deepMaterialId) return;
  if (deepQ && !qEl.value.trim()) qEl.value = deepQ;
  setStatus("Materiaal laden…", "busy");
  const ret = await invokeString("API_AdminGetMaterial", [auth()!.token, deepMaterialId]);
  if (ret.startsWith("ERROR")) {
    const label = (deepQ || deepMaterialId).trim();
    setStatus(
      ret.includes("not found") || ret.includes("niet gevonden")
        ? `materiaal '${label}' niet gevonden.`
        : ret,
      "err",
    );
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
  setStatus(`Geopend: ${m.catalog_id || ""} · ${m.name}`, "ok");
}

loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  loginBtn.disabled = true;
  setStatus("Inloggen…", "busy");
  try {
    const info = await session.bootstrapAndLogin(
      String(new FormData(loginForm).get("username") ?? "").trim(),
      String(new FormData(loginForm).get("password") ?? ""),
    );
    if (info.username !== "admin") {
      setStatus("Materiaaleditor is alleen voor gebruiker 'admin'", "err");
      return;
    }
    offset = 0;
    if (activeTab !== "studio") {
      if (deepMaterialId || deepNew) await applyDeepLink();
      else await loadList();
    }
    setStatus("Beheerder ingelogd", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    if (session.auth?.token) await invokeString("API_Logout", [session.auth.token]);
  } catch {
    /* ignore */
  }
  session.logout();
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
  if (exposureEl && masterEl.value === "Interieur") exposureEl.value = "INTERIOR";
  syncGlassFieldsVisibility();
  syncInteriorSpectrumUi();
});
exposureEl?.addEventListener("change", () => syncInteriorSpectrumUi());
exposureFilterEl?.addEventListener("change", () => {
  syncInteriorSpectrumUi();
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
  const rub = masterEl.value.trim();
  const sub = catEl.value.trim();
  const bits = [rub && `rubriek ${rub}`, sub && `subrubriek ${sub}`].filter(Boolean);
  setStatus(
    bits.length
      ? `Nieuw materiaal — ${bits.join(", ")} overgenomen uit zoekfilter`
      : "Nieuw materiaal — catalogus-id en nr worden automatisch toegewezen",
    "ok",
  );
});

clearBtn.addEventListener("click", () => clearEditor());

favoriteEl?.addEventListener("change", () => {
  if (!favoriteEl || !contextBuildingId) return;
  if (!selectedId && !idEl.value.trim()) {
    favoriteEl.checked = false;
    setStatus("Sla het materiaal eerst op voordat je favoriet zet", "err");
    return;
  }
  void setFavoriteForSelection(favoriteEl.checked)
    .then(() =>
      setStatus(
        favoriteEl.checked ? "Toegevoegd aan meest gebruikt" : "Verwijderd uit meest gebruikt",
        "ok",
      ),
    )
    .catch((err) => {
      favoriteEl.checked = !favoriteEl.checked;
      setStatus(err instanceof Error ? err.message : String(err), "err");
    });
});

presetAddSelectEl?.addEventListener("change", () => syncPresetAddUi());

presetAddBtn?.addEventListener("click", () => {
  const pid = presetAddSelectEl?.value;
  if (!pid) return;
  void addSelectedToPreset(pid).catch((err) =>
    setStatus(err instanceof Error ? err.message : String(err), "err"),
  );
});

function promptNewPreset(withSelected: boolean): void {
  const fromInput = presetCreateNameEl?.value.trim() || "";
  const name =
    fromInput ||
    window.prompt("Naam voor de nieuwe favorieten-preset:")?.trim() ||
    "";
  if (!name) {
    setPresetFeedback("Vul eerst een preset-naam in.", "err");
    presetCreateNameEl?.focus();
    return;
  }
  if (presetCreateBtn) presetCreateBtn.disabled = true;
  void createPreset(name, withSelected)
    .then(() => {
      if (presetCreateNameEl) presetCreateNameEl.value = "";
      const msg = withSelected
        ? `Preset «${name}» aangemaakt (geselecteerd materiaal toegevoegd).`
        : `Preset «${name}» aangemaakt.`;
      setPresetFeedback(msg, "ok");
      setStatus(msg, "ok");
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      setPresetFeedback(msg, "err");
      setStatus(msg, "err");
    })
    .finally(() => {
      if (presetCreateBtn) presetCreateBtn.disabled = false;
    });
}

presetAddNewBtn?.addEventListener("click", () => {
  document.getElementById("mat-presets-panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (presetCreateNameEl) {
    presetCreateNameEl.focus();
    if (!presetCreateNameEl.value.trim()) {
      setPresetFeedback("Typ een naam en druk Enter of klik Aanmaken (geselecteerd materiaal wordt meegenomen).", "busy");
      return;
    }
  }
  promptNewPreset(true);
});
presetCreateBtn?.addEventListener("click", () =>
  promptNewPreset(Boolean(selectedId || idEl.value.trim())),
);
presetCreateNameEl?.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    promptNewPreset(Boolean(selectedId || idEl.value.trim()));
  }
});
presetRefreshBtn?.addEventListener("click", () => {
  void loadPresets()
    .then(() => refreshPresetsForSelectedMaterial())
    .then(() => {
      setPresetFeedback("Presets vernieuwd", "ok");
      setStatus("Presets vernieuwd", "ok");
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      setPresetFeedback(msg, "err");
      setStatus(msg, "err");
    });
});

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
  if (!auth()?.token) return;
  const isNew = !idEl.value.trim();
  const cid = catalogIdEl.value.trim();
  if (!isNew && !cid) {
    setStatus("Catalogus-id is verplicht bij bewerken", "err");
    catalogIdEl.focus();
    return;
  }
  saveBtn.disabled = true;
  setStatus("Materiaal opslaan…", "busy");
  const savedName = nameEl.value.trim();
  const hasSpectrum = [r63El, r125El, r250El, r500El, r1000El, r2000El].some((el) => el.value.trim());
  if (isNew && !hasSpectrum) {
    spectrumOkEl.checked = false;
  }
  try {
    const ret = await invokeString("API_AdminSaveMaterial", [
      auth()!.token,
      idEl.value.trim(),
      isNew ? "" : catalogIdEl.value.trim(),
      masterEl.value.trim(),
      isNew ? "" : noEl.value.trim(),
      savedName,
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
      resolveSaveSource(),
      masterEl.value.trim() === "Interieur" || exposureEl?.value === "INTERIOR"
        ? "INTERIOR"
        : "EXTERIOR",
      dntakEl ? decimalField(dntakEl, "Praktijkwaarde") : "",
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const saved = JSON.parse(ret) as {
      material_id: string;
      catalog_id?: string;
      created: boolean;
    };
    const wantFav = Boolean(favoriteEl?.checked && contextBuildingId);
    await focusSavedMaterial(saved.material_id, {
      catalog_id: saved.catalog_id,
      name: savedName,
      created: saved.created,
    });
    if (wantFav && saved.material_id) {
      try {
        if (bppPhase1Enabled()) {
          await bppAddMaterialFavorite(
            invokeString,
            auth()!.token,
            contextBuildingId!,
            saved.material_id,
          );
        } else {
          await httpJson("/api/floormap/material-favorites", {
            method: "POST",
            body: JSON.stringify({
              building_id: contextBuildingId,
              material_id: saved.material_id,
            }),
          });
        }
        if (favoriteEl) favoriteEl.checked = true;
      } catch (favErr) {
        setStatus(
          `Opgeslagen, maar favoriet mislukt: ${favErr instanceof Error ? favErr.message : String(favErr)}`,
          "err",
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
  if (!auth()?.token || !idEl.value) return;
  if (!window.confirm(`Materiaal “${nameEl.value || idEl.value}” verwijderen?`)) return;
  deleteBtn.disabled = true;
  setStatus("Verwijderen…", "busy");
  try {
    const ret = await invokeString("API_AdminDeleteMaterial", [auth()!.token, idEl.value]);
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
syncGlassFieldsVisibility();
syncInteriorSpectrumUi();
setupReturnNav();
syncPickUi();
if (deepQ) qEl.value = deepQ;
{
  const exp =
    deepExposure === "INTERIEUR" || deepExposure === "INTERIOR"
      ? "INTERIOR"
      : deepExposure === "EXTERIEUR" || deepExposure === "EXTERIOR"
        ? "EXTERIOR"
        : deepExposure === "ALL" || deepExposure === "ALLE"
          ? ""
          : deepExposure;
  if (exposureFilterEl && (exp === "" || exp === "INTERIOR" || exp === "EXTERIOR")) {
    exposureFilterEl.value = exp;
  }
  if (deepRubriek) {
    const rub =
      rubriekByName(deepRubriek) ||
      MATERIAL_RUBRIEKEN.find((r) => String(r.nr) === deepRubriek) ||
      null;
    if (rub && [...categoryEl.options].some((o) => o.value === rub.name)) {
      categoryEl.value = rub.name;
      fillFilterSubrubrieken();
      if (deepSubrubriek) {
        const sub =
          subrubriekenFor(rub.nr).find(
            (s) => s.name === deepSubrubriek || String(s.nr) === deepSubrubriek,
          ) || null;
        if (sub && [...subcategoryFilterEl.options].some((o) => o.value === sub.name)) {
          subcategoryFilterEl.value = sub.name;
        }
      }
    }
  }
  if (masterEl && categoryEl.value) {
    const fromFilter = categoryEl.value;
    if ([...masterEl.options].some((o) => o.value === fromFilter)) {
      masterEl.value = fromFilter;
      fillEditorSubrubrieken();
      if (
        subcategoryFilterEl.value &&
        [...catEl.options].some((o) => o.value === subcategoryFilterEl.value)
      ) {
        catEl.value = subcategoryFilterEl.value;
      }
    }
  }
  if (exposureEl && exposureFilterEl?.value === "INTERIOR") {
    exposureEl.value = "INTERIOR";
  }
}
tabCatalogBtn.addEventListener("click", () => setTab("catalog"));
tabStudioBtn.addEventListener("click", () => setTab("studio"));

initPasswordToggles();
session.connect({ reconnectMs: 1500 });
