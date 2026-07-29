/** Geometry helpers for floormap room polylines (section-local 0–1 coords). */

export type Pt = { x: number; y: number };

/** Round metres / m² / m³ style quantities to at most 2 decimal places. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return n;
  return Math.round(n * 100) / 100;
}

export function shoelaceArea(points: Pt[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polylinePerimeter(points: Pt[]): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/** Open path length (does not close back to the first vertex). */
export function openPolylineLength(points: Pt[]): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/** Clamp points to [0,1] without closing the ring. */
export function clampPath(points: Pt[]): Pt[] {
  return points.map((p) => ({
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y)),
  }));
}

/** Ensure ring is closed and clamped to [0,1]. */
export function closeRing(points: Pt[]): Pt[] {
  const out = points.map((p) => ({
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y)),
  }));
  if (out.length < 1) return out;
  const f = out[0];
  const l = out[out.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) > 1e-6) out.push({ ...f });
  return out;
}

export function translateRing(points: Pt[], dx: number, dy: number): Pt[] {
  return closeRing(points.map((p) => ({ x: p.x + dx, y: p.y + dy })));
}

/** Unique vertex count of a (possibly closed) ring. */
export function ringVertexCount(points: Pt[]): number {
  if (points.length < 2) return points.length;
  const f = points[0];
  const l = points[points.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) return points.length - 1;
  return points.length;
}

/**
 * Insert intermediate vertices along each edge so the ring is editable as a polyline.
 * `segmentsPerEdge` = 1 keeps corners only; 4 → three midpoints per side.
 */
export function densifyRing(points: Pt[], segmentsPerEdge: number): Pt[] {
  const nSeg = Math.max(1, Math.floor(segmentsPerEdge));
  const count = ringVertexCount(points);
  if (count < 2 || nSeg <= 1) return closeRing(points);
  const ring = points.slice(0, count);
  const out: Pt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push({ x: a.x, y: a.y });
    for (let s = 1; s < nSeg; s++) {
      const t = s / nSeg;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
    }
  }
  return closeRing(out);
}

/** Ensure a closed outline has enough drag anchors (densify sparse rectangles). */
export function ensureEditablePolyline(points: Pt[], minVertices = 16): Pt[] {
  const ring = closeRing(points);
  const n = ringVertexCount(ring);
  if (n >= minVertices) return ring;
  const segs = Math.max(2, Math.ceil(minVertices / Math.max(1, n)));
  return densifyRing(ring, segs);
}

/** Remove one vertex from a closed ring; returns null if fewer than 3 would remain. */
export function removeRingVertex(points: Pt[], index: number): Pt[] | null {
  const n = ringVertexCount(points);
  if (n <= 3) return null;
  if (index < 0 || index >= n) return null;
  const ring = points.slice(0, n);
  ring.splice(index, 1);
  return closeRing(ring);
}

/**
 * Drop superfluous anchors after fitting (RDP). Keeps at least 3 vertices.
 * `epsilon` is in the same units as the points (section-local 0–1).
 */
export function simplifyEditableRing(points: Pt[], epsilon = 0.006): Pt[] {
  const before = ringVertexCount(points);
  if (before <= 3) return closeRing(points);
  const simplified = rdpSimplify(points, Math.max(1e-6, epsilon));
  if (ringVertexCount(simplified) < 3) return closeRing(points);
  return simplified;
}

export function rdpSimplify(points: Pt[], epsilon: number): Pt[] {
  if (points.length < 3) return points.slice();
  const closed =
    Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-9;
  const ring = closed ? points.slice(0, -1) : points.slice();
  if (ring.length < 3) return closeRing(ring);

  function distSeg(p: Pt, a: Pt, b: Pt): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-18) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function rec(pts: Pt[]): Pt[] {
    if (pts.length < 3) return pts.slice();
    let maxD = 0;
    let idx = 0;
    const a = pts[0];
    const b = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) {
      const d = distSeg(pts[i], a, b);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > epsilon) {
      const left = rec(pts.slice(0, idx + 1));
      const right = rec(pts.slice(idx));
      return left.slice(0, -1).concat(right);
    }
    return [a, b];
  }

  return closeRing(rec(ring));
}

