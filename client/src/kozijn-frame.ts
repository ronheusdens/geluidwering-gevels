/**
 * Kozijn frame geometry: centerline polylines with per-segment width →
 * buffered wood area, closure check, enclosed glass faces, opening footprint.
 * Coordinates are section-local (typically 0–1). Widths are metres; convert via mpu.
 */

import polygonClipping from "polygon-clipping";
import {
  closeRing,
  ringVertexCount,
  round2,
  scaleAxes,
  scaledAreaM2,
  scaledSegmentLength,
  shoelaceArea,
  type Pt,
} from "./geom.ts";
import { ringFullyContained } from "./polygon-boolean.ts";

export type KozijnSegment = {
  id: string;
  points: Pt[];
  /** Beam width in metres (world). */
  width_m: number;
};

export type KozijnClosure = "open" | "closed" | "warn";

export type KozijnEval = {
  woodPolygons: Pt[][];
  /** Holes of `woodPolygons[0]` (inner edges of the frame ring). */
  woodHoles: Pt[][];
  glassPolygons: Pt[][];
  /** Outer opening ring(s) for wall net-area subtraction. */
  openingPolygons: Pt[][];
  woodAreaNorm: number;
  glassAreaNorm: number;
  openingAreaNorm: number;
  woodAreaM2: number | null;
  glassAreaM2: number | null;
  openingAreaM2: number | null;
  /** Sum of kozijn beam centerline lengths (m). */
  woodBeamLengthM: number | null;
  closure: KozijnClosure;
  closureHint: string;
  danglingEnds: number;
};

type PcRing = [number, number][];
type PcPoly = PcRing[];
type PcMulti = PcPoly[];

const SNAP = 1e-4;
const AREA_EPS = 1e-12;
const MIN_SEG = 1e-9;

/** Default balkbreedte 67 mm. */
export const DEFAULT_KOZIJN_WIDTH_M = 0.067;

function keyOf(p: Pt, tol = SNAP): string {
  return `${Math.round(p.x / tol)}:${Math.round(p.y / tol)}`;
}

function snapPt(p: Pt, tol = SNAP): Pt {
  return {
    x: Math.round(p.x / tol) * tol,
    y: Math.round(p.y / tol) * tol,
  };
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function ringToPc(points: Pt[]): PcRing {
  const closed = closeRing(points);
  const ring: PcRing = closed.map((p) => [p.x, p.y]);
  if (ring.length >= 1) {
    const a = ring[0];
    const b = ring[ring.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]]);
  }
  return ring;
}

function ptsFromRing(ring: PcRing): Pt[] {
  return closeRing(ring.map(([x, y]) => ({ x, y })));
}

function multiToPolygonParts(multi: PcMulti): Array<{ outer: Pt[]; holes: Pt[][] }> {
  const out: Array<{ outer: Pt[]; holes: Pt[][] }> = [];
  for (const poly of multi || []) {
    if (!poly?.length) continue;
    const outerRing = poly[0];
    if (!outerRing || outerRing.length < 3) continue;
    const outer = ptsFromRing(outerRing);
    if (!(shoelaceArea(outer) > AREA_EPS)) continue;
    const holes: Pt[][] = [];
    for (let i = 1; i < poly.length; i++) {
      const h = ptsFromRing(poly[i]);
      if (shoelaceArea(h) > AREA_EPS) holes.push(h);
    }
    out.push({ outer, holes });
  }
  out.sort((a, b) => shoelaceArea(b.outer) - shoelaceArea(a.outer));
  return out;
}

function multiToPolygons(multi: PcMulti): Pt[][] {
  return multiToPolygonParts(multi).map((p) => p.outer);
}

/** Net area of a MultiPolygon (outers minus holes). */
function multiAreaNorm(multi: PcMulti): number {
  let sum = 0;
  for (const { outer, holes } of multiToPolygonParts(multi)) {
    sum += shoelaceArea(outer) - holes.reduce((s, h) => s + shoelaceArea(h), 0);
  }
  return Math.max(0, sum);
}

/**
 * Kozijn wood quantity: Σ (beam centerline length × balkbreedte).
 * Corner overlaps are NOT subtracted — intentional (avoids ± / boolean cut).
 */
