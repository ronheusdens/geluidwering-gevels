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

// src/admin.ts
var BPP_WS = resolveBppWsUrl();
var AUTH_KEY = "app_gevelwering_admin_auth";
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
var projectsPanelEl = document.getElementById("admin-projects-panel");
var customerTitleEl = document.getElementById("admin-customer-title");
var projectsListEl = document.getElementById("admin-projects-list");
var ws = null;
var sessionId = null;
var auth = null;
var reqCounter = 0;
var pending = /* @__PURE__ */ new Map();
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
  adminPanelEl.classList.add("hidden");
  projectsPanelEl.classList.add("hidden");
}
function showAdmin(info) {
  auth = info;
  storeAuth2(info);
  loginPanelEl.classList.add("hidden");
  adminPanelEl.classList.remove("hidden");
  adminUserLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
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
async function loadCustomers() {
  if (!auth?.token) return;
  const prev = customerSelectEl.value;
  const ret = await invokeString("API_AdminListCustomers", [auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("admin")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret);
  const customers = parsed.customers ?? [];
  customerSelectEl.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "\u2014 kies een klant \u2014";
  customerSelectEl.appendChild(blank);
  for (const c of customers) {
    const opt = document.createElement("option");
    opt.value = c.customer_id;
    const outstanding = Number(c.outstanding_count || 0);
    const total = Number(c.project_count || 0);
    const drawings = Number(c.drawing_count || 0);
    const suffix = outstanding > 0 ? ` \xB7 ${outstanding} openstaand` : total > 0 ? " \xB7 alles afgerond" : "";
    const drawingSuffix = drawings > 0 ? ` \xB7 ${drawings} tekening${drawings === 1 ? "" : "en"}` : " \xB7 geen tekeningen";
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
async function loadCustomerProjects(customerId) {
  if (!auth?.token || !customerId) {
    projectsPanelEl.classList.add("hidden");
    return;
  }
  const ret = await invokeString("API_AdminListCustomerProjects", [auth.token, customerId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  const parsed = JSON.parse(ret);
  const projects = parsed.projects ?? [];
  const customerName = customerSelectEl.options[customerSelectEl.selectedIndex]?.textContent?.split(" (")[0] || "Klant";
  projectsPanelEl.classList.remove("hidden");
  customerTitleEl.textContent = `Projecten van ${customerName}`;
  if (projects.length === 0) {
    projectsListEl.innerHTML = `<p class="hint">Geen projecten voor deze klant.</p>`;
    return;
  }
  projectsListEl.innerHTML = projects.map((p) => {
    const outstanding = isOutstanding(p.project_status);
    const drawingCount = Number(p.drawing_count || 0);
    const drawingLine = drawingCount > 0 ? `Tekeningen: ${p.drawing_names || `${drawingCount} bestand${drawingCount === 1 ? "" : "en"}`}` : "Tekeningen: nog geen upload";
    return `
        <section class="panel admin-project-card${outstanding ? "" : " admin-project-finished"}" data-building-id="${p.building_id}">
          <h3>${p.label || "(geen label)"}${outstanding ? "" : " \xB7 afgerond"}</h3>
          <p class="hint">Ref: ${p.external_ref || "(geen)"} \xB7 Aangemaakt: ${p.created_at || "\u2014"}</p>
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
  }).join("");
  for (const btn of projectsListEl.querySelectorAll(".admin-save-status")) {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".admin-project-card");
      const select = card?.querySelector(".admin-project-status");
      if (!card || !select || !auth?.token) return;
      btn.disabled = true;
      setStatus("Projectstatus bijwerken\u2026", "busy");
      try {
        const ret2 = await invokeString("API_AdminUpdateProjectStatus", [
          auth.token,
          card.dataset.buildingId || "",
          select.value
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
async function bootstrapSession() {
  setStatus(`Verbinden met ${BPP_WS}\u2026`, "busy");
  ws = new WebSocket(BPP_WS);
  setConnLed(false);
  await new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("WebSocket-verbinding time-out")), 8e3);
    ws.onopen = () => {
      window.clearTimeout(t);
      setConnLed(true);
      resolve();
    };
    ws.onerror = () => {
      window.clearTimeout(t);
      setConnLed(false);
      reject(new Error("WebSocket-verbinding mislukt \u2014 draait bppServer op poort 18080?"));
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
  setStatus(`Verbonden \xB7 sessie ${sessionId ?? "?"} \xB7 Postgres gereed`, "ok");
  const stored = loadStoredAuth();
  if (stored?.token) {
    const validated = await invokeString("API_ValidateSession", [stored.token]);
    if (!validated.startsWith("ERROR")) {
      const info = JSON.parse(validated);
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
