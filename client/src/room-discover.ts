/**
 * Contour-based closed polyline discovery on a floormap / façade bitmap.
 * Returns rings in image pixel coords; caller converts to section-local 0–1.
 */
import { closeRing, polylinePerimeter, rdpSimplify, shoelaceArea, type Pt } from "./geom";

/** Close a ring in arbitrary units (pixels) — must NOT use closeRing (clamps to 0–1). */
function closePx(points: Pt[]): Pt[] {
  if (!points.length) return [];
  const out = points.map((p) => ({ x: p.x, y: p.y }));
  const f = out[0];
  const l = out[out.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) > 1e-6) out.push({ ...f });
  return out;
}

/** Ray-cast; used locally so this module stays free of polygon-clipping. */
function pointInRingLocal(pt: Pt, ring: Pt[]): boolean {
  const closed = closePx(ring);
  const n =
    closed.length >= 2 &&
    Math.hypot(closed[0].x - closed[closed.length - 1].x, closed[0].y - closed[closed.length - 1].y) < 1e-9
      ? closed.length - 1
      : closed.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = closed[i];
    const b = closed[j];
    const intersect =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y + 1e-30) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function luminance(data: Uint8ClampedArray, i: number): number {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/** Build binary ink map (1 = ink) at working resolution. */
function toInkMap(
  img: ImageData,
  sw: number,
  sh: number,
): Uint8Array {
  const { width: w, height: h, data } = img;
  const ink = new Uint8Array(sw * sh);
  const scaleX = w / sw;
  const scaleY = h / sh;

  // Sample mean luminance for threshold
  let sum = 0;
  let n = 0;
  for (let y = 0; y < sh; y += 2) {
    for (let x = 0; x < sw; x += 2) {
      const sx = Math.min(w - 1, Math.floor(x * scaleX));
      const sy = Math.min(h - 1, Math.floor(y * scaleY));
      sum += luminance(data, (sy * w + sx) * 4);
      n++;
    }
  }
  const mean = n ? sum / n : 180;
  const thresh = Math.min(170, Math.max(90, mean * 0.72));

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const sx = Math.min(w - 1, Math.floor(x * scaleX));
      const sy = Math.min(h - 1, Math.floor(y * scaleY));
      ink[y * sw + x] = luminance(data, (sy * w + sx) * 4) < thresh ? 1 : 0;
    }
  }
  return ink;
}

function dilate(src: Uint8Array, w: number, h: number): Uint8Array {
  const dst = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let v = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (src[(y + dy) * w + (x + dx)]) v = 1;
        }
      }
      dst[y * w + x] = v;
    }
  }
  return dst;
}

function erode(src: Uint8Array, w: number, h: number): Uint8Array {
  const dst = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let v = 1;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!src[(y + dy) * w + (x + dx)]) v = 0;
        }
      }
      dst[y * w + x] = v;
    }
  }
  return dst;
}

/** Invert: rooms are paper regions enclosed by ink walls → flood paper, keep interior blobs. */
function paperMask(ink: Uint8Array, w: number, h: number): Uint8Array {
  const paper = new Uint8Array(w * h);
  for (let i = 0; i < ink.length; i++) paper[i] = ink[i] ? 0 : 1;
  return paper;
}

/** Remove edge-touching paper (exterior). */
function removeBorderConnected(paper: Uint8Array, w: number, h: number): Uint8Array {
  const out = paper.slice();
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * w + x;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (!out[i]) return;
    out[i] = 0;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return out;
}

type Blob = { id: number; pixels: number[]; minX: number; minY: number; maxX: number; maxY: number };

function labelBlobs(mask: Uint8Array, w: number, h: number): Blob[] {
  const labels = new Int32Array(w * h);
  const blobs: Blob[] = [];
  let next = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || labels[i]) continue;
      const id = next++;
      const pixels: number[] = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [i];
      labels[i] = id;
      while (stack.length) {
        const cur = stack.pop()!;
        pixels.push(cur);
        const cx = cur % w;
        const cy = (cur / w) | 0;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neigh = [cur + 1, cur - 1, cur + w, cur - w];
        for (const n of neigh) {
          if (n < 0 || n >= labels.length) continue;
          if (!mask[n] || labels[n]) continue;
          const nx = n % w;
          const ny = (n / w) | 0;
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
          labels[n] = id;
          stack.push(n);
        }
      }
      blobs.push({ id, pixels, minX, minY, maxX, maxY });
    }
  }
  return blobs;
}

