export type OrientationVlakLike = {
  vlak_id: string;
  orientatie?: string | null;
  facade_subsection_id: string | null;
  /** Area vs seal/kier length — needed to resolve uuid vs uuid#seal. */
  quantity_kind?: "area" | "length" | string | null;
};

export type OrientationFacadeLike = {
  id: string;
  orientatie?: string | null;
  analysis?: { orientatie?: string | null } | null;
  quantity_kind?: "area" | "length" | string | null;
  from_seal?: boolean;
  source_subsection_id?: string | null;
};

export type FacadePickGroupLike = {
  primaryId?: string;
  memberIds?: string[];
  members: Array<{
    catalog_id: string | null;
    material_name: string | null;
    orientatie?: string | null;
    analysis?: { orientatie?: string | null } | null;
  }>;
  quantity_kind: "area" | "length";
  area_m2: number | null;
  length_m: number | null;
  label: string;
  ga_ready: boolean;
  used?: boolean;
  materialKey?: string | null;
  orientatie?: string | null;
};

export const ORIENTATIE_ALL = ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"] as const;

export const ORIENTATIE_LABELS: Record<string, string> = {
  N: "N · noord",
  NO: "NO · noordoost",
  O: "O · oost",
  ZO: "ZO · zuidoost",
  Z: "Z · zuid",
  ZW: "ZW · zuidwest",
  W: "W · west",
  NW: "NW · noordwest",
};

export function normalizeOrientatie(ori: string | null | undefined): string {
  return String(ori || "")
    .trim()
    .toUpperCase();
}

export function facadeOrientatie(f: OrientationFacadeLike): string {
  const fromTop = normalizeOrientatie(f.orientatie);
  if (fromTop) return fromTop;
  return normalizeOrientatie(f.analysis?.orientatie);
}

/**
 * Resolve the pick façade for a vlak.
 * Seal/kier vlakken store the parent subsection uuid (FK), not `uuid#seal` —
 * without this, area materials (e.g. glas) look "already used" for that ori.
 */
export function resolveFacadeForOrientationVlak<
  T extends OrientationVlakLike,
  F extends OrientationFacadeLike,
>(v: T, vrFacades: F[]): F | null {
  const sid = (v.facade_subsection_id || "").trim();
  if (!sid) return null;
  const wantLen = v.quantity_kind === "length";
  if (wantLen) {
    return (
      vrFacades.find((f) => {
        const id = String(f.id || "").trim();
        const isSeal =
          Boolean(f.from_seal) || id.endsWith("#seal") || f.quantity_kind === "length";
        if (!isSeal) return false;
        const src = (f.source_subsection_id || "").trim();
        if (src && src === sid) return true;
        if (id === sid) return true;
        if (id.endsWith("#seal") && id.slice(0, -5) === sid) return true;
        return false;
      }) || null
    );
  }
  return (
    vrFacades.find((f) => {
      const id = String(f.id || "").trim();
      if (Boolean(f.from_seal) || id.endsWith("#seal") || f.quantity_kind === "length") {
        return false;
      }
      return id === sid;
    }) ||
    vrFacades.find((f) => f.id === sid) ||
    null
  );
}

/** When wantOri is set, only facades with the same component orientatie match. */
export function facadeMatchesOrientatie(f: OrientationFacadeLike, wantOri: string | null | undefined): boolean {
  const want = normalizeOrientatie(wantOri);
  if (!want) return true;
  const got = facadeOrientatie(f);
  return got === want;
}

export function groupOrientatie(g: FacadePickGroupLike): string {
  const fromGroup = normalizeOrientatie(g.orientatie);
  if (fromGroup) return fromGroup;
  for (const m of g.members) {
    const o = facadeOrientatie(m);
    if (o) return o;
  }
  return "";
}

export function presentVlakOrientaties<T extends OrientationVlakLike>(vlakken: T[]): Set<string> {
  const s = new Set<string>();
  for (const v of vlakken) {
    const o = normalizeOrientatie(v.orientatie);
    if (o) s.add(o);
  }
  return s;
}

export function missingOrientations(expected: string[], present: Set<string>): string[] {
  return expected.filter((o) => !present.has(o));
}

