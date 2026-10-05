import { closeRing, ensureEditablePolyline, type Pt } from "./geom";
import { ringFullyContained } from "./polygon-boolean";

export type OpeningShapeLike = "circle" | "rect";

/** Facade discovery: rects stay 4 corners; other shapes get editable anchor density. */
export function discoveredOpeningToSectionPoints(
  normPoints: Pt[],
  shape: OpeningShapeLike,
  minVerticesForComplex = 16,
): Pt[] {
  if (shape === "rect") return closeRing(normPoints);
  return ensureEditablePolyline(normPoints, minVerticesForComplex);
}

export type DiscoveryRoomLike = {
  id: string;
  label: string;
  level_hint: string;
  vg_nr: number | null;
  vr_nr: string | null;
  points: Pt[];
  analysis?: {
    expected_orientaties?: string[];
    orientatie_correcties?: Record<string, { cl_db?: number; cg_db?: number }>;
  } | null;
};

export type PendingDiscoveryEdit = {
  editingId: string | null;
  closed: boolean;
  points: Pt[];
};

export function discoverMinAreaFractionFromPercent(value: string | number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n / 100));
}

export function buildDiscoveryLabel(partSingular: string, roomCount: number): string {
  return `${partSingular.charAt(0).toUpperCase() + partSingular.slice(1)} ${roomCount + 1}`;
}

export function resolveDiscoveryOuter<T extends DiscoveryRoomLike>(
  opts: {
    isFloormapKind: boolean;
    pendingRoom: PendingDiscoveryEdit | null;
    rooms: T[];
    selectedSetIds: Set<string>;
    closeRing: (points: Pt[]) => Pt[];
    isLengthComponent: (room: T) => boolean;
    differenceSubject: (selected: T[]) => T | null;
  },
): T | null {
  if (opts.isFloormapKind) return null;
  const { pendingRoom, rooms, selectedSetIds, closeRing, isLengthComponent, differenceSubject } = opts;
  if (pendingRoom?.editingId && pendingRoom.closed && pendingRoom.points.length >= 3) {
    const editing = rooms.find((r) => r.id === pendingRoom.editingId);
    if (editing) {
      return {
        ...editing,
        points: closeRing(pendingRoom.points.map((p) => ({ ...p }))),
      };
    }
  }
  const selected = rooms.filter((r) => selectedSetIds.has(r.id) && !isLengthComponent(r));
  if (selected.length >= 1) return differenceSubject(selected);
  return null;
}

export function ringCentroidNorm(ring: Pt[]): Pt {
  let x = 0;
  let y = 0;
  const n = Math.max(1, ring.length);
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}

export function openingOverlapsExisting<T extends DiscoveryRoomLike>(
  normRing: Pt[],
  outerId: string,
  rooms: T[],
  shoelaceArea: (points: Pt[]) => number,
  isLengthComponent: (room: T) => boolean,
): boolean {
  const area = shoelaceArea(normRing);
  if (area < 1e-10) return true;
  const ca = ringCentroidNorm(normRing);
  const ra = Math.sqrt(area / Math.PI);
  for (const r of rooms) {
    if (r.id === outerId || isLengthComponent(r)) continue;
    const ar = shoelaceArea(r.points);
    if (ar < 1e-10) continue;
    const cb = ringCentroidNorm(r.points);
    const rb = Math.sqrt(ar / Math.PI);
    const dist = Math.hypot(ca.x - cb.x, ca.y - cb.y);
    const ratio = Math.min(area, ar) / Math.max(area, ar);
    if (dist < (ra + rb) * 0.4 && ratio > 0.5) return true;
    if (ratio > 0.55 && (ringFullyContained(normRing, r.points) || ringFullyContained(r.points, normRing))) {
      return true;
    }
  }
  return false;
}