/** Trace outer boundary of a blob using Moore neighborhood. */
function traceContour(mask: Uint8Array, w: number, h: number, blob: Blob): Pt[] | null {
  const set = new Set(blob.pixels);
  // Find leftmost top pixel
  let start = -1;
  for (let y = blob.minY; y <= blob.maxY; y++) {
    for (let x = blob.minX; x <= blob.maxX; x++) {
      const i = y * w + x;
      if (set.has(i)) {
        start = i;
        break;
      }
    }
    if (start >= 0) break;
  }
  if (start < 0) return null;

  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const pts: Pt[] = [];
  let x = start % w;
  let y = (start / w) | 0;
  let dir = 0;
  const startX = x;
  const startY = y;
  let guard = 0;
  const maxSteps = blob.pixels.length * 8 + 100;

  do {
    pts.push({ x, y });
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8;
      const nx = x + dirs[nd][0];
      const ny = y + dirs[nd][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (!set.has(ny * w + nx)) continue;
      x = nx;
      y = ny;
      dir = nd;
      found = true;
      break;
    }
    if (!found) break;
    guard++;
  } while ((x !== startX || y !== startY) && guard < maxSteps);

  if (pts.length < 4) return null;
  return pts;
}

export type DiscoveredRoom = { points: Pt[]; areaPx: number };

function blobToRingPixels(blob: Blob, w0: number, h0: number, sw: number, sh: number): Pt[] {
  // Axis-aligned fallback when contour trace fails
  return closePx([
    { x: (blob.minX / sw) * w0, y: (blob.minY / sh) * h0 },
    { x: ((blob.maxX + 1) / sw) * w0, y: (blob.minY / sh) * h0 },
    { x: ((blob.maxX + 1) / sw) * w0, y: ((blob.maxY + 1) / sh) * h0 },
    { x: (blob.minX / sw) * w0, y: ((blob.maxY + 1) / sh) * h0 },
  ]);
}

function roomsFromPaperMask(
  paper: Uint8Array,
  sw: number,
  sh: number,
  w0: number,
  h0: number,
): DiscoveredRoom[] {
  const blobs = labelBlobs(paper, sw, sh);
  const total = sw * sh;
  const minPx = Math.max(40, total * 0.0015);
  const maxPx = total * 0.55;
  const rooms: DiscoveredRoom[] = [];

  for (const blob of blobs) {
    if (blob.pixels.length < minPx || blob.pixels.length > maxPx) continue;
    const bw = blob.maxX - blob.minX + 1;
    const bh = blob.maxY - blob.minY + 1;
    if (bw < 6 || bh < 6) continue;

    let ring: Pt[] | null = null;
    const contour = traceContour(paper, sw, sh, blob);
    if (contour && contour.length >= 4) {
      const mapped = contour.map((p) => ({
        x: (p.x / sw) * w0,
        y: (p.y / sh) * h0,
      }));
      ring = closePx(rdpSimplify(mapped, Math.max(0.6, Math.min(w0, h0) * 0.0015)));
    }
    if (!ring || ring.length < 4) {
      ring = blobToRingPixels(blob, w0, h0, sw, sh);
    }
    const area = shoelaceArea(ring);
    if (area < minPx * (w0 / sw) * (h0 / sh) * 0.35) continue;
    rooms.push({ points: ring, areaPx: area });
  }

  rooms.sort((a, b) => b.areaPx - a.areaPx);
  return rooms;
}

/**
 * Discover closed room-like regions on an ImageData floormap crop.
 * Returns polylines in **pixel coordinates** of the input image.
 */
export function discoverRoomPolylines(img: ImageData): DiscoveredRoom[] {
  const w0 = img.width;
  const h0 = img.height;
  if (w0 < 40 || h0 < 40) return [];

  const scale = Math.min(1, 560 / Math.max(w0, h0));
  const sw = Math.max(40, Math.floor(w0 * scale));
  const sh = Math.max(40, Math.floor(h0 * scale));

  let ink = toInkMap(img, sw, sh);
  ink = dilate(ink, sw, sh);
  ink = dilate(ink, sw, sh);
  ink = erode(ink, sw, sh);

  const paperFull = paperMask(ink, sw, sh);
  const paperInterior = removeBorderConnected(paperFull, sw, sh);

  let rooms = roomsFromPaperMask(paperInterior, sw, sh, w0, h0);
  // CAD plans often open to the page edge — also try without border flood removal
  if (rooms.length < 2) {
    const alt = roomsFromPaperMask(paperFull, sw, sh, w0, h0).filter((r) => {
      // drop near-full-frame false positives
      const xs = r.points.map((p) => p.x);
      const ys = r.points.map((p) => p.y);
      const bw = Math.max(...xs) - Math.min(...xs);
      const bh = Math.max(...ys) - Math.min(...ys);
      return bw < w0 * 0.92 && bh < h0 * 0.92;
    });
    if (alt.length > rooms.length) rooms = alt;
  }

  return rooms.slice(0, 50);
}

