var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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

// src/layout-split.ts
var STORAGE_KEY = "app-gevelwering-sidebar-width-px";
var MIN_SIDEBAR_PX = 260;
var MIN_VIEWER_PX = 280;
var DEFAULT_SIDEBAR_PX = 420;
function clampSidebarWidth(layout, widthPx) {
  const rect = layout.getBoundingClientRect();
  const handle = layout.querySelector(".engineer-split-handle");
  const handleW = handle?.offsetWidth ?? 8;
  if (rect.width < MIN_SIDEBAR_PX + MIN_VIEWER_PX + handleW) {
    return Math.min(Math.max(widthPx, MIN_SIDEBAR_PX), 760);
  }
  const max = Math.max(MIN_SIDEBAR_PX, rect.width - MIN_VIEWER_PX - handleW);
  return Math.min(Math.max(widthPx, MIN_SIDEBAR_PX), max);
}
function applySidebarWidth(layout, widthPx) {
  const clamped = clampSidebarWidth(layout, widthPx);
  layout.style.setProperty("--engineer-sidebar-width", `${Math.round(clamped)}px`);
}
function initEngineerLayoutSplit(root = document) {
  const layout = root.querySelector(".engineer-layout");
  const handle = root.querySelector(".engineer-split-handle");
  if (!layout || !handle) return;
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  const initial = Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_SIDEBAR_PX;
  applySidebarWidth(layout, initial);
  const onResize = () => {
    const current = Number.parseFloat(
      getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width")
    );
    if (Number.isFinite(current) && current > 0) applySidebarWidth(layout, current);
  };
  window.addEventListener("resize", onResize);
  let dragging = false;
  let pointerId = null;
  const endDrag = (evt) => {
    if (!dragging) return;
    dragging = false;
    layout.classList.remove("is-resizing");
    document.body.classList.remove("engineer-resizing");
    if (evt && pointerId != null) {
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
      }
    }
    pointerId = null;
    const current = Number.parseFloat(
      getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width")
    );
    if (Number.isFinite(current) && current > 0) {
      localStorage.setItem(STORAGE_KEY, String(Math.round(current)));
    }
  };
  handle.addEventListener("pointerdown", (evt) => {
    if (evt.button !== 0) return;
    if (window.matchMedia("(max-width: 1100px)").matches) return;
    evt.preventDefault();
    dragging = true;
    pointerId = evt.pointerId;
    layout.classList.add("is-resizing");
    document.body.classList.add("engineer-resizing");
    handle.setPointerCapture(evt.pointerId);
  });
  handle.addEventListener("pointermove", (evt) => {
    if (!dragging) return;
    const rect = layout.getBoundingClientRect();
    applySidebarWidth(layout, rect.right - evt.clientX);
  });
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
  handle.addEventListener("lostpointercapture", () => {
    if (dragging) endDrag();
  });
}

// src/app-version.ts
var APP_VERSION = "0.72";
var APP_NAME = "Stilte advies en meten";
var USER_DOCS_HREF = "/handleiding.html";

