/**
 * Shared Bestand-menu for engineer suite pages (engineer / floormap / GA).
 * Open · Recent · Project opslaan · Hernoemen · Verwijderen
 */

export type ProjectListItem = {
  building_id: string;
  label: string;
  external_ref?: string;
  customer_name?: string;
  project_status?: string;
  updated_at?: string;
};

export type ProjectMenuHost = {
  getToken: () => string | null;
  getBuildingId: () => string;
  getProjectMeta: () => { label: string; external_ref: string };
  invokeString: (name: string, args: string[]) => Promise<string>;
  apiAuthHeaders: () => HeadersInit;
  openBuilding: (id: string) => Promise<void>;
  saveProject: () => Promise<void>;
  onProjectDeleted?: () => void | Promise<void>;
  onProjectRenamed?: (meta: { label: string; external_ref: string }) => void;
  onStatus?: (state: "ok" | "busy" | "err", text: string) => void;
  /** Update page title / meta line with project name. */
  setTitle?: (title: string) => void;
};

const RECENT_KEY = "app-gevelwering-recent-projects";
const RECENT_MAX = 8;

type RecentEntry = { building_id: string; label: string; external_ref?: string; at: number };

function parseJsonOk<T>(raw: string): T {
  if (raw.startsWith("ERROR")) throw new Error(raw);
  return JSON.parse(raw) as T;
}

function projectTitle(meta: { label?: string; external_ref?: string; building_id?: string }): string {
  const label = (meta.label || "").trim();
  const ref = (meta.external_ref || "").trim();
  if (label && ref) return `${label} (${ref})`;
  if (label) return label;
  if (ref) return ref;
  const id = meta.building_id || "";
  return id ? `${id.slice(0, 8)}…` : "Geen project";
}

export function loadRecentProjects(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed.filter((p) => p?.building_id) : [];
  } catch {
    return [];
  }
}

export function rememberRecentProject(entry: {
  building_id: string;
  label?: string;
  external_ref?: string;
}): void {
  const id = entry.building_id.trim();
  if (!id) return;
  const next: RecentEntry = {
    building_id: id,
    label: (entry.label || "").trim(),
    external_ref: (entry.external_ref || "").trim() || undefined,
    at: Date.now(),
  };
  const rest = loadRecentProjects().filter((p) => p.building_id !== id);
  localStorage.setItem(RECENT_KEY, JSON.stringify([next, ...rest].slice(0, RECENT_MAX)));
}

export function removeRecentProject(buildingId: string): void {
  const id = buildingId.trim();
  if (!id) return;
  localStorage.setItem(
    RECENT_KEY,
    JSON.stringify(loadRecentProjects().filter((p) => p.building_id !== id)),
  );
}

async function cleanupProjectFolder(buildingId: string, headers: HeadersInit): Promise<void> {
  try {
    await fetch("/api/reports/cleanup-project-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ building_id: buildingId }),
    });
  } catch {
    /* best-effort */
  }
}

export type ProjectMenuApi = {
  refreshTitle: () => void;
  rememberCurrent: () => void;
  setEnabled: (on: boolean) => void;
};