/** Convert pixel polyline on crop canvas to section-local 0–1. */
export function pixelsToSectionNorm(points: Pt[], canvasW: number, canvasH: number): Pt[] {
  return closeRing(
    points.map((p) => ({
      x: p.x / Math.max(1, canvasW),
      y: p.y / Math.max(1, canvasH),
    })),
  );
}

export type OpeningKind = "dark_fill" | "paper_pocket" | "line_rect";

export type OpeningShape = "circle" | "rect";

export type DiscoveredOpening = DiscoveredRoom & {
  kind: OpeningKind;
  shape: OpeningShape;
  /** 4πA / P² — ~1 for a circle, ~0.78 for a square. */
  circularity: number;
  suggestedLabel: string;
};

export type DiscoverInteriorMeta = {
  inputW: number;
  inputH: number;
  workW: number;
  workH: number;
  lineWorkW: number;
  lineWorkH: number;
  kindCounts: Record<OpeningKind, number>;
};

export type DiscoverInteriorOptions = {
  /** 0 = kleinste openingen; 1 = minimaal zo groot als buitencontour (≈ niets). */
  minAreaFraction?: number;
  /** Max lange zijde werkbitmap voor blobs (client default 640; server typisch 2048). */
  maxWorkDim?: number;
  /** Max lange zijde voor H/V-lijn-assen (default = maxWorkDim). */
  maxLineWorkDim?: number;
  /** Wordt ingevuld wanneer meegegeven — diagnostiek server/client. */
  meta?: DiscoverInteriorMeta;
};

const LINE_REF_DIM = 640;

const RECT_FILL_MIN = 0.72;

function circularityOf(ring: Pt[]): number {
  const a = shoelaceArea(ring);
  const p = polylinePerimeter(ring);
  if (a < 1e-6 || p < 1e-6) return 0;
  return Math.min(1.2, (4 * Math.PI * a) / (p * p));
}

function suggestOpeningLabel(shape: OpeningShape, index1: number): string {
  if (shape === "circle") return `Rond kozijn ${index1}`;
  return `Kozijn ${index1}`;
}

/** True when most contour edges are horizontal or vertical (within tolerance). */
function isContourAxisAligned(ring: Pt[], angleTolDeg = 14): boolean {
  const closed = closePx(ring);
  if (closed.length < 4) return false;
  let aligned = 0;
  let total = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const dx = closed[i + 1].x - closed[i].x;
    const dy = closed[i + 1].y - closed[i].y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) continue;
    total++;
    const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
    const mod90 = Math.min(angle % 90, 90 - (angle % 90));
    if (mod90 <= angleTolDeg) aligned++;
  }
  return total >= 3 && aligned / total >= 0.72;
}

/** Facade openings are H/V rectangles; do not classify blobs as circles. */
function classifyBlobShape(blob: Blob, ring: Pt[]): OpeningShape | null {
  const bw = blob.maxX - blob.minX + 1;
  const bh = blob.maxY - blob.minY + 1;
  const bboxArea = bw * bh;
  const fill = blob.pixels.length / Math.max(1, bboxArea);
  const aspect = Math.max(bw, bh) / Math.max(1, Math.min(bw, bh));

  if (aspect > 12) return null;
  if (fill < 0.32) return null;
  if (fill >= RECT_FILL_MIN && (fill >= 0.86 || isContourAxisAligned(ring))) return "rect";
  if (fill >= 0.55 && aspect <= 8) return "rect";
  return null;
}

function rasterizeOuterMask(
  outerPx: Pt[],
  sw: number,
  sh: number,
  w0: number,
  h0: number,
): Uint8Array {
  const mask = new Uint8Array(sw * sh);
  const sx = sw / Math.max(1, w0);
  const sy = sh / Math.max(1, h0);
  const ring = outerPx.map((p) => ({ x: p.x * sx, y: p.y * sy }));
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (pointInRingLocal({ x: x + 0.5, y: y + 0.5 }, ring)) mask[y * sw + x] = 1;
    }
  }
  return mask;
}

