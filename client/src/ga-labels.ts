export type RoomLabelLike = {
  vg_nr?: string | number | null;
  vr_nr?: string | null;
  label?: string | null;
  level_hint?: string | null;
  area_m2?: number | string | null;
};

export function vgLabelFromNr(vgNr: string | number, fallback = "Verblijfsgebied"): string {
  const n = String(vgNr).trim();
  return n ? `VG ${n}` : fallback;
}

export function vrLabelFromNr(vrNr: string, roomLabel?: string): string {
  const n = String(vrNr || "").trim();
  const room = (roomLabel || "").trim();
  if (n && room && room !== n) return `VR ${n} · ${room}`;
  if (n) return `VR ${n}`;
  return room || "Verblijfsruimte";
}

export function parseVgNrFromText(text: string): number | null {
  const m = String(text || "").trim().match(/^VG\s+(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function levelLabel(hint?: string | null): string {
  switch (String(hint || "").toUpperCase()) {
    case "SOUTERRAIN":
      return "Souterrain";
    case "GROUND":
      return "Begane grond";
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

export function isGroundLevel(hint?: string | null): boolean {
  return String(hint || "").toUpperCase() === "GROUND";
}

export function sortByLabelAz<T>(items: T[], label: (item: T) => string): T[] {
  return items
    .slice()
    .sort((a, b) => label(a).localeCompare(label(b), undefined, { sensitivity: "base", numeric: true }));
}

export function formatVrListLine(r: RoomLabelLike, volumeM3?: number): string {
  const bits = [
    r.vr_nr ? `VR ${r.vr_nr}` : null,
    r.label || null,
    levelLabel(r.level_hint),
    r.area_m2 != null ? `${Number(r.area_m2).toFixed(2)} m²` : null,
    volumeM3 != null ? `V=${Number(volumeM3).toFixed(1)} m³` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

export function formatRoomSummary(r: RoomLabelLike): string {
  const bits = [
    r.vg_nr != null ? `VG ${r.vg_nr}` : null,
    r.vr_nr ? `VR ${r.vr_nr}` : null,
    r.label || null,
    levelLabel(r.level_hint),
    r.area_m2 != null ? `${Number(r.area_m2).toFixed(2)} m²` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}
