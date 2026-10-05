// src/geom.ts
function shoelaceArea(points) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
function polylinePerimeter(points) {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}
function rdpSimplify(points, epsilon) {
  if (points.length < 3) return points.slice();
  const closed = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-9;
  const ring = closed ? points.slice(0, -1) : points.slice();
  if (ring.length < 3) {
    const out2 = ring.map((p) => ({ x: p.x, y: p.y }));
    if (out2.length && Math.hypot(out2[0].x - out2[out2.length - 1].x, out2[0].y - out2[out2.length - 1].y) > 1e-6) {
      out2.push({ ...out2[0] });
    }
    return out2;
  }
  function distSeg(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-18) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function rec(pts) {
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
  const simplified = rec(ring);
  if (!simplified.length) return [];
  const out = simplified.map((p) => ({ x: p.x, y: p.y }));
  const f = out[0];
  const l = out[out.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) > 1e-6) out.push({ ...f });
  return out;
}

// src/room-discover.ts
function closePx(points) {
  if (!points.length) return [];
  const out = points.map((p) => ({ x: p.x, y: p.y }));
  const f = out[0];
  const l = out[out.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) > 1e-6) out.push({ ...f });
  return out;
}
function pointInRingLocal(pt, ring) {
  const closed = closePx(ring);
  const n = closed.length >= 2 && Math.hypot(closed[0].x - closed[closed.length - 1].x, closed[0].y - closed[closed.length - 1].y) < 1e-9 ? closed.length - 1 : closed.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = closed[i];
    const b = closed[j];
    const intersect = a.y > pt.y !== b.y > pt.y && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y + 1e-30) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}
