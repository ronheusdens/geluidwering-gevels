/**
 * Acoustics P0 browser client — login, projects, profile.
 */
import { loadAuth, storeAuth as persistAuth, syncSessionCookie, apiAuthHeaders } from "./auth-store";
import { resolveBppWsUrl } from "./ws-url";
import { initPasswordToggles } from "./password-toggle";
import { bppListProjectDocuments, bppPhase1Enabled } from "./bpp-api";

type Envelope = {
  v: number;
  type: string;
  request_id: string;
  session_id?: string;
  payload?: Record<string, unknown>;
};

type ProjectStatus =
  | "INITIAL_REQUEST"
  | "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED"
  | "PROJECT_UNDERWAY"
  | "PROJECT_NEAR_FINAL"
  | "PROJECT_FINISHED";

type CustomerProfileFields = {
  name: string;
  email: string;
  phone: string;
  notes: string;
  cust_street: string;
  cust_postal: string;
  cust_city: string;
  cust_municipality: string;
  cust_country: string;
};

type ProjectFormFields = {
  dwell_street: string;
  dwell_postal: string;
  dwell_city: string;
  dwell_municipality: string;
  dwell_country: string;
  label: string;
  client_ref: string;
};

type AuthInfo = {
  token: string;
  user_id: string;
  username: string;
  display_name: string;
  email?: string;
  must_change_password?: boolean;
};


type ProjectListItem = {
  id: string;
  label: string;
  client_ref: string;
  external_ref: string;
  project_status: ProjectStatus;
  dwell_street: string;
  dwell_postal: string;
  dwell_city: string;
};

type ProjectDocument = {
  id: string;
  filename: string;
  file_ext: string;
  byte_size: string;
  created_at: string;
};

const AUTH_KEY = "app_gevelwering_auth";
const LAST_USERNAME_KEY = "app_gevelwering_last_username";
const BPP_WS = resolveBppWsUrl();
const STILTE_PORTAL_PROFILE_URL =
  (window as unknown as { STILTE_PORTAL_PROFILE_URL?: string }).STILTE_PORTAL_PROFILE_URL ||
  "http://127.0.0.1:4174/opdrachtgever.html#profiel";
const STILTE_PORTAL_INBOX_URL =
  (window as unknown as { STILTE_PORTAL_INBOX_URL?: string }).STILTE_PORTAL_INBOX_URL ||
  "http://127.0.0.1:4174/opdrachtgever.html#inbox";

function loadRememberedUsername(): string {
  try {
    return (localStorage.getItem(LAST_USERNAME_KEY) || "").trim();
  } catch {
    return "";
  }
}

