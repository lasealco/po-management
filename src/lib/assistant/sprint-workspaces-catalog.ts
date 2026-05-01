/**
 * Single source of truth for “numbered sprint” assistant workspaces + where 22–24 appear under Operations.
 * Used by the Program track catalog page and subnav active-state detection.
 */
export type SprintWorkspaceEntry = {
  /** Display label in the catalog */
  sprintLabel: string;
  /** Short UI name (may match Operations chip) */
  primaryName: string;
  href: string;
  /** Full program title */
  subtitle: string;
  /** Extra context so users aren’t lost between Sprint vs Operations naming */
  note?: string;
};

export const SPRINT_WORKSPACE_ENTRIES: SprintWorkspaceEntry[] = [
  { sprintLabel: "Sprint 1", primaryName: "Agent governance", href: "/assistant/agent-governance", subtitle: "Agent Governance Control Plane" },
  { sprintLabel: "Sprint 2", primaryName: "Enterprise risk & controls", href: "/assistant/enterprise-risk-controls", subtitle: "Enterprise Risk & Controls" },
  { sprintLabel: "Sprint 3", primaryName: "Privacy, security & trust", href: "/assistant/privacy-security-trust", subtitle: "Privacy, Security & Trust" },
  { sprintLabel: "Sprint 4", primaryName: "Executive OS", href: "/assistant/executive-operating-system", subtitle: "Executive Operating System" },
  { sprintLabel: "Sprint 5", primaryName: "Collaboration & resilience", href: "/assistant/collaboration-resilience", subtitle: "Collaboration & Resilience" },
  { sprintLabel: "Sprint 6", primaryName: "Commercial & revenue control", href: "/assistant/commercial-revenue-control", subtitle: "Commercial & Revenue Control Plane" },
  { sprintLabel: "Sprint 7", primaryName: "Supply network twin", href: "/assistant/supply-network-twin", subtitle: "Supply Network Twin & Scenario Command" },
  { sprintLabel: "Sprint 8", primaryName: "Warehouse & fulfillment autonomy", href: "/assistant/warehouse-fulfillment-autonomy", subtitle: "Warehouse & Fulfillment Autonomy" },
  { sprintLabel: "Sprint 9", primaryName: "Data & integration control", href: "/assistant/data-integration-control", subtitle: "Data & Integration Control Plane" },
  { sprintLabel: "Sprint 10", primaryName: "AI quality & release", href: "/assistant/ai-quality-release", subtitle: "AI Quality, Evaluation & Release Governance" },
  { sprintLabel: "Sprint 11", primaryName: "Tenant rollout & change", href: "/assistant/tenant-rollout-change", subtitle: "Tenant Rollout & Change Enablement" },
  { sprintLabel: "Sprint 12", primaryName: "Finance, cash & accounting", href: "/assistant/finance-cash-controls", subtitle: "Finance, Cash & Accounting Controls" },
  { sprintLabel: "Sprint 13", primaryName: "Product lifecycle passport", href: "/assistant/product-lifecycle-passport", subtitle: "Product Lifecycle & Compliance Passport" },
  { sprintLabel: "Sprint 14", primaryName: "Platform reliability & security", href: "/assistant/platform-reliability-security", subtitle: "Platform Reliability & Security Operations" },
  { sprintLabel: "Sprint 15", primaryName: "Enterprise OS v2", href: "/assistant/enterprise-os-v2", subtitle: "Autonomous Enterprise OS v2" },
  { sprintLabel: "Sprint 16", primaryName: "Transport & carrier procurement", href: "/assistant/transport-carrier-procurement", subtitle: "Transportation & Carrier Procurement Command" },
  { sprintLabel: "Sprint 17", primaryName: "Incident nerve center", href: "/assistant/incident-nerve-center", subtitle: "Cross-Domain Exception & Incident Nerve Center" },
  { sprintLabel: "Sprint 18", primaryName: "Customer success intelligence", href: "/assistant/customer-success-account-intelligence", subtitle: "Customer Success & Account Intelligence" },
  { sprintLabel: "Sprint 19", primaryName: "Strategic sourcing intelligence", href: "/assistant/strategic-sourcing-category-intelligence", subtitle: "Strategic Sourcing & Category Intelligence" },
  { sprintLabel: "Sprint 20", primaryName: "External risk & events", href: "/assistant/external-risk-event-intelligence", subtitle: "External Risk & Event Intelligence (SCRI)" },
  { sprintLabel: "Sprint 21", primaryName: "Master data governance", href: "/assistant/master-data-governance-enrichment", subtitle: "Master Data Governance & Enrichment" },
  {
    sprintLabel: "Sprint 22",
    primaryName: "Planning bridge",
    href: "/assistant/planning-bridge",
    subtitle: "Constrained S&OP planning bridge",
    note: "Same workspace as the Planning chip under Operations modules.",
  },
  {
    sprintLabel: "Sprint 23",
    primaryName: "Contracts & compliance",
    href: "/assistant/contract-compliance",
    subtitle: "Contract lifecycle & obligations",
    note: "Same workspace as the Contracts chip under Operations modules.",
  },
  {
    sprintLabel: "Sprint 24",
    primaryName: "Frontline",
    href: "/assistant/frontline",
    subtitle: "Mobile & frontline execution (AMP26)",
    note: "Same workspace as the Frontline chip under Operations modules.",
  },
  {
    sprintLabel: "Sprint 25",
    primaryName: "Knowledge & documents",
    href: "/assistant/enterprise-knowledge-document-intelligence",
    subtitle: "Enterprise Knowledge & Document Intelligence",
  },
];

/** Prefixes for assistant routes that belong to the Program track (for subnav highlight). */
export const SPRINT_WORKSPACE_PATH_PREFIXES: string[] = [...new Set(SPRINT_WORKSPACE_ENTRIES.map((e) => e.href))];

export function pathnameMatchesProgramTrackWorkspace(pathname: string): boolean {
  const p = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return SPRINT_WORKSPACE_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}
