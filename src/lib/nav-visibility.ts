import {
  actorIsCustomerCrmScoped,
  actorIsSupplierPortalRestricted,
  viewerHas,
  type ViewerAccess,
} from "@/lib/authz";

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
  apihub: boolean;
  /** Supply Chain Twin — cross-module intelligence preview; no dedicated org.* grant yet. */
  supplyChainTwin: boolean;
  /** Supply Chain Risk Intelligence (external events + feed). */
  riskIntelligence: boolean;
  /** Phase H: supplier self-service home; only for Supplier portal users. */
  srmSupplierPortal: boolean;
  /** AI sales assistant (MP1); same gate as sales orders. */
  assistant: boolean;
  /** MP2: Assistant attention inbox; Control Tower and/or sales orders. */
  inbox: boolean;
};

export type PoMgmtSubNavVisibility = {
  orders: boolean;
  consolidation: boolean;
  products: boolean;
  /** Same gate as orders (org.orders → view). */
  productTrace: boolean;
  suppliers: boolean;
};

export async function resolveNavState(access: ViewerAccess | null): Promise<{
  linkVisibility: AppNavLinkVisibility | undefined;
  setupIncomplete: boolean;
  poSubNavVisibility: PoMgmtSubNavVisibility;
}> {
  const isSupplierPortalUser =
    access?.user != null && (await actorIsSupplierPortalRestricted(access.user.id));
  const isCustomerCrmScoped =
    access?.user != null && (await actorIsCustomerCrmScoped(access.user.id));

  const linkVisibility: AppNavLinkVisibility | undefined =
    access?.user != null
      ? (() => {
          const orders = viewerHas(access.grantSet, "org.orders", "view");
          const reports = viewerHas(access.grantSet, "org.reports", "view");
          const executive = reports;
          const consolidation = orders && !isCustomerCrmScoped;
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
          const invoiceAudit = viewerHas(access.grantSet, "org.invoice_audit", "view");
          const apihub = true;
          /** Snapshot library is shared: tariffs/RFQ owners, or invoice auditors who need snapshot IDs for matching. */
          const pricingSnapshots = tariffs || rfq || invoiceAudit;
          const poManagement = orders || consolidation || products;
          /** Preview entry: anyone with meaningful cross-module workspace access (not supplier-portal-only). */
          const supplyChainTwin =
            !isSupplierPortalUser &&
            !isCustomerCrmScoped &&
            (controlTower ||
              orders ||
              wms ||
              reports ||
              salesOrders ||
              crm ||
              suppliers ||
              tariffs ||
              rfq ||
              invoiceAudit);
          const riskIntelligence =
            !isSupplierPortalUser &&
            !isCustomerCrmScoped &&
            viewerHas(access.grantSet, "org.scri", "view");
          const srmSupplierPortal = isSupplierPortalUser;
          const assistant = salesOrders;
          const inbox = controlTower || salesOrders;
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
            assistant,
            inbox,
            tariffs,
            rfq,
            pricingSnapshots,
            invoiceAudit,
            apihub,
            supplyChainTwin,
            riskIntelligence,
            srmSupplierPortal,
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
      linkVisibility.invoiceAudit ||
      linkVisibility.apihub ||
      linkVisibility.supplyChainTwin ||
      linkVisibility.riskIntelligence ||
      linkVisibility.srmSupplierPortal ||
      linkVisibility.assistant ||
      linkVisibility.inbox
    );

  const poSubNavVisibility: PoMgmtSubNavVisibility = setupIncomplete
    ? { orders: true, consolidation: true, products: true, productTrace: true, suppliers: false }
    : linkVisibility
      ? {
          orders: linkVisibility.orders,
          consolidation: linkVisibility.consolidation && !isSupplierPortalUser,
          products: linkVisibility.products,
          productTrace: linkVisibility.orders,
          suppliers: false,
        }
      : {
          orders: false,
          consolidation: false,
          products: false,
          productTrace: false,
          suppliers: false,
        };

  return { linkVisibility, setupIncomplete, poSubNavVisibility };
}
