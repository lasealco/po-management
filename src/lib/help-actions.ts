import { actorIsSupplierPortalRestricted, viewerHas, type ViewerAccess } from "@/lib/authz";
import { HELP_PLAYBOOKS, type HelpPlaybookDoAction } from "@/lib/help-playbooks";
import { LEGAL_PUBLIC_HELP_PATHS } from "@/lib/legal-public-paths";
import { getPurchaseOrderScopeWhere } from "@/lib/org-scope";
import { MARKETING_PUBLIC_HELP_PATHS } from "@/lib/marketing-public-paths";
import { prisma } from "@/lib/prisma";
import { TARIFF_HELP_OPEN_PATHS, TARIFFS_MODULE_BASE_PATH } from "@/lib/tariff/tariff-workbench-urls";

/** Client-safe "do" actions the help assistant may offer; execution is always validated server-side. */
export type HelpDoAction = HelpPlaybookDoAction;

export type HelpDoResult =
  | { ok: true; href: string; message: string }
  | { ok: false; error: string };

const QUEUE_FILTERS = new Set([
  "all",
  "needs_my_action",
  "waiting_on_me",
  "awaiting_supplier",
  "overdue",
  "split_pending_buyer",
]);

const MAX_PRODUCT_TRACE_OPEN_PATH_Q = 64;

function sanitizeProductTraceOpenPathQuery(raw: string): string | undefined {
  const m = raw.trim().match(/^([A-Za-z0-9._-]+)/);
  if (!m) return undefined;
  const t = m[1].slice(0, MAX_PRODUCT_TRACE_OPEN_PATH_Q);
  return t || undefined;
}

const OPEN_PATH_ALLOWLIST = new Set([
  "/",
  "/orders",
  "/consolidation",
  "/suppliers",
  "/settings/users",
  "/settings/organization/structure",
  "/settings/organization/legal-entities",
  "/settings/warehouses",
  "/login",
  "/forgot-password",
  "/reset-password",
  ...MARKETING_PUBLIC_HELP_PATHS,
  ...LEGAL_PUBLIC_HELP_PATHS,
  "/catalog",
  "/products",
  "/product-trace",
  "/control-tower",
  "/control-tower/workbench",
  "/control-tower/digest",
  "/control-tower/reports",
  "/control-tower/search",
  "/control-tower/dashboard",
  "/control-tower/command-center",
  "/control-tower/ops",
  ...TARIFF_HELP_OPEN_PATHS,
  "/rfq/requests",
  "/rfq/requests/new",
  "/pricing-snapshots",
  "/pricing-snapshots/new",
  "/invoice-audit",
  "/invoice-audit/new",
  "/invoice-audit/tolerance-rules",
  "/invoice-audit/readiness",
  "/reporting",
  "/reports",
  "/crm/reporting",
  "/wms/reporting",
]);

const ORDER_FOCUS = new Set(["workflow", "asn", "chat", "split"]);

/**
 * Allowed `?focus=` on `/reporting` (scroll-to-section; must match hub section ids).
 * Composed URLs: `reporting-hub-paths.ts` (`REPORTING_HUB_FOCUS_*_HREF`).
 */
const REPORTING_FOCUS = new Set(["po", "control-tower", "crm", "wms"]);

function normalizeOpenPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.includes("..")) return null;
  const pathOnly = t.split("?")[0] ?? t;
  return OPEN_PATH_ALLOWLIST.has(pathOnly) ? pathOnly : null;
}

function buildQueryString(parts: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(parts)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

function withQuery(path: string, queryString: string): string {
  if (!queryString) return path;
  return `${path}?${queryString}`;
}

function orderNumberCandidates(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  const upper = t.toUpperCase();
  const out = new Set<string>([t, upper]);
  const digits = t.replace(/^po-?/i, "").trim();
  if (/^\d+$/.test(digits)) {
    out.add(`PO-${digits}`);
    out.add(`po-${digits}`);
  }
  return [...out];
}

export function sanitizeHelpDoActions(raw: unknown): HelpDoAction[] {
  if (!Array.isArray(raw)) return [];
  const out: HelpDoAction[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const type = r.type;
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!label || (type !== "open_order" && type !== "open_orders_queue" && type !== "open_path")) {
      continue;
    }
    const payload =
      r.payload && typeof r.payload === "object" && !Array.isArray(r.payload)
        ? (r.payload as Record<string, unknown>)
        : undefined;
    out.push({ type, label, payload });
    if (out.length >= 4) break;
  }
  return out;
}

