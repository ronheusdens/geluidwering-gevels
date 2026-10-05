export type PartNoun = {
  singular: string;
  plural: string;
  title: string;
  kindLabel: string;
};

export function partNoun(kind?: string | null): PartNoun {
  const k = String(kind || "FLOORMAP").toUpperCase();
  if (k === "FLOORMAP") {
    return { singular: "ruimte", plural: "ruimten", title: "Plattegrond", kindLabel: "Plattegrond" };
  }
  if (k === "FACADE") {
    return { singular: "component", plural: "componenten", title: "Gevel", kindLabel: "Gevel" };
  }
  if (k === "CROSS_SECTION") {
    return {
      singular: "component",
      plural: "componenten",
      title: "Dwarsdoorsnede",
      kindLabel: "Dwarsdoorsnede",
    };
  }
  if (k === "SECTION") {
    return {
      singular: "component",
      plural: "componenten",
      title: "Doorsnede",
      kindLabel: "Doorsnede",
    };
  }
  return { singular: "component", plural: "componenten", title: "Tekening", kindLabel: "Tekening" };
}

export function levelLabel(hint?: string | null): string {
  switch (String(hint || "").toUpperCase()) {
    case "SOUTERRAIN":
      return "Souterrain";
    case "GROUND":
      return "Begane vloer";
    case "BEL_ETAGE":
      return "Bel-etage";
    case "FIRST":
      return "1e verdieping";
    case "SECOND":
      return "2e verdieping";
    case "THIRD":
      return "3e verdieping";
    case "ROOF":
      return "Zolder";
    case "OTHER":
      return "Overig";
    default:
      return hint || "Overig";
  }
}

/** Sort key: souterrain → begane vloer → bel-etage → 1e…3e → zolder → overig. */
export function levelSortRank(hint?: string | null): number {
  switch (String(hint || "").toUpperCase()) {
    case "SOUTERRAIN":
      return 0;
    case "GROUND":
      return 1;
    case "BEL_ETAGE":
      return 2;
    case "FIRST":
      return 3;
    case "SECOND":
      return 4;
    case "THIRD":
      return 5;
    case "ROOF":
      return 6;
    case "OTHER":
      return 7;
    default:
      return 8;
  }
}

/** Infer level from a section/room label when level_hint is missing or mixed. */
export function inferLevelHintFromLabel(label?: string | null): string | null {
  const t = String(label || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!t) return null;
  if (/\bsouterrain\b/.test(t) || /\bkelder\b/.test(t)) return "SOUTERRAIN";
  if (/\b(begane|bg\.?|parterre|ground)\b/.test(t) || /\bb\.?\s*g\.?\b/.test(t)) return "GROUND";
  if (/\bbel[-\s]?etage\b/.test(t)) return "BEL_ETAGE";
  if (/\b(zolder|dak|attic|roof)\b/.test(t)) return "ROOF";
  if (/\b(3e|3de|derde)\b/.test(t) || /\bverdieping\s*3\b/.test(t)) return "THIRD";
  if (/\b(2e|2de|tweede)\b/.test(t) || /\bverdieping\s*2\b/.test(t)) return "SECOND";
  if (/\b(1e|1ste|eerste)\b/.test(t) || /\bverdieping\s*1\b/.test(t)) return "FIRST";
  if (/\bverdieping\b/.test(t)) return "FIRST";
  return null;
}

export function normalizeOrientatieCode(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .toUpperCase();
}

export function normalizeVrNr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function compareVrNr(a: string, b: string): number {
  const na = /^\d+$/.test(a) ? Number(a) : NaN;
  const nb = /^\d+$/.test(b) ? Number(b) : NaN;
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b, "nl", { numeric: true });
}

export function collectAvailableVrNrs<T extends { vr_nr?: unknown }>(items: T[]): string[] {
  const set = new Set<string>();
  for (const r of items) {
    const vr = normalizeVrNr(r.vr_nr);
    if (vr) set.add(vr);
  }
  return [...set].sort(compareVrNr);
}

export function roomMatchesVrFilter<T extends { vr_nr?: unknown }>(room: T, filter: string): boolean {
  if (!filter) return true;
  return normalizeVrNr(room.vr_nr) === filter;
}

export function roomListCountLabel(filter: string, visible: number, total: number): string {
  if (filter && visible !== total) return `${visible}/${total}`;
  return String(total);
}
