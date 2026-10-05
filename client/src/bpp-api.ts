/**
 * Shared bppServer invoke helpers (phase 1–2: sections, scale, documents, regions, subsections).
 * All calls require WebSocket session + prior INCLUDE shared_building_api.basicpp.
 * Phase 2 SQL: sql/app_gevelwering_0_2_30.sql
 */

export function parseBppJson<T>(ret: string): T {
  if (ret.startsWith("ERROR")) throw new Error(ret);
  try {
    return JSON.parse(ret) as T;
  } catch {
    throw new Error(`Ongeldig JSON-antwoord van bppServer: ${ret.slice(0, 240)}`);
  }
}

export type BppInvoke = (target: string, args: unknown[]) => Promise<string>;

export function bppScaleRatioArg(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "NULL";
  return String(ratio);
}

export function bppAspectArg(aspect: number | null | undefined): string {
  if (aspect == null || !Number.isFinite(aspect) || aspect <= 0) return "NULL";
  return String(aspect);
}

export type BppFloormapSection = {
  id: string;
  document_id: string;
  page_index: number;
  label: string;
  region_kind: string;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
  scale_ratio: number | null;
  metres_per_norm_unit: number | null;
  scale_aspect_yx: number | null;
  scale_source: string;
  room_count: number;
};

export async function bppListFloormapSections(
  invoke: BppInvoke,
  token: string,
  buildingId: string,
): Promise<{ sections: BppFloormapSection[] }> {
  const ret = await invoke("API_ListFloormapSections", [token, buildingId]);
  const data = parseBppJson<{ sections?: BppFloormapSection[] }>(ret);
  return { sections: data.sections || [] };
}

export async function bppSaveFloormapScale(
  invoke: BppInvoke,
  token: string,
  opts: {
    section_id: string;
    metres_per_norm_unit: number;
    scale_ratio?: number | null;
    scale_source: string;
    scale_aspect_yx?: number | null;
  },
): Promise<{
  ok?: boolean;
  section_id?: string;
  metres_per_norm_unit?: number;
  scale_aspect_yx?: number;
  subsections?: number;
  verblijfsruimten_vloer?: number;
  vlakken?: number;
  ga_cleared?: number;
}> {
  const ret = await invoke("API_SaveFloormapScale", [
    token,
    opts.section_id,
    String(opts.metres_per_norm_unit),
    bppScaleRatioArg(opts.scale_ratio),
    opts.scale_source || "CALIBRATED",
    bppAspectArg(opts.scale_aspect_yx),
  ]);
  return parseBppJson(ret);
}

export type BppProjectDocument = {
  id: string;
  filename: string;
  file_ext: string;
  byte_size: string | number;
  created_at?: string;
};

export async function bppListProjectDocuments(
  invoke: BppInvoke,
  token: string,
  buildingId: string,
): Promise<{ documents: BppProjectDocument[] }> {
  const ret = await invoke("API_ListProjectDocuments", [token, buildingId]);
  const data = parseBppJson<{ documents?: BppProjectDocument[] }>(ret);
  return { documents: data.documents || [] };
}

export async function bppDeleteDrawingRegion(
  invoke: BppInvoke,
  token: string,
  regionId: string,
): Promise<void> {
  const ret = await invoke("API_DeleteDrawingRegion", [token, regionId]);
  parseBppJson<{ ok?: boolean }>(ret);
}

/** localStorage `GEVELWERING_BPP_HTTP=1` restores HTTP for bpp-migrated endpoints (rollback). */
export function bppPhase1Enabled(): boolean {
  try {
    return localStorage.getItem("GEVELWERING_BPP_HTTP") !== "1";
  } catch {
    return true;
  }
}

export type BppDrawingSubsection = {
  id: string;
  section_id: string;
  label: string;
  level_hint: string;
  vg_nr?: number | null;
  vr_nr?: string | null;
  geom_kind?: string;
  points: unknown;
  area_norm?: number | null;
  perimeter_norm?: number | null;
  area_m2?: number | null;
  perimeter_m?: number | null;
  metres_per_norm_unit?: number | null;
  analysis_status?: string;
  analysis?: Record<string, unknown> | null;
  sort_order?: number;
  region_mpu?: number | null;
  region_aspect_yx?: number | null;
};

export type BppSaveSubsectionResult = {
  subsection_id: string;
  vg_nr?: number | null;
  vr_nr?: string | null;
  area_norm?: number;
  perimeter_norm?: number;
  area_m2?: number | null;
  perimeter_m?: number | null;
  metres_per_norm_unit?: number | null;
  analysis?: Record<string, unknown>;
};

