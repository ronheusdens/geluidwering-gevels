/**
 * Materials Studio panel — QC, kinds, recent adds, assembly templates,
 * compose assistant (samengesteld uit homogene lagen + Rw per laag).
 */
import { apiAuthHeaders } from "./auth-store";
import { esc } from "./shared/dom-helpers";
import {
  materialKindBadgeHtml,
  materialKindTitle,
} from "../lib/material-kind-labels.mjs";
import { woodGridMetrics } from "../lib/acoustic-physics.mjs";

type RecentRow = {
  material_id: string;
  catalog_id: string;
  name: string;
  source: string;
  created_at: string;
  material_kind: string;
};

type AssemblyLayer = {
  layer_order: number;
  layer_kind: string;
  label: string;
  thickness_mm: number | null;
  density_kg_m3?: number | null;
  cavity_depth_mm?: number | null;
  stud_width_mm?: number | null;
  stud_depth_mm?: number | null;
  stud_spacing_mm?: number | null;
  acoustic_role: string;
  params?: Record<string, unknown> | null;
};

type AssemblyTemplate = {
  code: string;
  name: string;
  description: string;
  assembly_family: string;
  layers: AssemblyLayer[];
};

type HomogeneousHit = {
  material_id: string;
  catalog_id: string;
  name: string;
  thickness_mm: number | null;
  density_kg_m3: number | null;
  rw_db: number | null;
  ra_dba?: number | null;
};

type ComposeLayerState = {
  layer_order: number;
  layer_kind: string;
  label: string;
  acoustic_role: string;
  thickness_mm: string;
  density_kg_m3: string;
  cavity_depth_mm: string;
  stud_width_mm: string;
  stud_depth_mm: string;
  stud_spacing_mm: string;
  material_id: string;
  material_label: string;
};

type ComposePreviewLayer = {
  layer_order: number;
  label: string;
  catalog_id: string | null;
  material_name: string | null;
  method: string;
  spectrum: Record<string, number> | null;
  rw_db: number | null;
  c_db: number | null;
  ctr_db: number | null;
  thickness_mm: number | null;
  density_kg_m3: number | null;
  surface_mass_kg_m2: number | null;
  cavity_depth_mm: number | null;
  material_id: string | null;
  layer_kind: string;
  acoustic_role: string;
  note?: string;
};

type ComposePreview = {
  layers: ComposePreviewLayer[];
  stack: {
    spectrum: Record<string, number>;
    rw_db: number | null;
    c_db: number | null;
    ctr_db: number | null;
    ra_dba_approx: number | null;
    note: string;
  };
};

type ProposedComposite = {
  concept_id: string;
  concept_catalog_id: string | null;
  name: string;
  material_kind: string;
  published_material_id: string | null;
  spectrum_version_id: string;
  version_no: number;
  status: string;
  ra_dba: number | null;
  rw_db: number | null;
  created_at: string;
  template_code: string | null;
  assembly_family: string;
};

type Summary = {
  material_rows: number;
  concepts: number;
  spectrum_versions: {
    latest_approved: number;
    proposed: number;
    rejected: number;
  };
  patterns: number;
  assemblies: number;
  material_linked: number;
  concept_kinds?: {
    homogeneous: number;
    composite_stack: number;
  };
  recently_added?: RecentRow[];
  assembly_templates?: AssemblyTemplate[];
  proposed_composites?: ProposedComposite[];
  qc: {
    generated_at: string;
    stats: Record<string, number>;
    issue_counts: Record<string, number>;
  } | null;
};

const FAMILY_LABEL: Record<string, string> = {
  buitengevel: "Buitengevel",
  dak: "Dakopbouw",
  overig: "Overig",
};

const KIND_LABEL: Record<string, string> = {
  homogeneous: "Enkellaags",
  composite_stack: "Samengesteld",
};

const LAYER_KINDS: Array<{ value: string; label: string; role: string }> = [
  { value: "cladding", label: "Bekleding / buitenblad", role: "structural" },
  { value: "cavity_ventilated", label: "Ventilerende spouw", role: "cavity" },
  { value: "membrane", label: "Folie / membraan", role: "negligible" },
  { value: "sheathing", label: "Beplating", role: "structural" },
  { value: "framing", label: "Skelet / stijlen", role: "structural" },
  { value: "insulation", label: "Isolatie", role: "absorptive" },
  { value: "vapor_barrier", label: "Damprem", role: "negligible" },
  { value: "lining", label: "Binnenafwerking", role: "structural" },
  { value: "structure", label: "Constructie", role: "structural" },
  { value: "other", label: "Overig", role: "structural" },
];

export type MaterialsStudioPanel = {
  load: () => Promise<void>;
};

