/**
 * Kierdichting as optional attribute on a façade component (`analysis.seal`).
 * Legacy sibling rows (`seal_for_subsection_id`) are still recognized for migration.
 */

export type ComponentSeal = {
  enabled: boolean;
  material_id?: string;
  catalog_id?: string;
  material_name?: string;
  master_category?: string;
  category?: string;
  rubriek_nr?: number;
  length_m?: number | null;
};

export type SealAnalysisLike = {
  seal?: ComponentSeal | null;
  seal_for_subsection_id?: string | null;
  quantity_kind?: string | null;
  material_id?: string | null;
  catalog_id?: string | null;
  material_name?: string | null;
  master_category?: string | null;
  boolean_op?: string | null;
  length_m?: number | null;
};

export type SealMaterialLike = {
  material_id: string;
  catalog_id?: string | null;
  name?: string | null;
  master_category?: string | null;
  category?: string | null;
  rubriek_nr?: number | null;
};

export const KIER_SEAL_STROKE = "#e65100";
export const KIER_SEAL_STROKE_SELECTED = "#ff9800";
export const KIER_SEAL_STROKE_TOUCHED = "#f57c00";

export function readComponentSeal(analysis?: SealAnalysisLike | null): ComponentSeal | null {
  const raw = analysis?.seal;
  if (!raw || typeof raw !== "object") return null;
  return {
    enabled: Boolean(raw.enabled),
    material_id: raw.material_id != null ? String(raw.material_id) : undefined,
    catalog_id: raw.catalog_id != null ? String(raw.catalog_id) : undefined,
    material_name: raw.material_name != null ? String(raw.material_name) : undefined,
    master_category: raw.master_category != null ? String(raw.master_category) : undefined,
    category: raw.category != null ? String(raw.category) : undefined,
    rubriek_nr: raw.rubriek_nr != null ? Number(raw.rubriek_nr) : undefined,
    length_m:
      raw.length_m != null && Number.isFinite(Number(raw.length_m)) ? Number(raw.length_m) : null,
  };
}

/** Seal kenmerk aan (nieuwe model). */
export function componentSealEnabled(analysis?: SealAnalysisLike | null): boolean {
  const s = readComponentSeal(analysis);
  return Boolean(s?.enabled);
}

/** Legacy aparte kier-subsection (sibling). */
export function isLegacySealSibling(analysis?: SealAnalysisLike | null): boolean {
  return Boolean((analysis?.seal_for_subsection_id || "").toString().trim());
}

export function sealCatalogLabel(
  analysis?: SealAnalysisLike | null,
  fallback = "D02408",
): string {
  const s = readComponentSeal(analysis);
  if (s?.enabled && (s.catalog_id || "").trim()) return String(s.catalog_id).trim();
  if (isLegacySealSibling(analysis) && (analysis?.catalog_id || "").trim()) {
    return String(analysis!.catalog_id).trim();
  }
  return fallback;
}

export function buildSealPayload(
  mat: SealMaterialLike,
  lengthM: number | null,
  enabled = true,
): ComponentSeal {
  return {
    enabled,
    material_id: mat.material_id,
    catalog_id: mat.catalog_id || undefined,
    material_name: mat.name || undefined,
    master_category: mat.master_category || undefined,
    category: mat.category || undefined,
    rubriek_nr: mat.rubriek_nr ?? 9,
    length_m: lengthM != null && Number.isFinite(lengthM) ? lengthM : null,
  };
}

export function clearSealPayload(): ComponentSeal {
  return { enabled: false };
}

/** Merge seal into analysis; strips legacy seal_for when writing attribute seal. */
export function mergeAnalysisWithSeal(
  prev: SealAnalysisLike | null | undefined,
  seal: ComponentSeal | null,
): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" ? ({ ...prev } as Record<string, unknown>) : {};
  delete base.seal_for_subsection_id;
  if (!seal || !seal.enabled) {
    delete base.seal;
    return base;
  }
  base.seal = { ...seal, enabled: true };
  return base;
}

export function sealMaterialKeyFromSeal(seal?: ComponentSeal | null): string {
  if (!seal) return "";
  if ((seal.material_id || "").trim()) return `id:${String(seal.material_id).trim()}`;
  if ((seal.catalog_id || "").trim()) return `cat:${String(seal.catalog_id).trim().toUpperCase()}`;
  return "";
}
