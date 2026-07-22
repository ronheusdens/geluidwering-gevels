/**
 * Contour-based closed polyline discovery on a floormap bitmap.
 * Returns rings in image pixel coords; caller converts to section-local 0–1.
 */
import { closeRing, rdpSimplify, shoelaceArea, type Pt } from "./geom";

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
  return closeRing([
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
      ring = closeRing(rdpSimplify(mapped, Math.max(0.6, Math.min(w0, h0) * 0.0015)));
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
