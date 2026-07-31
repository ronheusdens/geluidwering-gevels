/** Horizontal resize between viewer and sidebar in `.engineer-layout`. */

const STORAGE_KEY = "app-gevelwering-sidebar-width-px";
const MIN_SIDEBAR_PX = 260;
const MIN_VIEWER_PX = 280;
const DEFAULT_SIDEBAR_PX = 420;

function clampSidebarWidth(layout: HTMLElement, widthPx: number): number {
  const rect = layout.getBoundingClientRect();
  const handle = layout.querySelector(".engineer-split-handle") as HTMLElement | null;
  const handleW = handle?.offsetWidth ?? 8;
  // Layout may be hidden (width 0) during early init — don't crush stored width.
  if (rect.width < MIN_SIDEBAR_PX + MIN_VIEWER_PX + handleW) {
    return Math.min(Math.max(widthPx, MIN_SIDEBAR_PX), 760);
  }
  const max = Math.max(MIN_SIDEBAR_PX, rect.width - MIN_VIEWER_PX - handleW);
  return Math.min(Math.max(widthPx, MIN_SIDEBAR_PX), max);
}

function applySidebarWidth(layout: HTMLElement, widthPx: number): void {
  const clamped = clampSidebarWidth(layout, widthPx);
  layout.style.setProperty("--engineer-sidebar-width", `${Math.round(clamped)}px`);
}

export function getEngineerSidebarWidthPx(root: ParentNode = document): number | null {
  const layout = root.querySelector(".engineer-layout") as HTMLElement | null;
  if (layout) {
    const current = Number.parseFloat(
      getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width"),
    );
    if (Number.isFinite(current) && current > 0) return Math.round(current);
  }
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  return null;
}

export function setEngineerSidebarWidthPx(widthPx: number, root: ParentNode = document): void {
  const layout = root.querySelector(".engineer-layout") as HTMLElement | null;
  if (!layout || !(widthPx > 0)) return;
  applySidebarWidth(layout, widthPx);
  const applied = Number.parseFloat(
    getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width"),
  );
  if (Number.isFinite(applied) && applied > 0) {
    localStorage.setItem(STORAGE_KEY, String(Math.round(applied)));
  }
}

export function initEngineerLayoutSplit(root: ParentNode = document): void {
  const layout = root.querySelector(".engineer-layout") as HTMLElement | null;
  const handle = root.querySelector(".engineer-split-handle") as HTMLElement | null;
  if (!layout || !handle) return;

  const stored = Number(localStorage.getItem(STORAGE_KEY));
  const initial = Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_SIDEBAR_PX;
  applySidebarWidth(layout, initial);

  const onResize = () => {
    const current = Number.parseFloat(
      getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width"),
    );
    if (Number.isFinite(current) && current > 0) applySidebarWidth(layout, current);
  };
  window.addEventListener("resize", onResize);

  let dragging = false;
  let pointerId: number | null = null;

  const endDrag = (evt?: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    layout.classList.remove("is-resizing");
    document.body.classList.remove("engineer-resizing");
    if (evt && pointerId != null) {
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    }
    pointerId = null;
    const current = Number.parseFloat(
      getComputedStyle(layout).getPropertyValue("--engineer-sidebar-width"),
    );
    if (Number.isFinite(current) && current > 0) {
      localStorage.setItem(STORAGE_KEY, String(Math.round(current)));
    }
  };

  handle.addEventListener("pointerdown", (evt) => {
    if (evt.button !== 0) return;
    if (window.matchMedia("(max-width: 1100px)").matches) return;
    evt.preventDefault();
    dragging = true;
    pointerId = evt.pointerId;
    layout.classList.add("is-resizing");
    document.body.classList.add("engineer-resizing");
    handle.setPointerCapture(evt.pointerId);
  });

  handle.addEventListener("pointermove", (evt) => {
    if (!dragging) return;
    const rect = layout.getBoundingClientRect();
    applySidebarWidth(layout, rect.right - evt.clientX);
  });

  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);
  handle.addEventListener("lostpointercapture", () => {
    if (dragging) endDrag();
  });
}