export function mountProjectMenu(root: HTMLElement, host: ProjectMenuHost): ProjectMenuApi {
  root.classList.add("file-menu");
  root.innerHTML = `
    <div class="file-menu-bar">
      <details class="file-menu-details" id="pm-root">
        <summary class="file-menu-summary">Bestand</summary>
        <ul class="file-menu-list" role="menu">
          <li><button type="button" role="menuitem" data-act="open">Openen…</button></li>
          <li class="file-menu-recent-wrap">
            <details class="file-menu-recent">
              <summary>Recent</summary>
              <ul class="file-menu-recent-list" id="pm-recent"></ul>
            </details>
          </li>
          <li><button type="button" role="menuitem" data-act="save">Project opslaan</button></li>
          <li><button type="button" role="menuitem" data-act="rename">Hernoemen…</button></li>
          <li><button type="button" role="menuitem" data-act="delete" class="danger">Verwijderen…</button></li>
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

  const detailsEl = root.querySelector("#pm-root") as HTMLDetailsElement;
  const titleEl = root.querySelector("#pm-title") as HTMLElement;
  const recentEl = root.querySelector("#pm-recent") as HTMLUListElement;
  const dialogEl = root.querySelector("#pm-open-dialog") as HTMLDialogElement;
  const openListEl = root.querySelector("#pm-open-list") as HTMLUListElement;
  const openEmptyEl = root.querySelector("#pm-open-empty") as HTMLElement;

  function status(state: "ok" | "busy" | "err", text: string): void {
    host.onStatus?.(state, text);
  }

  function refreshTitle(): void {
    const id = host.getBuildingId();
    const meta = host.getProjectMeta();
    const title = projectTitle({ ...meta, building_id: id });
    titleEl.textContent = id ? title : "Geen project";
    host.setTitle?.(id ? title : "Geen project");
  }

  function rememberCurrent(): void {
    const id = host.getBuildingId();
    if (!id) return;
    const meta = host.getProjectMeta();
    rememberRecentProject({
      building_id: id,
      label: meta.label,
      external_ref: meta.external_ref,
    });
    renderRecent();
    refreshTitle();
  }

  function closeMenu(): void {
    detailsEl.open = false;
    const recent = root.querySelector(".file-menu-recent") as HTMLDetailsElement | null;
    if (recent) recent.open = false;
  }

  function renderRecent(): void {
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
        void openProject(p.building_id);
      });
      li.appendChild(btn);
      recentEl.appendChild(li);
    }
  }

  async function openProject(buildingId: string): Promise<void> {
    status("busy", "Project openen…");
    try {
      await host.openBuilding(buildingId);
      rememberCurrent();
      status("ok", "Project geopend");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }

  async function showOpenDialog(): Promise<void> {
    const token = host.getToken();
    if (!token) {
      status("err", "Log eerst in");
      return;
    }
    closeMenu();
    openListEl.innerHTML = "";
    openEmptyEl.classList.add("hidden");
    status("busy", "Projecten laden…");
    try {
      const ret = await host.invokeString("API_EngineerListProjects", [token]);
      const data = parseJsonOk<{ projects: ProjectListItem[] }>(ret);
      const projects = data.projects || [];
      if (!projects.length) {
        openEmptyEl.classList.remove("hidden");
      }
      for (const p of projects) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        const title = projectTitle(p);
        btn.textContent = p.customer_name ? `${title} — ${p.customer_name}` : title;
        if (p.project_status) {
          btn.title = p.project_status;
        }
        btn.addEventListener("click", () => {
          dialogEl.close();
          void openProject(p.building_id);
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

  async function saveProject(): Promise<void> {
    closeMenu();
    if (!host.getBuildingId()) {
      status("err", "Geen project geselecteerd");
      return;
    }
    status("busy", "Project opslaan…");
    try {
      await host.saveProject();
      rememberCurrent();
      status("ok", "Project opgeslagen");
    } catch (err) {
      status("err", err instanceof Error ? err.message : String(err));
    }
  }

  async function renameProject(): Promise<void> {
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
    const externalRef = window.prompt("Werknummer / externe referentie", meta.external_ref || "");
    if (externalRef === null) return;
    status("busy", "Hernoemen…");
    try {
      const ret = await host.invokeString("API_RenameProject", [
        token,
        id,
        label.trim(),
        externalRef.trim(),
      ]);
      const data = parseJsonOk<{ label?: string; external_ref?: string }>(ret);
      const next = {
        label: data.label ?? label.trim(),
        external_ref: data.external_ref ?? externalRef.trim(),
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

  async function deleteProject(): Promise<void> {
    closeMenu();
    const token = host.getToken();
    const id = host.getBuildingId();
    if (!token || !id) {
      status("err", "Geen project geselecteerd");
      return;
    }
    const title = projectTitle({ ...host.getProjectMeta(), building_id: id });
    if (
      !window.confirm(
        `Project «${title}» definitief verwijderen?\nDit wist berekeningen, tekeningen en rapportmappen. Dit kan niet ongedaan worden gemaakt.`,
      )
    ) {
      return;
    }
    status("busy", "Project verwijderen…");
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

  root.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest("button[data-act]") as HTMLButtonElement | null;
    if (!btn || !root.contains(btn)) return;
    const act = btn.dataset.act;
    if (act === "open") void showOpenDialog();
    else if (act === "save") void saveProject();
    else if (act === "rename") void renameProject();
    else if (act === "delete") void deleteProject();
  });

  document.addEventListener("click", (ev) => {
    if (!detailsEl.open) return;
    if (root.contains(ev.target as Node)) return;
    closeMenu();
  });

  renderRecent();
  refreshTitle();

  return {
    refreshTitle,
    rememberCurrent,
    setEnabled(on: boolean) {
      root.classList.toggle("disabled", !on);
      for (const b of root.querySelectorAll("button, summary")) {
        if (b instanceof HTMLElement) {
          if (on) b.removeAttribute("aria-disabled");
          else b.setAttribute("aria-disabled", "true");
        }
      }
    },
  };
}