export function initMaterialsStudioPanel(opts: {
  getToken: () => string | undefined;
}): MaterialsStudioPanel {
  const summaryHintEl = document.getElementById("ms-summary-hint")!;
  const statsEl = document.getElementById("ms-stats")!;
  const kindStatsEl = document.getElementById("ms-kind-stats")!;
  const recentListEl = document.getElementById("ms-recent-list")!;
  const recentEmptyEl = document.getElementById("ms-recent-empty")!;
  const templatesEl = document.getElementById("ms-templates")!;
  const refreshBtn = document.getElementById("ms-refresh-btn") as HTMLButtonElement;
  const qcMetaEl = document.getElementById("ms-qc-meta")!;
  const qcIssuesEl = document.getElementById("ms-qc-issues")!;
  const publishBtn = document.getElementById("ms-publish-btn") as HTMLButtonElement;
  const refineKzBtn = document.getElementById("ms-refine-kz-btn") as HTMLButtonElement;
  const actionOutEl = document.getElementById("ms-action-out")!;

  const composeModeEl = document.getElementById("ms-compose-mode") as HTMLSelectElement;
  const composeTplWrap = document.getElementById("ms-compose-tpl-wrap") as HTMLElement;
  const composeTplEl = document.getElementById("ms-compose-template") as HTMLSelectElement;
  const composeFamilyEl = document.getElementById("ms-compose-family") as HTMLSelectElement;
  const composeNameEl = document.getElementById("ms-compose-name") as HTMLInputElement;
  const composeLayersEl = document.getElementById("ms-compose-layers")!;
  const composeAddBtn = document.getElementById("ms-compose-add-layer") as HTMLButtonElement;
  const composePreviewBtn = document.getElementById("ms-compose-preview-btn") as HTMLButtonElement;
  const composeResultEl = document.getElementById("ms-compose-result")!;
  const composeLayerTbody = document.getElementById("ms-compose-layer-tbody")!;
  const composeStackNote = document.getElementById("ms-compose-stack-note")!;
  const composeStackStats = document.getElementById("ms-compose-stack-stats")!;
  const composeSaveTplEl = document.getElementById("ms-compose-save-tpl") as HTMLInputElement;
  const composeSaveConceptEl = document.getElementById(
    "ms-compose-save-concept",
  ) as HTMLInputElement;
  const composePublishCatalogEl = document.getElementById(
    "ms-compose-publish-catalog",
  ) as HTMLInputElement | null;
  const composeSaveBtn = document.getElementById("ms-compose-save-btn") as HTMLButtonElement;
  const composeSaveOut = document.getElementById("ms-compose-save-out")!;
  const proposedListEl = document.getElementById("ms-proposed-list");
  const proposedEmptyEl = document.getElementById("ms-proposed-empty");

  let templatesCache: AssemblyTemplate[] = [];
  let composeLayers: ComposeLayerState[] = [];
  let lastPreview: ComposePreview | null = null;

  async function apiGet<T>(path: string): Promise<T> {
    const token = opts.getToken();
    if (!token) throw new Error("niet ingelogd");
    const res = await fetch(path, {
      credentials: "include",
      headers: apiAuthHeaders(token),
    });
    const data = (await res.json()) as T & { ok?: boolean; error?: string };
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  async function apiPost<T>(path: string, body: unknown): Promise<T> {
    const token = opts.getToken();
    if (!token) throw new Error("niet ingelogd");
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: apiAuthHeaders(token, true),
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json()) as T & { ok?: boolean; error?: string };
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  function fmtWhen(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("nl-NL");
    } catch {
      return String(iso);
    }
  }

  function kindBadge(kind: string): string {
    const label = KIND_LABEL[kind] || kind;
    const cls =
      kind === "composite_stack" ? "mat-kind-badge mat-kind-composite" : "mat-kind-badge mat-kind-single";
    return `<span class="${cls}" title="${esc(materialKindTitle(kind))}">${esc(label)}</span>`;
  }

  function fmtNum(v: number | null | undefined): string {
    if (v == null || !Number.isFinite(Number(v))) return "—";
    return String(v);
  }

  function specBand(
    spec: Record<string, number> | null | undefined,
    hz: number,
  ): number | null {
    if (!spec) return null;
    const v = spec[String(hz)] ?? (spec as Record<number, number>)[hz];
    return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
  }

  function renderStats(s: Summary): void {
    const sv = s.spectrum_versions;
    summaryHintEl.textContent =
      "acoustic_catalog bevat concepten, versies en patronen; GA/engineer leest alleen gepubliceerde material-rijen.";
    const rows: Array<[string, string | number]> = [
      ["Runtime material (GA/engineer)", s.material_rows],
      ["Gekoppeld aan catalogus-trace", s.material_linked],
      ["Material concepts", s.concepts],
      ["Laatste goedgekeurde spectra", sv.latest_approved ?? 0],
      ["Voorgestelde spectra", sv.proposed ?? 0],
      ["Afgewezen spectra", sv.rejected ?? 0],
      ["Spectrum patronen", s.patterns],
      ["Opbouwtemplates", s.assemblies],
    ];
    statsEl.innerHTML = rows
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`)
      .join("");
  }

  function renderKinds(s: Summary): void {
    const k = s.concept_kinds ?? { homogeneous: 0, composite_stack: 0 };
    kindStatsEl.innerHTML = [
      ["Enkellaags", k.homogeneous],
      ["Samengesteld", k.composite_stack],
    ]
      .map(([label, n]) => `<dt>${esc(String(label))}</dt><dd>${esc(String(n))}</dd>`)
      .join("");
  }

  function renderRecent(s: Summary): void {
    const rows = s.recently_added ?? [];
    if (!rows.length) {
      recentListEl.innerHTML = "";
      recentEmptyEl.classList.remove("hidden");
      return;
    }
    recentEmptyEl.classList.add("hidden");
    recentListEl.innerHTML = rows
      .map((r) => {
        const title = `${r.catalog_id || "—"} · ${r.name || "(zonder naam)"}`;
        return `<li>
          ${kindBadge(r.material_kind)}
          <a href="/materials.html?q=${encodeURIComponent(r.catalog_id || r.name || "")}">${esc(title)}</a>
          <span class="ms-recent-meta">${esc(fmtWhen(r.created_at))}</span>
        </li>`;
      })
      .join("");
  }

  function renderTemplates(s: Summary): void {
    const templates = s.assembly_templates ?? [];
    templatesCache = templates;
    fillTemplateSelect(templates);
    if (!templates.length) {
      templatesEl.innerHTML = '<p class="hint">Geen opbouwtemplates — pas DDL 0.2.42 toe.</p>';
      return;
    }

    const order = ["buitengevel", "dak", "overig"];
    const byFamily = new Map<string, AssemblyTemplate[]>();
    for (const t of templates) {
      const fam = t.assembly_family || "overig";
      if (!byFamily.has(fam)) byFamily.set(fam, []);
      byFamily.get(fam)!.push(t);
    }

    const parts: string[] = [];
    for (const fam of order) {
      const list = byFamily.get(fam);
      if (!list?.length) continue;
      parts.push(`<h3 class="ms-family-title">${esc(FAMILY_LABEL[fam] || fam)}</h3>`);
      for (const t of list) {
        const layers = (t.layers || [])
          .map((l) => {
            let extra = "";
            if (l.layer_kind === "framing" && l.stud_width_mm && l.stud_spacing_mm) {
              const g = woodGridMetrics({
                stud_width_mm: l.stud_width_mm,
                stud_spacing_mm: l.stud_spacing_mm,
                stud_depth_mm: l.stud_depth_mm ?? l.thickness_mm,
                density_kg_m3: l.density_kg_m3 ?? 450,
                thickness_mm: l.thickness_mm,
              });
              if (g) {
                extra = ` <span class="ms-layer-mm">φ ${esc(String(g.phi_pct))}% · m″eq ${esc(String(g.m_eq_kg_m2))} kg/m²</span>`;
              } else if (l.thickness_mm != null) {
                extra = ` <span class="ms-layer-mm">${esc(String(l.thickness_mm))}&nbsp;mm</span>`;
              }
            } else if (l.thickness_mm != null) {
              extra = ` <span class="ms-layer-mm">${esc(String(l.thickness_mm))}&nbsp;mm</span>`;
            }
            return `<li><span class="ms-layer-ord">${esc(String(l.layer_order))}</span> ${esc(l.label)}${extra}</li>`;
          })
          .join("");
        parts.push(`<article class="ms-template">
          <header>
            <strong>${esc(t.name)}</strong>
            <code class="ms-template-code">${esc(t.code)}</code>
            <button type="button" class="secondary ms-use-tpl" data-code="${esc(t.code)}">Gebruik in assistent</button>
          </header>
          <p class="hint">${esc(t.description || "")}</p>
          <ol class="ms-layer-list">${layers}</ol>
        </article>`);
      }
    }
    templatesEl.innerHTML = parts.join("");
    templatesEl.querySelectorAll<HTMLButtonElement>(".ms-use-tpl").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn.dataset.code || "";
        composeModeEl.value = "existing";
        syncComposeModeUi();
        composeTplEl.value = code;
        applyTemplate(code);
        document.getElementById("ms-compose-panel")?.scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function fillTemplateSelect(templates: AssemblyTemplate[]): void {
    const keep = composeTplEl.value;
    composeTplEl.replaceChildren();
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "— kies template —";
    composeTplEl.appendChild(ph);
    for (const t of templates) {
      const opt = document.createElement("option");
      opt.value = t.code;
      opt.textContent = `${FAMILY_LABEL[t.assembly_family] || t.assembly_family}: ${t.name}`;
      composeTplEl.appendChild(opt);
    }
    if (keep && [...composeTplEl.options].some((o) => o.value === keep)) {
      composeTplEl.value = keep;
    }
  }

  function renderQc(s: Summary): void {
    const qc = s.qc;
    if (!qc) {
      qcMetaEl.textContent = "Geen QC-rapport gevonden — voer materials-qc-audit.py uit.";
      qcIssuesEl.innerHTML = "";
      return;
    }
    const when = qc.generated_at ? new Date(qc.generated_at).toLocaleString("nl-NL") : "—";
    qcMetaEl.textContent = `Gegenereerd: ${when} · ${qc.stats.total ?? "—"} rijen geaudit.`;
    const issues = Object.entries(qc.issue_counts || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    if (!issues.length) {
      qcIssuesEl.innerHTML = '<p class="hint">Geen open QC-issues in rapport.</p>';
      return;
    }
    qcIssuesEl.innerHTML = `<ul class="ms-issue-list">${issues
      .map(([k, n]) => `<li><strong>${esc(k)}</strong>: ${esc(String(n))}</li>`)
      .join("")}</ul>`;
  }

  async function approvePublishConcept(conceptId: string): Promise<{
    catalog_id: string;
    name: string;
    created: boolean;
  }> {
    return apiPost("/api/materials-studio/approve-publish", { concept_id: conceptId });
  }

  function renderProposed(s: Summary): void {
    if (!proposedListEl || !proposedEmptyEl) return;
    const rows = [...(s.proposed_composites || [])].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    );
    if (!rows.length) {
      proposedListEl.innerHTML = "";
      proposedEmptyEl.classList.remove("hidden");
      return;
    }
    proposedEmptyEl.classList.add("hidden");
    proposedListEl.innerHTML = rows
      .map((r) => {
        const fam = FAMILY_LABEL[r.assembly_family] || r.assembly_family;
        const rw = r.rw_db != null ? `Rw ${r.rw_db}` : "—";
        const ra = r.ra_dba != null ? `RA ${r.ra_dba}` : "—";
        return `<article class="ms-template ms-proposed">
          <header>
            <strong>${esc(r.name)}</strong>
            <code class="ms-template-code">${esc(r.template_code || r.concept_catalog_id || "—")}</code>
            <button type="button" class="ms-approve-pub" data-concept="${esc(r.concept_id)}">
              Goedkeuren &amp; naar catalogus
            </button>
          </header>
          <p class="hint">${esc(fam)} · ${esc(ra)} · ${esc(rw)} · ${esc(fmtWhen(r.created_at))}</p>
        </article>`;
      })
      .join("");
    proposedListEl.querySelectorAll<HTMLButtonElement>(".ms-approve-pub").forEach((btn) => {
      btn.addEventListener("click", () => {
        void (async () => {
          const id = btn.dataset.concept || "";
          if (!id) return;
          if (
            !confirm(
              "Dit voorstel goedkeuren en als A#####-materiaal in de catalogus zetten?\nHet wordt dan zoekbaar op gevel/GA.",
            )
          ) {
            return;
          }
          try {
            btn.disabled = true;
            actionOutEl.textContent = "Goedkeuren & publiceren…";
            const out = await approvePublishConcept(id);
            actionOutEl.textContent = `Catalogus: ${out.catalog_id} · ${out.name}${
              out.created ? " (nieuw)" : " (bijgewerkt)"
            }.`;
            await load();
          } catch (err) {
            actionOutEl.textContent = err instanceof Error ? err.message : "publiceren mislukt";
            btn.disabled = false;
          }
        })();
      });
    });
  }

  function defaultLayer(order: number): ComposeLayerState {
    return {
      layer_order: order,
      layer_kind: "cladding",
      label: order === 1 ? "Buitenlaag" : `Laag ${order}`,
      acoustic_role: "structural",
      thickness_mm: "",
      density_kg_m3: "",
      cavity_depth_mm: "",
      stud_width_mm: "",
      stud_depth_mm: "",
      stud_spacing_mm: "",
      material_id: "",
      material_label: "",
    };
  }

  function applyTemplate(code: string): void {
    const t = templatesCache.find((x) => x.code === code);
    if (!t) return;
    composeFamilyEl.value = t.assembly_family || "overig";
    composeNameEl.value = t.name;
    composeLayers = (t.layers || []).map((l) => {
      const p = (l.params || {}) as Record<string, unknown>;
      const catalogId = typeof p.catalog_id === "string" ? p.catalog_id : "";
      const materialId = typeof p.material_id === "string" ? p.material_id : "";
      const isCavity = l.layer_kind === "cavity_ventilated";
      return {
        layer_order: l.layer_order,
        layer_kind: l.layer_kind,
        label: l.label,
        acoustic_role: isCavity ? "cavity" : l.acoustic_role || "structural",
        thickness_mm: isCavity
          ? ""
          : l.thickness_mm != null
            ? String(l.thickness_mm)
            : "",
        density_kg_m3: isCavity
          ? ""
          : l.density_kg_m3 != null
            ? String(l.density_kg_m3)
            : "",
        cavity_depth_mm:
          l.cavity_depth_mm != null
            ? String(l.cavity_depth_mm)
            : isCavity && l.thickness_mm != null
              ? String(l.thickness_mm)
              : "",
        stud_width_mm: l.stud_width_mm != null ? String(l.stud_width_mm) : "",
        stud_depth_mm: l.stud_depth_mm != null ? String(l.stud_depth_mm) : "",
        stud_spacing_mm: l.stud_spacing_mm != null ? String(l.stud_spacing_mm) : "",
        material_id: isCavity ? "" : materialId,
        material_label: isCavity
          ? ""
          : catalogId
            ? `${catalogId}${l.label ? ` · ${l.label}` : ""}`
            : "",
      };
    });
    if (!composeLayers.length) composeLayers = [defaultLayer(1)];
    lastPreview = null;
    composeResultEl.classList.add("hidden");
    renderComposeLayers();
  }

  function syncComposeModeUi(): void {
    const existing = composeModeEl.value === "existing";
    composeTplWrap.classList.toggle("hidden", !existing);
    if (!existing && !composeLayers.length) {
      composeLayers = [defaultLayer(1), defaultLayer(2)];
      renderComposeLayers();
    }
  }

  function renumberLayers(): void {
    composeLayers.forEach((L, i) => {
      L.layer_order = i + 1;
    });
  }

  function framingMetricsHtml(L: ComposeLayerState): string {
    if (L.layer_kind !== "framing") return "";
    const g = woodGridMetrics({
      stud_width_mm: L.stud_width_mm,
      stud_spacing_mm: L.stud_spacing_mm,
      stud_depth_mm: L.stud_depth_mm || L.thickness_mm,
      density_kg_m3: L.density_kg_m3 || "450",
      thickness_mm: L.thickness_mm,
    });
    if (!g) {
      return `<p class="hint ms-wood-calc">Rekenwaarde φ / m″eq: vul breedte, h.o.h. en ρ in.</p>`;
    }
    return `<p class="hint ms-wood-calc">Rekenwaarde (read-only): φ = <strong>${esc(String(g.phi_pct))}%</strong>
      (b/a) · m″eq = <strong>${esc(String(g.m_eq_kg_m2))} kg/m²</strong>
      · A<sub>hout</sub> = φ · A<sub>dak</sub></p>`;
  }

  function renderComposeLayers(): void {
    renumberLayers();
    composeLayersEl.innerHTML = "";
    composeLayers.forEach((L, idx) => {
      const row = document.createElement("div");
      row.className = "ms-compose-layer";
      row.dataset.idx = String(idx);

      const kindOpts = LAYER_KINDS.map(
        (k) =>
          `<option value="${esc(k.value)}" ${k.value === L.layer_kind ? "selected" : ""}>${esc(k.label)}</option>`,
      ).join("");

      const isCavity = L.layer_kind === "cavity_ventilated";
      const isFraming = L.layer_kind === "framing";

      const framingBlock = isFraming
        ? `<label class="mat-field">Breedte mm
              <input data-field="stud_width_mm" inputmode="decimal" value="${esc(L.stud_width_mm)}" />
            </label>
            <label class="mat-field">Hoogte mm
              <input data-field="stud_depth_mm" inputmode="decimal" value="${esc(L.stud_depth_mm)}" />
            </label>
            <label class="mat-field">h.o.h. mm
              <input data-field="stud_spacing_mm" inputmode="decimal" value="${esc(L.stud_spacing_mm)}" title="Hart-op-hart afstand (rekenwaarde default: tengel 600, panlat 320)" />
            </label>
            ${framingMetricsHtml(L)}`
        : "";

      const cavityDepth = L.cavity_depth_mm || L.thickness_mm || "";
      const bodyFields = isCavity
        ? `<p class="hint ms-mat-picked">Spouw = lucht — geen materiaal. Alleen hoogte/dikte van de spouw.</p>
          <label class="mat-field">Hoogte / dikte mm
            <input data-field="cavity_depth_mm" inputmode="decimal" value="${esc(cavityDepth)}"
              title="Diepte van de luchtspouw" />
          </label>`
        : `<label class="mat-field mat-field-grow">Enkellaags materiaal
            <input data-field="mat_q" type="search" placeholder="zoek catalogus-id of naam…"
              value="${esc(L.material_label || "")}"
              aria-autocomplete="list"
              aria-controls="ms-mat-hits-${esc(String(L.layer_order))}" />
          </label>
          <div class="ms-mat-hits" id="ms-mat-hits-${esc(String(L.layer_order))}" data-hits hidden role="listbox" aria-label="Zoekresultaten materiaal"></div>
          <p class="hint ms-mat-picked">${
            L.material_id
              ? `Gekozen: <strong>${esc(L.material_label || L.material_id)}</strong>`
              : isFraming
                ? "Regelwerk: geometrie hieronder; φ en m″eq zijn rekenwaarden."
                : "Nog geen materiaal — typ minstens 2 tekens om te zoeken, klik een treffer."
          }</p>
          <label class="mat-field">Dikte mm
            <input data-field="thickness_mm" inputmode="decimal" value="${esc(L.thickness_mm)}" />
          </label>
          <label class="mat-field">ρ kg/m³
            <input data-field="density_kg_m3" inputmode="decimal" value="${esc(L.density_kg_m3)}" />
          </label>
          ${framingBlock}`;

      row.innerHTML = `
        <div class="ms-compose-layer-head">
          <span class="ms-layer-ord">${esc(String(L.layer_order))}</span>
          <label class="mat-field">Soort
            <select data-field="layer_kind">${kindOpts}</select>
          </label>
          <label class="mat-field mat-field-grow">Label
            <input data-field="label" value="${esc(L.label)}" maxlength="120" />
          </label>
          <button type="button" class="secondary danger ms-compose-remove" title="Verwijder laag">×</button>
        </div>
        <div class="ms-compose-layer-body">
          ${bodyFields}
        </div>`;

      const kindSel = row.querySelector('[data-field="layer_kind"]') as HTMLSelectElement;
      kindSel.addEventListener("change", () => {
        L.layer_kind = kindSel.value;
        const meta = LAYER_KINDS.find((k) => k.value === L.layer_kind);
        if (meta) L.acoustic_role = meta.role;
        if (L.layer_kind === "cavity_ventilated") {
          L.material_id = "";
          L.material_label = "";
          L.density_kg_m3 = "";
          if (!L.cavity_depth_mm && L.thickness_mm) L.cavity_depth_mm = L.thickness_mm;
          L.thickness_mm = "";
          L.acoustic_role = "cavity";
        }
        if (L.layer_kind === "framing") {
          if (!L.stud_width_mm) L.stud_width_mm = "38";
          if (!L.stud_depth_mm) L.stud_depth_mm = L.thickness_mm || "30";
          if (!L.stud_spacing_mm) L.stud_spacing_mm = "600";
          if (!L.density_kg_m3) L.density_kg_m3 = "450";
          if (!L.thickness_mm) L.thickness_mm = L.stud_depth_mm;
        }
        renderComposeLayers();
      });
      const labelInp = row.querySelector('[data-field="label"]') as HTMLInputElement;
      labelInp.addEventListener("input", () => {
        L.label = labelInp.value;
      });
      for (const field of [
        "thickness_mm",
        "density_kg_m3",
        "cavity_depth_mm",
        "stud_width_mm",
        "stud_depth_mm",
        "stud_spacing_mm",
      ] as const) {
        const inp = row.querySelector(`[data-field="${field}"]`) as HTMLInputElement | null;
        if (!inp) continue;
        inp.addEventListener("input", () => {
          L[field] = inp.value;
          if (field === "cavity_depth_mm" && L.layer_kind === "cavity_ventilated") {
            // Physics gebruikt cavity_depth_mm || thickness_mm — houd beide synchroon.
            L.thickness_mm = inp.value;
          }
          if (field === "stud_depth_mm" && L.layer_kind === "framing") {
            L.thickness_mm = inp.value;
            const th = row.querySelector('[data-field="thickness_mm"]') as HTMLInputElement | null;
            if (th) th.value = inp.value;
          }
          const calcEl = row.querySelector(".ms-wood-calc");
          if (calcEl && L.layer_kind === "framing") {
            calcEl.outerHTML = framingMetricsHtml(L);
          }
        });
      }

      const removeBtn = row.querySelector(".ms-compose-remove") as HTMLButtonElement;
      removeBtn.addEventListener("click", () => {
        if (composeLayers.length <= 1) return;
        composeLayers.splice(idx, 1);
        renderComposeLayers();
      });

      if (!isCavity) {
        const qInp = row.querySelector('[data-field="mat_q"]') as HTMLInputElement | null;
        const hitsEl = row.querySelector("[data-hits]") as HTMLElement | null;
        const pickedEl = row.querySelector(".ms-mat-picked") as HTMLElement | null;
        if (qInp && hitsEl && pickedEl) {
          let searchTimer: ReturnType<typeof setTimeout> | null = null;
          qInp.addEventListener("input", () => {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
              void searchMaterials(qInp.value.trim(), hitsEl, L, pickedEl, qInp);
            }, 280);
          });
          qInp.addEventListener("focus", () => {
            const q = qInp.value.trim();
            if (q.length >= 2 && hitsEl.hidden) {
              void searchMaterials(q, hitsEl, L, pickedEl, qInp);
            }
          });
        }
      }

      composeLayersEl.appendChild(row);
    });
  }

  async function searchMaterials(
    q: string,
    hitsEl: HTMLElement,
    layer: ComposeLayerState,
    pickedEl: HTMLElement,
    qInp: HTMLInputElement,
  ): Promise<void> {
    if (q.length < 2) {
      hitsEl.hidden = true;
      hitsEl.innerHTML = "";
      return;
    }
    try {
      const data = await apiGet<{ materials: HomogeneousHit[] }>(
        `/api/materials-studio/material-search?q=${encodeURIComponent(q)}&limit=12`,
      );
      const mats = data.materials || [];
      if (!mats.length) {
        hitsEl.hidden = false;
        hitsEl.innerHTML = `<p class="ms-mat-hits-meta">Geen treffers voor «${esc(q)}» (enkellaags).</p>`;
        return;
      }
      hitsEl.hidden = false;
      const n = mats.length;
      hitsEl.innerHTML =
        `<p class="ms-mat-hits-meta">${esc(String(n))} treffer${n === 1 ? "" : "s"} voor «${esc(q)}» — klik om te kiezen</p>` +
        mats
          .map((m) => {
            const bits: string[] = [];
            if (m.thickness_mm != null) bits.push(`${m.thickness_mm} mm`);
            if (m.rw_db != null) bits.push(`Rw ${m.rw_db}`);
            if (m.ra_dba != null) bits.push(`RA ${m.ra_dba}`);
            const meta = bits.length ? ` <span class="ms-mat-hit-meta">${esc(bits.join(" · "))}</span>` : "";
            return `<button type="button" class="ms-mat-hit" role="option" data-id="${esc(m.material_id)}" title="${esc(m.catalog_id)} · ${esc(m.name)}">
            <span class="ms-mat-hit-id">${esc(m.catalog_id || "—")}</span>${esc(m.name || "(zonder naam)")}${meta}
          </button>`;
          })
          .join("");
      hitsEl.querySelectorAll<HTMLButtonElement>(".ms-mat-hit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id || "";
          const m = mats.find((x) => x.material_id === id);
          if (!m) return;
          layer.material_id = m.material_id;
          layer.material_label = `${m.catalog_id} · ${m.name}`;
          if (m.thickness_mm != null && !layer.thickness_mm) {
            layer.thickness_mm = String(m.thickness_mm);
          }
          if (m.density_kg_m3 != null && !layer.density_kg_m3) {
            layer.density_kg_m3 = String(Math.round(Number(m.density_kg_m3)));
          }
          qInp.value = layer.material_label;
          pickedEl.innerHTML = `Gekozen: <strong>${esc(layer.material_label)}</strong>
            <button type="button" class="secondary ms-mat-clear">Wissen</button>`;
          pickedEl.querySelector(".ms-mat-clear")?.addEventListener("click", () => {
            layer.material_id = "";
            layer.material_label = "";
            qInp.value = "";
            pickedEl.textContent =
              "Nog geen materiaal — typ minstens 2 tekens om te zoeken, klik een treffer.";
            hitsEl.hidden = true;
            hitsEl.innerHTML = "";
          });
          hitsEl.hidden = true;
          hitsEl.innerHTML = "";
          // Update dikte/ρ-velden zonder hele rij te hertekenen (zoekveld blijft intact).
          const row = qInp.closest(".ms-compose-layer");
          const th = row?.querySelector('[data-field="thickness_mm"]') as HTMLInputElement | null;
          const dens = row?.querySelector('[data-field="density_kg_m3"]') as HTMLInputElement | null;
          if (th && layer.thickness_mm) th.value = layer.thickness_mm;
          if (dens && layer.density_kg_m3) dens.value = layer.density_kg_m3;
        });
      });
    } catch (err) {
      hitsEl.hidden = false;
      hitsEl.innerHTML = `<p class="hint">${esc(err instanceof Error ? err.message : "zoeken mislukt")}</p>`;
    }
  }

  function layersPayload() {
    return composeLayers.map((L) => {
      const isCavity = L.layer_kind === "cavity_ventilated";
      const cavityMm = (L.cavity_depth_mm || L.thickness_mm).trim() || null;
      return {
        layer_order: L.layer_order,
        layer_kind: L.layer_kind,
        label: L.label,
        acoustic_role: isCavity
          ? "cavity"
          : LAYER_KINDS.find((k) => k.value === L.layer_kind)?.role || L.acoustic_role || "structural",
        thickness_mm: isCavity ? cavityMm : L.thickness_mm.trim() || null,
        density_kg_m3: isCavity ? null : L.density_kg_m3.trim() || null,
        cavity_depth_mm: isCavity ? cavityMm : L.cavity_depth_mm.trim() || null,
        stud_width_mm: L.stud_width_mm.trim() || null,
        stud_depth_mm: L.stud_depth_mm.trim() || null,
        stud_spacing_mm: L.stud_spacing_mm.trim() || null,
        material_id: isCavity ? null : L.material_id || null,
      };
    });
  }

  function renderPreview(preview: ComposePreview): void {
    lastPreview = preview;
    composeResultEl.classList.remove("hidden");
    composeLayerTbody.innerHTML = preview.layers
      .map((L) => {
        const spec = L.spectrum;
        const mat = L.catalog_id
          ? `${L.catalog_id}${L.material_name ? ` · ${L.material_name}` : ""}`
          : "—";
        const methodLabel =
          L.method === "catalog"
            ? "catalogus"
            : L.method === "mass_law"
              ? "massawet"
              : L.method === "wood_grid"
                ? "regelwerk φ"
                : "—";
        return `<tr>
          <td>${esc(String(L.layer_order))}</td>
          <td>${esc(L.label)}</td>
          <td>${esc(mat)}</td>
          <td>${esc(methodLabel)}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 125)))}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 250)))}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 500)))}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 1000)))}</td>
          <td class="num">${esc(fmtNum(specBand(spec, 2000)))}</td>
          <td class="num"><strong>${esc(fmtNum(L.rw_db))}</strong></td>
          <td class="num">${esc(fmtNum(L.c_db))}</td>
          <td class="num">${esc(fmtNum(L.ctr_db))}</td>
        </tr>`;
      })
      .join("");

    const st = preview.stack;
    composeStackNote.textContent = st.note || "";
    const s = st.spectrum || {};
    composeStackStats.innerHTML = [
      ["R125", s["125"]],
      ["R250", s["250"]],
      ["R500", s["500"]],
      ["R1000", s["1000"]],
      ["R2000", s["2000"]],
      ["Rw", st.rw_db],
      ["C", st.c_db],
      ["Ctr", st.ctr_db],
      ["RA≈", st.ra_dba_approx],
    ]
      .map(([k, v]) => `<dt>${esc(String(k))}</dt><dd>${esc(fmtNum(v as number | null))}</dd>`)
      .join("");
  }

  async function load(): Promise<void> {
    const data = await apiGet<{ ok: true } & Summary>("/api/materials-studio/summary");
    renderStats(data);
    renderKinds(data);
    renderRecent(data);
    renderTemplates(data);
    renderProposed(data);
    renderQc(data);
    if (!composeLayers.length && templatesCache.length) {
      // leave empty until user picks — or seed first template
    }
    syncComposeModeUi();
    if (!composeLayers.length) {
      composeLayers = [defaultLayer(1)];
      renderComposeLayers();
    }
  }

  refreshBtn.addEventListener("click", () => {
    void load().catch((err) => {
      actionOutEl.textContent = err instanceof Error ? err.message : "laden mislukt";
    });
  });

  publishBtn.addEventListener("click", async () => {
    if (!confirm("Laatste goedgekeurde spectra publiceren naar app_gevelwering.material?")) return;
    try {
      publishBtn.disabled = true;
      actionOutEl.textContent = "Publiceren…";
      const out = await apiPost<{
        linked_concepts: number;
        published_rows: number;
        published_by: string;
      }>("/api/materials-studio/publish", {});
      actionOutEl.textContent = `Gepubliceerd: ${out.published_rows} rijen (${out.linked_concepts} concept-koppelingen).`;
      await load();
    } catch (err) {
      actionOutEl.textContent = err instanceof Error ? err.message : "publiceren mislukt";
    } finally {
      publishBtn.disabled = false;
    }
  });

  refineKzBtn.addEventListener("click", async () => {
    try {
      refineKzBtn.disabled = true;
      actionOutEl.textContent = "Kalkzandsteen-patroon verfijnen…";
      const out = await apiPost<{ sample_count: number; pattern: { code: string } | null }>(
        "/api/materials-studio/refine-kalkzandsteen",
        {},
      );
      actionOutEl.textContent = `Patroon ${out.pattern?.code ?? "SP-R1-S2-KALKZANDSTEEN"} bijgewerkt (n=${out.sample_count}).`;
    } catch (err) {
      actionOutEl.textContent = err instanceof Error ? err.message : "verfijnen mislukt";
    } finally {
      refineKzBtn.disabled = false;
    }
  });

  composeModeEl.addEventListener("change", () => {
    syncComposeModeUi();
    if (composeModeEl.value === "new") {
      composeTplEl.value = "";
      composeNameEl.value = "";
      composeLayers = [defaultLayer(1), defaultLayer(2)];
      renderComposeLayers();
    }
  });

  composeTplEl.addEventListener("change", () => {
    if (composeTplEl.value) applyTemplate(composeTplEl.value);
  });

  composeAddBtn.addEventListener("click", () => {
    composeLayers.push(defaultLayer(composeLayers.length + 1));
    renderComposeLayers();
  });

  composePreviewBtn.addEventListener("click", async () => {
    try {
      composePreviewBtn.disabled = true;
      composeSaveOut.textContent = "Berekenen…";
      const preview = await apiPost<ComposePreview>("/api/materials-studio/compose-preview", {
        template_code:
          composeModeEl.value === "existing" ? composeTplEl.value || null : null,
        name: composeNameEl.value.trim() || null,
        assembly_family: composeFamilyEl.value,
        layers: layersPayload(),
      });
      renderPreview(preview);
      composeSaveOut.textContent = "Preview klaar — controleer Rw per laag en totaal.";
    } catch (err) {
      composeSaveOut.textContent = err instanceof Error ? err.message : "preview mislukt";
    } finally {
      composePreviewBtn.disabled = false;
    }
  });

  composeSaveBtn.addEventListener("click", async () => {
    if (!lastPreview) {
      composeSaveOut.textContent = "Eerst spectrum / Rw berekenen.";
      return;
    }
    if (!composeSaveTplEl.checked && !composeSaveConceptEl.checked) {
      composeSaveOut.textContent = "Vink template en/of concept aan.";
      return;
    }
    try {
      composeSaveBtn.disabled = true;
      composeSaveOut.textContent = "Opslaan…";
      const code =
        composeModeEl.value === "existing" && composeTplEl.value
          ? composeTplEl.value
          : composeModeEl.value === "new"
            ? `ASM-${composeFamilyEl.value.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
            : composeTplEl.value || null;
      const out = await apiPost<{
        template_code: string | null;
        concept_id: string | null;
        spectrum_version_id: string | null;
        status: string;
      }>("/api/materials-studio/compose-save", {
        save_template: composeSaveTplEl.checked,
        save_concept: composeSaveConceptEl.checked,
        template_code: code,
        name: composeNameEl.value.trim() || lastPreview.layers.map((l) => l.label).join(" + "),
        concept_name: composeNameEl.value.trim() || null,
        assembly_family: composeFamilyEl.value,
        layers: lastPreview.layers,
        stack_spectrum: lastPreview.stack.spectrum,
        stack_ra: lastPreview.stack.ra_dba_approx,
      });
      let msg = `Opgeslagen: template ${out.template_code || "—"} · concept ${
        out.concept_id ? "proposed" : "—"
      }.`;
      if (composePublishCatalogEl?.checked && out.concept_id) {
        composeSaveOut.textContent = "Goedkeuren & publiceren naar catalogus…";
        const pub = await approvePublishConcept(out.concept_id);
        msg += ` Catalogus ${pub.catalog_id}${pub.created ? " (nieuw)" : ""}.`;
        composeSaveOut.textContent = msg;
        await load();
        window.location.href = `/materials.html?q=${encodeURIComponent(pub.catalog_id)}`;
        return;
      }
      composeSaveOut.textContent = msg;
      await load();
    } catch (err) {
      composeSaveOut.textContent = err instanceof Error ? err.message : "opslaan mislukt";
    } finally {
      composeSaveBtn.disabled = false;
    }
  });

  return { load };
}