export function kozijnWoodBeamMetrics(
  segments: KozijnSegment[],
  metresPerNorm: number | null | undefined,
  aspectYx?: number | null,
): { lengthM: number; areaM2: number | null; areaNorm: number } {
  const edges = flattenSegments(segments);
  if (!edges.length) return { lengthM: 0, areaM2: null, areaNorm: 0 };
  if (metresPerNorm == null || !(metresPerNorm > 0)) {
    return { lengthM: 0, areaM2: null, areaNorm: 0 };
  }
  let lengthM = 0;
  let areaM2 = 0;
  for (const e of edges) {
    const lenM = scaledSegmentLength(e.b.x - e.a.x, e.b.y - e.a.y, metresPerNorm, aspectYx);
    if (!(lenM > 0)) continue;
    const w = e.width_m > 0 ? e.width_m : DEFAULT_KOZIJN_WIDTH_M;
    lengthM += lenM;
    areaM2 += lenM * w;
  }
  const { mx, my } = scaleAxes(metresPerNorm, aspectYx);
  const denom = mx * my;
  return {
    lengthM: round2(lengthM),
    areaM2: round2(areaM2),
    areaNorm: denom > 0 ? areaM2 / denom : 0,
  };
}

function unionPolys(polys: PcPoly[]): PcMulti {
  if (!polys.length) return [];
  if (polys.length === 1) return [polys[0]];
  try {
    return polygonClipping.union(polys[0], ...polys.slice(1));
  } catch {
    return polys.length ? [polys[0]] : [];
  }
}

/** Rectangle (capsule without round caps) for one open segment a→b. */
export function bufferSegmentNorm(a: Pt, b: Pt, halfWidthNorm: number): Pt[] | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (!(len > MIN_SEG) || !(halfWidthNorm > 0)) return null;
  const nx = (-dy / len) * halfWidthNorm;
  const ny = (dx / len) * halfWidthNorm;
  return closeRing([
    { x: a.x + nx, y: a.y + ny },
    { x: b.x + nx, y: b.y + ny },
    { x: b.x - nx, y: b.y - ny },
    { x: a.x - nx, y: a.y - ny },
  ]);
}

/** Convert metres width → section-norm half-width (isotropic via mpu). */
export function halfWidthNormFromMetres(
  width_m: number,
  metresPerNorm: number | null | undefined,
): number {
  if (!(width_m > 0) || metresPerNorm == null || !(metresPerNorm > 0)) return 0;
  return width_m / 2 / metresPerNorm;
}

function segmentEdgeBuffers(seg: KozijnSegment, halfW: number): Pt[][] {
  if (!(halfW > 0) || seg.points.length < 2) return [];
  const out: Pt[][] = [];
  for (let i = 0; i < seg.points.length - 1; i++) {
    const a = snapPt(seg.points[i]);
    const b = snapPt(seg.points[i + 1]);
    const rect = bufferSegmentNorm(a, b, halfW);
    if (rect) out.push(rect);
  }
  return out;
}

/** Split segments at crossings so H/V crosses form a proper planar graph. */
function splitEdgesAtIntersections(
  edges: Array<{ a: Pt; b: Pt; width_m: number }>,
): Array<{ a: Pt; b: Pt; width_m: number }> {
  const out: Array<{ a: Pt; b: Pt; width_m: number }> = [];
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const cuts: number[] = [0, 1];
    for (let j = 0; j < edges.length; j++) {
      if (i === j) continue;
      const t = segmentIntersectionT(e.a, e.b, edges[j].a, edges[j].b);
      if (t != null && t > SNAP && t < 1 - SNAP) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let k = 0; k < cuts.length - 1; k++) {
      const t0 = cuts[k];
      const t1 = cuts[k + 1];
      if (t1 - t0 < SNAP) continue;
      const a = snapPt({
        x: e.a.x + (e.b.x - e.a.x) * t0,
        y: e.a.y + (e.b.y - e.a.y) * t0,
      });
      const b = snapPt({
        x: e.a.x + (e.b.x - e.a.x) * t1,
        y: e.a.y + (e.b.y - e.a.y) * t1,
      });
      if (dist(a, b) > SNAP) out.push({ a, b, width_m: e.width_m });
    }
  }
  return out;
}

