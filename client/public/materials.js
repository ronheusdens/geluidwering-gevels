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

// src/materials.ts
var BPP_WS = resolveBppWsUrl();
var AUTH_KEY = "acoustics_admin_auth";
var connBarEl = document.getElementById("mat-conn-bar");
var connLedEl = document.getElementById("mat-conn-led");
var connStatusEl = document.getElementById("mat-conn-status");
var loginPanelEl = document.getElementById("mat-login-panel");
var loginForm = document.getElementById("mat-login-form");
var loginBtn = document.getElementById("mat-login-btn");
var panelEl = document.getElementById("mat-panel");
var userLabelEl = document.getElementById("mat-user-label");
var logoutBtn = document.getElementById("mat-logout-btn");
var filterForm = document.getElementById("mat-filter-form");
var qEl = document.getElementById("mat-q");
var categoryEl = document.getElementById("mat-category");
var pagerLabelEl = document.getElementById("mat-pager-label");
var prevBtn = document.getElementById("mat-prev-btn");
var nextBtn = document.getElementById("mat-next-btn");
var newBtn = document.getElementById("mat-new-btn");
var listboxEl = document.getElementById("mat-listbox");
var tbodyEl = document.getElementById("mat-tbody");
var editorTitleEl = document.getElementById("mat-editor-title");
var editorForm = document.getElementById("mat-editor-form");
var idEl = document.getElementById("mat-id");
var catalogIdEl = document.getElementById("mat-catalog-id");
var noEl = document.getElementById("mat-no");
var masterEl = document.getElementById("mat-master");
var nameEl = document.getElementById("mat-name");
var catEl = document.getElementById("mat-cat");
var sourceRefEl = document.getElementById("mat-source-ref");
var sourceEl = document.getElementById("mat-source");
var spectrumOkEl = document.getElementById("mat-spectrum-ok");
var thickEl = document.getElementById("mat-thick");
var weightEl = document.getElementById("mat-weight");
var raEl = document.getElementById("mat-ra");
var t1El = document.getElementById("mat-t1");
var cavEl = document.getElementById("mat-cav");
var t2El = document.getElementById("mat-t2");
var r63El = document.getElementById("mat-r63");
var r125El = document.getElementById("mat-r125");
var r250El = document.getElementById("mat-r250");
var r500El = document.getElementById("mat-r500");
var r1000El = document.getElementById("mat-r1000");
var r2000El = document.getElementById("mat-r2000");
var saveBtn = document.getElementById("mat-save-btn");
var deleteBtn = document.getElementById("mat-delete-btn");
var clearBtn = document.getElementById("mat-clear-btn");
var ws = null;
var sessionId = null;
var auth = null;
var reqCounter = 0;
var offset = 0;
var total = 0;
var selectedId = null;
var listRows = [];
var PAGE_SIZE = 10;
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
  panelEl.classList.add("hidden");
}
function showAdmin(info) {
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
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function clearEditor() {
  selectedId = null;
  highlightSelection();
  idEl.value = "";
  catalogIdEl.value = "";
  noEl.value = "";
  masterEl.value = "Elementen";
  nameEl.value = "";
  catEl.value = "";
  sourceRefEl.value = "";
  sourceEl.value = "catalogusGG.pdf";
  spectrumOkEl.checked = true;
  thickEl.value = "";
  weightEl.value = "";
  raEl.value = "";
  t1El.value = "";
  cavEl.value = "";
  t2El.value = "";
  r63El.value = "";
  r125El.value = "";
  r250El.value = "";
  r500El.value = "";
  r1000El.value = "";
  r2000El.value = "";
  editorTitleEl.textContent = "New material";
  deleteBtn.disabled = true;
}
function fillEditor(m) {
  selectedId = m.material_id || null;
  idEl.value = m.material_id || "";
  catalogIdEl.value = m.catalog_id || "";
  noEl.value = m.material_no === "" || m.material_no == null ? "" : String(m.material_no);
  masterEl.value = m.master_category || "";
  nameEl.value = m.name || "";
  catEl.value = m.category || "";
  sourceRefEl.value = m.source_ref || "";
  sourceEl.value = m.source || "catalogusGG.pdf";
  spectrumOkEl.checked = m.spectrum_ok === "true" || m.spectrum_ok === "t";
  thickEl.value = m.thickness_mm || "";
  weightEl.value = m.weight_kg_m2 || "";
  raEl.value = m.ra_dba || "";
  t1El.value = m.glass_t1_mm || "";
  cavEl.value = m.glass_cavity_mm || "";
  t2El.value = m.glass_t2_mm || "";
  r63El.value = m.r_63_hz || "";
  r125El.value = m.r_125_hz || "";
  r250El.value = m.r_250_hz || "";
  r500El.value = m.r_500_hz || "";
  r1000El.value = m.r_1000_hz || "";
  r2000El.value = m.r_2000_hz || "";
  editorTitleEl.textContent = m.material_id ? `Edit \xB7 ${m.catalog_id || ""} \xB7 ${m.name}` : "New material";
  deleteBtn.disabled = !m.material_id;
  highlightSelection();
}
function highlightSelection() {
  for (const tr of tbodyEl.querySelectorAll("tr[data-id]")) {
    const on = !!selectedId && tr.dataset.id === selectedId;
    tr.classList.toggle("selected", on);
    tr.setAttribute("aria-selected", on ? "true" : "false");
    if (on) tr.scrollIntoView({ block: "nearest" });
  }
}
function limit() {
  return PAGE_SIZE;
}
function updatePager() {
  const lim = limit();
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + lim, total);
  pagerLabelEl.textContent = total === 0 ? "No materials match." : `Showing ${from}\u2013${to} of ${total}`;
  prevBtn.disabled = offset <= 0;
  nextBtn.disabled = offset + lim >= total;
}
function selectFromList(id) {
  const row = listRows.find((m) => m.material_id === id);
  if (!row) return;
  fillEditor(row);
  setStatus(`Selected ${row.name}`, "ok");
  listboxEl.focus({ preventScroll: true });
}
function moveSelection(delta) {
  if (listRows.length === 0) return;
  const idx = selectedId ? listRows.findIndex((m) => m.material_id === selectedId) : -1;
  let next = idx + delta;
  if (idx < 0) next = delta > 0 ? 0 : listRows.length - 1;
  if (next < 0) next = 0;
  if (next >= listRows.length) next = listRows.length - 1;
  const row = listRows[next];
  if (row) selectFromList(row.material_id);
}
async function loadList(preferId) {
  if (!auth?.token) return;
  const lim = limit();
  const ret = await invokeString("API_AdminListMaterials", [
    auth.token,
    qEl.value.trim(),
    categoryEl.value,
    String(lim),
    String(offset)
  ]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("admin")) showLogin();
    return;
  }
  const parsed = JSON.parse(ret);
  total = Number(parsed.total) || 0;
  listRows = parsed.materials ?? [];
  tbodyEl.innerHTML = listRows.map(
    (m) => `
      <tr data-id="${esc(m.material_id)}" role="option" tabindex="-1">
        <td>${esc(m.catalog_id || "")}</td>
        <td>${esc(m.master_category || "")}</td>
        <td class="mat-name-cell">${esc(m.name)}</td>
        <td>${esc(m.thickness_mm || "")}</td>
        <td>${esc(m.weight_kg_m2 || "")}</td>
        <td>${esc(m.ra_dba || "")}</td>
        <td>${esc(m.r_63_hz || "")}</td>
        <td>${esc(m.r_125_hz || "")}</td>
        <td>${esc(m.r_250_hz || "")}</td>
        <td>${esc(m.r_500_hz || "")}</td>
        <td>${esc(m.r_1000_hz || "")}</td>
        <td>${esc(m.r_2000_hz || "")}</td>
      </tr>`
  ).join("");
  updatePager();
  const want = preferId ?? selectedId;
  const pick = want && listRows.find((m) => m.material_id === want) || listRows[0] || null;
  if (pick) {
    fillEditor(pick);
    setStatus(`Loaded ${listRows.length} \xB7 ${pick.name}`, "ok");
  } else {
    clearEditor();
    setStatus(total === 0 ? "No materials match" : `Loaded ${listRows.length} materials`, "ok");
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
  await send("session.open", { client_name: "acoustics-materials-web", client_version: "0.2.12" }, "session.opened");
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
        await loadList();
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
      setStatus("Material editor is restricted to user 'admin'", "err");
      return;
    }
    showAdmin(info);
    offset = 0;
    await loadList();
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
filterForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  offset = 0;
  try {
    await loadList();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  }
});
prevBtn.addEventListener("click", async () => {
  offset = Math.max(0, offset - limit());
  selectedId = null;
  await loadList();
});
nextBtn.addEventListener("click", async () => {
  offset = offset + limit();
  selectedId = null;
  await loadList();
});
newBtn.addEventListener("click", () => {
  clearEditor();
  nameEl.focus();
});
clearBtn.addEventListener("click", () => clearEditor());
tbodyEl.addEventListener("click", (ev) => {
  const tr = ev.target.closest("tr[data-id]");
  if (!tr) return;
  selectFromList(tr.getAttribute("data-id") || "");
});
listboxEl.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    moveSelection(1);
    return;
  }
  if (ev.key === "ArrowUp") {
    ev.preventDefault();
    moveSelection(-1);
    return;
  }
  if (ev.key === "Home") {
    ev.preventDefault();
    if (listRows[0]) selectFromList(listRows[0].material_id);
    return;
  }
  if (ev.key === "End") {
    ev.preventDefault();
    const last = listRows[listRows.length - 1];
    if (last) selectFromList(last.material_id);
    return;
  }
  if (ev.key === "Enter" || ev.key === " ") {
    ev.preventDefault();
    if (selectedId) selectFromList(selectedId);
    else if (listRows[0]) selectFromList(listRows[0].material_id);
  }
});
editorForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!auth?.token) return;
  saveBtn.disabled = true;
  setStatus("Saving material\u2026", "busy");
  try {
    const ret = await invokeString("API_AdminSaveMaterial", [
      auth.token,
      idEl.value.trim(),
      catalogIdEl.value.trim(),
      masterEl.value.trim(),
      noEl.value.trim(),
      nameEl.value.trim(),
      catEl.value.trim(),
      thickEl.value.trim(),
      weightEl.value.trim(),
      raEl.value.trim(),
      sourceRefEl.value.trim(),
      spectrumOkEl.checked ? "true" : "false",
      r63El.value.trim(),
      r125El.value.trim(),
      r250El.value.trim(),
      r500El.value.trim(),
      r1000El.value.trim(),
      r2000El.value.trim(),
      sourceEl.value.trim() || "catalogusGG.pdf"
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const saved = JSON.parse(ret);
    setStatus(saved.created ? "Material created" : "Material updated", "ok");
    await loadList(saved.material_id || null);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    saveBtn.disabled = false;
  }
});
deleteBtn.addEventListener("click", async () => {
  if (!auth?.token || !idEl.value) return;
  if (!window.confirm(`Delete material \u201C${nameEl.value || idEl.value}\u201D?`)) return;
  deleteBtn.disabled = true;
  setStatus("Deleting\u2026", "busy");
  try {
    const ret = await invokeString("API_AdminDeleteMaterial", [auth.token, idEl.value]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    selectedId = null;
    await loadList();
    setStatus("Material deleted", "ok");
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "err");
  } finally {
    deleteBtn.disabled = !idEl.value;
  }
});
bootstrapSession().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});
