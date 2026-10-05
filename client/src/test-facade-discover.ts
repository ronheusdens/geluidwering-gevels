/**
 * Synthetic bitmap test: outer façade + rect + two round dark windows.
 * Run: npm run test:discover
 */
import { discoverInteriorOpenings } from "./room-discover";
import { shoelaceArea, type Pt } from "./geom";

function makeImageData(w: number, h: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 245;
    data[i + 1] = 245;
    data[i + 2] = 240;
    data[i + 3] = 255;
  }
  return { width: w, height: h, data, colorSpace: "srgb" } as ImageData;
}

function setPx(img: ImageData, x: number, y: number, rgb: [number, number, number]): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = rgb[0];
  img.data[i + 1] = rgb[1];
  img.data[i + 2] = rgb[2];
  img.data[i + 3] = 255;
}

function fillRect(
  img: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: [number, number, number],
): void {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) setPx(img, x, y, rgb);
  }
}

function strokeRect(
  img: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
  rgb: [number, number, number],
): void {
  fillRect(img, x0, y0, x1, y0 + t - 1, rgb);
  fillRect(img, x0, y1 - t + 1, x1, y1, rgb);
  fillRect(img, x0, y0, x0 + t - 1, y1, rgb);
  fillRect(img, x1 - t + 1, y0, x1, y1, rgb);
}

function fillCircle(img: ImageData, cx: number, cy: number, r: number, rgb: [number, number, number]): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) setPx(img, x, y, rgb);
    }
  }
}

const W = 480;
const H = 320;
const img = makeImageData(W, H);

const ox0 = 40;
const oy0 = 30;
const ox1 = 440;
const oy1 = 290;
fillRect(img, ox0, oy0, ox1, oy1, [232, 228, 220]);
strokeRect(img, ox0, oy0, ox1, oy1, 4, [20, 20, 20]);
// Large horizontal rect window (should sort first).
fillRect(img, 195, 215, 285, 255, [35, 40, 55]);
fillCircle(img, 160, 160, 38, [35, 40, 55]);
fillCircle(img, 340, 160, 38, [35, 40, 55]);

const outerNorm: Pt[] = [
  { x: ox0 / W, y: oy0 / H },
  { x: ox1 / W, y: oy0 / H },
  { x: ox1 / W, y: oy1 / H },
  { x: ox0 / W, y: oy1 / H },
];

const found = discoverInteriorOpenings(img, outerNorm);
console.log(`found=${found.length}`);
for (const o of found) {
  const c = o.points.reduce(
    (a, p) => ({ x: a.x + p.x / o.points.length, y: a.y + p.y / o.points.length }),
    { x: 0, y: 0 },
  );
  console.log(
    JSON.stringify({
      label: o.suggestedLabel,
      shape: o.shape,
      kind: o.kind,
      circularity: Math.round(o.circularity * 1000) / 1000,
      areaPx: Math.round(o.areaPx),
      cx: Math.round(c.x),
      cy: Math.round(c.y),
      verts: o.points.length,
    }),
  );
}

const near = (cx: number, cy: number, tx: number, ty: number, tol = 28) =>
  Math.hypot(cx - tx, cy - ty) < tol;

const centers = found.map((o) => {
  const c = o.points.reduce(
    (a, p) => ({ x: a.x + p.x / o.points.length, y: a.y + p.y / o.points.length }),
    { x: 0, y: 0 },
  );
  return c;
});

const hitLeft = centers.some((c) => near(c.x, c.y, 160, 160));
const hitRight = centers.some((c) => near(c.x, c.y, 340, 160));
const hitRect = found.every((o) => o.shape === "rect");
const roundCount = found.filter((o) => o.shape === "circle").length;
const sortedDesc = found.every((o, i) => i === 0 || found[i - 1].areaPx >= o.areaPx);
const outerA = shoelaceArea(outerNorm.map((p) => ({ x: p.x * W, y: p.y * H })));
const areasOk = found.every((o) => o.areaPx > outerA * 0.004 && o.areaPx < outerA * 0.42);

const filteredSmall = discoverInteriorOpenings(img, outerNorm, { minAreaFraction: 0.12 });
const onlyLarge = filteredSmall.length < found.length && filteredSmall.every((o) => o.areaPx >= outerA * 0.11);

if (
  found.length < 3 ||
  !hitLeft ||
  !hitRight ||
  !hitRect ||
  roundCount > 0 ||
  !sortedDesc ||
  !areasOk ||
  !onlyLarge
) {
  console.error(
    "FAIL: expected ≥3 rectangular openings (no circles), sorted desc, min-size filter works",
  );
  process.exit(1);
}
console.log("PASS: rectangular openings only, sorted large→small, min-size slider logic");

