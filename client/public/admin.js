var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

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

// src/ws-url.ts
function resolveBppWsUrl() {
  if (location.protocol === "https:") {
    return `wss://${location.host}/ws`;
  }
  const q = new URLSearchParams(location.search).get("ws");
  const override = window.BPP_WS_URL;
  return q || override || `ws://${location.hostname}:18080/ws`;
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
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
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

// src/admin.ts
var connBarEl = document.getElementById("admin-conn-bar");
var connLedEl = document.getElementById("admin-conn-led");
var connStatusEl = document.getElementById("admin-conn-status");
var loginPanelEl = document.getElementById("admin-login-panel");
var loginForm = document.getElementById("admin-login-form");
var loginBtn = document.getElementById("admin-login-btn");
var adminPanelEl = document.getElementById("admin-panel");
var adminUserLabelEl = document.getElementById("admin-user-label");
var logoutBtn = document.getElementById("admin-logout-btn");
var refreshBtn = document.getElementById("admin-refresh-btn");
var customerSelectEl = document.getElementById("admin-customer-select");
var customerHintEl = document.getElementById("admin-customer-hint");
var projectsPanelEl = document.getElementById("admin-projects-panel");
var customerTitleEl = document.getElementById("admin-customer-title");
var projectsListEl = document.getElementById("admin-projects-list");
var accountsListEl = document.getElementById("admin-accounts-list");
var accountsRefreshBtn = document.getElementById("admin-accounts-refresh-btn");
var accountEditPanelEl = document.getElementById("admin-account-edit-panel");
var accountForm = document.getElementById("admin-account-form");
var accountUserIdEl = document.getElementById("admin-account-user-id");
var accountUsernameEl = document.getElementById("admin-account-username");
var accountDisplayNameEl = document.getElementById("admin-account-display-name");
var accountEmailEl = document.getElementById("admin-account-email");
var accountActiveEl = document.getElementById("admin-account-active");
var accountMetaEl = document.getElementById("admin-account-meta");
var accountEditTitleEl = document.getElementById("admin-account-edit-title");
var accountResetPwBtn = document.getElementById("admin-account-reset-pw-btn");
var accountDeleteBtn = document.getElementById("admin-account-delete-btn");
var accountCancelBtn = document.getElementById("admin-account-cancel-btn");
var accountResetOutEl = document.getElementById("admin-account-reset-out");
function setStatus(text, kind = "busy") {
  connStatusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}
function setConnLed(connected) {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}
var session = new BppSession({
  wsUrl: resolveBppWsUrl(),
  authKey: "app_gevelwering_admin_auth",
  clientName: "app-gevelwering-admin-web",
  callbacks: {
    onStatus: setStatus,
    onConnLed: setConnLed,
    onLogin: (info) => showAdmin(info),
    onLogout: () => showLogin(),
    onReady: async () => {
      if (session.auth) {
        await loadAccounts();
        await loadCustomers();
      }
    }
  }
});
function showLogin() {
  loginPanelEl.classList.remove("hidden");
  adminPanelEl.classList.add("hidden");
  projectsPanelEl.classList.add("hidden");
  accountEditPanelEl?.classList.add("hidden");
  if (accountsListEl) accountsListEl.innerHTML = "";
}
function showAdmin(info) {
  loginPanelEl.classList.add("hidden");
  adminPanelEl.classList.remove("hidden");
  adminUserLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
}
function statusOptions(current) {
  const values = [
    "INITIAL_REQUEST",
    "PROJECT_DATA_SUPPLIED_NOT_YET_PROCESSED",
    "PROJECT_UNDERWAY",
    "PROJECT_NEAR_FINAL",
    "PROJECT_FINISHED"
  ];
  return values.map((value) => `<option value="${value}"${value === current ? " selected" : ""}>${statusLabel(value)}</option>`).join("");
}
function isOutstanding(status) {
  return status !== "PROJECT_FINISHED";
}
function closeAccountEdit() {
  accountEditPanelEl?.classList.add("hidden");
  if (accountResetOutEl) {
    accountResetOutEl.hidden = true;
    accountResetOutEl.textContent = "";
  }
}
function fillAccountEdit(a) {
  if (!accountEditPanelEl || !accountForm) return;
  if (accountUserIdEl) accountUserIdEl.value = a.user_id;
  if (accountUsernameEl) accountUsernameEl.value = a.username;
  if (accountDisplayNameEl) accountDisplayNameEl.value = a.display_name || "";
  if (accountEmailEl) accountEmailEl.value = a.email || "";
  if (accountActiveEl) accountActiveEl.checked = Boolean(a.is_active);
  if (accountEditTitleEl) accountEditTitleEl.textContent = `Account: ${a.username}`;
  const projectCount = Number(a.project_count) || 0;
  if (accountMetaEl) {
    const cust = a.customer_name ? `Profielnaam: ${a.customer_name}` : "Nog geen profielnaam (alleen login)";
    const must = a.must_change_password ? " \xB7 moet wachtwoord wijzigen" : "";
    const proj = projectCount === 0 ? " \xB7 geen projecten (mag verwijderd)" : ` \xB7 ${projectCount} project${projectCount === 1 ? "" : "en"} (verwijderen geblokkeerd)`;
    accountMetaEl.textContent = `${cust} \xB7 aangemaakt ${a.created_at || "\u2014"}${must}${proj}`;
  }
  if (accountDeleteBtn) {
    accountDeleteBtn.disabled = projectCount > 0;
    accountDeleteBtn.title = projectCount > 0 ? `Verwijderen niet mogelijk: ${projectCount} project(en)` : "Account en eventueel leeg profiel verwijderen";
  }
  if (accountResetOutEl) {
    accountResetOutEl.hidden = true;
    accountResetOutEl.textContent = "";
  }
  accountEditPanelEl.classList.remove("hidden");
  accountEditPanelEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
async function loadAccounts() {
  if (!session.auth?.token || !accountsListEl) return;
  const ret = await session.invokeString("API_AdminListAccounts", [session.auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("admin")) session.logout();
    return;
  }
  const parsed = JSON.parse(ret);
  const accounts = parsed.accounts ?? [];
  if (!accounts.length) {
    accountsListEl.innerHTML = `<p class="hint">Nog geen opdrachtgever-accounts.</p>`;
    return;
  }
  accountsListEl.innerHTML = accounts.map((a) => {
    const activeBit = a.is_active ? "actief" : "geblokkeerd";
    const cust = a.customer_name || "\u2014";
    const must = a.must_change_password ? " \xB7 wachtwoord wijzigen" : "";
    const projectCount = Number(a.project_count) || 0;
    const projBit = projectCount === 0 ? " \xB7 geen projecten" : ` \xB7 ${projectCount} project${projectCount === 1 ? "" : "en"}`;
    return `
        <article class="panel admin-project-card${a.is_active ? "" : " admin-project-finished"}" data-user-id="${esc(a.user_id)}">
          <h3>${esc(a.username)} <span class="hint">(${esc(a.display_name || "geen weergavenaam")})</span></h3>
          <p class="hint">${esc(a.email || "geen e-mail")} \xB7 ${activeBit}${must}${projBit}</p>
          <p class="hint">Profielnaam: ${esc(cust)}</p>
          <div class="actions">
            <button type="button" class="admin-account-edit">Bewerken</button>
          </div>
        </article>`;
  }).join("");
  for (const btn of accountsListEl.querySelectorAll(".admin-account-edit")) {
    btn.addEventListener("click", () => {
      const card = btn.closest("[data-user-id]");
      const id = card?.dataset.userId || "";
      const a = accounts.find((x) => x.user_id === id);
      if (a) fillAccountEdit(a);
    });
  }
}
async function loadCustomers() {
  if (!session.auth?.token) return;
  const prev = customerSelectEl.value;
  if (customerHintEl) customerHintEl.textContent = "Opdrachtgevers laden\u2026";
  const ret = await session.invokeString("API_AdminListCustomers", [session.auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (customerHintEl) customerHintEl.textContent = ret.replace(/^ERROR:\s*/, "");
    if (ret.includes("login") || ret.includes("admin")) session.logout();
    return;
  }
  const parsed = JSON.parse(ret);
  const customers = parsed.customers ?? [];
  customerSelectEl.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "\u2014 kies een opdrachtgever \u2014";
  customerSelectEl.appendChild(blank);
  for (const c of customers) {
    const opt = document.createElement("option");
    opt.value = c.customer_id;
    const outstanding = Number(c.outstanding_count || 0);
    const total = Number(c.project_count || 0);
    const drawings = Number(c.drawing_count || 0);
    const suffix = outstanding > 0 ? ` \xB7 ${outstanding} openstaand` : total > 0 ? " \xB7 alles afgerond" : "";
    const drawingSuffix = drawings > 0 ? ` \xB7 ${drawings} tekening${drawings === 1 ? "" : "en"}` : " \xB7 geen tekeningen";
    const login = (c.username || "").trim();
    const label = login ? login === c.customer_name ? login : `${login} \u2014 ${c.customer_name}` : c.customer_name;
    opt.textContent = `${label} (${total} project${total === 1 ? "" : "en"}${suffix}${drawingSuffix})`;
    customerSelectEl.appendChild(opt);
  }
  if (customerHintEl) {
    customerHintEl.textContent = customers.length ? `${customers.length} actieve opdrachtgever${customers.length === 1 ? "" : "s"} met projecten.` : "Geen actieve opdrachtgevers met projecten in deze app.";
  }
  if (prev && [...customerSelectEl.options].some((o) => o.value === prev)) {
    customerSelectEl.value = prev;
    await loadCustomerProjects(prev);
  } else {
    projectsPanelEl.classList.add("hidden");
    projectsListEl.innerHTML = "";
  }
}
async function loadCustomerProjects(customerId) {
  if (!session.auth?.token || !customerId) {
    projectsPanelEl.classList.add("hidden");
    return;
  }
  const ret = await session.invokeString("API_AdminListCustomerProjects", [session.auth.token, customerId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  const parsed = JSON.parse(ret);
  const projects = parsed.projects ?? [];
  const customerName = customerSelectEl.options[customerSelectEl.selectedIndex]?.textContent?.split(" (")[0] || "opdrachtgever";
  projectsPanelEl.classList.remove("hidden");
  customerTitleEl.textContent = `Projecten van ${customerName}`;
  if (projects.length === 0) {
    projectsListEl.innerHTML = `<p class="hint">Geen projecten voor deze opdrachtgever.</p>`;
    return;
  }
  projectsListEl.innerHTML = projects.map((p) => {
    const outstanding = isOutstanding(p.project_status);
    const drawingCount = Number(p.drawing_count || 0);
    const drawingLine = drawingCount > 0 ? `Tekeningen: ${p.drawing_names || `${drawingCount} bestand${drawingCount === 1 ? "" : "en"}`}` : "Tekeningen: nog geen upload";
    const refVal = esc(p.external_ref || "");
    return `
        <section class="panel admin-project-card${outstanding ? "" : " admin-project-finished"}" data-building-id="${esc(p.building_id)}">
          <h3>${esc(p.label || "(geen label)")}${outstanding ? "" : " \xB7 afgerond"}</h3>
          <p class="hint">Kenmerk opdrachtgever: ${esc(p.client_ref || "\u2014")} \xB7 Aangemaakt: ${esc(p.created_at || "\u2014")}</p>
          <p class="hint">${esc(drawingLine)}</p>
          <div class="admin-project-fields">
            <label class="block-label">
              Projectnummer (werknummer)
              <input type="text" class="admin-project-number" maxlength="80" value="${refVal}" placeholder="bijv. 2026.0123" autocomplete="off" />
            </label>
            <label class="block-label">
              Projectstatus
              <select class="admin-project-status">
                ${statusOptions(p.project_status)}
              </select>
            </label>
          </div>
          <p class="hint">Het projectnummer verschijnt als werknummer op rekenresultaten en in de rapportage.</p>
          <div class="actions">
            <button type="button" class="admin-save-status">Opslaan</button>
          </div>
        </section>
      `;
  }).join("");
  for (const btn of projectsListEl.querySelectorAll(".admin-save-status")) {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".admin-project-card");
      const select = card?.querySelector(".admin-project-status");
      const numberEl = card?.querySelector(".admin-project-number");
      if (!card || !select || !session.auth?.token) return;
      btn.disabled = true;
      setStatus("Project bijwerken\u2026", "busy");
      try {
        const ret2 = await session.invokeString("API_AdminUpdateProjectStatus", [
          session.auth.token,
          card.dataset.buildingId || "",
          select.value,
          (numberEl?.value || "").trim()
        ]);
        if (ret2.startsWith("ERROR")) {
          setStatus(ret2, "err");
          return;
        }
        setStatus("Projectnummer en status bijgewerkt", "ok");
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
loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  loginBtn.disabled = true;
  setStatus("Inloggen\u2026", "busy");
  try {
    const info = await session.bootstrapAndLogin(
      String(new FormData(loginForm).get("username") ?? "").trim(),
      String(new FormData(loginForm).get("password") ?? "")
    );
    if (info.username !== "admin") {
      setStatus("Deze pagina is alleen voor gebruiker 'admin'", "err");
      return;
    }
    await loadAccounts();
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
    if (session.auth?.token) await session.invokeString("API_Logout", [session.auth.token]);
  } catch {
  }
  session.logout();
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
accountsRefreshBtn?.addEventListener("click", async () => {
  accountsRefreshBtn.disabled = true;
  try {
    await loadAccounts();
    setStatus("Accounts vernieuwd", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    accountsRefreshBtn.disabled = false;
  }
});
accountCancelBtn?.addEventListener("click", () => closeAccountEdit());
accountForm?.addEventListener("submit", (ev) => {
  ev.preventDefault();
  void (async () => {
    if (!session.auth?.token || !accountUserIdEl) return;
    const uid = accountUserIdEl.value.trim();
    if (!uid) return;
    setStatus("Account opslaan\u2026", "busy");
    const ret = await session.invokeString("API_AdminUpdateAccount", [
      session.auth.token,
      uid,
      accountDisplayNameEl?.value.trim() || "",
      accountEmailEl?.value.trim() || "",
      accountActiveEl?.checked ? "true" : "false"
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    setStatus("Account bijgewerkt", "ok");
    await loadAccounts();
    const listRet = await session.invokeString("API_AdminListAccounts", [session.auth.token]);
    if (!listRet.startsWith("ERROR")) {
      const parsed = JSON.parse(listRet);
      const a = (parsed.accounts || []).find((x) => x.user_id === uid);
      if (a) fillAccountEdit(a);
    }
  })().catch((e) => setStatus(String(e), "err"));
});
accountResetPwBtn?.addEventListener("click", () => {
  void (async () => {
    if (!session.auth?.token || !accountUserIdEl) return;
    const uid = accountUserIdEl.value.trim();
    if (!uid) return;
    if (!confirm("Tijdelijk wachtwoord uitgeven voor dit account?")) return;
    setStatus("Wachtwoord resetten\u2026", "busy");
    const ret = await session.invokeString("API_AdminResetAccountPassword", [session.auth.token, uid]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const parsed = JSON.parse(ret);
    if (accountResetOutEl) {
      accountResetOutEl.hidden = false;
      accountResetOutEl.textContent = `Tijdelijk wachtwoord voor ${parsed.username || "account"}: ${parsed.access_password || "\u2014"} (eenmalig tonen; gebruiker moet wijzigen bij login).`;
    }
    setStatus("Wachtwoord gereset", "ok");
    await loadAccounts();
  })().catch((e) => setStatus(String(e), "err"));
});
accountDeleteBtn?.addEventListener("click", () => {
  void (async () => {
    if (!session.auth?.token || !accountUserIdEl) return;
    const uid = accountUserIdEl.value.trim();
    const uname = accountUsernameEl?.value.trim() || "dit account";
    if (!uid) return;
    if (!confirm(
      `Account \xAB${uname}\xBB definitief verwijderen?

Alleen toegestaan als er nog geen projecten zijn. Dit kan niet ongedaan worden gemaakt.`
    )) {
      return;
    }
    setStatus("Account verwijderen\u2026", "busy");
    const ret = await session.invokeString("API_AdminDeleteAccount", [session.auth.token, uid]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    closeAccountEdit();
    await loadAccounts();
    await loadCustomers();
    setStatus(`Account \xAB${uname}\xBB verwijderd`, "ok");
  })().catch((e) => setStatus(String(e), "err"));
});
initPasswordToggles();
session.connect({ reconnectMs: 1500 });
