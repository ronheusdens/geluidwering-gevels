/**
 * GA / GA;k / Lbi rekenkern — NPR 5272 / NEN 5077 / EN 12354-3, DGMR-parity.
 *
 * Per gevelgroep (binnen oriëntatie; default = één groep per ori):
 *   RAs_i = RA_i + 10·log10(S_groep / Q_i)    Q = m² of m (kier)
 *   R'    = −10·log10(Σ 10^(−RAs_i/10))
 *   Ruimte = 10·log10(V / (6·T·S_groep))
 *   D2m,nT = R' + Ruimte + Cg                 fysiek (EN 12354-3 / DGMR-vlakrij)
 *   GA_vlak = D2m,nT − Cr                     Cr = 3 dB; CL zit NIET in de vlak-GA
 *
 * CL (NEN 5077 herleidingsterm): corrigeert de geluidbelasting t.o.v. L_ref.
 * Equivalent: D2m_ref = D2m,nT + CL vóór energetische som over gevels:
 *   D2m_tot = −10·log10(Σ 10^(−(D2m_vlak + CL_vlak)/10))
 *   GA      = D2m_tot − Cr
 *   Lbi     = Lb − GA
 *   GA;k    = GA − 10·log10(max(V/Stot, 3) / (6·T))
 *            Stot = som S van vlakken met meenemen_gak (lengte telt niet mee)
 *   Lbi;k   = Lb − GA;k
 *   Toets   = Lbi;k ≤ grens (gebruiksfunctie) → Voldoet
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

/** Energetische som van niveau’s (dB) → gecombineerd niveau (dB). */
export function combineLevelsDb(levels: number[]): number | null {
  const vals = levels.filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  let sum = 0;
  for (const L of vals) sum += 10 ** (-L / 10);
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
  /** Geveloriëntatie (N/O/Z/W/…). Leeg → één anonieme gevel. */
  orientatie?: string | null;
  /** Expliciete gevelgroep; anders groepering op ori+CL+Cg. */
  gevelgroep_id?: string | null;
  gevelgroep_label?: string | null;
  ra_dba: number;
  quantity_kind: "area" | "length" | string;
  area_m2?: number | null;
  length_m?: number | null;
  meenemen_gak?: boolean;
  /** CL/Cg van de gevelgroep (alle vlakken in de groep delen deze). */
  cl_db?: number;
  cg_db?: number;
};

export type GaVrInput = {
  volume_m3: number;
  t0_s: number;
  geluidsbelasting_dba: number;
  vlakken: GaVlakInput[];
  cr_db?: number;
  /** Optional VR-level overrides applied to every ori-group (legacy form). */
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
  orientatie: string;
  gevelgroep_id?: string | null;
};

export type GaFacadeResult = {
  orientatie: string;
  gevelgroep_id?: string | null;
  gevelgroep_label?: string | null;
  s_m2: number;
  r_prime: number;
  ruimte_db: number;
  cl_db: number;
  cg_db: number;
  /** Fysiek D2m,nT = R′+ruimte+Cg (zonder CL) — DGMR-vlakrij. */
  d2m_nt: number;
  /** D2m t.o.v. L_ref = D2m,nT+CL — alleen voor ruimtesom. */
  d2m_nt_ref: number;
  /** Vlak-GA = D2m,nT − Cr (zonder CL), zoals DGMR. */
  ga_dba: number;
  /** Effectieve bijdrage t.o.v. Lb: Lb − (D2m_ref − Cr). */
  lbi_dba: number | null;
  elements: GaElementResult[];
};

