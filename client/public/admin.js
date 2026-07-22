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

// src/admin.ts
var BPP_WS = resolveBppWsUrl();
var AUTH_KEY = "acoustics_admin_auth";
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
  adminUserLabelEl.textContent = `Signed in as ${info.display_name || info.username}`;
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
      return "Project data supplied not yet processed";
    case "PROJECT_UNDERWAY":
      return "Project underway";
    case "PROJECT_NEAR_FINAL":
      return "Project near final";
    case "PROJECT_FINISHED":
      return "Project finished";
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
  blank.textContent = "\u2014 select a customer \u2014";
  customerSelectEl.appendChild(blank);
  for (const c of customers) {
    const opt = document.createElement("option");
    opt.value = c.customer_id;
    const outstanding = Number(c.outstanding_count || 0);
    const total = Number(c.project_count || 0);
    const drawings = Number(c.drawing_count || 0);
    const suffix = outstanding > 0 ? ` \xB7 ${outstanding} outstanding` : total > 0 ? " \xB7 all finished" : "";
    const drawingSuffix = drawings > 0 ? ` \xB7 ${drawings} drawing${drawings === 1 ? "" : "s"}` : " \xB7 no drawings";
    opt.textContent = `${c.customer_name} (${total} project${total === 1 ? "" : "s"}${suffix}${drawingSuffix})`;
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
  const customerName = customerSelectEl.options[customerSelectEl.selectedIndex]?.textContent?.split(" (")[0] || "Customer";
  projectsPanelEl.classList.remove("hidden");
  customerTitleEl.textContent = `Projects for ${customerName}`;
  if (projects.length === 0) {
    projectsListEl.innerHTML = `<p class="hint">No projects for this customer.</p>`;
    return;
  }
  projectsListEl.innerHTML = projects.map((p) => {
    const outstanding = isOutstanding(p.project_status);
    const drawingCount = Number(p.drawing_count || 0);
    const drawingLine = drawingCount > 0 ? `Drawings: ${p.drawing_names || `${drawingCount} file${drawingCount === 1 ? "" : "s"}`}` : "Drawings: none uploaded";
    return `
        <section class="panel admin-project-card${outstanding ? "" : " admin-project-finished"}" data-building-id="${p.building_id}">
          <h3>${p.label || "(no label)"}${outstanding ? "" : " \xB7 finished"}</h3>
          <p class="hint">Ref: ${p.external_ref || "(none)"} \xB7 Created: ${p.created_at || "\u2014"}</p>
          <p class="hint">${drawingLine}</p>
          <label class="block-label">
            Project status
            <select class="admin-project-status">
              ${statusOptions(p.project_status)}
            </select>
          </label>
          <div class="actions">
            <button type="button" class="admin-save-status">Update status</button>
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
      setStatus("Updating project status\u2026", "busy");
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
        setStatus("Project status updated", "ok");
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
  await send("session.open", { client_name: "acoustics-admin-web", client_version: "0.2.4" }, "session.opened");
  await send("exec.request", { code: 'INCLUDE "fixtures/acoustics/shared_building_api.basicpp"\n' }, "exec.completed");
  const bootRet = await invokeString("API_Bootstrap", []);
  if (!bootRet.startsWith("OK")) throw new Error(`API_Bootstrap failed: ${bootRet}`);
  setStatus(`Connected \xB7 session ${sessionId ?? "?"} \xB7 Postgres ready`, "ok");
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
    if (info.username !== "admin") {
      setStatus("Admin page is restricted to user 'admin'", "err");
      return;
    }
    showAdmin(info);
    await loadCustomers();
    setStatus("Admin signed in", "ok");
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
  setStatus("Signed out", "ok");
});
customerSelectEl.addEventListener("change", () => {
  void loadCustomerProjects(customerSelectEl.value);
});
refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  try {
    await loadCustomers();
    setStatus("Customer list refreshed", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    refreshBtn.disabled = false;
  }
});
bootstrapSession().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});