/**
 * Thin erosion of a binary mask (one pixel per pass). Peels the outer wall so
 * discovery ignores the contour line itself.
 */
function erodeMask(src: Uint8Array, w: number, h: number, passes = 2): Uint8Array {
  let cur = src;
  for (let p = 0; p < passes; p++) {
    const dst = new Uint8Array(cur.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!cur[i]) continue;
        let ok = 1;
        for (let dy = -1; dy <= 1 && ok; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!cur[(y + dy) * w + (x + dx)]) {
              ok = 0;
              break;
            }
          }
        }
        dst[i] = ok;
      }
    }
    cur = dst;
  }
  return cur;
}

function andMask(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] && b[i] ? 1 : 0;
  return out;
}

/**
 * Clear paper pixels that touch the outside of `search` (or the image edge).
 * Leaves true enclosed cavities (outlined windows) intact.
 */
function removePaperTouchingSearchBorder(
  paper: Uint8Array,
  search: Uint8Array,
  w: number,
  h: number,
): Uint8Array {
  const out = paper.slice();
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (!out[i]) return;
    out[i] = 0;
    stack.push(i);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!out[i] || !search[i]) {
        out[i] = 0;
        continue;
      }
      let seed = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      if (!seed) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || !search[ny * w + nx]) {
            seed = true;
            break;
          }
        }
      }
      if (seed) push(x, y);
    }
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return out;
}

function ringCentroid(ring: Pt[]): Pt {
  let x = 0;
  let y = 0;
  const n = Math.max(1, ring.length);
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}

function openingsTooSimilar(a: Pt[], b: Pt[]): boolean {
  const ca = ringCentroid(a);
  const cb = ringCentroid(b);
  const aa = shoelaceArea(a);
  const ab = shoelaceArea(b);
  if (aa < 1 || ab < 1) return false;
  const dist = Math.hypot(ca.x - cb.x, ca.y - cb.y);
  const ra = Math.sqrt(aa / Math.PI);
  const rb = Math.sqrt(ab / Math.PI);
  if (dist > (ra + rb) * 0.35) return false;
  const ratio = Math.min(aa, ab) / Math.max(aa, ab);
  return ratio > 0.55;
}

type AxisSeg = { a: number; b: number; c: number };

function edgeInk(ink: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(ink.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!ink[i]) continue;
      if (!ink[i - 1] || !ink[i + 1] || !ink[i - w] || !ink[i + w]) out[i] = 1;
    }
  }
  return out;
}

/** Drop diagonal strokes: keep pixels only on long horizontal or vertical ink runs. */
function keepAxisAlignedInk(ink: Uint8Array, w: number, h: number, minLen: number): Uint8Array {
  const out = new Uint8Array(ink.length);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!ink[y * w + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < w && ink[y * w + x]) x++;
      if (x - start >= minLen) {
        for (let xx = start; xx < x; xx++) out[y * w + xx] = 1;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!ink[y * w + x]) {
        y++;
        continue;
      }
      const start = y;
      while (y < h && ink[y * w + x]) y++;
      if (y - start >= minLen) {
        for (let yy = start; yy < y; yy++) out[yy * w + x] = 1;
      }
    }
  }
  return out;
}

function openingKindScore(kind: OpeningKind): number {
  return kind === "line_rect" ? 3 : kind === "paper_pocket" ? 2 : 1;
}

function extractAxisSegs(mask: Uint8Array, w: number, h: number, minLen: number): { h: AxisSeg[]; v: AxisSeg[] } {
  const hSegs: AxisSeg[] = [];
  const vSegs: AxisSeg[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!mask[y * w + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < w && mask[y * w + x]) x++;
      if (x - start >= minLen) hSegs.push({ a: start, b: x - 1, c: y });
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!mask[y * w + x]) {
        y++;
        continue;
      }
      const start = y;
      while (y < h && mask[y * w + x]) y++;
      if (y - start >= minLen) vSegs.push({ a: start, b: y - 1, c: x });
    }
  }
  return { h: hSegs, v: vSegs };
}

type SegCluster = { pos: number; segs: AxisSeg[] };

function clusterSegs(segs: AxisSeg[], bin: number): SegCluster[] {
  const sorted = segs.slice().sort((a, b) => a.c - b.c || a.a - b.a);
  const clusters: SegCluster[] = [];
  for (const s of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(s.c - last.pos) <= bin) {
      last.segs.push(s);
      last.pos = (last.pos * (last.segs.length - 1) + s.c) / last.segs.length;
    } else {
      clusters.push({ pos: s.c, segs: [s] });
    }
  }
  return clusters;
}

