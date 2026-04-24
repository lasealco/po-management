/** Browser key for workbench table column visibility (non–PO/shipment columns). */
export const WORKBENCH_COLUMN_STORAGE_KEY = "ct-workbench-columns-v1";

/** `UserPreference.key` for cross-device workbench column defaults (server sync). */
export const CT_WORKBENCH_COLUMN_USER_PREF_KEY = "controlTower.workbenchColumnVisibility";

export const WORKBENCH_TOGGABLE_COLUMNS = [
  "status",
  "mode",
  "health",
  "customer",
  "lane",
  "eta",
  "ataDelay",
  "qtyWt",
  "owner",
  "route",
  "nextAction",
  "milestone",
  "updated",
] as const;

export type WorkbenchTogglableColumn = (typeof WORKBENCH_TOGGABLE_COLUMNS)[number];

export const WORKBENCH_COLUMN_LABELS: Record<WorkbenchTogglableColumn, string> = {
  status: "Status",
  mode: "Mode",
  health: "Health",
  customer: "Customer",
  lane: "Lane",
  eta: "ETA",
  ataDelay: "ATA / Delay",
  qtyWt: "Qty / Wt / Cbm",
  owner: "Owner / Queue",
  route: "Route",
  nextAction: "Next action",
  milestone: "Milestone / tracking",
  updated: "Updated",
};

export function defaultWorkbenchColumnVisibility(): Record<WorkbenchTogglableColumn, boolean> {
  return Object.fromEntries(WORKBENCH_TOGGABLE_COLUMNS.map((k) => [k, true])) as Record<
    WorkbenchTogglableColumn,
    boolean
  >;
}

export function parseWorkbenchColumnVisibility(raw: string | null): Partial<
  Record<WorkbenchTogglableColumn, boolean>
> {
  if (!raw) return {};
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Record<WorkbenchTogglableColumn, boolean>> = {};
    for (const k of WORKBENCH_TOGGABLE_COLUMNS) {
      if (typeof j[k] === "boolean") out[k] = j[k];
    }
    return out;
  } catch {
    return {};
  }
}

export function workbenchVisibleColumnCount(
  col: Record<WorkbenchTogglableColumn, boolean>,
  restrictedView: boolean,
): number {
  const fixed = 2;
  let n = fixed;
  for (const k of WORKBENCH_TOGGABLE_COLUMNS) {
    if (k === "owner" && restrictedView) continue;
    if (col[k] !== false) n += 1;
  }
  return n;
}