export type GaVrResult = {
  ok: boolean;
  reason: string | null;
  s_m2: number;
  stot_m2: number;
  elements: GaElementResult[];
  /** Per-geveloriëntatie (DGMR-stijl). */
  facades: GaFacadeResult[];
  /** Bij één gevel: R′ van die gevel; bij meerdere: null (zie facades). */
  r_prime: number | null;
  /** Bij één gevel: ruimtecorrectie; bij meerdere: null. */
  ruimte_db: number | null;
  /** Bij één gevel: CL; bij meerdere: CL van grootste S (display). */
  cl_db: number;
  cg_db: number;
  cr_db?: number;
  /** Gecombineerde D2m,nT over alle gevels. */
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

function normalizeOriKey(raw: string | null | undefined): string {
  const s = String(raw || "")
    .trim()
    .toUpperCase();
  return s || "_";
}

function failResult(
  grens: number,
  partial: Partial<GaVrResult> & { reason: string; s_m2: number; stot_m2: number },
): GaVrResult {
  return {
    ok: false,
    reason: partial.reason,
    s_m2: partial.s_m2,
    stot_m2: partial.stot_m2,
    elements: partial.elements || [],
    facades: partial.facades || [],
    r_prime: partial.r_prime ?? null,
    ruimte_db: partial.ruimte_db ?? null,
    cl_db: partial.cl_db ?? 0,
    cg_db: partial.cg_db ?? 0,
    d2m_nt: null,
    ga_dba: null,
    lbi_dba: null,
    gak_dba: null,
    gak_corr_db: null,
    lbik_dba: null,
    gak_required_dba: null,
    grenswaarde_lbik_db: grens,
    voldoet: null,
  };
}

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
  const overrideCl =
    input.cl_db != null && Number.isFinite(Number(input.cl_db)) ? Number(input.cl_db) : null;
  const overrideCg =
    input.cg_db != null && Number.isFinite(Number(input.cg_db)) ? Number(input.cg_db) : null;

  type RawEl = {
    label: string;
    kind: "area" | "length";
    quantity: number;
    ra_dba: number;
    meenemen_gak: boolean;
    cl_db: number;
    cg_db: number;
    area_for_s: number;
    orientatie: string;
    gevelgroep_id: string;
    gevelgroep_label: string;
  };

  const raw: RawEl[] = [];
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
    const cl = overrideCl != null ? overrideCl : Number(v.cl_db) || 0;
    const cg = overrideCg != null ? overrideCg : Number(v.cg_db) || 0;
    const ori = normalizeOriKey(v.orientatie);
    const ggId = String(v.gevelgroep_id || "").trim();
    raw.push({
      label: v.label || "",
      kind,
      quantity: qty,
      ra_dba: ra,
      meenemen_gak: v.meenemen_gak !== false,
      cl_db: cl,
      cg_db: cg,
      area_for_s: kind === "area" ? qty : 0,
      orientatie: ori,
      gevelgroep_id: ggId,
      gevelgroep_label: String(v.gevelgroep_label || "").trim(),
    });
  }

  const sAll = raw.reduce((a, e) => a + e.area_for_s, 0);
  const stot = raw.filter((e) => e.meenemen_gak).reduce((a, e) => a + e.area_for_s, 0);

  if (!(sAll > 0) || !raw.length) {
    return failResult(grens, {
      reason: "geen geveloppervlak (m²) — voeg vlakken met materiaal toe",
      s_m2: sAll,
      stot_m2: stot,
    });
  }

  if (!(V > 0)) {
    return failResult(grens, {
      reason:
        "Geen volume (vloeroppervlak ontbreekt of is 0). Zet de schaal op de plattegrond, herbereken maten voor deze VR, daarna opnieuw Herberekenen GA / GA;k.",
      s_m2: sAll,
      stot_m2: stot,
    });
  }

  /* D2m-groep = gevelgroep_id, anders ori+CL+Cg. Alle groepen van de VR
   * worden apart gerekend en energetisch gecombineerd. */
  const byFacadeKey = new Map<string, RawEl[]>();
  for (const e of raw) {
    const key = e.gevelgroep_id
      ? `g:${e.gevelgroep_id}`
      : `${e.orientatie}\0${e.cl_db}\0${e.cg_db}`;
    const list = byFacadeKey.get(key) || [];
    list.push(e);
    byFacadeKey.set(key, list);
  }

  const facades: GaFacadeResult[] = [];
  const allElements: GaElementResult[] = [];

  for (const group of byFacadeKey.values()) {
    const ori = group[0].orientatie;
    const cl = group[0].cl_db;
    const cg = group[0].cg_db;
    const ggId = group[0].gevelgroep_id || null;
    const ggLabel = group[0].gevelgroep_label || "";
    const sOri = group.reduce((a, e) => a + e.area_for_s, 0);
    if (!(sOri > 0)) {
      return failResult(grens, {
        reason: `Gevel ${ori}: geen oppervlak (m²) — alleen kierlengte is niet genoeg voor R′`,
        s_m2: sAll,
        stot_m2: stot,
        elements: allElements,
        facades,
      });
    }

    const elements: GaElementResult[] = group.map((e) => ({
      label: e.label,
      kind: e.kind,
      quantity: e.quantity,
      ra_dba: e.ra_dba,
      ras: partialRas({ ra_dba: e.ra_dba, quantity: e.quantity }, sOri),
      meenemen_gak: e.meenemen_gak,
      cl_db: cl,
      cg_db: cg,
      area_for_s: e.area_for_s,
      orientatie: ori,
      gevelgroep_id: e.gevelgroep_id || null,
    }));

    const rPrime = combineRprime(elements.map((e) => e.ras).filter((x): x is number => x != null));
    const ruimte = roomCorrectionDb(V, T, sOri);
    if (rPrime == null || ruimte == null) {
      return failResult(grens, {
        reason: !(T > 0)
          ? "Geen nagalmtijd T₀ — vul T₀ bij de VR in."
          : `berekening mislukt voor gevel ${ori} (R' of ruimtecorrectie)`,
        s_m2: sAll,
        stot_m2: stot,
        elements: [...allElements, ...elements],
        facades,
        r_prime: rPrime,
        ruimte_db: ruimte,
        cl_db: cl,
        cg_db: cg,
      });
    }

    // DGMR / EN 12354-3: fysiek D2m zonder CL; CL is herleiding op Lb.
    const d2m = rPrime + ruimte + cg;
    const d2mRef = d2m + cl;
    const gaOri = d2m - Cr;
    const gaRef = d2mRef - Cr;
    const lbiOri = Number.isFinite(Lb) ? Lb - gaRef : null;
    facades.push({
      orientatie: ori,
      gevelgroep_id: ggId,
      gevelgroep_label: ggLabel || null,
      s_m2: sOri,
      r_prime: rPrime,
      ruimte_db: ruimte,
      cl_db: cl,
      cg_db: cg,
      d2m_nt: d2m,
      d2m_nt_ref: d2mRef,
      ga_dba: gaOri,
      lbi_dba: lbiOri,
      elements,
    });
    allElements.push(...elements);
  }

  if (!facades.length) {
    return failResult(grens, {
      reason: "geen geveloppervlak (m²) — voeg vlakken met materiaal toe",
      s_m2: sAll,
      stot_m2: stot,
      elements: allElements,
    });
  }

  // Ruimtesom t.o.v. L_ref: CL wél meenemen (anders ~3 dB te laag bij hoekkamers).
  const d2mTot = combineLevelsDb(facades.map((f) => f.d2m_nt_ref));
  if (d2mTot == null) {
    return failResult(grens, {
      reason: "combinatie van gevels mislukt",
      s_m2: sAll,
      stot_m2: stot,
      elements: allElements,
      facades,
    });
  }

  const ga = d2mTot - Cr;
  const lbi = Number.isFinite(Lb) ? Lb - ga : null;
  const gakCorr = stot > 0 ? gakCorrectionDb(V, T, stot) : null;
  const gak = gakCorr != null ? ga - gakCorr : null;
  const gakRequired = Number.isFinite(Lb) ? Lb - grens : null;
  const lbik = gak != null && Number.isFinite(Lb) ? Lb - gak : null;
  const voldoet = lbik != null ? lbik <= grens : null;

  // Display CL/Cg: single façade → that pair; multi → largest-S façade (informatief).
  let displayCl = facades[0].cl_db;
  let displayCg = facades[0].cg_db;
  let bestS = facades[0].s_m2;
  for (const f of facades) {
    if (f.s_m2 > bestS) {
      bestS = f.s_m2;
      displayCl = f.cl_db;
      displayCg = f.cg_db;
    }
  }
  const single = facades.length === 1;

  return {
    ok: true,
    reason: null,
    s_m2: sAll,
    stot_m2: stot,
    elements: allElements,
    facades,
    r_prime: single ? facades[0].r_prime : null,
    ruimte_db: single ? facades[0].ruimte_db : null,
    cl_db: displayCl,
    cg_db: displayCg,
    cr_db: Cr,
    d2m_nt: d2mTot,
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

/**
 * Minimum RA increase (dB) on one element so combined R' rises by at least `needDeltaR`.
 * Returns 0 if need ≤ 0; null if this element alone cannot close the gap.
 *
 * With multi-ori: operates within the façade that owns `elementIndex` (global elements order).
 */
export function minRaDeltaForRprime(
  elements: Array<{
    ras: number | null;
    orientatie?: string;
    cl_db?: number;
    cg_db?: number;
    gevelgroep_id?: string | null;
  }>,
  elementIndex: number,
  needDeltaR: number,
): number | null {
  if (!(needDeltaR > 0)) return 0;
  const target = elements[elementIndex];
  if (!target || target.ras == null || !Number.isFinite(target.ras)) return null;
  const ori = target.orientatie;
  const gg = String(target.gevelgroep_id || "").trim();
  const peers =
    ori != null
      ? elements
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => {
            if (e.orientatie !== ori) return false;
            const eg = String(e.gevelgroep_id || "").trim();
            if (gg || eg) return eg === gg;
            return (
              (target.cl_db == null || e.cl_db === target.cl_db) &&
              (target.cg_db == null || e.cg_db === target.cg_db)
            );
          })
      : elements.map((e, i) => ({ e, i }));
  const rasList = peers.map(({ e }) => e.ras).filter((x): x is number => x != null && Number.isFinite(x));
  if (rasList.length !== peers.length) return null;
  const oldSum = rasList.reduce((a, r) => a + 10 ** (-r / 10), 0);
  if (!(oldSum > 0)) return null;
  const oldRp = -10 * Math.log10(oldSum);
  const targetRp = oldRp + needDeltaR;
  const tauI = 10 ** (-target.ras / 10);
  const rest = oldSum - tauI;
  const maxSum = 10 ** (-targetRp / 10);
  if (!(maxSum > rest)) return null;
  const maxTauI = maxSum - rest;
  if (!(maxTauI > 0)) return null;
  const neededRas = -10 * Math.log10(maxTauI);
  const delta = neededRas - target.ras;
  if (!(delta > 0)) return 0;
  return Math.ceil(delta * 10) / 10;
}
