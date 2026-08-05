/**
 * GA / GA;k / Lbi rekenkern (NPR 5272 / NEN 5077, afgestemd op DGMR Geluidwering gevels).
 *
 * Elementen van één VR worden als één gevelvlak gecombineerd (plattegrond-componenten).
 *
 *   RAs_i = RA_i + 10·log10(S / Q_i)     Q = m² of m (kier)
 *   R'    = −10·log10(Σ 10^(−RAs_i/10))
 *   Ruimte = 10·log10(V / (6·T·S))
 *   D2m,nT = R' + Cg + Ruimte + CL
 *   GA     = D2m,nT − Cr                  Cr = 3 dB (reflectie, vast)
 *   Lbi    = Lb − GA
 *   GA;k   = GA − 10·log10(max(V/Stot, 3) / (6·T))
 *            Stot = som S van vlakken met meenemen_gak (lengte telt niet mee)
 *   Lbi;k  = Lb − GA;k   (karakteristiek binnenniveau)
 *   Toets  = Lbi;k ≤ grens (gebruiksfunctie) → Voldoet
 *
 * Spectrum (SPECTRUM_1/2/CUSTOM) is metadata for export/display; A-weighted RA
 * path does not apply spectral weighting yet (no spectral R' kernel).
 */

export const CR_DB = 3;

/** Default grenswaarde karakteristiek binnenniveau Lbi;k (dB) — Woonfunctie. */
export const GRENZWAARDE_LBIK_DB = 33;

/** Grens Lbi;k [dB] per Bouwbesluit-gebruiksfunctie (praktijkwaarden). */
export const GRENZWAARDE_LBIK_BY_FUNCTIE: Record<string, number> = {
  Woonfunctie: 33,
  "Bijeenkomst voor kinderopvang": 28,
  Gezondheidszorgfunctie: 33,
  Onderwijsfunctie: 28,
  "Wgh, gezondheidszorg geluidgevoelig": 33,
  "Wgh, onderwijsfunctie geluidgevoelig": 28,
  Overig: 33,
};

export function grenswaardeLbik(gebruiksfunctie?: string | null): number {
  const key = String(gebruiksfunctie || "").trim();
  if (key && key in GRENZWAARDE_LBIK_BY_FUNCTIE) {
    return GRENZWAARDE_LBIK_BY_FUNCTIE[key];
  }
  return GRENZWAARDE_LBIK_DB;
}

export function round1(x: number): number {
  return Math.round(Number(x) * 10) / 10;
}

export function partialRas(
  el: { ra_dba: number; quantity: number },
  sRef: number,
): number | null {
  const q = Number(el.quantity);
  const ra = Number(el.ra_dba);
  if (!(sRef > 0) || !(q > 0) || !Number.isFinite(ra)) return null;
  return ra + 10 * Math.log10(sRef / q);
}

export function combineRprime(rasValues: number[]): number | null {
  const vals = rasValues.filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  let sum = 0;
  for (const r of vals) sum += 10 ** (-r / 10);
  if (!(sum > 0)) return null;
  return -10 * Math.log10(sum);
}

export function roomCorrectionDb(volumeM3: number, t0s: number, sM2: number): number | null {
  const V = Number(volumeM3);
  const T = Number(t0s);
  const S = Number(sM2);
  if (!(V > 0) || !(T > 0) || !(S > 0)) return null;
  return 10 * Math.log10(V / (6 * T * S));
}

/** NEN 5077 C3: indien V/Stot < 3 m, reken met 3 m. */
export function gakCorrectionDb(volumeM3: number, t0s: number, stotM2: number): number | null {
  const V = Number(volumeM3);
  const T = Number(t0s);
  const S = Number(stotM2);
  if (!(V > 0) || !(T > 0) || !(S > 0)) return null;
  const ratio = Math.max(V / S, 3);
  return 10 * Math.log10(ratio / (6 * T));
}

export type GaVlakInput = {
  label?: string;
  ra_dba: number;
  quantity_kind: "area" | "length" | string;
  area_m2?: number | null;
  length_m?: number | null;
  meenemen_gak?: boolean;
  cl_db?: number;
  cg_db?: number;
};

export type GaVrInput = {
  volume_m3: number;
  t0_s: number;
  geluidsbelasting_dba: number;
  vlakken: GaVlakInput[];
  cr_db?: number;
  /** Optional VR-level overrides (e.g. form CL/Cg while editing). */
  cl_db?: number;
  cg_db?: number;
  /** Gebruiksfunctie → Lbi;k grenswaarde. */
  gebruiksfunctie?: string | null;
  /** Explicit override of Lbi;k limit (dB). */
  grenswaarde_lbik_db?: number | null;
};

export type GaElementResult = {
  label: string;
  kind: string;
  quantity: number;
  ra_dba: number;
  ras: number | null;
  meenemen_gak: boolean;
  cl_db: number;
  cg_db: number;
  area_for_s: number;
};

