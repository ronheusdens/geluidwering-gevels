import { loadAuth, storeAuth as persistAuth, syncSessionCookie } from "./auth-store";
import { resolveBppWsUrl } from "./ws-url";
import { initPasswordToggles } from "./password-toggle";

type Envelope = {
  v: number;
  type: string;
  request_id: string;
  session_id?: string;
  payload?: Record<string, unknown>;
};

type AuthInfo = {
  token: string;
  username: string;
  display_name: string;
};

type ProjectStatus =
  | "INITIAL_REQUEST"
  | "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED"
  | "PROJECT_UNDERWAY"
  | "PROJECT_NEAR_FINAL"
  | "PROJECT_FINISHED";

type AdminCustomer = {
  customer_id: string;
  customer_name: string;
  project_count: string;
  outstanding_count: string;
  drawing_count: string;
};

type AdminProject = {
  building_id: string;
  label: string;
  external_ref: string;
  project_status: ProjectStatus;
  created_at: string;
  drawing_count: string;
  drawing_names: string;
};

const BPP_WS = resolveBppWsUrl();

const AUTH_KEY = "app_gevelwering_admin_auth";
const connBarEl = document.getElementById("admin-conn-bar") as HTMLElement;
const connLedEl = document.getElementById("admin-conn-led") as HTMLElement;
const connStatusEl = document.getElementById("admin-conn-status") as HTMLElement;
const loginPanelEl = document.getElementById("admin-login-panel") as HTMLElement;
const loginForm = document.getElementById("admin-login-form") as HTMLFormElement;
const loginBtn = document.getElementById("admin-login-btn") as HTMLButtonElement;
const adminPanelEl = document.getElementById("admin-panel") as HTMLElement;
const adminUserLabelEl = document.getElementById("admin-user-label") as HTMLElement;
const logoutBtn = document.getElementById("admin-logout-btn") as HTMLButtonElement;
const refreshBtn = document.getElementById("admin-refresh-btn") as HTMLButtonElement;
const customerSelectEl = document.getElementById("admin-customer-select") as HTMLSelectElement;
const projectsPanelEl = document.getElementById("admin-projects-panel") as HTMLElement;
const customerTitleEl = document.getElementById("admin-customer-title") as HTMLElement;
const projectsListEl = document.getElementById("admin-projects-list") as HTMLElement;

let ws: WebSocket | null = null;
let sessionId: string | null = null;
let auth: AuthInfo | null = null;
let reqCounter = 0;
const pending = new Map<string, { resolve: (env: Envelope) => void; reject: (err: Error) => void; want: string }>();

function setStatus(text: string, kind: "busy" | "ok" | "err" = "busy"): void {
  connStatusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}

function setConnLed(connected: boolean): void {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}

function nextRequestId(prefix: string): string {
  reqCounter += 1;
  return `${prefix}_${reqCounter}_${Date.now()}`;
}

function storeAuth(info: AuthInfo | null): void {
  persistAuth(AUTH_KEY, info);
  void syncSessionCookie(info?.token ?? null);
}

function loadStoredAuth(): AuthInfo | null {
  return loadAuth(AUTH_KEY);
}

function showLogin(): void {
  auth = null;
  storeAuth(null);
  loginPanelEl.classList.remove("hidden");
  adminPanelEl.classList.add("hidden");
  projectsPanelEl.classList.add("hidden");
}

function showAdmin(info: AuthInfo): void {
  auth = info;
  storeAuth(info);
  loginPanelEl.classList.add("hidden");
  adminPanelEl.classList.remove("hidden");
  adminUserLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
}

function send(type: string, payload: Record<string, unknown>, wantType: string): Promise<Envelope> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error("WebSocket not open"));
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
  const inv = await send("invoke.request", { target_kind: "procedure", target, args }, "invoke.completed");
  const ret = inv.payload?.return;
  if (typeof ret !== "string") throw new Error(`Unexpected return from ${target}: ${JSON.stringify(inv.payload)}`);
  return ret;
}

