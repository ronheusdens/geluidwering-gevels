/**
 * Vaste geluidbelastingspectra voor rapportage (NPR/NEN-indexen).
 * Spectrum 2 = verkeersgeluid, vorm index Atr; bandniveaus schalen naar project-Lb.
 */

/** @typedef {{ id: string, label: string, bands_hz: number[], levels_db: number[], total_db: number }} GeluidbelastingSpectrum */

/** @type {Record<string, GeluidbelastingSpectrum>} */
export const GELUIDBELASTING_SPECTRA = {
  SPECTRUM_2: {
    id: "SPECTRUM_2",
    label: "Spectrum 2 — wegverkeer (index Atr)",
    bands_hz: [63, 125, 250, 500, 1000, 2000],
    // Referentievorm Atr bij totaal 61,0 dB (NPR). Bij andere Lb: shiftBandsToTotal.
    levels_db: [43.0, 47.0, 51.0, 54.0, 57.0, 55.0],
    total_db: 61.0,
  },
};

/**
 * @param {string | null | undefined} spectrumKind
 * @returns {GeluidbelastingSpectrum | null}
 */
export function resolveGeluidbelastingSpectrum(spectrumKind) {
  const key = String(spectrumKind || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (GELUIDBELASTING_SPECTRA[key]) return GELUIDBELASTING_SPECTRA[key];
  if (key === "2" || key.includes("SPECTRUM_2") || key.includes("ATR")) {
    return GELUIDBELASTING_SPECTRA.SPECTRUM_2;
  }
  return null;
}

/**
 * Verschuif octaafbanden zodat het Atr-totaal gelijk wordt aan project-Lb (DGMR-gedrag).
 * Vorm (onderlinge verschillen) blijft Spectrum 2; alleen absolute niveaus volgen Lb.
 *
 * @param {GeluidbelastingSpectrum} spec
 * @param {number} targetTotalDb  variant.geluidsbelasting_dba
 * @returns {GeluidbelastingSpectrum}
 */
export function scaleSpectrumToLb(spec, targetTotalDb) {
  const target = Number(targetTotalDb);
  if (!spec || !Number.isFinite(target)) return spec;
  const base = Number(spec.total_db);
  if (!Number.isFinite(base) || Math.abs(target - base) < 0.05) {
    return { ...spec, levels_db: [...spec.levels_db], total_db: base };
  }
  const delta = target - base;
  return {
    ...spec,
    levels_db: spec.levels_db.map((v) => Math.round((Number(v) + delta) * 10) / 10),
    total_db: Math.round(target * 10) / 10,
  };
}

/**
 * Spectrum voor rapport: referentievorm + schaal naar Lb.
 * @param {string | null | undefined} spectrumKind
 * @param {number | null | undefined} lbDb
 */
export function resolveSpectrumForReport(spectrumKind, lbDb) {
  const base = resolveGeluidbelastingSpectrum(spectrumKind);
  if (!base) return null;
  return scaleSpectrumToLb(base, Number(lbDb));
}

/**
 * Korte weergavenaam voor variantbalk / UI.
 * @param {string | null | undefined} spectrumKind
 */
export function spectrumDisplayLabel(spectrumKind) {
  const spec = resolveGeluidbelastingSpectrum(spectrumKind);
  if (spec) return spec.label;
  const raw = String(spectrumKind || "").trim();
  if (!raw) return "—";
  if (/^SPECTRUM_1$/i.test(raw)) return "Spectrum 1";
  if (/^SPECTRUM_2$/i.test(raw)) return GELUIDBELASTING_SPECTRA.SPECTRUM_2.label;
  return raw;
}
