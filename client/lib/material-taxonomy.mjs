/**
 * DGMR Geluidwering Gevels material taxonomy (rubriek + category-specific subrubriek).
 * Source: GG catalog UI. Subrubriek nr 0 = "all" filter only (not stored on rows).
 */

/** @typedef {{ nr: number, name: string }} Rubriek */
/** @typedef {{ nr: number, name: string }} Subrubriek */

/** @type {Rubriek[]} */
export const MATERIAL_RUBRIEKEN = [
  { nr: 1, name: "Steenachtigen/beton/blokken" },
  { nr: 2, name: "Glas" },
  { nr: 3, name: "Dak-, vloer-, plafondconstructies" },
  { nr: 4, name: "Lichte paneelconstr./borstweringen/deuren" },
  { nr: 5, name: "Enkelvoudige plaatmaterialen/panelen" },
  { nr: 6, name: "Ventilatievoorzieningen" },
  { nr: 7, name: "Ventilatievoorzieningen oud (voor 1-1-2012)" },
  { nr: 8, name: "Lichte scheidingsconstructies" },
  { nr: 9, name: "Kier- en naaddichtingsprofielen" },
];

/** @type {Record<number, Subrubriek[]>} */
export const MATERIAL_SUBRUBRIEKEN = {
  1: [
    { nr: 1, name: "Baksteen licht/zwaar" },
    { nr: 2, name: "Kalkzandsteen" },
    { nr: 3, name: "Grindbeton/natuursteen" },
    { nr: 4, name: "Lichtbeton/cellenbeton" },
    { nr: 5, name: "(hout-)vezelbeton" },
    { nr: 6, name: "Lichte blokken/gipsblokken" },
    { nr: 7, name: "Voorzetwanden" },
    { nr: 8, name: "Enkelsteensmuur, rekenmethode" },
    { nr: 9, name: "Spouwmuur, rekenmethode" },
    { nr: 10, name: "Diversen" },
  ],
  2: [
    { nr: 1, name: "Enkel glas" },
    { nr: 2, name: "Dubbel glas" },
    { nr: 3, name: "Enkel glas gelamineerd" },
    { nr: 4, name: "Dubbel glas 1-zijdig gelamineerd" },
    { nr: 5, name: "Dubbel glas 2-zijdig gelamineerd" },
    { nr: 6, name: "Schuiframen" },
    { nr: 7, name: "Enkel glas, rekenmethode T" },
    { nr: 8, name: "Dubbel glas, rekenmethode T" },
    { nr: 9, name: "Diversen" },
    { nr: 10, name: "Drievoudig glas" },
  ],
  3: [
    { nr: 1, name: "Plat dak houtachtig" },
    { nr: 2, name: "Plat dak (gas)beton" },
    { nr: 3, name: "Plat dak metaalplaat" },
    { nr: 4, name: "Hellend dak houtachtig" },
    { nr: 5, name: "Hellend dak gas(beton)" },
    { nr: 6, name: "Dakramen" },
    { nr: 7, name: "Dakkapellen" },
    { nr: 8, name: "Vloeren" },
    { nr: 9, name: "Diversen" },
  ],
  4: [
    { nr: 1, name: "Sandwich panelen" },
    { nr: 2, name: "Samengestelde panelen" },
    { nr: 3, name: "Deuren" },
    { nr: 4, name: "Samengestelde vloeren" },
    { nr: 5, name: "Kozijnen" },
    { nr: 6, name: "Diversen" },
  ],
  5: [
    { nr: 1, name: "Spaanplaat/board" },
    { nr: 2, name: "Triplex/multiplex/meubelplaat" },
    { nr: 3, name: "Hout/vloerdelen" },
    { nr: 4, name: "Gipsplaat/asbestcement" },
    { nr: 5, name: "Mineraalvezels/mineraalwol" },
    { nr: 6, name: "Kunststof (massief)" },
    { nr: 7, name: "Metaalplaat" },
    { nr: 8, name: "Diversen" },
  ],
  6: [
    { nr: 1, name: "Openingen/roosters" },
    { nr: 2, name: "Suskasten" },
    { nr: 3, name: "Muurdempers" },
    { nr: 4, name: "Dakdempers" },
    { nr: 5, name: "Mechanische ventilatie unit" },
    { nr: 6, name: "Diversen" },
    { nr: 7, name: "Ventilatie rekenmethode RM" },
  ],
  7: [
    { nr: 1, name: "Openingen/roosters" },
    { nr: 2, name: "Suskasten" },
    { nr: 3, name: "Muurdempers" },
    { nr: 4, name: "Diversen" },
  ],
  8: [
    { nr: 1, name: "Gipskarton wanden. U-profielen" },
    { nr: 2, name: "Gipskarton wanden. Stijlen" },
    { nr: 3, name: "Spaanplaatachtige wanden" },
    { nr: 4, name: "Metalen wanden" },
    { nr: 5, name: "Houtwolcement wanden" },
    { nr: 6, name: "Schuifbare wanden" },
    { nr: 7, name: "Diversen" },
  ],
  9: [
    { nr: 1, name: "Kierdichtingsprofielen" },
    { nr: 2, name: "Naaddichtingsprofielen" },
    { nr: 3, name: "Beglazingsranden" },
  ],
};

export function rubriekByNr(nr) {
  return MATERIAL_RUBRIEKEN.find((r) => r.nr === Number(nr)) || null;
}

export function rubriekByName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return null;
  return (
    MATERIAL_RUBRIEKEN.find((r) => r.name.toLowerCase() === n) ||
    MATERIAL_RUBRIEKEN.find((r) => n.startsWith(r.name.toLowerCase().slice(0, 24))) ||
    null
  );
}

export function subrubriekenFor(rubriekNr) {
  return MATERIAL_SUBRUBRIEKEN[Number(rubriekNr)] || [];
}

export function subrubriekByNr(rubriekNr, subNr) {
  return subrubriekenFor(rubriekNr).find((s) => s.nr === Number(subNr)) || null;
}

export function formatRubriekLabel(r) {
  return `${r.nr}. ${r.name}`;
}

export function formatSubrubriekLabel(s) {
  return `${s.nr} - ${s.name}`;
}

/** Rubriek 9 (kier-/naaddichting) uses length in metres, not area. */
export function isLengthQuantityRubriek(nrOrName) {
  if (nrOrName == null || nrOrName === "") return false;
  if (typeof nrOrName === "number" && Number.isFinite(nrOrName)) {
    return Number(nrOrName) === 9;
  }
  const n = String(nrOrName).trim().toLowerCase();
  if (n === "9") return true;
  const rub = rubriekByName(n) || MATERIAL_RUBRIEKEN.find((r) => n.includes("kier"));
  return Boolean(rub && rub.nr === 9);
}
