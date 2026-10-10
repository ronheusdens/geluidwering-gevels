/**
 * Stotaal / materiaalsom per geveloriëntatie · gevelgroep.
 *
 * Verwerkingsregel 1 — hiërarchie van componenten (zonder ±-composities):
 *   gevel (grootste) ⊃ openingen (kozijnen) ⊃ ruiten
 * Stotaal = bruto gevelcontour. Netto muur = gevel − openingen; materialen
 * tellen als netto muur + kozijn + glas ≈ Stotaal. Expliciete ± blijft alleen
 * voor uitzonderingen (bijv. unie van muurdelen).
 */

export type GevelCoverageRow = {
  /** Optioneel: matching voor effectieve opp. per component. */
  id?: string | null;
  area_m2: number | null | undefined;
  kozijn_role?: string | null;
  boolean_op?: string | null;
  material_id?: string | null;
  orientatie?: string | null;
  gevelgroep_nr?: number | null;
  quantity_kind?: string | null;
  /** Bij ±: bronnen met teken (+ buitencontour, − openingen). */
  constituents?: Array<{ sign?: string | null; area_m2?: number | null }> | null;
};

export function gevelgroepNrOf(row: GevelCoverageRow): number {
  const n = Number(row.gevelgroep_nr);
  return n === 2 || n === 3 ? n : 1;
}

function rowAreaM2(row: GevelCoverageRow): number {
  const a = row.area_m2;
  return a != null && Number.isFinite(Number(a)) ? Number(a) : 0;
}

export function isKozijnFacadeRole(role: string | null | undefined): boolean {
  const r = String(role || "").trim();
  return r === "wood" || r === "glass";
}

export function isComposeBooleanOp(op: string | null | undefined): boolean {
  const o = String(op || "").toLowerCase();
  return o === "compose" || o === "difference";
}

function filterPool(rows: GevelCoverageRow[], ori: string, groepNr: number): GevelCoverageRow[] {
  const wantGg = groepNr === 2 || groepNr === 3 ? groepNr : 1;
  return rows.filter((r) => {
    if (String(r.orientatie || "").trim().toUpperCase() !== ori) return false;
    if (gevelgroepNrOf(r) !== wantGg) return false;
    if (String(r.quantity_kind || "area") === "length") return false;
    if (!(String(r.material_id || "").trim())) return false;
    return rowAreaM2(r) > 0;
  });
}

type HierarchyParts = {
  composes: GevelCoverageRow[];
  /** Grootste losse gevelcontour(en). */
  primaryGevels: GevelCoverageRow[];
  /** Andere wanddelen (geen auto-aftrek). */
  secondaryGevels: GevelCoverageRow[];
  /** Kozijnen/ruiten (role of duidelijk kleiner dan gevel). */
  openings: GevelCoverageRow[];
};

/**
 * Regel 1: grootste plain = gevel; kozijn_role + duidelijk kleinere plains = openingen.
 * Secondary walls (≥ 50% van max) blijven aparte geveldelen (unie via ± indien nodig).
 */
function classifyHierarchy(pool: GevelCoverageRow[]): HierarchyParts {
  const composes = pool.filter((r) => isComposeBooleanOp(r.boolean_op));
  const roleOpenings = pool.filter(
    (r) => !isComposeBooleanOp(r.boolean_op) && isKozijnFacadeRole(r.kozijn_role),
  );
  const plain = pool.filter(
    (r) => !isComposeBooleanOp(r.boolean_op) && !isKozijnFacadeRole(r.kozijn_role),
  );

  const primaryGevels: GevelCoverageRow[] = [];
  const secondaryGevels: GevelCoverageRow[] = [];
  const nestedPlain: GevelCoverageRow[] = [];

  if (plain.length) {
    const maxA = Math.max(...plain.map(rowAreaM2));
    for (const r of plain) {
      const a = rowAreaM2(r);
      if (a >= maxA - 0.021) primaryGevels.push(r);
      else if (a < maxA * 0.5) nestedPlain.push(r);
      else secondaryGevels.push(r);
    }
  }

  return {
    composes,
    primaryGevels,
    secondaryGevels,
    openings: [...roleOpenings, ...nestedPlain],
  };
}

function openingSumM2(parts: HierarchyParts): number {
  return parts.openings.reduce((s, r) => s + rowAreaM2(r), 0);
}

function sameRow(a: GevelCoverageRow, b: GevelCoverageRow): boolean {
  if (a === b) return true;
  const aid = String(a.id || "").trim();
  const bid = String(b.id || "").trim();
  if (aid && bid) return aid === bid;
  return (
    rowAreaM2(a) === rowAreaM2(b) &&
    String(a.kozijn_role || "") === String(b.kozijn_role || "") &&
    String(a.material_id || "") === String(b.material_id || "") &&
    String(a.boolean_op || "") === String(b.boolean_op || "")
  );
}

/**
 * Bruto gevelcontour (Stotaal) — nooit alleen ±-netto.
 *
 * Bij expliciete ±: +bron (bruto) of netto + openingen.
 * Zonder ± (regel 1): grootste primaire gevel.
 */
