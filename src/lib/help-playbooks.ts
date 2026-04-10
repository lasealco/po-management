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
    id: "create_order",
    title: "Create a Purchase Order",
    summary: "Guide to creating and sending a PO to supplier.",
    steps: [
      {
        title: "Open Orders board",
        description: "Go to Orders and check your current draft queue.",
        href: "/",
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
        href: "/",
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
  if (q.includes("order")) return HELP_PLAYBOOKS.find((p) => p.id === "create_order") ?? null;
  if (q.includes("supplier")) return HELP_PLAYBOOKS.find((p) => p.id === "create_supplier") ?? null;
  if (q.includes("consol") || q.includes("load") || q.includes("container")) {
    return HELP_PLAYBOOKS.find((p) => p.id === "consolidation") ?? null;
  }
  if (q.includes("user") || q.includes("login") || q.includes("password") || q.includes("role")) {
    return HELP_PLAYBOOKS.find((p) => p.id === "user_admin") ?? null;
  }
  return null;
}