function intervalCover(segs: AxisSeg[], from: number, to: number): number {
  const span = to - from;
  if (span <= 1) return 0;
  const iv: Array<[number, number]> = [];
  for (const s of segs) {
    const a = Math.max(s.a, from);
    const b = Math.min(s.b, to);
    if (b > a) iv.push([a, b]);
  }
  if (!iv.length) return 0;
  iv.sort((p, q) => p[0] - q[0]);
  let covered = 0;
  let cs = iv[0][0];
  let ce = iv[0][1];
  for (let i = 1; i < iv.length; i++) {
    if (iv[i][0] <= ce + 1) ce = Math.max(ce, iv[i][1]);
    else {
      covered += ce - cs;
      cs = iv[i][0];
      ce = iv[i][1];
    }
  }
  covered += ce - cs;
  return covered / span;
}

/** True when the side is a local segment, not a long façade line that merely overlaps. */
function sideIsLocal(segs: AxisSeg[], from: number, to: number, minCover: number): boolean {
  const sideLen = to - from;
  if (sideLen < 1) return false;
  let maxLen = 0;
  let maxOverlap = 0;
  for (const s of segs) {
    const ov = Math.min(s.b, to) - Math.max(s.a, from);
    if (ov <= 0) continue;
    if (ov > maxOverlap) maxOverlap = ov;
    if (ov > sideLen * 0.5) maxLen = Math.max(maxLen, s.b - s.a);
  }
  if (maxOverlap / sideLen < minCover) return false;
  if (maxLen > sideLen * 1.4) return false;
  return true;
}

function rectInkFraction(
  ink: Uint8Array,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const ix0 = Math.ceil(x0) + 2;
  const iy0 = Math.ceil(y0) + 2;
  const ix1 = Math.floor(x1) - 2;
  const iy1 = Math.floor(y1) - 2;
  if (ix1 <= ix0 || iy1 <= iy0) return 1;
  let n = 0;
  let inkN = 0;
  for (let y = iy0; y <= iy1; y++) {
    for (let x = ix0; x <= ix1; x++) {
      n++;
      if (ink[y * w + x]) inkN++;
    }
  }
  return n ? inkN / n : 1;
}

type LineRect = { x0: number; y0: number; x1: number; y1: number; area: number };

type LineDetectParams = {
  minLen: number;
  minSide: number;
  clusterBin: number;
  minCover: number;
  maxAspect: number;
  maxInteriorInk: number;
  nestTol: number;
};

/** Scale H/V line thresholds so physical size stays constant across work resolutions. */
function lineDetectParams(sw: number, sh: number): LineDetectParams {
  const s = Math.min(sw, sh) / LINE_REF_DIM;
  return {
    minLen: Math.max(4, Math.round(8 * s)),
    minSide: Math.max(6, Math.round(10 * s)),
    clusterBin: Math.max(1, Math.round(2 * s)),
    minCover: 0.68,
    maxAspect: 8,
    maxInteriorInk: 0.28,
    nestTol: Math.max(2, Math.round(2 * s)),
  };
}