export type GaVrResult = {
  ok: boolean;
  reason: string | null;
  s_m2: number;
  stot_m2: number;
  elements: GaElementResult[];
  r_prime: number | null;
  ruimte_db: number | null;
  cl_db: number;
  cg_db: number;
  cr_db?: number;
  d2m_nt: number | null;
  ga_dba: number | null;
  lbi_dba: number | null;
  gak_dba: number | null;
  gak_corr_db: number | null;
  /** Karakteristiek binnenniveau Lb − GA;k. */
  lbik_dba: number | null;
  /** Vereiste GA;k = Lb − grens. */
  gak_required_dba: number | null;
  /** Toetsgrens Lbi;k [dB]. */
  grenswaarde_lbik_db: number;
  /** Lbi;k ≤ grens. */
  voldoet: boolean | null;
};

export function computeVrGa(input: GaVrInput): GaVrResult {
  const V = Number(input.volume_m3);
  const T = Number(input.t0_s) > 0 ? Number(input.t0_s) : 0.5;
  const Lb = Number(input.geluidsbelasting_dba);
  const Cr = input.cr_db != null ? Number(input.cr_db) : CR_DB;
  const grens =
    input.grenswaarde_lbik_db != null && Number.isFinite(Number(input.grenswaarde_lbik_db))
      ? Number(input.grenswaarde_lbik_db)
      : grenswaardeLbik(input.gebruiksfunctie);
  const vlakken = Array.isArray(input.vlakken) ? input.vlakken : [];

  const emptyToets = {
    lbik_dba: null as number | null,
    gak_required_dba: null as number | null,
    grenswaarde_lbik_db: grens,
    voldoet: null as boolean | null,
  };

  const elements: GaElementResult[] = [];
  for (const v of vlakken) {
    const kind = v.quantity_kind === "length" ? "length" : "area";
    const qty =
      kind === "length"
        ? v.length_m != null
          ? Number(v.length_m)
          : NaN
        : v.area_m2 != null
          ? Number(v.area_m2)
          : NaN;
    const ra = Number(v.ra_dba);
    if (!(qty > 0) || !Number.isFinite(ra)) continue;
    const areaForS = kind === "area" ? qty : 0;
    elements.push({
      label: v.label || "",
      kind,
      quantity: qty,
      ra_dba: ra,
      ras: null,
      meenemen_gak: v.meenemen_gak !== false,
      cl_db: Number(v.cl_db) || 0,
      cg_db: Number(v.cg_db) || 0,
      area_for_s: areaForS,
    });
  }

  const sRef = elements.reduce((a, e) => a + e.area_for_s, 0);
  const stot = elements.filter((e) => e.meenemen_gak).reduce((a, e) => a + e.area_for_s, 0);

  if (!(sRef > 0) || !elements.length) {
    return {
      ok: false,
      reason: "geen geveloppervlak (m²) — voeg vlakken met materiaal toe",
      s_m2: sRef,
      stot_m2: stot,
      elements: [],
      r_prime: null,
      ruimte_db: null,
      cl_db: 0,
      cg_db: 0,
      d2m_nt: null,
      ga_dba: null,
      lbi_dba: null,
      gak_dba: null,
      gak_corr_db: null,
      ...emptyToets,
    };
  }

  let cl = 0;
  let cg = 0;
  let bestArea = -1;
  for (const e of elements) {
    if (e.area_for_s > bestArea) {
      bestArea = e.area_for_s;
      cl = e.cl_db;
      cg = e.cg_db;
    }
  }
  if (input.cl_db != null && Number.isFinite(Number(input.cl_db))) {
    cl = Number(input.cl_db);
  }
  if (input.cg_db != null && Number.isFinite(Number(input.cg_db))) {
    cg = Number(input.cg_db);
  }

  for (const e of elements) {
    e.ras = partialRas({ ra_dba: e.ra_dba, quantity: e.quantity }, sRef);
  }
  const rPrime = combineRprime(elements.map((e) => e.ras).filter((x): x is number => x != null));
  const ruimte = roomCorrectionDb(V, T, sRef);
  if (rPrime == null || ruimte == null) {
    return {
      ok: false,
      reason: "berekening mislukt (R' of ruimtecorrectie)",
      s_m2: sRef,
      stot_m2: stot,
      elements,
      r_prime: rPrime,
      ruimte_db: ruimte,
      cl_db: cl,
      cg_db: cg,
      d2m_nt: null,
      ga_dba: null,
      lbi_dba: null,
      gak_dba: null,
      gak_corr_db: null,
      ...emptyToets,
    };
  }

  const d2m = rPrime + cg + ruimte + cl;
  const ga = d2m - Cr;
  const lbi = Number.isFinite(Lb) ? Lb - ga : null;
  const gakCorr = stot > 0 ? gakCorrectionDb(V, T, stot) : null;
  const gak = gakCorr != null ? ga - gakCorr : null;
  const gakRequired = Number.isFinite(Lb) ? Lb - grens : null;
  const lbik = gak != null && Number.isFinite(Lb) ? Lb - gak : null;
  const voldoet = lbik != null ? lbik <= grens : null;

  return {
    ok: true,
    reason: null,
    s_m2: sRef,
    stot_m2: stot,
    elements,
    r_prime: rPrime,
    ruimte_db: ruimte,
    cl_db: cl,
    cg_db: cg,
    cr_db: Cr,
    d2m_nt: d2m,
    ga_dba: ga,
    lbi_dba: lbi,
    gak_dba: gak,
    gak_corr_db: gakCorr,
    lbik_dba: lbik,
    gak_required_dba: gakRequired,
    grenswaarde_lbik_db: grens,
    voldoet,
  };
}
