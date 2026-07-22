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
function closeRing(points) {
  const out = points.map((p) => ({
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y))
  }));
  if (out.length < 1) return out;
  const f = out[0];
  const l = out[out.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) > 1e-6) out.push({ ...f });
  return out;
}
function translateRing(points, dx, dy) {
  return closeRing(points.map((p) => ({ x: p.x + dx, y: p.y + dy })));
}
function ringVertexCount(points) {
  if (points.length < 2) return points.length;
  const f = points[0];
  const l = points[points.length - 1];
  if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-6) return points.length - 1;
  return points.length;
}
function densifyRing(points, segmentsPerEdge) {
  const nSeg = Math.max(1, Math.floor(segmentsPerEdge));
  const count = ringVertexCount(points);
  if (count < 2 || nSeg <= 1) return closeRing(points);
  const ring = points.slice(0, count);
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push({ x: a.x, y: a.y });
    for (let s = 1; s < nSeg; s++) {
      const t = s / nSeg;
      out.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
      });
    }
  }
  return closeRing(out);
}
function ensureEditablePolyline(points, minVertices = 16) {
  const ring = closeRing(points);
  const n = ringVertexCount(ring);
  if (n >= minVertices) return ring;
  const segs = Math.max(2, Math.ceil(minVertices / Math.max(1, n)));
  return densifyRing(ring, segs);
}
function removeRingVertex(points, index) {
  const n = ringVertexCount(points);
  if (n <= 3) return null;
  if (index < 0 || index >= n) return null;
  const ring = points.slice(0, n);
  ring.splice(index, 1);
  return closeRing(ring);
}
function simplifyEditableRing(points, epsilon = 6e-3) {
  const before = ringVertexCount(points);
  if (before <= 3) return closeRing(points);
  const simplified = rdpSimplify(points, Math.max(1e-6, epsilon));
  if (ringVertexCount(simplified) < 3) return closeRing(points);
  return simplified;
}
function rdpSimplify(points, epsilon) {
  if (points.length < 3) return points.slice();
  const closed = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-9;
  const ring = closed ? points.slice(0, -1) : points.slice();
  if (ring.length < 3) return closeRing(ring);
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
  return closeRing(rec(ring));
}
function parseScaleRatioFromText(text) {
  const m = text.match(/\b1\s*[:/]\s*(\d+(?:[.,]\d+)?)\b/);
  if (!m) return null;
  const n = Number(String(m[1]).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
function metresPerNormFromPaperScale(scaleRatio, cropWidthPdfPoints) {
  const widthMetresOnPaper = cropWidthPdfPoints / 72 * 0.0254;
  return widthMetresOnPaper * scaleRatio;
}

// src/room-discover.ts
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
function removeBorderConnected(paper, w, h) {
  const out = paper.slice();
  const stack = [];
  const push = (x, y) => {
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
  return closeRing([
    { x: blob.minX / sw * w0, y: blob.minY / sh * h0 },
    { x: (blob.maxX + 1) / sw * w0, y: blob.minY / sh * h0 },
    { x: (blob.maxX + 1) / sw * w0, y: (blob.maxY + 1) / sh * h0 },
    { x: blob.minX / sw * w0, y: (blob.maxY + 1) / sh * h0 }
  ]);
}
function roomsFromPaperMask(paper, sw, sh, w0, h0) {
  const blobs = labelBlobs(paper, sw, sh);
  const total = sw * sh;
  const minPx = Math.max(40, total * 15e-4);
  const maxPx = total * 0.55;
  const rooms2 = [];
  for (const blob of blobs) {
    if (blob.pixels.length < minPx || blob.pixels.length > maxPx) continue;
    const bw = blob.maxX - blob.minX + 1;
    const bh = blob.maxY - blob.minY + 1;
    if (bw < 6 || bh < 6) continue;
    let ring = null;
    const contour = traceContour(paper, sw, sh, blob);
    if (contour && contour.length >= 4) {
      const mapped = contour.map((p) => ({
        x: p.x / sw * w0,
        y: p.y / sh * h0
      }));
      ring = closeRing(rdpSimplify(mapped, Math.max(0.6, Math.min(w0, h0) * 15e-4)));
    }
    if (!ring || ring.length < 4) {
      ring = blobToRingPixels(blob, w0, h0, sw, sh);
    }
    const area = shoelaceArea(ring);
    if (area < minPx * (w0 / sw) * (h0 / sh) * 0.35) continue;
    rooms2.push({ points: ring, areaPx: area });
  }
  rooms2.sort((a, b) => b.areaPx - a.areaPx);
  return rooms2;
}
function discoverRoomPolylines(img) {
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
  let rooms2 = roomsFromPaperMask(paperInterior, sw, sh, w0, h0);
  if (rooms2.length < 2) {
    const alt = roomsFromPaperMask(paperFull, sw, sh, w0, h0).filter((r) => {
      const xs = r.points.map((p) => p.x);
      const ys = r.points.map((p) => p.y);
      const bw = Math.max(...xs) - Math.min(...xs);
      const bh = Math.max(...ys) - Math.min(...ys);
      return bw < w0 * 0.92 && bh < h0 * 0.92;
    });
    if (alt.length > rooms2.length) rooms2 = alt;
  }
  return rooms2.slice(0, 50);
}
function pixelsToSectionNorm(points, canvasW, canvasH) {
  return closeRing(
    points.map((p) => ({
      x: p.x / Math.max(1, canvasW),
      y: p.y / Math.max(1, canvasH)
    }))
  );
}

// src/auth-store.ts
function loadAuth(storageKey) {
  try {
    const raw = sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    if (!sessionStorage.getItem(storageKey) && localStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, raw);
      localStorage.removeItem(storageKey);
    }
    return parsed;
  } catch {
    return null;
  }
}
function storeAuth(storageKey, info) {
  localStorage.removeItem(storageKey);
  if (!info) sessionStorage.removeItem(storageKey);
  else sessionStorage.setItem(storageKey, JSON.stringify(info));
}
async function syncSessionCookie(token) {
  try {
    if (token) {
      await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
    } else {
      await fetch("/api/session", {
        method: "DELETE",
        credentials: "include"
      });
    }
  } catch {
  }
}
function apiAuthHeaders(token, json = false) {
  const h = {
    Authorization: `Bearer ${token}`
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

// src/ws-url.ts
function resolveBppWsUrl() {
  if (location.protocol === "https:") {
    return `wss://${location.host}/ws`;
  }
  const q = new URLSearchParams(location.search).get("ws");
  const override = window.BPP_WS_URL;
  return q || override || `ws://${location.hostname}:18080/ws`;
}

// src/floormap.ts
var params = new URLSearchParams(location.search);
var BPP_WS = resolveBppWsUrl();
var AUTH_KEY = "acoustics_engineer_auth";
var URL_BUILDING = params.get("building_id") || "";
var URL_SECTION = params.get("section_id") || "";
var connBarEl = document.getElementById("fm-conn-bar");
var connLedEl = document.getElementById("fm-conn-led");
var connStatusEl = document.getElementById("fm-conn-status");
var loginPanelEl = document.getElementById("fm-login-panel");
var loginForm = document.getElementById("fm-login-form");
var panelEl = document.getElementById("fm-panel");
var userLabelEl = document.getElementById("fm-user-label");
var logoutBtn = document.getElementById("fm-logout-btn");
var buildingInput = document.getElementById("fm-building-input");
var loadBuildingBtn = document.getElementById("fm-load-building-btn");
var sectionListEl = document.getElementById("fm-section-list");
var pickerPanelEl = document.getElementById("fm-picker-panel");
var workspacePanelEl = document.getElementById("fm-workspace-panel");
var sectionTitleEl = document.getElementById("fm-section-title");
var sectionMetaEl = document.getElementById("fm-section-meta");
var backPickerBtn = document.getElementById("fm-back-picker-btn");
var pdfCanvas = document.getElementById("fm-pdf-canvas");
var overlayCanvas = document.getElementById("fm-overlay-canvas");
var pdfScrollEl = document.getElementById("fm-pdf-scroll");
var zoomOutBtn = document.getElementById("fm-zoom-out");
var zoomInBtn = document.getElementById("fm-zoom-in");
var zoomBtn = document.getElementById("fm-zoom-btn");
var zoomFitBtn = document.getElementById("fm-zoom-fit");
var zoomLabelEl = document.getElementById("fm-zoom-label");
var discoverBtn = document.getElementById("fm-discover-btn");
var calibrateBtn = document.getElementById("fm-calibrate-btn");
var scaleStatusEl = document.getElementById("fm-scale-status");
var calibrateMetresWrap = document.getElementById("fm-calibrate-metres-wrap");
var calibrateMetresInput = document.getElementById("fm-calibrate-metres");
var calibrateApplyBtn = document.getElementById("fm-calibrate-apply-btn");
var calibrateRepickBtn = document.getElementById("fm-calibrate-repick-btn");
var calibrateHintEl = document.getElementById("fm-calibrate-hint");
var toolClearBtn = document.getElementById("fm-tool-clear-btn");
var toolHintEl = document.getElementById("fm-tool-hint");
var toolLengthMmEl = document.getElementById("fm-tool-length-mm");
var toolCircMmEl = document.getElementById("fm-tool-circ-mm");
var toolAreaMm2El = document.getElementById("fm-tool-area-mm2");
var roomLabelInput = document.getElementById("fm-room-label");
var roomLevelSelect = document.getElementById("fm-room-level");
var roomPendingHintEl = document.getElementById("fm-room-pending-hint");
var roomDrawBtn = document.getElementById("fm-room-draw-btn");
var roomCloseBtn = document.getElementById("fm-room-close-btn");
var roomSimplifyBtn = document.getElementById("fm-room-simplify-btn");
var roomSaveBtn = document.getElementById("fm-room-save-btn");
var roomClearBtn = document.getElementById("fm-room-clear-btn");
var discoverBtnSide = document.getElementById("fm-discover-btn-side");
var discoveryDockEl = document.getElementById("fm-discovery-dock");
var discoveryProgressEl = document.getElementById("fm-discovery-progress");
var discoveryHintEl = document.getElementById("fm-discovery-hint");
var discoveryLabelInput = document.getElementById("fm-discovery-label");
var discoveryLevelSelect = document.getElementById("fm-discovery-level");
var discoveryAcceptBtn = document.getElementById("fm-discovery-accept");
var discoverySkipBtn = document.getElementById("fm-discovery-skip");
var discoveryCancelBtn = document.getElementById("fm-discovery-cancel");
var discoverySimplifyBtn = document.getElementById("fm-discovery-simplify");
var nudgeLeftBtn = document.getElementById("fm-nudge-left");
var nudgeRightBtn = document.getElementById("fm-nudge-right");
var nudgeUpBtn = document.getElementById("fm-nudge-up");
var nudgeDownBtn = document.getElementById("fm-nudge-down");
var roomCountEl = document.getElementById("fm-room-count");
var roomsHintEl = document.getElementById("fm-rooms-hint");
var roomListEl = document.getElementById("fm-room-list");
var gaLinkEl = document.getElementById("fm-ga-link");
var markRoomLegendEl = document.querySelector("#fm-mark-room-fieldset legend");
var savedRoomsHeadingEl = document.querySelector(".saved-sections-block h3");
var pickerHeadingEl = document.querySelector("#fm-picker-panel h2");
var pickerHintEl = document.querySelector("#fm-picker-panel > .hint");
var pageTitleEl = document.querySelector("h1");
function partNoun(kind) {
  const k = String(kind || "FLOORMAP").toUpperCase();
  if (k === "FLOORMAP") {
    return { singular: "room", plural: "rooms", title: "Floormap", kindLabel: "Floormap" };
  }
  if (k === "FACADE") {
    return { singular: "component", plural: "components", title: "Fa\xE7ade", kindLabel: "Fa\xE7ade" };
  }
  if (k === "CROSS_SECTION") {
    return {
      singular: "component",
      plural: "components",
      title: "Cross-section",
      kindLabel: "Cross-section"
    };
  }
  if (k === "SECTION") {
    return {
      singular: "component",
      plural: "components",
      title: "Building section",
      kindLabel: "Building section"
    };
  }
  return { singular: "component", plural: "components", title: "Drawing", kindLabel: "Drawing" };
}
function activePartNoun() {
  return partNoun(activeSection?.region_kind);
}
function syncWorkspaceLabels(kind) {
  const n = partNoun(kind ?? activeSection?.region_kind);
  const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
  if (pageTitleEl) pageTitleEl.textContent = `${n.title} analysis`;
  if (pickerHeadingEl) pickerHeadingEl.textContent = "Scalable sections";
  if (pickerHintEl) {
    pickerHintEl.textContent = "Pick a floormap, fa\xE7ade, or section to measure and mark components (same workflow for each).";
  }
  if (loadBuildingBtn) loadBuildingBtn.textContent = "Load sections";
  if (backPickerBtn) backPickerBtn.textContent = "All sections";
  discoverBtn.textContent = `Discover ${n.plural}`;
  if (discoverBtnSide) discoverBtnSide.textContent = `Discover ${n.plural}`;
  if (markRoomLegendEl) markRoomLegendEl.textContent = cap;
  roomDrawBtn.textContent = `Draw ${n.singular}`;
  roomSaveBtn.textContent = `Save ${n.singular}`;
  roomLabelInput.placeholder = n.singular === "room" ? "e.g. slaapkamer 1" : "e.g. window band / panel";
  roomPendingHintEl.textContent = `Use Draw ${n.singular} in Tools, click vertices, then Close & save. Double-click an anchor to remove it; Simplify thins the outline.`;
  if (savedRoomsHeadingEl) {
    savedRoomsHeadingEl.replaceChildren(
      document.createTextNode(`Saved ${n.plural} `),
      roomCountEl
    );
  }
  roomsHintEl.textContent = `Each ${n.singular} shows area (m\xB2) and circumference (m) when scale is set.`;
}
var ws = null;
var sessionId = null;
var auth = null;
var reqCounter = 0;
var pending = /* @__PURE__ */ new Map();
var buildingId = URL_BUILDING;
var sections = [];
var activeSection = null;
var rooms = [];
var linkedRooms = /* @__PURE__ */ new Map();
var pdfDoc = null;
var cropBitmap = null;
var cropWidthPdfPts = 0;
var canvasWidth = 0;
var canvasHeight = 0;
var viewZoom = 1;
var ZOOM_MIN = 0.5;
var ZOOM_MAX = 4;
var ZOOM_STEP = 0.25;
var discovery = null;
var calibrate = null;
var measure = { tool: "off", points: [], cursor: null };
var pendingRoom = null;
function setStatus(text, kind = "busy") {
  connStatusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}
function setConnLed(connected) {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}
function nextRequestId(prefix) {
  reqCounter += 1;
  return `${prefix}_${reqCounter}_${Date.now()}`;
}
function storeAuth2(info) {
  storeAuth(AUTH_KEY, info);
  void syncSessionCookie(info?.token ?? null);
}
function loadStoredAuth() {
  return loadAuth(AUTH_KEY);
}
function showLogin() {
  auth = null;
  storeAuth2(null);
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
}
function showPanel(info) {
  auth = info;
  storeAuth2(info);
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Signed in as ${info.display_name || info.username}`;
}
function send(type, payload, wantType) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
  }
  const request_id = nextRequestId(type.replace(".", "_"));
  const env = { v: 1, type, request_id, payload };
  if (sessionId && type !== "session.open") env.session_id = sessionId;
  return new Promise((resolve, reject) => {
    pending.set(request_id, { resolve, reject, want: wantType });
    ws.send(JSON.stringify(env));
  });
}
function onMessage(raw) {
  let env;
  try {
    env = JSON.parse(raw);
  } catch {
    return;
  }
  if (env.type === "session.opened") {
    const sid = typeof env.session_id === "string" && env.session_id || (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
    if (sid) sessionId = sid;
  }
  if (env.type === "error") {
    const waiter2 = pending.get(env.request_id);
    if (waiter2) {
      pending.delete(env.request_id);
      waiter2.reject(new Error(JSON.stringify(env.payload ?? env)));
    }
    return;
  }
  const waiter = pending.get(env.request_id);
  if (!waiter) return;
  if (env.type === waiter.want || env.type.endsWith(".completed") || env.type === "exec.completed") {
    if (env.type === "invoke.accepted" || env.type === "exec.accepted") return;
    pending.delete(env.request_id);
    waiter.resolve(env);
  }
}
async function invokeString(target, args) {
  const inv = await send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
  const ret = inv.payload?.return;
  if (typeof ret !== "string") throw new Error(`Unexpected return from ${target}`);
  return ret;
}
async function loadSharedApi() {
  await send(
    "exec.request",
    { code: 'INCLUDE "fixtures/acoustics/shared_building_api.basicpp"\n' },
    "exec.completed"
  );
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap failed: ${bootRet}`);
}
async function bootstrapAndLogin(username, password) {
  await loadSharedApi();
  const ret = await invokeString("API_Login", [username, password]);
  if (ret.startsWith("ERROR")) throw new Error(ret);
  const parsed = JSON.parse(ret);
  if (!parsed.ok || !parsed.token) throw new Error("Login failed");
  showPanel({
    token: parsed.token,
    username: parsed.username || username,
    display_name: parsed.display_name || username
  });
}
function authHeaders() {
  return apiAuthHeaders(auth.token, true);
}
async function apiGet(url) {
  const res = await fetch(url, {
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
async function apiPost(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: authHeaders(),
    body: JSON.stringify(payload)
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
async function apiDelete(url) {
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  const body = await res.json();
  if (!res.ok || body.ok === false) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}
function updateScaleUi() {
  const n = activePartNoun();
  if (!activeSection) {
    scaleStatusEl.textContent = "Not set";
    calibrateHintEl.textContent = "Click Calibrate scale when you are ready.";
    roomsHintEl.textContent = `Set drawing scale to get ${n.singular} areas in m\xB2.`;
    return;
  }
  const mpu = activeSection.metres_per_norm_unit;
  const ratio = activeSection.scale_ratio;
  const src = (activeSection.scale_source || "NONE").toUpperCase();
  if (mpu != null && mpu > 0) {
    if (ratio != null && ratio > 0) {
      const from = src === "PDF_TEXT" ? " (from drawing text)" : src === "CALIBRATED" ? " (calibrated)" : "";
      scaleStatusEl.textContent = `Paper scale 1:${ratio}${from}`;
    } else {
      scaleStatusEl.textContent = src === "CALIBRATED" ? "Scale set from marked length" : `Scale set \u2014 ${n.singular} sizes in m\xB2 / m`;
    }
    calibrateHintEl.textContent = `Scale is ready. Use Length to check a distance, or Draw ${n.singular} \u2014 circ/area update from the polygon.`;
    roomsHintEl.textContent = `${n.singular.charAt(0).toUpperCase() + n.singular.slice(1)} area (m\xB2) and perimeter (m) use this scale.`;
    calibrateBtn.textContent = "Recalibrate scale";
  } else {
    scaleStatusEl.textContent = "Not set \u2014 mark a known length, or use detected 1:N";
    calibrateHintEl.textContent = "Click Calibrate scale, mark two points, then enter that length in mm.";
    roomsHintEl.textContent = "Without scale, only relative sizes are shown.";
    calibrateBtn.textContent = "Calibrate scale";
  }
  updateToolHint();
}
function activeScaleMpu() {
  const mpu = activeSection?.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0)) return null;
  return mpu;
}
function fmtMeasure(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "\u2014";
  return n.toFixed(digits);
}
function pathLengthM(pts, mpu, closed) {
  if (pts.length < 2) return 0;
  let sum = 0;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y) * mpu;
  }
  return sum;
}
function pathAreaM2(pts, mpu) {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2 * mpu * mpu;
}
function measureDisplayPoints() {
  const pts = measure.points.slice();
  if (measure.cursor && measure.tool === "length" && pts.length === 1) {
    pts.push(measure.cursor);
  }
  return pts;
}
function ringForMetrics() {
  if (pendingRoom && pendingRoom.points.length >= 2) {
    return { pts: pendingRoom.points, closed: pendingRoom.closed };
  }
  if (discovery?.current && discovery.current.length >= 2) {
    return { pts: discovery.current, closed: true };
  }
  return null;
}
function updateMeasureReadouts() {
  const mpu = activeScaleMpu();
  if (!mpu) {
    toolLengthMmEl.value = "\u2014";
    toolCircMmEl.value = "\u2014";
    toolAreaMm2El.value = "\u2014";
    return;
  }
  if (measure.tool === "length") {
    const display = measureDisplayPoints();
    toolLengthMmEl.value = display.length >= 2 ? fmtMeasure(pathLengthM(display.slice(0, 2), mpu, false), 2) : "\u2014";
  } else {
    toolLengthMmEl.value = "\u2014";
  }
  const ring = ringForMetrics();
  if (ring) {
    toolCircMmEl.value = fmtMeasure(pathLengthM(ring.pts, mpu, ring.closed), 2);
    toolAreaMm2El.value = ring.pts.length >= 3 ? fmtMeasure(pathAreaM2(ring.pts, mpu), 2) : "\u2014";
  } else {
    toolCircMmEl.value = "\u2014";
    toolAreaMm2El.value = "\u2014";
  }
}
function updateToolHint() {
  if (!toolHintEl) return;
  const n = activePartNoun();
  if (!activeScaleMpu()) {
    toolHintEl.textContent = `Set scale first, then measure a length or draw a ${n.singular}.`;
    return;
  }
  if (pendingRoom?.drawing && !pendingRoom.closed) {
    toolHintEl.textContent = pendingRoom.points.length === 0 ? `Click ${n.singular} corners. Circumference updates as you go; area after 3 points.` : `${pendingRoom.points.length} vertex(es). Close polygon (\u22653) or click near start.`;
    return;
  }
  if (pendingRoom?.closed) {
    toolHintEl.textContent = `${n.singular.charAt(0).toUpperCase() + n.singular.slice(1)} polygon ready \u2014 circ/area shown. Drag vertices or Save ${n.singular}.`;
    return;
  }
  if (measure.tool === "length") {
    toolHintEl.textContent = measure.points.length < 2 ? "Click two points to measure length (updates live while moving)." : "Length ready. Clear or click again to start over.";
    return;
  }
  toolHintEl.textContent = `Choose Length or Draw ${n.singular}. Circumference and area come from the polygon.`;
}
function activeToolMode() {
  if (pendingRoom?.drawing || pendingRoom?.closed) return "room";
  if (measure.tool === "length") return "length";
  return "off";
}
function syncToolButtons() {
  const mode = activeToolMode();
  const n = activePartNoun();
  document.querySelectorAll(".tool-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", (btn.dataset.tool || "off") === mode);
    if (btn.dataset.tool === "room") btn.textContent = `Draw ${n.singular}`;
  });
}
function clearMeasure(keepTool = true) {
  measure = {
    tool: keepTool ? measure.tool : "off",
    points: [],
    cursor: null
  };
  if (!keepTool) syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
}
function setMeasureTool(tool) {
  if (tool === "room") {
    if (pendingRoom?.drawing) {
      syncToolButtons();
      updateToolHint();
      return;
    }
    beginDrawRoom();
    return;
  }
  if (tool !== "off") {
    if (calibrate) endCalibrate();
    if (discovery) {
      setStatus("Finish or cancel room discovery before measuring", "err");
      syncToolButtons();
      return;
    }
    if (!activeScaleMpu()) {
      setStatus("Set scale first", "err");
      measure.tool = "off";
      syncToolButtons();
      updateToolHint();
      return;
    }
  }
  if (pendingRoom) clearPendingRoom();
  measure = { tool: tool === "length" ? "length" : "off", points: [], cursor: null };
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
  if (tool === "length") setStatus("Measure length: click two points", "busy");
}
function renderSectionList() {
  sectionListEl.innerHTML = "";
  if (sections.length === 0) {
    sectionListEl.innerHTML = `<p class="hint">No scalable sections (floormap / fa\xE7ade / section) for this project.</p>`;
    return;
  }
  for (const s of sections) {
    const card = document.createElement("article");
    card.className = "admin-project-card panel";
    const n = partNoun(s.region_kind);
    const scale = s.metres_per_norm_unit != null && s.metres_per_norm_unit > 0 ? `scale set (${s.scale_source})` : "no scale";
    card.innerHTML = `
      <h3>${s.label || n.title}</h3>
      <p class="hint">${n.kindLabel} \xB7 page ${s.page_index + 1} \xB7 ${s.room_count} ${n.singular}(s) \xB7 ${scale}</p>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `Open ${n.title.toLowerCase()}`;
    btn.addEventListener("click", () => {
      void openSection(s.id);
    });
    card.appendChild(btn);
    sectionListEl.appendChild(card);
  }
}
function roomMetricsLabel(r) {
  const mpu = r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0 ? r.metres_per_norm_unit : activeScaleMpu();
  let area = "\u2014";
  let circ = "\u2014";
  if (r.area_m2 != null && Number.isFinite(r.area_m2)) area = `${r.area_m2.toFixed(2)} m\xB2`;
  else if (r.area_norm != null && mpu) area = `${(r.area_norm * mpu * mpu).toFixed(2)} m\xB2`;
  else if (r.area_norm != null) area = `${r.area_norm.toFixed(4)} (no scale)`;
  if (r.perimeter_m != null && Number.isFinite(r.perimeter_m)) circ = `${r.perimeter_m.toFixed(2)} m`;
  else if (r.perimeter_norm != null && mpu) circ = `${(r.perimeter_norm * mpu).toFixed(2)} m`;
  else if (r.perimeter_norm != null) circ = `${r.perimeter_norm.toFixed(4)} (no scale)`;
  return `${area} \xB7 circ ${circ}`;
}
function syncPendingRoomButtons() {
  const n = activePartNoun();
  const cap = n.singular.charAt(0).toUpperCase() + n.singular.slice(1);
  const has = Boolean(pendingRoom && pendingRoom.points.length > 0);
  const closed = Boolean(pendingRoom?.closed);
  roomCloseBtn.disabled = !(pendingRoom?.drawing && pendingRoom.points.length >= 3 && !closed);
  roomSaveBtn.disabled = !(closed && pendingRoom && pendingRoom.points.length >= 3);
  roomClearBtn.disabled = !has && !pendingRoom?.drawing;
  if (roomSimplifyBtn) {
    roomSimplifyBtn.disabled = !(closed && pendingRoom && ringVertexCount(pendingRoom.points) > 3);
  }
  if (!pendingRoom) {
    roomPendingHintEl.textContent = `Use Draw ${n.singular} (Tools or here), then click vertices. Double-click an anchor to remove; Simplify thins the outline.`;
    roomDrawBtn.textContent = `Draw ${n.singular}`;
    return;
  }
  if (pendingRoom.drawing && !pendingRoom.closed) {
    roomPendingHintEl.textContent = `${pendingRoom.points.length} vertex(es). Circ/area update above; Close polygon when ready (\u22653).`;
    roomDrawBtn.textContent = "Cancel draw";
  } else if (pendingRoom.closed) {
    roomPendingHintEl.textContent = pendingRoom.editingId ? "Editing \u2014 drag anchors, double-click to remove, Simplify to thin, then Save." : "Polygon ready \u2014 double-click anchors to remove extras, or Simplify, then Save.";
    roomDrawBtn.textContent = `Draw ${n.singular}`;
  }
  roomSaveBtn.textContent = `Save ${n.singular}`;
  if (markRoomLegendEl) markRoomLegendEl.textContent = cap;
}
function clearPendingRoom() {
  pendingRoom = null;
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
  drawOverlay();
}
function beginDrawRoom() {
  endDiscovery();
  endCalibrate();
  if (measure.tool !== "off") clearMeasure(false);
  pendingRoom = {
    points: [],
    closed: false,
    editingId: null,
    dragVertex: null,
    drawing: true
  };
  roomLabelInput.value = `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  setStatus("Click room corners on the plan", "busy");
  drawOverlay();
}
function startDrawRoom() {
  if (pendingRoom?.drawing) {
    clearPendingRoom();
    setStatus("Draw cancelled", "ok");
    return;
  }
  beginDrawRoom();
}
function closePendingPolygon() {
  if (!pendingRoom || pendingRoom.points.length < 3) return;
  pendingRoom.points = closeRing(pendingRoom.points);
  pendingRoom.closed = true;
  pendingRoom.drawing = false;
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  setStatus(`Polygon closed \u2014 Save ${activePartNoun().singular} when ready`, "ok");
  drawOverlay();
}
async function savePendingRoom() {
  if (!pendingRoom?.closed || !activeSection || !auth) return;
  const points = closeRing(pendingRoom.points);
  if (shoelaceArea(points) < 1e-8) {
    setStatus("Room too small", "err");
    return;
  }
  const label = roomLabelInput.value.trim() || `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  const level = roomLevelSelect.value || "OTHER";
  roomSaveBtn.disabled = true;
  setStatus("Saving room\u2026", "busy");
  try {
    const mpu = activeScaleMpu();
    await apiPost("/api/floormap/subsections", {
      section_id: activeSection.id,
      subsection_id: pendingRoom.editingId || void 0,
      label,
      level_hint: level,
      points,
      metres_per_norm_unit: mpu ?? void 0
    });
    clearPendingRoom();
    await loadRooms();
    setStatus(`Saved ${label}`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    syncPendingRoomButtons();
  }
}
function editRoom(room) {
  endDiscovery();
  endCalibrate();
  if (measure.tool !== "off") clearMeasure(false);
  if (activeSection && !(activeSection.metres_per_norm_unit != null && activeSection.metres_per_norm_unit > 0) && room.metres_per_norm_unit != null && room.metres_per_norm_unit > 0) {
    activeSection.metres_per_norm_unit = room.metres_per_norm_unit;
    if (!activeSection.scale_source || activeSection.scale_source === "NONE") {
      activeSection.scale_source = "CALIBRATED";
    }
    updateScaleUi();
  }
  pendingRoom = {
    points: closeRing(room.points.map((p) => ({ ...p }))),
    closed: true,
    editingId: room.id,
    dragVertex: null,
    drawing: false
  };
  roomLabelInput.value = room.label;
  roomLevelSelect.value = room.level_hint || "OTHER";
  syncPendingRoomButtons();
  syncToolButtons();
  updateMeasureReadouts();
  updateToolHint();
  renderRoomList();
  const selectedLi = roomListEl.querySelector(".drawing-list-item.selected");
  selectedLi?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  scrollToRing(pendingRoom.points);
  setStatus(`Editing ${room.label}`, "ok");
  drawOverlay();
}
function renderRoomList() {
  roomListEl.innerHTML = "";
  roomCountEl.textContent = String(rooms.length);
  if (rooms.length === 0) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = `No ${activePartNoun().plural} saved yet \u2014 Draw ${activePartNoun().singular} or Discover.`;
    roomListEl.appendChild(li);
    return;
  }
  for (const r of rooms) {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (pendingRoom?.editingId === r.id) li.classList.add("selected");
    const info = document.createElement("button");
    info.type = "button";
    info.className = "drawing-list-select";
    const linked = linkedRooms.get(r.id);
    const linkBit = activeSection?.region_kind === "FLOORMAP" && linked ? ` \xB7 VR: ${linked}` : activeSection?.region_kind === "FLOORMAP" ? " \xB7 niet in GA" : "";
    info.textContent = `${r.label} \xB7 ${r.level_hint} \xB7 ${roomMetricsLabel(r)}${linkBit}`;
    info.addEventListener("click", () => editRoom(r));
    li.appendChild(info);
    const actions = document.createElement("span");
    actions.className = "drawing-list-actions";
    if (activeSection?.region_kind === "FLOORMAP" && buildingId) {
      const ga = document.createElement("a");
      ga.className = "secondary-link";
      ga.href = `/ga.html?building_id=${encodeURIComponent(buildingId)}`;
      ga.textContent = linked ? "Open GA" : "Koppel in GA";
      actions.appendChild(ga);
    }
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => editRoom(r));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      void deleteRoom(r.id);
    });
    actions.appendChild(editBtn);
    actions.appendChild(btn);
    li.appendChild(actions);
    roomListEl.appendChild(li);
  }
}
async function refreshLinkedRooms() {
  linkedRooms = /* @__PURE__ */ new Map();
  if (!auth?.token || !buildingId) return;
  try {
    const ret = await invokeString("API_ListLinkedSubsections", [auth.token, buildingId]);
    if (ret.startsWith("ERROR")) return;
    const data = JSON.parse(ret);
    for (const l of data.links || []) {
      linkedRooms.set(l.subsection_id, l.omschrijving);
    }
  } catch {
  }
}
function normalizeSection(s) {
  return {
    ...s,
    id: String(s.id),
    document_id: String(s.document_id || ""),
    label: String(s.label || ""),
    region_kind: String(s.region_kind || "FLOORMAP").toUpperCase() || "FLOORMAP",
    page_index: Number(s.page_index) || 0,
    x_min: Number(s.x_min),
    y_min: Number(s.y_min),
    x_max: Number(s.x_max),
    y_max: Number(s.y_max),
    scale_ratio: s.scale_ratio != null ? Number(s.scale_ratio) : null,
    metres_per_norm_unit: s.metres_per_norm_unit != null ? Number(s.metres_per_norm_unit) : null,
    scale_source: String(s.scale_source || "NONE"),
    room_count: Number(s.room_count) || 0
  };
}
async function ensureSectionInList(sectionId) {
  if (sections.some((s) => s.id === sectionId)) return true;
  try {
    const data = await apiGet(
      `/api/floormap/section?section_id=${encodeURIComponent(sectionId)}`
    );
    if (!data.section?.id) return false;
    sections = [normalizeSection(data.section), ...sections.filter((s) => s.id !== data.section.id)];
    renderSectionList();
    return true;
  } catch {
    return false;
  }
}
async function loadFloormapSections(bid) {
  if (!auth?.token) return;
  buildingId = bid.trim();
  if (!buildingId) {
    setStatus("Enter a building id", "err");
    return;
  }
  buildingInput.value = buildingId;
  if (gaLinkEl) {
    gaLinkEl.href = `/ga.html?building_id=${encodeURIComponent(buildingId)}`;
  }
  setStatus("Loading sections\u2026", "busy");
  try {
    await refreshLinkedRooms();
    const data = await apiGet(
      `/api/floormap/sections?building_id=${encodeURIComponent(buildingId)}`
    );
    sections = (data.sections || []).map((s) => normalizeSection(s));
    if (URL_SECTION) {
      await ensureSectionInList(URL_SECTION);
    }
    syncWorkspaceLabels(sections[0]?.region_kind || "FLOORMAP");
    renderSectionList();
    pickerPanelEl.classList.remove("hidden");
    workspacePanelEl.classList.add("hidden");
    setStatus(`${sections.length} section(s)`, "ok");
    if (URL_SECTION && sections.some((s) => s.id === URL_SECTION)) {
      await openSection(URL_SECTION);
    } else if (URL_SECTION) {
      setStatus("Section not found or not scalable \u2014 check engineer review link", "err");
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function loadRooms() {
  if (!auth?.token || !activeSection) return;
  const data = await apiGet(
    `/api/floormap/subsections?section_id=${encodeURIComponent(activeSection.id)}`
  );
  rooms = (data.subsections || []).map((r) => ({
    ...r,
    points: Array.isArray(r.points) ? r.points : [],
    area_norm: r.area_norm != null ? Number(r.area_norm) : null,
    perimeter_norm: r.perimeter_norm != null ? Number(r.perimeter_norm) : null,
    area_m2: r.area_m2 != null ? Number(r.area_m2) : null,
    perimeter_m: r.perimeter_m != null ? Number(r.perimeter_m) : null,
    metres_per_norm_unit: r.metres_per_norm_unit != null && Number(r.metres_per_norm_unit) > 0 ? Number(r.metres_per_norm_unit) : null
  }));
  await restoreScaleFromRooms();
  await refreshLinkedRooms();
  renderRoomList();
  drawOverlay();
}
async function restoreScaleFromRooms() {
  if (!activeSection || !auth?.token) return;
  if (activeSection.metres_per_norm_unit != null && activeSection.metres_per_norm_unit > 0) {
    updateScaleUi();
    return;
  }
  const withScale = rooms.find(
    (r) => r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0
  );
  if (!withScale?.metres_per_norm_unit) {
    updateScaleUi();
    return;
  }
  const mpu = withScale.metres_per_norm_unit;
  activeSection.metres_per_norm_unit = mpu;
  if (!activeSection.scale_source || activeSection.scale_source === "NONE") {
    activeSection.scale_source = "CALIBRATED";
  }
  updateScaleUi();
  updateMeasureReadouts();
  try {
    await apiPost("/api/floormap/scale", {
      section_id: activeSection.id,
      metres_per_norm_unit: mpu,
      scale_ratio: activeSection.scale_ratio,
      scale_source: activeSection.scale_source || "CALIBRATED"
    });
  } catch {
  }
}
async function openSection(sectionId) {
  const sec = sections.find((s) => s.id === sectionId);
  if (!sec || !auth?.token) return;
  endDiscovery();
  endCalibrate();
  activeSection = sec;
  const n = partNoun(sec.region_kind);
  syncWorkspaceLabels(sec.region_kind);
  sectionTitleEl.textContent = sec.label || n.title;
  sectionMetaEl.textContent = `${n.kindLabel} \xB7 page ${sec.page_index + 1} \xB7 ${sec.document_id.slice(0, 8)}\u2026`;
  pickerPanelEl.classList.add("hidden");
  workspacePanelEl.classList.remove("hidden");
  updateScaleUi();
  setStatus(`Loading ${n.title.toLowerCase()} crop\u2026`, "busy");
  try {
    await loadCroppedPdf(sec);
    await tryDetectPdfScale(sec);
    await loadRooms();
    updateScaleUi();
    setStatus(`${n.title} ready \u2014 calibrate, discover, or draw ${n.plural}`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function loadCroppedPdf(sec) {
  const res = await fetch(`/api/drawings/download?document_id=${encodeURIComponent(sec.document_id)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  if (!res.ok) throw new Error(`Failed to load PDF (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
  const pageNum = Math.min(pdfDoc.numPages, Math.max(1, sec.page_index + 1));
  const page = await pdfDoc.getPage(pageNum);
  const renderScale = 2.5;
  const viewport = page.getViewport({ scale: renderScale });
  const off = document.createElement("canvas");
  off.width = Math.floor(viewport.width);
  off.height = Math.floor(viewport.height);
  const octx = off.getContext("2d");
  if (!octx) throw new Error("canvas context unavailable");
  await page.render({ canvasContext: octx, viewport }).promise;
  const x0 = Math.floor(sec.x_min * off.width);
  const y0 = Math.floor(sec.y_min * off.height);
  const x1 = Math.ceil(sec.x_max * off.width);
  const y1 = Math.ceil(sec.y_max * off.height);
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);
  cropBitmap = document.createElement("canvas");
  cropBitmap.width = cw;
  cropBitmap.height = ch;
  const cctx = cropBitmap.getContext("2d");
  if (!cctx) throw new Error("crop context unavailable");
  cctx.drawImage(off, x0, y0, cw, ch, 0, 0, cw, ch);
  const baseVp = page.getViewport({ scale: 1 });
  cropWidthPdfPts = (sec.x_max - sec.x_min) * baseVp.width;
  viewZoom = 1;
  await paintCropView();
}
async function tryDetectPdfScale(sec) {
  if (!pdfDoc) return;
  if (sec.metres_per_norm_unit != null && sec.metres_per_norm_unit > 0) return;
  try {
    const page = await pdfDoc.getPage(Math.min(pdfDoc.numPages, Math.max(1, sec.page_index + 1)));
    const content = await page.getTextContent();
    const base = page.getViewport({ scale: 1 });
    let found = null;
    for (const item of content.items) {
      const str = item.str || "";
      const ratio = parseScaleRatioFromText(str);
      if (ratio == null) continue;
      const t = item.transform;
      if (t && t.length >= 6) {
        const px = t[4] / base.width;
        const py = 1 - t[5] / base.height;
        if (px < sec.x_min - 0.02 || px > sec.x_max + 0.02 || py < sec.y_min - 0.02 || py > sec.y_max + 0.02) {
          continue;
        }
      }
      found = ratio;
      break;
    }
    if (found == null || !(cropWidthPdfPts > 0)) return;
    const mpu = metresPerNormFromPaperScale(found, cropWidthPdfPts);
    await apiPost("/api/floormap/scale", {
      section_id: sec.id,
      metres_per_norm_unit: mpu,
      scale_ratio: found,
      scale_source: "PDF_TEXT"
    });
    sec.metres_per_norm_unit = mpu;
    sec.scale_ratio = found;
    sec.scale_source = "PDF_TEXT";
    activeSection = sec;
    const idx = sections.findIndex((s) => s.id === sec.id);
    if (idx >= 0) sections[idx] = sec;
    calibrateHintEl.textContent = `Detected paper scale 1:${found} from PDF text.`;
  } catch {
  }
}
async function paintCropView() {
  if (!cropBitmap) return;
  canvasWidth = Math.max(1, Math.floor(cropBitmap.width * viewZoom));
  canvasHeight = Math.max(1, Math.floor(cropBitmap.height * viewZoom));
  pdfCanvas.width = canvasWidth;
  pdfCanvas.height = canvasHeight;
  overlayCanvas.width = canvasWidth;
  overlayCanvas.height = canvasHeight;
  const ctx = pdfCanvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(cropBitmap, 0, 0, canvasWidth, canvasHeight);
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
  drawOverlay();
}
function updateZoomLabel() {
  zoomLabelEl.textContent = `${Math.round(viewZoom * 100)}%`;
}
async function setViewZoom(next) {
  viewZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  updateZoomLabel();
  await paintCropView();
}
async function zoomToFit() {
  if (!cropBitmap) return;
  const avail = Math.max(200, pdfScrollEl.clientWidth - 16);
  await setViewZoom(avail / cropBitmap.width);
}
function canvasToNorm(cx, cy) {
  return {
    x: Math.min(1, Math.max(0, cx / Math.max(1, canvasWidth))),
    y: Math.min(1, Math.max(0, cy / Math.max(1, canvasHeight)))
  };
}
function normToCanvas(p) {
  return { x: p.x * canvasWidth, y: p.y * canvasHeight };
}
function eventToCanvas(ev) {
  const rect = overlayCanvas.getBoundingClientRect();
  return {
    x: (ev.clientX - rect.left) / Math.max(1, rect.width) * canvasWidth,
    y: (ev.clientY - rect.top) / Math.max(1, rect.height) * canvasHeight
  };
}
function drawPolyline(ctx, points, stroke, fill, lineWidth, opts) {
  if (points.length < 2) return;
  ctx.beginPath();
  const first = normToCanvas(points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = normToCanvas(points[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  if (opts?.dash?.length) ctx.setLineDash(opts.dash);
  else ctx.setLineDash([]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (opts?.vertexHandles) {
    const verts = points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6 ? points.slice(0, -1) : points;
    for (const pt of verts) {
      const c = normToCanvas(pt);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  if (opts?.label) {
    const xs = points.map((p) => normToCanvas(p).x);
    const ys = points.map((p) => normToCanvas(p).y);
    const lx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const ly = Math.min(...ys) - 8;
    ctx.fillStyle = stroke;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opts.label, lx, Math.max(12, ly));
  }
}
function drawOverlay() {
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  for (const r of rooms) {
    if (!r.points?.length) continue;
    drawPolyline(ctx, r.points, "#6a1b9a", "rgba(106,27,154,0.12)", 1.5);
  }
  if (discovery) {
    discovery.candidates.forEach((ring, i) => {
      if (i === discovery.index) return;
      drawPolyline(ctx, ring, "#9e9e9e", "rgba(158,158,158,0.06)", 1.5, { dash: [4, 4] });
    });
    if (discovery.current.length >= 2) {
      drawPolyline(ctx, discovery.current, "#c62828", "rgba(198,40,40,0.12)", 2.5, {
        dash: [8, 4],
        vertexHandles: true,
        label: `Candidate ${discovery.index + 1}`
      });
    }
  }
  if (pendingRoom?.points.length) {
    drawPolyline(
      ctx,
      pendingRoom.points,
      "#2e7d32",
      pendingRoom.closed ? "rgba(46,125,50,0.18)" : "rgba(46,125,50,0.08)",
      2,
      { vertexHandles: pendingRoom.closed || pendingRoom.points.length >= 2 }
    );
    if (!pendingRoom.closed && pendingRoom.points.length >= 1) {
      ctx.strokeStyle = "#2e7d32";
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const a = normToCanvas(pendingRoom.points[0]);
      ctx.moveTo(a.x, a.y);
      for (let i = 1; i < pendingRoom.points.length; i++) {
        const p = normToCanvas(pendingRoom.points[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (calibrate?.points.length) {
    ctx.strokeStyle = "#1565c0";
    ctx.fillStyle = "#1565c0";
    ctx.lineWidth = 2;
    for (let i = 0; i < calibrate.points.length; i++) {
      const c = normToCanvas(calibrate.points[i]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (i === 1) {
        const a = normToCanvas(calibrate.points[0]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
      }
    }
  }
  if (measure.tool === "length") {
    const pts = measureDisplayPoints();
    if (pts.length > 0) {
      ctx.strokeStyle = "#0277bd";
      ctx.fillStyle = "#0277bd";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      const first = normToCanvas(pts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < pts.length; i++) {
        const p = normToCanvas(pts[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const pt of measure.points) {
        const c = normToCanvas(pt);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#0277bd";
        ctx.fill();
      }
    }
  }
}
function seedStarterRoom() {
  return ensureEditablePolyline(
    [
      { x: 0.28, y: 0.28 },
      { x: 0.72, y: 0.28 },
      { x: 0.72, y: 0.72 },
      { x: 0.28, y: 0.72 }
    ],
    20
  );
}
function scrollToRing(points) {
  if (!points.length || canvasWidth <= 0 || canvasHeight <= 0) return;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2 * canvasWidth - pdfScrollEl.clientWidth / 2;
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2 * canvasHeight - pdfScrollEl.clientHeight / 2;
  pdfScrollEl.scrollTo({
    top: Math.max(0, midY),
    left: Math.max(0, midX),
    behavior: "auto"
  });
}
function endDiscovery(msg) {
  discovery = null;
  discoveryDockEl.classList.add("hidden");
  document.body.classList.remove("discovery-active");
  if (msg) setStatus(msg, "ok");
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
}
function showDiscoveryCandidate() {
  if (!discovery) return;
  const total = discovery.candidates.length;
  const i = discovery.index;
  if (i >= total) {
    endDiscovery(
      total === 0 ? "Discovery finished" : `Discovery finished \u2014 reviewed ${total} candidate(s)`
    );
    return;
  }
  discovery.current = ensureEditablePolyline(
    discovery.candidates[i].map((p) => ({ ...p })),
    16
  );
  discovery.candidates[i] = discovery.current;
  discovery.dragVertex = null;
  discoveryProgressEl.textContent = `(${i + 1} of ${total})`;
  discoveryHintEl.textContent = "Drag anchors to follow walls. Double-click an anchor to remove it, or Simplify to thin the polyline.";
  discoveryLabelInput.value = `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  discoveryDockEl.classList.remove("hidden");
  document.body.classList.add("discovery-active");
  updateMeasureReadouts();
  updateToolHint();
  drawOverlay();
  scrollToRing(discovery.current);
}
async function startDiscovery() {
  if (!cropBitmap || !activeSection) {
    setStatus(`Open a ${activePartNoun().title.toLowerCase()} first`, "err");
    return;
  }
  endCalibrate();
  clearPendingRoom();
  if (measure.tool !== "off") clearMeasure(false);
  discoverBtn.disabled = true;
  if (discoverBtnSide) discoverBtnSide.disabled = true;
  setStatus(`Discovering ${activePartNoun().plural}\u2026`, "busy");
  const ctx = cropBitmap.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    setStatus("Cannot read drawing image", "err");
    discoverBtn.disabled = false;
    if (discoverBtnSide) discoverBtnSide.disabled = false;
    return;
  }
  const img = ctx.getImageData(0, 0, cropBitmap.width, cropBitmap.height);
  let found = [];
  try {
    found = discoverRoomPolylines(img);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Discovery failed", "err");
    discoverBtn.disabled = false;
    if (discoverBtnSide) discoverBtnSide.disabled = false;
    return;
  }
  let norms = found.map(
    (r) => ensureEditablePolyline(
      pixelsToSectionNorm(r.points, cropBitmap.width, cropBitmap.height),
      16
    )
  );
  let seeded = false;
  if (norms.length === 0) {
    norms = [seedStarterRoom()];
    seeded = true;
  }
  discovery = { candidates: norms, index: 0, current: [], dragVertex: null };
  showDiscoveryCandidate();
  setStatus(
    seeded ? "No auto rooms found \u2014 adjust the red starter outline to fit a room, then Accept" : `${norms.length} room candidate(s) \u2014 drag the red dashed outline to fit, then Accept / Skip`,
    seeded ? "busy" : "ok"
  );
  discoverBtn.disabled = false;
  if (discoverBtnSide) discoverBtnSide.disabled = false;
}
async function acceptDiscovery() {
  if (!discovery || !activeSection || !auth) return;
  const points = closeRing(discovery.current);
  const label = discoveryLabelInput.value.trim() || `${activePartNoun().singular.charAt(0).toUpperCase() + activePartNoun().singular.slice(1)} ${rooms.length + 1}`;
  const level = discoveryLevelSelect.value || "OTHER";
  discoveryAcceptBtn.disabled = true;
  setStatus("Saving room\u2026", "busy");
  try {
    const mpu = activeScaleMpu();
    await apiPost("/api/floormap/subsections", {
      section_id: activeSection.id,
      label,
      level_hint: level,
      points,
      metres_per_norm_unit: mpu ?? void 0
    });
    await loadRooms();
    discovery.index += 1;
    showDiscoveryCandidate();
    if (discovery && discovery.index < discovery.candidates.length) {
      setStatus(`Saved ${label} \u2014 next candidate (${discovery.index + 1} of ${discovery.candidates.length})`, "ok");
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    discoveryAcceptBtn.disabled = false;
  }
}
function skipDiscovery() {
  if (!discovery) return;
  discovery.index += 1;
  showDiscoveryCandidate();
}
function removeVertexFromActiveOutline(index) {
  if (discovery?.current) {
    const next = removeRingVertex(discovery.current, index);
    if (!next) {
      setStatus("Need at least 3 anchors", "err");
      return false;
    }
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    discovery.dragVertex = null;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(`Removed anchor (${ringVertexCount(next)} left)`, "ok");
    return true;
  }
  if (pendingRoom?.closed) {
    const next = removeRingVertex(pendingRoom.points, index);
    if (!next) {
      setStatus("Need at least 3 anchors", "err");
      return false;
    }
    pendingRoom.points = next;
    pendingRoom.dragVertex = null;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    drawOverlay();
    setStatus(`Removed anchor (${ringVertexCount(next)} left)`, "ok");
    return true;
  }
  return false;
}
function simplifyActiveOutline() {
  if (discovery?.current) {
    const before = ringVertexCount(discovery.current);
    const next = simplifyEditableRing(discovery.current);
    const after = ringVertexCount(next);
    discovery.current = next;
    discovery.candidates[discovery.index] = next;
    updateMeasureReadouts();
    drawOverlay();
    setStatus(
      after < before ? `Simplified ${before} \u2192 ${after} anchors` : "Outline already simple",
      "ok"
    );
    return;
  }
  if (pendingRoom?.closed) {
    const before = ringVertexCount(pendingRoom.points);
    const next = simplifyEditableRing(pendingRoom.points);
    const after = ringVertexCount(next);
    pendingRoom.points = next;
    syncPendingRoomButtons();
    updateMeasureReadouts();
    drawOverlay();
    setStatus(
      after < before ? `Simplified ${before} \u2192 ${after} anchors` : "Outline already simple",
      "ok"
    );
  }
}
function nudgeCurrent(dx, dy) {
  if (discovery?.current) {
    discovery.current = translateRing(discovery.current, dx, dy);
    discovery.candidates[discovery.index] = closeRing(discovery.current);
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (pendingRoom?.closed) {
    pendingRoom.points = translateRing(pendingRoom.points, dx, dy);
    updateMeasureReadouts();
    drawOverlay();
  }
}
function endCalibrate(msg) {
  calibrate = null;
  calibrateMetresWrap.classList.add("hidden");
  updateScaleUi();
  drawOverlay();
  if (msg) setStatus(msg, "ok");
}
function startCalibrate() {
  endDiscovery();
  if (measure.tool !== "off") clearMeasure(false);
  if (calibrate) {
    endCalibrate("Calibration cancelled");
    return;
  }
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Click both ends of a known length on the floormap.";
  calibrateBtn.textContent = "Cancel calibrate";
  setStatus("Click first scale point", "busy");
  drawOverlay();
}
function repickCalibrate() {
  if (!calibrate) return;
  calibrate = { points: [] };
  calibrateMetresWrap.classList.add("hidden");
  calibrateHintEl.textContent = "Click both ends of a known length on the floormap.";
  setStatus("Click first scale point", "busy");
  drawOverlay();
}
async function finishCalibrate() {
  if (!calibrate || calibrate.points.length < 2 || !activeSection) return;
  const mm = Number(calibrateMetresInput.value);
  if (!(mm > 0)) {
    setStatus("Enter a positive length in millimetres", "err");
    return;
  }
  const a = calibrate.points[0];
  const b = calibrate.points[1];
  const normDist = Math.hypot(b.x - a.x, b.y - a.y);
  if (normDist < 1e-6) {
    setStatus("Calibration points too close", "err");
    return;
  }
  const mpu = mm / 1e3 / normDist;
  try {
    await apiPost("/api/floormap/scale", {
      section_id: activeSection.id,
      metres_per_norm_unit: mpu,
      scale_ratio: null,
      scale_source: "CALIBRATED"
    });
    activeSection.metres_per_norm_unit = mpu;
    activeSection.scale_source = "CALIBRATED";
    const idx = sections.findIndex((s) => s.id === activeSection.id);
    if (idx >= 0) sections[idx] = activeSection;
    endCalibrate(`Scale saved: marked line = ${mm} mm`);
    updateMeasureReadouts();
    updateToolHint();
    await loadRooms();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function deleteRoom(id) {
  try {
    await apiDelete(`/api/floormap/subsections?subsection_id=${encodeURIComponent(id)}`);
    if (pendingRoom?.editingId === id) clearPendingRoom();
    await loadRooms();
    setStatus("Room removed", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
function hitVertex(norm, points, pxRadius = 8) {
  const thresh = pxRadius / Math.max(canvasWidth, 1);
  const n = points.length > 1 && Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < 1e-6 ? points.length - 1 : points.length;
  for (let i = 0; i < n; i++) {
    if (Math.hypot(points[i].x - norm.x, points[i].y - norm.y) <= thresh) return i;
  }
  return -1;
}
overlayCanvas.addEventListener("mousedown", (ev) => {
  const c = eventToCanvas(ev);
  const norm = canvasToNorm(c.x, c.y);
  if (calibrate) {
    if (calibrate.points.length >= 2) return;
    calibrate.points.push(norm);
    drawOverlay();
    if (calibrate.points.length === 1) {
      setStatus("Click second scale point", "busy");
      calibrateHintEl.textContent = "Click the other end of the known length.";
    } else if (calibrate.points.length >= 2) {
      calibrateMetresWrap.classList.remove("hidden");
      calibrateHintEl.textContent = "Enter the real length in millimetres, then Apply (or press Enter).";
      setStatus("Enter length in mm, then Apply", "ok");
      queueMicrotask(() => {
        calibrateMetresInput.focus();
        calibrateMetresInput.select();
      });
    }
    return;
  }
  if (pendingRoom?.drawing && !pendingRoom.closed) {
    if (pendingRoom.points.length >= 3) {
      const first = pendingRoom.points[0];
      if (Math.hypot(norm.x - first.x, norm.y - first.y) <= 10 / Math.max(canvasWidth, 1) || ev.detail === 2) {
        closePendingPolygon();
        return;
      }
    }
    pendingRoom.points.push(norm);
    syncPendingRoomButtons();
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    return;
  }
  if (pendingRoom?.closed) {
    const vi = hitVertex(norm, pendingRoom.points, 12);
    if (vi >= 0) {
      if (ev.detail === 2) {
        removeVertexFromActiveOutline(vi);
        return;
      }
      pendingRoom.dragVertex = vi;
      return;
    }
  }
  if (measure.tool === "length") {
    if (!activeScaleMpu()) {
      setStatus("Set scale first", "err");
      return;
    }
    if (measure.points.length >= 2) {
      measure.points = [norm];
    } else {
      measure.points.push(norm);
    }
    updateMeasureReadouts();
    updateToolHint();
    drawOverlay();
    return;
  }
  if (discovery) {
    const vi = hitVertex(norm, discovery.current, 12);
    if (vi >= 0) {
      if (ev.detail === 2) {
        removeVertexFromActiveOutline(vi);
        return;
      }
      discovery.dragVertex = vi;
      return;
    }
  }
});
overlayCanvas.addEventListener("dblclick", (ev) => {
  ev.preventDefault();
});
overlayCanvas.addEventListener("mousemove", (ev) => {
  const c = eventToCanvas(ev);
  const norm = canvasToNorm(c.x, c.y);
  if (pendingRoom?.dragVertex != null) {
    const i2 = pendingRoom.dragVertex;
    pendingRoom.points[i2] = norm;
    if (i2 === 0 && pendingRoom.closed) {
      pendingRoom.points[pendingRoom.points.length - 1] = { ...norm };
    }
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (measure.tool === "length" && measure.points.length < 2) {
    measure.cursor = norm;
    updateMeasureReadouts();
    drawOverlay();
    return;
  }
  if (!discovery || discovery.dragVertex == null) return;
  const i = discovery.dragVertex;
  discovery.current[i] = norm;
  if (i === 0) discovery.current[discovery.current.length - 1] = { ...norm };
  discovery.candidates[discovery.index] = closeRing(discovery.current);
  updateMeasureReadouts();
  drawOverlay();
});
overlayCanvas.addEventListener("mouseup", () => {
  if (discovery) {
    if (discovery.dragVertex != null) {
      discovery.candidates[discovery.index] = closeRing(discovery.current);
    }
    discovery.dragVertex = null;
  }
  if (pendingRoom) pendingRoom.dragVertex = null;
});
overlayCanvas.addEventListener("mouseleave", () => {
  if (discovery) discovery.dragVertex = null;
  if (pendingRoom) pendingRoom.dragVertex = null;
});
loginForm.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const fd = new FormData(loginForm);
  const username = String(fd.get("username") || "");
  const password = String(fd.get("password") || "");
  void (async () => {
    try {
      setStatus("Signing in\u2026", "busy");
      await bootstrapAndLogin(username, password);
      setStatus("Signed in", "ok");
      if (buildingId) await loadFloormapSections(buildingId);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
      showLogin();
    }
  })();
});
logoutBtn.addEventListener("click", () => {
  showLogin();
  setStatus("Signed out", "ok");
});
loadBuildingBtn.addEventListener("click", () => {
  void loadFloormapSections(buildingInput.value);
});
backPickerBtn.addEventListener("click", () => {
  endDiscovery();
  endCalibrate();
  clearMeasure(false);
  workspacePanelEl.classList.add("hidden");
  pickerPanelEl.classList.remove("hidden");
  activeSection = null;
  renderSectionList();
});
zoomOutBtn.addEventListener("click", () => void setViewZoom(viewZoom - ZOOM_STEP));
zoomInBtn.addEventListener("click", () => void setViewZoom(viewZoom + ZOOM_STEP));
zoomBtn.addEventListener("click", () => void setViewZoom(1));
zoomFitBtn.addEventListener("click", () => void zoomToFit());
discoverBtn.addEventListener("click", () => void startDiscovery());
discoverBtnSide?.addEventListener("click", () => void startDiscovery());
calibrateBtn.addEventListener("click", () => startCalibrate());
calibrateApplyBtn.addEventListener("click", () => void finishCalibrate());
calibrateRepickBtn.addEventListener("click", () => repickCalibrate());
calibrateMetresInput.addEventListener("keydown", (evt) => {
  if (evt.key === "Enter") {
    evt.preventDefault();
    void finishCalibrate();
  }
});
roomDrawBtn.addEventListener("click", () => startDrawRoom());
roomCloseBtn.addEventListener("click", () => closePendingPolygon());
roomSimplifyBtn?.addEventListener("click", () => simplifyActiveOutline());
roomSaveBtn.addEventListener("click", () => void savePendingRoom());
roomClearBtn.addEventListener("click", () => {
  clearPendingRoom();
  setStatus("Room mark cleared", "ok");
});
document.querySelectorAll(".tool-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMeasureTool(btn.dataset.tool || "off");
  });
});
toolClearBtn?.addEventListener("click", () => {
  if (pendingRoom) {
    clearPendingRoom();
    setStatus("Room mark cleared", "ok");
    return;
  }
  clearMeasure(true);
  setStatus("Measure cleared", "ok");
});
window.addEventListener("keydown", (evt) => {
  if (evt.key !== "Escape") return;
  if (pendingRoom) {
    clearPendingRoom();
    setStatus("Room mark cleared", "ok");
  } else if (measure.tool !== "off") {
    clearMeasure(true);
    setStatus("Measure cleared", "ok");
  }
});
discoveryAcceptBtn.addEventListener("click", () => void acceptDiscovery());
discoverySkipBtn.addEventListener("click", () => skipDiscovery());
discoveryCancelBtn.addEventListener("click", () => endDiscovery("Discovery cancelled"));
discoverySimplifyBtn?.addEventListener("click", () => simplifyActiveOutline());
nudgeLeftBtn.addEventListener("click", () => nudgeCurrent(-0.01, 0));
nudgeRightBtn.addEventListener("click", () => nudgeCurrent(0.01, 0));
nudgeUpBtn.addEventListener("click", () => nudgeCurrent(0, -0.01));
nudgeDownBtn.addEventListener("click", () => nudgeCurrent(0, 0.01));
syncPendingRoomButtons();
function connect() {
  setStatus("Connecting\u2026", "busy");
  setConnLed(false);
  ws = new WebSocket(BPP_WS);
  ws.addEventListener("open", () => {
    setConnLed(true);
    void (async () => {
      try {
        await send("session.open", { client: "acoustics-floormap" }, "session.opened");
        const stored = loadStoredAuth();
        if (stored?.token) {
          await loadSharedApi();
          const ret = await invokeString("API_ValidateSession", [stored.token]);
          if (ret.startsWith("ERROR")) {
            showLogin();
            setStatus("Session expired \u2014 sign in", "err");
            return;
          }
          showPanel(stored);
          setStatus("Ready", "ok");
          buildingInput.value = buildingId;
          if (buildingId) await loadFloormapSections(buildingId);
        } else {
          showLogin();
          setStatus("Connected \u2014 sign in", "ok");
        }
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "err");
        showLogin();
      }
    })();
  });
  ws.addEventListener("message", (ev) => onMessage(String(ev.data)));
  ws.addEventListener("close", () => {
    setConnLed(false);
    setStatus("Disconnected", "err");
  });
  ws.addEventListener("error", () => setStatus("WebSocket error", "err"));
}
buildingInput.value = buildingId;
connect();