/** Parametric t on ab for intersection with cd, or null. */
function segmentIntersectionT(a: Pt, b: Pt, c: Pt, d: Pt): number | null {
  const rX = b.x - a.x;
  const rY = b.y - a.y;
  const sX = d.x - c.x;
  const sY = d.y - c.y;
  const den = rX * sY - rY * sX;
  if (Math.abs(den) < 1e-14) return null;
  const t = ((c.x - a.x) * sY - (c.y - a.y) * sX) / den;
  const u = ((c.x - a.x) * rY - (c.y - a.y) * rX) / den;
  if (t < -SNAP || t > 1 + SNAP || u < -SNAP || u > 1 + SNAP) return null;
  return Math.min(1, Math.max(0, t));
}

type Half = {
  from: string;
  to: string;
  ang: number;
  next?: Half;
  used?: boolean;
  twin?: Half;
};

/**
 * Face-walk on undirected edges → bounded face rings (centerline).
 * At each vertex, outgoing edges are sorted by angle; for half-edge u→v the
 * next edge of the face is the successor of v→u in that cyclic order (left turn).
 */
function boundedFacesFromEdges(edges: Array<{ a: Pt; b: Pt }>): Pt[][] {
  type Node = { p: Pt; outs: Half[] };
  const nodes = new Map<string, Node>();
  const ensure = (p: Pt): Node => {
    const k = keyOf(p);
    let n = nodes.get(k);
    if (!n) {
      n = { p: snapPt(p), outs: [] };
      nodes.set(k, n);
    }
    return n;
  };

  for (const e of edges) {
    if (dist(e.a, e.b) < SNAP) continue;
    const na = ensure(e.a);
    const nb = ensure(e.b);
    const ka = keyOf(na.p);
    const kb = keyOf(nb.p);
    const ha: Half = {
      from: ka,
      to: kb,
      ang: Math.atan2(nb.p.y - na.p.y, nb.p.x - na.p.x),
    };
    const hb: Half = {
      from: kb,
      to: ka,
      ang: Math.atan2(na.p.y - nb.p.y, na.p.x - nb.p.x),
    };
    ha.twin = hb;
    hb.twin = ha;
    na.outs.push(ha);
    nb.outs.push(hb);
  }

  for (const n of nodes.values()) {
    n.outs.sort((x, y) => x.ang - y.ang);
  }
  for (const n of nodes.values()) {
    for (const h of n.outs) {
      const twin = h.twin!;
      const dest = nodes.get(h.to)!;
      const idx = dest.outs.indexOf(twin);
      if (idx < 0) continue;
      // Left-turn face: next after twin in CCW (increasing ang) order.
      h.next = dest.outs[(idx + 1) % dest.outs.length];
    }
  }

  const faces: Pt[][] = [];
  for (const n of nodes.values()) {
    for (const start of n.outs) {
      if (start.used) continue;
      const ring: Pt[] = [];
      let h: Half | undefined = start;
      let guard = 0;
      while (h && !h.used && guard++ < 10_000) {
        h.used = true;
        const node = nodes.get(h.from);
        if (node) ring.push(node.p);
        h = h.next;
        if (h === start) break;
      }
      if (ring.length >= 3) {
        const closed = closeRing(ring);
        const area = shoelaceArea(closed);
        if (area > AREA_EPS) faces.push(closed);
      }
    }
  }

  // Exterior face = largest; keep only bounded cells.
  if (faces.length <= 1) return [];
  faces.sort((a, b) => shoelaceArea(b) - shoelaceArea(a));
  return faces.slice(1);
}

function flattenSegments(segments: KozijnSegment[]): Array<{ a: Pt; b: Pt; width_m: number }> {
  const raw: Array<{ a: Pt; b: Pt; width_m: number }> = [];
  for (const seg of segments) {
    if (seg.points.length < 2) continue;
    const w = seg.width_m > 0 ? seg.width_m : 0.067;
    for (let i = 0; i < seg.points.length - 1; i++) {
      const a = snapPt(seg.points[i]);
      const b = snapPt(seg.points[i + 1]);
      if (dist(a, b) > SNAP) raw.push({ a, b, width_m: w });
    }
  }
  return splitEdgesAtIntersections(raw);
}