export async function bppListDrawingSubsections(
  invoke: BppInvoke,
  token: string,
  sectionId: string,
): Promise<{ subsections: BppDrawingSubsection[] }> {
  const ret = await invoke("API_ListDrawingSubsections", [token, sectionId]);
  const data = parseBppJson<{ subsections?: BppDrawingSubsection[] }>(ret);
  return { subsections: data.subsections || [] };
}

export async function bppGetFloormapSection(
  invoke: BppInvoke,
  token: string,
  sectionId: string,
): Promise<{ section: BppFloormapSection }> {
  const ret = await invoke("API_GetFloormapSection", [token, sectionId]);
  const data = parseBppJson<{ section: BppFloormapSection }>(ret);
  if (!data.section?.id) throw new Error("scalable section not found");
  return { section: data.section };
}

export async function bppSaveDrawingSubsection(
  invoke: BppInvoke,
  token: string,
  body: Record<string, unknown>,
): Promise<BppSaveSubsectionResult> {
  const ret = await invoke("API_SaveDrawingSubsection", [token, JSON.stringify(body)]);
  const data = parseBppJson<BppSaveSubsectionResult & { ok?: boolean }>(ret);
  if (!data.subsection_id) throw new Error("save subsection: geen subsection_id");
  return data;
}

export async function bppDeleteDrawingSubsection(
  invoke: BppInvoke,
  token: string,
  subsectionId: string,
): Promise<void> {
  const ret = await invoke("API_DeleteDrawingSubsection", [token, subsectionId]);
  const data = parseBppJson<{ ok?: boolean; error?: string }>(ret);
  if (data.ok === false) {
    throw new Error(data.error || "Verwijderen mislukt");
  }
}

export async function bppReorderDrawingSubsections(
  invoke: BppInvoke,
  token: string,
  sectionId: string,
  orderedIds: string[],
): Promise<void> {
  const ret = await invoke("API_ReorderDrawingSubsections", [
    token,
    sectionId,
    orderedIds.join(","),
  ]);
  parseBppJson<{ ok?: boolean }>(ret);
}

export type BppVrFacadeConstituent = {
  id: string;
  sign: string;
  label: string;
  catalog_id?: string | null;
  material_name?: string | null;
  area_m2?: number | null;
  is_result?: boolean;
};

export type BppVrFacadeComponent = {
  id: string;
  section_id?: string;
  region_kind?: string;
  section_label?: string;
  label: string;
  vg_nr?: number | null;
  vr_nr?: string | null;
  area_m2?: number | null;
  quantity_kind?: string;
  length_m?: number | null;
  repeat_count?: number | null;
  ga_ready?: boolean;
  material_id?: string | null;
  catalog_id?: string | null;
  master_category?: string | null;
  material_name?: string | null;
  ra_dba?: number | null;
  boolean_op?: string | null;
  orientatie?: string | null;
  from_seal?: boolean;
  source_subsection_id?: string | null;
  constituents?: BppVrFacadeConstituent[];
};

export type BppVrFacadeComponentsResult = {
  building_id: string;
  vr_nr: string;
  eligible: BppVrFacadeComponent[];
  excluded_as_source?: Array<{
    id: string;
    label?: string;
    vr_nr?: string | null;
    area_m2?: number | null;
  }>;
  counts?: {
    for_vr?: number;
    eligible?: number;
    ga_ready?: number;
    excluded_as_source?: number;
  };
  material_id_healed?: number;
};

export async function bppListVrFacadeComponents(
  invoke: BppInvoke,
  token: string,
  buildingId: string,
  vrNr: string,
): Promise<BppVrFacadeComponentsResult> {
  const ret = await invoke("API_ListVrFacadeComponents", [token, buildingId, vrNr]);
  const data = parseBppJson<BppVrFacadeComponentsResult>(ret);
  return {
    ...data,
    eligible: data.eligible || [],
  };
}

/** Phase 4 — materials / favorites / subsection-material */

export type BppCatalogMaterial = {
  material_id: string;
  catalog_id?: string;
  material_no?: number;
  rubriek_nr?: number | null;
  subrubriek_nr?: number | null;
  master_category?: string;
  name?: string;
  category?: string;
  source?: string;
  thickness_mm?: number | null;
  ra_dba?: number | null;
  r_125_hz?: number | null;
  r_250_hz?: number | null;
  r_500_hz?: number | null;
  r_1000_hz?: number | null;
  r_2000_hz?: number | null;
  sort_order?: number;
};

export type BppMaterialCategory = {
  rubriek_nr: number | null;
  master_category: string;
  label: string;
  material_count: number;
  subrubrieken: Array<{ subrubriek_nr: number; category: string; label: string }>;
};

