/**
 * Select façade/section components for GA gevelwering for a given VR.
 *
 * Rule: include components with matching vr_nr. Exclude a component only when it
 * is an input to a boolean/set composite AND shares the same material (or
 * master_category) as that composite — e.g. raw kozijn wood is replaced by
 * (kozijn − glas), but glass panes stay selectable.
 */

const SCALABLE_NON_FLOOR = new Set(["FACADE", "SECTION", "CROSS_SECTION"]);

/**
 * @param {unknown} analysis
 * @returns {Record<string, unknown>}
 */
function asAnalysis(analysis) {
  if (analysis && typeof analysis === "object" && !Array.isArray(analysis)) {
    return /** @type {Record<string, unknown>} */ (analysis);
  }
  return {};
}

/**
 * @param {Array<{ id?: string, analysis?: unknown }>} subsections
 * @returns {Set<string>}
 */
export function collectBooleanSourceIds(subsections) {
  const ids = new Set();
  if (!Array.isArray(subsections)) return ids;
  for (const s of subsections) {
    const src = asAnalysis(s?.analysis).source_subsection_ids;
    if (!Array.isArray(src)) continue;
    for (const id of src) {
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    }
  }
  return ids;
}

/**
 * Sources superseded by a composite of the same material/category (avoid double-count).
 * Different materials (e.g. glas vs kozijnhout) are NOT superseded.
 * Geometry-only outlines (no material/category) used as boolean inputs ARE superseded
 * — e.g. outer wall «Slaapkamer 1» replaced by (muur − kozijn) metselwerk.
 *
 * @param {Array<{ id?: string, analysis?: unknown }>} subsections
 * @returns {Set<string>}
 */
export function collectSupersededSourceIds(subsections) {
  const superseded = new Set();
  if (!Array.isArray(subsections)) return superseded;
  const byId = new Map();
  for (const s of subsections) {
    if (s?.id != null) byId.set(String(s.id), s);
  }
  for (const c of subsections) {
    const ca = asAnalysis(c?.analysis);
    const src = ca.source_subsection_ids;
    if (!Array.isArray(src) || src.length < 2) continue;
    if (!ca.boolean_op) continue;
    const cMat = ca.material_id != null ? String(ca.material_id).trim() : "";
    const cCat =
      ca.master_category != null ? String(ca.master_category).trim().toLowerCase() : "";
    for (const sid of src) {
      if (typeof sid !== "string" || !sid.trim()) continue;
      const srcRow = byId.get(sid.trim());
      if (!srcRow) continue;
      const sa = asAnalysis(srcRow.analysis);
      const sMat = sa.material_id != null ? String(sa.material_id).trim() : "";
      const sCat =
        sa.master_category != null ? String(sa.master_category).trim().toLowerCase() : "";
      // Outer contours without material exist only as boolean inputs.
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

/**
 * @param {string | null | undefined} a
 * @param {string | null | undefined} b
 */
export function sameVrNr(a, b) {
  if (a == null || b == null) return false;
  const aa = String(a).trim().toLowerCase();
  const bb = String(b).trim().toLowerCase();
  return aa.length > 0 && aa === bb;
}

/**
 * Partition components belonging to one VR into GA-eligible vs superseded sources.
 *
 * @param {Array<Record<string, unknown>>} subsections  building-wide (or section) rows
 * @param {string} vrNr
 * @param {{ regionKinds?: string[] }} [opts]
 */
export function partitionVrGaComponents(subsections, vrNr, opts = {}) {
  const kinds = new Set(
    (opts.regionKinds || [...SCALABLE_NON_FLOOR]).map((k) => String(k).toUpperCase()),
  );
  const sourceIds = collectBooleanSourceIds(subsections);
  const supersededIds = collectSupersededSourceIds(subsections);
  const forVr = [];
  const eligible = [];
  const excludedAsSource = [];
  const missingVrOrKind = [];

  for (const s of subsections || []) {
    const kind = String(s.region_kind || "").toUpperCase();
    if (kinds.size && kind && !kinds.has(kind)) continue;
    if (!sameVrNr(s.vr_nr, vrNr)) continue;
    forVr.push(s);
    if (supersededIds.has(String(s.id))) {
      excludedAsSource.push(s);
      continue;
    }
    const analysis = asAnalysis(s.analysis);
    const materialId = analysis.material_id != null ? String(analysis.material_id) : null;
    eligible.push({
      ...s,
      ga_ready: Boolean(materialId),
      material_id: materialId,
      master_category: analysis.master_category != null ? String(analysis.master_category) : null,
      material_name: analysis.material_name != null ? String(analysis.material_name) : null,
    });
  }

  return {
    vr_nr: String(vrNr).trim(),
    source_subsection_ids: [...sourceIds],
    superseded_source_ids: [...supersededIds],
    for_vr_count: forVr.length,
    eligible,
    excluded_as_source: excludedAsSource,
    missing: missingVrOrKind,
  };
}
