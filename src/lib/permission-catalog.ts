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
    resource: "org.wms.setup",
    action: "view",
    label: "View WMS layout & strategy",
    description:
      "Read zones, bins, replenishment rules, allocation strategy, and BF-50 topology graph export (GET /api/wms?topologyGraph=1) (BF-06 scope).",
  },
  {
    resource: "org.wms.setup",
    action: "edit",
    label: "Edit WMS layout & strategy",
    description:
      "Change zones, bins, replenishment rules, warehouse allocation strategy, and BF-50 POST export_warehouse_topology_graph (same payload as GET topology export).",
  },
  {
    resource: "org.wms.operations",
    action: "view",
    label: "View WMS execution",
    description: "Read dock, tasks, waves, inbound/outbound execution surfaces (BF-06 scope).",
  },
  {
    resource: "org.wms.operations",
    action: "edit",
    label: "Run WMS execution",
    description:
      "Create and complete operational workflows: tasks, waves, dock, outbound ship, receiving, BF-61 demand forecast stub upsert.",
  },
  {
    resource: "org.wms.inventory",
    action: "view",
    label: "View WMS inventory controls",
    description: "Read stock holds, cycle counts, and lot-batch registry actions (BF-06 scope).",
  },
  {
    resource: "org.wms.inventory",
    action: "edit",
    label: "Manage WMS inventory controls",
    description:
      "Balance holds, cycle counts, serialization registry, saved ledger views — not lot-master alone (BF-16: see org.wms.inventory.lot) nor serial-only registry (BF-48: see org.wms.inventory.serial).",
  },
  {
    resource: "org.wms.inventory.lot",
    action: "view",
    label: "View lot/batch master registry",
    description: "Read WMS lot/batch metadata profiles (BF-16 scope).",
  },
  {
    resource: "org.wms.inventory.lot",
    action: "edit",
    label: "Edit lot/batch master registry",
    description: "Create/update `WmsLotBatch` via `set_wms_lot_batch` without broader inventory qty controls (BF-16).",
  },
  {
    resource: "org.wms.inventory.serial",
    action: "view",
    label: "View serialization registry scope",
    description:
      "Read Stock serialization surfaces scoped like inventory view (BF-48 — paired with serial edit for mutation shells).",
  },
  {
    resource: "org.wms.inventory.serial",
    action: "edit",
    label: "Manage serialization registry",
    description:
      "Register serials / attach to movements / set balance pointers (`register_inventory_serial`, …) without broader inventory qty controls (BF-48).",
  },
  {
    resource: "org.wms.inventory.hold.release_quality",
    action: "view",
    label: "View quality hold release scope",
    description:
      "BF-58 — paired with edit to release balances frozen with org.wms.inventory.hold.release_quality.",
  },
  {
    resource: "org.wms.inventory.hold.release_quality",
    action: "edit",
    label: "Release quality-scoped inventory holds",
    description:
      "BF-58 — `release_inventory_freeze` / `clear_balance_hold` on rows whose `holdReleaseGrant` is this resource (without full inventory edit).",
  },
  {
    resource: "org.wms.inventory.hold.release_compliance",
    action: "view",
    label: "View compliance hold release scope",
    description:
      "BF-58 — paired with edit to release balances frozen with org.wms.inventory.hold.release_compliance.",
  },
  {
    resource: "org.wms.inventory.hold.release_compliance",
    action: "edit",
    label: "Release compliance-scoped inventory holds",
    description:
      "BF-58 — `release_inventory_freeze` on rows whose `holdReleaseGrant` is this resource (recall / regulatory paths).",
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
  {
    resource: "org.invoice_audit",
    action: "view",
    label: "View invoice audit",
    description: "List freight invoice intakes, parsed lines, and snapshot match outcomes.",
  },
  {
    resource: "org.invoice_audit",
    action: "edit",
    label: "Manage invoice audit",
    description: "Create intakes, run audits vs pricing snapshots, and record approvals or overrides.",
  },
  {
    resource: "org.apihub",
    action: "view",
    label: "View integration hub",
    description: "Open /apihub and read API Hub data (connectors, mapping, ingestion runs, staging).",
  },
  {
    resource: "org.apihub",
    action: "edit",
    label: "Manage integration hub",
    description:
      "Create or change connectors, templates, ingestion runs, mapping analysis jobs, staging batches, and staging downstream apply (SO/PO/CT still require their module grants).",
  },
  {
    resource: "org.scri",
    action: "view",
    label: "View risk intelligence",
    description: "Supply Chain Risk Intelligence dashboard, event feed, and event detail (read-only).",
  },
  {
    resource: "org.scri",
    action: "edit",
    label: "Manage risk intelligence",
    description: "Ingest external events and run triage workflows (future phases).",
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