// src/project-menu.ts
var RECENT_KEY = "app-gevelwering-recent-projects";
var RECENT_MAX = 8;
function parseJsonOk(raw) {
  if (raw.startsWith("ERROR")) throw new Error(raw);
  return JSON.parse(raw);
}
function projectTitle(meta) {
  const label = (meta.label || "").trim();
  const ref = (meta.external_ref || "").trim();
  if (label && ref) return `${label} (${ref})`;
  if (label) return label;
  if (ref) return ref;
  const id = meta.building_id || "";
  return id ? `${id.slice(0, 8)}\u2026` : "Geen project";
}
function loadRecentProjects() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => p?.building_id) : [];
  } catch {
    return [];
  }
}
function rememberRecentProject(entry) {
  const id = entry.building_id.trim();
  if (!id) return;
  const next = {
    building_id: id,
    label: (entry.label || "").trim(),
    external_ref: (entry.external_ref || "").trim() || void 0,
    at: Date.now()
  };
  const rest = loadRecentProjects().filter((p) => p.building_id !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([next, ...rest].slice(0, RECENT_MAX)));
}
function removeRecentProject(buildingId) {
  const id = buildingId.trim();
  if (!id) return;
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(loadRecentProjects().filter((p) => p.building_id !== id))
  );
}
async function cleanupProjectFolder(buildingId, headers) {
  try {
    await fetch("/api/reports/cleanup-project-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ building_id: buildingId })
    });
  } catch {
  }
}
function mountProjectMenu(root, host) {
  root.classList.add("file-menu");
  root.setAttribute("aria-label", "Bestand en Over");
  root.innerHTML = `
    <div class="file-menu-bar">
      <details class="file-menu-details" id="pm-root">
        <summary class="file-menu-summary">Bestand</summary>
        <ul class="file-menu-list" role="menu">
          <li><button type="button" role="menuitem" data-act="open">Openen\u2026</button></li>
          <li class="file-menu-recent-wrap">
            <details class="file-menu-recent">
              <summary>Recent geopend</summary>
              <ul class="file-menu-recent-list" id="pm-recent"></ul>
            </details>
          </li>
          <li><button type="button" role="menuitem" data-act="save">Project opslaan</button></li>
          <li><button type="button" role="menuitem" data-act="rename">Hernoemen\u2026</button></li>
          <li><button type="button" role="menuitem" data-act="delete" class="danger">Verwijderen\u2026</button></li>
        </ul>
      </details>
      <details class="file-menu-details" id="pm-about">
        <summary class="file-menu-summary">Over</summary>
        <ul class="file-menu-list" role="menu">
          <li class="file-menu-about-version" role="menuitem">${APP_NAME}</li>
          <li class="file-menu-about-version" role="menuitem">Versie ${APP_VERSION}</li>
          <li>
            <a class="file-menu-about-link" href="${USER_DOCS_HREF}" role="menuitem">Gebruikershandleiding</a>
          </li>
        </ul>
      </details>
      <span class="file-menu-project-title" id="pm-title" aria-live="polite">Geen project</span>
    </div>
    <dialog class="file-menu-dialog" id="pm-open-dialog">
      <form method="dialog" class="file-menu-dialog-form">
        <h2>Project openen</h2>
        <p class="hint">Kies een lopend project om verder te werken.</p>
        <ul class="file-menu-project-list" id="pm-open-list"></ul>
        <p class="hint hidden" id="pm-open-empty">Geen openstaande projecten.</p>
        <div class="actions">
          <button type="submit" value="cancel" class="secondary">Annuleren</button>
        </div>
      </form>
    </dialog>
  `;
  const detailsEl = root.querySelector("#pm-root");
  const aboutEl = root.querySelector("#pm-about");
  const titleEl = root.querySelector("#pm-title");
  const recentEl = root.querySelector("#pm-recent");
  const dialogEl = root.querySelector("#pm-open-dialog");
  const openListEl = root.querySelector("#pm-open-list");
  const openEmptyEl = root.querySelector("#pm-open-empty");
  function status(state, text) {
    host.onStatus?.(state, text);
  }
  function refreshTitle() {
    const id = host.getBuildingId();
    const meta = host.getProjectMeta();
    const title = projectTitle({ ...meta, building_id: id });
    titleEl.textContent = id ? title : "Geen project";
    host.setTitle?.(id ? title : "Geen project");
  }
  function rememberCurrent() {
    const id = host.getBuildingId();
    if (!id) return;
    const meta = host.getProjectMeta();
    rememberRecentProject({
      building_id: id,
      label: meta.label,
      external_ref: meta.external_ref
    });
    renderRecent();
    refreshTitle();
  }
  function closeMenu() {
    detailsEl.open = false;
    aboutEl.open = false;
    const recent = root.querySelector(".file-menu-recent");
    if (recent) recent.open = false;
  }
  function renderRecent() {
    recentEl.innerHTML = "";
    const items = loadRecentProjects();
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "hint";
      li.textContent = "Nog geen recente projecten";
      recentEl.appendChild(li);
      return;
    }
    for (const p of items) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = projectTitle(p);
      btn.addEventListener("click", () => {
        closeMenu();
        void openProject2(p.building_id);
      });
      li.appendChild(btn);
      recentEl.appendChild(li);
    }
  }
  async function openProject2(buildingId) {
    status("busy", "Project openen\u2026");
    try {
      await host.openBuilding(buildingId);
      rememberCurrent();
      status("ok", "Project geopend");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function showOpenDialog() {
    const token = host.getToken();
    if (!token) {
      status("err", "Log eerst in");
      return;
    }
    closeMenu();
    openListEl.innerHTML = "";
    openEmptyEl.classList.add("hidden");
    status("busy", "Projecten laden\u2026");
    try {
      const ret = await host.invokeString("API_EngineerListProjects", [token]);
      const data = parseJsonOk(ret);
      const projects = data.projects || [];
      if (!projects.length) {
        openEmptyEl.classList.remove("hidden");
      }
      for (const p of projects) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        const title = projectTitle(p);
        btn.textContent = p.customer_name ? `${title} \u2014 ${p.customer_name}` : title;
        if (p.project_status) {
          btn.title = p.project_status;
        }
        btn.addEventListener("click", () => {
          dialogEl.close();
          void openProject2(p.building_id);
        });
        li.appendChild(btn);
        openListEl.appendChild(li);
      }
      status("ok", `${projects.length} project(en)`);
      if (typeof dialogEl.showModal === "function") dialogEl.showModal();
      else dialogEl.setAttribute("open", "");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function saveProject() {
    closeMenu();
    if (!host.getBuildingId()) {
      status("err", "Geen project geselecteerd");
      return;
    }
    status("busy", "Project opslaan\u2026");
    try {
      await host.saveProject();
      rememberCurrent();
      status("ok", "Project opgeslagen");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function renameProject() {
    closeMenu();
    const token = host.getToken();
    const id = host.getBuildingId();
    if (!token || !id) {
      status("err", "Geen project geselecteerd");
      return;
    }
    const meta = host.getProjectMeta();
    const label = window.prompt("Projectnaam (label)", meta.label || "");
    if (label === null) return;
    const externalRef = window.prompt("Projectnummer / werknummer", meta.external_ref || "");
    if (externalRef === null) return;
    status("busy", "Hernoemen\u2026");
    try {
      const ret = await host.invokeString("API_RenameProject", [
        token,
        id,
        label.trim(),
        externalRef.trim()
      ]);
      const data = parseJsonOk(ret);
      const next = {
        label: data.label ?? label.trim(),
        external_ref: data.external_ref ?? externalRef.trim()
      };
      host.onProjectRenamed?.(next);
      rememberRecentProject({ building_id: id, ...next });
      renderRecent();
      refreshTitle();
      status("ok", "Project hernoemd");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  async function deleteProject() {
    closeMenu();
    const token = host.getToken();
    const id = host.getBuildingId();
    if (!token || !id) {
      status("err", "Geen project geselecteerd");
      return;
    }
    const title = projectTitle({ ...host.getProjectMeta(), building_id: id });
    if (!window.confirm(
      `Project \xAB${title}\xBB definitief verwijderen?
Dit wist berekeningen, tekeningen en rapportmappen. Dit kan niet ongedaan worden gemaakt.`
    )) {
      return;
    }
    status("busy", "Project verwijderen\u2026");
    try {
      const ret = await host.invokeString("API_EngineerDeleteProject", [token, id]);
      parseJsonOk(ret);
      await cleanupProjectFolder(id, host.apiAuthHeaders());
      removeRecentProject(id);
      renderRecent();
      await host.onProjectDeleted?.();
      refreshTitle();
      status("ok", "Project verwijderd");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }
  detailsEl.addEventListener("toggle", () => {
    if (detailsEl.open) aboutEl.open = false;
  });
  aboutEl.addEventListener("toggle", () => {
    if (aboutEl.open) detailsEl.open = false;
  });
  root.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-act]");
    if (!btn || !root.contains(btn)) return;
    const act = btn.dataset.act;
    if (act === "open") void showOpenDialog();
    else if (act === "save") void saveProject();
    else if (act === "rename") void renameProject();
    else if (act === "delete") void deleteProject();
  });
  document.addEventListener("click", (ev) => {
    if (!detailsEl.open && !aboutEl.open) return;
    if (root.contains(ev.target)) return;
    closeMenu();
  });
  renderRecent();
  refreshTitle();
  return {
    refreshTitle,
    rememberCurrent,
    setEnabled(on) {
      root.classList.toggle("disabled", !on);
      for (const b of root.querySelectorAll("button, summary")) {
        if (b instanceof HTMLElement) {
          if (on) b.removeAttribute("aria-disabled");
          else b.setAttribute("aria-disabled", "true");
        }
      }
    }
  };
}

// src/bpp-api.ts
function parseBppJson(ret) {
  if (ret.startsWith("ERROR")) throw new Error(ret);
  try {
    return JSON.parse(ret);
  } catch {
    throw new Error(`Ongeldig JSON-antwoord van bppServer: ${ret.slice(0, 240)}`);
  }
}
function bppScaleRatioArg(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return "NULL";
  return String(ratio);
}
function bppAspectArg(aspect) {
  if (aspect == null || !Number.isFinite(aspect) || aspect <= 0) return "NULL";
  return String(aspect);
}
async function bppSaveFloormapScale(invoke, token, opts) {
  const ret = await invoke("API_SaveFloormapScale", [
    token,
    opts.section_id,
    String(opts.metres_per_norm_unit),
    bppScaleRatioArg(opts.scale_ratio),
    opts.scale_source || "CALIBRATED",
    bppAspectArg(opts.scale_aspect_yx)
  ]);
  return parseBppJson(ret);
}
async function bppDeleteDrawingRegion(invoke, token, regionId) {
  const ret = await invoke("API_DeleteDrawingRegion", [token, regionId]);
  parseBppJson(ret);
}
function bppPhase1Enabled() {
  try {
    return localStorage.getItem("GEVELWERING_BPP_HTTP") !== "1";
  } catch {
    return true;
  }
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

// src/shared/bpp-session.ts
var BppSession = class {
  constructor(opts) {
    __publicField(this, "ws", null);
    __publicField(this, "sessionId", null);
    __publicField(this, "auth", null);
    __publicField(this, "reqCounter", 0);
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "wsUrl");
    __publicField(this, "authKey");
    __publicField(this, "clientName");
    __publicField(this, "cb");
    /** Bumps on each connect() so stale open/close handlers are ignored. */
    __publicField(this, "connectGen", 0);
    __publicField(this, "reconnectTimer", null);
    /** Resolvers waiting for WebSocket OPEN (login while still connecting). */
    __publicField(this, "openWaiters", []);
    this.wsUrl = opts.wsUrl;
    this.authKey = opts.authKey;
    this.clientName = opts.clientName;
    this.cb = opts.callbacks;
  }
  nextRequestId(prefix) {
    this.reqCounter += 1;
    return `${prefix}_${this.reqCounter}_${Date.now()}`;
  }
  rejectAllPending(err) {
    for (const [id, waiter] of this.pending) {
      this.pending.delete(id);
      waiter.reject(err);
    }
  }
  rejectOpenWaiters(err) {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.reject(err);
    }
  }
  resolveOpenWaiters() {
    const waiters = this.openWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.resolve();
    }
  }
  /** Wait until WS is OPEN (or fail). Used when user acts while still connecting. */
  async whenOpen(timeoutMs = 12e3) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      throw new Error(`WebSocket niet verbonden (${this.wsUrl}). Herlaad of start ./start.sh.`);
    }
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.openWaiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) this.openWaiters.splice(idx, 1);
        reject(new Error(`WebSocket timeout \u2014 geen verbinding met ${this.wsUrl}`));
      }, timeoutMs);
      this.openWaiters.push({ resolve, reject, timer });
    });
  }
  async send(type, payload, wantType) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        await this.whenOpen();
      } else {
        throw new Error(`WebSocket niet open (${this.wsUrl}). Herlaad of start ./start.sh.`);
      }
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket niet open (${this.wsUrl}). Herlaad of start ./start.sh.`);
    }
    const request_id = this.nextRequestId(type.replace(".", "_"));
    const env = { v: 1, type, request_id, payload };
    if (this.sessionId && type !== "session.open") env.session_id = this.sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(request_id, { resolve, reject, want: wantType });
      this.ws.send(JSON.stringify(env));
    });
  }
  onMessage(raw) {
    let env;
    try {
      env = JSON.parse(raw);
    } catch {
      return;
    }
    if (env.type === "session.opened") {
      const sid = typeof env.session_id === "string" && env.session_id || (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
      if (sid) this.sessionId = sid;
    }
    if (env.type === "error") {
      const waiter2 = this.pending.get(env.request_id);
      if (waiter2) {
        this.pending.delete(env.request_id);
        waiter2.reject(new Error(JSON.stringify(env.payload ?? env)));
      }
      return;
    }
    const waiter = this.pending.get(env.request_id);
    if (!waiter) return;
    if (env.type === waiter.want || env.type.endsWith(".completed") || env.type === "exec.completed") {
      if (env.type === "invoke.accepted" || env.type === "exec.accepted") return;
      this.pending.delete(env.request_id);
      waiter.resolve(env);
    }
  }
  async invokeString(target, args) {
    const inv = await this.send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
    const ret = inv.payload?.return;
    if (typeof ret !== "string") throw new Error(`Onverwacht antwoord van ${target}`);
    return ret;
  }
  async loadSharedApi() {
    await this.send(
      "exec.request",
      { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
      "exec.completed"
    );
    const bootRet = await this.invokeString("API_Bootstrap", []);
    if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap mislukt: ${bootRet}`);
  }
  async bootstrapAndLogin(username, password) {
    await this.whenOpen();
    await this.loadSharedApi();
    const ret = await this.invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) throw new Error(ret);
    const parsed = JSON.parse(ret);
    if (!parsed.ok || !parsed.token) throw new Error("Inloggen mislukt");
    const info = {
      token: parsed.token,
      username: parsed.username || username,
      display_name: parsed.display_name || username
    };
    this.auth = info;
    this.storeAuth(info);
    this.cb.onLogin(info);
    return info;
  }
  storeAuth(info) {
    storeAuth(this.authKey, info);
    void syncSessionCookie(info?.token ?? null);
  }
  loadStoredAuth() {
    return loadAuth(this.authKey);
  }
  logout() {
    this.auth = null;
    this.storeAuth(null);
    this.cb.onLogout();
  }
  /**
   * Open WS, session.open, loadSharedApi, validate stored token.
   * Page-specific `onReady` callback fires after successful restore or login prompt.
   */
  connect(opts) {
    const reconnectMs = opts?.reconnectMs ?? 1500;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const gen = ++this.connectGen;
    this.sessionId = null;
    this.rejectAllPending(new Error("WebSocket herverbindt"));
    this.rejectOpenWaiters(new Error("WebSocket herverbindt"));
    const prev = this.ws;
    this.ws = null;
    if (prev && (prev.readyState === WebSocket.OPEN || prev.readyState === WebSocket.CONNECTING)) {
      try {
        prev.close();
      } catch {
      }
    }
    this.cb.onStatus(`Verbinden met ${this.wsUrl}\u2026`, "busy");
    this.cb.onConnLed(false);
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;
    ws.addEventListener("open", () => {
      if (gen !== this.connectGen || this.ws !== ws) return;
      this.cb.onConnLed(true);
      this.resolveOpenWaiters();
      void (async () => {
        try {
          await this.send("session.open", { client: this.clientName }, "session.opened");
          if (gen !== this.connectGen) return;
          await this.loadSharedApi();
          if (gen !== this.connectGen) return;
          const stored = this.loadStoredAuth();
          if (stored?.token) {
            const ret = await this.invokeString("API_ValidateSession", [stored.token]);
            if (gen !== this.connectGen) return;
            if (ret.startsWith("ERROR")) {
              this.cb.onLogout();
              this.cb.onStatus("Sessie verlopen \u2014 log in", "err");
            } else {
              this.auth = stored;
              this.cb.onLogin(stored);
              this.cb.onStatus("Gereed", "ok");
            }
          } else {
            this.cb.onLogout();
            this.cb.onStatus("Verbonden \u2014 log in", "ok");
          }
          if (gen !== this.connectGen) return;
          await this.cb.onReady?.();
        } catch (err) {
          if (gen !== this.connectGen) return;
          this.cb.onStatus(err instanceof Error ? err.message : String(err), "err");
          this.cb.onLogout();
        }
      })();
    });
    ws.addEventListener("message", (ev) => {
      if (this.ws !== ws) return;
      this.onMessage(String(ev.data));
    });
    ws.addEventListener("close", () => {
      if (gen !== this.connectGen) return;
      if (this.ws === ws) this.ws = null;
      this.sessionId = null;
      this.rejectAllPending(new Error("WebSocket verbroken"));
      this.rejectOpenWaiters(new Error("WebSocket verbroken"));
      this.cb.onConnLed(false);
      this.cb.onStatus(
        reconnectMs > 0 ? `Verbinding verbroken \u2014 opnieuw verbinden\u2026 (${this.wsUrl})` : `Verbinding verbroken (${this.wsUrl})`,
        "err"
      );
      if (reconnectMs > 0) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (gen === this.connectGen) this.connect(opts);
        }, reconnectMs);
      }
    });
    ws.addEventListener("error", () => {
      if (gen !== this.connectGen || this.ws !== ws) return;
      this.cb.onStatus(`WebSocket-fout (${this.wsUrl})`, "err");
    });
  }
};