function rememberUsername(username: string): void {
  const u = username.trim();
  if (!u) return;
  try {
    localStorage.setItem(LAST_USERNAME_KEY, u);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Prefill login fields: last user, or demo defaults for first visit. */
function applyRememberedLoginFields(): void {
  const uEl = loginForm.elements.namedItem("username");
  const pEl = loginForm.elements.namedItem("password");
  if (!(uEl instanceof HTMLInputElement) || !(pEl instanceof HTMLInputElement)) return;
  const remembered = loadRememberedUsername();
  if (remembered) {
    uEl.value = remembered;
    // Demo convenience only — never persist passwords for other accounts.
    pEl.value = remembered === "demo" ? "demo" : "";
  } else {
    uEl.value = "demo";
    pEl.value = "demo";
  }
}

const connBarEl = document.getElementById("conn-bar") as HTMLElement;
const connLedEl = document.getElementById("conn-led") as HTMLElement;
const statusEl = document.getElementById("conn-status") as HTMLElement;
const loginPanel = document.getElementById("login-panel") as HTMLElement;
const appPanel = document.getElementById("app-panel") as HTMLElement;
const loginForm = document.getElementById("login-form") as HTMLFormElement;
const registerForm = document.getElementById("register-form") as HTMLFormElement;
const projectForm = document.getElementById("project-form") as HTMLFormElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const registerBtn = document.getElementById("register-btn") as HTMLButtonElement;
const gotoSigninBtn = document.getElementById("goto-signin-btn") as HTMLButtonElement;
const registerResultEl = document.getElementById("register-result") as HTMLElement;
const registerMessageEl = document.getElementById("register-message") as HTMLElement;
const accessPasswordCodeEl = document.getElementById("access-password") as HTMLElement;
const logoutBtn = document.getElementById("logout-btn") as HTMLButtonElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const reloadBtn = document.getElementById("reload-btn") as HTMLButtonElement;
const tabSigninBtn = document.getElementById("tab-signin") as HTMLButtonElement;
const tabRegisterBtn = document.getElementById("tab-register") as HTMLButtonElement;
const pageTitle = document.getElementById("page-title") as HTMLElement;
const pageLede = document.getElementById("page-lede") as HTMLElement;
const projectListEl = document.getElementById("project-list") as HTMLUListElement;
const projectListEmptyEl = document.getElementById("project-list-empty") as HTMLElement;
const newProjectBtn = document.getElementById("new-project-btn") as HTMLButtonElement;
const deleteProjectBtn = document.getElementById("delete-project-btn") as HTMLButtonElement;
const refreshListBtn = document.getElementById("refresh-list-btn") as HTMLButtonElement;
const projectIdInput = document.getElementById("project-id-input") as HTMLInputElement;
const projectStatusViewEl = document.getElementById("project-status-view") as HTMLElement;
const projectDetailPanel = document.getElementById("project-detail-panel") as HTMLElement;
const projectDetailTitle = document.getElementById("project-detail-title") as HTMLElement;
const profilePortalLink = document.getElementById("profile-portal-link") as HTMLAnchorElement;
const profilePortalBanner = document.getElementById("profile-portal-banner") as HTMLElement;
const methodBtn = document.getElementById("method-btn") as HTMLButtonElement;
const methodPanelEl = document.getElementById("method-panel") as HTMLElement;
const methodCloseBtn = document.getElementById("method-close-btn") as HTMLButtonElement;
const drawingFileInput = document.getElementById("drawing-file-input") as HTMLInputElement;
const drawingPickedEl = document.getElementById("drawing-picked") as HTMLElement;
const drawingListEl = document.getElementById("drawing-list") as HTMLUListElement;
const drawingUploadHintEl = document.getElementById("drawing-upload-hint") as HTMLElement;
const submitDrawingsBtn = document.getElementById("submit-drawings-btn") as HTMLButtonElement;
const projectProgressEl = document.getElementById("project-progress") as HTMLElement;
const projectProgressStepsEl = document.getElementById("project-progress-steps") as HTMLOListElement;
const projectProgressCaptionEl = document.getElementById("project-progress-caption") as HTMLElement;
const projectReportSlotEl = document.getElementById("project-report-slot") as HTMLElement;
const projectReportHintEl = document.getElementById("project-report-hint") as HTMLElement | null;
const downloadResultsBtn = document.getElementById("download-results-btn") as HTMLButtonElement;
const downloadRapportageBtn = document.getElementById("download-rapportage-btn") as HTMLButtonElement | null;
const emailReportBtn = document.getElementById("email-report-btn") as HTMLButtonElement | null;
const inboxPanelEl = document.getElementById("inbox-panel") as HTMLElement | null;
const inboxListEl = document.getElementById("inbox-list") as HTMLUListElement | null;
const inboxEmptyEl = document.getElementById("inbox-empty") as HTMLElement | null;
const inboxBadgeEl = document.getElementById("inbox-badge") as HTMLElement | null;

type ProjectReport = {
  filename: string;
  byte_size: number;
  modified_at: string;
  content_hash: string;
};

type InboxItem = {
  inbox_id: string;
  building_id: string;
  building_label: string;
  filename: string;
  report_kind: "concept" | "definitief" | string;
  version_label: string;
  message: string;
  published_at: string;
  read_at: string | null;
  downloaded_at: string | null;
  email_requested_at: string | null;
  unread: boolean;
};

let cachedReports: ProjectReport[] = [];
let cachedInbox: InboxItem[] = [];
let activeInboxItem: InboxItem | null = null;

let ws: WebSocket | null = null;
let sessionId: string | null = null;
let reqCounter = 0;
let lastProjectId: string | null = null;
let currentProjectStatus: ProjectStatus | null = null;
let auth: AuthInfo | null = null;
let issuedAccessPassword: string | null = null;
let issuedAccessUsername: string | null = null;
let cachedProjects: ProjectListItem[] = [];
let cachedCustomerProfile: CustomerProfileFields | null = null;
const pending = new Map<
  string,
  { resolve: (env: Envelope) => void; reject: (err: Error) => void; want: string }
>();

function setStatus(text: string, kind: "busy" | "ok" | "err" = "busy"): void {
  statusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}

function setConnLed(connected: boolean): void {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}

function setAuthTab(tab: "signin" | "register"): void {
  tabSigninBtn.classList.toggle("active", tab === "signin");
  tabRegisterBtn.classList.toggle("active", tab === "register");
  loginForm.classList.toggle("hidden", tab !== "signin");
  registerForm.classList.toggle("hidden", tab !== "register");
  registerResultEl.classList.add("hidden");
}

function statusLabel(status?: string): string {
  switch (status) {
    case "INITIAL_REQUEST":
      return "Project gestart — tekeningen uploaden";
    case "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED":
      return "Tekeningen ingediend — wacht op acceptatie";
    case "PROJECT_UNDERWAY":
      return "Tekeningen geaccepteerd — berekening loopt";
    case "PROJECT_NEAR_FINAL":
      return "Uitvoering bezig";
    case "PROJECT_FINISHED":
      return "Rapport gereed (concept v1.0)";
    default:
      return status || "Onbekend";
  }
}

/** Customer-facing progress facets (left → right toward downloadable report). */
const PROGRESS_STEPS: { key: ProjectStatus; title: string; short: string }[] = [
  { key: "INITIAL_REQUEST", title: "Project gestart", short: "Gestart" },
  { key: "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED", title: "Tekeningen ingediend", short: "Ingediend" },
  { key: "PROJECT_UNDERWAY", title: "Tekeningen geaccepteerd", short: "Geaccepteerd" },
  { key: "PROJECT_NEAR_FINAL", title: "Uitvoering bezig", short: "Uitvoering bezig" },
  { key: "PROJECT_FINISHED", title: "Rapport gereed", short: "Rapport" },
];

function progressIndex(status: ProjectStatus | null | undefined): number {
  if (!status) return -1;
  const idx = PROGRESS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : -1;
}

function renderProjectProgress(status: ProjectStatus | null): void {
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

  const captions: Record<ProjectStatus, string> = {
    INITIAL_REQUEST: "Volgende stap: upload tekeningen en dien ze in ter beoordeling.",
    PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED:
      "Een ingenieur controleert of uw tekeningen als basis voor de berekening kunnen dienen.",
    PROJECT_UNDERWAY: "Uw tekeningen zijn geaccepteerd. De berekening is gestart.",
    PROJECT_NEAR_FINAL: "Uitvoering bezig — het conceptrapport volgt binnenkort.",
    PROJECT_FINISHED: "Afgerond — uw rapportage is vrijgegeven.",
  };
  projectProgressCaptionEl.textContent = captions[status] || statusLabel(status);

  void refreshProjectInbox();
}

function kindLabel(kind: string): string {
  return kind === "definitief" ? "definitieve" : "concept";
}

function renderInboxMessage(item: InboxItem): string {
  const label = kindLabel(item.report_kind);
  return `De ${label} rekenresultaten zijn beschikbaar. <a href="#" id="inbox-fetch-link">Download rekenresultaten</a> (of <a href="#" id="inbox-email-link">laten e-mailen</a>).`;
}

function bindInboxMessageLinks(): void {
  const fetchLink = document.getElementById("inbox-fetch-link");
  const emailLink = document.getElementById("inbox-email-link");
  fetchLink?.addEventListener("click", (ev) => {
    ev.preventDefault();
    downloadResultsBtn.click();
  });
  emailLink?.addEventListener("click", (ev) => {
    ev.preventDefault();
    emailReportBtn?.click();
  });
}

async function refreshGlobalInbox(): Promise<void> {
  if (!auth?.token || !inboxPanelEl || !inboxListEl) return;
  const res = await fetch("/api/reports/inbox", {
    credentials: "include",
    headers: apiAuthHeaders(auth.token),
  });
  let parsed: { ok?: boolean; error?: string; items?: InboxItem[]; unread_count?: number };
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    return;
  }
  if (!res.ok || !parsed.ok) return;

  cachedInbox = parsed.items ?? [];
  renderGlobalInboxList(parsed.unread_count);
}

function renderGlobalInboxList(unreadCount?: number): void {
  if (!inboxPanelEl || !inboxListEl) return;
  inboxPanelEl.hidden = false;
  inboxListEl.innerHTML = "";
  const unread =
    unreadCount ?? cachedInbox.filter((i) => i.unread).length;
  if (inboxBadgeEl) {
    // Altijd tonen (ook 0): verbergen via [hidden] botste met display:inline-block
    // en liet soms een oude teller staan bij een lege inbox.
    inboxBadgeEl.hidden = false;
    inboxBadgeEl.textContent = String(unread);
    inboxBadgeEl.classList.toggle("is-zero", unread === 0);
    inboxBadgeEl.setAttribute("aria-label", `${unread} ongelezen`);
  }
  if (inboxEmptyEl) inboxEmptyEl.classList.toggle("hidden", cachedInbox.length > 0);

  for (const item of cachedInbox) {
    const li = document.createElement("li");
    li.className = `inbox-list-item${item.unread ? " unread" : ""}`;
    const title = item.building_label || item.building_id.slice(0, 8);
    const when = item.published_at ? new Date(item.published_at).toLocaleString("nl-NL") : "";
    li.innerHTML = `
      <strong>${escapeHtml(title)}</strong> — ${escapeHtml(kindLabel(item.report_kind))} v${escapeHtml(item.version_label)}
      <div class="inbox-item-meta">${escapeHtml(when)}</div>
      <p class="hint" style="margin:0.4rem 0 0">${escapeHtml(item.message)}</p>
    `;
    const actions = document.createElement("div");
    actions.className = "actions";
    // Bij meerdere projecten: direct PDF, geen omweg via «Open project».
    const dlBtn = document.createElement("button");
    dlBtn.type = "button";
    dlBtn.textContent = "Download rekenresultaten";
    dlBtn.title = item.filename.endsWith(".pdf")
      ? item.filename
      : item.filename.replace(/\.html$/i, ".pdf");
    dlBtn.addEventListener("click", () => {
      void downloadInboxItem(item).catch((err) => {
        setStatus(err instanceof Error ? err.message : String(err), "err");
      });
    });
    const rapportBtn = document.createElement("button");
    rapportBtn.type = "button";
    rapportBtn.className = "secondary";
    rapportBtn.textContent = "Download rapportage";
    rapportBtn.disabled = true;
    rapportBtn.title = "Nog niet beschikbaar — volgt later";
    const emailBtn = document.createElement("button");
    emailBtn.type = "button";
    emailBtn.className = "secondary";
    emailBtn.textContent = "E-mailen";
    emailBtn.addEventListener("click", () => {
      void requestInboxEmail(item).catch((err) => {
        setStatus(err instanceof Error ? err.message : String(err), "err");
      });
    });
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "secondary danger";
    delBtn.textContent = "Verwijderen";
    delBtn.title = "Inbox-regel en rapport verwijderen";
    delBtn.addEventListener("click", () => {
      void deleteInboxItem(item).catch((err) => {
        setStatus(err instanceof Error ? err.message : String(err), "err");
      });
    });
    actions.appendChild(dlBtn);
    actions.appendChild(rapportBtn);
    actions.appendChild(emailBtn);
    actions.appendChild(delBtn);
    li.appendChild(actions);
    inboxListEl.appendChild(li);
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function refreshProjectInbox(): Promise<void> {
  cachedReports = [];
  activeInboxItem = null;
  downloadResultsBtn.disabled = true;
  if (downloadRapportageBtn) downloadRapportageBtn.disabled = true;
  if (emailReportBtn) emailReportBtn.disabled = true;

  const projectId = activeProjectId();
  if (!auth?.token || !projectId) {
    projectReportSlotEl.hidden = true;
    return;
  }

  const res = await fetch(`/api/reports/inbox?building_id=${encodeURIComponent(projectId)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth.token),
  });
  let parsed: { ok?: boolean; error?: string; items?: InboxItem[] };
  try {
    parsed = (await res.json()) as typeof parsed;
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
    // Fallback: finished projects may still have files without inbox publish
    if (currentProjectStatus === "PROJECT_FINISHED") {
      await refreshProjectReportsLegacy();
      return;
    }
    projectReportSlotEl.hidden = true;
    return;
  }

  projectReportSlotEl.hidden = false;
  downloadResultsBtn.disabled = false;
  if (downloadRapportageBtn) downloadRapportageBtn.disabled = true;
  if (emailReportBtn) emailReportBtn.disabled = false;
  if (projectReportHintEl) {
    projectReportHintEl.innerHTML = renderInboxMessage(activeInboxItem);
    bindInboxMessageLinks();
  }
  if (activeInboxItem.unread) {
    void markInboxRead(activeInboxItem.inbox_id);
  }
}

async function refreshProjectReportsLegacy(): Promise<void> {
  const projectId = activeProjectId();
  if (!auth?.token || !projectId) {
    projectReportSlotEl.hidden = true;
    return;
  }
  const res = await fetch(`/api/reports/list?building_id=${encodeURIComponent(projectId)}`, {
    credentials: "include",
    headers: apiAuthHeaders(auth.token),
  });
  let parsed: {
    ok?: boolean;
    error?: string;
    reports?: ProjectReport[];
    project_folder?: string;
  };
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    projectReportSlotEl.hidden = true;
    return;
  }
  if (!res.ok || !parsed.ok) {
    projectReportSlotEl.hidden = true;
    return;
  }
  cachedReports = parsed.reports ?? [];
  // Prefer PDF for opdrachtgever download; fall back to HTML (server converts).
  const latest =
    cachedReports.find((r) => r.filename.endsWith(".pdf")) ||
    cachedReports.find((r) => r.filename.endsWith(".html")) ||
    cachedReports[0];
  if (!latest) {
    projectReportSlotEl.hidden = true;
    return;
  }
  projectReportSlotEl.hidden = false;
  downloadResultsBtn.disabled = false;
  if (downloadRapportageBtn) downloadRapportageBtn.disabled = true;
  if (emailReportBtn) emailReportBtn.disabled = true;
  if (projectReportHintEl) {
    const label = latest.filename.endsWith(".pdf")
      ? latest.filename
      : latest.filename.replace(/\.html$/i, ".pdf");
    projectReportHintEl.textContent = `Rekenresultaten gereed: ${label}`;
  }
}

async function markInboxRead(inboxId: string): Promise<void> {
  if (!auth?.token) return;
  try {
    await fetch("/api/reports/inbox/read", {
      method: "POST",
      credentials: "include",
      headers: apiAuthHeaders(auth.token, true),
      body: JSON.stringify({ inbox_id: inboxId }),
    });
    await refreshGlobalInbox();
  } catch {
    /* best-effort */
  }
}

async function deleteInboxItem(item: InboxItem): Promise<void> {
  if (!auth?.token) throw new Error("Niet ingelogd");
  const title = item.building_label || item.building_id.slice(0, 8);
  const label = `${kindLabel(item.report_kind)} v${item.version_label}`;
  if (
    !confirm(
      `Inbox-regel en rapport verwijderen?\n\n${title} — ${label}\n\nDe melding én het rapportbestand verdwijnen.`,
    )
  ) {
    return;
  }
  const res = await fetch("/api/reports/inbox/delete", {
    method: "POST",
    credentials: "include",
    headers: apiAuthHeaders(auth.token, true),
    body: JSON.stringify({ inbox_id: item.inbox_id }),
  });
  let parsed: { ok?: boolean; error?: string };
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    throw new Error(`Verwijderen mislukt (HTTP ${res.status})`);
  }
  if (!res.ok || !parsed.ok) {
    throw new Error(parsed.error || `Verwijderen mislukt (HTTP ${res.status})`);
  }
  if (activeInboxItem?.inbox_id === item.inbox_id) {
    activeInboxItem = null;
  }
  // Direct UI-update (niet wachten op netwerk-refresh).
  cachedInbox = cachedInbox.filter((i) => i.inbox_id !== item.inbox_id);
  renderGlobalInboxList();
  setStatus("Inbox-regel en rapport verwijderd", "ok");
  try {
    await refreshGlobalInbox();
  } catch {
    /* lokale lijst is al bijgewerkt */
  }
  if (activeProjectId() === item.building_id) {
    try {
      await refreshProjectInbox();
    } catch {
      /* ignore */
    }
  }
}

function downloadNameFromResponse(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename="([^"]+)"/i.exec(cd);
  if (m?.[1]) return m[1];
  if (fallback.endsWith(".html")) return fallback.replace(/\.html$/i, ".pdf");
  return fallback;
}

async function downloadInboxItem(item: InboxItem): Promise<void> {
  if (!auth?.token) return;
  const res = await fetch(
    `/api/reports/download?building_id=${encodeURIComponent(item.building_id)}&file=${encodeURIComponent(item.filename)}&inbox_id=${encodeURIComponent(item.inbox_id)}`,
    { credentials: "include", headers: apiAuthHeaders(auth.token) },
  );
  if (!res.ok) {
    let err = `Download mislukt (HTTP ${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) err = j.error;
    } catch {
      /* ignore */
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
  setStatus(`Rekenresultaten gedownload: ${downloadName}`, "ok");
  await refreshGlobalInbox();
  if (activeProjectId() === item.building_id) await refreshProjectInbox();
}

async function requestInboxEmail(item: InboxItem): Promise<void> {
  if (!auth?.token) return;
  const res = await fetch("/api/reports/inbox/email-request", {
    method: "POST",
    credentials: "include",
    headers: apiAuthHeaders(auth.token, true),
    body: JSON.stringify({ inbox_id: item.inbox_id }),
  });
  const parsed = (await res.json()) as { ok?: boolean; error?: string; note?: string };
  if (!res.ok || !parsed.ok) {
    throw new Error(parsed.error || `E-mailaanvraag mislukt (HTTP ${res.status})`);
  }
  setStatus(parsed.note || "E-mailaanvraag geregistreerd", "ok");
  await refreshGlobalInbox();
}

/** @deprecated path kept as fallback when inbox is empty but PROJECT_FINISHED */
async function refreshProjectReports(): Promise<void> {
  await refreshProjectReportsLegacy();
}

function miniProgressBar(status: ProjectStatus): string {
  const current = progressIndex(status);
  const facets = PROGRESS_STEPS.map((_, i) => {
    const cls = i <= current ? "mini-facet reached" : "mini-facet";
    return `<span class="${cls}"></span>`;
  }).join("");
  return `<span class="mini-progress" title="${statusLabel(status)}" aria-hidden="true">${facets}</span>`;
}

function projectTitle(p: Pick<ProjectListItem, "label" | "dwell_street" | "client_ref" | "external_ref">): string {
  if (p.label) return p.label;
  if (p.client_ref) return p.client_ref;
  if (p.external_ref) return p.external_ref;
  if (p.dwell_street) return p.dwell_street;
  return "Naamloos project";
}

function nextRequestId(prefix: string): string {
  reqCounter += 1;
  return `${prefix}_${reqCounter}_${Date.now()}`;
}

function loadStoredAuth(): AuthInfo | null {
  const parsed = loadAuth(AUTH_KEY) as AuthInfo | null;
  if (!parsed?.token || !parsed.user_id) return null;
  return parsed;
}

function storeAuth(info: AuthInfo | null): void {
  persistAuth(AUTH_KEY, info);
  void syncSessionCookie(info?.token ?? null);
}

function setFormValue(form: HTMLFormElement, name: string, value: string): void {
  const el = form.elements.namedItem(name);
  if (el && "value" in el) (el as HTMLInputElement | HTMLTextAreaElement).value = value;
}

function showLogin(): void {
  auth = null;
  storeAuth(null);
  cachedCustomerProfile = null;
  loginPanel.classList.remove("hidden");
  appPanel.classList.add("hidden");
  methodPanelEl.classList.add("hidden");
  projectDetailPanel.classList.add("hidden");
  profilePortalBanner.classList.add("hidden");
  setAuthTab("signin");
  applyRememberedLoginFields();
  pageTitle.textContent = "Opdrachtgever";
  pageLede.textContent = "Log in om uw akoestische projecten te beheren.";
  document.title = "Stilte advies en meten — Opdrachtgever";
}

function loggedInLabel(info: AuthInfo): string {
  const name = info.display_name?.trim();
  return name ? `Ingelogd als ${name} (${info.username})` : `Ingelogd als ${info.username}`;
}

async function showApp(info: AuthInfo): Promise<void> {
  auth = info;
  storeAuth(info);
  rememberUsername(info.username);
  loginPanel.classList.add("hidden");
  appPanel.classList.remove("hidden");
  projectDetailPanel.classList.add("hidden");
  setStatus(loggedInLabel(info), "ok");
  const mustChange = !!info.must_change_password;
  profilePortalBanner.classList.toggle("hidden", !mustChange);
  profilePortalLink.href = STILTE_PORTAL_PROFILE_URL;
  methodPanelEl.classList.add("hidden");
  pageTitle.textContent = "Projecten";
  pageLede.textContent =
    "Uw lopende akoestische projecten. Klantgegevens en wachtwoord beheert u in het Stilte-portaal.";
  document.title = "Stilte advies en meten — Projecten";
  await loadCustomerProfile();
  await refreshProjectList();
  await refreshGlobalInbox();
  if (location.hash === "#inbox") goToPortalInbox();
}

function goToPortalInbox(): void {
  location.assign(STILTE_PORTAL_INBOX_URL);
}

window.addEventListener("hashchange", () => {
  if (location.hash === "#inbox") goToPortalInbox();
});

function send(type: string, payload: Record<string, unknown>, wantType: string): Promise<Envelope> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("Geen verbinding met de server"));
  }
  const request_id = nextRequestId(type.replace(".", "_"));
  const env: Envelope = { v: 1, type, request_id, payload };
  if (sessionId && type !== "session.open") env.session_id = sessionId;
  return new Promise((resolve, reject) => {
    pending.set(request_id, { resolve, reject, want: wantType });
    ws!.send(JSON.stringify(env));
  });
}

function onMessage(raw: string): void {
  let env: Envelope;
  try {
    env = JSON.parse(raw) as Envelope;
  } catch {
    return;
  }
  if (env.type === "session.opened") {
    const sid =
      (typeof env.session_id === "string" && env.session_id) ||
      (typeof env.payload?.session_id === "string" ? env.payload.session_id : null);
    if (sid) sessionId = sid;
  }
  if (env.type === "error") {
    const waiter = pending.get(env.request_id);
    if (waiter) {
      pending.delete(env.request_id);
      waiter.reject(new Error(JSON.stringify(env.payload ?? env)));
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

async function invokeString(target: string, args: unknown[]): Promise<string> {
  const inv = await send(
    "invoke.request",
    { target_kind: "procedure", target, args },
    "invoke.completed",
  );
  const ret = inv.payload?.return;
  if (typeof ret !== "string") {
    throw new Error(`Onverwacht antwoord van ${target}: ${JSON.stringify(inv.payload)}`);
  }
  if (ret === "") {
    throw new Error(
      `${target} gaf een leeg antwoord — bestand mogelijk te groot; probeer een kleinere tekening of herstart de server`,
    );
  }
  return ret;
}

async function bootstrapSession(): Promise<void> {
  setStatus(`Verbinden met ${BPP_WS}…`, "busy");
  ws = new WebSocket(BPP_WS);
  setConnLed(false);
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("Verbinding time-out")), 8000);
    ws!.onopen = () => {
      window.clearTimeout(t);
      setConnLed(true);
      resolve();
    };
    ws!.onerror = () => {
      window.clearTimeout(t);
      setConnLed(false);
      reject(new Error("Verbinding mislukt — draait de server op poort 18080?"));
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
    "exec.completed",
  );
  if (load.type === "error") throw new Error(`Laden API mislukt: ${JSON.stringify(load.payload)}`);
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`Opstarten mislukt: ${bootRet}`);
  setStatus(`Verbonden · sessie ${sessionId ?? "?"}`, "ok");
  const stored = loadStoredAuth();
  if (stored) {
    const validated = await invokeString("API_ValidateSession", [stored.token]);
    if (validated.startsWith("ERROR")) {
      showLogin();
      setStatus("Vorige sessie verlopen — log opnieuw in", "err");
      return;
    }
    const info = JSON.parse(validated) as AuthInfo;
    await showApp(info);
  } else {
    showLogin();
  }
}

function readCustomerProfile(): CustomerProfileFields {
  if (cachedCustomerProfile?.name) return cachedCustomerProfile;
  return {
    name: (auth?.display_name || auth?.username || "").trim(),
    email: (auth?.email || "").trim(),
    phone: "",
    notes: "",
    cust_street: "",
    cust_postal: "",
    cust_city: "",
    cust_municipality: "",
    cust_country: "NL",
  };
}

function readProjectForm(): ProjectFormFields {
  const fd = new FormData(projectForm);
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  return {
    dwell_street: g("dwell_street"),
    dwell_postal: g("dwell_postal"),
    dwell_city: g("dwell_city"),
    dwell_municipality: g("dwell_municipality"),
    dwell_country: g("dwell_country") || "NL",
    label: g("label"),
    client_ref: g("client_ref"),
  };
}

async function loadCustomerProfile(): Promise<void> {
  if (!auth?.token) return;
  const ret = await invokeString("API_GetCustomerProfile", [auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  const parsed = JSON.parse(ret) as {
    customer: {
      name: string;
      email: string;
      phone: string;
      notes: string;
    } | null;
    customer_address?: {
      street_line: string;
      postal_code: string;
      city: string;
      municipality: string;
      country_code: string;
    };
  };
  if (!parsed.customer) {
    cachedCustomerProfile = null;
    return;
  }
  const ca = parsed.customer_address;
  cachedCustomerProfile = {
    name: parsed.customer.name,
    email: parsed.customer.email,
    phone: parsed.customer.phone,
    notes: parsed.customer.notes,
    cust_street: ca?.street_line ?? "",
    cust_postal: ca?.postal_code ?? "",
    cust_city: ca?.city ?? "",
    cust_municipality: ca?.municipality ?? "",
    cust_country: ca?.country_code || "NL",
  };
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function showPickedDrawings(names: string[]): void {
  if (!names.length) {
    drawingPickedEl.hidden = true;
    drawingPickedEl.textContent = "";
    return;
  }
  drawingPickedEl.hidden = false;
  drawingPickedEl.textContent =
    names.length === 1 ? `Gekozen: ${names[0]}` : `Gekozen: ${names.join(", ")}`;
}

function fileExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function activeProjectId(): string | null {
  const id = projectIdInput.value.trim() || lastProjectId;
  return id || null;
}

async function refreshProjectDocuments(): Promise<void> {
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

  let docs: ProjectDocument[] = [];
  if (bppPhase1Enabled()) {
    try {
      const data = await bppListProjectDocuments(invokeString, auth.token, projectId);
      docs = (data.documents || []).map((d) => ({
        id: d.id,
        filename: d.filename,
        file_ext: d.file_ext,
        byte_size: Number(d.byte_size) || 0,
      }));
    } catch (err) {
      drawingUploadHintEl.textContent =
        err instanceof Error ? err.message : "Tekeningen laden mislukt";
      return;
    }
  } else {
    const res = await fetch(`/api/drawings/list?building_id=${encodeURIComponent(projectId)}`, {
      credentials: "include",
      headers: apiAuthHeaders(auth.token),
    });
    let parsed: { ok?: boolean; error?: string; documents?: ProjectDocument[] };
    try {
      parsed = (await res.json()) as { ok?: boolean; error?: string; documents?: ProjectDocument[] };
    } catch {
      drawingUploadHintEl.textContent = `Tekeningen laden mislukt (HTTP ${res.status})`;
      return;
    }
    if (!res.ok || !parsed.ok) {
      drawingUploadHintEl.textContent = parsed.error || `Tekeningen laden mislukt (HTTP ${res.status})`;
      return;
    }
    docs = parsed.documents ?? [];
  }

  updateSubmitDrawingsButton(docs.length);
  if (docs.length === 0) {
    drawingUploadHintEl.textContent = "Nog geen tekeningen geüpload.";
    return;
  }
  drawingUploadHintEl.textContent =
    docs.length === 1 ? "1 tekening geüpload." : `${docs.length} tekeningen geüpload.`;
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

async function uploadDrawingFile(file: File): Promise<void> {
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
      "Content-Type": "application/octet-stream",
    },
    body: file,
  });

  let parsed: { ok?: boolean; error?: string };
  try {
    parsed = (await res.json()) as { ok?: boolean; error?: string };
  } catch {
    throw new Error(`${file.name}: ongeldig serverantwoord (HTTP ${res.status})`);
  }
  if (!res.ok || !parsed.ok) {
    throw new Error(`${file.name}: ${parsed.error || res.statusText || `HTTP ${res.status}`}`);
  }
}

async function deleteDrawing(documentId: string): Promise<void> {
  if (!auth?.token || !window.confirm("Deze tekening verwijderen?")) return;
  setStatus("Tekening verwijderen…", "busy");
  const ret = await invokeString("API_DeleteDrawing", [auth.token, documentId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  await refreshProjectDocuments();
  setStatus("Tekening verwijderd", "ok");
}

function updateSubmitDrawingsButton(drawingCount = 0): void {
  const canSubmit =
    Boolean(activeProjectId()) &&
    currentProjectStatus === "INITIAL_REQUEST" &&
    drawingCount > 0;
  submitDrawingsBtn.disabled = !canSubmit;
}

async function submitDrawingsForReview(): Promise<void> {
  const projectId = activeProjectId();
  if (!auth?.token || !projectId) return;
  if (
    !window.confirm(
      "Tekeningen indienen ter beoordeling door de ingenieur? Daarna kunt u dit project niet meer uploaden of wijzigen.",
    )
  ) {
    return;
  }
  setStatus("Tekeningen indienen…", "busy");
  submitDrawingsBtn.disabled = true;
  const ret = await invokeString("API_CustomerSubmitDrawings", [auth.token, projectId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    updateSubmitDrawingsButton();
    return;
  }
  const parsed = JSON.parse(ret) as { project_status: ProjectStatus };
  setProjectEditingState(parsed.project_status);
  await refreshProjectList();
  setStatus("Tekeningen ingediend — een ingenieur beoordeelt ze", "ok");
}

function setProjectEditingState(status: ProjectStatus | null): void {
  currentProjectStatus = status;
  renderProjectProgress(status);
  const editable = !status || status === "INITIAL_REQUEST";
  saveBtn.disabled = !editable;
  deleteProjectBtn.disabled = !lastProjectId || status !== "INITIAL_REQUEST";
  projectForm.querySelectorAll("input:not([type=hidden]):not([type=file]), textarea").forEach((el) => {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.readOnly = !editable;
    }
  });
  if (status && status !== "INITIAL_REQUEST") {
    projectStatusViewEl.textContent = statusLabel(status);
    drawingFileInput.disabled = true;
    submitDrawingsBtn.disabled = true;
  } else if (status === "INITIAL_REQUEST") {
    projectStatusViewEl.textContent = `${statusLabel(status)} — u kunt dit project nog wijzigen of verwijderen.`;
    drawingFileInput.disabled = !lastProjectId;
  } else {
    projectStatusViewEl.textContent = "Vul het adres van de woning in en sla op om een nieuw project te maken.";
    drawingFileInput.disabled = true;
    submitDrawingsBtn.disabled = true;
  }
  void refreshProjectDocuments();
}

function clearProjectFields(): void {
  for (const name of ["dwell_street", "dwell_postal", "dwell_city", "dwell_municipality", "dwell_country", "label", "client_ref"]) {
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
  showPickedDrawings([]);
  drawingFileInput.disabled = true;
  drawingUploadHintEl.textContent = "Sla het project eerst op, upload daarna PDF- of DWG-tekeningen.";
  renderProjectProgress(null);
  setProjectEditingState(null);
  highlightSelectedProject(null);
}

function fillProjectFromOpen(data: {
  building: { id: string; label: string; client_ref?: string; external_ref: string; project_status?: ProjectStatus };
  dwelling_address: {
    street_line: string;
    postal_code: string;
    city: string;
    municipality: string;
    country_code: string;
  };
}): void {
  setFormValue(projectForm, "dwell_street", data.dwelling_address.street_line);
  setFormValue(projectForm, "dwell_postal", data.dwelling_address.postal_code);
  setFormValue(projectForm, "dwell_city", data.dwelling_address.city);
  setFormValue(projectForm, "dwell_municipality", data.dwelling_address.municipality);
  setFormValue(projectForm, "dwell_country", data.dwelling_address.country_code || "NL");
  setFormValue(projectForm, "label", data.building.label);
  setFormValue(projectForm, "client_ref", data.building.client_ref || "");
  projectIdInput.value = data.building.id;
  lastProjectId = data.building.id;
  reloadBtn.disabled = !lastProjectId;
  projectDetailPanel.classList.remove("hidden");
  projectDetailTitle.textContent = projectTitle({
    label: data.building.label,
    client_ref: data.building.client_ref || "",
    external_ref: data.building.external_ref || "",
    dwell_street: data.dwelling_address.street_line,
  });
  highlightSelectedProject(data.building.id);
  setProjectEditingState(data.building.project_status ?? null);
}

function highlightSelectedProject(id: string | null): void {
  projectListEl.querySelectorAll(".project-list-item").forEach((el) => {
    el.classList.toggle("selected", id !== null && (el as HTMLElement).dataset.projectId === id);
  });
}

function renderProjectList(projects: ProjectListItem[]): void {
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

async function refreshProjectList(): Promise<void> {
  if (!auth?.token) return;
  const ret = await invokeString("API_ListBuildings", [auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("session")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret) as { projects: ProjectListItem[] };
  renderProjectList(parsed.projects ?? []);
  void refreshGlobalInbox();
}

async function openProject(id: string): Promise<void> {
  if (!auth?.token) return;
  setStatus("Project laden…", "busy");
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
  setStatus("Inloggen…", "busy");
  try {
    const fd = new FormData(loginForm);
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const ret = await invokeString("API_Login", [username, password]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const info = JSON.parse(ret) as AuthInfo;
    await showApp(info);
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
    /* still clear local auth */
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
  setStatus("Toegang aanvragen…", "busy");
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
    const parsed = JSON.parse(ret) as {
      username: string;
      access_password: string;
      message: string;
    };
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
  const uEl = loginForm.elements.namedItem("username") as HTMLInputElement | null;
  const pEl = loginForm.elements.namedItem("password") as HTMLInputElement | null;
  if (uEl && issuedAccessUsername) {
    uEl.value = issuedAccessUsername;
    rememberUsername(issuedAccessUsername);
  }
  if (pEl && issuedAccessPassword) pEl.value = issuedAccessPassword;
  setStatus("Log in met het verstrekte wachtwoord", "ok");
});

methodBtn.addEventListener("click", () => {
  methodPanelEl.classList.remove("hidden");
  methodPanelEl.querySelector<HTMLElement>(".method-scroll")?.focus();
});

methodCloseBtn.addEventListener("click", () => {
  methodPanelEl.classList.add("hidden");
});

projectForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!auth?.token) {
    showLogin();
    return;
  }
  if (auth.must_change_password) {
    setStatus("Wijzig eerst uw wachtwoord in het Stilte-portaal (Profiel)", "err");
    profilePortalBanner.classList.remove("hidden");
    return;
  }
  const c = readCustomerProfile();
  if (!c.name) {
    setStatus("Stel eerst uw klantnaam in via Profiel in het Stilte-portaal", "err");
    profilePortalBanner.classList.remove("hidden");
    return;
  }
  saveBtn.disabled = true;
  setStatus("Project opslaan…", "busy");
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
      p.client_ref,
      projectId,
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      if (ret.includes("login") || ret.includes("session")) showLogin();
      return;
    }
    const parsed = JSON.parse(ret) as { building_id?: string; project_id?: string };
    lastProjectId = parsed.project_id ?? parsed.building_id ?? null;
    if (lastProjectId) projectIdInput.value = lastProjectId;
    reloadBtn.disabled = !lastProjectId;
    projectDetailPanel.classList.remove("hidden");
    projectDetailTitle.textContent = projectTitle({
      label: p.label,
      client_ref: p.client_ref,
      external_ref: "",
      dwell_street: p.dwell_street,
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
  setStatus("Herladen…", "busy");
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
  setStatus("Nieuw project — klantgegevens beheert u in het Stilte-portaal (Profiel)", "ok");
});

deleteProjectBtn.addEventListener("click", async () => {
  if (!lastProjectId || !auth?.token || currentProjectStatus !== "INITIAL_REQUEST") return;
  if (!window.confirm("Dit project verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
  deleteProjectBtn.disabled = true;
  setStatus("Project verwijderen…", "busy");
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

let drawingUploadBusy = false;

drawingFileInput.addEventListener("change", async () => {
  const picked = Array.from(drawingFileInput.files ?? []);
  const projectId = activeProjectId();
  if (!picked.length) return;
  showPickedDrawings(picked.map((file) => file.name));
  if (!auth?.token || !projectId) {
    drawingUploadHintEl.textContent = "Sla het project eerst op. De gekozen bestanden blijven staan.";
    return;
  }
  if (currentProjectStatus && currentProjectStatus !== "INITIAL_REQUEST") {
    setStatus("Tekeningen kunnen alleen worden geüpload zolang het project nog niet is ingediend", "err");
    return;
  }
  if (drawingUploadBusy) return;
  drawingUploadBusy = true;
  setStatus(picked.length === 1 ? "Tekening uploaden…" : `${picked.length} tekeningen uploaden…`, "busy");
  try {
    for (const file of picked) {
      await uploadDrawingFile(file);
    }
    drawingFileInput.value = "";
    showPickedDrawings([]);
    await refreshProjectDocuments();
    setStatus(
      picked.length === 1 ? "1 tekening geüpload" : `${picked.length} tekeningen geüpload`,
      "ok",
    );
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
    drawingUploadHintEl.textContent = "Upload mislukt. De gekozen bestanden staan nog in het vak.";
  } finally {
    drawingUploadBusy = false;
    drawingFileInput.disabled = currentProjectStatus !== null && currentProjectStatus !== "INITIAL_REQUEST";
  }
});

submitDrawingsBtn.addEventListener("click", () => {
  void submitDrawingsForReview();
});

downloadResultsBtn.addEventListener("click", () => {
  void (async () => {
    if (!auth?.token) return;
    try {
      if (activeInboxItem) {
        await downloadInboxItem(activeInboxItem);
        return;
      }
      const projectId = activeProjectId();
      const latest =
        cachedReports.find((r) => r.filename.endsWith(".pdf")) ||
        cachedReports.find((r) => r.filename.endsWith(".html")) ||
        cachedReports[0];
      if (!projectId || !latest) {
        setStatus("Geen rekenresultaten beschikbaar om te downloaden", "err");
        return;
      }
      const res = await fetch(
        `/api/reports/download?building_id=${encodeURIComponent(projectId)}&file=${encodeURIComponent(latest.filename)}`,
        { credentials: "include", headers: apiAuthHeaders(auth.token) },
      );
      if (!res.ok) {
        let err = `Download mislukt (HTTP ${res.status})`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) err = j.error;
        } catch {
          /* ignore */
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
      setStatus(`Rekenresultaten gedownload: ${downloadName}`, "ok");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), "err");
    }
  })();
});

downloadRapportageBtn?.addEventListener("click", () => {
  setStatus("Download rapportage volgt later — nog niet beschikbaar", "err");
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

applyRememberedLoginFields();
initPasswordToggles();