function statusLabel(status: ProjectStatus | string): string {
  switch (status) {
    case "INITIAL_REQUEST":
      return "Project gestart";
    case "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED":
      return "Gegevens aangeleverd — nog niet verwerkt";
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

function statusOptions(current: ProjectStatus): string {
  const values: ProjectStatus[] = [
    "INITIAL_REQUEST",
    "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED",
    "PROJECT_UNDERWAY",
    "PROJECT_NEAR_FINAL",
    "PROJECT_FINISHED",
  ];
  return values
    .map((value) => `<option value="${value}"${value === current ? " selected" : ""}>${statusLabel(value)}</option>`)
    .join("");
}

function isOutstanding(status: ProjectStatus): boolean {
  return status !== "PROJECT_FINISHED";
}

async function loadCustomers(): Promise<void> {
  if (!auth?.token) return;
  const prev = customerSelectEl.value;
  const ret = await invokeString("API_AdminListCustomers", [auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("admin")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret) as { customers: AdminCustomer[] };
  const customers = parsed.customers ?? [];
  customerSelectEl.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— kies een klant —";
  customerSelectEl.appendChild(blank);

  for (const c of customers) {
    const opt = document.createElement("option");
    opt.value = c.customer_id;
    const outstanding = Number(c.outstanding_count || 0);
    const total = Number(c.project_count || 0);
    const drawings = Number(c.drawing_count || 0);
    const suffix =
      outstanding > 0
        ? ` · ${outstanding} openstaand`
        : total > 0
          ? " · alles afgerond"
          : "";
    const drawingSuffix =
      drawings > 0
        ? ` · ${drawings} tekening${drawings === 1 ? "" : "en"}`
        : " · geen tekeningen";
    opt.textContent = `${c.customer_name} (${total} project${total === 1 ? "" : "en"}${suffix}${drawingSuffix})`;
    customerSelectEl.appendChild(opt);
  }

  if (prev && [...customerSelectEl.options].some((o) => o.value === prev)) {
    customerSelectEl.value = prev;
    await loadCustomerProjects(prev);
  } else {
    projectsPanelEl.classList.add("hidden");
    projectsListEl.innerHTML = "";
  }
}

async function loadCustomerProjects(customerId: string): Promise<void> {
  if (!auth?.token || !customerId) {
    projectsPanelEl.classList.add("hidden");
    return;
  }
  const ret = await invokeString("API_AdminListCustomerProjects", [auth.token, customerId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  const parsed = JSON.parse(ret) as { projects: AdminProject[] };
  const projects = parsed.projects ?? [];
  const customerName =
    customerSelectEl.options[customerSelectEl.selectedIndex]?.textContent?.split(" (")[0] || "Klant";

  projectsPanelEl.classList.remove("hidden");
  customerTitleEl.textContent = `Projecten van ${customerName}`;

  if (projects.length === 0) {
    projectsListEl.innerHTML = `<p class="hint">Geen projecten voor deze klant.</p>`;
    return;
  }

  projectsListEl.innerHTML = projects
    .map((p) => {
      const outstanding = isOutstanding(p.project_status);
      const drawingCount = Number(p.drawing_count || 0);
      const drawingLine =
        drawingCount > 0
          ? `Tekeningen: ${p.drawing_names || `${drawingCount} bestand${drawingCount === 1 ? "" : "en"}`}`
          : "Tekeningen: nog geen upload";
      return `
        <section class="panel admin-project-card${outstanding ? "" : " admin-project-finished"}" data-building-id="${p.building_id}">
          <h3>${p.label || "(geen label)"}${outstanding ? "" : " · afgerond"}</h3>
          <p class="hint">Ref: ${p.external_ref || "(geen)"} · Aangemaakt: ${p.created_at || "—"}</p>
          <p class="hint">${drawingLine}</p>
          <label class="block-label">
            Projectstatus
            <select class="admin-project-status">
              ${statusOptions(p.project_status)}
            </select>
          </label>
          <div class="actions">
            <button type="button" class="admin-save-status">Status bijwerken</button>
          </div>
        </section>
      `;
    })
    .join("");

  for (const btn of projectsListEl.querySelectorAll<HTMLButtonElement>(".admin-save-status")) {
    btn.addEventListener("click", async () => {
      const card = btn.closest<HTMLElement>(".admin-project-card");
      const select = card?.querySelector<HTMLSelectElement>(".admin-project-status");
      if (!card || !select || !auth?.token) return;
      btn.disabled = true;
      setStatus("Projectstatus bijwerken…", "busy");
      try {
        const ret2 = await invokeString("API_AdminUpdateProjectStatus", [
          auth.token,
          card.dataset.buildingId || "",
          select.value,
        ]);
        if (ret2.startsWith("ERROR")) {
          setStatus(ret2, "err");
          return;
        }
        setStatus("Projectstatus bijgewerkt", "ok");
        await loadCustomers();
        if (customerSelectEl.value) await loadCustomerProjects(customerSelectEl.value);
      } catch (err) {
        setStatus(err instanceof Error ? err.message : String(err), "err");
      } finally {
        btn.disabled = false;
      }
    });
  }
}

async function bootstrapSession(): Promise<void> {
  setStatus(`Verbinden met ${BPP_WS}…`, "busy");
  ws = new WebSocket(BPP_WS);
  setConnLed(false);
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("WebSocket-verbinding time-out")), 8000);
    ws!.onopen = () => {
      window.clearTimeout(t);
      setConnLed(true);
      resolve();
    };
    ws!.onerror = () => {
      window.clearTimeout(t);
      setConnLed(false);
      reject(new Error("WebSocket-verbinding mislukt — draait bppServer op poort 18080?"));
    };
  });
  ws.onmessage = (ev) => onMessage(String(ev.data));
  ws.onclose = () => {
    setConnLed(false);
    setStatus("Verbinding met bppServer verbroken", "err");
  };

  await send("session.open", { client_name: "app-gevelwering-admin-web", client_version: "0.2.4" }, "session.opened");
  await send("exec.request", { code: 'INCLUDE "fixtures/app-gevelwering/shared_building_api.basicpp"\n' }, "exec.completed");
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap mislukt: ${bootRet}`);
  setStatus(`Verbonden · sessie ${sessionId ?? "?"} · Postgres gereed`, "ok");

  const stored = loadStoredAuth();
  if (stored?.token) {
    const validated = await invokeString("API_ValidateSession", [stored.token]);
    if (!validated.startsWith("ERROR")) {
      const info = JSON.parse(validated) as AuthInfo;
      if (info.username === "admin") {
        showAdmin({ token: stored.token, username: info.username, display_name: info.display_name });
        await loadCustomers();
        return;
      }
    }
  }
  showLogin();
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
    if (info.username !== "admin") {
      setStatus("Deze pagina is alleen voor gebruiker 'admin'", "err");
      return;
    }
    showAdmin(info);
    await loadCustomers();
    setStatus("Beheerder ingelogd", "ok");
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
    /* ignore */
  }
  showLogin();
  setStatus("Uitgelogd", "ok");
});

customerSelectEl.addEventListener("change", () => {
  void loadCustomerProjects(customerSelectEl.value);
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  try {
    await loadCustomers();
    setStatus("Klantenlijst vernieuwd", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    refreshBtn.disabled = false;
  }
});

bootstrapSession().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});

initPasswordToggles();