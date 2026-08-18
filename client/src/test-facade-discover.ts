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
const hitRect = found.some((o) => o.shape === "rect");
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
  roundCount < 2 ||
  !sortedDesc ||
  !areasOk ||
  !onlyLarge
) {
  console.error(
    "FAIL: expected ≥3 shapes (1 rect + 2 circles), sorted desc, min-size filter works",
  );
  process.exit(1);
}
console.log("PASS: rect + round openings, sorted large→small, min-size slider logic");
