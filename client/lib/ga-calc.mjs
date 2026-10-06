// src/ga-calc.ts
var CR_DB = 3;
var GRENZWAARDE_LBIK_DB = 33;
var GRENZWAARDE_LBIK_BY_FUNCTIE = {
  Woonfunctie: 33,
  "Bijeenkomst voor kinderopvang": 28,
  Gezondheidszorgfunctie: 33,
  Onderwijsfunctie: 28,
  "Wgh, gezondheidszorg geluidgevoelig": 33,
  "Wgh, onderwijsfunctie geluidgevoelig": 28,
  Overig: 33
};
function grenswaardeLbik(gebruiksfunctie) {
  const key = String(gebruiksfunctie || "").trim();
  if (key && key in GRENZWAARDE_LBIK_BY_FUNCTIE) {
    return GRENZWAARDE_LBIK_BY_FUNCTIE[key];
  }
  return GRENZWAARDE_LBIK_DB;
}
function round1(x) {
  return Math.round(Number(x) * 10) / 10;
}
function partialRas(el, sRef) {
  const q = Number(el.quantity);
  const ra = Number(el.ra_dba);
  if (!(sRef > 0) || !(q > 0) || !Number.isFinite(ra)) return null;
  return ra + 10 * Math.log10(sRef / q);
}
function combineRprime(rasValues) {
  const vals = rasValues.filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  let sum = 0;
  for (const r of vals) sum += 10 ** (-r / 10);
  if (!(sum > 0)) return null;
  return -10 * Math.log10(sum);
}
function combineLevelsDb(levels) {
  const vals = levels.filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  let sum = 0;
  for (const L of vals) sum += 10 ** (-L / 10);
  if (!(sum > 0)) return null;
  return -10 * Math.log10(sum);
}
function roomCorrectionDb(volumeM3, t0s, sM2) {
  const V = Number(volumeM3);
  const T = Number(t0s);
  const S = Number(sM2);
  if (!(V > 0) || !(T > 0) || !(S > 0)) return null;
  return 10 * Math.log10(V / (6 * T * S));
}
function gakCorrectionDb(volumeM3, t0s, stotM2) {
  const V = Number(volumeM3);
  const T = Number(t0s);
  const S = Number(stotM2);
  if (!(V > 0) || !(T > 0) || !(S > 0)) return null;
  const ratio = Math.max(V / S, 3);
  return 10 * Math.log10(ratio / (6 * T));
}
function normalizeOriKey(raw) {
  const s = String(raw || "").trim().toUpperCase();
  return s || "_";
}
function failResult(grens, partial) {
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
    voldoet: null
  };
}
function computeVrGa(input) {
  const V = Number(input.volume_m3);
  const T = Number(input.t0_s) > 0 ? Number(input.t0_s) : 0.5;
  const Lb = Number(input.geluidsbelasting_dba);
  const Cr = input.cr_db != null ? Number(input.cr_db) : CR_DB;
  const grens = input.grenswaarde_lbik_db != null && Number.isFinite(Number(input.grenswaarde_lbik_db)) ? Number(input.grenswaarde_lbik_db) : grenswaardeLbik(input.gebruiksfunctie);
  const vlakken = Array.isArray(input.vlakken) ? input.vlakken : [];
  const overrideCl = input.cl_db != null && Number.isFinite(Number(input.cl_db)) ? Number(input.cl_db) : null;
  const overrideCg = input.cg_db != null && Number.isFinite(Number(input.cg_db)) ? Number(input.cg_db) : null;
  const raw = [];
  for (const v of vlakken) {
    const kind = v.quantity_kind === "length" ? "length" : "area";
    const qty = kind === "length" ? v.length_m != null ? Number(v.length_m) : NaN : v.area_m2 != null ? Number(v.area_m2) : NaN;
    const ra = Number(v.ra_dba);
    if (!(qty > 0) || !Number.isFinite(ra)) continue;
    raw.push({
      label: v.label || "",
      kind,
      quantity: qty,
      ra_dba: ra,
      meenemen_gak: v.meenemen_gak !== false,
      cl_db: overrideCl != null ? overrideCl : Number(v.cl_db) || 0,
      cg_db: overrideCg != null ? overrideCg : Number(v.cg_db) || 0,
      area_for_s: kind === "area" ? qty : 0,
      orientatie: normalizeOriKey(v.orientatie)
    });
  }
  const sAll = raw.reduce((a, e) => a + e.area_for_s, 0);
  const stot = raw.filter((e) => e.meenemen_gak).reduce((a, e) => a + e.area_for_s, 0);
  if (!(sAll > 0) || !raw.length) {
    return failResult(grens, {
      reason: "geen geveloppervlak (m\xB2) \u2014 voeg vlakken met materiaal toe",
      s_m2: sAll,
      stot_m2: stot
    });
  }
  if (!(V > 0)) {
    return failResult(grens, {
      reason: "Geen volume (vloeroppervlak ontbreekt of is 0). Zet de schaal op de plattegrond, herbereken maten voor deze VR, daarna opnieuw Herberekenen GA / GA;k.",
      s_m2: sAll,
      stot_m2: stot
    });
  }
  const byOri = /* @__PURE__ */ new Map();
  for (const e of raw) {
    const list = byOri.get(e.orientatie) || [];
    list.push(e);
    byOri.set(e.orientatie, list);
  }
  const facades = [];
  const allElements = [];
  for (const [ori, group] of byOri) {
    const sOri = group.reduce((a, e) => a + e.area_for_s, 0);
    if (!(sOri > 0)) {
      return failResult(grens, {
        reason: `Gevel ${ori}: geen oppervlak (m\xB2) \u2014 alleen kierlengte is niet genoeg voor R\u2032`,
        s_m2: sAll,
        stot_m2: stot,
        elements: allElements,
        facades
      });
    }
    let cl = 0;
    let cg = 0;
    let bestArea = -1;
    for (const e of group) {
      if (e.area_for_s > bestArea) {
        bestArea = e.area_for_s;
        cl = e.cl_db;
        cg = e.cg_db;
      }
    }
    const elements = group.map((e) => ({
      label: e.label,
      kind: e.kind,
      quantity: e.quantity,
      ra_dba: e.ra_dba,
      ras: partialRas({ ra_dba: e.ra_dba, quantity: e.quantity }, sOri),
      meenemen_gak: e.meenemen_gak,
      cl_db: cl,
      cg_db: cg,
      area_for_s: e.area_for_s,
      orientatie: ori
    }));
    const rPrime = combineRprime(elements.map((e) => e.ras).filter((x) => x != null));
    const ruimte = roomCorrectionDb(V, T, sOri);
    if (rPrime == null || ruimte == null) {
      return failResult(grens, {
        reason: !(T > 0) ? "Geen nagalmtijd T\u2080 \u2014 vul T\u2080 bij de VR in." : `berekening mislukt voor gevel ${ori} (R' of ruimtecorrectie)`,
        s_m2: sAll,
        stot_m2: stot,
        elements: [...allElements, ...elements],
        facades,
        r_prime: rPrime,
        ruimte_db: ruimte,
        cl_db: cl,
        cg_db: cg
      });
    }
    const d2m = rPrime + ruimte + cl + cg;
    const gaOri = d2m - Cr;
    const lbiOri = Number.isFinite(Lb) ? Lb - gaOri : null;
    facades.push({
      orientatie: ori,
      s_m2: sOri,
      r_prime: rPrime,
      ruimte_db: ruimte,
      cl_db: cl,
      cg_db: cg,
      d2m_nt: d2m,
      ga_dba: gaOri,
      lbi_dba: lbiOri,
      elements
    });
    allElements.push(...elements);
  }
  if (!facades.length) {
    return failResult(grens, {
      reason: "geen geveloppervlak (m\xB2) \u2014 voeg vlakken met materiaal toe",
      s_m2: sAll,
      stot_m2: stot,
      elements: allElements
    });
  }
  const d2mTot = combineLevelsDb(facades.map((f) => f.d2m_nt));
  if (d2mTot == null) {
    return failResult(grens, {
      reason: "combinatie van gevels mislukt",
      s_m2: sAll,
      stot_m2: stot,
      elements: allElements,
      facades
    });
  }
  const ga = d2mTot - Cr;
  const lbi = Number.isFinite(Lb) ? Lb - ga : null;
  const gakCorr = stot > 0 ? gakCorrectionDb(V, T, stot) : null;
  const gak = gakCorr != null ? ga - gakCorr : null;
  const gakRequired = Number.isFinite(Lb) ? Lb - grens : null;
  const lbik = gak != null && Number.isFinite(Lb) ? Lb - gak : null;
  const voldoet = lbik != null ? lbik <= grens : null;
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
    voldoet
  };
}
function minRaDeltaForRprime(elements, elementIndex, needDeltaR) {
  if (!(needDeltaR > 0)) return 0;
  const target = elements[elementIndex];
  if (!target || target.ras == null || !Number.isFinite(target.ras)) return null;
  const ori = target.orientatie;
  const peers = ori != null ? elements.map((e, i) => ({ e, i })).filter(({ e }) => e.orientatie === ori) : elements.map((e, i) => ({ e, i }));
  const rasList = peers.map(({ e }) => e.ras).filter((x) => x != null && Number.isFinite(x));
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
export {
  CR_DB,
  GRENZWAARDE_LBIK_BY_FUNCTIE,
  GRENZWAARDE_LBIK_DB,
  combineLevelsDb,
  combineRprime,
  computeVrGa,
  gakCorrectionDb,
  grenswaardeLbik,
  minRaDeltaForRprime,
  partialRas,
  roomCorrectionDb,
  round1
};