export async function bppListMaterialCategories(
  invoke: BppInvoke,
  token: string,
): Promise<{ categories: BppMaterialCategory[] }> {
  const ret = await invoke("API_ListMaterialCategories", [token]);
  const data = parseBppJson<{ categories?: BppMaterialCategory[] }>(ret);
  return { categories: data.categories || [] };
}

export async function bppListMaterials(
  invoke: BppInvoke,
  token: string,
  opts: { master_category?: string; category?: string; q?: string; limit?: number },
): Promise<{ materials: BppCatalogMaterial[]; master_category?: string | null; rubriek_nr?: number | null }> {
  const ret = await invoke("API_ListMaterials", [
    token,
    opts.master_category || "",
    opts.category || "",
    opts.q || "",
    String(opts.limit ?? 800),
  ]);
  const data = parseBppJson<{
    materials?: BppCatalogMaterial[];
    master_category?: string | null;
    rubriek_nr?: number | null;
  }>(ret);
  return {
    materials: data.materials || [],
    master_category: data.master_category,
    rubriek_nr: data.rubriek_nr,
  };
}

export async function bppCreateMaterial(
  invoke: BppInvoke,
  token: string,
  body: Record<string, unknown>,
): Promise<{ material: BppCatalogMaterial; assigned?: boolean; subsection_id?: string | null }> {
  const ret = await invoke("API_CreateMaterial", [token, JSON.stringify(body)]);
  return parseBppJson(ret);
}

export async function bppListMaterialAlternatives(
  invoke: BppInvoke,
  token: string,
  materialId: string,
  limit = 6,
): Promise<{
  alternatives: Array<{
    material_id: string;
    catalog_id?: string;
    name?: string;
    ra_dba?: number;
    delta_ra: number;
    thickness_mm?: number | null;
    rubriek_nr?: number | null;
    subrubriek_nr?: number | null;
    master_category?: string;
    category?: string;
  }>;
  reason?: string;
}> {
  const ret = await invoke("API_ListMaterialAlternatives", [token, materialId, String(limit)]);
  const data = parseBppJson<{
    alternatives?: Array<{
      material_id: string;
      catalog_id?: string;
      name?: string;
      ra_dba?: number;
      delta_ra: number;
      thickness_mm?: number | null;
      rubriek_nr?: number | null;
      subrubriek_nr?: number | null;
      master_category?: string;
      category?: string;
    }>;
    reason?: string;
  }>(ret);
  return { alternatives: data.alternatives || [], reason: data.reason };
}

export async function bppSaveSubsectionMaterial(
  invoke: BppInvoke,
  token: string,
  subsectionId: string,
  materialId: string,
): Promise<{
  material?: {
    material_id?: string;
    catalog_id?: string | null;
    name?: string | null;
    ra_dba?: number | null;
    master_category?: string | null;
    category?: string | null;
  };
}> {
  const ret = await invoke("API_SaveSubsectionMaterial", [token, subsectionId, materialId]);
  return parseBppJson(ret);
}

export async function bppListMaterialFavorites(
  invoke: BppInvoke,
  token: string,
  buildingId: string,
): Promise<{ materials: BppCatalogMaterial[] }> {
  const ret = await invoke("API_ListMaterialFavorites", [token, buildingId]);
  const data = parseBppJson<{ materials?: BppCatalogMaterial[] }>(ret);
  return { materials: data.materials || [] };
}

export async function bppAddMaterialFavorite(
  invoke: BppInvoke,
  token: string,
  buildingId: string,
  materialId: string,
): Promise<void> {
  const ret = await invoke("API_AddMaterialFavorite", [token, buildingId, materialId]);
  parseBppJson<{ ok?: boolean }>(ret);
}

export async function bppRemoveMaterialFavorite(
  invoke: BppInvoke,
  token: string,
  buildingId: string,
  materialId: string,
): Promise<void> {
  const ret = await invoke("API_RemoveMaterialFavorite", [token, buildingId, materialId]);
  parseBppJson<{ ok?: boolean }>(ret);
}

export type BppFavoritePreset = {
  preset_id: string;
  name: string;
  material_count: number;
  created_at?: string;
  updated_at?: string;
};

export async function bppListMaterialFavoritePresets(
  invoke: BppInvoke,
  token: string,
): Promise<{ presets: BppFavoritePreset[] }> {
  const ret = await invoke("API_ListMaterialFavoritePresets", [token]);
  const data = parseBppJson<{ presets?: BppFavoritePreset[] }>(ret);
  return { presets: data.presets || [] };
}

export async function bppMaterialFavoritePresetAction(
  invoke: BppInvoke,
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const ret = await invoke("API_MaterialFavoritePresetAction", [token, JSON.stringify(body)]);
  return parseBppJson(ret);
}
