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

// src/app.ts
var AUTH_KEY = "app_gevelwering_auth";
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
var methodBtn = document.getElementById("method-btn");
var methodPanelEl = document.getElementById("method-panel");
var methodCloseBtn = document.getElementById("method-close-btn");
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
var projectReportHintEl = document.getElementById("project-report-hint");
var downloadReportBtn = document.getElementById("download-report-btn");
var emailReportBtn = document.getElementById("email-report-btn");
var inboxPanelEl = document.getElementById("inbox-panel");
var inboxListEl = document.getElementById("inbox-list");
var inboxEmptyEl = document.getElementById("inbox-empty");
var inboxBadgeEl = document.getElementById("inbox-badge");
var cachedReports = [];
var cachedInbox = [];
var activeInboxItem = null;
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
      return "Project gestart \u2014 tekeningen uploaden";
    case "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED":
      return "Tekeningen ingediend \u2014 wacht op acceptatie";
    case "PROJECT_UNDERWAY":
      return "Tekeningen geaccepteerd \u2014 berekening loopt";
    case "PROJECT_NEAR_FINAL":
      return "Berekening bijna afgerond";
    case "PROJECT_FINISHED":
      return "Rapport gereed (concept v1.0)";
    default:
      return status || "Onbekend";
  }
}
var PROGRESS_STEPS = [
  { key: "INITIAL_REQUEST", title: "Project gestart", short: "Gestart" },
  { key: "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED", title: "Tekeningen ingediend", short: "Ingediend" },
  { key: "PROJECT_UNDERWAY", title: "Tekeningen geaccepteerd", short: "Geaccepteerd" },
  { key: "PROJECT_NEAR_FINAL", title: "Bijna afgerond", short: "Bijna klaar" },
  { key: "PROJECT_FINISHED", title: "Rapport gereed", short: "Rapport" }
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
    INITIAL_REQUEST: "Volgende stap: upload tekeningen en dien ze in ter beoordeling.",
    PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED: "Een ingenieur controleert of uw tekeningen als basis voor de berekening kunnen dienen.",
    PROJECT_UNDERWAY: "Uw tekeningen zijn geaccepteerd. De berekening is gestart.",
    PROJECT_NEAR_FINAL: "De berekening is bijna afgerond. Het conceptrapport volgt binnenkort.",
    PROJECT_FINISHED: "Afgerond \u2014 uw rapportage is vrijgegeven."
  };
  projectProgressCaptionEl.textContent = captions[status] || statusLabel(status);
  void refreshProjectInbox();
}
function kindLabel(kind) {
  return kind === "definitief" ? "definitieve" : "concept";
}
function renderInboxMessage(item) {
  const label = kindLabel(item.report_kind);
  return `De ${label} rapportage (PDF) is beschikbaar. <a href="#" id="inbox-fetch-link">PDF ophalen</a> (of <a href="#" id="inbox-email-link">laten e-mailen</a>).`;
}
function bindInboxMessageLinks() {
  const fetchLink = document.getElementById("inbox-fetch-link");
  const emailLink = document.getElementById("inbox-email-link");
  fetchLink?.addEventListener("click", (ev) => {
    ev.preventDefault();
    downloadReportBtn.click();
  });
  emailLink?.addEventListener("click", (ev) => {
    ev.preventDefault();
    emailReportBtn?.click();
  });
}
async function refreshGlobalInbox() {
  if (!auth?.token || !inboxPanelEl || !inboxListEl) return;
  const res = await fetch("/api/reports/inbox", {
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    return;
  }
  if (!res.ok || !parsed.ok) return;
  cachedInbox = parsed.items ?? [];
  inboxPanelEl.hidden = false;
  inboxListEl.innerHTML = "";
  const unread = parsed.unread_count ?? cachedInbox.filter((i) => i.unread).length;
  if (inboxBadgeEl) {
    if (unread > 0) {
      inboxBadgeEl.hidden = false;
      inboxBadgeEl.textContent = String(unread);
    } else {
      inboxBadgeEl.hidden = true;
    }
  }
  if (inboxEmptyEl) inboxEmptyEl.classList.toggle("hidden", cachedInbox.length > 0);
  for (const item of cachedInbox) {
    const li = document.createElement("li");
    li.className = `inbox-list-item${item.unread ? " unread" : ""}`;
    const title = item.building_label || item.building_id.slice(0, 8);
    const when = item.published_at ? new Date(item.published_at).toLocaleString("nl-NL") : "";
    li.innerHTML = `
      <strong>${escapeHtml(title)}</strong> \u2014 ${escapeHtml(kindLabel(item.report_kind))} v${escapeHtml(item.version_label)}
      <div class="inbox-item-meta">${escapeHtml(when)}</div>
      <p class="hint" style="margin:0.4rem 0 0">${escapeHtml(item.message)}</p>
    `;
    const actions = document.createElement("div");
    actions.className = "actions";
    const dlBtn = document.createElement("button");
    dlBtn.type = "button";
    dlBtn.textContent = "PDF ophalen";
    dlBtn.title = item.filename.endsWith(".pdf") ? item.filename : item.filename.replace(/\.html$/i, ".pdf");
    dlBtn.addEventListener("click", () => {
      void downloadInboxItem(item).catch((err) => {
        setStatus(err instanceof Error ? err.message : String(err), "err");
      });
    });
    const emailBtn = document.createElement("button");
    emailBtn.type = "button";
    emailBtn.className = "secondary";
    emailBtn.textContent = "E-mailen";
    emailBtn.addEventListener("click", () => {
      void requestInboxEmail(item).catch((err) => {
        setStatus(err instanceof Error ? err.message : String(err), "err");
      });
    });
    actions.appendChild(dlBtn);
    actions.appendChild(emailBtn);
    li.appendChild(actions);
    inboxListEl.appendChild(li);
  }
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
async function refreshProjectInbox() {
  cachedReports = [];
  activeInboxItem = null;
  downloadReportBtn.disabled = true;
  if (emailReportBtn) emailReportBtn.disabled = true;
  const projectId = activeProjectId();
  if (!auth?.token || !projectId) {
    projectReportSlotEl.hidden = true;
    return;
  }
  const res = await fetch(`/api/reports/inbox?building_id=${encodeURIComponent(projectId)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    if (projectReportHintEl) {
      projectReportHintEl.textContent = `Inbox laden mislukt (HTTP ${res.status})`;
    }
    projectReportSlotEl.hidden = false;
    return;
  }
  if (!res.ok || !parsed.ok) {
    if (projectReportHintEl) {
      projectReportHintEl.textContent = parsed.error || `Inbox laden mislukt (HTTP ${res.status})`;
    }
    projectReportSlotEl.hidden = false;
    return;
  }
  const items = parsed.items ?? [];
  activeInboxItem = items[0] ?? null;
  if (!activeInboxItem) {
    if (currentProjectStatus === "PROJECT_FINISHED") {
      await refreshProjectReportsLegacy();
      return;
    }
    projectReportSlotEl.hidden = true;
    return;
  }
  projectReportSlotEl.hidden = false;
  downloadReportBtn.disabled = false;
  if (emailReportBtn) emailReportBtn.disabled = false;
  if (projectReportHintEl) {
    projectReportHintEl.innerHTML = renderInboxMessage(activeInboxItem);
    bindInboxMessageLinks();
  }
  if (activeInboxItem.unread) {
    void markInboxRead(activeInboxItem.inbox_id);
  }
}
async function refreshProjectReportsLegacy() {
  const projectId = activeProjectId();
  if (!auth?.token || !projectId) {
    projectReportSlotEl.hidden = true;
    return;
  }
  const res = await fetch(`/api/reports/list?building_id=${encodeURIComponent(projectId)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth.token)
  });
  let parsed;
  try {
    parsed = await res.json();
  } catch {
    projectReportSlotEl.hidden = true;
    return;
  }
  if (!res.ok || !parsed.ok) {
    projectReportSlotEl.hidden = true;
    return;
  }
  cachedReports = parsed.reports ?? [];
  const latest = cachedReports.find((r) => r.filename.endsWith(".pdf")) || cachedReports.find((r) => r.filename.endsWith(".html")) || cachedReports[0];
  if (!latest) {
    projectReportSlotEl.hidden = true;
    return;
  }
  projectReportSlotEl.hidden = false;
  downloadReportBtn.disabled = false;
  if (emailReportBtn) emailReportBtn.disabled = true;
  if (projectReportHintEl) {
    const label = latest.filename.endsWith(".pdf") ? latest.filename : latest.filename.replace(/\.html$/i, ".pdf");
    projectReportHintEl.textContent = `PDF-rapport gereed: ${label}`;
  }
}
async function markInboxRead(inboxId) {
  if (!auth?.token) return;
  try {
    await fetch("/api/reports/inbox/read", {
      method: "POST",
      credentials: "include",
      headers: apiAuthHeaders(auth.token, true),
      body: JSON.stringify({ inbox_id: inboxId })
    });
    await refreshGlobalInbox();
  } catch {
  }
}
function downloadNameFromResponse(res, fallback) {
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename="([^"]+)"/i.exec(cd);
  if (m?.[1]) return m[1];
  if (fallback.endsWith(".html")) return fallback.replace(/\.html$/i, ".pdf");
  return fallback;
}
async function downloadInboxItem(item) {
  if (!auth?.token) return;
  const res = await fetch(
    `/api/reports/download?building_id=${encodeURIComponent(item.building_id)}&file=${encodeURIComponent(item.filename)}&inbox_id=${encodeURIComponent(item.inbox_id)}`,
    { credentials: "include", headers: apiAuthHeaders(auth.token) }
  );
  if (!res.ok) {
    let err = `Download mislukt (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j.error) err = j.error;
    } catch {
    }
    throw new Error(err);
  }
  const blob = await res.blob();
  const downloadName = downloadNameFromResponse(res, item.filename);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus(`PDF gedownload: ${downloadName}`, "ok");
  await refreshGlobalInbox();
  if (activeProjectId() === item.building_id) await refreshProjectInbox();
}
async function requestInboxEmail(item) {
  if (!auth?.token) return;
  const res = await fetch("/api/reports/inbox/email-request", {
    method: "POST",
    credentials: "include",
    headers: apiAuthHeaders(auth.token, true),
    body: JSON.stringify({ inbox_id: item.inbox_id })
  });
  const parsed = await res.json();
  if (!res.ok || !parsed.ok) {
    throw new Error(parsed.error || `E-mailaanvraag mislukt (HTTP ${res.status})`);
  }
  setStatus(parsed.note || "E-mailaanvraag geregistreerd", "ok");
  await refreshGlobalInbox();
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
  return "Naamloos project";
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
  methodPanelEl.classList.add("hidden");
  projectDetailPanel.classList.add("hidden");
  profilePwWarningEl.classList.add("hidden");
  setAuthTab("signin");
  pageTitle.textContent = "Opdrachtgever";
  pageLede.textContent = "Log in om uw akoestische projecten te beheren.";
  document.title = "Geluidwering Gevels \u2014 Opdrachtgever";
}
async function showApp(info) {
  auth = info;
  storeAuth2(info);
  loginPanel.classList.add("hidden");
  appPanel.classList.remove("hidden");
  projectDetailPanel.classList.add("hidden");
  const label = info.display_name || info.username;
  userLabel.textContent = `Ingelogd als ${label}`;
  profileServiceEmailEl.textContent = info.email ? `Account-e-mail: ${info.email}` : "Geen account-e-mail ingesteld.";
  const mustChange = !!info.must_change_password;
  profilePwWarningEl.classList.toggle("hidden", !mustChange);
  profilePanelEl.classList.toggle("hidden", !mustChange);
  methodPanelEl.classList.add("hidden");
  pageTitle.textContent = "Projecten";
  pageLede.textContent = "Uw lopende akoestische projecten. Klantgegevens beheert u onder Profiel.";
  document.title = "Geluidwering Gevels \u2014 Projecten";
  await loadCustomerProfile();
  await refreshProjectList();
  await refreshGlobalInbox();
}
function send(type, payload, wantType) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("Geen verbinding met de server"));
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
    throw new Error(`Onverwacht antwoord van ${target}: ${JSON.stringify(inv.payload)}`);
  }
  if (ret === "") {
    throw new Error(
      `${target} gaf een leeg antwoord \u2014 bestand mogelijk te groot; probeer een kleinere tekening of herstart de server`
    );
  }
  return ret;
}
async function bootstrapSession() {
  setStatus(`Verbinden met ${BPP_WS}\u2026`, "busy");
  ws = new WebSocket(BPP_WS);
  setConnLed(false);
  await new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("Verbinding time-out")), 8e3);
    ws.onopen = () => {
      window.clearTimeout(t);
      setConnLed(true);
      resolve();
    };
    ws.onerror = () => {
      window.clearTimeout(t);
      setConnLed(false);
      reject(new Error("Verbinding mislukt \u2014 draait de server op poort 18080?"));
    };
  });
  ws.onmessage = (ev) => onMessage(String(ev.data));
  ws.onclose = () => {
    setConnLed(false);
    setStatus("Verbinding verbroken", "err");
  };
  await send("session.open", { client_name: "app-gevelwering-web", client_version: "0.2.0" }, "session.opened");
  const load = await send(
    "exec.request",
    { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' },
    "exec.completed"
  );
  if (load.type === "error") throw new Error(`Laden API mislukt: ${JSON.stringify(load.payload)}`);
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`Opstarten mislukt: ${bootRet}`);
  setStatus(`Verbonden \xB7 sessie ${sessionId ?? "?"}`, "ok");
  const stored = loadStoredAuth();
  if (stored) {
    const validated = await invokeString("API_ValidateSession", [stored.token]);
    if (validated.startsWith("ERROR")) {
      showLogin();
      setStatus("Vorige sessie verlopen \u2014 log opnieuw in", "err");
      return;
    }
    const info = JSON.parse(validated);
    await showApp(info);
    if (!lastProjectId) setStatus(`Ingelogd als ${info.display_name || info.username}`, "ok");
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
    drawingUploadHintEl.textContent = "Sla het project eerst op, upload daarna PDF- of DWG-tekeningen.";
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
    drawingUploadHintEl.textContent = `Tekeningen laden mislukt (HTTP ${res.status})`;
    return;
  }
  if (!res.ok || !parsed.ok) {
    drawingUploadHintEl.textContent = parsed.error || `Tekeningen laden mislukt (HTTP ${res.status})`;
    return;
  }
  const docs = parsed.documents ?? [];
  updateSubmitDrawingsButton(docs.length);
  if (docs.length === 0) {
    drawingUploadHintEl.textContent = "Nog geen tekeningen ge\xFCpload.";
    return;
  }
  drawingUploadHintEl.textContent = docs.length === 1 ? "1 tekening ge\xFCpload." : `${docs.length} tekeningen ge\xFCpload.`;
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
      btn.textContent = "Verwijderen";
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
  if (!auth?.token || !projectId) throw new Error("Selecteer of sla eerst een project op");
  lastProjectId = projectId;
  const ext = fileExtension(file.name);
  if (ext !== "pdf" && ext !== "dwg") throw new Error(`${file.name}: alleen PDF- en DWG-bestanden zijn toegestaan`);
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
    throw new Error(`${file.name}: ongeldig serverantwoord (HTTP ${res.status})`);
  }
  if (!res.ok || !parsed.ok) {
    throw new Error(`${file.name}: ${parsed.error || res.statusText || `HTTP ${res.status}`}`);
  }
}
async function deleteDrawing(documentId) {
  if (!auth?.token || !window.confirm("Deze tekening verwijderen?")) return;
  setStatus("Tekening verwijderen\u2026", "busy");
  const ret = await invokeString("API_DeleteDrawing", [auth.token, documentId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  await refreshProjectDocuments();
  setStatus("Tekening verwijderd", "ok");
}
function updateSubmitDrawingsButton(drawingCount = 0) {
  const canSubmit = Boolean(activeProjectId()) && currentProjectStatus === "INITIAL_REQUEST" && drawingCount > 0;
  submitDrawingsBtn.disabled = !canSubmit;
}
async function submitDrawingsForReview() {
  const projectId = activeProjectId();
  if (!auth?.token || !projectId) return;
  if (!window.confirm(
    "Tekeningen indienen ter beoordeling door de ingenieur? Daarna kunt u dit project niet meer uploaden of wijzigen."
  )) {
    return;
  }
  setStatus("Tekeningen indienen\u2026", "busy");
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
  setStatus("Tekeningen ingediend \u2014 een ingenieur beoordeelt ze", "ok");
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
    projectStatusViewEl.textContent = `${statusLabel(status)} \u2014 u kunt dit project nog wijzigen of verwijderen.`;
    drawingFileInput.disabled = !lastProjectId;
  } else {
    projectStatusViewEl.textContent = "Vul het adres van de woning in en sla op om een nieuw project te maken.";
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
  projectDetailTitle.textContent = "Nieuw project";
  drawingListEl.innerHTML = "";
  drawingFileInput.value = "";
  drawingFileInput.disabled = true;
  drawingUploadHintEl.textContent = "Sla het project eerst op, upload daarna PDF- of DWG-tekeningen.";
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
  void refreshGlobalInbox();
}
async function openProject(id) {
  if (!auth?.token) return;
  setStatus("Project laden\u2026", "busy");
  try {
    const ret = await invokeString("API_OpenBuilding", [auth.token, id]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      if (ret.includes("login") || ret.includes("session")) showLogin();
      return;
    }
    fillProjectFromOpen(JSON.parse(ret));
    setStatus("Project geladen", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
}
loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  loginBtn.disabled = true;
  setStatus("Inloggen\u2026", "busy");
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
    if (!lastProjectId) setStatus(`Ingelogd als ${info.display_name || info.username}`, "ok");
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
  setStatus("Uitgelogd", "ok");
  lastProjectId = null;
  currentProjectStatus = null;
});
tabSigninBtn.addEventListener("click", () => setAuthTab("signin"));
tabRegisterBtn.addEventListener("click", () => setAuthTab("register"));
registerForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  registerBtn.disabled = true;
  setStatus("Toegang aanvragen\u2026", "busy");
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
    registerMessageEl.textContent = parsed.message || "Toegangsaanvraag ingediend.";
    accessPasswordCodeEl.textContent = parsed.access_password;
    registerResultEl.classList.remove("hidden");
    setStatus("Toegang aangevraagd", "ok");
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
  setStatus("Log in met het verstrekte wachtwoord", "ok");
});
profileBtn.addEventListener("click", () => {
  methodPanelEl.classList.add("hidden");
  profilePanelEl.classList.remove("hidden");
  profilePwWarningEl.classList.toggle("hidden", !auth?.must_change_password);
  void loadCustomerProfile();
});
methodBtn.addEventListener("click", () => {
  if (auth?.must_change_password) return;
  profilePanelEl.classList.add("hidden");
  methodPanelEl.classList.remove("hidden");
  methodPanelEl.querySelector(".method-scroll")?.focus();
});
methodCloseBtn.addEventListener("click", () => {
  methodPanelEl.classList.add("hidden");
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
    setStatus("Klantnaam is verplicht", "err");
    return;
  }
  saveProfileBtn.disabled = true;
  setStatus("Klantprofiel opslaan\u2026", "busy");
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
    setStatus("Klantprofiel opgeslagen", "ok");
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
    setStatus("Nieuwe wachtwoorden komen niet overeen", "err");
    return;
  }
  changePwBtn.disabled = true;
  setStatus("Wachtwoord bijwerken\u2026", "busy");
  try {
    const ret = await invokeString("API_ChangePassword", [auth.token, currentPassword, newPassword]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    auth = { ...auth, must_change_password: false };
    storeAuth2(auth);
    profilePwWarningEl.classList.add("hidden");
    setStatus("Wachtwoord bijgewerkt", "ok");
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
    setStatus("Stel onder Profiel eerst uw klantnaam in voordat u een project opslaat", "err");
    profilePanelEl.classList.remove("hidden");
    return;
  }
  saveBtn.disabled = true;
  setStatus("Project opslaan\u2026", "busy");
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
    setStatus(projectId ? "Project bijgewerkt" : "Project aangemaakt", "ok");
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
  setStatus("Herladen\u2026", "busy");
  try {
    const ret = await invokeString("API_OpenBuilding", [auth.token, lastProjectId]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    fillProjectFromOpen(JSON.parse(ret));
    setStatus("Project herladen", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    reloadBtn.disabled = !lastProjectId;
  }
});
newProjectBtn.addEventListener("click", () => {
  clearProjectFields();
  projectDetailPanel.classList.remove("hidden");
  setStatus("Nieuw project \u2014 stel zo nodig klantgegevens in onder Profiel", "ok");
});
deleteProjectBtn.addEventListener("click", async () => {
  if (!lastProjectId || !auth?.token || currentProjectStatus !== "INITIAL_REQUEST") return;
  if (!window.confirm("Dit project verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
  deleteProjectBtn.disabled = true;
  setStatus("Project verwijderen\u2026", "busy");
  try {
    const ret = await invokeString("API_DeleteProject", [auth.token, lastProjectId]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    projectDetailPanel.classList.add("hidden");
    clearProjectFields();
    await refreshProjectList();
    setStatus("Project verwijderd", "ok");
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
    setStatus("Projectlijst vernieuwd", "ok");
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
    setStatus("Tekeningen kunnen alleen worden ge\xFCpload zolang het project nog niet is ingediend", "err");
    drawingFileInput.value = "";
    return;
  }
  drawingFileInput.disabled = true;
  setStatus("Tekeningen uploaden\u2026", "busy");
  try {
    for (const file of [...files]) {
      await uploadDrawingFile(file);
    }
    await refreshProjectDocuments();
    setStatus(
      files.length === 1 ? "1 tekening ge\xFCpload" : `${files.length} tekeningen ge\xFCpload`,
      "ok"
    );
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
  void (async () => {
    if (!auth?.token) return;
    try {
      if (activeInboxItem) {
        await downloadInboxItem(activeInboxItem);
        return;
      }
      const projectId = activeProjectId();
      const latest = cachedReports.find((r) => r.filename.endsWith(".pdf")) || cachedReports.find((r) => r.filename.endsWith(".html")) || cachedReports[0];
      if (!projectId || !latest) {
        setStatus("Geen rapport beschikbaar om te downloaden", "err");
        return;
      }
      const res = await fetch(
        `/api/reports/download?building_id=${encodeURIComponent(projectId)}&file=${encodeURIComponent(latest.filename)}`,
        { credentials: "include", headers: apiAuthHeaders(auth.token) }
      );
      if (!res.ok) {
        let err = `Download mislukt (HTTP ${res.status})`;
        try {
          const j = await res.json();
          if (j.error) err = j.error;
        } catch {
        }
        setStatus(err, "err");
        return;
      }
      const blob = await res.blob();
      const downloadName = downloadNameFromResponse(res, latest.filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(`PDF gedownload: ${downloadName}`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
    }
  })();
});
emailReportBtn?.addEventListener("click", () => {
  void (async () => {
    if (!activeInboxItem) {
      setStatus("Geen inbox-rapport om te e-mailen", "err");
      return;
    }
    try {
      await requestInboxEmail(activeInboxItem);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
    }
  })();
});
bootstrapSession().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});
initPasswordToggles();
