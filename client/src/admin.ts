import { initPasswordToggles } from "./password-toggle";
import { resolveBppWsUrl } from "./ws-url";
import { BppSession, type AuthInfo } from "./shared/bpp-session";
import { esc, statusLabel, type ProjectStatus } from "./shared/dom-helpers";

type AdminCustomer = {
  customer_id: string;
  customer_name: string;
  username?: string;
  project_count: string;
  outstanding_count: string;
  drawing_count: string;
};

type AdminProject = {
  building_id: string;
  label: string;
  client_ref?: string;
  external_ref: string;
  project_status: ProjectStatus;
  created_at: string;
  drawing_count: string;
  drawing_names: string;
};

type AdminAccount = {
  user_id: string;
  username: string;
  email: string;
  display_name: string;
  is_active: boolean;
  must_change_password: boolean;
  customer_id: string | null;
  customer_name: string;
  project_count: number | string;
  created_at: string;
};

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
const customerHintEl = document.getElementById("admin-customer-hint") as HTMLElement | null;
const projectsPanelEl = document.getElementById("admin-projects-panel") as HTMLElement;
const customerTitleEl = document.getElementById("admin-customer-title") as HTMLElement;
const projectsListEl = document.getElementById("admin-projects-list") as HTMLElement;
const accountsListEl = document.getElementById("admin-accounts-list") as HTMLElement;
const accountsRefreshBtn = document.getElementById("admin-accounts-refresh-btn") as HTMLButtonElement | null;
const accountEditPanelEl = document.getElementById("admin-account-edit-panel") as HTMLElement | null;
const accountForm = document.getElementById("admin-account-form") as HTMLFormElement | null;
const accountUserIdEl = document.getElementById("admin-account-user-id") as HTMLInputElement | null;
const accountUsernameEl = document.getElementById("admin-account-username") as HTMLInputElement | null;
const accountDisplayNameEl = document.getElementById("admin-account-display-name") as HTMLInputElement | null;
const accountEmailEl = document.getElementById("admin-account-email") as HTMLInputElement | null;
const accountActiveEl = document.getElementById("admin-account-active") as HTMLInputElement | null;
const accountMetaEl = document.getElementById("admin-account-meta") as HTMLElement | null;
const accountEditTitleEl = document.getElementById("admin-account-edit-title") as HTMLElement | null;
const accountResetPwBtn = document.getElementById("admin-account-reset-pw-btn") as HTMLButtonElement | null;
const accountDeleteBtn = document.getElementById("admin-account-delete-btn") as HTMLButtonElement | null;
const accountCancelBtn = document.getElementById("admin-account-cancel-btn") as HTMLButtonElement | null;
const accountResetOutEl = document.getElementById("admin-account-reset-out") as HTMLElement | null;

function setStatus(text: string, kind: "busy" | "ok" | "err" = "busy"): void {
  connStatusEl.textContent = text;
  connBarEl.classList.remove("ok", "err", "busy", "status");
  connBarEl.classList.add("status", kind);
}

function setConnLed(connected: boolean): void {
  connLedEl.classList.toggle("connected", connected);
  connLedEl.classList.toggle("disconnected", !connected);
}

const session = new BppSession({
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
    },
  },
});

function showLogin(): void {
  loginPanelEl.classList.remove("hidden");
  adminPanelEl.classList.add("hidden");
  projectsPanelEl.classList.add("hidden");
  accountEditPanelEl?.classList.add("hidden");
  if (accountsListEl) accountsListEl.innerHTML = "";
}

