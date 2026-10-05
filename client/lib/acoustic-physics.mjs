/**
 * Building-acoustics helpers for Materials Studio compose preview.
 * Preview-only (not normative). A-weighted RA remains leading for GA.
 * Rw / C / Ctr follow ISO 717-1 octave procedure (same as sql/…_0_2_23_backfill_rw.py).
 */

export const MANDATORY_HZ = [125, 250, 500, 1000, 2000];
export const RW_BANDS = [125, 250, 500, 1000, 2000, 4000];

const REF_OCTAVE = {
  125: 36.0,
  250: 45.0,
  500: 52.0,
  1000: 55.0,
  2000: 56.0,
  4000: 56.0,
};
const SPEC_C = { 125: -21.0, 250: -14.0, 500: -8.0, 1000: -5.0, 2000: -4.0, 4000: -6.0 };
const SPEC_CTR = { 125: -14.0, 250: -10.0, 500: -7.0, 1000: -4.0, 2000: -6.0, 4000: -11.0 };
const MAX_UNFAV = 10.0;
const SOUND_SPEED = 340.0;

export function surfaceMassKgM2(thicknessMm, densityKgM3) {
  const t = Number(thicknessMm);
  const d = Number(densityKgM3);
  if (!(t > 0) || !(d > 0)) return null;
  return d * (t / 1000.0);
}

/**
 * Area fraction of wood for parallel battens: φ = width / spacing (h.o.h.).
 * @returns {number|null} 0…1
 */
export function woodCoverageFraction(widthMm, spacingMm) {
  const b = Number(widthMm);
  const a = Number(spacingMm);
  if (!(b > 0) || !(a > 0) || b > a) return null;
  return b / a;
}

