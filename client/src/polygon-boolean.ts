/** Boolean polygon ops for façade components (section-local 0–1 rings). */

import polygonClipping from "polygon-clipping";
import { closeRing, ringVertexCount, shoelaceArea, type Pt } from "./geom.ts";

/** Legacy ∩/∪/− plus signed compose. */
export type BooleanOp = "intersect" | "union" | "difference" | "compose";

export type ComposeSign = "+" | "-";

/** Result polygon: outer ring minus optional holes (net area for insulation). */
export type BooleanPolygon = {
  outer: Pt[];
  holes: Pt[][];
  /** Net area in section-local units² (outer − holes). */
  areaNorm: number;
};

export type SignedRing = {
  ring: Pt[];
  sign: ComposeSign;
};

type PcRing = [number, number][];
type PcPoly = PcRing[];
type PcMulti = PcPoly[];

const AREA_EPS = 1e-10;
const CONTAIN_EPS = 1e-8;

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

function netAreaNorm(outer: Pt[], holes: Pt[][]): number {
  const holesSum = holes.reduce((s, h) => s + shoelaceArea(h), 0);
  return Math.max(0, shoelaceArea(outer) - holesSum);
}

/** Convert MultiPolygon (with holes) into BooleanPolygon list, largest net area first. */
function resultToPolygons(multi: PcMulti): BooleanPolygon[] {
  const out: BooleanPolygon[] = [];
  for (const poly of multi) {
    if (!poly || !poly.length) continue;
    const outerRing = poly[0];
    if (!outerRing || outerRing.length < 3) continue;
    const outer = ptsFromRing(outerRing);
    const holes: Pt[][] = [];
    for (let i = 1; i < poly.length; i++) {
      const hole = poly[i];
      if (!hole || hole.length < 3) continue;
      const pts = ptsFromRing(hole);
      if (shoelaceArea(pts) > AREA_EPS) holes.push(pts);
    }
    const areaNorm = netAreaNorm(outer, holes);
    if (areaNorm > AREA_EPS) out.push({ outer, holes, areaNorm });
  }
  out.sort((a, b) => b.areaNorm - a.areaNorm);
  return out;
}

function multiArea(multi: PcMulti): number {
  return resultToPolygons(multi).reduce((s, p) => s + p.areaNorm, 0);
}

/** Ray-cast point-in-polygon (closed ring). Boundary counts as inside. */
export function pointInRing(pt: Pt, ring: Pt[]): boolean {
  const closed = closeRing(ring);
  const n = ringVertexCount(closed);
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = closed[i];
    const b = closed[j];
    const onEdge =
      Math.abs((b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x)) < 1e-12 &&
      pt.x >= Math.min(a.x, b.x) - 1e-12 &&
      pt.x <= Math.max(a.x, b.x) + 1e-12 &&
      pt.y >= Math.min(a.y, b.y) - 1e-12 &&
      pt.y <= Math.max(a.y, b.y) + 1e-12;
    if (onEdge) return true;
    const intersect =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y + 1e-30) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * True if `inner` is closed and lies entirely inside `outer`
 * (all vertices inside + negligible area of inner outside outer).
 */
export function ringFullyContained(inner: Pt[], outer: Pt[]): boolean {
  if (ringVertexCount(inner) < 3 || ringVertexCount(outer) < 3) return false;
  if (shoelaceArea(inner) < AREA_EPS || shoelaceArea(outer) < AREA_EPS) return false;
  const closedInner = closeRing(inner);
  const n = ringVertexCount(closedInner);
  for (let i = 0; i < n; i++) {
    if (!pointInRing(closedInner[i], outer)) return false;
  }
  try {
    const leftover = polygonClipping.difference([ringToPc(inner)], [ringToPc(outer)]);
    return multiArea(leftover) <= CONTAIN_EPS;
  } catch {
    return false;
  }
}

/**
 * Material region = union of all `+` rings, then subtract all `−` rings.
 * Used for façade compose (outer + openings −, or only glass +, etc.).
 */
export function composeSigned(parts: SignedRing[]): BooleanPolygon {
  const plus = parts.filter((p) => p.sign === "+");
  const minus = parts.filter((p) => p.sign === "-");
  if (plus.length < 1) {
    throw new Error("Minstens één deel met + is verplicht");
  }
  const plusPolys: PcPoly[] = plus.map((p) => [ringToPc(p.ring)]);
  let result: PcMulti =
    plusPolys.length === 1
      ? [plusPolys[0]]
      : polygonClipping.union(plusPolys[0], ...plusPolys.slice(1));
  if (minus.length > 0) {
    const minusPolys: PcPoly[] = minus.map((p) => [ringToPc(p.ring)]);
    result = polygonClipping.difference(result, ...minusPolys);
  }
  const out = resultToPolygons(result);
  if (out.length < 1) {
    throw new Error("Compositie is leeg (niets over na +/−)");
  }
  return out[0];
}

/**
 * Apply ∩, ∪ or − across 2+ rings (legacy).
 * For − (difference): largest input ring is the subject; others are subtracted.
 */
export function booleanCombine(op: BooleanOp, rings: Pt[][]): BooleanPolygon[] {
  if (op === "compose") {
    throw new Error("Gebruik composeSigned voor compose");
  }
  if (rings.length < 2) {
    throw new Error("Selecteer minstens 2 componenten");
  }
  let ordered = rings.slice();
  if (op === "difference") {
    ordered = ordered.sort((a, b) => shoelaceArea(b) - shoelaceArea(a));
  }
  const polys: PcPoly[] = ordered.map((r) => [ringToPc(r)]);
  let result: PcMulti;
  if (op === "union") {
    result = polygonClipping.union(polys[0], ...polys.slice(1));
  } else if (op === "difference") {
    result = polygonClipping.difference(polys[0], ...polys.slice(1));
  } else {
    result = polygonClipping.intersection(polys[0], ...polys.slice(1));
  }
  const out = resultToPolygons(result);
  if (out.length < 1) {
    const msg =
      op === "intersect"
        ? "Doorsnede is leeg (geen overlapping)"
        : op === "difference"
          ? "Verschil is leeg (niets over na aftrek)"
          : "Vereniging leverde geen polygoon";
    throw new Error(msg);
  }
  return out;
}

/** Largest net-area polygon from a boolean result (outer + holes). */
export function booleanCombineLargest(op: BooleanOp, rings: Pt[][]): BooleanPolygon {
  return booleanCombine(op, rings)[0];
}
