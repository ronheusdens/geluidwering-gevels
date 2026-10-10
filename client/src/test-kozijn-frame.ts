import assert from "node:assert/strict";
import {
  DEFAULT_KOZIJN_WIDTH_M,
  bufferSegmentNorm,
  collectKozijnSnapTargets,
  evaluateKozijnFrame,
  nearestKozijnSnap,
  snapPointToKozijnEdge,
  weldKozijnPoints,
  type KozijnSegment,
} from "./kozijn-frame.ts";

function rectFrame(): KozijnSegment[] {
  const w = DEFAULT_KOZIJN_WIDTH_M;
  return [
    { id: "t", points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }], width_m: w },
    { id: "r", points: [{ x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }], width_m: w },
    { id: "b", points: [{ x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }], width_m: w },
    { id: "l", points: [{ x: 0.2, y: 0.8 }, { x: 0.2, y: 0.2 }], width_m: w },
  ];
}

const buf = bufferSegmentNorm({ x: 0, y: 0 }, { x: 1, y: 0 }, 0.1);
assert.ok(buf && buf.length >= 4, "buffer has ring");

const mpu = 10; // 1 norm → 10 m
const closed = evaluateKozijnFrame(rectFrame(), mpu);
assert.equal(closed.closure, "closed", closed.closureHint);
assert.ok(closed.woodAreaNorm > 0, "wood area");
assert.ok(closed.openingAreaNorm > 0, "opening area");
assert.ok(closed.glassPolygons.length >= 1, "at least one glass cell");
assert.ok((closed.woodAreaM2 ?? 0) > 0, "wood m2");
// 4 zijden × 0.6 norm × 10 m/norm = 24 m balklengte × 0.067 m = 1.608 m²
assert.equal(closed.woodBeamLengthM, 24);
assert.equal(closed.woodAreaM2, 1.61);
// Mag niet de gevulde opening zijn (0.6×0.6×100 = 36 m²)
assert.ok((closed.woodAreaM2 ?? 0) < (closed.openingAreaM2 ?? 999), "wood << opening");

const open = evaluateKozijnFrame(
  [{ id: "a", points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }], width_m: DEFAULT_KOZIJN_WIDTH_M }],
  mpu,
);
assert.equal(open.closure, "open");
assert.ok(open.danglingEnds >= 2);

// Cross mullion → 4 glass cells ideally (or at least >1)
const withCross: KozijnSegment[] = [
  ...rectFrame(),
  { id: "h", points: [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }], width_m: DEFAULT_KOZIJN_WIDTH_M },
  { id: "v", points: [{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 }], width_m: DEFAULT_KOZIJN_WIDTH_M },
];
const cross = evaluateKozijnFrame(withCross, mpu);
assert.equal(cross.closure, "closed", cross.closureHint);
assert.ok(cross.glassPolygons.length >= 2, `expected ≥2 glass, got ${cross.glassPolygons.length}`);

const snaps = collectKozijnSnapTargets(withCross);
assert.ok(snaps.length >= 8, `expected endpoints+crossings, got ${snaps.length}`);
const crossHit = nearestKozijnSnap({ x: 0.501, y: 0.499 }, snaps, 0.01);
assert.ok(crossHit, "nearest snap finds cross");
assert.ok(Math.abs(crossHit!.x - 0.5) < 1e-3 && Math.abs(crossHit!.y - 0.5) < 1e-3);

// Near-miss corners → weld → closed
const almost: KozijnSegment[] = [
  { id: "t", points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }], width_m: DEFAULT_KOZIJN_WIDTH_M },
  { id: "r", points: [{ x: 0.8004, y: 0.2003 }, { x: 0.8, y: 0.8 }], width_m: DEFAULT_KOZIJN_WIDTH_M },
  { id: "b", points: [{ x: 0.8, y: 0.8002 }, { x: 0.2, y: 0.8 }], width_m: DEFAULT_KOZIJN_WIDTH_M },
  { id: "l", points: [{ x: 0.1997, y: 0.8 }, { x: 0.2, y: 0.2004 }], width_m: DEFAULT_KOZIJN_WIDTH_M },
];
const openAlmost = evaluateKozijnFrame(almost, mpu);
assert.equal(openAlmost.closure, "open", "near-miss without weld stays open");
const welded = weldKozijnPoints(almost, [], 0.001);
const closedWeld = evaluateKozijnFrame(welded.segments, mpu);
assert.equal(closedWeld.closure, "closed", closedWeld.closureHint);

// Dwarsbalk: iets te kort → weld naar kaderlijn → gesloten (2 cellen)
const withMullionShort: KozijnSegment[] = [
  ...rectFrame(),
  {
    id: "m",
    points: [
      { x: 0.205, y: 0.5 },
      { x: 0.795, y: 0.5 },
    ],
    width_m: DEFAULT_KOZIJN_WIDTH_M,
  },
];
const edgeHit = snapPointToKozijnEdge({ x: 0.795, y: 0.5 }, rectFrame(), 0.01);
assert.ok(edgeHit && Math.abs(edgeHit.x - 0.8) < 1e-3, "snap to right stile");
const mullWeld = weldKozijnPoints(withMullionShort, [], 0.01);
const mullEv = evaluateKozijnFrame(mullWeld.segments, mpu);
assert.equal(mullEv.closure, "closed", mullEv.closureHint);
assert.ok(mullEv.glassPolygons.length >= 2, `mullion cells: ${mullEv.glassPolygons.length}`);

console.log("test-kozijn-frame: ok", {
  wood_m2: closed.woodAreaM2,
  glass_m2: closed.glassAreaM2,
  opening_m2: closed.openingAreaM2,
  cross_cells: cross.glassPolygons.length,
  snap_targets: snaps.length,
});