/** Two orthogonal grids (tengel ⊥ panlat): φ = φa + φb − φa·φb. */
export function woodGridCombinedPhi(phiA, phiB) {
  const a = Number(phiA);
  const b = Number(phiB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a + b - a * b;
}

/** Equivalent surface mass of a wood grid: m″eq = φ · ρ · h. */
export function woodEquivalentSurfaceMass(phi, densityKgM3, thicknessMm) {
  const p = Number(phi);
  const d = Number(densityKgM3);
  const h = Number(thicknessMm);
  if (!(p > 0) || !(d > 0) || !(h > 0)) return null;
  return p * d * (h / 1000.0);
}

/**
 * Metrics for a framing / regelwerk layer from stud geometry.
 * Rekenwaarden φ and m″eq are derived (read-only in UI).
 */
export function woodGridMetrics(layer) {
  const width = Number(layer.stud_width_mm);
  const spacing = Number(layer.stud_spacing_mm);
  const depth =
    Number(layer.stud_depth_mm) > 0
      ? Number(layer.stud_depth_mm)
      : Number(layer.thickness_mm);
  const density = Number(layer.density_kg_m3);
  const phi = woodCoverageFraction(width, spacing);
  if (phi == null) return null;
  const mEq = woodEquivalentSurfaceMass(phi, density, depth);
  return {
    phi,
    phi_pct: round1(phi * 100),
    m_eq_kg_m2: mEq != null ? round1(mEq) : null,
    stud_width_mm: width,
    stud_spacing_mm: spacing,
    stud_depth_mm: depth,
    density_kg_m3: density,
  };
}

export function massLawRDb(fHz, mKgM2) {
  if (!(mKgM2 > 0) || !(fHz > 0)) return 0;
  return 20 * Math.log10(mKgM2 * fHz) - 47;
}

export function massLawSpectrum(thicknessMm, densityKgM3) {
  const m = surfaceMassKgM2(thicknessMm, densityKgM3);
  if (m == null) return null;
  const out = {};
  for (const hz of MANDATORY_HZ) out[hz] = round1(massLawRDb(hz, m));
  // 4000: extrapolate gently from 2000
  out[4000] = round1(massLawRDb(4000, m));
  out[63] = round1(massLawRDb(63, m));
  return out;
}

function msmResonanceHz(m1, m2, cavityM) {
  if (!(m1 > 0) || !(m2 > 0) || !(cavityM > 0)) return null;
  const dEff = cavityM + 0.016;
  return (1 / (2 * Math.PI)) * Math.sqrt(SOUND_SPEED ** 2 / (dEff * (1 / m1 + 1 / m2)));
}

export function msmDoubleRDb(fHz, mOuter, mInner, cavityMm, insulationFactor = 1) {
  if (!(mOuter > 0) || !(mInner > 0)) {
    return massLawRDb(fHz, Math.max(mOuter || 0, mInner || 0));
  }
  const cavityM = Math.max(cavityMm, 1) / 1000;
  const f0 = msmResonanceHz(mOuter, mInner, cavityM) || 200;
  const rMass = massLawRDb(fHz, mOuter + mInner);
  let dip = 8 / Math.max(insulationFactor, 0.25);
  if (fHz > 0) {
    const rel = fHz / f0;
    dip *= Math.exp(-(Math.log10(Math.max(rel, 0.01)) ** 2) / 0.35);
  }
  return Math.max(rMass - dip, massLawRDb(fHz, Math.min(mOuter, mInner)));
}

/**
 * @param {Array<{
 *   layer_kind: string,
 *   acoustic_role?: string,
 *   thickness_mm?: number|null,
 *   density_kg_m3?: number|null,
 *   surface_mass_kg_m2?: number|null,
 *   cavity_depth_mm?: number|null,
 * }>} layers
 */
export function stackSpectrumDb(layers) {
  const structural = layers.filter((L) =>
    ["structural", "lining", "sheathing", "cladding"].includes(L.acoustic_role || "structural"),
  );
  const cavities = layers.filter(
    (L) => L.layer_kind === "cavity_ventilated" || L.acoustic_role === "cavity",
  );
  const absorbers = layers.filter((L) => L.acoustic_role === "absorptive");

  const massOf = (L) => {
    if (L.surface_mass_kg_m2 != null && Number(L.surface_mass_kg_m2) > 0) {
      return Number(L.surface_mass_kg_m2);
    }
    if (L.layer_kind === "framing") {
      const g = woodGridMetrics(L);
      if (g?.m_eq_kg_m2 != null) return g.m_eq_kg_m2;
    }
    return surfaceMassKgM2(L.thickness_mm, L.density_kg_m3) || 0;
  };

  const out = {};
  if (!structural.length) {
    for (const hz of MANDATORY_HZ) out[hz] = 0;
    out[4000] = 0;
    return out;
  }

  const mOuter = structural.slice(0, Math.min(2, structural.length)).reduce((s, L) => s + massOf(L), 0);
  const mInner = massOf(structural[structural.length - 1]);
  let cavityMm = 40;
  if (cavities.length) {
    cavityMm = Math.max(...cavities.map((c) => Number(c.cavity_depth_mm || c.thickness_mm || 40)));
  }
  const insFactor =
    1 +
    (0.15 * absorbers.reduce((s, a) => s + (Number(a.thickness_mm) || 0), 0)) / 100;

  for (const hz of [...MANDATORY_HZ, 4000]) {
    out[hz] = round1(msmDoubleRDb(hz, mOuter, mInner, cavityMm, insFactor));
  }
  return out;
}

function rBand(v) {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= 0) return null;
  return x;
}

/** ISO 717-1 octave Rw from R bands. */
export function computeRw(rByHz) {
  const vals = {};
  for (const f of RW_BANDS) vals[f] = rBand(rByHz[f]);
  if (RW_BANDS.filter((f) => vals[f] != null).length < 4) return null;
  if (vals[4000] == null && vals[2000] != null) vals[4000] = vals[2000];

  let best = null;
  for (let shift = -60; shift <= 80; shift++) {
    let unfav = 0;
    let ok = true;
    for (const f of RW_BANDS) {
      const r = vals[f];
      if (r == null) continue;
      const d = REF_OCTAVE[f] + shift - r;
      if (d > 0) {
        unfav += d;
        if (unfav > MAX_UNFAV + 1e-9) {
          ok = false;
          break;
        }
      }
    }
    if (ok) best = shift;
  }
  if (best == null) return null;
  return Math.round(REF_OCTAVE[500] + best);
}

