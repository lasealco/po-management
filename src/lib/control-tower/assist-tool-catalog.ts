/**
 * Read-only catalog of `action` values handled by `POST /api/control-tower` (see `post-actions.ts`).
 * Exposed in `POST /api/control-tower/assist` for Search / future tool-calling — not executable from assist alone.
 */

export type ControlTowerPostActionToolRef = {
  action: string;
  group: string;
  label: string;
  description: string;
};

/** Count of `if (action === "…")` arms in `post-actions.ts` (main Control Tower action router). */
export const CONTROL_TOWER_POST_ACTION_HANDLER_COUNT = 44;

const ROSTER: ControlTowerPostActionToolRef[] = [
  {
    group: "References & milestones",
    action: "add_ct_reference",
    label: "Add shipment reference",
    description: "Attach B/L, AWB, or other refs on a shipment (tenant-scoped).",
  },
  {
    group: "References & milestones",
    action: "upsert_ct_tracking_milestone",
    label: "Upsert tracking milestone",
    description: "Create or update a flexible tracking milestone on a shipment.",
  },
  {
    group: "References & milestones",
    action: "apply_ct_milestone_pack",
    label: "Apply milestone template pack",
    description: "Apply a template pack to seed milestone codes (see milestone-pack-catalog API).",
  },
  {
    group: "Alerts",
    action: "acknowledge_ct_alert",
    label: "Acknowledge alert",
    description: "Move a single open alert to acknowledged.",
  },
  {
    group: "Alerts",
    action: "bulk_acknowledge_ct_alerts",
    label: "Bulk acknowledge alerts",
    description: "Acknowledge many open alerts for selected shipment rows (workbench flow).",
  },
  {
    group: "Alerts",
    action: "assign_ct_alert_owner",
    label: "Assign alert owner",
    description: "Set owner on a CT alert.",
  },
  {
    group: "Exceptions",
    action: "create_ct_exception",
    label: "Create exception",
    description: "Open a new exception on a shipment (uses catalog codes when present).",
  },
  {
    group: "Exceptions",
    action: "update_ct_exception",
    label: "Update exception",
    description: "Update status, notes, or fields on an exception row.",
  },
  {
    group: "Exceptions",
    action: "assign_ct_exception_owner",
    label: "Assign exception owner",
    description: "Set owner on an open or in-progress exception.",
  },
  {
    group: "Booking & dispatch",
    action: "send_booking_to_forwarder",
    label: "Send booking to forwarder",
    description: "Advance booking workflow toward forwarder (demo/simulated path).",
  },
  {
    group: "Booking & dispatch",
    action: "confirm_forwarder_booking",
    label: "Confirm forwarder booking",
    description: "Confirm booking in the simulated forwarder flow.",
  },
  {
    group: "Booking & dispatch",
    action: "update_shipment_ops_assignee",
    label: "Set shipment ops assignee",
    description: "Assign the ops assignee user on a shipment (360 / workbench).",
  },
  {
    group: "Booking & dispatch",
    action: "bulk_update_shipment_ops_assignee",
    label: "Bulk set ops assignee",
    description: "Set ops assignee across many shipments (multi-select workbench).",
  },
  {
    group: "Shipment & CRM",
    action: "set_shipment_customer_crm_account",
    label: "Link customer CRM account",
    description: "Attach CRM account to a shipment for portal/digest scoping where applicable.",
  },
  {
    group: "Shipment & CRM",
    action: "link_shipment_sales_order",
    label: "Link sales order",
    description: "Link an existing sales order to the shipment.",
  },
  {
    group: "Legs & cargo",
    action: "create_ct_leg",
    label: "Create leg",
    description: "Add a booking/transport leg on a shipment.",
  },
  {
    group: "Legs & cargo",
    action: "create_ct_container",
    label: "Create container",
    description: "Add a container to the shipment’s cargo picture.",
  },
  {
    group: "Workbench",
    action: "save_ct_filter",
    label: "Save workbench filter",
    description: "Persist a named workbench view (same filters you can load from the workbench).",
  },
  {
    group: "Admin",
    action: "upsert_ct_exception_code",
    label: "Upsert exception catalog code",
    description: "Tenant admin: add or update an exception type in the catalog (Settings + API).",
  },
  {
    group: "Demo",
    action: "enrich_ct_demo_tracking",
    label: "Enrich demo tracking",
    description: "Simulated enrichment for demo profiles (workbench / 360).",
  },
];

export function getControlTowerPostActionToolCatalog(): ControlTowerPostActionToolRef[] {
  return ROSTER;
}