function findClosedLineRects(
  ink: Uint8Array,
  search: Uint8Array,
  sw: number,
  sh: number,
  p: LineDetectParams = lineDetectParams(sw, sh),
): LineRect[] {
  const edges = edgeInk(andMask(ink, search), sw, sh);
  const { h, v } = extractAxisSegs(edges, sw, sh, p.minLen);
  if (h.length < 2 || v.length < 2) return [];

  let bin = p.clusterBin;
  let hCl = clusterSegs(h, bin);
  let vCl = clusterSegs(v, bin);
  while ((hCl.length > 55 || vCl.length > 55) && bin < p.clusterBin + 3) {
    bin += 1;
    hCl = clusterSegs(h, bin);
    vCl = clusterSegs(v, bin);
  }
  if (hCl.length < 2 || vCl.length < 2) return [];

  const found: LineRect[] = [];

  for (let i = 0; i < vCl.length; i++) {
    for (let j = i + 1; j < vCl.length; j++) {
      const x0 = Math.min(vCl[i].pos, vCl[j].pos);
      const x1 = Math.max(vCl[i].pos, vCl[j].pos);
      const width = x1 - x0;
      if (width < p.minSide) continue;
      const left = vCl[i].pos <= vCl[j].pos ? vCl[i] : vCl[j];
      const right = vCl[i].pos <= vCl[j].pos ? vCl[j] : vCl[i];
      for (let pIdx = 0; pIdx < hCl.length; pIdx++) {
        for (let q = pIdx + 1; q < hCl.length; q++) {
          const y0 = Math.min(hCl[pIdx].pos, hCl[q].pos);
          const y1 = Math.max(hCl[pIdx].pos, hCl[q].pos);
          const height = y1 - y0;
          if (height < p.minSide) continue;
          const aspect = Math.max(width, height) / Math.min(width, height);
          if (aspect > p.maxAspect) continue;
          const top = hCl[pIdx].pos <= hCl[q].pos ? hCl[pIdx] : hCl[q];
          const bot = hCl[pIdx].pos <= hCl[q].pos ? hCl[q] : hCl[pIdx];
          if (intervalCover(top.segs, x0, x1) < p.minCover) continue;
          if (intervalCover(bot.segs, x0, x1) < p.minCover) continue;
          if (intervalCover(left.segs, y0, y1) < p.minCover) continue;
          if (intervalCover(right.segs, y0, y1) < p.minCover) continue;
          if (!sideIsLocal(top.segs, x0, x1, p.minCover)) continue;
          if (!sideIsLocal(bot.segs, x0, x1, p.minCover)) continue;
          if (!sideIsLocal(left.segs, y0, y1, p.minCover)) continue;
          if (!sideIsLocal(right.segs, y0, y1, p.minCover)) continue;
          if (rectInkFraction(ink, sw, x0, y0, x1, y1) > p.maxInteriorInk) continue;
          found.push({ x0, y0, x1, y1, area: width * height });
        }
      }
    }
  }

  found.sort((a, b) => b.area - a.area);
  const kept: LineRect[] = [];
  for (const r of found) {
    const nested = kept.some(
      (k) =>
        r.x0 >= k.x0 - p.nestTol &&
        r.y0 >= k.y0 - p.nestTol &&
        r.x1 <= k.x1 + p.nestTol &&
        r.y1 <= k.y1 + p.nestTol,
    );
    if (nested) continue;
    const dup = kept.some((k) => {
      const ox0 = Math.max(k.x0, r.x0);
      const oy0 = Math.max(k.y0, r.y0);
      const ox1 = Math.min(k.x1, r.x1);
      const oy1 = Math.min(k.y1, r.y1);
      if (ox1 <= ox0 || oy1 <= oy0) return false;
      const inter = (ox1 - ox0) * (oy1 - oy0);
      return inter / Math.min(k.area, r.area) > 0.7;
    });
    if (dup) continue;
    kept.push(r);
  }
  return kept;
}

function lineRectToOpening(
  r: LineRect,
  sw: number,
  sh: number,
  w0: number,
  h0: number,
): DiscoveredOpening {
  const ring = closePx([
    { x: (r.x0 / sw) * w0, y: (r.y0 / sh) * h0 },
    { x: (r.x1 / sw) * w0, y: (r.y0 / sh) * h0 },
    { x: (r.x1 / sw) * w0, y: (r.y1 / sh) * h0 },
    { x: (r.x0 / sw) * w0, y: (r.y1 / sh) * h0 },
  ]);
  const area = shoelaceArea(ring);
  return {
    points: ring,
    areaPx: area,
    kind: "line_rect",
    shape: "rect",
    circularity: circularityOf(ring),
    suggestedLabel: suggestOpeningLabel("rect", 0),
  };
}

function blobToOpening(
  blob: Blob,
  mask: Uint8Array,
  sw: number,
  sh: number,
  w0: number,
  h0: number,
  kind: OpeningKind,
): DiscoveredOpening | null {
  let probe: Pt[] | null = null;
  const contour = traceContour(mask, sw, sh, blob);
  if (contour && contour.length >= 4) {
    const mapped = contour.map((p) => ({
      x: (p.x / sw) * w0,
      y: (p.y / sh) * h0,
    }));
    // Keep enough detail for round windows (smaller epsilon than room discovery).
    probe = closePx(rdpSimplify(mapped, Math.max(0.35, Math.min(w0, h0) * 0.0009)));
  }
  if (!probe || probe.length < 4) {
    probe = blobToRingPixels(blob, w0, h0, sw, sh);
  }

  const shape = classifyBlobShape(blob, probe);
  if (!shape) return null;

  const ring = blobToRingPixels(blob, w0, h0, sw, sh);
  const area = shoelaceArea(ring);
  if (area < 8) return null;
  const circ = circularityOf(ring);
  return {
    points: ring,
    areaPx: area,
    kind,
    shape,
    circularity: circ,
    suggestedLabel: suggestOpeningLabel(shape, 0),
  };
}