function countDanglingEnds(edges: Array<{ a: Pt; b: Pt }>): number {
  const deg = new Map<string, number>();
  for (const e of edges) {
    const ka = keyOf(e.a);
    const kb = keyOf(e.b);
    deg.set(ka, (deg.get(ka) || 0) + 1);
    deg.set(kb, (deg.get(kb) || 0) + 1);
  }
  let n = 0;
  for (const d of deg.values()) if (d === 1) n += 1;
  return n;
}

/**
 * Evaluate a kozijn frame draft.
 * `metresPerNorm` needed for width→norm and m²; without it, areas stay norm-only.
 */
export function evaluateKozijnFrame(
  segments: KozijnSegment[],
  metresPerNorm: number | null | undefined,
  aspectYx?: number | null,
): KozijnEval {
  const empty: KozijnEval = {
    woodPolygons: [],
    woodHoles: [],
    glassPolygons: [],
    openingPolygons: [],
    woodAreaNorm: 0,
    glassAreaNorm: 0,
    openingAreaNorm: 0,
    woodAreaM2: null,
    glassAreaM2: null,
    openingAreaM2: null,
    woodBeamLengthM: null,
    closure: "open",
    closureHint: "Teken hartlijnen van kozijnbalken",
    danglingEnds: 0,
  };
  if (!segments.length) return empty;

  const edges = flattenSegments(segments);
  if (!edges.length) return empty;

  const danglingEnds = countDanglingEnds(edges);
  const woodRects: PcPoly[] = [];
  for (const e of edges) {
    const half = halfWidthNormFromMetres(e.width_m, metresPerNorm);
    if (!(half > 0)) continue;
    const rect = bufferSegmentNorm(e.a, e.b, half);
    if (rect) woodRects.push([ringToPc(rect)]);
  }
  // Fallback when no scale: tiny visual width in norm units (~0.5% of crop)
  if (!woodRects.length) {
    for (const e of edges) {
      const rect = bufferSegmentNorm(e.a, e.b, 0.004);
      if (rect) woodRects.push([ringToPc(rect)]);
    }
  }

  const woodMulti = unionPolys(woodRects);
  const woodParts = multiToPolygonParts(woodMulti);
  const woodPolygons = woodParts.map((p) => p.outer);
  const woodHoles = woodParts[0]?.holes?.slice() || [];

  // Oppervlakte = Σ(lengte × balkbreedte); geometrie blijft voor tekening/glas.
  const beam = kozijnWoodBeamMetrics(segments, metresPerNorm, aspectYx);

  const faces = boundedFacesFromEdges(edges.map((e) => ({ a: e.a, b: e.b })));
  let openingPolygons: Pt[][] = [];
  let glassPolygons: Pt[][] = [];

  if (faces.length) {
    const facePolys: PcPoly[] = faces.map((f) => [ringToPc(f)]);
    const openingMulti = unionPolys(facePolys);
    openingPolygons = multiToPolygons(openingMulti);
    if (woodMulti.length && openingMulti.length) {
      try {
        const glassMulti = polygonClipping.difference(openingMulti, woodMulti);
        glassPolygons = multiToPolygons(glassMulti).filter((p) => shoelaceArea(p) > AREA_EPS * 10);
      } catch {
        glassPolygons = [];
      }
    } else {
      glassPolygons = openingPolygons.slice();
    }
  }

  const openingAreaNorm = openingPolygons.reduce((s, p) => s + shoelaceArea(p), 0);
  const glassAreaNorm = glassPolygons.reduce((s, p) => s + shoelaceArea(p), 0);

  let closure: KozijnClosure = "open";
  let closureHint = "";
  if (danglingEnds > 0 && faces.length === 0) {
    closure = "open";
    closureHint = `${danglingEnds} open einde(n) — sluit het kader (en kruizen)`;
  } else if (danglingEnds > 0 && faces.length > 0) {
    closure = "warn";
    closureHint = `${faces.length} cel(len), maar nog ${danglingEnds} open einde(n)`;
  } else if (faces.length > 0 && danglingEnds === 0) {
    closure = "closed";
    closureHint = `Gesloten · ${faces.length} ruitvlak(ken)`;
  } else {
    closure = "open";
    closureHint = "Nog geen gesloten kader";
  }

  const mpu = metresPerNorm != null && metresPerNorm > 0 ? metresPerNorm : null;
  return {
    woodPolygons,
    woodHoles,
    glassPolygons,
    openingPolygons,
    woodAreaNorm: beam.areaNorm,
    glassAreaNorm,
    openingAreaNorm,
    woodAreaM2: beam.areaM2,
    glassAreaM2: mpu ? round2(scaledAreaM2(glassAreaNorm, mpu, aspectYx)) : null,
    openingAreaM2: mpu ? round2(scaledAreaM2(openingAreaNorm, mpu, aspectYx)) : null,
    woodBeamLengthM: beam.areaM2 != null ? beam.lengthM : null,
    closure,
    closureHint,
    danglingEnds,
  };
}