/**
 * metres_per_norm_unit (mpu): metres for Δx_norm = 1 (full crop/section width).
 * scale_aspect_yx: cropHeight/cropWidth in pixels. Then Δy_norm = 1 spans mpu * aspect metres.
 *
 * Why aspect matters: section-local x/y are normalized independently by width and height.
 * Treating (x,y) as isotropic overstates area by W/H on landscape crops (and understates on portrait).
 */
export function normalizeAspectYx(aspectYx: number | null | undefined): number {
  if (aspectYx == null || !Number.isFinite(aspectYx) || aspectYx <= 0) return 1;
  return aspectYx;
}

export function scaleAxes(
  metresPerNorm: number,
  aspectYx?: number | null,
): { mx: number; my: number } {
  const a = normalizeAspectYx(aspectYx);
  return { mx: metresPerNorm, my: metresPerNorm * a };
}

/** Physical length of one segment in section-local 0–1 coords. */
export function scaledSegmentLength(
  dx: number,
  dy: number,
  metresPerNorm: number,
  aspectYx?: number | null,
): number {
  const { mx, my } = scaleAxes(metresPerNorm, aspectYx);
  return Math.hypot(dx * mx, dy * my);
}

export function scaledPathLength(
  points: Pt[],
  metresPerNorm: number,
  aspectYx?: number | null,
  closed = false,
): number {
  if (points.length < 2) return 0;
  let sum = 0;
  const n = closed ? points.length : points.length - 1;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += scaledSegmentLength(b.x - a.x, b.y - a.y, metresPerNorm, aspectYx);
  }
  return sum;
}

export function scaledAreaM2(
  areaNorm: number,
  metresPerNorm: number,
  aspectYx?: number | null,
): number {
  const { mx, my } = scaleAxes(metresPerNorm, aspectYx);
  return areaNorm * mx * my;
}

/**
 * metres_per_norm_unit from a calibration line in section-local coords.
 * Uses width-normalized isotropic distance so any orientation yields the same mpu.
 */
export function metresPerNormFromCalibration(
  lengthMetres: number,
  a: Pt,
  b: Pt,
  aspectYx?: number | null,
): number {
  const dist = Math.hypot(b.x - a.x, (b.y - a.y) * normalizeAspectYx(aspectYx));
  if (!(dist > 1e-12) || !(lengthMetres > 0)) return NaN;
  return lengthMetres / dist;
}

export function scaledMetrics(
  points: Pt[],
  metresPerNorm: number | null | undefined,
  aspectYx?: number | null,
): { area_norm: number; perimeter_norm: number; area_m2: number | null; perimeter_m: number | null } {
  const area_norm = shoelaceArea(points);
  const perimeter_norm = polylinePerimeter(points);
  if (metresPerNorm == null || !(metresPerNorm > 0)) {
    return { area_norm, perimeter_norm, area_m2: null, perimeter_m: null };
  }
  return {
    area_norm,
    perimeter_norm,
    area_m2: round2(scaledAreaM2(area_norm, metresPerNorm, aspectYx)),
    perimeter_m: round2(scaledPathLength(points, metresPerNorm, aspectYx, true)),
  };
}

/** Parse 1:100 / 1/100 from PDF text; returns N or null. */
export function parseScaleRatioFromText(text: string): number | null {
  const m = text.match(/\b1\s*[:/]\s*(\d+(?:[.,]\d+)?)\b/);
  if (!m) return null;
  const n = Number(String(m[1]).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Convert paper scale 1:N to metres_per_norm_unit given crop width in PDF points
 * and assuming the floormap width (norm x span = 1) equals the drawn width on paper.
 * PDF user unit ≈ 1/72 inch; 1 inch = 0.0254 m.
 * metres_per_norm ≈ (cropWidthPts / 72 * 0.0254) * N
 */
export function metresPerNormFromPaperScale(scaleRatio: number, cropWidthPdfPoints: number): number {
  const widthMetresOnPaper = (cropWidthPdfPoints / 72) * 0.0254;
  return widthMetresOnPaper * scaleRatio;
}