function adapt(rByHz, rw, spectrum) {
  const vals = {};
  for (const f of RW_BANDS) vals[f] = rBand(rByHz[f]);
  if (vals[4000] == null && vals[2000] != null) vals[4000] = vals[2000];
  let s = 0;
  let n = 0;
  for (const f of RW_BANDS) {
    const r = vals[f];
    if (r == null) continue;
    s += 10 ** ((spectrum[f] - r) / 10);
    n += 1;
  }
  if (n < 4 || s <= 0) return null;
  return Math.round(-10 * Math.log10(s) - rw);
}

export function computeRatings(rByHz) {
  const rw = computeRw(rByHz);
  if (rw == null) return { rw_db: null, c_db: null, ctr_db: null };
  return {
    rw_db: rw,
    c_db: adapt(rByHz, rw, SPEC_C),
    ctr_db: adapt(rByHz, rw, SPEC_CTR),
  };
}

export function approximateRaFromR(rByHz) {
  const vals = MANDATORY_HZ.map((hz) => Number(rByHz[hz])).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  return round1(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * Resolve layer spectrum: prefer catalog material bands, else mass-law from d/ρ.
 * Cavity / negligible → null spectrum (no Rw).
 */
export function layerSpectrumFromInput(layer) {
  const role = layer.acoustic_role || "structural";
  if (role === "cavity" || role === "negligible" || layer.layer_kind === "cavity_ventilated") {
    return {
      method: "none",
      spectrum: null,
      ratings: { rw_db: null, c_db: null, ctr_db: null },
      note: "Geen Rw — spouw/folie (akoestisch verwaarloosbaar of cavity).",
    };
  }

  const hasBands =
    layer.r_125_hz != null &&
    layer.r_250_hz != null &&
    layer.r_500_hz != null &&
    layer.r_1000_hz != null &&
    layer.r_2000_hz != null;

  if (hasBands) {
    const spectrum = {
      63: numOrNull(layer.r_63_hz),
      125: Number(layer.r_125_hz),
      250: Number(layer.r_250_hz),
      500: Number(layer.r_500_hz),
      1000: Number(layer.r_1000_hz),
      2000: Number(layer.r_2000_hz),
      4000: numOrNull(layer.r_4000_hz) ?? Number(layer.r_2000_hz),
    };
    return {
      method: "catalog",
      spectrum,
      ratings: computeRatings(spectrum),
      note: "Spectrum uit homogeen catalogusmateriaal.",
      surface_mass_kg_m2: surfaceMassKgM2(layer.thickness_mm, layer.density_kg_m3),
    };
  }

  // Regelwerk / tengel / panlat: φ = b/a → m″eq (geen volle-plaat massawet).
  if (layer.layer_kind === "framing") {
    const g = woodGridMetrics(layer);
    if (g?.m_eq_kg_m2 != null) {
      return {
        method: "wood_grid",
        spectrum: null,
        ratings: { rw_db: null, c_db: null, ctr_db: null },
        note:
          `Regelwerk φ=${(g.phi * 100).toFixed(1)}% (b/a) → m″eq=${g.m_eq_kg_m2} kg/m² ` +
          `(rekenwaarde, read-only). Geen Rw van latten alleen; massa voor stack.`,
        surface_mass_kg_m2: g.m_eq_kg_m2,
        wood_grid: g,
      };
    }
  }

  const ml = massLawSpectrum(layer.thickness_mm, layer.density_kg_m3);
  if (!ml) {
    return {
      method: "none",
      spectrum: null,
      ratings: { rw_db: null, c_db: null, ctr_db: null },
      note: "Geen spectrum — kies homogeen materiaal of vul dikte + dichtheid.",
      surface_mass_kg_m2: null,
    };
  }
  return {
    method: "mass_law",
    spectrum: ml,
    ratings: computeRatings(ml),
    note: "Massawet-preview uit dikte × dichtheid.",
    surface_mass_kg_m2: surfaceMassKgM2(layer.thickness_mm, layer.density_kg_m3),
  };
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round1(x) {
  return Math.round(x * 10) / 10;
}