export function newKozijnSegmentId(): string {
  return `kz-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function orthoSnapPoint(from: Pt, to: Pt): Pt {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  if (dx >= dy) return { x: to.x, y: from.y };
  return { x: from.x, y: to.y };
}

/**
 * Snap targets: segment endpoints + crossings between edges.
 * Optional `extraPoints` (e.g. live polyline vertices) are included as junctions.
 */
export function collectKozijnSnapTargets(
  segments: KozijnSegment[],
  extraPoints: Pt[] = [],
): Pt[] {
  const byKey = new Map<string, Pt>();
  const add = (p: Pt) => {
    const s = snapPt(p);
    byKey.set(keyOf(s), s);
  };
  for (const seg of segments) {
    for (const p of seg.points) add(p);
  }
  for (const p of extraPoints) add(p);

  const edges = flattenSegments(segments);
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const t = segmentIntersectionT(edges[i].a, edges[i].b, edges[j].a, edges[j].b);
      if (t == null) continue;
      const e = edges[i];
      add({
        x: e.a.x + (e.b.x - e.a.x) * t,
        y: e.a.y + (e.b.y - e.a.y) * t,
      });
    }
  }
  return [...byKey.values()];
}

/** Nearest target within `maxDist` (norm units), or null. */
export function nearestKozijnSnap(pt: Pt, targets: Pt[], maxDist: number): Pt | null {
  if (!(maxDist > 0) || !targets.length) return null;
  let best: Pt | null = null;
  let bestD = maxDist;
  for (const t of targets) {
    const d = dist(pt, t);
    if (d <= bestD) {
      bestD = d;
      best = t;
    }
  }
  return best ? { ...best } : null;
}

/** True when `a` and `b` share an axis within snap tolerance (H/V). */
export function kozijnAxisAligned(a: Pt, b: Pt, tol = SNAP * 5): boolean {
  return Math.abs(a.x - b.x) <= tol || Math.abs(a.y - b.y) <= tol;
}

/** Closest point on segment ab to p (clamped). */
export function closestPointOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > MIN_SEG * MIN_SEG)) return snapPt(a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.min(1, Math.max(0, t));
  return snapPt({ x: a.x + dx * t, y: a.y + dy * t });
}

/** All edge pieces from segments (after intersection splits). */
export function kozijnEdgePieces(
  segments: KozijnSegment[],
): Array<{ a: Pt; b: Pt }> {
  return flattenSegments(segments).map((e) => ({ a: e.a, b: e.b }));
}

/**
 * Snap `pt` onto the nearest existing edge (T-junction for dwarsbalken).
 * Returns null if farther than `tolNorm`.
 */
export function snapPointToKozijnEdge(
  pt: Pt,
  segments: KozijnSegment[],
  tolNorm: number,
): Pt | null {
  if (!(tolNorm > 0) || !segments.length) return null;
  let best: Pt | null = null;
  let bestD = tolNorm;
  for (const e of kozijnEdgePieces(segments)) {
    const q = closestPointOnSegment(pt, e.a, e.b);
    const d = dist(pt, q);
    if (d <= bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/**
 * Weld: eerst T-kruisingen (einden → kaderlijn), daarna cluster nabije hoeken.
 * (Eerst clusteren zou de geprojecteerde tip terugtrekken naar het te-korte einde.)
 */
export function weldKozijnPoints(
  segments: KozijnSegment[],
  extraPoints: Pt[] = [],
  tolNorm = SNAP * 50,
): { segments: KozijnSegment[]; extraPoints: Pt[] } {
  const tol = tolNorm > 0 ? tolNorm : SNAP * 50;

  // 1) T-junctions vóór clustering.
  let segs: KozijnSegment[] = segments.map((seg) => ({
    ...seg,
    points: seg.points.map((p) => ({ ...p })),
  }));
  segs = segs.map((seg) => {
    if (seg.points.length < 2) return seg;
    const others = segs.filter((s) => s.id !== seg.id);
    const pts = seg.points.map((p) => ({ ...p }));
    const a = snapPointToKozijnEdge(pts[0], others, tol);
    const b = snapPointToKozijnEdge(pts[pts.length - 1], others, tol);
    if (a) pts[0] = a;
    if (b) pts[pts.length - 1] = b;
    return { ...seg, points: pts };
  });
  let extra = extraPoints.map((p) => ({ ...p }));
  if (extra.length >= 1) {
    const a = snapPointToKozijnEdge(extra[0], segs, tol);
    const b = snapPointToKozijnEdge(extra[extra.length - 1], segs, tol);
    if (a) extra[0] = a;
    if (b && extra.length > 1) extra[extra.length - 1] = b;
  }

  // 2) Cluster nabije hoeken.
  const reps: Pt[] = [];
  const resolve = (p: Pt): Pt => {
    for (const r of reps) {
      if (dist(p, r) <= tol) return r;
    }
    const s = snapPt(p);
    reps.push(s);
    return s;
  };
  segs = segs.map((seg) => ({
    ...seg,
    points: seg.points.map((p) => ({ ...resolve(p) })),
  }));
  extra = extra.map((p) => ({ ...resolve(p) }));

  return { segments: segs, extraPoints: extra };
}

/** Pixel→norm tolerance helper for floormap weld (min canvas side). */
export function kozijnWeldTolFromPixels(px: number, canvasW: number, canvasH: number): number {
  const side = Math.max(1, Math.min(canvasW, canvasH));
  return Math.max(SNAP * 20, px / side);
}

/** Serialize for analysis.kozijn_frame */
export function serializeKozijnFrame(segments: KozijnSegment[], assemblyId: string, evalResult: KozijnEval) {
  return {
    assembly_id: assemblyId,
    segments: segments.map((s) => ({
      id: s.id,
      width_m: s.width_m,
      points: s.points.map((p) => ({ x: p.x, y: p.y })),
    })),
    opening: evalResult.openingPolygons.map((ring) =>
      ring.map((p) => ({ x: p.x, y: p.y })),
    ),
    opening_area_norm: evalResult.openingAreaNorm,
    wood_beam_length_m: evalResult.woodBeamLengthM,
    wood_area_m2: evalResult.woodAreaM2,
  };
}

export function parseKozijnFrame(raw: unknown): {
  assemblyId: string;
  segments: KozijnSegment[];
  opening: Pt[][];
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const assemblyId = String(o.assembly_id || "").trim();
  if (!assemblyId || !Array.isArray(o.segments)) return null;
  const segments: KozijnSegment[] = [];
  for (const s of o.segments) {
    if (!s || typeof s !== "object") continue;
    const row = s as Record<string, unknown>;
    const pts = Array.isArray(row.points)
      ? (row.points as Array<{ x?: number; y?: number }>)
          .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      : [];
    if (pts.length < 2) continue;
    const w = Number(row.width_m);
    segments.push({
      id: String(row.id || newKozijnSegmentId()),
      points: pts,
      width_m: w > 0 ? w : DEFAULT_KOZIJN_WIDTH_M,
    });
  }
  const opening: Pt[][] = [];
  if (Array.isArray(o.opening)) {
    for (const ring of o.opening) {
      if (!Array.isArray(ring)) continue;
      const pts = (ring as Array<{ x?: number; y?: number }>)
        .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      if (pts.length >= 3) opening.push(closeRing(pts));
    }
  }
  return { assemblyId, segments, opening };
}

/** Sum opening areas of assemblies fully contained in wall ring. */
export function openingAreaNormInsideWall(
  wallRing: Pt[],
  openings: Array<{ ring: Pt[]; areaNorm?: number }>,
): number {
  let sum = 0;
  for (const op of openings) {
    if (ringVertexCount(op.ring) < 3) continue;
    if (!ringFullyContained(op.ring, wallRing)) continue;
    sum += op.areaNorm != null && op.areaNorm > 0 ? op.areaNorm : shoelaceArea(op.ring);
  }
  return sum;
}
