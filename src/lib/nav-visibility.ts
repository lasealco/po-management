import { actorIsSupplierPortalRestricted, viewerHas, type ViewerAccess } from "@/lib/authz";

export type AppNavLinkVisibility = {
  /** True if any PO Management child is visible. */
  poManagement: boolean;
  orders: boolean;
  reports: boolean;
  executive: boolean;
  consolidation: boolean;
  controlTower: boolean;
  wms: boolean;
  crm: boolean;
  products: boolean;
  settings: boolean;
  suppliers: boolean;
  /** Supplier relationship management hub (procurement); same gate as suppliers for now. */
  srm: boolean;
  salesOrders: boolean;
  tariffs: boolean;
  rfq: boolean;
  /** Pricing snapshots (frozen contract or RFQ economics); visible with tariffs or RFQ access. */
  pricingSnapshots: boolean;
  invoiceAudit: boolean;
};

export type PoMgmtSubNavVisibility = {
  orders: boolean;
  consolidation: boolean;
  products: boolean;
  suppliers: boolean;
};

export async function resolveNavState(access: ViewerAccess | null): Promise<{
  linkVisibility: AppNavLinkVisibility | undefined;
  setupIncomplete: boolean;
  poSubNavVisibility: PoMgmtSubNavVisibility;
}> {
  const isSupplierPortalUser =
    access?.user != null && (await actorIsSupplierPortalRestricted(access.user.id));

  const linkVisibility: AppNavLinkVisibility | undefined =
    access?.user != null
      ? (() => {
          const orders = viewerHas(access.grantSet, "org.orders", "view");
          const reports = viewerHas(access.grantSet, "org.reports", "view");
          const executive = reports;
          const consolidation = orders;
          const wms = viewerHas(access.grantSet, "org.wms", "view");
          const controlTower = viewerHas(access.grantSet, "org.controltower", "view");
          const crm =
            viewerHas(access.grantSet, "org.crm", "view") ||
            (!isSupplierPortalUser &&
              (orders || viewerHas(access.grantSet, "org.settings", "view")));
          const products = viewerHas(access.grantSet, "org.products", "view");
          const settings = viewerHas(access.grantSet, "org.settings", "view");
          const suppliers = viewerHas(access.grantSet, "org.suppliers", "view");
          const srm = suppliers;
          const salesOrders = orders;
          const tariffs = viewerHas(access.grantSet, "org.tariffs", "view");
          const rfq = viewerHas(access.grantSet, "org.rfq", "view");
          const pricingSnapshots = tariffs || rfq;
          const invoiceAudit = viewerHas(access.grantSet, "org.invoice_audit", "view");
          const poManagement = orders || consolidation || products;
          return {
            poManagement,
            orders,
            reports,
            executive,
            consolidation,
            controlTower,
            wms,
            crm,
            products,
            settings,
            suppliers,
            srm,
            salesOrders,
            tariffs,
            rfq,
            pricingSnapshots,
            invoiceAudit,
          };
        })()
      : undefined;

  const setupIncomplete =
    access?.user != null &&
    linkVisibility != null &&
      !(
      linkVisibility.orders ||
      linkVisibility.reports ||
      linkVisibility.executive ||
      linkVisibility.consolidation ||
      linkVisibility.controlTower ||
      linkVisibility.wms ||
      linkVisibility.crm ||
      linkVisibility.products ||
      linkVisibility.settings ||
      linkVisibility.suppliers ||
      linkVisibility.srm ||
      linkVisibility.salesOrders ||
      linkVisibility.tariffs ||
      linkVisibility.rfq ||
      linkVisibility.pricingSnapshots ||
      linkVisibility.invoiceAudit
    );

  const poSubNavVisibility: PoMgmtSubNavVisibility = setupIncomplete
    ? { orders: true, consolidation: true, products: true, suppliers: false }
    : linkVisibility
      ? {
          orders: linkVisibility.orders,
          consolidation: linkVisibility.consolidation && !isSupplierPortalUser,
          products: linkVisibility.products,
          suppliers: false,
        }
      : { orders: false, consolidation: false, products: false, suppliers: false };

  return { linkVisibility, setupIncomplete, poSubNavVisibility };
}