function luminance(data, i) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}
function toInkMap(img, sw, sh) {
  const { width: w, height: h, data } = img;
  const ink = new Uint8Array(sw * sh);
  const scaleX = w / sw;
  const scaleY = h / sh;
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
function dilate(src, w, h) {
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
function erode(src, w, h) {
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
function paperMask(ink, w, h) {
  const paper = new Uint8Array(w * h);
  for (let i = 0; i < ink.length; i++) paper[i] = ink[i] ? 0 : 1;
  return paper;
}
function labelBlobs(mask, w, h) {
  const labels = new Int32Array(w * h);
  const blobs = [];
  let next = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i] || labels[i]) continue;
      const id = next++;
      const pixels = [];
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      const stack = [i];
      labels[i] = id;
      while (stack.length) {
        const cur = stack.pop();
        pixels.push(cur);
        const cx = cur % w;
        const cy = cur / w | 0;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neigh = [cur + 1, cur - 1, cur + w, cur - w];
        for (const n of neigh) {
          if (n < 0 || n >= labels.length) continue;
          if (!mask[n] || labels[n]) continue;
          const nx = n % w;
          const ny = n / w | 0;
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
function traceContour(mask, w, h, blob) {
  const set = new Set(blob.pixels);
  let start = -1;
  for (let y2 = blob.minY; y2 <= blob.maxY; y2++) {
    for (let x2 = blob.minX; x2 <= blob.maxX; x2++) {
      const i = y2 * w + x2;
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
    [1, -1]
  ];
  const pts = [];
  let x = start % w;
  let y = start / w | 0;
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
function blobToRingPixels(blob, w0, h0, sw, sh) {
  return closePx([
    { x: blob.minX / sw * w0, y: blob.minY / sh * h0 },
    { x: (blob.maxX + 1) / sw * w0, y: blob.minY / sh * h0 },
    { x: (blob.maxX + 1) / sw * w0, y: (blob.maxY + 1) / sh * h0 },
    { x: blob.minX / sw * w0, y: (blob.maxY + 1) / sh * h0 }
  ]);
}
var LINE_REF_DIM = 640;
var RECT_FILL_MIN = 0.72;
function circularityOf(ring) {
  const a = shoelaceArea(ring);
  const p = polylinePerimeter(ring);
  if (a < 1e-6 || p < 1e-6) return 0;
  return Math.min(1.2, 4 * Math.PI * a / (p * p));
}
function suggestOpeningLabel(shape, index1) {
  if (shape === "circle") return `Rond kozijn ${index1}`;
  return `Kozijn ${index1}`;
}
function isContourAxisAligned(ring, angleTolDeg = 14) {
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
    const angle = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    const mod90 = Math.min(angle % 90, 90 - angle % 90);
    if (mod90 <= angleTolDeg) aligned++;
  }
  return total >= 3 && aligned / total >= 0.72;
}
function classifyBlobShape(blob, ring) {
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
function rasterizeOuterMask(outerPx, sw, sh, w0, h0) {
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
function erodeMask(src, w, h, passes = 2) {
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
function andMask(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] && b[i] ? 1 : 0;
  return out;
}
function removePaperTouchingSearchBorder(paper, search, w, h) {
  const out = paper.slice();
  const stack = [];
  const push = (x, y) => {
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
          [0, -1]
        ]) {
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
    const i = stack.pop();
    const x = i % w;
    const y = i / w | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return out;
}
function ringCentroid(ring) {
  let x = 0;
  let y = 0;
  const n = Math.max(1, ring.length);
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / n, y: y / n };
}
function openingsTooSimilar(a, b) {
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
function edgeInk(ink, w, h) {
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
function keepAxisAlignedInk(ink, w, h, minLen) {
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
function openingKindScore(kind) {
  return kind === "line_rect" ? 3 : kind === "paper_pocket" ? 2 : 1;
}
function extractAxisSegs(mask, w, h, minLen) {
  const hSegs = [];
  const vSegs = [];
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
function clusterSegs(segs, bin) {
  const sorted = segs.slice().sort((a, b) => a.c - b.c || a.a - b.a);
  const clusters = [];
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
function intervalCover(segs, from, to) {
  const span = to - from;
  if (span <= 1) return 0;
  const iv = [];
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
function sideIsLocal(segs, from, to, minCover) {
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
function rectInkFraction(ink, w, x0, y0, x1, y1) {
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
function lineDetectParams(sw, sh) {
  const s = Math.min(sw, sh) / LINE_REF_DIM;
  return {
    minLen: Math.max(4, Math.round(8 * s)),
    minSide: Math.max(6, Math.round(10 * s)),
    clusterBin: Math.max(1, Math.round(2 * s)),
    minCover: 0.68,
    maxAspect: 8,
    maxInteriorInk: 0.28,
    nestTol: Math.max(2, Math.round(2 * s))
  };
}
function findClosedLineRects(ink, search, sw, sh, p = lineDetectParams(sw, sh)) {
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
  const found = [];
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
  const kept = [];
  for (const r of found) {
    const nested = kept.some(
      (k) => r.x0 >= k.x0 - p.nestTol && r.y0 >= k.y0 - p.nestTol && r.x1 <= k.x1 + p.nestTol && r.y1 <= k.y1 + p.nestTol
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
function lineRectToOpening(r, sw, sh, w0, h0) {
  const ring = closePx([
    { x: r.x0 / sw * w0, y: r.y0 / sh * h0 },
    { x: r.x1 / sw * w0, y: r.y0 / sh * h0 },
    { x: r.x1 / sw * w0, y: r.y1 / sh * h0 },
    { x: r.x0 / sw * w0, y: r.y1 / sh * h0 }
  ]);
  const area = shoelaceArea(ring);
  return {
    points: ring,
    areaPx: area,
    kind: "line_rect",
    shape: "rect",
    circularity: circularityOf(ring),
    suggestedLabel: suggestOpeningLabel("rect", 0)
  };
}
function blobToOpening(blob, mask, sw, sh, w0, h0, kind) {
  let probe = null;
  const contour = traceContour(mask, sw, sh, blob);
  if (contour && contour.length >= 4) {
    const mapped = contour.map((p) => ({
      x: p.x / sw * w0,
      y: p.y / sh * h0
    }));
    probe = closePx(rdpSimplify(mapped, Math.max(0.35, Math.min(w0, h0) * 9e-4)));
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
    suggestedLabel: suggestOpeningLabel(shape, 0)
  };
}
function discoverInteriorOpenings(img, outerNorm, opts) {
  const w0 = img.width;
  const h0 = img.height;
  if (w0 < 40 || h0 < 40 || !outerNorm || outerNorm.length < 3) return [];
  const outerPx = closePx(
    outerNorm.map((p) => ({
      x: p.x * w0,
      y: p.y * h0
    }))
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
  const search = erodeMask(outerMask, sw, sh, 2);
  const linePeel = Math.max(2, Math.round(2 * (Math.min(lsw, lsh) / LINE_REF_DIM)));
  const lineOuterMask = rasterizeOuterMask(outerPx, lsw, lsh, w0, h0);
  const lineSearch = erodeMask(lineOuterMask, lsw, lsh, linePeel);
  let searchCount = 0;
  for (let i = 0; i < search.length; i++) if (search[i]) searchCount++;
  if (searchCount < 40) return [];
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
  const minPx = Math.max(8, Math.floor(searchCount * 2e-3));
  const maxPx = Math.floor(searchCount * 0.5);
  const minFrac = Math.max(0, Math.min(1, opts?.minAreaFraction ?? 0));
  const minAreaImg = minFrac <= 0 ? outerAreaPx * 2e-3 : outerAreaPx * minFrac;
  const maxAreaImg = outerAreaPx * 0.98;
  const raw = [];
  const pushBlobs = (mask, kind) => {
    for (const blob of labelBlobs(mask, sw, sh)) {
      if (blob.pixels.length < minPx || blob.pixels.length > maxPx) continue;
      const bw = blob.maxX - blob.minX + 1;
      const bh = blob.maxY - blob.minY + 1;
      if (bw < 4 || bh < 4) continue;
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
  const kept = [];
  for (const o of raw) {
    const dupIdx = kept.findIndex((k) => openingsTooSimilar(k.points, o.points));
    if (dupIdx >= 0) {
      if (openingKindScore(o.kind) > openingKindScore(kept[dupIdx].kind)) {
        kept[dupIdx] = o;
      }
      continue;
    }
    const c = ringCentroid(o.points);
    if (kept.some(
      (k) => k.areaPx > o.areaPx && o.areaPx < k.areaPx * 0.85 && pointInRingLocal(c, k.points)
    )) {
      continue;
    }
    kept.push(o);
  }
  kept.sort((a, b) => b.areaPx - a.areaPx);
  const result = kept.slice(0, 40).map((o, i) => ({
    ...o,
    suggestedLabel: suggestOpeningLabel(o.shape, i + 1)
  }));
  if (opts?.meta) {
    const kindCounts = {
      dark_fill: 0,
      paper_pocket: 0,
      line_rect: 0
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
export {
  discoverInteriorOpenings
};
