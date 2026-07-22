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

// src/app.ts
var AUTH_KEY = "acoustics_p0_auth";
var BPP_WS = resolveBppWsUrl();
var connBarEl = document.getElementById("conn-bar");
var connLedEl = document.getElementById("conn-led");
var statusEl = document.getElementById("conn-status");
var loginPanel = document.getElementById("login-panel");
var appPanel = document.getElementById("app-panel");
var loginForm = document.getElementById("login-form");
var registerForm = document.getElementById("register-form");
var customerProfileForm = document.getElementById("customer-profile-form");
var projectForm = document.getElementById("project-form");
var loginBtn = document.getElementById("login-btn");
var registerBtn = document.getElementById("register-btn");
var gotoSigninBtn = document.getElementById("goto-signin-btn");
var registerResultEl = document.getElementById("register-result");
var registerMessageEl = document.getElementById("register-message");
var accessPasswordCodeEl = document.getElementById("access-password");
var logoutBtn = document.getElementById("logout-btn");
var saveBtn = document.getElementById("save-btn");
var reloadBtn = document.getElementById("reload-btn");
var tabSigninBtn = document.getElementById("tab-signin");
var tabRegisterBtn = document.getElementById("tab-register");
var userLabel = document.getElementById("user-label");
var pageTitle = document.getElementById("page-title");
var pageLede = document.getElementById("page-lede");
var projectListEl = document.getElementById("project-list");
var projectListEmptyEl = document.getElementById("project-list-empty");
var newProjectBtn = document.getElementById("new-project-btn");
var deleteProjectBtn = document.getElementById("delete-project-btn");
var refreshListBtn = document.getElementById("refresh-list-btn");
var projectIdInput = document.getElementById("project-id-input");
var projectStatusViewEl = document.getElementById("project-status-view");
var projectDetailPanel = document.getElementById("project-detail-panel");
var projectDetailTitle = document.getElementById("project-detail-title");
var profileBtn = document.getElementById("profile-btn");
var profilePanelEl = document.getElementById("profile-panel");
var profileServiceEmailEl = document.getElementById("profile-service-email");
var profilePwWarningEl = document.getElementById("profile-pw-warning");
var saveProfileBtn = document.getElementById("save-profile-btn");
var passwordForm = document.getElementById("password-form");
var changePwBtn = document.getElementById("change-pw-btn");
var profileCloseBtn = document.getElementById("profile-close-btn");
var drawingFileInput = document.getElementById("drawing-file-input");
var drawingListEl = document.getElementById("drawing-list");
var drawingUploadHintEl = document.getElementById("drawing-upload-hint");
var submitDrawingsBtn = document.getElementById("submit-drawings-btn");
var projectProgressEl = document.getElementById("project-progress");
var projectProgressStepsEl = document.getElementById("project-progress-steps");
var projectProgressCaptionEl = document.getElementById("project-progress-caption");
var projectReportSlotEl = document.getElementById("project-report-slot");
var downloadReportBtn = document.getElementById("download-report-btn");
var ws = null;
var sessionId = null;
var reqCounter = 0;
var lastProjectId = null;
var currentProjectStatus = null;
var auth = null;
var issuedAccessPassword = null;
var issuedAccessUsername = null;
var cachedProjects = [];
var pending = /* @__PURE__ */ new Map();
function setStatus(text, kind = "busy") {
  statusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}
function setConnLed(connected) {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}
function setAuthTab(tab) {
  tabSigninBtn.classList.toggle("active", tab === "signin");
  tabRegisterBtn.classList.toggle("active", tab === "register");
  loginForm.classList.toggle("hidden", tab !== "signin");
  registerForm.classList.toggle("hidden", tab !== "register");
  registerResultEl.classList.add("hidden");
}
function statusLabel(status) {
  switch (status) {
    case "INITIAL_REQUEST":
      return "Project started \u2014 upload drawings";
    case "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED":
      return "Drawings submitted \u2014 awaiting acceptance";
    case "PROJECT_UNDERWAY":
      return "Drawings accepted \u2014 calculation underway";
    case "PROJECT_NEAR_FINAL":
      return "Calculation near final";
    case "PROJECT_FINISHED":
      return "Report ready (concept v1.0)";
    default:
      return status || "Unknown";
  }
}
var PROGRESS_STEPS = [
  { key: "INITIAL_REQUEST", title: "Project started", short: "Started" },
  { key: "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED", title: "Drawings submitted", short: "Submitted" },
  { key: "PROJECT_UNDERWAY", title: "Drawings accepted", short: "Accepted" },
  { key: "PROJECT_NEAR_FINAL", title: "Near final", short: "Near final" },
  { key: "PROJECT_FINISHED", title: "Report ready", short: "Report" }
];
function progressIndex(status) {
  if (!status) return -1;
  const idx = PROGRESS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}