/**
 * Discover openings (kozijnen, glasvlakken, …) **inside** an outer façade contour.
 * `outerNorm` is section-local 0–1. Returns rings in **pixel** coords of `img`.
 *
 * Bitmap analysis: adaptive ink threshold + dark-fill blobs, enclosed paper pockets,
 * and closed H/V line-segment rectangles (outline kozijnen without dark fill).
 * Restricted to an eroded outer mask (so the outer wall itself is ignored).
 */
export function discoverInteriorOpenings(
  img: ImageData,
  outerNorm: Pt[],
  opts?: DiscoverInteriorOptions,
): DiscoveredOpening[] {
  const w0 = img.width;
  const h0 = img.height;
  if (w0 < 40 || h0 < 40 || !outerNorm || outerNorm.length < 3) return [];

  const outerPx = closePx(
    outerNorm.map((p) => ({
      x: p.x * w0,
      y: p.y * h0,
    })),
  );
  const outerAreaPx = shoelaceArea(outerPx);
  if (outerAreaPx < 80) return [];

  const maxWorkDim = Math.max(64, Math.min(4096, opts?.maxWorkDim ?? 640));
  const maxLineWorkDim = Math.max(64, Math.min(4096, opts?.maxLineWorkDim ?? maxWorkDim));
  const scale = Math.min(1, maxWorkDim / Math.max(w0, h0));
  const sw = Math.max(40, Math.floor(w0 * scale));
  const sh = Math.max(40, Math.floor(h0 * scale));
  const lineScale = Math.min(1, maxLineWorkDim / Math.max(w0, h0));
  const lsw = Math.max(40, Math.floor(w0 * lineScale));
  const lsh = Math.max(40, Math.floor(h0 * lineScale));

  const outerMask = rasterizeOuterMask(outerPx, sw, sh, w0, h0);
  // Mild peel — keep cavities; 2px is enough to ignore a thin CAD stroke.
  const search = erodeMask(outerMask, sw, sh, 2);
  const linePeel = Math.max(2, Math.round(2 * (Math.min(lsw, lsh) / LINE_REF_DIM)));
  const lineOuterMask = rasterizeOuterMask(outerPx, lsw, lsh, w0, h0);
  const lineSearch = erodeMask(lineOuterMask, lsw, lsh, linePeel);
  let searchCount = 0;
  for (let i = 0; i < search.length; i++) if (search[i]) searchCount++;
  if (searchCount < 40) return [];

  // Prefer raw ink for dark fills (no morphology that fattens the outer wall into the field).
  const inkRaw = toInkMap(img, sw, sh);
  const inkLineFull = lsw === sw && lsh === sh ? inkRaw : toInkMap(img, lsw, lsh);
  const lineParams = lineDetectParams(lsw, lsh);
  const inkLine = keepAxisAlignedInk(inkLineFull, lsw, lsh, lineParams.minLen);
  let inkMorph = dilate(inkRaw, sw, sh);
  inkMorph = erode(inkMorph, sw, sh);

  const dark = andMask(inkRaw, search);
  const paperFull = paperMask(inkMorph, sw, sh);
  const paperInSearch = andMask(paperFull, search);
  const paperCavities = removePaperTouchingSearchBorder(paperInSearch, search, sw, sh);

  const minPx = Math.max(8, Math.floor(searchCount * 0.002));
  const maxPx = Math.floor(searchCount * 0.5);
  const minFrac = Math.max(0, Math.min(1, opts?.minAreaFraction ?? 0));
  const minAreaImg =
    minFrac <= 0 ? outerAreaPx * 0.002 : outerAreaPx * minFrac;
  const maxAreaImg = outerAreaPx * 0.98;

  const raw: DiscoveredOpening[] = [];

  const pushBlobs = (mask: Uint8Array, kind: OpeningKind) => {
    for (const blob of labelBlobs(mask, sw, sh)) {
      if (blob.pixels.length < minPx || blob.pixels.length > maxPx) continue;
      const bw = blob.maxX - blob.minX + 1;
      const bh = blob.maxY - blob.minY + 1;
      if (bw < 4 || bh < 4) continue;
      // Skip thin wall-like blobs (aspect extreme + low fill).
      const bboxArea = bw * bh;
      const fill = blob.pixels.length / Math.max(1, bboxArea);
      if (kind === "dark_fill" && fill < 0.35 && Math.max(bw, bh) / Math.min(bw, bh) > 4) continue;
      const opening = blobToOpening(blob, mask, sw, sh, w0, h0, kind);
      if (!opening) continue;
      if (opening.areaPx < minAreaImg || opening.areaPx > maxAreaImg) continue;
      const c = ringCentroid(opening.points);
      if (!pointInRingLocal(c, outerPx)) continue;
      raw.push(opening);
    }
  };

  pushBlobs(dark, "dark_fill");
  pushBlobs(paperCavities, "paper_pocket");
  for (const r of findClosedLineRects(inkLine, lineSearch, lsw, lsh)) {
    const opening = lineRectToOpening(r, lsw, lsh, w0, h0);
    if (opening.areaPx < minAreaImg || opening.areaPx > Math.min(maxAreaImg, outerAreaPx * 0.5)) continue;
    const c = ringCentroid(opening.points);
    if (!pointInRingLocal(c, outerPx)) continue;
    raw.push(opening);
  }

  raw.sort((a, b) => {
    const kd = openingKindScore(b.kind) - openingKindScore(a.kind);
    if (kd) return kd;
    return b.areaPx - a.areaPx;
  });

  const kept: DiscoveredOpening[] = [];
  for (const o of raw) {
    const dupIdx = kept.findIndex((k) => openingsTooSimilar(k.points, o.points));
    if (dupIdx >= 0) {
      if (openingKindScore(o.kind) > openingKindScore(kept[dupIdx].kind)) {
        kept[dupIdx] = o;
      }
      continue;
    }
    const c = ringCentroid(o.points);
    if (
      kept.some(
        (k) =>
          k.areaPx > o.areaPx &&
          o.areaPx < k.areaPx * 0.85 &&
          pointInRingLocal(c, k.points),
      )
    ) {
      continue;
    }
    kept.push(o);
  }

  kept.sort((a, b) => b.areaPx - a.areaPx);

  const result = kept.slice(0, 40).map((o, i) => ({
    ...o,
    suggestedLabel: suggestOpeningLabel(o.shape, i + 1),
  }));

  if (opts?.meta) {
    const kindCounts: Record<OpeningKind, number> = {
      dark_fill: 0,
      paper_pocket: 0,
      line_rect: 0,
    };
    for (const o of result) kindCounts[o.kind]++;
    opts.meta.inputW = w0;
    opts.meta.inputH = h0;
    opts.meta.workW = sw;
    opts.meta.workH = sh;
    opts.meta.lineWorkW = lsw;
    opts.meta.lineWorkH = lsh;
    opts.meta.kindCounts = kindCounts;
  }

  return result;
}

