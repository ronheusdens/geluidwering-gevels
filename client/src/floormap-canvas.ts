import type { Pt } from "./geom";

export type NormRect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export function canvasToNorm(cx: number, cy: number, canvasWidth: number, canvasHeight: number): Pt {
  return {
    x: Math.min(1, Math.max(0, cx / Math.max(1, canvasWidth))),
    y: Math.min(1, Math.max(0, cy / Math.max(1, canvasHeight))),
  };
}

export function canvasToNormUnclamped(cx: number, cy: number, canvasWidth: number, canvasHeight: number): Pt {
  return {
    x: cx / Math.max(1, canvasWidth),
    y: cy / Math.max(1, canvasHeight),
  };
}

export function normToCanvas(p: Pt, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
  return { x: p.x * canvasWidth, y: p.y * canvasHeight };
}

export function eventToCanvas(
  ev: MouseEvent,
  rect: DOMRect,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } {
  return {
    x: ((ev.clientX - rect.left) / Math.max(1, rect.width)) * canvasWidth,
    y: ((ev.clientY - rect.top) / Math.max(1, rect.height)) * canvasHeight,
  };
}

export function normalizeNormRect(a: Pt, b: Pt): NormRect {
  return {
    x0: Math.min(a.x, b.x),
    y0: Math.min(a.y, b.y),
    x1: Math.max(a.x, b.x),
    y1: Math.max(a.y, b.y),
  };
}

export function normRectRing(r: NormRect): Pt[] {
  return [
    { x: r.x0, y: r.y0 },
    { x: r.x1, y: r.y0 },
    { x: r.x1, y: r.y1 },
    { x: r.x0, y: r.y1 },
  ];
}

export function normRectSizeOk(r: NormRect): boolean {
  return r.x1 - r.x0 >= 0.008 && r.y1 - r.y0 >= 0.008;
}

export function hitVertex(
  norm: Pt,
  points: Pt[],
  canvasWidth: number,
  canvasHeight: number,
  pxRadius = 8,
): number {
  const n =
    points.length > 1 &&
    Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6
      ? points.length - 1
      : points.length;
  let best = -1;
  let bestDist = Infinity;
  const w = Math.max(1, canvasWidth);
  const h = Math.max(1, canvasHeight);
  for (let i = 0; i < n; i++) {
    const dx = (points[i].x - norm.x) * w;
    const dy = (points[i].y - norm.y) * h;
    const d = Math.hypot(dx, dy);
    if (d <= pxRadius && d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function vertexHitRadiusPx(detailActive: boolean): number {
  return detailActive ? 16 : 10;
}

/** Pixel radius to snap the draw cursor onto the first vertex and close the polygon. */
export function closeSnapRadiusPx(detailActive: boolean): number {
  return detailActive ? 22 : 16;
}

export function normDistancePx(
  a: Pt,
  b: Pt,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const w = Math.max(1, canvasWidth);
  const h = Math.max(1, canvasHeight);
  return Math.hypot((a.x - b.x) * w, (a.y - b.y) * h);
}

export function canClosePolygonAtCursor(
  norm: Pt,
  points: Pt[],
  canvasWidth: number,
  canvasHeight: number,
  detailActive: boolean,
): boolean {
  if (points.length < 3) return false;
  return normDistancePx(norm, points[0], canvasWidth, canvasHeight) <= closeSnapRadiusPx(detailActive);
}

export function vertexHandleRadiusPx(detailActive: boolean): number {
  return detailActive ? 5 : 2;
}

export function polylineHitRadiusPx(detailActive: boolean): number {
  return detailActive ? 18 : 12;
}

export function dist2PointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 > 1e-12 ? Math.min(1, Math.max(0, (apx * abx + apy * aby) / ab2)) : 0;
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  return dx * dx + dy * dy;
}

export function hitNearPolyline(
  norm: Pt,
  points: Pt[],
  maxPx: number,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  return hitPolylineEdge(norm, points, maxPx, canvasWidth, canvasHeight) != null;
}

/** Closest edge under the cursor; `segmentIndex` is the start vertex of that edge. */
export function hitPolylineEdge(
  norm: Pt,
  points: Pt[],
  maxPx: number,
  canvasWidth: number,
  canvasHeight: number,
): { segmentIndex: number; point: Pt; distPx: number } | null {
  if (points.length < 2) return null;
  const p = normToCanvas(norm, canvasWidth, canvasHeight);
  const max2 = maxPx * maxPx;
  const w = Math.max(1, canvasWidth);
  const h = Math.max(1, canvasHeight);
  let best: { segmentIndex: number; point: Pt; distPx: number } | null = null;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const abx = (b.x - a.x) * w;
    const aby = (b.y - a.y) * h;
    const apx = p.x - a.x * w;
    const apy = p.y - a.y * h;
    const ab2 = abx * abx + aby * aby;
    const t = ab2 > 1e-12 ? Math.min(1, Math.max(0, (apx * abx + apy * aby) / ab2)) : 0;
    // Skip hits that land on an endpoint — those are vertex grabs.
    if (t < 0.08 || t > 0.92) continue;
    const qx = a.x + (b.x - a.x) * t;
    const qy = a.y + (b.y - a.y) * t;
    const dx = p.x - qx * w;
    const dy = p.y - qy * h;
    const d2 = dx * dx + dy * dy;
    if (d2 <= max2 && (!best || d2 < best.distPx * best.distPx)) {
      best = { segmentIndex: i, point: { x: qx, y: qy }, distPx: Math.sqrt(d2) };
    }
  }
  return best;
}

export function pointInRing(pt: Pt, points: Pt[]): boolean {
  const n =
    points.length > 1 &&
    Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6
      ? points.length - 1
      : points.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-15) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