function strokeLine(
  img: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: [number, number, number],
): void {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    setPx(img, x, y, rgb);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

function hatchCap(
  img: ImageData,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: [number, number, number],
): void {
  strokeRect(img, x0, y0, x1, y1, 1, rgb);
  for (let x = x0 + 2; x < x1; x += 2) {
    for (let y = y0 + 1; y < y1; y++) setPx(img, x, y, rgb);
  }
}

/** Outline-only kozijn: gray wall, closed 1px frame, 2×3 muntins, diagonals, hatched caps. */
{
  const W = 400;
  const H = 520;
  const img = makeImageData(W, H);
  const wall: [number, number, number] = [148, 148, 152];
  const ink: [number, number, number] = [18, 18, 22];
  const glass: [number, number, number] = [158, 162, 168];
  const frame: [number, number, number] = [210, 210, 214];

  const ox0 = 28;
  const oy0 = 24;
  const ox1 = 372;
  const oy1 = 496;
  fillRect(img, ox0, oy0, ox1, oy1, wall);
  strokeRect(img, ox0, oy0, ox1, oy1, 3, ink);

  const wx0 = 160;
  const wy0 = 110;
  const wx1 = 240;
  const wy1 = 390;
  hatchCap(img, wx0, wy0 - 28, wx1, wy0 - 4, ink);
  hatchCap(img, wx0, wy1 + 4, wx1, wy1 + 28, ink);

  fillRect(img, wx0, wy0, wx1, wy1, frame);
  fillRect(img, wx0 + 6, wy0 + 6, wx1 - 6, wy1 - 6, glass);
  strokeRect(img, wx0, wy0, wx1, wy1, 1, ink);

  const mx = Math.round((wx0 + wx1) / 2);
  const my1 = wy0 + Math.round((wy1 - wy0) / 3);
  const my2 = wy0 + Math.round((2 * (wy1 - wy0)) / 3);
  for (let y = wy0; y <= wy1; y++) setPx(img, mx, y, ink);
  for (let x = wx0; x <= wx1; x++) {
    setPx(img, x, my1, ink);
    setPx(img, x, my2, ink);
  }
  strokeLine(img, wx0 + 10, wy0 + 18, wx1 - 12, wy1 - 40, ink);
  strokeLine(img, wx0 + 14, wy1 - 24, wx1 - 8, wy0 + 50, ink);

  const outerNorm: Pt[] = [
    { x: ox0 / W, y: oy0 / H },
    { x: ox1 / W, y: oy0 / H },
    { x: ox1 / W, y: oy1 / H },
    { x: ox0 / W, y: oy1 / H },
  ];

  const outlineFound = discoverInteriorOpenings(img, outerNorm);
  console.log(`outline-found=${outlineFound.length}`);
  const bboxOf = (ring: Pt[]) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of ring) {
      if (p.x < x0) x0 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.x > x1) x1 = p.x;
      if (p.y > y1) y1 = p.y;
    }
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  };
  for (const o of outlineFound) {
    const b = bboxOf(o.points);
    console.log(
      JSON.stringify({
        label: o.suggestedLabel,
        shape: o.shape,
        kind: o.kind,
        areaPx: Math.round(o.areaPx),
        cx: Math.round(b.cx),
        cy: Math.round(b.cy),
        w: Math.round(b.w),
        h: Math.round(b.h),
      }),
    );
  }

  const expectCx = (wx0 + wx1) / 2;
  const expectCy = (wy0 + wy1) / 2;
  const expectW = wx1 - wx0;
  const hitKozijn = outlineFound.some((o) => {
    const b = bboxOf(o.points);
    const sizeOk = Math.abs(b.w - expectW) < 16 && b.h > 250 && b.h < 360;
    const near = Math.hypot(b.cx - expectCx, b.cy - expectCy) < 28;
    return o.shape === "rect" && o.kind === "line_rect" && sizeOk && near;
  });
  const paneSized = outlineFound.filter((o) => o.areaPx < expectW * 80).length;

  if (!hitKozijn) {
    console.error("FAIL: outline kozijn (closed H/V rectangle, no dark fill) not found");
    process.exit(1);
  }
  if (paneSized > 2) {
    console.error(`FAIL: expected nested panes suppressed, got ${paneSized} small rects`);
    process.exit(1);
  }
  console.log("PASS: outline kozijn via line-segment rectangle");
}