function showAdmin(info: AuthInfo): void {
  loginPanelEl.classList.add("hidden");
  adminPanelEl.classList.remove("hidden");
  adminUserLabelEl.textContent = `Ingelogd als ${info.display_name || info.username}`;
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

function closeAccountEdit(): void {
  accountEditPanelEl?.classList.add("hidden");
  if (accountResetOutEl) {
    accountResetOutEl.hidden = true;
    accountResetOutEl.textContent = "";
  }
}

function fillAccountEdit(a: AdminAccount): void {
  if (!accountEditPanelEl || !accountForm) return;
  if (accountUserIdEl) accountUserIdEl.value = a.user_id;
  if (accountUsernameEl) accountUsernameEl.value = a.username;
  if (accountDisplayNameEl) accountDisplayNameEl.value = a.display_name || "";
  if (accountEmailEl) accountEmailEl.value = a.email || "";
  if (accountActiveEl) accountActiveEl.checked = Boolean(a.is_active);
  if (accountEditTitleEl) accountEditTitleEl.textContent = `Account: ${a.username}`;
  const projectCount = Number(a.project_count) || 0;
  if (accountMetaEl) {
    const cust = a.customer_name
      ? `Profielnaam: ${a.customer_name}`
      : "Nog geen profielnaam (alleen login)";
    const must = a.must_change_password ? " · moet wachtwoord wijzigen" : "";
    const proj =
      projectCount === 0
        ? " · geen projecten (mag verwijderd)"
        : ` · ${projectCount} project${projectCount === 1 ? "" : "en"} (verwijderen geblokkeerd)`;
    accountMetaEl.textContent = `${cust} · aangemaakt ${a.created_at || "—"}${must}${proj}`;
  }
  if (accountDeleteBtn) {
    accountDeleteBtn.disabled = projectCount > 0;
    accountDeleteBtn.title =
      projectCount > 0
        ? `Verwijderen niet mogelijk: ${projectCount} project(en)`
        : "Account en eventueel leeg profiel verwijderen";
  }
  if (accountResetOutEl) {
    accountResetOutEl.hidden = true;
    accountResetOutEl.textContent = "";
  }
  accountEditPanelEl.classList.remove("hidden");
  accountEditPanelEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function loadAccounts(): Promise<void> {
  if (!session.auth?.token || !accountsListEl) return;
  const ret = await session.invokeString("API_AdminListAccounts", [session.auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (ret.includes("login") || ret.includes("admin")) session.logout();
    return;
  }
  const parsed = JSON.parse(ret) as { accounts: AdminAccount[] };
  const accounts = parsed.accounts ?? [];
  if (!accounts.length) {
    accountsListEl.innerHTML = `<p class="hint">Nog geen opdrachtgever-accounts.</p>`;
    return;
  }
  accountsListEl.innerHTML = accounts
    .map((a) => {
      const activeBit = a.is_active ? "actief" : "geblokkeerd";
      const cust = a.customer_name || "—";
      const must = a.must_change_password ? " · wachtwoord wijzigen" : "";
      const projectCount = Number(a.project_count) || 0;
      const projBit =
        projectCount === 0
          ? " · geen projecten"
          : ` · ${projectCount} project${projectCount === 1 ? "" : "en"}`;
      return `
        <article class="panel admin-project-card${a.is_active ? "" : " admin-project-finished"}" data-user-id="${esc(a.user_id)}">
          <h3>${esc(a.username)} <span class="hint">(${esc(a.display_name || "geen weergavenaam")})</span></h3>
          <p class="hint">${esc(a.email || "geen e-mail")} · ${activeBit}${must}${projBit}</p>
          <p class="hint">Profielnaam: ${esc(cust)}</p>
          <div class="actions">
            <button type="button" class="admin-account-edit">Bewerken</button>
          </div>
        </article>`;
    })
    .join("");

  for (const btn of accountsListEl.querySelectorAll<HTMLButtonElement>(".admin-account-edit")) {
    btn.addEventListener("click", () => {
      const card = btn.closest<HTMLElement>("[data-user-id]");
      const id = card?.dataset.userId || "";
      const a = accounts.find((x) => x.user_id === id);
      if (a) fillAccountEdit(a);
    });
  }
}

async function loadCustomers(): Promise<void> {
  if (!session.auth?.token) return;
  const prev = customerSelectEl.value;
  if (customerHintEl) customerHintEl.textContent = "Opdrachtgevers laden…";
  const ret = await session.invokeString("API_AdminListCustomers", [session.auth.token]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    if (customerHintEl) customerHintEl.textContent = ret.replace(/^ERROR:\s*/, "");
    if (ret.includes("login") || ret.includes("admin")) session.logout();
    return;
  }
  const parsed = JSON.parse(ret) as { customers: AdminCustomer[] };
  const customers = parsed.customers ?? [];
  customerSelectEl.innerHTML = "";
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "— kies een opdrachtgever —";
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
    const login = (c.username || "").trim();
    const label = login
      ? login === c.customer_name
        ? login
        : `${login} — ${c.customer_name}`
      : c.customer_name;
    opt.textContent = `${label} (${total} project${total === 1 ? "" : "en"}${suffix}${drawingSuffix})`;
    customerSelectEl.appendChild(opt);
  }

  if (customerHintEl) {
    customerHintEl.textContent = customers.length
      ? `${customers.length} actieve opdrachtgever${customers.length === 1 ? "" : "s"} met projecten.`
      : "Geen actieve opdrachtgevers met projecten in deze app.";
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
  if (!session.auth?.token || !customerId) {
    projectsPanelEl.classList.add("hidden");
    return;
  }
  const ret = await session.invokeString("API_AdminListCustomerProjects", [session.auth.token, customerId]);
  if (ret.startsWith("ERROR")) {
    setStatus(ret, "err");
    return;
  }
  const parsed = JSON.parse(ret) as { projects: AdminProject[] };
  const projects = parsed.projects ?? [];
  const customerName =
    customerSelectEl.options[customerSelectEl.selectedIndex]?.textContent?.split(" (")[0] ||
    "opdrachtgever";

  projectsPanelEl.classList.remove("hidden");
  customerTitleEl.textContent = `Projecten van ${customerName}`;

  if (projects.length === 0) {
    projectsListEl.innerHTML = `<p class="hint">Geen projecten voor deze opdrachtgever.</p>`;
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
      const refVal = esc(p.external_ref || "");
      return `
        <section class="panel admin-project-card${outstanding ? "" : " admin-project-finished"}" data-building-id="${esc(p.building_id)}">
          <h3>${esc(p.label || "(geen label)")}${outstanding ? "" : " · afgerond"}</h3>
          <p class="hint">Kenmerk opdrachtgever: ${esc(p.client_ref || "—")} · Aangemaakt: ${esc(p.created_at || "—")}</p>
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
    })
    .join("");

  for (const btn of projectsListEl.querySelectorAll<HTMLButtonElement>(".admin-save-status")) {
    btn.addEventListener("click", async () => {
      const card = btn.closest<HTMLElement>(".admin-project-card");
      const select = card?.querySelector<HTMLSelectElement>(".admin-project-status");
      const numberEl = card?.querySelector<HTMLInputElement>(".admin-project-number");
      if (!card || !select || !session.auth?.token) return;
      btn.disabled = true;
      setStatus("Project bijwerken…", "busy");
      try {
        const ret2 = await session.invokeString("API_AdminUpdateProjectStatus", [
          session.auth.token,
          card.dataset.buildingId || "",
          select.value,
          (numberEl?.value || "").trim(),
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
  setStatus("Inloggen…", "busy");
  try {
    const info = await session.bootstrapAndLogin(
      String(new FormData(loginForm).get("username") ?? "").trim(),
      String(new FormData(loginForm).get("password") ?? ""),
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
    /* ignore */
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
    setStatus("Account opslaan…", "busy");
    const ret = await session.invokeString("API_AdminUpdateAccount", [
      session.auth.token,
      uid,
      accountDisplayNameEl?.value.trim() || "",
      accountEmailEl?.value.trim() || "",
      accountActiveEl?.checked ? "true" : "false",
    ]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    setStatus("Account bijgewerkt", "ok");
    await loadAccounts();
    const listRet = await session.invokeString("API_AdminListAccounts", [session.auth.token]);
    if (!listRet.startsWith("ERROR")) {
      const parsed = JSON.parse(listRet) as { accounts: AdminAccount[] };
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
    setStatus("Wachtwoord resetten…", "busy");
    const ret = await session.invokeString("API_AdminResetAccountPassword", [session.auth.token, uid]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    const parsed = JSON.parse(ret) as {
      username?: string;
      access_password?: string;
    };
    if (accountResetOutEl) {
      accountResetOutEl.hidden = false;
      accountResetOutEl.textContent = `Tijdelijk wachtwoord voor ${parsed.username || "account"}: ${parsed.access_password || "—"} (eenmalig tonen; gebruiker moet wijzigen bij login).`;
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
    if (
      !confirm(
        `Account «${uname}» definitief verwijderen?\n\nAlleen toegestaan als er nog geen projecten zijn. Dit kan niet ongedaan worden gemaakt.`,
      )
    ) {
      return;
    }
    setStatus("Account verwijderen…", "busy");
    const ret = await session.invokeString("API_AdminDeleteAccount", [session.auth.token, uid]);
    if (ret.startsWith("ERROR")) {
      setStatus(ret, "err");
      return;
    }
    closeAccountEdit();
    await loadAccounts();
    await loadCustomers();
    setStatus(`Account «${uname}» verwijderd`, "ok");
  })().catch((e) => setStatus(String(e), "err"));
});

initPasswordToggles();
session.connect({ reconnectMs: 1500 });
