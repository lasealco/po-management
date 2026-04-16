import { userHasRoleNamed, viewerHas, type ViewerAccess } from "@/lib/authz";

export type AppNavLinkVisibility = {
  /** True if any PO Management child is visible. */
  poManagement: boolean;
  orders: boolean;
  reports: boolean;
  consolidation: boolean;
  controlTower: boolean;
  wms: boolean;
  crm: boolean;
  products: boolean;
  settings: boolean;
  suppliers: boolean;
  salesOrders: boolean;
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
    access?.user != null &&
    (await userHasRoleNamed(access.user.id, "Supplier portal"));

  const linkVisibility: AppNavLinkVisibility | undefined =
    access?.user != null
      ? (() => {
          const orders = viewerHas(access.grantSet, "org.orders", "view");
          const reports = viewerHas(access.grantSet, "org.reports", "view");
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
          const salesOrders = orders;
          const poManagement = orders || consolidation || products || suppliers;
          return {
            poManagement,
            orders,
            reports,
            consolidation,
            controlTower,
            wms,
            crm,
            products,
            settings,
            suppliers,
            salesOrders,
          };
        })()
      : undefined;

  const setupIncomplete =
    access?.user != null &&
    linkVisibility != null &&
      !(
      linkVisibility.orders ||
      linkVisibility.reports ||
      linkVisibility.consolidation ||
      linkVisibility.controlTower ||
      linkVisibility.wms ||
      linkVisibility.crm ||
      linkVisibility.products ||
      linkVisibility.settings ||
      linkVisibility.suppliers ||
      linkVisibility.salesOrders
    );

  const poSubNavVisibility: PoMgmtSubNavVisibility = setupIncomplete
    ? { orders: true, consolidation: true, products: true, suppliers: true }
    : linkVisibility
      ? {
          orders: linkVisibility.orders,
          consolidation: linkVisibility.consolidation && !isSupplierPortalUser,
          products: linkVisibility.products,
          suppliers: linkVisibility.suppliers,
        }
      : { orders: false, consolidation: false, products: false, suppliers: false };

  return { linkVisibility, setupIncomplete, poSubNavVisibility };
}
