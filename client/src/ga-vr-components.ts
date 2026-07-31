/**
 * Client-side helpers: which façade components count for GA gevelwering per VR.
 * Mirrors lib/ga-vr-components.mjs — keep rules in sync.
 */

export type GaAnalysis = {
  material_id?: string | number | null;
  master_category?: string | null;
  material_name?: string | null;
  source_subsection_ids?: string[] | null;
  boolean_op?: string | null;
};

export type GaComponentLike = {
  id: string;
  vr_nr?: string | null;
  analysis?: GaAnalysis | null;
};

function asAnalysis(analysis?: GaAnalysis | null): GaAnalysis {
  return analysis && typeof analysis === "object" ? analysis : {};
}

export function collectBooleanSourceIds(subsections: GaComponentLike[]): Set<string> {
  const ids = new Set<string>();
  for (const s of subsections) {
    const src = asAnalysis(s.analysis).source_subsection_ids;
    if (!Array.isArray(src)) continue;
    for (const id of src) {
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    }
  }
  return ids;
}

/**
 * Sources replaced by a same-material composite (e.g. raw kozijn when
 * kozijn−glas exists). Different materials (glas) stay eligible.
 * Geometry-only outlines (no material/category) used as boolean inputs are
 * also superseded — e.g. outer wall «Slaapkamer 1» → (muur − kozijn).
 */
export function collectSupersededSourceIds(subsections: GaComponentLike[]): Set<string> {
  const superseded = new Set<string>();
  const byId = new Map(subsections.map((s) => [s.id, s]));
  for (const c of subsections) {
    const ca = asAnalysis(c.analysis);
    const src = ca.source_subsection_ids;
    if (!Array.isArray(src) || src.length < 2 || !ca.boolean_op) continue;
    // compose | difference | legacy ∩∪ — same supersession rules
    const cMat = ca.material_id != null ? String(ca.material_id).trim() : "";
    const cCat = ca.master_category != null ? String(ca.master_category).trim().toLowerCase() : "";
    for (const sid of src) {
      if (typeof sid !== "string" || !sid.trim()) continue;
      const srcRow = byId.get(sid.trim());
      if (!srcRow) continue;
      const sa = asAnalysis(srcRow.analysis);
      const sMat = sa.material_id != null ? String(sa.material_id).trim() : "";
      const sCat = sa.master_category != null ? String(sa.master_category).trim().toLowerCase() : "";
      if (!sMat && !sCat) {
        superseded.add(sid.trim());
        continue;
      }
      if (cMat && sMat && cMat === sMat) {
        superseded.add(sid.trim());
        continue;
      }
      if (cCat && sCat && cCat === sCat) {
        superseded.add(sid.trim());
      }
    }
  }
  return superseded;
}

/** @deprecated Prefer collectSupersededSourceIds for GA eligibility. */
export function isBooleanSourceComponent(
  id: string,
  subsections: GaComponentLike[],
): boolean {
  return collectBooleanSourceIds(subsections).has(id);
}

/**
 * Eligible for GA insulation for a VR: matching vr_nr and not superseded
 * by a same-material composite.
 */
export function isGaEligibleForVr(
  component: GaComponentLike,
  vrNr: string | null | undefined,
  supersededIds: Set<string>,
): { eligible: boolean; ga_ready: boolean; reason?: string } {
  if (!vrNr || !component.vr_nr) {
    return { eligible: false, ga_ready: false, reason: "geen VR" };
  }
  if (String(component.vr_nr).trim().toLowerCase() !== String(vrNr).trim().toLowerCase()) {
    return { eligible: false, ga_ready: false, reason: "andere VR" };
  }
  if (supersededIds.has(component.id)) {
    return { eligible: false, ga_ready: false, reason: "vervangen door setbewerking (zelfde materiaal)" };
  }
  const mat = component.analysis?.material_id;
  const ga_ready = mat != null && String(mat).length > 0;
  return { eligible: true, ga_ready, reason: ga_ready ? undefined : "geen materiaal" };
}
