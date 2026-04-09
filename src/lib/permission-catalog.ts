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