/** Debug counts for unit tests / tuning. */
export function debugInteriorDiscovery(img: ImageData, outerNorm: Pt[]): Record<string, number> {
  const w0 = img.width;
  const h0 = img.height;
  const outerPx = closePx(outerNorm.map((p) => ({ x: p.x * w0, y: p.y * h0 })));
  const scale = Math.min(1, 640 / Math.max(w0, h0));
  const sw = Math.max(40, Math.floor(w0 * scale));
  const sh = Math.max(40, Math.floor(h0 * scale));
  const outerMask = rasterizeOuterMask(outerPx, sw, sh, w0, h0);
  const search = erodeMask(outerMask, sw, sh, 2);
  let outerN = 0;
  let searchN = 0;
  for (let i = 0; i < outerMask.length; i++) {
    if (outerMask[i]) outerN++;
    if (search[i]) searchN++;
  }
  const inkRaw = toInkMap(img, sw, sh);
  let inkN = 0;
  let darkN = 0;
  const dark = andMask(inkRaw, search);
  for (let i = 0; i < inkRaw.length; i++) {
    if (inkRaw[i]) inkN++;
    if (dark[i]) darkN++;
  }
  const darkBlobs = labelBlobs(dark, sw, sh);
  const sampleInk = inkRaw[Math.floor(sh / 2) * sw + Math.floor(sw * (160 / w0))] || 0;
  const sampleMasonry = inkRaw[Math.floor(sh / 2) * sw + Math.floor(sw * (100 / w0))] || 0;
  return {
    w0,
    h0,
    sw,
    sh,
    outerArea: shoelaceArea(outerPx),
    outerN,
    searchN,
    inkN,
    darkN,
    darkBlobs: darkBlobs.length,
    largestDark: darkBlobs.reduce((m, b) => Math.max(m, b.pixels.length), 0),
    sampleInkAt160: sampleInk,
    sampleInkAt100: sampleMasonry,
  };
}
