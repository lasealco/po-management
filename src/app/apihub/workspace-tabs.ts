/** Tab order must match `WorkspaceTabbedLayout` children order in `workspace/page.tsx`. */

export const WORKSPACE_TAB_IDS = [
  "overview",
  "demo-sync",
  "ingestion-ops",
  "ingestion-alerts",
  "apply-conflicts",
  "mapping-analysis-jobs",
  "staging-batches",
  "mapping-templates",
  "mapping-preview-export",
  "connectors",
] as const;

export type WorkspaceTabId = (typeof WORKSPACE_TAB_IDS)[number];

export const WORKSPACE_TAB_META: { id: WorkspaceTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "demo-sync", label: "Demo" },
  { id: "ingestion-ops", label: "Runs" },
  { id: "ingestion-alerts", label: "Alerts" },
  { id: "apply-conflicts", label: "Conflicts" },
  { id: "mapping-analysis-jobs", label: "Analysis" },
  { id: "staging-batches", label: "Staging" },
  { id: "mapping-templates", label: "Templates" },
  { id: "mapping-preview-export", label: "Preview" },
  { id: "connectors", label: "Connectors" },
];

const TAB_SET = new Set<string>(WORKSPACE_TAB_IDS);

export function isWorkspaceTabId(s: string): s is WorkspaceTabId {
  return TAB_SET.has(s);
}

export function normalizeWorkspaceTab(tab: string | undefined): WorkspaceTabId {
  if (tab && TAB_SET.has(tab)) {
    return tab as WorkspaceTabId;
  }
  return "overview";
}

export function workspaceTabHref(id: WorkspaceTabId): string {
  if (id === "overview") {
    return "/apihub/workspace";
  }
  return `/apihub/workspace?tab=${encodeURIComponent(id)}`;
}