function renderProjectProgress(status) {
  if (!status) {
    projectProgressEl.hidden = true;
    projectReportSlotEl.hidden = true;
    return;
  }
  projectProgressEl.hidden = false;
  const current = progressIndex(status);
  projectProgressStepsEl.innerHTML = "";
  PROGRESS_STEPS.forEach((step, i) => {
    const li = document.createElement("li");
    li.className = "progress-step";
    if (i < current) li.classList.add("done");
    if (i === current) li.classList.add("current");
    if (i > current) li.classList.add("pending");
    if (i <= current) li.classList.add("reached");
    li.innerHTML = `
      <span class="progress-facet" aria-hidden="true"></span>
      <span class="progress-step-label">${step.short}</span>
    `;
    li.title = step.title;
    li.setAttribute("aria-current", i === current ? "step" : "false");
    projectProgressStepsEl.appendChild(li);
  });
  const captions = {
    INITIAL_REQUEST: "Next: upload drawings and submit them for review.",
    PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED: "An engineer is checking whether your drawings are acceptable as a basis for the calculation.",
    PROJECT_UNDERWAY: "Your drawings were accepted. Calculation work is underway.",
    PROJECT_NEAR_FINAL: "The calculation is nearly complete. The concept report will follow soon.",
    PROJECT_FINISHED: "Finished \u2014 your concept report (v1.0) is ready to download."
  };
  projectProgressCaptionEl.textContent = captions[status] || statusLabel(status);
  const finished = status === "PROJECT_FINISHED";
  projectReportSlotEl.hidden = !finished;
  downloadReportBtn.disabled = !finished;
}
function miniProgressBar(status) {
  const current = progressIndex(status);
  const facets = PROGRESS_STEPS.map((_, i) => {
    const cls = i <= current ? "mini-facet reached" : "mini-facet";
    return `<span class="${cls}"></span>`;
  }).join("");
  return `<span class="mini-progress" title="${statusLabel(status)}" aria-hidden="true">${facets}</span>`;
}
function projectTitle(p) {
  if (p.label) return p.label;
  if (p.external_ref) return p.external_ref;
  if (p.dwell_street) return p.dwell_street;
  return "Untitled project";
}
function nextRequestId(prefix) {
  reqCounter += 1;
  return `${prefix}_${reqCounter}_${Date.now()}`;
}
function loadStoredAuth() {
  const parsed = loadAuth(AUTH_KEY);
  if (!parsed?.token || !parsed.user_id) return null;
  return parsed;
}
function storeAuth2(info) {
  storeAuth(AUTH_KEY, info);
  void syncSessionCookie(info?.token ?? null);
}
function setFormValue(form, name, value) {
  const el = form.elements.namedItem(name);
  if (el && "value" in el) el.value = value;
}
function showLogin() {
  auth = null;
  storeAuth2(null);
  loginPanel.classList.remove("hidden");
  appPanel.classList.add("hidden");
  profilePanelEl.classList.add("hidden");
  projectDetailPanel.classList.add("hidden");
  profilePwWarningEl.classList.add("hidden");
  setAuthTab("signin");
  pageTitle.textContent = "Sign in";
  pageLede.textContent = "Log in with your service credentials to manage acoustics projects.";
  document.title = "Acoustics P0 \u2014 Login";
}
async function showApp(info) {
  auth = info;
  storeAuth2(info);
  loginPanel.classList.add("hidden");
  appPanel.classList.remove("hidden");
  projectDetailPanel.classList.add("hidden");
  const label = info.display_name || info.username;
  userLabel.textContent = `Signed in as ${label}`;
  profileServiceEmailEl.textContent = info.email ? `Service account email: ${info.email}` : "Service account email not set.";
  const mustChange = !!info.must_change_password;
  profilePwWarningEl.classList.toggle("hidden", !mustChange);
  profilePanelEl.classList.toggle("hidden", !mustChange);
  pageTitle.textContent = "Projects";
  pageLede.textContent = "Your outstanding acoustics projects. Customer details are managed under Profile.";
  document.title = "Acoustics P0 \u2014 Projects";
  await loadCustomerProfile();
  await refreshProjectList();
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
  const inv = await send(
    "invoke.request",
    { target_kind: "procedure", target, args },
    "invoke.completed"
  );
  const ret = inv.payload?.return;
  if (typeof ret !== "string") {
    throw new Error(`Unexpected return from ${target}: ${JSON.stringify(inv.payload)}`);
  }
  if (ret === "") {
    throw new Error(
      `${target} returned empty \u2014 file chunk may exceed server limits; try a smaller drawing or restart bppServer after rebuild`
    );
  }
  return ret;
}
async function bootstrapSession() {
  setStatus(`Connecting to ${BPP_WS}\u2026`, "busy");
  ws = new WebSocket(BPP_WS);
  setConnLed(false);
  await new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("WebSocket connect timeout")), 8e3);
    ws.onopen = () => {
      window.clearTimeout(t);
      setConnLed(true);
      resolve();
    };
    ws.onerror = () => {
      window.clearTimeout(t);
      setConnLed(false);
      reject(new Error("WebSocket connection failed \u2014 is bppServer running on port 18080?"));
    };
  });
  ws.onmessage = (ev) => onMessage(String(ev.data));
  ws.onclose = () => {
    setConnLed(false);
    setStatus("Disconnected from bppServer", "err");
  };
  await send("session.open", { client_name: "acoustics-p0-web", client_version: "0.2.0" }, "session.opened");
  const load = await send(
    "exec.request",
    { code: 'INCLUDE "fixtures/acoustics/shared_building_api.basicpp"\n' },
    "exec.completed"
  );
  if (load.type === "error") throw new Error(`exec failed: ${JSON.stringify(load.payload)}`);
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap failed: ${bootRet}`);
  setStatus(`Connected \xB7 session ${sessionId ?? "?"} \xB7 Postgres ready`, "ok");
  const stored = loadStoredAuth();
  if (stored) {
    const validated = await invokeString("API_ValidateSession", [stored.token]);
    if (validated.startsWith("ERROR")) {
      showLogin();
      setStatus("Previous session expired \u2014 please sign in", "err");
      return;
    }
    const info = JSON.parse(validated);
    await showApp(info);
    if (!lastProjectId) setStatus(`Signed in as ${info.display_name || info.username}`, "ok");
  } else {
    showLogin();
  }
}
function readCustomerProfile() {
  const fd = new FormData(customerProfileForm);
  const g = (k) => String(fd.get(k) ?? "").trim();
  return {
    name: g("name"),
    email: g("email"),
    phone: g("phone"),
    notes: g("notes"),
    cust_street: g("cust_street"),
    cust_postal: g("cust_postal"),
    cust_city: g("cust_city"),
    cust_municipality: g("cust_municipality"),
    cust_country: g("cust_country") || "NL"
  };
}
function readProjectForm() {
  const fd = new FormData(projectForm);
  const g = (k) => String(fd.get(k) ?? "").trim();
  return {
    dwell_street: g("dwell_street"),
    dwell_postal: g("dwell_postal"),
    dwell_city: g("dwell_city"),
    dwell_municipality: g("dwell_municipality"),
    dwell_country: g("dwell_country") || "NL",
    label: g("label"),
    external_ref: g("external_ref")
  };
}
async function loadCustomerProfile() {
  if (!auth?.token) return;
  const ret = await invokeString("API_GetCustomerProfile", [auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  const parsed = JSON.parse(ret);
  if (!parsed.customer) return;
  setFormValue(customerProfileForm, "name", parsed.customer.name);
  setFormValue(customerProfileForm, "email", parsed.customer.email);
  setFormValue(customerProfileForm, "phone", parsed.customer.phone);
  setFormValue(customerProfileForm, "notes", parsed.customer.notes);
  const ca = parsed.customer_address;
  setFormValue(customerProfileForm, "cust_street", ca?.street_line ?? "");
  setFormValue(customerProfileForm, "cust_postal", ca?.postal_code ?? "");
  setFormValue(customerProfileForm, "cust_city", ca?.city ?? "");
  setFormValue(customerProfileForm, "cust_municipality", ca?.municipality ?? "");
  setFormValue(customerProfileForm, "cust_country", ca?.country_code || "NL");
}
function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function fileExtension(name) {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}
function activeProjectId() {
  const id = projectIdInput.value.trim() || lastProjectId;
  return id || null;
}
async function refreshProjectDocuments() {
  drawingListEl.innerHTML = "";
  const projectId = activeProjectId();
  if (!auth?.token || !projectId) {
    drawingUploadHintEl.textContent = "Save the project first, then upload PDF or DWG drawings.";
    drawingFileInput.disabled = true;
    updateSubmitDrawingsButton(0);
    return;
  }
  lastProjectId = projectId;
  drawingFileInput.disabled = currentProjectStatus !== null && currentProjectStatus !== "INITIAL_REQUEST";
  const res = await fetch(`/api/drawings/list?building_id=${encodeURIComponent(projectId)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    drawingUploadHintEl.textContent = `Failed to load drawings (HTTP ${res.status})`;
    return;
  }
  if (!res.ok || !parsed.ok) {
    drawingUploadHintEl.textContent = parsed.error || `Failed to load drawings (HTTP ${res.status})`;
    return;
  }
  const docs = parsed.documents ?? [];
  updateSubmitDrawingsButton(docs.length);
  if (docs.length === 0) {
    drawingUploadHintEl.textContent = "No drawings uploaded yet.";
    return;
  }
  drawingUploadHintEl.textContent = `${docs.length} drawing${docs.length === 1 ? "" : "s"} uploaded.`;
  for (const doc of docs) {
    const li = document.createElement("li");
    li.className = "drawing-list-item";
    const info = document.createElement("span");
    info.textContent = `${doc.filename} (${doc.file_ext.toUpperCase()}, ${formatBytes(Number(doc.byte_size || 0))})`;
    li.appendChild(info);
    if (currentProjectStatus === "INITIAL_REQUEST") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary";
      btn.textContent = "Remove";
      btn.addEventListener("click", () => {
        void deleteDrawing(doc.id);
      });
      li.appendChild(btn);
    }
    drawingListEl.appendChild(li);
  }
}
async function uploadDrawingFile(file) {
  const projectId = activeProjectId();
  if (!auth?.token || !projectId) throw new Error("Select or save a project first");
  lastProjectId = projectId;
  const ext = fileExtension(file.name);
  if (ext !== "pdf" && ext !== "dwg") throw new Error(`${file.name}: only PDF and DWG files are allowed`);
  const q = new URLSearchParams({ building_id: projectId, filename: file.name });
  const res = await fetch(`/api/drawings/upload?${q}`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...apiAuthHeaders(auth.token),
      "Content-Type": "application/octet-stream"
    },
    body: file
  });
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    throw new Error(`${file.name}: invalid server response (HTTP ${res.status})`);
  }
  if (!res.ok || !parsed.ok) {
    throw new Error(`${file.name}: ${parsed.error || res.statusText || `HTTP ${res.status}`}`);
  }
}
async function deleteDrawing(documentId) {
  if (!auth?.token || !window.confirm("Remove this drawing?")) return;
  setStatus("Removing drawing\u2026", "busy");
  const ret = await invokeString("API_DeleteDrawing", [auth.token, documentId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  await refreshProjectDocuments();
  setStatus("Drawing removed", "ok");
}
function updateSubmitDrawingsButton(drawingCount = 0) {
  const canSubmit = Boolean(activeProjectId()) && currentProjectStatus === "INITIAL_REQUEST" && drawingCount > 0;
  submitDrawingsBtn.disabled = !canSubmit;
}
async function submitDrawingsForReview() {
  const projectId = activeProjectId();
  if (!auth?.token || !projectId) return;
  if (!window.confirm(
    "Submit drawings for engineer review? You will not be able to upload or edit this project afterwards."
  )) {
    return;
  }
  setStatus("Submitting drawings\u2026", "busy");
  submitDrawingsBtn.disabled = true;
  const ret = await invokeString("API_CustomerSubmitDrawings", [auth.token, projectId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    updateSubmitDrawingsButton();
    return;
  }
  const parsed = JSON.parse(ret);
  setProjectEditingState(parsed.project_status);
  await refreshProjectList();
  setStatus("Drawings submitted \u2014 an engineer will review them", "ok");
}
function setProjectEditingState(status) {
  currentProjectStatus = status;
  renderProjectProgress(status);
  const editable = !status || status === "INITIAL_REQUEST";
  saveBtn.disabled = !editable;
  deleteProjectBtn.disabled = !lastProjectId || status !== "INITIAL_REQUEST";
  projectForm.querySelectorAll("input:not([type=hidden]), textarea").forEach((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.readOnly = !editable;
    }
  });
  if (status && status !== "INITIAL_REQUEST") {
    projectStatusViewEl.textContent = statusLabel(status);
    drawingFileInput.disabled = true;
    submitDrawingsBtn.disabled = true;
  } else if (status === "INITIAL_REQUEST") {
    projectStatusViewEl.textContent = `${statusLabel(status)} \u2014 you can still edit or delete this project.`;
    drawingFileInput.disabled = !lastProjectId;
  } else {
    projectStatusViewEl.textContent = "Fill in the dwelling address and save to create a new project.";
    drawingFileInput.disabled = true;
    submitDrawingsBtn.disabled = true;
  }
  void refreshProjectDocuments();
}
function clearProjectFields() {
  for (const name of ["dwell_street", "dwell_postal", "dwell_city", "dwell_municipality", "dwell_country", "label", "external_ref"]) {
    setFormValue(projectForm, name, name === "dwell_country" ? "NL" : "");
  }
  projectIdInput.value = "";
  lastProjectId = null;
  currentProjectStatus = null;
  reloadBtn.disabled = true;
  deleteProjectBtn.disabled = true;
  saveBtn.disabled = false;
  projectForm.querySelectorAll("input:not([type=hidden]), textarea").forEach((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.readOnly = false;
    }
  });
  projectDetailTitle.textContent = "New project";
  drawingListEl.innerHTML = "";
  drawingFileInput.value = "";
  drawingFileInput.disabled = true;
  drawingUploadHintEl.textContent = "Save the project first, then upload PDF or DWG drawings.";
  renderProjectProgress(null);
  setProjectEditingState(null);
  highlightSelectedProject(null);
}
function fillProjectFromOpen(data) {
  setFormValue(projectForm, "dwell_street", data.dwelling_address.street_line);
  setFormValue(projectForm, "dwell_postal", data.dwelling_address.postal_code);
  setFormValue(projectForm, "dwell_city", data.dwelling_address.city);
  setFormValue(projectForm, "dwell_municipality", data.dwelling_address.municipality);
  setFormValue(projectForm, "dwell_country", data.dwelling_address.country_code || "NL");
  setFormValue(projectForm, "label", data.building.label);
  setFormValue(projectForm, "external_ref", data.building.external_ref);
  projectIdInput.value = data.building.id;
  lastProjectId = data.building.id;
  reloadBtn.disabled = !lastProjectId;
  projectDetailPanel.classList.remove("hidden");
  projectDetailTitle.textContent = projectTitle({
    label: data.building.label,
    external_ref: data.building.external_ref,
    dwell_street: data.dwelling_address.street_line
  });
  highlightSelectedProject(data.building.id);
  setProjectEditingState(data.building.project_status ?? null);
}
function highlightSelectedProject(id) {
  projectListEl.querySelectorAll(".project-list-item").forEach((el) => {
    el.classList.toggle("selected", id !== null && el.dataset.projectId === id);
  });
}
function renderProjectList(projects) {
  cachedProjects = projects;
  projectListEl.innerHTML = "";
  projectListEmptyEl.classList.toggle("hidden", projects.length > 0);
  for (const p of projects) {
    const li = document.createElement("li");
    li.className = "project-list-item";
    li.dataset.projectId = p.id;
    const title = document.createElement("span");
    title.className = "project-list-title";
    title.textContent = projectTitle(p);
    const status = document.createElement("span");
    status.className = "project-list-status";
    status.innerHTML = `${miniProgressBar(p.project_status)}<span class="project-list-status-text">${statusLabel(p.project_status)}</span>`;
    li.appendChild(title);
    li.appendChild(status);
    li.addEventListener("click", () => {
      void openProject(p.id);
    });
    projectListEl.appendChild(li);
  }
  highlightSelectedProject(lastProjectId);
}
async function refreshProjectList() {
  if (!auth?.token) return;
  const ret = await invokeString("API_ListBuildings", [auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("session")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret);
  renderProjectList(parsed.projects ?? []);
}
async function openProject(id) {
  if (!auth?.token) return;
  setStatus("Loading project\u2026", "busy");
  try {
    const ret = await invokeString("API_OpenBuilding", [auth.token, id]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      if (ret.includes("login") || ret.includes("session")) showLogin();
      return;
    }
    fillProjectFromOpen(JSON.parse(ret));
    setStatus("Project loaded", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  loginBtn.disabled = true;
  setStatus("Signing in\u2026", "busy");
  try {
    const fd = new FormData(loginForm);
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const ret = await invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const info = JSON.parse(ret);
    await showApp(info);
    if (!lastProjectId) setStatus(`Signed in as ${info.display_name || info.username}`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    loginBtn.disabled = false;
  }
});
logoutBtn.addEventListener("click", async () => {
  try {
    if (auth?.token) await invokeString("API_Logout", [auth.token]);
  } catch {
  }
  issuedAccessPassword = null;
  issuedAccessUsername = null;
  showLogin();
  setStatus("Signed out", "ok");
  lastProjectId = null;
  currentProjectStatus = null;
});
tabSigninBtn.addEventListener("click", () => setAuthTab("signin"));
tabRegisterBtn.addEventListener("click", () => setAuthTab("register"));
registerForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  registerBtn.disabled = true;
  setStatus("Requesting access\u2026", "busy");
  registerResultEl.classList.add("hidden");
  try {
    const fd = new FormData(registerForm);
    const username = String(fd.get("username") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const displayName = String(fd.get("display_name") ?? "").trim();
    const ret = await invokeString("API_RequestAccess", [username, email, displayName]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const parsed = JSON.parse(ret);
    issuedAccessUsername = parsed.username;
    issuedAccessPassword = parsed.access_password;
    registerMessageEl.textContent = parsed.message || "Access request submitted.";
    accessPasswordCodeEl.textContent = parsed.access_password;
    registerResultEl.classList.remove("hidden");
    setStatus("Access requested", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    registerBtn.disabled = false;
  }
});
gotoSigninBtn.addEventListener("click", () => {
  setAuthTab("signin");
  const uEl = loginForm.elements.namedItem("username");
  const pEl = loginForm.elements.namedItem("password");
  if (uEl && issuedAccessUsername) uEl.value = issuedAccessUsername;
  if (pEl && issuedAccessPassword) pEl.value = issuedAccessPassword;
  setStatus("Sign in with your issued password", "ok");
});
profileBtn.addEventListener("click", () => {
  profilePanelEl.classList.remove("hidden");
  profilePwWarningEl.classList.toggle("hidden", !auth?.must_change_password);
  void loadCustomerProfile();
});
profileCloseBtn.addEventListener("click", () => {
  if (auth?.must_change_password) return;
  profilePanelEl.classList.add("hidden");
});
customerProfileForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!auth?.token) {
    showLogin();
    return;
  }
  const c = readCustomerProfile();
  if (!c.name) {
    setStatus("Customer name is required", "err");
    return;
  }
  saveProfileBtn.disabled = true;
  setStatus("Saving customer profile\u2026", "busy");
  try {
    const ret = await invokeString("API_SaveCustomerProfile", [
      auth.token,
      c.name,
      c.email,
      c.phone,
      c.notes,
      c.cust_street,
      c.cust_postal,
      c.cust_city,
      c.cust_municipality,
      c.cust_country
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    setStatus("Customer profile saved", "ok");
    if (!auth.must_change_password) profilePanelEl.classList.add("hidden");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    saveProfileBtn.disabled = false;
  }
});
passwordForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!auth?.token) {
    showLogin();
    return;
  }
  const fd = new FormData(passwordForm);
  const currentPassword = String(fd.get("current_password") ?? "");
  const newPassword = String(fd.get("new_password") ?? "");
  const confirmPassword = String(fd.get("confirm_password") ?? "");
  if (newPassword !== confirmPassword) {
    setStatus("New passwords do not match", "err");
    return;
  }
  changePwBtn.disabled = true;
  setStatus("Updating password\u2026", "busy");
  try {
    const ret = await invokeString("API_ChangePassword", [auth.token, currentPassword, newPassword]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    auth = { ...auth, must_change_password: false };
    storeAuth2(auth);
    profilePwWarningEl.classList.add("hidden");
    setStatus("Password updated", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    changePwBtn.disabled = false;
  }
});
projectForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!auth?.token) {
    showLogin();
    return;
  }
  const c = readCustomerProfile();
  if (!c.name) {
    setStatus("Set your customer name under Profile before saving a project", "err");
    profilePanelEl.classList.remove("hidden");
    return;
  }
  saveBtn.disabled = true;
  setStatus("Saving project\u2026", "busy");
  try {
    const p = readProjectForm();
    const projectId = projectIdInput.value.trim();
    const ret = await invokeString("API_SaveBuildingEntry", [
      auth.token,
      c.name,
      c.email,
      c.phone,
      c.notes,
      c.cust_street,
      c.cust_postal,
      c.cust_city,
      c.cust_municipality,
      c.cust_country,
      p.dwell_street,
      p.dwell_postal,
      p.dwell_city,
      p.dwell_municipality,
      p.dwell_country,
      p.label,
      p.external_ref,
      projectId
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      if (ret.includes("login") || ret.includes("session")) showLogin();
      return;
    }
    const parsed = JSON.parse(ret);
    lastProjectId = parsed.project_id ?? parsed.building_id ?? null;
    if (lastProjectId) projectIdInput.value = lastProjectId;
    reloadBtn.disabled = !lastProjectId;
    projectDetailPanel.classList.remove("hidden");
    projectDetailTitle.textContent = projectTitle({
      label: p.label,
      external_ref: p.external_ref,
      dwell_street: p.dwell_street
    });
    setStatus(projectId ? "Project updated" : "Project created", "ok");
    setProjectEditingState("INITIAL_REQUEST");
    await refreshProjectList();
    highlightSelectedProject(lastProjectId);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    saveBtn.disabled = currentProjectStatus !== null && currentProjectStatus !== "INITIAL_REQUEST";
  }
});
reloadBtn.addEventListener("click", async () => {
  if (!lastProjectId || !auth?.token) return;
  reloadBtn.disabled = true;
  setStatus("Reloading\u2026", "busy");
  try {
    const ret = await invokeString("API_OpenBuilding", [auth.token, lastProjectId]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    fillProjectFromOpen(JSON.parse(ret));
    setStatus("Project reloaded", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    reloadBtn.disabled = !lastProjectId;
  }
});
newProjectBtn.addEventListener("click", () => {
  clearProjectFields();
  projectDetailPanel.classList.remove("hidden");
  setStatus("New project \u2014 set customer details under Profile if needed", "ok");
});
deleteProjectBtn.addEventListener("click", async () => {
  if (!lastProjectId || !auth?.token || currentProjectStatus !== "INITIAL_REQUEST") return;
  if (!window.confirm("Delete this project? This cannot be undone.")) return;
  deleteProjectBtn.disabled = true;
  setStatus("Deleting project\u2026", "busy");
  try {
    const ret = await invokeString("API_DeleteProject", [auth.token, lastProjectId]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    projectDetailPanel.classList.add("hidden");
    clearProjectFields();
    await refreshProjectList();
    setStatus("Project deleted", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    deleteProjectBtn.disabled = true;
  }
});
refreshListBtn.addEventListener("click", async () => {
  refreshListBtn.disabled = true;
  try {
    await refreshProjectList();
    if (lastProjectId) await refreshProjectDocuments();
    setStatus("Project list refreshed", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    refreshListBtn.disabled = false;
  }
});
drawingFileInput.addEventListener("change", async () => {
  const files = drawingFileInput.files;
  const projectId = activeProjectId();
  if (!files?.length || !auth?.token || !projectId) return;
  if (currentProjectStatus && currentProjectStatus !== "INITIAL_REQUEST") {
    setStatus("Drawings can only be uploaded while project status is Initial request", "err");
    drawingFileInput.value = "";
    return;
  }
  drawingFileInput.disabled = true;
  setStatus("Uploading drawings\u2026", "busy");
  try {
    for (const file of [...files]) {
      await uploadDrawingFile(file);
    }
    await refreshProjectDocuments();
    setStatus(`Uploaded ${files.length} drawing${files.length === 1 ? "" : "s"}`, "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    drawingFileInput.value = "";
    drawingFileInput.disabled = currentProjectStatus !== null && currentProjectStatus !== "INITIAL_REQUEST";
  }
});
submitDrawingsBtn.addEventListener("click", () => {
  void submitDrawingsForReview();
});
downloadReportBtn.addEventListener("click", () => {
  if (currentProjectStatus !== "PROJECT_FINISHED") return;
  setStatus(
    "Report download will be available once concept v1.0 storage is connected. Status already shows the report as ready.",
    "ok"
  );
});
bootstrapSession().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});
