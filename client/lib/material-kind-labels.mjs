/**
 * UI labels for material opbouw (single layer vs composite stack).
 * DB / API enum stays homogeneous | composite_stack.
 */

export const MATERIAL_KIND_HOMOGENEOUS = "homogeneous";
export const MATERIAL_KIND_COMPOSITE = "composite_stack";

/** @param {string | null | undefined} kind */
export function normalizeMaterialKind(kind) {
  return kind === MATERIAL_KIND_COMPOSITE ? MATERIAL_KIND_COMPOSITE : MATERIAL_KIND_HOMOGENEOUS;
}

/** @param {string | null | undefined} kind */
export function materialKindLabel(kind) {
  return normalizeMaterialKind(kind) === MATERIAL_KIND_COMPOSITE ? "Samengesteld" : "Enkellaags";
}

/** Lowercase for inline lists (floormap picker). */
/** @param {string | null | undefined} kind */
export function materialKindInline(kind) {
  return normalizeMaterialKind(kind) === MATERIAL_KIND_COMPOSITE ? "samengesteld" : "enkellaags";
}

/** @param {string | null | undefined} kind */
export function materialKindTitle(kind) {
  return normalizeMaterialKind(kind) === MATERIAL_KIND_COMPOSITE
    ? "Samengesteld — meerdere materiaallagen (buiten naar binnen)"
    : "Enkellaags — één materiaallaag (massief, plaat, glas, …)";
}

/** @param {string | null | undefined} kind */
export function materialKindBadgeClass(kind) {
  return normalizeMaterialKind(kind) === MATERIAL_KIND_COMPOSITE
    ? "mat-kind-badge mat-kind-composite"
    : "mat-kind-badge mat-kind-single";
}

/**
 * @param {string | null | undefined} kind
 * @param {(s: string) => string} escFn
 */
export function materialKindBadgeHtml(kind, escFn) {
  const k = normalizeMaterialKind(kind);
  return `<span class="${materialKindBadgeClass(k)}" title="${escFn(materialKindTitle(k))}">${escFn(materialKindLabel(k))}</span>`;
}