export function orientatieTakenOnVr<T extends OrientationVlakLike>(
  vlakken: T[],
  ori: string | null | undefined,
  exceptVlakId?: string | null,
): T | null {
  const wantOri = normalizeOrientatie(ori);
  if (!wantOri) return null;
  for (const v of vlakken) {
    if (exceptVlakId && v.vlak_id === exceptVlakId) continue;
    if (normalizeOrientatie(v.orientatie) === wantOri) return v;
  }
  return null;
}

export function materialOrientatieTaken<T extends OrientationVlakLike, F extends OrientationFacadeLike>(
  vlakken: T[],
  vrFacades: F[],
  materialGroupKey: (facade: F) => string | null,
  matKey: string,
  ori: string,
  exceptVlakId?: string | null,
): T | null {
  const wantOri = normalizeOrientatie(ori);
  for (const v of vlakken) {
    if (exceptVlakId && v.vlak_id === exceptVlakId) continue;
    const f = resolveFacadeForOrientationVlak(v, vrFacades);
    if (!f) continue;
    if (materialGroupKey(f) !== matKey) continue;
    if (normalizeOrientatie(v.orientatie) === wantOri) return v;
  }
  return null;
}

export function defaultOrientatieForMaterial<T extends OrientationVlakLike, F extends OrientationFacadeLike>(
  expected: string[],
  vlakken: T[],
  vrFacades: F[],
  materialGroupKey: (facade: F) => string | null,
  matKey: string | null | undefined,
  exceptVlakId?: string | null,
): string {
  if (!expected.length) return "";
  if (!matKey) return expected[0];
  for (const c of expected) {
    if (!materialOrientatieTaken(vlakken, vrFacades, materialGroupKey, matKey, c, exceptVlakId)) return c;
  }
  return "";
}

export function resolveOrientatieForNewVlak<T extends OrientationVlakLike, F extends OrientationFacadeLike>(
  expected: string[],
  currentOri: string | null | undefined,
  vlakken: T[],
  vrFacades: F[],
  materialGroupKey: (facade: F) => string | null,
  matKey: string | null | undefined,
  exceptVlakId?: string | null,
): string {
  const cur = normalizeOrientatie(currentOri);
  if (cur && expected.includes(cur)) {
    if (!matKey || !materialOrientatieTaken(vlakken, vrFacades, materialGroupKey, matKey, cur, exceptVlakId)) {
      return cur;
    }
  }
  return defaultOrientatieForMaterial(expected, vlakken, vrFacades, materialGroupKey, matKey, exceptVlakId);
}

export function materialHasFreeOrientatie<T extends OrientationVlakLike, F extends OrientationFacadeLike>(
  expected: string[],
  vlakken: T[],
  vrFacades: F[],
  materialGroupKey: (facade: F) => string | null,
  matKey: string | null | undefined,
  exceptVlakId?: string | null,
): boolean {
  if (!matKey) return expected.length > 0;
  return Boolean(defaultOrientatieForMaterial(expected, vlakken, vrFacades, materialGroupKey, matKey, exceptVlakId));
}

export function orisUsedForMaterial<T extends OrientationVlakLike, F extends OrientationFacadeLike>(
  vlakken: T[],
  vrFacades: F[],
  materialGroupKey: (facade: F) => string | null,
  matKey: string,
  exceptVlakId?: string | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of vlakken) {
    if (exceptVlakId && v.vlak_id === exceptVlakId) continue;
    const f = resolveFacadeForOrientationVlak(v, vrFacades);
    if (!f || materialGroupKey(f) !== matKey) continue;
    const o = normalizeOrientatie(v.orientatie);
    const label = o || "(geen)";
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

export function formatFacadeGroupOption(g: FacadePickGroupLike): string {
  const f = g.members[0];
  const code = (f.catalog_id || "").trim() || null;
  const name = (f.material_name || "").trim() || null;
  let base =
    code && name
      ? `${code} · ${name}`
      : code || name || (!g.ga_ready ? g.label?.trim() || "geen materiaal" : g.label?.trim() || "(zonder label)");
  const ori = groupOrientatie(g);
  if (ori) base += ` · ${ori}`;
  const n = g.members.length;
  if (n > 1) base += ` (${n}× opgeteld)`;
  if (g.quantity_kind === "length") {
    if (!/kier/i.test(base)) base += " · kierdichting";
    if (g.length_m != null) base += ` · l=${Number(g.length_m).toFixed(2)} m`;
  } else if (g.area_m2 != null) {
    base += ` · S=${Number(g.area_m2).toFixed(2)} m²`;
  }
  return base;
}
