/** Boolean polygon ops for façade components (section-local 0–1 rings). */

import polygonClipping from "polygon-clipping";
import { closeRing, shoelaceArea, type Pt } from "./geom.ts";

export type BooleanOp = "intersect" | "union" | "difference";

/** Result polygon: outer ring minus optional holes (net area for insulation). */
export type BooleanPolygon = {
  outer: Pt[];
  holes: Pt[][];
  /** Net area in section-local units² (outer − holes). */
  areaNorm: number;
};

type PcRing = [number, number][];
type PcPoly = PcRing[];
type PcMulti = PcPoly[];

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
      if (shoelaceArea(pts) > 1e-10) holes.push(pts);
    }
    const areaNorm = netAreaNorm(outer, holes);
    if (areaNorm > 1e-10) out.push({ outer, holes, areaNorm });
  }
  out.sort((a, b) => b.areaNorm - a.areaNorm);
  return out;
}

/**
 * Apply ∩, ∪ or − across 2+ rings.
 * For − (difference): largest input ring is the subject; others are subtracted
 * (e.g. gevel − kozijnen). Holes are preserved so net area is correct.
 */
export function booleanCombine(op: BooleanOp, rings: Pt[][]): BooleanPolygon[] {
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
