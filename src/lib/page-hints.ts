export type PageHint = {
  bullets: string[];
  /** Short line under the list (e.g. demo/session tips). */
  footerNote?: string;
};

const ENTRIES: { prefix: string; hint: PageHint }[] = [
  {
    prefix: "/platform",
    hint: {
      bullets: [
        "Open a workspace card to jump into PO Management, Control Tower, WMS, CRM, SRM, or other modules your role allows.",
        "Use the top bar for fast switching; short labels expand in the tooltip on hover.",
        "Press Ctrl K (Windows) or ⌘K (Mac) for the command palette — quick routes, help, and public legal pages.",
      ],
      footerNote: "Limited tiles? Pick a demo user under Settings → Demo session, then return here.",
    },
  },
  {
    prefix: "/supply-chain-twin",
    hint: {
      bullets: [
        "Preview of the cross-module Supply Chain Twin — read-only shell while graph, ingestion, and KPI engines land.",
        "Check readiness above when the API reports database or configuration gaps.",
        "Docs under docs/sctwin describe screens, data model, and build order for the full module.",
      ],
    },
  },
  {
    prefix: "/control-tower",
    hint: {
      bullets: [
        "Operational home for shipments: dashboard tiles, digest widgets, and links into workbench and booking.",
        "Use the Control Tower sub-navigation for My dashboard, Workbench, Booking, Command, Operation, reports, and search.",
        "Customer or supplier portal sessions may see a reduced dataset; internal roles see full depth where permitted.",
      ],
    },
  },
  {
    prefix: "/wms",
    hint: {
      bullets: [
        "Warehouse overview: workload, stock confidence, and shortcuts into setup, operations, stock, and billing.",
        "Day-to-day execution lives under Operations and Stock & ledger; Setup defines zones, bins, and rules.",
        "Billing ties movements to rate cards and draft invoices when that phase is enabled for the tenant.",
      ],
    },
  },
  {
    prefix: "/orders",
    hint: {
      bullets: [
        "Board of purchase orders: filter by queue (needs action, open, closed) and sort to match buyer vs supplier workflows.",
        "Row actions run workflow transitions when you hold org.orders → transition; some actions are buyer-only or supplier-only.",
        "Supplier portal users only see PO lines exposed to the portal and a narrower action set.",
      ],
    },
  },
  {
    prefix: "/sales-orders",
    hint: {
      bullets: [
        "Customer demand list: open a sales order for line detail, status, and shipment links when present.",
        "Use Product Trace (sub-navigation) for SKU-level lineage without opening Control Tower.",
        "Creating or changing orders requires the right org grants; ask an admin if actions are missing.",
      ],
    },
  },
];

const SORTED = [...ENTRIES].sort((a, b) => b.prefix.length - a.prefix.length);

export function getPageHintForPath(pathname: string): PageHint | null {
  const path = pathname.split("?")[0] ?? pathname;
  for (const { prefix, hint } of SORTED) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return hint;
  }
  return null;
}
