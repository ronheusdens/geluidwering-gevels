/**
 * Huidige VR in de procesflow (floormap ↔ GA).
 * Gedeeld via sessionStorage + URL ?vr_nr= / ?vg_nr=.
 */

export type FlowVr = {
  vr_nr: string;
  vg_nr: number | null;
};

function key(bid: string): string {
  return `app-gevelwering-flow-vr:${bid.trim().toLowerCase()}`;
}

export function normalizeFlowVrNr(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return s || null;
}

export function flowVrNrsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeFlowVrNr(a);
  const y = normalizeFlowVrNr(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const nx = Number(x);
  const ny = Number(y);
  return Number.isFinite(nx) && Number.isFinite(ny) && nx === ny;
}

export function clearFlowVr(buildingId: string): void {
  const bid = String(buildingId || "").trim();
  if (!bid) return;
  try {
    sessionStorage.removeItem(key(bid));
  } catch {
    /* ignore */
  }
}

export function persistFlowVr(
  buildingId: string,
  vrNr: string | null | undefined,
  vgNr?: number | null,
): void {
  const bid = String(buildingId || "").trim();
  if (!bid) return;
  const vr = normalizeFlowVrNr(vrNr);
  if (!vr) {
    clearFlowVr(bid);
    return;
  }
  const payload: FlowVr = {
    vr_nr: vr,
    vg_nr: vgNr != null && Number.isFinite(Number(vgNr)) ? Number(vgNr) : null,
  };
  try {
    sessionStorage.setItem(key(bid), JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function readFlowVr(buildingId: string): FlowVr | null {
  const bid = String(buildingId || "").trim();
  if (!bid) return null;
  try {
    const raw = sessionStorage.getItem(key(bid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FlowVr;
    const vr = normalizeFlowVrNr(parsed?.vr_nr);
    if (!vr) return null;
    const vg =
      parsed.vg_nr != null && Number.isFinite(Number(parsed.vg_nr)) ? Number(parsed.vg_nr) : null;
    return { vr_nr: vr, vg_nr: vg };
  } catch {
    return null;
  }
}

export function pickFlowVrNr(
  available: string[],
  prefer: string | null | undefined,
): string {
  if (!prefer || !available.length) return "";
  const hit = available.find((v) => flowVrNrsEqual(v, prefer));
  return hit || "";
}
