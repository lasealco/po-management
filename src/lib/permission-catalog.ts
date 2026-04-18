/**
 * Global permissions (workflowStatusId = null). Workflow-scoped rules can be
 * added later without changing these keys.
 */
export const GLOBAL_PERMISSION_CATALOG = [
  {
    resource: "org.orders",
    action: "view",
    label: "View purchase orders",
    description: "Board, list, and order detail.",
  },
  {
    resource: "org.orders",
    action: "transition",
    label: "Change order status",
    description: "Run workflow transitions the app allows.",
  },
  {
    resource: "org.orders",
    action: "split",
    label: "Split orders",
    description: "Create and resolve split proposals.",
  },
  {
    resource: "org.orders",
    action: "edit",
    label: "Edit order details",
    description:
      "Update PO references, commercial terms, ship-to, and notes (not line totals).",
  },
  {
    resource: "org.products",
    action: "view",
    label: "View products",
    description: "Product catalog and detail.",
  },
  {
    resource: "org.products",
    action: "edit",
    label: "Edit products",
    description: "Create, update, and deactivate products.",
  },
  {
    resource: "org.suppliers",
    action: "view",
    label: "View suppliers",
    description: "Supplier directory and offices.",
  },
  {
    resource: "org.suppliers",
    action: "edit",
    label: "Edit suppliers",
    description: "Create and update supplier records.",
  },
  {
    resource: "org.settings",
    action: "view",
    label: "View settings",
    description: "Open settings areas (read-only where enforced).",
  },
  {
    resource: "org.settings",
    action: "edit",
    label: "Edit settings",
    description: "Change company data, users, roles, and permissions.",
  },
  {
    resource: "org.reports",
    action: "view",
    label: "Reports",
    description:
      "Open Reports and export CSV summaries. Individual reports may also require other permissions (for example org.orders → view or org.suppliers → view).",
  },
  {
    resource: "org.wms",
    action: "view",
    label: "View warehouse operations",
    description: "Open WMS dashboard, tasks, bins, and stock balances.",
  },
  {
    resource: "org.wms",
    action: "edit",
    label: "Manage warehouse operations",
    description: "Create and complete warehouse tasks, bins, and stock movements.",
  },
  {
    resource: "org.crm",
    action: "view",
    label: "View CRM",
    description:
      "Leads, accounts, contacts, opportunities, and activities (own records unless CRM edit is granted).",
  },
  {
    resource: "org.crm",
    action: "edit",
    label: "Manage CRM",
    description: "Create and update CRM records for any user in the tenant (managers).",
  },
  {
    resource: "org.controltower",
    action: "view",
    label: "View Control Tower",
    description: "Dashboard, workbench, shipment 360, search, and customer-safe reporting.",
  },
  {
    resource: "org.controltower",
    action: "edit",
    label: "Manage Control Tower",
    description:
      "Post milestones, notes, documents, financial snapshots, alerts, exceptions, and saved views.",
  },
  {
    resource: "org.tariffs",
    action: "view",
    label: "View tariffs",
    description: "Ocean tariff contracts, versions, and rate lines.",
  },
  {
    resource: "org.tariffs",
    action: "edit",
    label: "Manage tariffs",
    description: "Create and edit tariff contracts, versions, and pricing lines.",
  },
  {
    resource: "org.rfq",
    action: "view",
    label: "View RFQs",
    description: "Ocean RFQs, quote responses, and comparison.",
  },
  {
    resource: "org.rfq",
    action: "edit",
    label: "Manage RFQs",
    description: "Create RFQs, invite recipients, enter quotes, and run comparison.",
  },
] as const;

export type GlobalPermissionRow = (typeof GLOBAL_PERMISSION_CATALOG)[number];

const catalogKeys = new Set(
  GLOBAL_PERMISSION_CATALOG.map((r) => `${r.resource}\0${r.action}`),
);

export function isValidGlobalPermission(resource: string, action: string) {
  return catalogKeys.has(`${resource}\0${action}`);
}

export function groupCatalogByResource() {
  const map = new Map<string, typeof GLOBAL_PERMISSION_CATALOG[number][]>();
  for (const row of GLOBAL_PERMISSION_CATALOG) {
    const list = map.get(row.resource) ?? [];
    list.push(row);
    map.set(row.resource, list);
  }
  return map;
}