export async function executeHelpDoAction(
  access: ViewerAccess,
  action: HelpDoAction,
): Promise<HelpDoResult> {
  if (!access.user) {
    return { ok: false, error: "Sign in or choose an active user to run actions." };
  }

  const payload = action.payload ?? {};

  if (action.type === "open_path") {
    const path = normalizeOpenPath(payload.path);
    if (!path) {
      return { ok: false, error: "That navigation target is not allowed." };
    }
    if (path === "/orders") {
      if (!viewerHas(access.grantSet, "org.orders", "view")) {
        return { ok: false, error: "You do not have permission to view orders." };
      }
    } else if (path === "/consolidation") {
      if (!viewerHas(access.grantSet, "org.orders", "view")) {
        return { ok: false, error: "You do not have permission to open consolidation." };
      }
      if (await actorIsSupplierPortalRestricted(access.user.id)) {
        return { ok: false, error: "Consolidation is not available for supplier portal users." };
      }
    } else if (path === "/suppliers") {
      if (!viewerHas(access.grantSet, "org.suppliers", "view")) {
        return { ok: false, error: "You do not have permission to view suppliers." };
      }
    } else if (
      path === "/settings/users" ||
      path === "/settings/organization/structure" ||
      path === "/settings/organization/legal-entities" ||
      path === "/settings/warehouses"
    ) {
      if (!viewerHas(access.grantSet, "org.settings", "view")) {
        return { ok: false, error: "You do not have permission to open settings." };
      }
    } else if (path === "/catalog" || path === "/products") {
      if (!viewerHas(access.grantSet, "org.products", "view")) {
        return { ok: false, error: "You do not have permission to view the catalog." };
      }
    } else if (path === "/product-trace") {
      if (!viewerHas(access.grantSet, "org.orders", "view")) {
        return { ok: false, error: "You do not have permission to open product trace." };
      }
    } else if (path.startsWith("/control-tower")) {
      if (!viewerHas(access.grantSet, "org.controltower", "view")) {
        return { ok: false, error: "You do not have permission to open Control Tower." };
      }
    } else if (path === "/reporting") {
      const canReportingHub =
        viewerHas(access.grantSet, "org.reports", "view") ||
        viewerHas(access.grantSet, "org.controltower", "view") ||
        viewerHas(access.grantSet, "org.crm", "view") ||
        viewerHas(access.grantSet, "org.wms", "view");
      if (!canReportingHub) {
        return { ok: false, error: "You do not have permission to open the reporting hub." };
      }
    } else if (path.startsWith(TARIFFS_MODULE_BASE_PATH)) {
      if (!viewerHas(access.grantSet, "org.tariffs", "view")) {
        return { ok: false, error: "You do not have permission to open Tariffs." };
      }
    } else if (path.startsWith("/rfq")) {
      if (!viewerHas(access.grantSet, "org.rfq", "view")) {
        return { ok: false, error: "You do not have permission to open RFQ." };
      }
    }
    const traceQPayload =
      path === "/product-trace" && typeof payload.q === "string"
        ? sanitizeProductTraceOpenPathQuery(payload.q)
        : undefined;
    const playbookId = typeof payload.guide === "string" ? payload.guide.trim() : "";
    const stepRaw = payload.step;
    const step =
      typeof stepRaw === "number" && Number.isFinite(stepRaw)
        ? Math.max(0, Math.floor(stepRaw))
        : typeof stepRaw === "string" && /^\d+$/.test(stepRaw)
          ? Math.max(0, parseInt(stepRaw, 10))
          : undefined;
    const validGuide =
      playbookId && HELP_PLAYBOOKS.some((p) => p.id === playbookId) ? playbookId : undefined;
    const focusRaw = typeof payload.focus === "string" ? payload.focus.trim().toLowerCase() : "";
    let reportingFocus =
      path === "/reporting" && focusRaw && REPORTING_FOCUS.has(focusRaw) ? focusRaw : undefined;
    if (reportingFocus === "po" && !viewerHas(access.grantSet, "org.reports", "view")) {
      reportingFocus = undefined;
    }
    if (reportingFocus === "control-tower" && !viewerHas(access.grantSet, "org.controltower", "view")) {
      reportingFocus = undefined;
    }
    if (reportingFocus === "crm" && !viewerHas(access.grantSet, "org.crm", "view")) {
      reportingFocus = undefined;
    }
    if (reportingFocus === "wms" && !viewerHas(access.grantSet, "org.wms", "view")) {
      reportingFocus = undefined;
    }
    const qs = buildQueryString({
      focus: reportingFocus,
      guide: validGuide,
      step: validGuide != null && step != null ? step : undefined,
      q: traceQPayload,
    });
    return {
      ok: true,
      href: withQuery(path, qs),
      message: `Opening ${path.replace(/^\//, "") || "home"}…`,
    };
  }

  if (action.type === "open_orders_queue") {
    if (!viewerHas(access.grantSet, "org.orders", "view")) {
      return { ok: false, error: "You do not have permission to view orders." };
    }
    const queue = typeof payload.queue === "string" ? payload.queue.trim() : "";
    if (!QUEUE_FILTERS.has(queue)) {
      return { ok: false, error: "Invalid queue filter." };
    }
    const playbookId = typeof payload.guide === "string" ? payload.guide.trim() : "";
    const stepRaw = payload.step;
    const step =
      typeof stepRaw === "number" && Number.isFinite(stepRaw)
        ? Math.max(0, Math.floor(stepRaw))
        : undefined;
    const validGuide =
      playbookId && HELP_PLAYBOOKS.some((p) => p.id === playbookId) ? playbookId : undefined;
    const qs = buildQueryString({
      queue: queue === "all" ? undefined : queue,
      guide: validGuide,
      step: validGuide != null && step != null ? step : undefined,
    });
    return {
      ok: true,
      href: withQuery("/orders", qs),
      message:
        queue === "all"
          ? "Opening the full orders board…"
          : `Filtering orders: ${queue.replace(/_/g, " ")}…`,
    };
  }

  if (action.type === "open_order") {
    if (!viewerHas(access.grantSet, "org.orders", "view")) {
      return { ok: false, error: "You do not have permission to view orders." };
    }
    const orderNumberRaw = typeof payload.orderNumber === "string" ? payload.orderNumber : "";
    const candidates = orderNumberCandidates(orderNumberRaw);
    if (candidates.length === 0) {
      return { ok: false, error: "Missing or invalid order number." };
    }
    const focusRaw = typeof payload.focus === "string" ? payload.focus.trim() : "";
    const focus = ORDER_FOCUS.has(focusRaw) ? focusRaw : undefined;

    const helpActorId = access.user.id;
    const isSupplierPortalUser = await actorIsSupplierPortalRestricted(helpActorId);
    const poOpenScope = await getPurchaseOrderScopeWhere(access.tenant.id, helpActorId, {
      isSupplierPortalUser,
    });
    const order = await prisma.purchaseOrder.findFirst({
      where: {
        tenantId: access.tenant.id,
        OR: candidates.map((c) => ({
          orderNumber: { equals: c, mode: "insensitive" as const },
        })),
        ...(poOpenScope ?? {}),
      },
      select: {
        id: true,
        orderNumber: true,
        workflow: { select: { supplierPortalOn: true } },
      },
    });

    if (!order) {
      return { ok: false, error: `No order matched “${orderNumberRaw.trim()}” in your tenant.` };
    }

    if (isSupplierPortalUser && !order.workflow.supplierPortalOn) {
      return {
        ok: false,
        error: "That order is not available in the supplier portal view.",
      };
    }

    const playbookId = typeof payload.guide === "string" ? payload.guide.trim() : "";
    const stepRaw = payload.step;
    const step =
      typeof stepRaw === "number" && Number.isFinite(stepRaw)
        ? Math.max(0, Math.floor(stepRaw))
        : undefined;
    const validGuide =
      playbookId && HELP_PLAYBOOKS.some((p) => p.id === playbookId) ? playbookId : undefined;

    const qs = buildQueryString({
      focus,
      guide: validGuide,
      step: validGuide != null && step != null ? step : undefined,
    });

    return {
      ok: true,
      href: withQuery(`/orders/${order.id}`, qs),
      message: `Opening ${order.orderNumber}${focus ? ` (${focus})` : ""}…`,
    };
  }

  return { ok: false, error: "Unknown action." };
}