export function gevelContourStotaalM2(
  rows: GevelCoverageRow[],
  ori: string,
  groepNr: number,
): number {
  const pool = filterPool(rows, ori, groepNr);
  if (!pool.length) return 0;

  const parts = classifyHierarchy(pool);

  // 1) ±: Stotaal = +bron (bruto) of netto + afgetrokken openingen — niet de netto alleen.
  if (parts.composes.length) {
    let best = 0;
    const openingsInPool = openingSumM2(parts);
    for (const c of parts.composes) {
      const net = rowAreaM2(c);
      let plusMax = 0;
      let minusSum = 0;
      for (const part of c.constituents || []) {
        const a =
          part.area_m2 != null && Number.isFinite(Number(part.area_m2))
            ? Number(part.area_m2)
            : 0;
        if (!(a > 0)) continue;
        if (String(part.sign || "") === "+") plusMax = Math.max(plusMax, a);
        else if (String(part.sign || "") === "-") minusSum += a;
      }
      const fromParts = plusMax > 0 ? plusMax : net + minusSum;
      const fromPoolOpenings = net + openingsInPool;
      best = Math.max(best, fromParts, fromPoolOpenings, net);
    }
    return Math.round(best * 100) / 100;
  }

  // 2) Regel 1: Stotaal = grootste gevel (primair).
  if (parts.primaryGevels.length) {
    return Math.round(Math.max(...parts.primaryGevels.map(rowAreaM2)) * 100) / 100;
  }

  return Math.round(Math.max(...pool.map(rowAreaM2)) * 100) / 100;
}

/**
 * Effectieve materiaalsom onder regel 1: netto gevel + openingen (= bruto gevel
 * wanneer openingen in de gevel zitten). Met ±: som van eligible rijen (bruto
 * al vervangen door netto-composities).
 */
export function gevelMaterialSumM2(
  rows: GevelCoverageRow[],
  ori: string,
  groepNr: number,
): number {
  const pool = filterPool(rows, ori, groepNr);
  if (!pool.length) return 0;

  const parts = classifyHierarchy(pool);

  // Expliciete ±-route: geen auto-hiërarchie (eligible bevat al netto-resultaten).
  if (parts.composes.length) {
    const sum = pool.reduce((s, r) => s + rowAreaM2(r), 0);
    return Math.round(sum * 100) / 100;
  }

  const openingSum = openingSumM2(parts);
  const primaryBruto = parts.primaryGevels.reduce((s, r) => s + rowAreaM2(r), 0);
  const secondary = parts.secondaryGevels.reduce((s, r) => s + rowAreaM2(r), 0);

  if (parts.primaryGevels.length && openingSum > 0) {
    const netPrimary = Math.max(0, primaryBruto - openingSum);
    return Math.round((netPrimary + openingSum + secondary) * 100) / 100;
  }

  return Math.round((primaryBruto + secondary + openingSum) * 100) / 100;
}

/**
 * Effectieve opp. van één rij onder regel 1 (voor GA-vlak / picklist).
 * Primaire gevel → netto (bruto − openingen); openingen en ± ongewijzigd.
 */
export function gevelHierarchyEffectiveAreaM2(
  rows: GevelCoverageRow[],
  ori: string,
  groepNr: number,
  row: GevelCoverageRow,
): number {
  const base = rowAreaM2(row);
  if (!(base > 0)) return 0;
  if (isComposeBooleanOp(row.boolean_op) || isKozijnFacadeRole(row.kozijn_role)) {
    return Math.round(base * 100) / 100;
  }

  const pool = filterPool(rows, ori, groepNr);
  if (!pool.length) return Math.round(base * 100) / 100;

  const parts = classifyHierarchy(pool);
  if (parts.composes.length) {
    return Math.round(base * 100) / 100;
  }

  const openingSum = openingSumM2(parts);
  if (!(openingSum > 0) || !parts.primaryGevels.length) {
    return Math.round(base * 100) / 100;
  }

  const isOpening = parts.openings.some((o) => sameRow(o, row));
  if (isOpening) return Math.round(base * 100) / 100;

  const isPrimary = parts.primaryGevels.some((g) => sameRow(g, row));
  if (!isPrimary) return Math.round(base * 100) / 100;

  // Eén primaire gevel: alle openingen aftrekken. Meerdere gelijke max: evenredig.
  const primaryBruto = parts.primaryGevels.reduce((s, r) => s + rowAreaM2(r), 0);
  const share = primaryBruto > 0 ? base / primaryBruto : 1;
  const net = Math.max(0, base - openingSum * share);
  return Math.round(net * 100) / 100;
}

/** true als regel 1 van toepassing is (geen ±, wel gevel + openingen). */
export function gevelHierarchyApplies(
  rows: GevelCoverageRow[],
  ori: string,
  groepNr: number,
): boolean {
  const pool = filterPool(rows, ori, groepNr);
  if (!pool.length) return false;
  const parts = classifyHierarchy(pool);
  return !parts.composes.length && parts.primaryGevels.length > 0 && parts.openings.length > 0;
}

export function gevelMaterialExceedsContour(
  rows: GevelCoverageRow[],
  ori: string,
  groepNr: number,
  tol = 0.02,
): boolean {
  const contour = gevelContourStotaalM2(rows, ori, groepNr);
  const sum = gevelMaterialSumM2(rows, ori, groepNr);
  return contour > 0 && sum > contour + tol;
}
