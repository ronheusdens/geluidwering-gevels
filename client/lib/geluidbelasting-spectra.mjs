/**
 * Vaste geluidbelastingspectra voor rapportage (NPR/NEN-indexen).
 * Spectrum 2 = verkeersgeluid, index Atr (expliciete octaafbanden + totaal).
 */

/** @typedef {{ id: string, label: string, bands_hz: number[], levels_db: number[], total_db: number }} GeluidbelastingSpectrum */

/** @type {Record<string, GeluidbelastingSpectrum>} */
export const GELUIDBELASTING_SPECTRA = {
  SPECTRUM_2: {
    id: "SPECTRUM_2",
    label: "Spectrum 2 — wegverkeer (index Atr)",
    bands_hz: [63, 125, 250, 500, 1000, 2000],
    // Geluidbelasting [dB] per octaafband — vaste Atr-index
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
