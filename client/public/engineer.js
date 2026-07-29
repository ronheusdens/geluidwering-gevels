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

// src/password-toggle.ts
var EYE_CLOSED = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75C21.27 9.11 17 5 12 5c-1.4 0-2.73.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>`;
var EYE_OPEN = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5c-5 0-9.27 3.11-11 7.5C2.73 16.89 7 20 12 20s9.27-3.11 11-7.5C21.27 8.11 17 5 12 5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`;
function enhancePasswordInput(input) {
  if (input.dataset.pwToggle === "1") return;
  if (input.closest(".pw-field")) return;
  input.dataset.pwToggle = "1";
  const wrap = document.createElement("div");
  wrap.className = "pw-field";
  input.parentNode?.insertBefore(wrap, input);
  wrap.appendChild(input);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pw-toggle";
  btn.setAttribute("aria-label", "Wachtwoord tonen");
  btn.setAttribute("aria-pressed", "false");
  btn.innerHTML = EYE_CLOSED;
  wrap.appendChild(btn);
  btn.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.innerHTML = show ? EYE_OPEN : EYE_CLOSED;
    btn.setAttribute("aria-pressed", show ? "true" : "false");
    btn.setAttribute("aria-label", show ? "Wachtwoord verbergen" : "Wachtwoord tonen");
  });
}
function initPasswordToggles(root = document) {
  root.querySelectorAll('input[type="password"]').forEach(enhancePasswordInput);
}

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
function normalizeAspectYx(aspectYx) {
  if (aspectYx == null || !Number.isFinite(aspectYx) || aspectYx <= 0) return 1;
  return aspectYx;
}
function scaleAxes(metresPerNorm, aspectYx) {
  const a = normalizeAspectYx(aspectYx);
  return { mx: metresPerNorm, my: metresPerNorm * a };
}
function scaledSegmentLength(dx, dy, metresPerNorm, aspectYx) {
  const { mx, my } = scaleAxes(metresPerNorm, aspectYx);
  return Math.hypot(dx * mx, dy * my);
}
function scaledPathLength(points, metresPerNorm, aspectYx, closed = false) {
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
function scaledAreaM2(areaNorm, metresPerNorm, aspectYx) {
  const { mx, my } = scaleAxes(metresPerNorm, aspectYx);
  return areaNorm * mx * my;
}
function metresPerNormFromCalibration(lengthMetres, a, b, aspectYx) {
  const dist = Math.hypot(b.x - a.x, (b.y - a.y) * normalizeAspectYx(aspectYx));
  if (!(dist > 1e-12) || !(lengthMetres > 0)) return NaN;
  return lengthMetres / dist;
}

// src/engineer.ts
var BPP_WS = resolveBppWsUrl();
var AUTH_KEY = "app_gevelwering_engineer_auth";
var connBarEl = document.getElementById("engineer-conn-bar");
var connLedEl = document.getElementById("engineer-conn-led");
var connStatusEl = document.getElementById("engineer-conn-status");
var loginPanelEl = document.getElementById("engineer-login-panel");
var loginForm = document.getElementById("engineer-login-form");
var loginBtn = document.getElementById("engineer-login-btn");
var panelEl = document.getElementById("engineer-panel");
var userLabelEl = document.getElementById("engineer-user-label");
var logoutBtn = document.getElementById("engineer-logout-btn");
var refreshBtn = document.getElementById("engineer-refresh-btn");
var gaLinkEl = document.getElementById("engineer-ga-link");
var queueListEl = document.getElementById("engineer-queue-list");
var reviewPanelEl = document.getElementById("engineer-review-panel");
var projectTitleEl = document.getElementById("engineer-project-title");
var projectMetaEl = document.getElementById("engineer-project-meta");
var docSelectEl = document.getElementById("engineer-doc-select");
var docHintEl = document.getElementById("engineer-doc-hint");
var regionListEl = document.getElementById("engineer-region-list");
var regionLabelInput = document.getElementById("region-label-input");
var regionKindSelect = document.getElementById("region-kind-select");
var regionPageInput = document.getElementById("region-page-input");
var regionPageDisplayEl = document.getElementById("region-page-display");
var regionSaveBtn = document.getElementById("region-save-btn");
var regionClearBtn = document.getElementById("region-clear-btn");
var regionDiscoverBtn = document.getElementById("region-discover-btn");
var regionClearAllBtn = document.getElementById("region-clear-all-btn");
var regionFilterKindEl = document.getElementById("region-filter-kind");
var regionPendingHintEl = document.getElementById("region-pending-hint");
var regionCountBadgeEl = document.getElementById("region-count-badge");
var scaleBtn = document.getElementById("engineer-scale-btn");
var scaleStatusEl = document.getElementById("engineer-scale-status");
var scaleMmWrap = document.getElementById("engineer-scale-mm-wrap");
var scaleMmInput = document.getElementById("engineer-scale-mm");
var scaleApplyBtn = document.getElementById("engineer-scale-apply-btn");
var scaleRepickBtn = document.getElementById("engineer-scale-repick-btn");
var scaleHintEl = document.getElementById("engineer-scale-hint");
var toolSelectEl = document.getElementById("engineer-tool-select");
var toolSelectSidebarEl = document.getElementById("engineer-tool-select-sidebar");
var toolClearBtn = document.getElementById("engineer-tool-clear-btn");
var toolClearSidebarBtn = document.getElementById("engineer-tool-clear-btn-sidebar");
var analyzeComponentsFieldset = document.getElementById("analyze-components-fieldset");
var analyzeComponentsLegend = document.getElementById("analyze-components-legend");
var analyzeComponentsHint = document.getElementById("analyze-components-hint");
var analyzeOpenBtn = document.getElementById("analyze-open-btn");
var analyzeDiscoverBtn = document.getElementById("analyze-discover-btn");
var analyzeDrawBtn = document.getElementById("analyze-draw-btn");
var toolHintEl = document.getElementById("engineer-tool-hint");
var toolLengthMmEl = document.getElementById("tool-length-mm");
var toolCircMmEl = document.getElementById("tool-circ-mm");
var toolAreaMm2El = document.getElementById("tool-area-mm2");
var pdfCanvas = document.getElementById("engineer-pdf-canvas");
var overlayCanvas = document.getElementById("engineer-overlay-canvas");
var pdfScrollEl = document.getElementById("engineer-pdf-scroll");
var pagePrevBtn = document.getElementById("engineer-page-prev");
var pageNextBtn = document.getElementById("engineer-page-next");
var pageLabelEl = document.getElementById("engineer-page-label");
var zoomOutBtn = document.getElementById("engineer-zoom-out");
var zoomInBtn = document.getElementById("engineer-zoom-in");
var zoomBtn = document.getElementById("engineer-zoom-btn");
var zoomFitBtn = document.getElementById("engineer-zoom-fit");
var zoomLabelEl = document.getElementById("engineer-zoom-label");
var discoveryPanelEl = document.getElementById("discovery-review-panel");
var discoveryProgressEl = document.getElementById("discovery-progress");
var discoveryHintEl = document.getElementById("discovery-hint");
var discoveryLabelInput = document.getElementById("discovery-label-input");
var discoveryKindSelect = document.getElementById("discovery-kind-select");
var discoveryAcceptBtn = document.getElementById("discovery-accept-btn");
var discoverySkipBtn = document.getElementById("discovery-skip-btn");
var discoveryCancelBtn = document.getElementById("discovery-cancel-btn");
var discNudgeLeftBtn = document.getElementById("disc-nudge-left");
var discNudgeRightBtn = document.getElementById("disc-nudge-right");
var discNudgeUpBtn = document.getElementById("disc-nudge-up");
var discNudgeDownBtn = document.getElementById("disc-nudge-down");
var discShrinkHBtn = document.getElementById("disc-shrink-h");
var discGrowHBtn = document.getElementById("disc-grow-h");
var discShrinkVBtn = document.getElementById("disc-shrink-v");
var discGrowVBtn = document.getElementById("disc-grow-v");
var reviewForm = document.getElementById("engineer-review-form");
var reviewLegibleEl = document.getElementById("review-legible");
var reviewSufficientEl = document.getElementById("review-sufficient");
var reviewNotesEl = document.getElementById("review-notes");
var ws = null;
var sessionId = null;
var auth = null;
var reqCounter = 0;
var pending = /* @__PURE__ */ new Map();
var activeProject = null;
var activeDocumentId = null;
var pdfDoc = null;
var pdfPageNum = 1;
var pdfTotalPages = 0;
var canvasWidth = 0;
var canvasHeight = 0;
var pdfZoom = 2;
var PDF_ZOOM_MIN = 0.75;
var PDF_ZOOM_MAX = 5;
var PDF_ZOOM_STEP = 0.35;
var dragStart = null;
var dragCurrent = null;
var pendingMarkNorm = null;
var savedRegionCount = 0;
var discoveryCandidates = [];
var discoveryIndex = 0;
var discoveryPageIndex = 0;
var discoveryAdjust = null;
function currentRegionKindFilter() {
  return (regionFilterKindEl?.value || "").trim();
}
var selectedRegionId = null;
var scalePick = null;
var measure = { tool: "off", points: [], cursor: null, closed: false };
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
  reviewPanelEl.classList.add("hidden");
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
  if (typeof ret !== "string") throw new Error(`Unexpected return from ${target}: ${JSON.stringify(inv.payload)}`);
  return ret;
}
function statusLabel(status) {
  switch (status) {
    case "INITIAL_REQUEST":
      return "Initial request";
    case "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED":
      return "Awaiting review";
    case "PROJECT_UNDERWAY":
      return "Under review / calculation";
    case "PROJECT_NEAR_FINAL":
      return "Near final";
    case "PROJECT_FINISHED":
      return "Finished";
    default:
      return status;
  }
}
async function loadSharedApi() {
  await send(
    "exec.request",
    { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
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
async function loadQueue() {
  if (!auth?.token) return;
  setStatus("Loading review queue\u2026", "busy");
  const ret = await invokeString("API_EngineerListReviewQueue", [auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("engineer")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret);
  const projects = parsed.projects ?? [];
  queueListEl.innerHTML = "";
  if (projects.length === 0) {
    queueListEl.innerHTML = `<p class="hint">No projects awaiting review.</p>`;
    setStatus("Queue empty", "ok");
    return;
  }
  for (const p of projects) {
    const card = document.createElement("article");
    card.className = "admin-project-card panel";
    const title = p.label || p.building_id.slice(0, 8);
    card.innerHTML = `
      <h3>${title}</h3>
      <p class="hint">${p.customer_name} \xB7 ${statusLabel(p.project_status)} \xB7 ${p.drawing_count} drawing(s)</p>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Open for review";
    btn.addEventListener("click", () => {
      void openProject(p.building_id);
    });
    card.appendChild(btn);
    queueListEl.appendChild(card);
  }
  setStatus(`${projects.length} project(s) in queue`, "ok");
}
async function openProject(buildingId) {
  if (!auth?.token) return;
  setStatus("Loading project\u2026", "busy");
  const ret = await invokeString("API_EngineerGetProject", [auth.token, buildingId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  activeProject = JSON.parse(ret);
  activeProject.regions = (activeProject.regions || []).map(normalizeRegion);
  reviewPanelEl.classList.remove("hidden");
  projectTitleEl.textContent = activeProject.label || "Project";
  projectMetaEl.textContent = `${activeProject.customer_name} \xB7 ${statusLabel(activeProject.project_status)} \xB7 ref ${activeProject.external_ref || "\u2014"}`;
  if (gaLinkEl) {
    gaLinkEl.href = `/ga.html?building_id=${encodeURIComponent(activeProject.building_id)}`;
    gaLinkEl.classList.remove("hidden");
  }
  reviewLegibleEl.checked = Boolean(activeProject.review?.legible);
  reviewSufficientEl.checked = Boolean(activeProject.review?.sufficient);
  reviewNotesEl.value = activeProject.review?.notes || "";
  docSelectEl.innerHTML = "";
  for (const doc of activeProject.documents) {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = `${doc.filename} (${doc.file_ext.toUpperCase()})`;
    docSelectEl.appendChild(opt);
  }
  if (activeProject.documents.length > 0) {
    activeDocumentId = activeProject.documents[0].id;
    docSelectEl.value = activeDocumentId;
    await loadActiveDocument();
  } else {
    activeDocumentId = null;
    docHintEl.textContent = "No drawings on this project.";
  }
  renderRegionList();
  setStatus("Project loaded", "ok");
}
function normalizeRegion(raw) {
  const scaleRatio = raw.scale_ratio != null ? Number(raw.scale_ratio) : NaN;
  const mpu = raw.metres_per_norm_unit != null ? Number(raw.metres_per_norm_unit) : NaN;
  const aspect = raw.scale_aspect_yx != null ? Number(raw.scale_aspect_yx) : NaN;
  return {
    id: String(raw.id || raw.region_id || ""),
    document_id: String(raw.document_id || ""),
    page_index: Number(raw.page_index) || 0,
    label: String(raw.label || "Section"),
    region_kind: raw.region_kind || "OTHER",
    x_min: Number(raw.x_min),
    y_min: Number(raw.y_min),
    x_max: Number(raw.x_max),
    y_max: Number(raw.y_max),
    scale_ratio: Number.isFinite(scaleRatio) ? scaleRatio : null,
    metres_per_norm_unit: Number.isFinite(mpu) ? mpu : null,
    scale_aspect_yx: Number.isFinite(aspect) && aspect > 0 ? aspect : null,
    scale_source: raw.scale_source != null ? String(raw.scale_source) : null
  };
}
function regionsForActiveDoc() {
  if (!activeProject || !activeDocumentId) return [];
  return activeProject.regions.filter((r) => r.document_id === activeDocumentId);
}
function filteredRegionsForActiveDoc() {
  const all = regionsForActiveDoc();
  const kind = currentRegionKindFilter();
  if (!kind) return all;
  return all.filter((r) => String(r.region_kind || "").toUpperCase() === kind.toUpperCase());
}
function selectedRegion() {
  if (!selectedRegionId || !activeProject) return null;
  return activeProject.regions.find((r) => r.id === selectedRegionId) || null;
}
function scaleSourceLabel(source) {
  switch ((source || "").toUpperCase()) {
    case "PDF_TEXT":
      return "from drawing text";
    case "CALIBRATED":
      return "from marked length";
    default:
      return "";
  }
}
function regionSupportsScale(kind) {
  return kind === "FLOORMAP" || kind === "FACADE" || kind === "SECTION" || kind === "CROSS_SECTION";
}
function formatScaleStatus(sel) {
  const mpu = sel.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0)) return `${sel.label}: scale not set`;
  const src = scaleSourceLabel(sel.scale_source);
  if (sel.scale_ratio != null && sel.scale_ratio > 0) {
    const from2 = src ? ` (${src})` : "";
    return `${sel.label}: paper scale 1:${sel.scale_ratio}${from2}`;
  }
  const from = src ? ` (${src})` : "";
  return `${sel.label}: scale set${from} \u2014 areas/lengths in metres`;
}
function updateScaleUi() {
  const sel = selectedRegion();
  const awaitingMm = Boolean(scalePick && scalePick.points.length >= 2);
  if (scaleMmWrap) scaleMmWrap.classList.toggle("hidden", !awaitingMm);
  if (!sel) {
    scaleStatusEl.textContent = "Select a section, then Set scale";
    scaleHintEl.textContent = "Klik een plattegrond, gevel of doorsnede, daarna Schaal instellen.";
    scaleBtn.disabled = true;
    scaleBtn.textContent = "Set scale";
    return;
  }
  if (!regionSupportsScale(sel.region_kind)) {
    scaleStatusEl.textContent = `${sel.label} cannot be scaled`;
    scaleHintEl.textContent = "Schaal geldt voor plattegrond, gevel, doorsnede en dwarsdoorsnede.";
    scaleBtn.disabled = true;
    scaleBtn.textContent = "Set scale";
    return;
  }
  scaleBtn.disabled = false;
  if (scalePick) {
    if (awaitingMm) {
      scaleStatusEl.textContent = `Two points marked on ${sel.label}`;
      scaleHintEl.textContent = "Enter the real length in millimetres below, then click Apply (or press Enter).";
      scaleBtn.textContent = "Cancel scale";
      queueMicrotask(() => {
        scaleMmInput.focus();
        scaleMmInput.select();
      });
    } else {
      scaleStatusEl.textContent = `Mark a known length (${scalePick.points.length}/2 clicks)`;
      scaleHintEl.textContent = "Click both ends of something with a known size (wall, scale bar, door opening).";
      scaleBtn.textContent = "Cancel scale";
    }
    return;
  }
  scaleStatusEl.textContent = formatScaleStatus(sel);
  const hasScale = sel.metres_per_norm_unit != null && sel.metres_per_norm_unit > 0;
  if (hasScale) {
    scaleHintEl.textContent = "Scale is ready. Use Tools \u2192 Length / Polyline to measure, or Set scale to recalibrate.";
  } else {
    scaleHintEl.textContent = "Click Set scale, mark two points, then enter that length in mm.";
  }
  scaleBtn.textContent = hasScale ? "Recalibrate scale" : "Set scale";
  updateAnalyzePanel();
}
function analysisWorkspaceUrl(sectionId) {
  if (!activeProject) return null;
  return `/floormap.html?building_id=${encodeURIComponent(activeProject.building_id)}&section_id=${encodeURIComponent(sectionId)}`;
}
function updateAnalyzePanel() {
  if (!analyzeComponentsFieldset) return;
  const sel = selectedRegion();
  if (!sel || !regionSupportsScale(sel.region_kind) || !activeProject) {
    analyzeComponentsFieldset.classList.add("hidden");
    return;
  }
  analyzeComponentsFieldset.classList.remove("hidden");
  const isFloor = sel.region_kind === "FLOORMAP";
  const noun = isFloor ? "room" : "component";
  const nounPlural = isFloor ? "rooms" : "components";
  if (analyzeComponentsLegend) {
    analyzeComponentsLegend.textContent = isFloor ? "Rooms" : "Components";
  }
  if (analyzeComponentsHint) {
    analyzeComponentsHint.innerHTML = `This is where you <strong>draw, discover, and save</strong> marked ${nounPlural} on <em>${sel.label}</em> \u2014 same menu as floormap (label, level, Draw, Save, Discover).`;
  }
  if (analyzeOpenBtn) analyzeOpenBtn.textContent = `Open ${noun} analysis workspace`;
  if (analyzeDiscoverBtn) analyzeDiscoverBtn.textContent = `Discover ${nounPlural}\u2026`;
  if (analyzeDrawBtn) analyzeDrawBtn.textContent = `Draw & save ${noun}\u2026`;
}
function openAnalysisWorkspace() {
  const sel = selectedRegion();
  if (!sel || !regionSupportsScale(sel.region_kind)) {
    setStatus("Selecteer eerst een plattegrond, gevel of doorsnede", "err");
    return;
  }
  const url = analysisWorkspaceUrl(sel.id);
  if (!url) {
    setStatus("No project loaded", "err");
    return;
  }
  window.location.href = url;
}
function endScalePick(msg) {
  scalePick = null;
  if (scaleMmWrap) scaleMmWrap.classList.add("hidden");
  updateScaleUi();
  drawRegionsOverlay();
  if (msg) setStatus(msg, "ok");
}
function startScalePick() {
  const sel = selectedRegion();
  if (!sel || !regionSupportsScale(sel.region_kind)) {
    setStatus("Selecteer eerst een plattegrond, gevel of doorsnede", "err");
    return;
  }
  if (discoveryCandidates.length > 0) {
    setStatus("Finish or cancel discovery before setting scale", "err");
    return;
  }
  if (scalePick) {
    endScalePick("Scale pick cancelled");
    return;
  }
  if (measure.tool !== "off") {
    measure.tool = "off";
    clearMeasure(false);
  }
  clearPendingMark();
  scalePick = { points: [] };
  scaleMmWrap.classList.add("hidden");
  updateScaleUi();
  setStatus("Click first scale point on the canvas", "busy");
  drawRegionsOverlay();
}
function repickScalePoints() {
  if (!scalePick) return;
  scalePick = { points: [] };
  scaleMmWrap.classList.add("hidden");
  updateScaleUi();
  setStatus("Click first scale point on the canvas", "busy");
  drawRegionsOverlay();
}
function pageNormToSectionLocal(px, py, sec) {
  const w = Math.max(1e-9, sec.x_max - sec.x_min);
  const h = Math.max(1e-9, sec.y_max - sec.y_min);
  return {
    x: (px - sec.x_min) / w,
    y: (py - sec.y_min) / h
  };
}
function canvasPtToSectionLocal(pt, sec) {
  return pageNormToSectionLocal(pt.x / Math.max(1, canvasWidth), pt.y / Math.max(1, canvasHeight), sec);
}
function activeScaleMpu() {
  const sel = selectedRegion();
  if (!sel || !regionSupportsScale(sel.region_kind)) return null;
  const mpu = sel.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0)) return null;
  return mpu;
}
function sectionScaleAspect(sec) {
  const wNorm = Math.max(1e-9, sec.x_max - sec.x_min);
  const hNorm = Math.max(1e-9, sec.y_max - sec.y_min);
  if (canvasWidth > 0 && canvasHeight > 0) {
    return hNorm * canvasHeight / (wNorm * canvasWidth);
  }
  return normalizeAspectYx(sec.scale_aspect_yx);
}
function fmtMeasure(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "\u2014";
  return n.toFixed(digits);
}
function pathLengthM(pts, sec, mpu, closed) {
  if (pts.length < 2) return 0;
  const local = pts.map((p) => canvasPtToSectionLocal(p, sec));
  return Math.round(scaledPathLength(local, mpu, sectionScaleAspect(sec), closed) * 100) / 100;
}
function pathAreaM2(pts, sec, mpu) {
  if (pts.length < 3) return 0;
  const local = pts.map((p) => canvasPtToSectionLocal(p, sec));
  return Math.round(scaledAreaM2(shoelaceArea(local), mpu, sectionScaleAspect(sec)) * 100) / 100;
}
function measureDisplayPoints() {
  const pts = measure.points.slice();
  if (measure.cursor && !measure.closed && measure.tool !== "off") {
    if (measure.tool === "length" && pts.length === 1) pts.push(measure.cursor);
    if (measure.tool === "polyline" && pts.length >= 1) pts.push(measure.cursor);
  }
  return pts;
}
function updateMeasureReadouts() {
  const mpu = activeScaleMpu();
  const sel = selectedRegion();
  if (!mpu || !sel) {
    toolLengthMmEl.value = "\u2014";
    toolCircMmEl.value = "\u2014";
    toolAreaMm2El.value = "\u2014";
    return;
  }
  const display = measureDisplayPoints();
  if (measure.tool === "length") {
    const len = display.length >= 2 ? pathLengthM(display.slice(0, 2), sel, mpu, false) : null;
    toolLengthMmEl.value = fmtMeasure(len, 2);
    toolCircMmEl.value = "\u2014";
    toolAreaMm2El.value = "\u2014";
    return;
  }
  if (measure.tool === "polyline") {
    toolLengthMmEl.value = "\u2014";
    const openPts = measure.closed ? measure.points : display;
    const circ = openPts.length >= 2 ? pathLengthM(openPts, sel, mpu, measure.closed) : null;
    toolCircMmEl.value = fmtMeasure(circ, 2);
    if (measure.closed && measure.points.length >= 3) {
      toolAreaMm2El.value = fmtMeasure(pathAreaM2(measure.points, sel, mpu), 2);
    } else {
      toolAreaMm2El.value = "\u2014";
    }
    return;
  }
  toolLengthMmEl.value = "\u2014";
  toolCircMmEl.value = "\u2014";
  toolAreaMm2El.value = "\u2014";
}
function updateToolHint() {
  const mpu = activeScaleMpu();
  if (!mpu) {
    toolHintEl.textContent = "Selecteer een geschaalde sectie (plattegrond, gevel, \u2026), kies daarna een meettool.";
    return;
  }
  if (measure.tool === "length") {
    toolHintEl.textContent = measure.points.length < 2 ? "Click two points to measure length (live while moving)." : "Length ready. Clear measure or click again to start over.";
    return;
  }
  if (measure.tool === "polyline") {
    if (measure.closed) {
      toolHintEl.textContent = "Polyline closed \u2014 circumference and area shown. Clear to redraw.";
    } else if (measure.points.length === 0) {
      toolHintEl.textContent = "Click to add vertices. Double-click or click near the start to close.";
    } else {
      toolHintEl.textContent = `${measure.points.length} point(s). Double-click / click start to close for area.`;
    }
    return;
  }
  toolHintEl.textContent = "Choose Length or Polyline from the Tools menu.";
}
function syncToolSelectUi(tool) {
  if (toolSelectEl) toolSelectEl.value = tool;
  if (toolSelectSidebarEl) toolSelectSidebarEl.value = tool;
  document.querySelectorAll(".tool-mode-btn").forEach((btn) => {
    const t = btn.dataset.tool || "off";
    btn.classList.toggle("active", t === tool);
  });
}
function clearMeasure(keepTool = true) {
  measure = {
    tool: keepTool ? measure.tool : "off",
    points: [],
    cursor: null,
    closed: false
  };
  if (!keepTool) syncToolSelectUi("off");
  updateMeasureReadouts();
  updateToolHint();
  drawRegionsOverlay();
}
function setMeasureTool(tool) {
  if (tool !== "off") {
    if (scalePick) endScalePick();
    if (discoveryCandidates.length > 0) {
      setStatus("Finish or cancel discovery before measuring", "err");
      syncToolSelectUi("off");
      return;
    }
    const mpu = activeScaleMpu();
    if (!mpu) {
      setStatus("Select a scaled section first", "err");
      syncToolSelectUi("off");
      measure.tool = "off";
      updateToolHint();
      return;
    }
    clearPendingMark();
  }
  measure = { tool, points: [], cursor: null, closed: false };
  syncToolSelectUi(tool);
  updateMeasureReadouts();
  updateToolHint();
  drawRegionsOverlay();
  if (tool === "length") setStatus("Measure length: click two points", "busy");
  else if (tool === "polyline") setStatus("Measure polyline: click vertices", "busy");
}
function nearFirstMeasurePoint(pt) {
  if (measure.points.length < 3) return false;
  const a = measure.points[0];
  return Math.hypot(pt.x - a.x, pt.y - a.y) <= 10;
}
function drawMeasureOverlay(ctx) {
  if (measure.tool === "off") return;
  const pts = measureDisplayPoints();
  if (pts.length === 0) return;
  ctx.strokeStyle = "#0277bd";
  ctx.fillStyle = "#0277bd";
  ctx.lineWidth = 2;
  ctx.setLineDash(measure.closed ? [] : [6, 4]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (measure.closed && measure.points.length >= 3) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  if (measure.closed && measure.points.length >= 3) {
    ctx.fillStyle = "rgba(2,119,189,0.12)";
    ctx.beginPath();
    ctx.moveTo(measure.points[0].x, measure.points[0].y);
    for (let i = 1; i < measure.points.length; i++) ctx.lineTo(measure.points[i].x, measure.points[i].y);
    ctx.closePath();
    ctx.fill();
  }
  for (const p of measure.points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
async function saveSectionScale(sectionId, mpu, aspectYx) {
  if (!auth?.token) throw new Error("Not logged in");
  let httpErr = "";
  try {
    const res = await fetch("/api/floormap/scale", {
      method: "POST",
      credentials: "include",
      headers: apiAuthHeaders(auth.token, true),
      body: JSON.stringify({
        section_id: sectionId,
        metres_per_norm_unit: mpu,
        scale_ratio: null,
        scale_source: "CALIBRATED",
        scale_aspect_yx: aspectYx
      })
    });
    let body = {};
    try {
      body = await res.json();
    } catch {
    }
    if (res.ok && body.ok) return;
    httpErr = body.error || `Scale save failed (HTTP ${res.status})`;
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      throw new Error(httpErr);
    }
  } catch (err) {
    if (err instanceof Error && /Authorization|engineer access|invalid section|metres_per_norm/i.test(err.message)) {
      throw err;
    }
    if (!httpErr && err instanceof Error) httpErr = err.message;
  }
  await send(
    "exec.request",
    { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
    "exec.completed"
  );
  const ret = await invokeString("API_SaveFloormapScale", [
    auth.token,
    sectionId,
    String(mpu),
    "NULL",
    "CALIBRATED",
    String(aspectYx)
  ]);
  if (ret.startsWith("ERROR")) {
    throw new Error(httpErr ? `${ret} (HTTP: ${httpErr})` : ret);
  }
}
async function finishScalePick() {
  const sel = selectedRegion();
  if (!auth?.token) {
    setStatus("Not logged in \u2014 cannot save scale", "err");
    return;
  }
  if (!sel) {
    setStatus("Select a section first", "err");
    return;
  }
  if (!regionSupportsScale(sel.region_kind)) {
    setStatus("This section type cannot be scaled", "err");
    return;
  }
  if (!scalePick || scalePick.points.length < 2) {
    setStatus("Mark two scale points first", "err");
    return;
  }
  const mm = Number(scaleMmInput.value);
  if (!(mm > 0)) {
    setStatus("Enter a positive distance in mm", "err");
    return;
  }
  const aPage = {
    x: scalePick.points[0].x / canvasWidth,
    y: scalePick.points[0].y / canvasHeight
  };
  const bPage = {
    x: scalePick.points[1].x / canvasWidth,
    y: scalePick.points[1].y / canvasHeight
  };
  const a = pageNormToSectionLocal(aPage.x, aPage.y, sel);
  const b = pageNormToSectionLocal(bPage.x, bPage.y, sel);
  const aspect = sectionScaleAspect(sel);
  const metres = mm / 1e3;
  const mpu = metresPerNormFromCalibration(metres, a, b, aspect);
  if (!(mpu > 0) || !Number.isFinite(mpu)) {
    setStatus("Scale points too close \u2014 pick again", "err");
    scalePick = { points: [] };
    updateScaleUi();
    drawRegionsOverlay();
    return;
  }
  setStatus("Saving scale\u2026", "busy");
  try {
    await saveSectionScale(sel.id, mpu, aspect);
    sel.metres_per_norm_unit = mpu;
    sel.scale_aspect_yx = aspect;
    sel.scale_source = "CALIBRATED";
    sel.scale_ratio = null;
    endScalePick(`Scale saved: marked line = ${mm} mm`);
    renderRegionList();
    setMeasureTool("length");
    document.getElementById("engineer-tools-bar")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
    document.getElementById("engineer-tools-fieldset")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
    setStatus(`Scale saved (${mm} mm). Length tool ready \u2014 click two points.`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    updateScaleUi();
  }
}
function regionKindLabel(kind) {
  switch (kind) {
    case "FACADE":
      return "Gevel";
    case "SECTION":
      return "Building section";
    case "FLOORMAP":
      return "Floormap";
    case "CROSS_SECTION":
      return "Cross-section";
    case "OTHER":
      return "Other";
    default:
      return kind;
  }
}
function regionKindColor(kind) {
  switch (kind) {
    case "FACADE":
      return "#00695c";
    case "SECTION":
      return "#1565c0";
    case "FLOORMAP":
      return "#6a1b9a";
    case "CROSS_SECTION":
      return "#e65100";
    default:
      return "#6d4c41";
  }
}
function updateRegionCountBadge() {
  regionCountBadgeEl.textContent = String(savedRegionCount);
}
function syncRegionCountFromProject() {
  savedRegionCount = regionsForActiveDoc().length;
  updateRegionCountBadge();
  regionClearAllBtn.disabled = savedRegionCount === 0;
}
function setPageDisplay(page) {
  regionPageInput.value = String(page);
  regionPageDisplayEl.textContent = String(page);
}
function setPendingMarkNorm(mark) {
  pendingMarkNorm = mark;
  const has = Boolean(mark);
  regionSaveBtn.disabled = !has;
  regionClearBtn.disabled = !has;
  regionPendingHintEl.textContent = has ? "Mark ready \u2014 click Save marked section to store it." : "Drag a rectangle on the PDF, then save \u2014 or auto-discover.";
  drawRegionsOverlay();
}
function clearPendingMark() {
  setPendingMarkNorm(null);
}
function updateZoomLabel() {
  zoomLabelEl.textContent = `${Math.round(pdfZoom * 100)}%`;
}
async function setPdfZoom(next, opts) {
  const clamped = Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, next));
  if (Math.abs(clamped - pdfZoom) < 1e-3 && !opts?.fitScroll) {
    updateZoomLabel();
    return;
  }
  pdfZoom = clamped;
  updateZoomLabel();
  if (pdfDoc) await renderPdfPage();
}
async function zoomToFitWidth() {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(pdfPageNum);
  const base = page.getViewport({ scale: 1 });
  const avail = Math.max(200, pdfScrollEl.clientWidth - 16);
  await setPdfZoom(avail / base.width, { fitScroll: true });
}
function renderRegionList() {
  regionListEl.innerHTML = "";
  const all = regionsForActiveDoc();
  const regions = filteredRegionsForActiveDoc();
  const kindFilter = currentRegionKindFilter();
  syncRegionCountFromProject();
  regionCountBadgeEl.textContent = kindFilter ? `${regions.length}/${all.length}` : String(all.length);
  if (regions.length === 0) {
    const li = document.createElement("li");
    li.className = "hint";
    li.textContent = kindFilter ? `No ${regionKindLabel(kindFilter).toLowerCase()} sections for this drawing.` : "No sections saved for this drawing.";
    regionListEl.appendChild(li);
    updateScaleUi();
    return;
  }
  for (const r of regions) {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    if (r.id === selectedRegionId) li.classList.add("selected");
    const info = document.createElement("button");
    info.type = "button";
    info.className = "drawing-list-select";
    const scaleNote = regionSupportsScale(r.region_kind) && r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0 ? " \xB7 scaled" : "";
    info.textContent = `p${r.page_index + 1} \xB7 ${regionKindLabel(r.region_kind)} \xB7 ${r.label}${scaleNote}`;
    info.addEventListener("click", () => {
      selectedRegionId = r.id;
      if (r.page_index !== pdfPageNum - 1 && pdfDoc) {
        pdfPageNum = r.page_index + 1;
        void renderPdfPage().then(() => {
          renderRegionList();
          updateScaleUi();
        });
        return;
      }
      renderRegionList();
      updateScaleUi();
      updateMeasureReadouts();
      updateToolHint();
      drawRegionsOverlay();
    });
    li.appendChild(info);
    const actions = document.createElement("span");
    actions.className = "drawing-list-actions";
    if (regionSupportsScale(r.region_kind) && activeProject) {
      const analyze = document.createElement("a");
      analyze.className = "secondary-link";
      analyze.href = `/floormap.html?building_id=${encodeURIComponent(activeProject.building_id)}&section_id=${encodeURIComponent(r.id)}`;
      analyze.textContent = r.region_kind === "FLOORMAP" ? "Analyze rooms" : "Analyze components";
      actions.appendChild(analyze);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      void deleteRegion(r.id);
    });
    actions.appendChild(btn);
    li.appendChild(actions);
    regionListEl.appendChild(li);
  }
  updateScaleUi();
  updateMeasureReadouts();
  updateToolHint();
  updateAnalyzePanel();
}
async function loadActiveDocument() {
  if (!auth?.token || !activeDocumentId || !activeProject) return;
  const doc = activeProject.documents.find((d) => d.id === activeDocumentId);
  if (!doc) return;
  pdfDoc = null;
  pdfPageNum = 1;
  pdfTotalPages = 0;
  if (discoveryCandidates.length > 0) endDiscoveryReview("Discovery cancelled (drawing changed)");
  endScalePick();
  selectedRegionId = null;
  clearPendingMark();
  clearOverlay();
  if (doc.file_ext.toLowerCase() !== "pdf") {
    docHintEl.textContent = `${doc.filename} is DWG \u2014 preview not available; use external CAD tools.`;
    const ctx = pdfCanvas.getContext("2d");
    if (ctx) {
      pdfCanvas.width = 640;
      pdfCanvas.height = 120;
      canvasWidth = 640;
      canvasHeight = 120;
      overlayCanvas.width = canvasWidth;
      overlayCanvas.height = canvasHeight;
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = "#333";
      ctx.font = "16px sans-serif";
      ctx.fillText("DWG preview not supported in browser", 24, 60);
    }
    pageLabelEl.textContent = "DWG";
    setPageDisplay(1);
    return;
  }
  docHintEl.textContent = "Drag a rectangle to mark a section, or click Discover sections.";
  const res = await fetch(`/api/drawings/download?document_id=${encodeURIComponent(activeDocumentId)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  if (!res.ok) {
    docHintEl.textContent = `Failed to load PDF (HTTP ${res.status})`;
    return;
  }
  const buf = await res.arrayBuffer();
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) {
    docHintEl.textContent = "PDF.js not loaded";
    return;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
  pdfTotalPages = pdfDoc.numPages;
  regionPageInput.value = String(pdfPageNum);
  await renderPdfPage();
  drawRegionsOverlay();
}
async function renderPdfPage() {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(pdfPageNum);
  const rotation = typeof page.rotate === "number" ? page.rotate : 0;
  const viewport = page.getViewport({ scale: pdfZoom, rotation });
  canvasWidth = Math.floor(viewport.width);
  canvasHeight = Math.floor(viewport.height);
  pdfCanvas.width = canvasWidth;
  pdfCanvas.height = canvasHeight;
  overlayCanvas.width = canvasWidth;
  overlayCanvas.height = canvasHeight;
  const ctx = pdfCanvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  await page.render({ canvasContext: ctx, viewport }).promise;
  pageLabelEl.textContent = `Page ${pdfPageNum} / ${pdfTotalPages}`;
  setPageDisplay(pdfPageNum);
  updateZoomLabel();
  drawRegionsOverlay();
}
function clearOverlay() {
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}
function drawBox(ctx, box, style) {
  const x = box.x_min * canvasWidth;
  const y = box.y_min * canvasHeight;
  const w = (box.x_max - box.x_min) * canvasWidth;
  const h = (box.y_max - box.y_min) * canvasHeight;
  if (style.fill) {
    ctx.fillStyle = style.fill;
    ctx.fillRect(x, y, w, h);
  }
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = 2;
  ctx.setLineDash(style.dash || []);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
  if (style.label) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.font = "12px sans-serif";
    ctx.fillText(style.label, x + 4, y + 14);
  }
}
function drawRegionsOverlay() {
  clearOverlay();
  const ctx = overlayCanvas.getContext("2d");
  if (!ctx || canvasWidth === 0) return;
  const pageIdx = pdfPageNum - 1;
  for (const r of filteredRegionsForActiveDoc()) {
    if (r.page_index !== pageIdx) continue;
    const selected = r.id === selectedRegionId;
    drawBox(ctx, r, {
      stroke: selected ? "#c62828" : regionKindColor(r.region_kind),
      fill: selected ? "rgba(198,40,40,0.08)" : void 0,
      label: r.label
    });
  }
  if (discoveryCandidates.length > 0 && discoveryPageIndex === pageIdx) {
    discoveryCandidates.forEach((box, i) => {
      if (i === discoveryIndex) return;
      drawBox(ctx, box, {
        stroke: "#9e9e9e",
        dash: [4, 4],
        fill: "rgba(158,158,158,0.08)"
      });
    });
    const current = discoveryCandidates[discoveryIndex];
    if (current) {
      drawBox(ctx, current, {
        stroke: "#c62828",
        dash: [8, 4],
        fill: "rgba(198,40,40,0.12)",
        label: `Candidate ${discoveryIndex + 1}`
      });
      drawDiscoveryHandles(ctx, current);
    }
  }
  if (dragStart && dragCurrent) {
    const box = {
      x_min: Math.min(dragStart.x, dragCurrent.x) / canvasWidth,
      y_min: Math.min(dragStart.y, dragCurrent.y) / canvasHeight,
      x_max: Math.max(dragStart.x, dragCurrent.x) / canvasWidth,
      y_max: Math.max(dragStart.y, dragCurrent.y) / canvasHeight
    };
    drawBox(ctx, box, { stroke: "#c62828", dash: [6, 4] });
  } else if (pendingMarkNorm && pendingMarkNorm.pageIndex === pageIdx) {
    drawBox(ctx, pendingMarkNorm, { stroke: "#c62828", dash: [6, 4], label: "Pending" });
  }
  if (scalePick?.points.length) {
    ctx.fillStyle = "#1565c0";
    ctx.strokeStyle = "#1565c0";
    ctx.lineWidth = 2;
    for (let i = 0; i < scalePick.points.length; i++) {
      const p = scalePick.points[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (i === 1) {
        const a = scalePick.points[0];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }
  }
  drawMeasureOverlay(ctx);
}
function overlayPoint(evt) {
  const rect = overlayCanvas.getBoundingClientRect();
  const scaleX = overlayCanvas.width / rect.width;
  const scaleY = overlayCanvas.height / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY
  };
}
async function savePendingRegion() {
  if (!auth?.token || !activeDocumentId || !pendingMarkNorm || canvasWidth === 0) return;
  const { x_min: xMin, y_min: yMin, x_max: xMax, y_max: yMax, pageIndex } = pendingMarkNorm;
  const label = regionLabelInput.value.trim() || `Section ${savedRegionCount + 1}`;
  const kind = regionKindSelect.value;
  if (xMax - xMin < 0.01 || yMax - yMin < 0.01) {
    setStatus("Mark too small \u2014 drag a larger rectangle", "err");
    return;
  }
  regionSaveBtn.disabled = true;
  setStatus("Saving section\u2026", "busy");
  const ret = await invokeString("API_SaveDrawingRegion", [
    auth.token,
    activeDocumentId,
    String(pageIndex),
    label,
    kind,
    String(xMin),
    String(yMin),
    String(xMax),
    String(yMax),
    ""
  ]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    regionSaveBtn.disabled = false;
    return;
  }
  const parsed = JSON.parse(ret);
  if (activeProject) {
    activeProject.regions.push({
      id: parsed.region_id,
      document_id: activeDocumentId,
      page_index: pageIndex,
      label,
      region_kind: kind,
      x_min: xMin,
      y_min: yMin,
      x_max: xMax,
      y_max: yMax
    });
  }
  savedRegionCount += 1;
  updateRegionCountBadge();
  clearPendingMark();
  renderRegionList();
  drawRegionsOverlay();
  setStatus(`Section saved (${savedRegionCount} total for this drawing)`, "ok");
}
async function deleteRegion(regionId) {
  if (!auth?.token || !activeProject) return;
  if (!regionId) {
    setStatus("Cannot remove section \u2014 missing id", "err");
    return;
  }
  if (!window.confirm("Remove this section?")) return;
  setStatus("Removing section\u2026", "busy");
  const res = await fetch(`/api/drawings/sections?section_id=${encodeURIComponent(regionId)}`, {
    method: "DELETE",
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  let parsed = {};
  try {
    parsed = await res.json();
  } catch {
  }
  if (!res.ok || !parsed.ok) {
    setStatus(parsed.error || `Failed to remove section (HTTP ${res.status})`, "err");
    return;
  }
  activeProject.regions = activeProject.regions.filter((r) => r.id !== regionId);
  if (selectedRegionId === regionId) {
    selectedRegionId = null;
    endScalePick();
  }
  renderRegionList();
  drawRegionsOverlay();
  setStatus("Section removed", "ok");
}
async function clearAllSections() {
  if (!auth?.token || !activeProject || !activeDocumentId) return;
  const n = regionsForActiveDoc().length;
  if (n < 1) return;
  if (!window.confirm(`Remove all ${n} section(s) from this drawing?`)) return;
  setStatus("Removing all sections\u2026", "busy");
  const res = await fetch(`/api/drawings/sections?document_id=${encodeURIComponent(activeDocumentId)}`, {
    method: "DELETE",
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  let parsed = {};
  try {
    parsed = await res.json();
  } catch {
  }
  if (!res.ok || !parsed.ok) {
    setStatus(parsed.error || `Failed to clear sections (HTTP ${res.status})`, "err");
    return;
  }
  activeProject.regions = activeProject.regions.filter((r) => r.document_id !== activeDocumentId);
  selectedRegionId = null;
  endScalePick();
  clearPendingMark();
  renderRegionList();
  drawRegionsOverlay();
  setStatus(`Removed ${parsed.deleted_count ?? n} section(s)`, "ok");
}
function discoverRectangularFrames(source) {
  const w = source.width;
  const h = source.height;
  if (w < 40 || h < 40) return [];
  const scale = Math.min(1, 320 / Math.max(w, h));
  const sw = Math.max(32, Math.floor(w * scale));
  const sh = Math.max(32, Math.floor(h * scale));
  const off = document.createElement("canvas");
  off.width = sw;
  off.height = sh;
  const octx = off.getContext("2d", { willReadFrequently: true });
  if (!octx) return [];
  octx.drawImage(source, 0, 0, sw, sh);
  const img = octx.getImageData(0, 0, sw, sh);
  const px = img.data;
  const dark = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      dark[y * sw + x] = lum < 145 ? 1 : 0;
    }
  }
  const edge = new Uint8Array(sw * sh);
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      if (!dark[i]) continue;
      if (!dark[i - 1] || !dark[i + 1] || !dark[i - sw] || !dark[i + sw]) edge[i] = 1;
    }
  }
  const rowScore = new Float64Array(sh);
  for (let y = 0; y < sh; y++) {
    let c = 0;
    for (let x = 0; x < sw; x++) if (edge[y * sw + x]) c++;
    rowScore[y] = c / sw;
  }
  const colScore = new Float64Array(sw);
  for (let x = 0; x < sw; x++) {
    let c = 0;
    for (let y = 0; y < sh; y++) if (edge[y * sw + x]) c++;
    colScore[x] = c / sh;
  }
  function peaks(scores, minGap, thresh) {
    const out = [];
    for (let i = 1; i < scores.length - 1; i++) {
      if (scores[i] >= thresh && scores[i] >= scores[i - 1] && scores[i] >= scores[i + 1]) {
        if (out.length === 0 || i - out[out.length - 1] >= minGap) out.push(i);
        else if (scores[i] > scores[out[out.length - 1]]) out[out.length - 1] = i;
      }
    }
    return out;
  }
  const hLines = peaks(rowScore, Math.max(4, Math.floor(sh * 0.025)), 0.1);
  const vLines = peaks(colScore, Math.max(4, Math.floor(sw * 0.025)), 0.1);
  function borderScore(x1, y1, x2, y2) {
    const bw = x2 - x1;
    const bh = y2 - y1;
    if (bw < sw * 0.05 || bh < sh * 0.05) return 0;
    if (bw > sw * 0.92 && bh > sh * 0.92) return 0;
    let top = 0;
    let bot = 0;
    let left = 0;
    let right = 0;
    for (let x = x1; x <= x2; x++) {
      if (edge[y1 * sw + x]) top++;
      if (edge[y2 * sw + x]) bot++;
    }
    for (let y = y1; y <= y2; y++) {
      if (edge[y * sw + x1]) left++;
      if (edge[y * sw + x2]) right++;
    }
    const peri = 2 * (bw + bh);
    const hit = top + bot + left + right;
    let interior = 0;
    let samples = 0;
    const step = Math.max(1, Math.floor(Math.min(bw, bh) / 20));
    for (let y = y1 + 2; y < y2 - 2; y += step) {
      for (let x = x1 + 2; x < x2 - 2; x += step) {
        samples++;
        if (edge[y * sw + x]) interior++;
      }
    }
    const borderRatio = hit / Math.max(1, peri);
    const interiorRatio = samples ? interior / samples : 1;
    if (borderRatio < 0.32) return 0;
    if (interiorRatio > 0.28) return 0;
    return borderRatio - interiorRatio;
  }
  const cands = [];
  for (let i = 0; i < hLines.length; i++) {
    for (let j = i + 1; j < hLines.length; j++) {
      const y1 = hLines[i];
      const y2 = hLines[j];
      if (y2 - y1 < sh * 0.05) continue;
      for (let a = 0; a < vLines.length; a++) {
        for (let b = a + 1; b < vLines.length; b++) {
          const x1 = vLines[a];
          const x2 = vLines[b];
          if (x2 - x1 < sw * 0.05) continue;
          const score = borderScore(x1, y1, x2, y2);
          if (score > 0.18) cands.push({ x1, y1, x2, y2, score });
        }
      }
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const kept = [];
  function overlapFrac(a, b) {
    const ix1 = Math.max(a.x1, b.x1);
    const iy1 = Math.max(a.y1, b.y1);
    const ix2 = Math.min(a.x2, b.x2);
    const iy2 = Math.min(a.y2, b.y2);
    if (ix2 <= ix1 || iy2 <= iy1) return 0;
    const inter = (ix2 - ix1) * (iy2 - iy1);
    const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
    return inter / Math.max(1, areaA);
  }
  for (const c of cands) {
    if (kept.some((k) => overlapFrac(c, k) > 0.45 || overlapFrac(k, c) > 0.45)) continue;
    kept.push(c);
    if (kept.length >= 24) break;
  }
  return kept.map((c) => ({
    x_min: c.x1 / sw,
    y_min: c.y1 / sh,
    x_max: c.x2 / sw,
    y_max: c.y2 / sh
  }));
}
async function discoverSections() {
  if (!auth?.token || !activeDocumentId || !pdfDoc || canvasWidth === 0) {
    setStatus("Open a PDF drawing first", "err");
    return;
  }
  setStatus("Discovering rectangular sections\u2026", "busy");
  regionDiscoverBtn.disabled = true;
  try {
    const found = discoverRectangularFrames(pdfCanvas);
    await renderPdfPage();
    if (found.length === 0) {
      setStatus("No rectangular sections found on this page", "err");
      return;
    }
    startDiscoveryReview(found);
    setStatus(`Found ${found.length} candidate(s) \u2014 review each below`, "ok");
  } finally {
    regionDiscoverBtn.disabled = false;
  }
}
function startDiscoveryReview(found) {
  discoveryCandidates = found;
  discoveryIndex = 0;
  discoveryPageIndex = pdfPageNum - 1;
  discoveryPanelEl.classList.remove("hidden");
  document.body.classList.add("discovery-active");
  discoveryKindSelect.value = regionKindSelect.value;
  showCurrentDiscoveryCandidate();
}
function endDiscoveryReview(message) {
  discoveryCandidates = [];
  discoveryIndex = 0;
  discoveryAdjust = null;
  discoveryPanelEl.classList.add("hidden");
  document.body.classList.remove("discovery-active");
  drawRegionsOverlay();
  setStatus(message, "ok");
}
function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
function normalizeBox(box) {
  const minSize = 0.01;
  let { x_min, y_min, x_max, y_max } = box;
  x_min = clamp01(x_min);
  y_min = clamp01(y_min);
  x_max = clamp01(x_max);
  y_max = clamp01(y_max);
  if (x_max - x_min < minSize) {
    const mid = (x_min + x_max) / 2;
    x_min = clamp01(mid - minSize / 2);
    x_max = clamp01(mid + minSize / 2);
  }
  if (y_max - y_min < minSize) {
    const mid = (y_min + y_max) / 2;
    y_min = clamp01(mid - minSize / 2);
    y_max = clamp01(mid + minSize / 2);
  }
  if (x_min > x_max) [x_min, x_max] = [x_max, x_min];
  if (y_min > y_max) [y_min, y_max] = [y_max, y_min];
  return { x_min, y_min, x_max, y_max };
}
function currentDiscoveryBox() {
  if (discoveryIndex < 0 || discoveryIndex >= discoveryCandidates.length) return null;
  return discoveryCandidates[discoveryIndex];
}
function setCurrentDiscoveryBox(box) {
  if (discoveryIndex < 0 || discoveryIndex >= discoveryCandidates.length) return;
  discoveryCandidates[discoveryIndex] = normalizeBox(box);
  drawRegionsOverlay();
}
function adjustCurrentDiscovery(kind, sign, fine) {
  const box = currentDiscoveryBox();
  if (!box) return;
  const step = fine ? 5e-3 : 0.02;
  const next = { ...box };
  if (kind === "nudge-h") {
    const dx = sign * step;
    next.x_min += dx;
    next.x_max += dx;
  } else if (kind === "nudge-v") {
    const dy = sign * step;
    next.y_min += dy;
    next.y_max += dy;
  } else if (kind === "grow-h") {
    next.x_min -= sign * step;
    next.x_max += sign * step;
  } else if (kind === "grow-v") {
    next.y_min -= sign * step;
    next.y_max += sign * step;
  }
  setCurrentDiscoveryBox(next);
}
function drawDiscoveryHandles(ctx, box) {
  const x1 = box.x_min * canvasWidth;
  const y1 = box.y_min * canvasHeight;
  const x2 = box.x_max * canvasWidth;
  const y2 = box.y_max * canvasHeight;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const pts = [
    [x1, y1],
    [mx, y1],
    [x2, y1],
    [x2, my],
    [x2, y2],
    [mx, y2],
    [x1, y2],
    [x1, my]
  ];
  ctx.fillStyle = "#c62828";
  for (const [x, y] of pts) {
    ctx.fillRect(x - 4, y - 4, 8, 8);
  }
}
function hitTestDiscoveryHandle(px, py, box) {
  const x1 = box.x_min * canvasWidth;
  const y1 = box.y_min * canvasHeight;
  const x2 = box.x_max * canvasWidth;
  const y2 = box.y_max * canvasHeight;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const tol = 10;
  const near = (ax, ay) => Math.hypot(px - ax, py - ay) <= tol;
  if (near(x1, y1)) return "nw";
  if (near(x2, y1)) return "ne";
  if (near(x1, y2)) return "sw";
  if (near(x2, y2)) return "se";
  if (near(mx, y1)) return "n";
  if (near(mx, y2)) return "s";
  if (near(x1, my)) return "w";
  if (near(x2, my)) return "e";
  if (px >= x1 && px <= x2 && py >= y1 && py <= y2) return "move";
  return null;
}
function applyDiscoveryDrag(px, py) {
  if (!discoveryAdjust) return;
  const { handle, startX, startY, orig } = discoveryAdjust;
  const dx = (px - startX) / canvasWidth;
  const dy = (py - startY) / canvasHeight;
  const next = { ...orig };
  if (handle === "move") {
    next.x_min = orig.x_min + dx;
    next.x_max = orig.x_max + dx;
    next.y_min = orig.y_min + dy;
    next.y_max = orig.y_max + dy;
  } else {
    if (handle.includes("n")) next.y_min = orig.y_min + dy;
    if (handle.includes("s")) next.y_max = orig.y_max + dy;
    if (handle.includes("w")) next.x_min = orig.x_min + dx;
    if (handle.includes("e")) next.x_max = orig.x_max + dx;
  }
  setCurrentDiscoveryBox(next);
}
function showCurrentDiscoveryCandidate() {
  if (discoveryCandidates.length === 0) {
    endDiscoveryReview("Discovery finished");
    return;
  }
  if (discoveryIndex >= discoveryCandidates.length) {
    endDiscoveryReview(
      `Discovery finished \u2014 reviewed ${discoveryCandidates.length} candidate(s)`
    );
    return;
  }
  const n = discoveryCandidates.length;
  const i = discoveryIndex + 1;
  discoveryProgressEl.textContent = `(${i} of ${n})`;
  discoveryHintEl.textContent = "Drag handles on the drawing, or use H/V. Controls stay here \u2014 only the PDF scrolls.";
  discoveryLabelInput.value = `Section ${savedRegionCount + 1}`;
  discoveryAdjust = null;
  drawRegionsOverlay();
  const box = discoveryCandidates[discoveryIndex];
  if (box && canvasWidth > 0 && canvasHeight > 0) {
    const midY = (box.y_min + box.y_max) / 2 * canvasHeight - pdfScrollEl.clientHeight / 2;
    const midX = (box.x_min + box.x_max) / 2 * canvasWidth - pdfScrollEl.clientWidth / 2;
    pdfScrollEl.scrollTo({
      top: Math.max(0, midY),
      left: Math.max(0, midX),
      behavior: "auto"
    });
  }
}
async function acceptDiscoveryCandidate() {
  if (!auth?.token || !activeDocumentId) return;
  if (discoveryIndex >= discoveryCandidates.length) return;
  const box = discoveryCandidates[discoveryIndex];
  const label = discoveryLabelInput.value.trim() || `Section ${savedRegionCount + 1}`;
  const kind = discoveryKindSelect.value;
  discoveryAcceptBtn.disabled = true;
  setStatus("Saving section\u2026", "busy");
  try {
    const ret = await invokeString("API_SaveDrawingRegion", [
      auth.token,
      activeDocumentId,
      String(discoveryPageIndex),
      label,
      kind,
      String(box.x_min),
      String(box.y_min),
      String(box.x_max),
      String(box.y_max),
      ""
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const parsed = JSON.parse(ret);
    if (activeProject) {
      activeProject.regions.push({
        id: parsed.region_id,
        document_id: activeDocumentId,
        page_index: discoveryPageIndex,
        label,
        region_kind: kind,
        x_min: box.x_min,
        y_min: box.y_min,
        x_max: box.x_max,
        y_max: box.y_max
      });
    }
    savedRegionCount += 1;
    updateRegionCountBadge();
    renderRegionList();
    discoveryIndex += 1;
    showCurrentDiscoveryCandidate();
    if (discoveryCandidates.length > 0 && discoveryIndex < discoveryCandidates.length) {
      setStatus(`Section saved \u2014 next candidate (${discoveryIndex + 1} of ${discoveryCandidates.length})`, "ok");
    }
  } finally {
    discoveryAcceptBtn.disabled = false;
  }
}
function skipDiscoveryCandidate() {
  discoveryIndex += 1;
  showCurrentDiscoveryCandidate();
  if (discoveryCandidates.length > 0 && discoveryIndex < discoveryCandidates.length) {
    setStatus(`Skipped \u2014 candidate ${discoveryIndex + 1} of ${discoveryCandidates.length}`, "ok");
  }
}
async function submitReview(evt) {
  evt.preventDefault();
  if (!auth?.token || !activeProject) return;
  if (discoveryCandidates.length > 0 && discoveryIndex < discoveryCandidates.length) {
    const left = discoveryCandidates.length - discoveryIndex;
    if (!window.confirm(
      `${left} discovered section(s) are not yet accepted. Continue Save review with only the already saved sections? (remaining candidates will be discarded)`
    )) {
      return;
    }
    endDiscoveryReview("Discovery closed before review save");
  }
  if (pendingMarkNorm) {
    if (!window.confirm(
      "There is an unsaved marked section. Save it first, or click OK to discard it and continue with Save review."
    )) {
      return;
    }
    clearPendingMark();
  }
  if ((activeProject.regions?.length ?? 0) < 1) {
    setStatus("Save at least one identified section before saving the review", "err");
    return;
  }
  setStatus("Saving review and committing section objects\u2026", "busy");
  const ret = await invokeString("API_ReviewDrawings", [
    auth.token,
    activeProject.building_id,
    reviewSufficientEl.checked ? "true" : "false",
    reviewLegibleEl.checked ? "true" : "false",
    reviewNotesEl.value.trim()
  ]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  const parsed = JSON.parse(ret);
  activeProject.project_status = parsed.project_status;
  projectMetaEl.textContent = `${activeProject.customer_name} \xB7 ${statusLabel(activeProject.project_status)} \xB7 ref ${activeProject.external_ref || "\u2014"}`;
  const n = Number(parsed.section_count ?? parsed.sections?.length ?? 0);
  setStatus(
    parsed.project_status === "PROJECT_UNDERWAY" ? `Review saved \u2014 ${n} section object(s) committed for analysis \xB7 project underway` : `Review saved \u2014 ${n} section object(s) committed \xB7 awaiting sufficient drawings`,
    "ok"
  );
  void loadQueue();
}
function connect() {
  setConnLed(false);
  setStatus("Connecting\u2026", "busy");
  ws = new WebSocket(BPP_WS);
  ws.onopen = async () => {
    setConnLed(true);
    setStatus("Connected", "ok");
    await send("session.open", {}, "session.opened");
    try {
      await loadSharedApi();
      setStatus(`Connected \xB7 session ${sessionId ?? "?"} \xB7 Postgres ready`, "ok");
      const stored = loadStoredAuth();
      if (stored) {
        auth = stored;
        const valid = await invokeString("API_ValidateSession", [stored.token]);
        if (valid.startsWith("ERROR")) throw new Error(valid);
        showPanel(stored);
        await loadQueue();
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
      showLogin();
    }
  };
  ws.onmessage = (ev) => onMessage(String(ev.data));
  ws.onclose = () => {
    setConnLed(false);
    setStatus("Disconnected \u2014 reconnecting\u2026", "err");
    setTimeout(connect, 1500);
  };
  ws.onerror = () => ws?.close();
}
loginForm.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  const fd = new FormData(loginForm);
  const username = String(fd.get("username") || "").trim();
  const password = String(fd.get("password") || "");
  loginBtn.disabled = true;
  try {
    setStatus("Signing in\u2026", "busy");
    await bootstrapAndLogin(username, password);
    await loadQueue();
    setStatus("Signed in", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Login failed", "err");
    showLogin();
  } finally {
    loginBtn.disabled = false;
  }
});
logoutBtn.addEventListener("click", () => {
  if (auth?.token) void invokeString("API_Logout", [auth.token]).catch(() => {
  });
  showLogin();
});
refreshBtn.addEventListener("click", () => {
  void loadQueue();
});
docSelectEl.addEventListener("change", () => {
  activeDocumentId = docSelectEl.value || null;
  void loadActiveDocument();
  renderRegionList();
});
pagePrevBtn.addEventListener("click", () => {
  if (!pdfDoc || pdfPageNum <= 1) return;
  pdfPageNum -= 1;
  void renderPdfPage();
});
pageNextBtn.addEventListener("click", () => {
  if (!pdfDoc || pdfPageNum >= pdfTotalPages) return;
  pdfPageNum += 1;
  void renderPdfPage();
});
zoomOutBtn.addEventListener("click", () => {
  void setPdfZoom(pdfZoom - PDF_ZOOM_STEP);
});
zoomInBtn.addEventListener("click", () => {
  void setPdfZoom(pdfZoom + PDF_ZOOM_STEP);
});
zoomBtn.addEventListener("click", () => {
  const next = pdfZoom < 2 ? 2.5 : pdfZoom < 3.5 ? pdfZoom + 0.75 : PDF_ZOOM_MIN;
  void setPdfZoom(next);
});
zoomFitBtn.addEventListener("click", () => {
  void zoomToFitWidth();
});
regionSaveBtn.addEventListener("click", () => {
  void savePendingRegion();
});
regionClearBtn.addEventListener("click", () => {
  clearPendingMark();
});
regionDiscoverBtn.addEventListener("click", () => {
  void discoverSections();
});
regionClearAllBtn.addEventListener("click", () => {
  void clearAllSections();
});
function applyRegionTypeFilter() {
  if (selectedRegionId) {
    const stillVisible = filteredRegionsForActiveDoc().some((r) => r.id === selectedRegionId);
    if (!stillVisible) {
      selectedRegionId = null;
      endScalePick();
    }
  }
  renderRegionList();
  drawRegionsOverlay();
}
regionFilterKindEl?.addEventListener("change", () => {
  applyRegionTypeFilter();
});
regionFilterKindEl?.addEventListener("input", () => {
  applyRegionTypeFilter();
});
scaleBtn.addEventListener("click", () => {
  startScalePick();
});
analyzeOpenBtn?.addEventListener("click", () => openAnalysisWorkspace());
analyzeDiscoverBtn?.addEventListener("click", () => openAnalysisWorkspace());
analyzeDrawBtn?.addEventListener("click", () => openAnalysisWorkspace());
scaleApplyBtn.addEventListener("click", () => {
  void finishScalePick();
});
scaleRepickBtn.addEventListener("click", () => {
  repickScalePoints();
});
scaleMmInput.addEventListener("keydown", (evt) => {
  if (evt.key === "Enter") {
    evt.preventDefault();
    void finishScalePick();
  }
});
toolSelectEl?.addEventListener("change", () => {
  setMeasureTool(toolSelectEl.value || "off");
});
toolSelectSidebarEl?.addEventListener("change", () => {
  setMeasureTool(toolSelectSidebarEl.value || "off");
});
document.querySelectorAll(".tool-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setMeasureTool(btn.dataset.tool || "off");
  });
});
toolClearBtn?.addEventListener("click", () => {
  clearMeasure(true);
  setStatus("Measure cleared", "ok");
});
toolClearSidebarBtn?.addEventListener("click", () => {
  clearMeasure(true);
  setStatus("Measure cleared", "ok");
});
(() => {
  const panel = document.getElementById("engineer-tools-bar");
  if (!panel) return;
  const key = "app-gevelwering-tools-collapsed";
  panel.open = localStorage.getItem(key) !== "1";
  panel.addEventListener("toggle", () => {
    localStorage.setItem(key, panel.open ? "0" : "1");
  });
})();
window.addEventListener("keydown", (evt) => {
  if (evt.key === "Escape" && measure.tool !== "off") {
    clearMeasure(true);
    setStatus("Measure cleared", "ok");
  }
});
discoveryAcceptBtn.addEventListener("click", () => {
  void acceptDiscoveryCandidate();
});
discoverySkipBtn.addEventListener("click", () => {
  skipDiscoveryCandidate();
});
discoveryCancelBtn.addEventListener("click", () => {
  endDiscoveryReview("Discovery cancelled");
});
function onDiscAdjustClick(kind, sign) {
  return (evt) => {
    adjustCurrentDiscovery(kind, sign, evt.shiftKey);
  };
}
discNudgeLeftBtn.addEventListener("click", onDiscAdjustClick("nudge-h", -1));
discNudgeRightBtn.addEventListener("click", onDiscAdjustClick("nudge-h", 1));
discNudgeUpBtn.addEventListener("click", onDiscAdjustClick("nudge-v", -1));
discNudgeDownBtn.addEventListener("click", onDiscAdjustClick("nudge-v", 1));
discShrinkHBtn.addEventListener("click", onDiscAdjustClick("grow-h", -1));
discGrowHBtn.addEventListener("click", onDiscAdjustClick("grow-h", 1));
discShrinkVBtn.addEventListener("click", onDiscAdjustClick("grow-v", -1));
discGrowVBtn.addEventListener("click", onDiscAdjustClick("grow-v", 1));
overlayCanvas.addEventListener("mousedown", (evt) => {
  if (!activeDocumentId || canvasWidth === 0) return;
  const pt = overlayPoint(evt);
  if (scalePick) {
    if (scalePick.points.length >= 2) return;
    scalePick.points.push(pt);
    drawRegionsOverlay();
    updateScaleUi();
    if (scalePick.points.length === 1) {
      setStatus("Click second scale point", "busy");
    } else if (scalePick.points.length >= 2) {
      setStatus("Enter distance in mm, then Apply", "ok");
    }
    return;
  }
  if (measure.tool !== "off") {
    if (!activeScaleMpu()) {
      setStatus("Select a scaled section first", "err");
      return;
    }
    if (measure.tool === "length") {
      if (measure.points.length >= 2) {
        measure.points = [pt];
        measure.closed = false;
      } else {
        measure.points.push(pt);
      }
      updateMeasureReadouts();
      updateToolHint();
      drawRegionsOverlay();
      return;
    }
    if (measure.tool === "polyline") {
      if (measure.closed) {
        measure.points = [pt];
        measure.closed = false;
      } else if (nearFirstMeasurePoint(pt) || evt.detail === 2 && measure.points.length >= 3) {
        measure.closed = true;
        measure.cursor = null;
      } else {
        measure.points.push(pt);
      }
      updateMeasureReadouts();
      updateToolHint();
      drawRegionsOverlay();
      return;
    }
  }
  if (discoveryCandidates.length > 0) {
    const box = currentDiscoveryBox();
    if (!box || discoveryPageIndex !== pdfPageNum - 1) return;
    const handle = hitTestDiscoveryHandle(pt.x, pt.y, box);
    if (!handle) return;
    discoveryAdjust = {
      handle,
      startX: pt.x,
      startY: pt.y,
      orig: { ...box }
    };
    overlayCanvas.style.cursor = handle === "move" ? "move" : "nwse-resize";
    return;
  }
  dragStart = pt;
  dragCurrent = dragStart;
});
overlayCanvas.addEventListener("mousemove", (evt) => {
  const pt = overlayPoint(evt);
  if (measure.tool !== "off" && !measure.closed) {
    measure.cursor = pt;
    updateMeasureReadouts();
    drawRegionsOverlay();
    return;
  }
  if (discoveryAdjust) {
    applyDiscoveryDrag(pt.x, pt.y);
    return;
  }
  if (discoveryCandidates.length > 0) {
    const box = currentDiscoveryBox();
    if (box && discoveryPageIndex === pdfPageNum - 1) {
      const handle = hitTestDiscoveryHandle(pt.x, pt.y, box);
      if (!handle) overlayCanvas.style.cursor = "default";
      else if (handle === "move") overlayCanvas.style.cursor = "move";
      else if (handle === "n" || handle === "s") overlayCanvas.style.cursor = "ns-resize";
      else if (handle === "e" || handle === "w") overlayCanvas.style.cursor = "ew-resize";
      else overlayCanvas.style.cursor = "nwse-resize";
    }
    return;
  }
  if (!dragStart) return;
  dragCurrent = pt;
  drawRegionsOverlay();
});
overlayCanvas.addEventListener("mouseup", (evt) => {
  if (discoveryAdjust) {
    applyDiscoveryDrag(overlayPoint(evt).x, overlayPoint(evt).y);
    discoveryAdjust = null;
    overlayCanvas.style.cursor = "crosshair";
    setStatus("Section box adjusted \u2014 Accept when ready", "ok");
    return;
  }
  if (!dragStart) return;
  const end = overlayPoint(evt);
  const start = dragStart;
  dragStart = null;
  dragCurrent = null;
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  if (w < 4 || h < 4) {
    drawRegionsOverlay();
    return;
  }
  const pageIndex = Math.max(0, pdfPageNum - 1);
  setPendingMarkNorm({
    x_min: Math.min(start.x, end.x) / canvasWidth,
    y_min: Math.min(start.y, end.y) / canvasHeight,
    x_max: Math.max(start.x, end.x) / canvasWidth,
    y_max: Math.max(start.y, end.y) / canvasHeight,
    pageIndex
  });
});
overlayCanvas.addEventListener("mouseleave", () => {
  if (discoveryAdjust) {
    discoveryAdjust = null;
    overlayCanvas.style.cursor = "crosshair";
    drawRegionsOverlay();
    return;
  }
  if (!dragStart) return;
  dragStart = null;
  dragCurrent = null;
  drawRegionsOverlay();
});
reviewForm.addEventListener("submit", (evt) => {
  void submitReview(evt);
});
updateZoomLabel();
initPasswordToggles();
connect();
