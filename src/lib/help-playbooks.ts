import { LEGAL_COOKIES_PATH, LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from "@/lib/legal-public-paths";
import { MARKETING_PRICING_PATH, PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";
import { REPORTING_HUB_CONTROL_TOWER_HREF } from "@/lib/reporting-hub-paths";
import {
  TARIFF_CHARGE_CODES_PATH,
  TARIFF_CONTRACTS_DIRECTORY_PATH,
  TARIFF_GEOGRAPHY_NEW_PATH,
  TARIFF_GEOGRAPHY_PATH,
  TARIFF_IMPORT_NEW_PATH,
  TARIFF_IMPORT_PATH,
  TARIFF_LEGAL_ENTITIES_PATH,
  TARIFF_NEW_CONTRACT_PATH,
  TARIFF_PROVIDERS_PATH,
  TARIFF_RATE_LOOKUP_PATH,
  TARIFF_RATING_PATH,
} from "@/lib/tariff/tariff-workbench-urls";

/** Same contract as server-executed help actions (`/api/help/actions`). */
export type HelpPlaybookDoAction = {
  type: "open_order" | "open_orders_queue" | "open_path";
  label: string;
  payload?: Record<string, unknown>;
};

export type HelpPlaybookStep = {
  title: string;
  description: string;
  href?: string;
  /** One-click execution for this step (validated server-side). */
  doAction?: HelpPlaybookDoAction;
};

export type HelpPlaybook = {
  id: string;
  title: string;
  summary: string;
  steps: HelpPlaybookStep[];
};

export const HELP_PLAYBOOKS: HelpPlaybook[] = [
  {
    id: "reporting_hub",
    title: "Reporting hub & cockpit",
    summary:
      "Cross-module cockpit on /reporting: refresh data, optional auto-refresh, keyboard shortcuts, and links to PO, Control Tower, CRM, and WMS reporting.",
    steps: [
      {
        title: "Open the Reporting hub",
        description: "Single place for the executive cockpit and module shortcuts.",
        href: "/reporting",
        doAction: {
          type: "open_path",
          label: "Open Reporting hub",
          payload: { path: "/reporting", guide: "reporting_hub", step: 0 },
        },
      },
      {
        title: "Refresh cockpit numbers",
        description:
          "Use Refresh data, or press R while focus is not in a field. Shift+R refreshes silently (no button spinner).",
        href: "/reporting",
        doAction: {
          type: "open_path",
          label: "Go to Reporting hub",
          payload: { path: "/reporting", guide: "reporting_hub", step: 1 },
        },
      },
      {
        title: "Auto-refresh in the background",
        description:
          "Turn on Auto-refresh and pick 5, 10, or 15 minutes. Pauses while the tab is hidden; catch-up runs when you return after a longer break.",
        href: "/reporting",
        doAction: {
          type: "open_path",
          label: "Open Reporting hub",
          payload: { path: "/reporting", guide: "reporting_hub", step: 2 },
        },
      },
      {
        title: "Module workspaces",
        description: "Jump to PO reports, Control Tower reports, CRM reporting, or WMS reporting from the same page.",
        href: "/reporting",
        doAction: {
          type: "open_path",
          label: "Open Reporting hub",
          payload: { path: "/reporting", guide: "reporting_hub", step: 3 },
        },
      },
      {
        title: "Jump to Control Tower on the hub",
        description:
          "Add ?focus=control-tower to /reporting to scroll straight to the Control Tower card (report builder, My dashboard, workbench, shipment digest). Other focuses: po, crm, wms. Help one-click actions and the command palette use the same deep links; focus is dropped if you lack that module grant.",
        href: REPORTING_HUB_CONTROL_TOWER_HREF,
        doAction: {
          type: "open_path",
          label: "Reporting hub — Control Tower section",
          payload: { path: "/reporting", focus: "control-tower", guide: "reporting_hub", step: 4 },
        },
      },
      {
        title: "Chart → table drill-down",
        description:
          "On My dashboard, open a pinned Control Tower widget: click a bar, line point, or pie slice to highlight that row, scroll the table, and copy a shareable URL (?widget=…&drill=…). Use “Open in workbench” for a filtered shipment list (carrier, supplier, customer, origin/destination codes map to dedicated workbench/API params). PO reports: ?report=…&row=… highlights any result row (chart or table click).",
        href: "/control-tower/dashboard",
        doAction: {
          type: "open_path",
          label: "Open My dashboard",
          payload: { path: "/control-tower/dashboard", guide: "reporting_hub", step: 5 },
        },
      },
    ],
  },
  {
    id: "create_order",
    title: "Create a Purchase Order",
    summary: "Guide to creating and sending a PO to supplier.",
    steps: [
      {
        title: "Open Orders board",
        description: "Go to Orders and check your current draft queue.",
        href: "/orders",
        doAction: {
          type: "open_orders_queue",
          label: "Show needs my action",
          payload: { queue: "needs_my_action", guide: "create_order", step: 0 },
        },
      },
      {
        title: "Use demo/send flow starter order",
        description:
          "Open a draft order (for example PO-1004 in demo) to edit header and lines.",
        href: "/orders",
        doAction: {
          type: "open_order",
          label: "Open PO-1004",
          payload: { orderNumber: "PO-1004", guide: "create_order", step: 1 },
        },
      },
      {
        title: "Fill key order details",
        description: "Set references, ship-to address, and supplier-facing notes.",
        doAction: {
          type: "open_order",
          label: "Open PO-1004 to edit",
          payload: { orderNumber: "PO-1004", guide: "create_order", step: 2 },
        },
      },
      {
        title: "Send to supplier",
        description:
          "Use the allowed action button 'Send to supplier' when order is ready.",
        doAction: {
          type: "open_order",
          label: "Jump to send actions",
          payload: {
            orderNumber: "PO-1004",
            focus: "workflow",
            guide: "create_order",
            step: 3,
          },
        },
      },
      {
        title: "Track confirmation and ASN",
        description: "Supplier confirms and creates ASN; buyer receives quantities.",
        doAction: {
          type: "open_order",
          label: "View ASNs on PO-1002",
          payload: {
            orderNumber: "PO-1002",
            focus: "asn",
            guide: "create_order",
            step: 4,
          },
        },
      },
    ],
  },
  {
    id: "create_supplier",
    title: "Create a Supplier",
    summary: "Create supplier master data and contacts/offices.",
    steps: [
      {
        title: "Open Suppliers",
        description: "Go to supplier directory.",
        href: "/suppliers",
        doAction: {
          type: "open_path",
          label: "Open suppliers",
          payload: { path: "/suppliers", guide: "create_supplier", step: 0 },
        },
      },
      {
        title: "Create supplier card",
        description: "Fill name, code, and basic contact details.",
        doAction: {
          type: "open_path",
          label: "Go to supplier list",
          payload: { path: "/suppliers", guide: "create_supplier", step: 1 },
        },
      },
      {
        title: "Open supplier detail",
        description: "Add legal/commercial fields, offices, and contacts.",
        doAction: {
          type: "open_path",
          label: "Open suppliers",
          payload: { path: "/suppliers", guide: "create_supplier", step: 2 },
        },
      },
      {
        title: "Archive or deactivate if needed",
        description:
          "Use Active toggle or Archive action. Delete only if no linked POs exist.",
        doAction: {
          type: "open_path",
          label: "Open suppliers",
          payload: { path: "/suppliers", guide: "create_supplier", step: 3 },
        },
      },
    ],
  },
  {
    id: "consolidation",
    title: "Build a Consolidation Load",
    summary: "Create draft load and assign ASN shipments by mode/capacity.",
    steps: [
      {
        title: "Open Consolidation",
        description: "Go to consolidation planner.",
        href: "/consolidation",
        doAction: {
          type: "open_path",
          label: "Open consolidation",
          payload: { path: "/consolidation", guide: "consolidation", step: 0 },
        },
      },
      {
        title: "Create draft load",
        description: "Choose transport mode, container size, and CFS/warehouse.",
        doAction: {
          type: "open_path",
          label: "Open consolidation",
          payload: { path: "/consolidation", guide: "consolidation", step: 1 },
        },
      },
      {
        title: "Filter available shipments",
        description: "Filter by supplier and shipped date window.",
        doAction: {
          type: "open_path",
          label: "Open consolidation",
          payload: { path: "/consolidation", guide: "consolidation", step: 2 },
        },
      },
      {
        title: "Add shipments and watch load factor",
        description: "Keep load factor in safe range and avoid overfill alerts.",
        doAction: {
          type: "open_path",
          label: "Open consolidation",
          payload: { path: "/consolidation", guide: "consolidation", step: 3 },
        },
      },
      {
        title: "Finalize load",
        description: "Finalize when complete, or reopen/cancel when needed.",
        doAction: {
          type: "open_path",
          label: "Open consolidation",
          payload: { path: "/consolidation", guide: "consolidation", step: 4 },
        },
      },
    ],
  },
  {
    id: "product_trace",
    title: "Product trace (SKU → PO → ocean → stock)",
    summary:
      "Follow a catalog SKU or buyer code from PO lines through in-transit shipment to warehouse inventory on a map (when you have WMS view).",
    steps: [
      {
        title: "Open Product trace",
        description:
          "Search by SKU or code; see PO lines, simulated vessel position along the booking lane, and warehouse dots when permitted.",
        href: "/product-trace",
        doAction: {
          type: "open_path",
          label: "Open Product trace",
          payload: { path: "/product-trace", guide: "product_trace", step: 0 },
        },
      },
      {
        title: "Try the demo SKU",
        description:
          "After `npm run db:seed` (and optional `npm run db:seed:product-trace-demo`), open PKG-CORR-ROLL to see PO-1002 in transit and WH-LAX stock.",
        href: "/product-trace",
        doAction: {
          type: "open_path",
          label: "Open with PKG-CORR-ROLL",
          payload: { path: "/product-trace", q: "PKG-CORR-ROLL", guide: "product_trace", step: 1 },
        },
      },
      {
        title: "From Control Tower Search & assist",
        description:
          "Type trace:YOUR-CODE or product:YOUR-CODE next to shipment tokens; use “Open product trace →” beside workbench.",
        href: "/control-tower/search",
        doAction: {
          type: "open_path",
          label: "Open Search & assist",
          payload: { path: "/control-tower/search", guide: "product_trace", step: 2 },
        },
      },
    ],
  },
  {
    id: "control_tower",
    title: "Control Tower (shipments & reports)",
    summary:
      "Search shipments, scan a capped digest list, run analytics reports, and manage your dashboard widgets.",
    steps: [
      {
        title: "Open Control Tower home",
        description: "Overview, shortcuts, and pinned report widgets.",
        href: "/control-tower",
        doAction: {
          type: "open_path",
          label: "Open Control Tower",
          payload: { path: "/control-tower", guide: "control_tower", step: 0 },
        },
      },
      {
        title: "Workbench — shipment list",
        description: "Filter and open shipment 360 for a specific move.",
        href: "/control-tower/workbench",
        doAction: {
          type: "open_path",
          label: "Open workbench",
          payload: { path: "/control-tower/workbench", guide: "control_tower", step: 1 },
        },
      },
      {
        title: "Reports & analytics",
        description: "Build charts, compare periods, and save or pin reports.",
        href: "/control-tower/reports",
        doAction: {
          type: "open_path",
          label: "Open reports",
          payload: { path: "/control-tower/reports", guide: "control_tower", step: 2 },
        },
      },
      {
        title: "Search & assist",
        description: "Free-text search with structured filters; optional LLM assist when enabled.",
        href: "/control-tower/search",
        doAction: {
          type: "open_path",
          label: "Open search",
          payload: { path: "/control-tower/search", guide: "control_tower", step: 3 },
        },
      },
      {
        title: "My dashboard widgets",
        description: "Reorder and resize pinned report widgets.",
        href: "/control-tower/dashboard",
        doAction: {
          type: "open_path",
          label: "Open My dashboard",
          payload: { path: "/control-tower/dashboard", guide: "control_tower", step: 4 },
        },
      },
      {
        title: "Shipment digest",
        description:
          "Read-only table of the most recently updated shipments in your scope (same contract as GET /api/control-tower/customer/digest). Amber banner when the 250-row cap may hide older rows.",
        href: "/control-tower/digest",
        doAction: {
          type: "open_path",
          label: "Open digest",
          payload: { path: "/control-tower/digest", guide: "control_tower", step: 5 },
        },
      },
    ],
  },
  {
    id: "tariffs",
    title: "Tariffs (contracts, rating & import)",
    summary:
      "Browse contracts, start wizards (new contract, import upload, geography group), run rate lookup and lane rating, manage providers and legal entities, import batches, geography directory, and charge codes.",
    steps: [
      {
        title: "Contract directory",
        description:
          "Lists tariff contract headers; open a header for metadata and jump into published or draft versions from there.",
        href: TARIFF_CONTRACTS_DIRECTORY_PATH,
        doAction: {
          type: "open_path",
          label: "Open contracts",
          payload: { path: TARIFF_CONTRACTS_DIRECTORY_PATH, guide: "tariffs", step: 0 },
        },
      },
      {
        title: "New contract wizard",
        description: "Create a contract header and first version when you have org.tariffs edit access.",
        href: TARIFF_NEW_CONTRACT_PATH,
        doAction: {
          type: "open_path",
          label: "Open new contract",
          payload: { path: TARIFF_NEW_CONTRACT_PATH, guide: "tariffs", step: 1 },
        },
      },
      {
        title: "Rate lookup",
        description: "Quick table-style lookup against published contract data (read-only explorer in this build).",
        href: TARIFF_RATE_LOOKUP_PATH,
        doAction: {
          type: "open_path",
          label: "Open rate lookup",
          payload: { path: TARIFF_RATE_LOOKUP_PATH, guide: "tariffs", step: 2 },
        },
      },
      {
        title: "Lane rating",
        description:
          "Try POL/POD, equipment, and mode against a contract version; optional shipment context links back to logistics.",
        href: TARIFF_RATING_PATH,
        doAction: {
          type: "open_path",
          label: "Open lane rating",
          payload: { path: TARIFF_RATING_PATH, guide: "tariffs", step: 3 },
        },
      },
      {
        title: "Providers",
        description: "Carriers and providers referenced when creating or editing contract headers.",
        href: TARIFF_PROVIDERS_PATH,
        doAction: {
          type: "open_path",
          label: "Open providers",
          payload: { path: TARIFF_PROVIDERS_PATH, guide: "tariffs", step: 4 },
        },
      },
      {
        title: "Legal entities",
        description: "Contracting parties used on contract headers and optional import batch metadata.",
        href: TARIFF_LEGAL_ENTITIES_PATH,
        doAction: {
          type: "open_path",
          label: "Open legal entities",
          payload: { path: TARIFF_LEGAL_ENTITIES_PATH, guide: "tariffs", step: 5 },
        },
      },
      {
        title: "Import center",
        description: "Upload batches, review staging rows, and promote into contract versions when your role allows.",
        href: TARIFF_IMPORT_PATH,
        doAction: {
          type: "open_path",
          label: "Open import",
          payload: { path: TARIFF_IMPORT_PATH, guide: "tariffs", step: 6 },
        },
      },
      {
        title: "New import upload",
        description: "Start a fresh batch with a PDF or Excel file when you have org.tariffs edit access.",
        href: TARIFF_IMPORT_NEW_PATH,
        doAction: {
          type: "open_path",
          label: "Open new import upload",
          payload: { path: TARIFF_IMPORT_NEW_PATH, guide: "tariffs", step: 7 },
        },
      },
      {
        title: "Geography groups",
        description: "Reusable geography scopes referenced from rate and charge lines.",
        href: TARIFF_GEOGRAPHY_PATH,
        doAction: {
          type: "open_path",
          label: "Open geography",
          payload: { path: TARIFF_GEOGRAPHY_PATH, guide: "tariffs", step: 8 },
        },
      },
      {
        title: "New geography group",
        description: "Define a new group type and name before adding member location codes.",
        href: TARIFF_GEOGRAPHY_NEW_PATH,
        doAction: {
          type: "open_path",
          label: "Open new geography group",
          payload: { path: TARIFF_GEOGRAPHY_NEW_PATH, guide: "tariffs", step: 9 },
        },
      },
      {
        title: "Charge codes",
        description: "Normalized charge codes shared across contracts and invoice audit.",
        href: TARIFF_CHARGE_CODES_PATH,
        doAction: {
          type: "open_path",
          label: "Open charge codes",
          payload: { path: TARIFF_CHARGE_CODES_PATH, guide: "tariffs", step: 10 },
        },
      },
    ],
  },
  {
    id: "public_marketing",
    title: "Plans, pricing, legal & platform entry",
    summary:
      "Open the public pricing page, read privacy/terms/cookies on standalone pages, or return to the signed-in platform hub that lists your workspaces.",
    steps: [
      {
        title: "Plans & pricing",
        description:
          "Marketing page describing packages and evaluation; it renders without the full app chrome for a clean read.",
        href: MARKETING_PRICING_PATH,
        doAction: {
          type: "open_path",
          label: "Open plans & pricing",
          payload: { path: MARKETING_PRICING_PATH, guide: "public_marketing", step: 0 },
        },
      },
      {
        title: "Platform hub",
        description:
          "After sign-in, pick PO Management, Control Tower, Rates & Audit, and other modules you have access to.",
        href: PLATFORM_HUB_PATH,
        doAction: {
          type: "open_path",
          label: "Open platform hub",
          payload: { path: PLATFORM_HUB_PATH, guide: "public_marketing", step: 1 },
        },
      },
      {
        title: "Privacy policy",
        description: "How we handle personal data; public page without full app chrome.",
        href: LEGAL_PRIVACY_PATH,
        doAction: {
          type: "open_path",
          label: "Open privacy policy",
          payload: { path: LEGAL_PRIVACY_PATH, guide: "public_marketing", step: 2 },
        },
      },
      {
        title: "Terms of service",
        description: "Site and service terms; public page without full app chrome.",
        href: LEGAL_TERMS_PATH,
        doAction: {
          type: "open_path",
          label: "Open terms of service",
          payload: { path: LEGAL_TERMS_PATH, guide: "public_marketing", step: 3 },
        },
      },
      {
        title: "Cookie policy",
        description: "Cookies and similar technologies; public page without full app chrome.",
        href: LEGAL_COOKIES_PATH,
        doAction: {
          type: "open_path",
          label: "Open cookie policy",
          payload: { path: LEGAL_COOKIES_PATH, guide: "public_marketing", step: 4 },
        },
      },
    ],
  },
  {
    id: "user_admin",
    title: "User Administration & Login",
    summary: "Create users, assign roles, set passwords, and sign in.",
    steps: [
      {
        title: "Open Settings → Users",
        description: "Manage users and role assignments.",
        href: "/settings/users",
        doAction: {
          type: "open_path",
          label: "Open Users settings",
          payload: { path: "/settings/users", guide: "user_admin", step: 0 },
        },
      },
      {
        title: "Create user",
        description: "Enter email, name, and initial password.",
        doAction: {
          type: "open_path",
          label: "Open Users settings",
          payload: { path: "/settings/users", guide: "user_admin", step: 1 },
        },
      },
      {
        title: "Assign roles",
        description: "Set Buyer/Approver/Supplier roles as needed, then save.",
        doAction: {
          type: "open_path",
          label: "Open Users settings",
          payload: { path: "/settings/users", guide: "user_admin", step: 2 },
        },
      },
      {
        title: "Sign in with credentials",
        description: "Use /login for real sign-in flow.",
        href: "/login",
        doAction: {
          type: "open_path",
          label: "Open login page",
          payload: { path: "/login", guide: "user_admin", step: 3 },
        },
      },
    ],
  },
];

export function matchPlaybook(query: string): HelpPlaybook | null {
  const q = query.toLowerCase();
  if (
    q.includes("product trace") ||
    q.includes("product-trace") ||
    q.includes("producttrace") ||
    q.includes("trace sku") ||
    q.includes("track a sku") ||
    q.includes("track a product") ||
    q.includes("sku on the map") ||
    (q.includes("where") &&
      q.includes("sku") &&
      (q.includes("stock") || q.includes("inventory") || q.includes("shipment") || q.includes("warehouse")))
  ) {
    return HELP_PLAYBOOKS.find((p) => p.id === "product_trace") ?? null;
  }
  if (
    q.includes("/reporting") ||
    q.includes("reporting hub") ||
    q.includes("reporting cockpit") ||
    q.includes("cross-module pulse") ||
    q.includes("cockpit board") ||
    (q.includes("reporting") && q.includes("cockpit")) ||
    (q.includes("reporting") && (q.includes("refresh") || q.includes("keyboard") || q.includes("shortcut"))) ||
    (q.includes("reporting") && (q.includes("auto-refresh") || q.includes("auto refresh")))
  ) {
    return HELP_PLAYBOOKS.find((p) => p.id === "reporting_hub") ?? null;
  }
  if (
    q.includes("control tower") ||
    q.includes("control-tower") ||
    q.includes("shipment 360") ||
    q.includes("workbench") ||
    (q.includes("report") && (q.includes("carrier") || q.includes("lane") || q.includes("analytics"))) ||
    (q.includes("dashboard") && q.includes("widget"))
  ) {
    return HELP_PLAYBOOKS.find((p) => p.id === "control_tower") ?? null;
  }
  if (
    q.includes("tariff") ||
    q.includes("freight contract") ||
    q.includes("lane rating") ||
    q.includes("rate lookup") ||
    q.includes("tariff import") ||
    (q.includes("import batch") && (q.includes("tariff") || q.includes("contract")))
  ) {
    return HELP_PLAYBOOKS.find((p) => p.id === "tariffs") ?? null;
  }
  if (q.includes("order")) return HELP_PLAYBOOKS.find((p) => p.id === "create_order") ?? null;
  if (q.includes("supplier")) return HELP_PLAYBOOKS.find((p) => p.id === "create_supplier") ?? null;
  if (q.includes("consol") || q.includes("load") || q.includes("container")) {
    return HELP_PLAYBOOKS.find((p) => p.id === "consolidation") ?? null;
  }
  if (
    !q.includes("tariff") &&
    !(q.includes("snapshot") && (q.includes("pricing") || q.includes("pric"))) &&
    (q.includes(MARKETING_PRICING_PATH) ||
      q.includes("platform hub") ||
      q.includes("module picker") ||
      (q.includes("plans") && (q.includes("pricing") || q.includes("prices"))) ||
      (q.includes("marketing") && (q.includes("pricing") || q.includes("package"))) ||
      (q.includes("evaluation") && (q.includes("pricing") || q.includes("package"))) ||
      q.includes(LEGAL_PRIVACY_PATH) ||
      q.includes(LEGAL_TERMS_PATH) ||
      q.includes(LEGAL_COOKIES_PATH) ||
      q.includes("privacy") ||
      q.includes("gdpr") ||
      q.includes("cookie policy") ||
      q.includes("cookies policy") ||
      (q.includes("cookie") &&
        (q.includes("consent") || q.includes("legal") || q.includes("privacy") || q.includes("site"))) ||
      q.includes("terms of service") ||
      q.includes("terms and conditions"))
  ) {
    return HELP_PLAYBOOKS.find((p) => p.id === "public_marketing") ?? null;
  }
  if (q.includes("user") || q.includes("login") || q.includes("password") || q.includes("role")) {
    return HELP_PLAYBOOKS.find((p) => p.id === "user_admin") ?? null;
  }
  return null;
}