// src/shared/dom-helpers.ts
function statusLabel(status) {
  switch (status) {
    case "INITIAL_REQUEST":
      return "Project gestart";
    case "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED":
      return "Gegevens aangeleverd \u2014 nog niet verwerkt";
    case "PROJECT_UNDERWAY":
      return "Project in uitvoering";
    case "PROJECT_NEAR_FINAL":
      return "Project bijna afgerond";
    case "PROJECT_FINISHED":
      return "Project afgerond";
    default:
      return status;
  }
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
var fileMenuRoot = document.getElementById("engineer-file-menu");
var queueListEl = document.getElementById("engineer-queue-list");
var queueSelectEl = document.getElementById("engineer-queue-select");
var queueHintEl = document.getElementById("engineer-queue-hint");
var queueOpenBtn = document.getElementById("engineer-queue-open-btn");
var reviewFeedbackEl = document.getElementById("engineer-review-feedback");
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
var rotateCcwBtn = document.getElementById("engineer-rotate-ccw");
var rotateCwBtn = document.getElementById("engineer-rotate-cw");
var rotateLabelEl = document.getElementById("engineer-rotate-label");
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
var reviewDoneEl = document.getElementById("engineer-review-done");
var reviewLegibleEl = document.getElementById("review-legible");
var reviewSufficientEl = document.getElementById("review-sufficient");
var reviewNotesEl = document.getElementById("review-notes");
var activeProject = null;
var projectMenu = null;
var activeDocumentId = null;
var pdfDoc = null;
var pdfPageNum = 1;
var pdfTotalPages = 0;
var canvasWidth = 0;
var canvasHeight = 0;
var pdfZoom = 2;
var pdfViewRotate = 0;
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
function showLogin() {
  loginPanelEl.classList.remove("hidden");
  panelEl.classList.add("hidden");
  reviewPanelEl.classList.add("hidden");
  if (fileMenuRoot) fileMenuRoot.hidden = true;
  projectMenu?.setEnabled(false);
}
function showPanel(info) {
  loginPanelEl.classList.add("hidden");
  panelEl.classList.remove("hidden");
  userLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
  if (fileMenuRoot) fileMenuRoot.hidden = false;
  projectMenu?.setEnabled(true);
  projectMenu?.refreshTitle();
}
var session = new BppSession({
  wsUrl: resolveBppWsUrl(),
  authKey: AUTH_KEY,
  clientName: "app-gevelwering-engineer",
  callbacks: {
    onStatus: setStatus,
    onConnLed: setConnLed,
    onLogin: (info) => showPanel(info),
    onLogout: () => showLogin(),
    onReady: async () => {
      if (session.auth) await loadQueue();
    }
  }
});
function invokeString(target, args) {
  return session.invokeString(target, args);
}
function auth() {
  return session.auth;
}
function setReviewFeedback(text, kind = "") {
  if (!reviewFeedbackEl) return;
  reviewFeedbackEl.classList.remove("hidden", "ok", "err", "busy");
  if (!text) {
    reviewFeedbackEl.classList.add("hidden");
    reviewFeedbackEl.textContent = "";
    return;
  }
  if (kind) reviewFeedbackEl.classList.add(kind);
  reviewFeedbackEl.textContent = text;
}
function reviewIsAccepted(status) {
  return status === "PROJECT_UNDERWAY" || status === "PROJECT_NEAR_FINAL" || status === "PROJECT_FINISHED";
}
function syncReviewFormVisibility() {
  const accepted = reviewIsAccepted(activeProject?.project_status);
  reviewForm.classList.toggle("hidden", accepted);
  if (!reviewDoneEl) return;
  if (accepted) {
    const notes = (activeProject?.review?.notes || "").trim();
    reviewDoneEl.classList.remove("hidden");
    reviewDoneEl.textContent = notes ? `Tekeningen geaccepteerd \xB7 ${statusLabel(activeProject.project_status)}. Notitie: ${notes}` : `Tekeningen geaccepteerd \xB7 ${statusLabel(activeProject.project_status)}. Reviewformulier is niet meer nodig.`;
  } else {
    reviewDoneEl.classList.add("hidden");
    reviewDoneEl.textContent = "";
  }
}
async function loadQueue(keepStatus) {
  if (!auth()?.token) return;
  if (!keepStatus) setStatus("Projecten laden\u2026", "busy");
  const ret = await invokeString("API_EngineerListReviewQueue", [auth().token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("engineer")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret);
  const projects = parsed.projects ?? [];
  const prev = queueSelectEl?.value || activeProject?.building_id || "";
  if (queueSelectEl) {
    queueSelectEl.innerHTML = "";
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "\u2014 kies een project \u2014";
    queueSelectEl.appendChild(blank);
  }
  if (queueListEl) queueListEl.innerHTML = "";
  if (projects.length === 0) {
    if (queueHintEl) {
      queueHintEl.textContent = "Geen actieve projecten (status: gegevens aangeleverd / in uitvoering / bijna afgerond). Zet de status in admin of laat de opdrachtgever tekeningen indienen. Of gebruik Bestand \u2192 Openen.";
    }
    setStatus(keepStatus?.text ?? "Geen actieve projecten", keepStatus?.kind ?? "ok");
    return;
  }
  for (const p of projects) {
    const title = p.label || p.building_id.slice(0, 8);
    const docs = Number(p.drawing_count) || 0;
    const who = (p.username || "").trim() ? p.username === p.customer_name ? p.username : `${p.username} \u2014 ${p.customer_name}` : p.customer_name;
    if (queueSelectEl) {
      const opt = document.createElement("option");
      opt.value = p.building_id;
      opt.textContent = `${title} \xB7 ${who} \xB7 ${statusLabel(p.project_status)} \xB7 ${docs} tekening(en)`;
      queueSelectEl.appendChild(opt);
    }
  }
  if (queueSelectEl && prev && [...queueSelectEl.options].some((o) => o.value === prev)) {
    queueSelectEl.value = prev;
  }
  if (queueHintEl) {
    queueHintEl.textContent = `${projects.length} project(en) \u2014 kies er \xE9\xE9n en klik Openen (of dubbelklik).`;
  }
  setStatus(keepStatus?.text ?? `${projects.length} project(en)`, keepStatus?.kind ?? "ok");
}
async function openProject(buildingId) {
  if (!auth()?.token) return;
  setStatus("Project laden\u2026", "busy");
  const ret = await invokeString("API_EngineerGetProject", [auth().token, buildingId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  activeProject = JSON.parse(ret);
  activeProject.regions = (activeProject.regions || []).map(normalizeRegion);
  reviewPanelEl.classList.remove("hidden");
  projectTitleEl.textContent = activeProject.label || "Project";
  projectMetaEl.textContent = `${activeProject.customer_name} \xB7 ${statusLabel(activeProject.project_status)} \xB7 werknummer ${activeProject.external_ref || "\u2014"} \xB7 kenmerk ${activeProject.client_ref || "\u2014"}`;
  if (gaLinkEl) {
    gaLinkEl.href = `/ga.html?building_id=${encodeURIComponent(activeProject.building_id)}`;
    gaLinkEl.classList.remove("hidden");
  }
  reviewLegibleEl.checked = Boolean(activeProject.review?.legible);
  reviewSufficientEl.checked = Boolean(activeProject.review?.sufficient);
  reviewNotesEl.value = activeProject.review?.notes || "";
  syncReviewFormVisibility();
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
    docHintEl.textContent = "Geen tekeningen bij dit project.";
  }
  renderRegionList();
  projectMenu?.rememberCurrent();
  projectMenu?.refreshTitle();
  setStatus("Project geladen", "ok");
}
function normalizeRegion(raw) {
  const scaleRatio = raw.scale_ratio != null ? Number(raw.scale_ratio) : NaN;
  const mpu = raw.metres_per_norm_unit != null ? Number(raw.metres_per_norm_unit) : NaN;
  const aspect = raw.scale_aspect_yx != null ? Number(raw.scale_aspect_yx) : NaN;
  return {
    id: String(raw.id || raw.region_id || ""),
    document_id: String(raw.document_id || ""),
    page_index: Number(raw.page_index) || 0,
    label: String(raw.label || "Sectie"),
    region_kind: raw.region_kind || "OTHER",
    x_min: Number(raw.x_min),
    y_min: Number(raw.y_min),
    x_max: Number(raw.x_max),
    y_max: Number(raw.y_max),
    scale_ratio: Number.isFinite(scaleRatio) ? scaleRatio : null,
    metres_per_norm_unit: Number.isFinite(mpu) ? mpu : null,
    scale_aspect_yx: Number.isFinite(aspect) && aspect > 0 ? aspect : null,
    scale_source: raw.scale_source != null ? String(raw.scale_source) : null,
    sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : 0
  };
}
function regionsForActiveDoc() {
  if (!activeProject || !activeDocumentId) return [];
  return activeProject.regions.filter((r) => r.document_id === activeDocumentId).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label, "nl"));
}
function filteredRegionsForActiveDoc() {
  const all = regionsForActiveDoc();
  const kind = currentRegionKindFilter();
  if (!kind) return all;
  return all.filter((r) => String(r.region_kind || "").toUpperCase() === kind.toUpperCase());
}
function mergeFilteredRegionOrder(fullOrdered, filteredOrderedIds) {
  const filteredSet = new Set(filteredOrderedIds);
  const queue = filteredOrderedIds.map((id) => fullOrdered.find((r) => r.id === id)).filter((r) => Boolean(r));
  return fullOrdered.map((r) => filteredSet.has(r.id) ? queue.shift() : r);
}
var regionDragId = null;
async function persistRegionOrder(ordered) {
  if (!auth()?.token || !activeDocumentId || !activeProject) return;
  const prev = activeProject.regions.map((r) => ({
    id: r.id,
    sort_order: r.sort_order ?? 0
  }));
  ordered.forEach((r, i) => {
    r.sort_order = i;
  });
  const others = activeProject.regions.filter((r) => r.document_id !== activeDocumentId);
  activeProject.regions = [...others, ...ordered];
  renderRegionList();
  drawRegionsOverlay();
  try {
    const ret = await invokeString("API_ReorderDrawingRegions", [
      auth().token,
      activeDocumentId,
      ordered.map((r) => r.id).join(",")
    ]);
    if (ret.startsWith("ERROR")) throw new Error(ret.replace(/^ERROR:\s*/, ""));
    const parsed = JSON.parse(ret);
    if (parsed.ok === false) throw new Error(parsed.error || "Volgorde opslaan mislukt");
    setStatus("Sectievolgorde opgeslagen", "ok");
  } catch (err) {
    for (const p of prev) {
      const r = activeProject.regions.find((x) => x.id === p.id);
      if (r) r.sort_order = p.sort_order;
    }
    renderRegionList();
    drawRegionsOverlay();
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
async function reorderRegionsByDrag(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return;
  const full = regionsForActiveDoc();
  const visible = filteredRegionsForActiveDoc();
  const fromIdx = visible.findIndex((r) => r.id === fromId);
  const toIdx = visible.findIndex((r) => r.id === toId);
  if (fromIdx < 0 || toIdx < 0) return;
  const nextVisible = visible.slice();
  const [moved] = nextVisible.splice(fromIdx, 1);
  nextVisible.splice(toIdx, 0, moved);
  const merged = mergeFilteredRegionOrder(
    full,
    nextVisible.map((r) => r.id)
  );
  await persistRegionOrder(merged);
}
function selectedRegion() {
  if (!selectedRegionId || !activeProject) return null;
  return activeProject.regions.find((r) => r.id === selectedRegionId) || null;
}
function scaleSourceLabel(source) {
  switch ((source || "").toUpperCase()) {
    case "PDF_TEXT":
      return "uit tekeningtekst";
    case "CALIBRATED":
      return "uit gemarkeerde lengte";
    default:
      return "";
  }
}
function regionSupportsScale(kind) {
  return kind === "FLOORMAP" || kind === "FACADE" || kind === "SECTION" || kind === "CROSS_SECTION";
}
function formatScaleStatus(sel) {
  const mpu = sel.metres_per_norm_unit;
  if (mpu == null || !(mpu > 0)) return `${sel.label}: schaal niet gezet`;
  const src = scaleSourceLabel(sel.scale_source);
  if (sel.scale_ratio != null && sel.scale_ratio > 0) {
    const from2 = src ? ` (${src})` : "";
    return `${sel.label}: papierschalen 1:${sel.scale_ratio}${from2}`;
  }
  const from = src ? ` (${src})` : "";
  return `${sel.label}: schaal gezet${from} \u2014 oppervlakten/lengtes in meters`;
}
function updateScaleUi() {
  const sel = selectedRegion();
  const awaitingMm = Boolean(scalePick && scalePick.points.length >= 2);
  if (scaleMmWrap) scaleMmWrap.classList.toggle("hidden", !awaitingMm);
  if (!sel) {
    scaleStatusEl.textContent = "Selecteer een sectie, daarna Schaal instellen";
    scaleHintEl.textContent = "Klik een plattegrond, gevel of doorsnede, daarna Schaal instellen.";
    scaleBtn.disabled = true;
    scaleBtn.textContent = "Schaal instellen";
    return;
  }
  if (!regionSupportsScale(sel.region_kind)) {
    scaleStatusEl.textContent = `${sel.label} kan niet geschaald worden`;
    scaleHintEl.textContent = "Schaal geldt voor plattegrond, gevel, doorsnede en dwarsdoorsnede.";
    scaleBtn.disabled = true;
    scaleBtn.textContent = "Schaal instellen";
    return;
  }
  scaleBtn.disabled = false;
  if (scalePick) {
    if (awaitingMm) {
      scaleStatusEl.textContent = `Twee punten gemarkeerd op ${sel.label}`;
      scaleHintEl.textContent = "Vul hieronder de werkelijke lengte in millimeters in, klik daarna Toepassen (of druk op Enter).";
      scaleBtn.textContent = "Schaal annuleren";
      queueMicrotask(() => {
        scaleMmInput.focus();
        scaleMmInput.select();
      });
    } else {
      scaleStatusEl.textContent = `Markeer een bekende lengte (${scalePick.points.length}/2 klikken)`;
      scaleHintEl.textContent = "Klik beide uiteinden van iets met een bekende maat (muur, schaalbalk, deuropening).";
      scaleBtn.textContent = "Schaal annuleren";
    }
    return;
  }
  scaleStatusEl.textContent = formatScaleStatus(sel);
  const hasScale = sel.metres_per_norm_unit != null && sel.metres_per_norm_unit > 0;
  if (hasScale) {
    scaleHintEl.textContent = "Schaal is klaar. Gebruik Gereedschap \u2192 Lengte / Polylijn om te meten, of Schaal instellen om opnieuw te kalibreren.";
  } else {
    scaleHintEl.textContent = "Klik Schaal instellen, markeer twee punten, vul daarna die lengte in mm in.";
  }
  scaleBtn.textContent = hasScale ? "Schaal herkalibreren" : "Schaal instellen";
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
  const noun = isFloor ? "ruimte" : "component";
  const nounPlural = isFloor ? "ruimten" : "componenten";
  if (analyzeComponentsLegend) {
    analyzeComponentsLegend.textContent = isFloor ? "Ruimten" : "Componenten";
  }
  if (analyzeComponentsHint) {
    analyzeComponentsHint.innerHTML = `Hier <strong>teken, ontdek en sla</strong> je gemarkeerde ${nounPlural} op op <em>${sel.label}</em> \u2014 zelfde menu als plattegrond (omschrijving, verdieping, Teken, Opslaan, Ontdekken).`;
  }
  if (analyzeOpenBtn) analyzeOpenBtn.textContent = `Analysewerkruimte ${noun} openen`;
  if (analyzeDiscoverBtn) analyzeDiscoverBtn.textContent = `${nounPlural.charAt(0).toUpperCase()}${nounPlural.slice(1)} ontdekken\u2026`;
  if (analyzeDrawBtn) analyzeDrawBtn.textContent = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} tekenen & opslaan\u2026`;
}
function openAnalysisWorkspace() {
  const sel = selectedRegion();
  if (!sel || !regionSupportsScale(sel.region_kind)) {
    setStatus("Selecteer eerst een plattegrond, gevel of doorsnede", "err");
    return;
  }
  const url = analysisWorkspaceUrl(sel.id);
  if (!url) {
    setStatus("Geen project geladen", "err");
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
    setStatus("Rond ontdekken eerst af of annuleer het voordat je schaal instelt", "err");
    return;
  }
  if (scalePick) {
    endScalePick("Schaalkeuze geannuleerd");
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
  setStatus("Klik het eerste schaalpunt op het canvas", "busy");
  drawRegionsOverlay();
}
function repickScalePoints() {
  if (!scalePick) return;
  scalePick = { points: [] };
  scaleMmWrap.classList.add("hidden");
  updateScaleUi();
  setStatus("Klik het eerste schaalpunt op het canvas", "busy");
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
    toolHintEl.textContent = measure.points.length < 2 ? "Klik twee punten om de lengte te meten (live tijdens bewegen)." : "Lengte klaar. Wis meting of klik opnieuw om opnieuw te beginnen.";
    return;
  }
  if (measure.tool === "polyline") {
    if (measure.closed) {
      toolHintEl.textContent = "Polylijn gesloten \u2014 omtrek en oppervlakte getoond. Wissen om opnieuw te tekenen.";
    } else if (measure.points.length === 0) {
      toolHintEl.textContent = "Klik om hoekpunten toe te voegen. Dubbelklik of klik bij het begin om te sluiten.";
    } else {
      toolHintEl.textContent = `${measure.points.length} punt(en). Dubbelklik / klik begin om te sluiten voor oppervlakte.`;
    }
    return;
  }
  toolHintEl.textContent = "Kies Lengte of Polylijn in het menu Gereedschap.";
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
      setStatus("Rond ontdekken eerst af of annuleer het voordat je meet", "err");
      syncToolSelectUi("off");
      return;
    }
    const mpu = activeScaleMpu();
    if (!mpu) {
      setStatus("Selecteer eerst een geschaalde sectie", "err");
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
  if (tool === "length") setStatus("Lengte meten: klik twee punten", "busy");
  else if (tool === "polyline") setStatus("Polylijn meten: klik hoekpunten", "busy");
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
  if (!auth()?.token) throw new Error("Niet ingelogd");
  if (bppPhase1Enabled()) {
    return bppSaveFloormapScale(invokeString, auth().token, {
      section_id: sectionId,
      metres_per_norm_unit: mpu,
      scale_ratio: null,
      scale_source: "CALIBRATED",
      scale_aspect_yx: aspectYx
    });
  }
  const res = await fetch("/api/floormap/scale", {
    method: "POST",
    credentials: "include",
    headers: apiAuthHeaders(auth().token, true),
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
  if (!res.ok || !body.ok) {
    throw new Error(body.error || `Schaal opslaan mislukt (HTTP ${res.status})`);
  }
  return body;
}
async function finishScalePick() {
  const sel = selectedRegion();
  if (!auth()?.token) {
    setStatus("Niet ingelogd \u2014 schaal kan niet worden opgeslagen", "err");
    return;
  }
  if (!sel) {
    setStatus("Selecteer eerst een sectie", "err");
    return;
  }
  if (!regionSupportsScale(sel.region_kind)) {
    setStatus("Dit sectietype kan niet geschaald worden", "err");
    return;
  }
  if (!scalePick || scalePick.points.length < 2) {
    setStatus("Markeer eerst twee schaalpunten", "err");
    return;
  }
  const mm = Number(scaleMmInput.value);
  if (!(mm > 0)) {
    setStatus("Vul een positieve afstand in mm in", "err");
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
    setStatus("Schaalpunten te dicht bij elkaar \u2014 kies opnieuw", "err");
    scalePick = { points: [] };
    updateScaleUi();
    drawRegionsOverlay();
    return;
  }
  const hadScale = sel.metres_per_norm_unit != null && Number(sel.metres_per_norm_unit) > 0;
  if (hadScale) {
    const ok = window.confirm(
      `Nieuwe schaal toepassen en alle maten op deze sectie herberekenen?

Oppervlakten, lengtes en kierlengtes worden bijgewerkt; opgeslagen GA-resultaten worden gewist.`
    );
    if (!ok) {
      setStatus("Schaalwijziging geannuleerd", "err");
      return;
    }
  }
  setStatus("Schaal opslaan en maten herberekenen\u2026", "busy");
  try {
    const stats = await saveSectionScale(sel.id, mpu, aspect);
    sel.metres_per_norm_unit = mpu;
    sel.scale_aspect_yx = aspect;
    sel.scale_source = "CALIBRATED";
    sel.scale_ratio = null;
    const n = Number(stats.subsections) || 0;
    const ga = Number(stats.ga_cleared) || 0;
    const detail = n > 0 ? ` ${n} component(en) herberekend` + (ga > 0 ? `; GA gewist voor ${ga} VR(\u2019s)` : "") : "";
    endScalePick(`Schaal opgeslagen: gemarkeerde lijn = ${mm} mm.${detail}`);
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
    setStatus(
      `Schaal opgeslagen (${mm} mm).${detail} Lengtetool klaar \u2014 klik twee punten.`,
      "ok"
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    updateScaleUi();
  }
}
var REGION_KIND_OPTIONS = [
  { value: "FLOORMAP", label: "Plattegrond" },
  { value: "FACADE", label: "Gevel" },
  { value: "CROSS_SECTION", label: "Dwarsdoorsnede" },
  { value: "SECTION", label: "Doorsnede" },
  { value: "OTHER", label: "Overig" }
];
function regionKindLabel(kind) {
  return REGION_KIND_OPTIONS.find((o) => o.value === kind)?.label || kind;
}
function nextRegionSortOrder(documentId) {
  if (!activeProject) return 0;
  let max = -1;
  for (const r of activeProject.regions) {
    if (r.document_id !== documentId) continue;
    max = Math.max(max, r.sort_order ?? 0);
  }
  return max + 1;
}
async function updateSavedRegion(r, label, kind) {
  if (!auth()?.token || !r.document_id || !r.id) {
    setStatus("Sectie kan niet worden bijgewerkt", "err");
    return;
  }
  const lbl = label.trim() || r.label || "Sectie";
  if (lbl === r.label && kind === r.region_kind) {
    return;
  }
  setStatus("Sectie bijwerken\u2026", "busy");
  const ret = await invokeString("API_SaveDrawingRegion", [
    auth().token,
    r.document_id,
    String(r.page_index),
    lbl,
    kind,
    String(r.x_min),
    String(r.y_min),
    String(r.x_max),
    String(r.y_max),
    r.id
  ]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret.replace(/^ERROR:\s*/, ""), "err");
    renderRegionList();
    return;
  }
  r.label = lbl;
  r.region_kind = kind;
  selectedRegionId = r.id;
  renderRegionList();
  drawRegionsOverlay();
  updateScaleUi();
  updateAnalyzePanel();
  setStatus(`Sectie bijgewerkt: ${regionKindLabel(kind)} \xB7 ${lbl}`, "ok");
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
  regionPendingHintEl.textContent = has ? "Markering klaar \u2014 klik Gemarkeerde sectie opslaan om op te slaan." : "Sleep een rechthoek op de PDF, sla daarna op \u2014 of ontdek automatisch.";
  drawRegionsOverlay();
}
function clearPendingMark() {
  setPendingMarkNorm(null);
}
function updateZoomLabel() {
  zoomLabelEl.textContent = `${Math.round(pdfZoom * 100)}%`;
}
function normalizeViewRotate(deg) {
  const n = (Math.round(deg) % 360 + 360) % 360;
  return n === 90 || n === 180 || n === 270 ? n : 0;
}
function updateRotateLabel() {
  if (rotateLabelEl) rotateLabelEl.textContent = `${pdfViewRotate}\xB0`;
}
function activeDocViewRotate() {
  const doc = activeProject?.documents.find((d) => d.id === activeDocumentId);
  return normalizeViewRotate(Number(doc?.view_rotate) || 0);
}
function syncViewRotateFromDoc() {
  pdfViewRotate = activeDocViewRotate();
  updateRotateLabel();
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
  const pageRotate = typeof page.rotate === "number" ? page.rotate : 0;
  const rotation = (pageRotate + pdfViewRotate) % 360;
  const base = page.getViewport({ scale: 1, rotation });
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
    li.textContent = kindFilter ? `Geen ${regionKindLabel(kindFilter).toLowerCase()}-secties voor deze tekening.` : "Geen secties opgeslagen voor deze tekening.";
    regionListEl.appendChild(li);
    updateScaleUi();
    return;
  }
  for (const r of regions) {
    const li = document.createElement("li");
    li.className = "drawing-list-item region-list-item";
    li.dataset.regionId = r.id;
    if (r.id === selectedRegionId) li.classList.add("selected");
    const handle = document.createElement("span");
    handle.className = "region-drag-handle";
    handle.title = "Verslepen om volgorde te wijzigen";
    handle.setAttribute("aria-hidden", "true");
    handle.textContent = "\u22EE\u22EE";
    handle.addEventListener("mousedown", () => {
      li.draggable = true;
    });
    li.appendChild(handle);
    const info = document.createElement("button");
    info.type = "button";
    info.className = "drawing-list-select";
    const scaleNote = regionSupportsScale(r.region_kind) && r.metres_per_norm_unit != null && r.metres_per_norm_unit > 0 ? " \xB7 geschaald" : "";
    info.textContent = `p${r.page_index + 1} \xB7 ${r.label}${scaleNote}`;
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
    const editRow = document.createElement("div");
    editRow.className = "region-edit-row";
    const kindSel = document.createElement("select");
    kindSel.className = "region-list-kind";
    kindSel.setAttribute("aria-label", "Soort sectie");
    for (const opt of REGION_KIND_OPTIONS) {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === r.region_kind) o.selected = true;
      kindSel.appendChild(o);
    }
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.className = "region-list-label";
    labelInput.value = r.label;
    labelInput.placeholder = "Omschrijving";
    labelInput.addEventListener("click", (ev) => ev.stopPropagation());
    labelInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        void updateSavedRegion(r, labelInput.value, kindSel.value);
      }
    });
    kindSel.addEventListener("click", (ev) => ev.stopPropagation());
    kindSel.addEventListener("change", () => {
      void updateSavedRegion(r, labelInput.value, kindSel.value);
    });
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "secondary";
    saveBtn.textContent = "Opslaan";
    saveBtn.title = "Omschrijving of soort bijwerken";
    saveBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      void updateSavedRegion(r, labelInput.value, kindSel.value);
    });
    editRow.appendChild(labelInput);
    editRow.appendChild(kindSel);
    editRow.appendChild(saveBtn);
    li.appendChild(editRow);
    const actions = document.createElement("span");
    actions.className = "drawing-list-actions";
    if (regionSupportsScale(r.region_kind) && activeProject) {
      const analyze = document.createElement("a");
      analyze.className = "secondary-link";
      analyze.href = `/floormap.html?building_id=${encodeURIComponent(activeProject.building_id)}&section_id=${encodeURIComponent(r.id)}`;
      analyze.textContent = r.region_kind === "FLOORMAP" ? "Ruimten analyseren" : "Componenten analyseren";
      actions.appendChild(analyze);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = "Verwijderen";
    btn.addEventListener("click", () => {
      void deleteRegion(r.id);
    });
    actions.appendChild(btn);
    li.appendChild(actions);
    li.addEventListener("dragstart", (ev) => {
      regionDragId = r.id;
      li.classList.add("is-dragging");
      ev.dataTransfer?.setData("text/plain", r.id);
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = "move";
    });
    li.addEventListener("dragend", () => {
      regionDragId = null;
      li.draggable = false;
      li.classList.remove("is-dragging");
      regionListEl.querySelectorAll(".region-list-item.drag-over").forEach((el) => {
        el.classList.remove("drag-over");
      });
    });
    li.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
      if (regionDragId && regionDragId !== r.id) li.classList.add("drag-over");
    });
    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over");
    });
    li.addEventListener("drop", (ev) => {
      ev.preventDefault();
      li.classList.remove("drag-over");
      const fromId = regionDragId || ev.dataTransfer?.getData("text/plain") || "";
      void reorderRegionsByDrag(fromId, r.id);
    });
    regionListEl.appendChild(li);
  }
  updateScaleUi();
  updateMeasureReadouts();
  updateToolHint();
  updateAnalyzePanel();
}
async function loadActiveDocument() {
  if (!auth()?.token || !activeDocumentId || !activeProject) return;
  const doc = activeProject.documents.find((d) => d.id === activeDocumentId);
  if (!doc) return;
  pdfDoc = null;
  pdfPageNum = 1;
  pdfTotalPages = 0;
  syncViewRotateFromDoc();
  if (discoveryCandidates.length > 0) endDiscoveryReview("Ontdekken geannuleerd (tekening gewijzigd)");
  endScalePick();
  selectedRegionId = null;
  clearPendingMark();
  clearOverlay();
  if (doc.file_ext.toLowerCase() !== "pdf") {
    docHintEl.textContent = `${doc.filename} is DWG \u2014 voorbeeld niet beschikbaar; gebruik externe CAD-software.`;
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
      ctx.fillText("DWG-voorbeeld niet ondersteund in de browser", 24, 60);
    }
    pageLabelEl.textContent = "DWG";
    setPageDisplay(1);
    return;
  }
  docHintEl.textContent = "Sleep een rechthoek om een sectie te markeren, of klik Secties ontdekken.";
  const res = await fetch(`/api/drawings/download?document_id=${encodeURIComponent(activeDocumentId)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth().token)
  });
  if (!res.ok) {
    docHintEl.textContent = `PDF laden mislukt (HTTP ${res.status})`;
    return;
  }
  const buf = await res.arrayBuffer();
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) {
    docHintEl.textContent = "PDF.js niet geladen";
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
  const pageRotate = typeof page.rotate === "number" ? page.rotate : 0;
  const rotation = (pageRotate + pdfViewRotate) % 360;
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
  pageLabelEl.textContent = `Pagina ${pdfPageNum} / ${pdfTotalPages}`;
  setPageDisplay(pdfPageNum);
  updateZoomLabel();
  updateRotateLabel();
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
        label: `Kandidaat ${discoveryIndex + 1}`
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
    drawBox(ctx, pendingMarkNorm, { stroke: "#c62828", dash: [6, 4], label: "Concept" });
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
  if (!auth()?.token || !activeDocumentId || !pendingMarkNorm || canvasWidth === 0) return;
  const { x_min: xMin, y_min: yMin, x_max: xMax, y_max: yMax, pageIndex } = pendingMarkNorm;
  const label = regionLabelInput.value.trim() || `Sectie ${savedRegionCount + 1}`;
  const kind = regionKindSelect.value;
  if (xMax - xMin < 0.01 || yMax - yMin < 0.01) {
    setStatus("Markering te klein \u2014 sleep een grotere rechthoek", "err");
    return;
  }
  regionSaveBtn.disabled = true;
  setStatus("Sectie opslaan\u2026", "busy");
  const ret = await invokeString("API_SaveDrawingRegion", [
    auth().token,
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
      y_max: yMax,
      sort_order: nextRegionSortOrder(activeDocumentId)
    });
  }
  savedRegionCount += 1;
  updateRegionCountBadge();
  clearPendingMark();
  renderRegionList();
  drawRegionsOverlay();
  setStatus(`Sectie opgeslagen (${savedRegionCount} totaal voor deze tekening)`, "ok");
}
async function deleteRegion(regionId) {
  if (!auth()?.token || !activeProject) return;
  if (!regionId) {
    setStatus("Sectie kan niet worden verwijderd \u2014 id ontbreekt", "err");
    return;
  }
  if (!window.confirm("Deze sectie verwijderen?")) return;
  setStatus("Sectie verwijderen\u2026", "busy");
  try {
    if (bppPhase1Enabled()) {
      await bppDeleteDrawingRegion(invokeString, auth().token, regionId);
    } else {
      const res = await fetch(`/api/drawings/sections?section_id=${encodeURIComponent(regionId)}`, {
        method: "DELETE",
        credentials: "include",
        headers: apiAuthHeaders(auth().token)
      });
      let parsed = {};
      try {
        parsed = await res.json();
      } catch {
      }
      if (!res.ok || !parsed.ok) {
        setStatus(parsed.error || `Sectie verwijderen mislukt (HTTP ${res.status})`, "err");
        return;
      }
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    return;
  }
  activeProject.regions = activeProject.regions.filter((r) => r.id !== regionId);
  if (selectedRegionId === regionId) {
    selectedRegionId = null;
    endScalePick();
  }
  renderRegionList();
  drawRegionsOverlay();
  setStatus("Sectie verwijderd", "ok");
}
async function clearAllSections() {
  if (!auth()?.token || !activeProject || !activeDocumentId) return;
  const toDelete = regionsForActiveDoc();
  const n = toDelete.length;
  if (n < 1) return;
  if (!window.confirm(`Alle ${n} sectie(s) van deze tekening verwijderen?`)) return;
  setStatus("Alle secties verwijderen\u2026", "busy");
  try {
    if (bppPhase1Enabled()) {
      for (const r of toDelete) {
        if (r.id) await bppDeleteDrawingRegion(invokeString, auth().token, r.id);
      }
    } else {
      const res = await fetch(`/api/drawings/sections?document_id=${encodeURIComponent(activeDocumentId)}`, {
        method: "DELETE",
        credentials: "include",
        headers: apiAuthHeaders(auth().token)
      });
      let parsed = {};
      try {
        parsed = await res.json();
      } catch {
      }
      if (!res.ok || !parsed.ok) {
        setStatus(parsed.error || `Secties wissen mislukt (HTTP ${res.status})`, "err");
        return;
      }
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    return;
  }
  activeProject.regions = activeProject.regions.filter((r) => r.document_id !== activeDocumentId);
  selectedRegionId = null;
  endScalePick();
  clearPendingMark();
  renderRegionList();
  drawRegionsOverlay();
  setStatus(`${n} sectie(s) verwijderd`, "ok");
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
  if (!auth()?.token || !activeDocumentId || !pdfDoc || canvasWidth === 0) {
    setStatus("Open eerst een PDF-tekening", "err");
    return;
  }
  setStatus("Rechthoekige secties ontdekken\u2026", "busy");
  regionDiscoverBtn.disabled = true;
  try {
    const found = discoverRectangularFrames(pdfCanvas);
    await renderPdfPage();
    if (found.length === 0) {
      setStatus("Geen rechthoekige secties gevonden op deze pagina", "err");
      return;
    }
    startDiscoveryReview(found);
    setStatus(`${found.length} kandidaat/kandidaten gevonden \u2014 beoordeel elk hieronder`, "ok");
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
    endDiscoveryReview("Ontdekken afgerond");
    return;
  }
  if (discoveryIndex >= discoveryCandidates.length) {
    endDiscoveryReview(
      `Ontdekken afgerond \u2014 ${discoveryCandidates.length} kandidaat/kandidaten beoordeeld`
    );
    return;
  }
  const n = discoveryCandidates.length;
  const i = discoveryIndex + 1;
  discoveryProgressEl.textContent = `(${i} van ${n})`;
  discoveryHintEl.textContent = "Sleep handvatten op de tekening, of gebruik H/V. Bediening blijft hier \u2014 alleen de PDF scrollt.";
  discoveryLabelInput.value = `Sectie ${savedRegionCount + 1}`;
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
  if (!auth()?.token || !activeDocumentId) return;
  if (discoveryIndex >= discoveryCandidates.length) return;
  const box = discoveryCandidates[discoveryIndex];
  const label = discoveryLabelInput.value.trim() || `Sectie ${savedRegionCount + 1}`;
  const kind = discoveryKindSelect.value;
  discoveryAcceptBtn.disabled = true;
  setStatus("Sectie opslaan\u2026", "busy");
  try {
    const ret = await invokeString("API_SaveDrawingRegion", [
      auth().token,
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
        y_max: box.y_max,
        sort_order: nextRegionSortOrder(activeDocumentId)
      });
    }
    savedRegionCount += 1;
    updateRegionCountBadge();
    renderRegionList();
    discoveryIndex += 1;
    showCurrentDiscoveryCandidate();
    if (discoveryCandidates.length > 0 && discoveryIndex < discoveryCandidates.length) {
      setStatus(`Sectie opgeslagen \u2014 volgende kandidaat (${discoveryIndex + 1} van ${discoveryCandidates.length})`, "ok");
    }
  } finally {
    discoveryAcceptBtn.disabled = false;
  }
}
function skipDiscoveryCandidate() {
  discoveryIndex += 1;
  showCurrentDiscoveryCandidate();
  if (discoveryCandidates.length > 0 && discoveryIndex < discoveryCandidates.length) {
    setStatus(`Overgeslagen \u2014 kandidaat ${discoveryIndex + 1} van ${discoveryCandidates.length}`, "ok");
  }
}
async function submitReview(evt) {
  evt.preventDefault();
  if (!auth()?.token || !activeProject) {
    setReviewFeedback("Open eerst een project uit de listbox.", "err");
    setStatus("Open eerst een project", "err");
    return;
  }
  if (discoveryCandidates.length > 0 && discoveryIndex < discoveryCandidates.length) {
    const left = discoveryCandidates.length - discoveryIndex;
    if (!window.confirm(
      `${left} ontdekte sectie(s) zijn nog niet geaccepteerd. Doorgaan met Review opslaan met alleen de al opgeslagen secties? (resterende kandidaten worden verworpen)`
    )) {
      return;
    }
    endDiscoveryReview("Ontdekken gesloten v\xF3\xF3r review opslaan");
  }
  if (pendingMarkNorm) {
    if (!window.confirm(
      "Er is een niet-opgeslagen gemarkeerde sectie. Sla die eerst op, of klik OK om deze te verwerpen en door te gaan met Review opslaan."
    )) {
      return;
    }
    clearPendingMark();
  }
  if (!reviewLegibleEl.checked || !reviewSufficientEl.checked) {
    const msg = "Beide checkboxen (Leesbaar \xE9n Voldoende om door te gaan) moeten aan staan om het project vrij te geven. Nu alleen opslaan als concept? Klik OK om toch op te slaan.";
    if (!window.confirm(msg)) {
      setReviewFeedback("Review niet opgeslagen \u2014 vink beide checkboxen aan om vrij te geven.", "err");
      return;
    }
  }
  const submitBtn = document.getElementById("engineer-submit-review-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Opslaan\u2026";
  }
  setReviewFeedback("Review wordt opgeslagen\u2026", "busy");
  setStatus("Review opslaan\u2026", "busy");
  try {
    const ret = await invokeString("API_ReviewDrawings", [
      auth().token,
      activeProject.building_id,
      reviewSufficientEl.checked ? "true" : "false",
      reviewLegibleEl.checked ? "true" : "false",
      reviewNotesEl.value.trim()
    ]);
    if (ret.startsWith("ERROR")) {
      const err = ret.replace(/^ERROR:\s*/, "");
      setReviewFeedback(err, "err");
      setStatus(err, "err");
      return;
    }
    const parsed = JSON.parse(ret);
    activeProject.project_status = parsed.project_status;
    activeProject.review = {
      ...activeProject.review || {},
      sufficient: reviewSufficientEl.checked,
      legible: reviewLegibleEl.checked,
      notes: reviewNotesEl.value.trim()
    };
    projectMetaEl.textContent = `${activeProject.customer_name} \xB7 ${statusLabel(activeProject.project_status)} \xB7 werknummer ${activeProject.external_ref || "\u2014"} \xB7 kenmerk ${activeProject.client_ref || "\u2014"}`;
    const n = Number(parsed.section_count ?? parsed.sections?.length ?? 0);
    const title = activeProject.label || activeProject.building_id.slice(0, 8);
    const sectionBit = n > 0 ? `${n} sectieobject(en) vastgelegd` : "geen secties (alleen beoordeling)";
    const msg = parsed.project_status === "PROJECT_UNDERWAY" ? `Review opgeslagen \u2014 \xAB${title}\xBB: ${sectionBit} \xB7 project in uitvoering (tekeningen geaccepteerd).` : `Review opgeslagen \u2014 \xAB${title}\xBB: ${sectionBit} \xB7 nog niet vrijgegeven.`;
    setReviewFeedback(msg, "ok");
    setStatus(msg, "ok");
    syncReviewFormVisibility();
    await loadQueue({ text: msg, kind: "ok" });
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Review opslaan";
    }
  }
}
loginForm.addEventListener("submit", async (evt) => {
  evt.preventDefault();
  const fd = new FormData(loginForm);
  loginBtn.disabled = true;
  try {
    setStatus("Inloggen\u2026", "busy");
    await session.bootstrapAndLogin(
      String(fd.get("username") || "").trim(),
      String(fd.get("password") || "")
    );
    await loadQueue();
    setStatus("Ingelogd", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Inloggen mislukt", "err");
    showLogin();
  } finally {
    loginBtn.disabled = false;
  }
});
logoutBtn.addEventListener("click", () => {
  if (auth()?.token) void invokeString("API_Logout", [auth().token]).catch(() => {
  });
  session.logout();
});
refreshBtn.addEventListener("click", () => {
  void loadQueue();
});
function openSelectedQueueProject() {
  const id = queueSelectEl?.value || "";
  if (!id) {
    setStatus("Kies eerst een project in de listbox", "err");
    if (queueHintEl) queueHintEl.textContent = "Kies eerst een project in de listbox.";
    return;
  }
  void openProject(id);
}
queueOpenBtn?.addEventListener("click", () => {
  openSelectedQueueProject();
});
queueSelectEl?.addEventListener("dblclick", () => {
  openSelectedQueueProject();
});
queueSelectEl?.addEventListener("change", () => {
  if (queueHintEl) {
    queueHintEl.textContent = queueSelectEl.value ? "Klik Openen (of dubbelklik) om dit project te beoordelen." : "Kies een project om tekeningen te beoordelen.";
  }
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
async function rotateActiveDocument(delta) {
  if (!auth()?.token || !activeDocumentId || !activeProject) {
    setStatus("Open eerst een tekening", "err");
    return;
  }
  const doc = activeProject.documents.find((d) => d.id === activeDocumentId);
  if (!doc) return;
  if (doc.file_ext.toLowerCase() !== "pdf") {
    setStatus("Draaien is alleen beschikbaar voor PDF-tekeningen", "err");
    return;
  }
  const regionCount = activeProject.regions.filter((r) => r.document_id === activeDocumentId).length;
  if (regionCount > 0) {
    const ok = window.confirm(
      `Tekening ${delta > 0 ? "90\xB0 rechtsom" : "90\xB0 linksom"} draaien?

${regionCount} sectie(s) en bijbehorende componenten worden meegetransformeerd.`
    );
    if (!ok) return;
  }
  const next = normalizeViewRotate(pdfViewRotate + delta);
  setStatus(`Tekening draaien naar ${next}\xB0\u2026`, "busy");
  try {
    const ret = await invokeString("API_SetDocumentViewRotate", [
      auth().token,
      activeDocumentId,
      String(next)
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret.replace(/^ERROR:\s*/, ""), "err");
      return;
    }
    const parsed = JSON.parse(ret);
    if (parsed.ok === false) {
      setStatus(parsed.error || "Draaien mislukt", "err");
      return;
    }
    const applied = normalizeViewRotate(Number(parsed.view_rotate ?? next));
    doc.view_rotate = applied;
    pdfViewRotate = applied;
    updateRotateLabel();
    const refresh = await invokeString("API_EngineerGetProject", [
      auth().token,
      activeProject.building_id
    ]);
    if (!refresh.startsWith("ERROR")) {
      const detail = JSON.parse(refresh);
      activeProject.documents = detail.documents || activeProject.documents;
      activeProject.regions = (detail.regions || []).map(normalizeRegion);
      const refreshed = activeProject.documents.find((d) => d.id === activeDocumentId);
      if (refreshed) {
        refreshed.view_rotate = normalizeViewRotate(Number(refreshed.view_rotate) || applied);
        pdfViewRotate = refreshed.view_rotate;
      }
      renderRegionList();
    }
    endScalePick();
    clearPendingMark();
    await renderPdfPage();
    setStatus(`Tekening gedraaid (${pdfViewRotate}\xB0)`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
rotateCwBtn?.addEventListener("click", () => {
  void rotateActiveDocument(90);
});
rotateCcwBtn?.addEventListener("click", () => {
  void rotateActiveDocument(-90);
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
  setStatus("Meting gewist", "ok");
});
toolClearSidebarBtn?.addEventListener("click", () => {
  clearMeasure(true);
  setStatus("Meting gewist", "ok");
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
(() => {
  const panel = document.getElementById("engineer-queue-bar");
  if (!panel) return;
  const key = "app-gevelwering-engineer-queue-collapsed";
  panel.open = localStorage.getItem(key) !== "1";
  panel.addEventListener("toggle", () => {
    localStorage.setItem(key, panel.open ? "0" : "1");
  });
})();
(() => {
  const panel = document.getElementById("engineer-project-id-bar");
  if (!panel) return;
  const key = "app-gevelwering-engineer-project-id-collapsed";
  panel.open = localStorage.getItem(key) !== "1";
  panel.addEventListener("toggle", () => {
    localStorage.setItem(key, panel.open ? "0" : "1");
  });
})();
window.addEventListener("keydown", (evt) => {
  if (evt.key === "Escape" && measure.tool !== "off") {
    clearMeasure(true);
    setStatus("Meting gewist", "ok");
  }
});
discoveryAcceptBtn.addEventListener("click", () => {
  void acceptDiscoveryCandidate();
});
discoverySkipBtn.addEventListener("click", () => {
  skipDiscoveryCandidate();
});
discoveryCancelBtn.addEventListener("click", () => {
  endDiscoveryReview("Ontdekken geannuleerd");
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
      setStatus("Klik het tweede schaalpunt", "busy");
    } else if (scalePick.points.length >= 2) {
      setStatus("Vul afstand in mm in, daarna Toepassen", "ok");
    }
    return;
  }
  if (measure.tool !== "off") {
    if (!activeScaleMpu()) {
      setStatus("Selecteer eerst een geschaalde sectie", "err");
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
    setStatus("Sectiekader aangepast \u2014 Accepteer wanneer klaar", "ok");
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
initEngineerLayoutSplit();
if (fileMenuRoot) {
  projectMenu = mountProjectMenu(fileMenuRoot, {
    getToken: () => auth()?.token ?? null,
    getBuildingId: () => activeProject?.building_id || "",
    getProjectMeta: () => ({
      label: activeProject?.label || "",
      external_ref: activeProject?.external_ref || ""
    }),
    invokeString: (name, args) => invokeString(name, args),
    apiAuthHeaders: () => auth ? apiAuthHeaders(auth().token, true) : {},
    openBuilding: (id) => openProject(id),
    saveProject: async () => {
      if (!activeProject) throw new Error("Geen project geselecteerd");
      setStatus("Tekeningen en review worden per actie opgeslagen \u2014 projectcontext bewaard", "ok");
    },
    onProjectRenamed: (meta) => {
      if (!activeProject) return;
      activeProject.label = meta.label;
      activeProject.external_ref = meta.external_ref;
      projectTitleEl.textContent = activeProject.label || "Project";
      projectMetaEl.textContent = `${activeProject.customer_name} \xB7 ${statusLabel(activeProject.project_status)} \xB7 werknummer ${activeProject.external_ref || "\u2014"} \xB7 kenmerk ${activeProject.client_ref || "\u2014"}`;
    },
    onProjectDeleted: async () => {
      activeProject = null;
      activeDocumentId = null;
      reviewPanelEl.classList.add("hidden");
      projectTitleEl.textContent = "";
      projectMetaEl.textContent = "";
      if (gaLinkEl) gaLinkEl.classList.add("hidden");
      await loadQueue();
    },
    onStatus: (state, text) => setStatus(text, state),
    setTitle: (title) => {
      document.title = title === "Geen project" ? "Stilte advies en meten \u2014 Tekeningen beoordelen" : `${title} \u2014 Ingenieur`;
    }
  });
  fileMenuRoot.hidden = true;
}
session.connect();
