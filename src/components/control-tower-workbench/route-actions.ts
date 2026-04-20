import type { WorkbenchRow } from "@/components/control-tower-workbench/types";

export const ROUTE_ACTION_OPTIONS = [
  "",
  "Send booking",
  "Await booking",
  "Escalate booking",
  "Plan leg",
  "Mark departure",
  "Record arrival",
  "Route complete",
] as const;

export type RouteActionName = Exclude<(typeof ROUTE_ACTION_OPTIONS)[number], "">;

export function createRouteActionCounts(rows: WorkbenchRow[]): Record<RouteActionName, number> {
  const counts: Record<RouteActionName, number> = {
    "Send booking": 0,
    "Await booking": 0,
    "Escalate booking": 0,
    "Plan leg": 0,
    "Mark departure": 0,
    "Record arrival": 0,
    "Route complete": 0,
  };
  for (const row of rows) {
    const action = row.nextAction || "";
    if (action.startsWith("Send booking")) counts["Send booking"] += 1;
    else if (action.startsWith("Await booking")) counts["Await booking"] += 1;
    else if (action.startsWith("Escalate booking")) counts["Escalate booking"] += 1;
    else if (action.startsWith("Plan leg")) counts["Plan leg"] += 1;
    else if (action.startsWith("Mark departure")) counts["Mark departure"] += 1;
    else if (action.startsWith("Record arrival")) counts["Record arrival"] += 1;
    else if (action.startsWith("Route complete")) counts["Route complete"] += 1;
  }
  return counts;
}
