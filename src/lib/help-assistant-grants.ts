import { viewerHas, type ViewerAccess } from "@/lib/authz";
import type { HelpDoAction } from "@/lib/help-actions";
import { LEGAL_COOKIES_PATH, LEGAL_PRIVACY_PATH, LEGAL_PUBLIC_HELP_PATHS, LEGAL_TERMS_PATH } from "@/lib/legal-public-paths";
import { MARKETING_PRICING_PATH, MARKETING_PUBLIC_HELP_PATHS, PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";
import { TARIFFS_MODULE_BASE_PATH } from "@/lib/tariff/tariff-workbench-urls";

/** Coarse capabilities passed to Help LLM (server still validates execute). */
export type HelpAssistantGrantSnapshot = {
  signedIn: boolean;
  ordersView: boolean;
  /** Orders view and not supplier-portal restricted (matches consolidation gate). */
  consolidationNav: boolean;
  suppliersView: boolean;
  settingsView: boolean;
  productsView: boolean;
  controlTowerView: boolean;
  /** Can open /reporting hub shell */
  reportingHub: boolean;
  reportingFocusPo: boolean;
  reportingFocusCt: boolean;
  reportingFocusCrm: boolean;
  reportingFocusWms: boolean;
  reportsView: boolean;
  crmView: boolean;
  wmsView: boolean;
  tariffsView: boolean;
  rfqView: boolean;
  invoiceAuditView: boolean;
  /** Mirrors nav: tariffs OR rfq OR invoice audit */
  pricingSnapshotsView: boolean;
};

const ALWAYS_ROUTE_HINT = new Set<string>([
  PLATFORM_HUB_PATH,
  MARKETING_PRICING_PATH,
  "/login",
  LEGAL_PRIVACY_PATH,
  LEGAL_TERMS_PATH,
  LEGAL_COOKIES_PATH,
  ...MARKETING_PUBLIC_HELP_PATHS,
  ...LEGAL_PUBLIC_HELP_PATHS,
]);

export function buildHelpAssistantGrantSnapshot(
  access: ViewerAccess | null,
  options: { supplierPortalRestricted: boolean },
): HelpAssistantGrantSnapshot {
  const user = access?.user;
  const gs = access?.grantSet ?? new Set();
  const signedIn = Boolean(user);
  const ordersView = signedIn && viewerHas(gs, "org.orders", "view");
  const consolidationNav = ordersView && !options.supplierPortalRestricted;
  const suppliersView = signedIn && viewerHas(gs, "org.suppliers", "view");
  const settingsView = signedIn && viewerHas(gs, "org.settings", "view");
  const productsView = signedIn && viewerHas(gs, "org.products", "view");
  const controlTowerView = signedIn && viewerHas(gs, "org.controltower", "view");
  const reportsView = signedIn && viewerHas(gs, "org.reports", "view");
  const crmView = signedIn && viewerHas(gs, "org.crm", "view");
  const wmsView = signedIn && viewerHas(gs, "org.wms", "view");
  const tariffsView = signedIn && viewerHas(gs, "org.tariffs", "view");
  const rfqView = signedIn && viewerHas(gs, "org.rfq", "view");
  const invoiceAuditView = signedIn && viewerHas(gs, "org.invoice_audit", "view");
  const pricingSnapshotsView = tariffsView || rfqView || invoiceAuditView;
  const reportingHub = signedIn && (reportsView || controlTowerView || crmView || wmsView);

  return {
    signedIn,
    ordersView,
    consolidationNav,
    suppliersView,
    settingsView,
    productsView,
    controlTowerView,
    reportingHub,
    reportingFocusPo: reportsView,
    reportingFocusCt: controlTowerView,
    reportingFocusCrm: crmView,
    reportingFocusWms: wmsView,
    reportsView,
    crmView,
    wmsView,
    tariffsView,
    rfqView,
    invoiceAuditView,
    pricingSnapshotsView,
  };
}

export function helpAssistantOpenPathAllowed(path: string, g: HelpAssistantGrantSnapshot): boolean {
  if (ALWAYS_ROUTE_HINT.has(path)) return true;
  if (path === "/orders") return g.ordersView;
  if (path === "/consolidation") return g.consolidationNav;
  if (path === "/suppliers") return g.suppliersView;
  if (path === "/settings/users" || path === "/settings/warehouses") return g.settingsView;
  if (path === "/catalog" || path === "/products") return g.productsView;
  if (path === "/product-trace") return g.ordersView;
  if (path.startsWith("/control-tower")) return g.controlTowerView;
  if (path === "/reporting") return g.reportingHub;
  if (path === "/reports") return g.reportsView;
  if (path === "/crm/reporting") return g.crmView;
  if (path === "/wms/reporting") return g.wmsView;
  if (path.startsWith(TARIFFS_MODULE_BASE_PATH)) return g.tariffsView;
  if (path.startsWith("/rfq")) return g.rfqView;
  if (path.startsWith("/invoice-audit")) return g.invoiceAuditView;
  if (path.startsWith("/pricing-snapshots")) return g.pricingSnapshotsView;
  return true;
}

export function filterRouteHintsForGrants<T extends { href: string }>(hints: T[], g: HelpAssistantGrantSnapshot): T[] {
  return hints.filter((h) => helpAssistantOpenPathAllowed(h.href, g));
}

export function filterHelpDoActionsByGrants(actions: HelpDoAction[], g: HelpAssistantGrantSnapshot): HelpDoAction[] {
  return actions.filter((a) => {
    if (a.type === "open_order" || a.type === "open_orders_queue") return g.ordersView;
    if (a.type !== "open_path") return false;
    const path = typeof a.payload?.path === "string" ? a.payload.path.trim() : "";
    if (!path.startsWith("/")) return false;
    const pathOnly = path.split("?")[0] ?? path;
    return helpAssistantOpenPathAllowed(pathOnly, g);
  });
}
