import { getViewerGrantSet, userHasRoleNamed, viewerHas } from "@/lib/authz";
import { AppNav } from "@/components/app-nav";

/** Server wrapper: hides main nav items the active demo user cannot access. */
export async function AppNavWithGrants() {
  const access = await getViewerGrantSet();

  const isSupplierPortalUser =
    access?.user != null &&
    (await userHasRoleNamed(access.user.id, "Supplier portal"));

  const linkVisibility =
    access?.user != null
      ? {
          orders: viewerHas(access.grantSet, "org.orders", "view"),
          reports: viewerHas(access.grantSet, "org.reports", "view"),
          consolidation: viewerHas(access.grantSet, "org.orders", "view"),
          wms: viewerHas(access.grantSet, "org.wms", "view"),
          // Tab visible for internal users even if prod roles predate org.crm; /crm and APIs still require org.crm.
          crm:
            viewerHas(access.grantSet, "org.crm", "view") ||
            (!isSupplierPortalUser &&
              (viewerHas(access.grantSet, "org.orders", "view") ||
                viewerHas(access.grantSet, "org.settings", "view"))),
          products: viewerHas(access.grantSet, "org.products", "view"),
          settings: viewerHas(access.grantSet, "org.settings", "view"),
          suppliers: viewerHas(access.grantSet, "org.suppliers", "view"),
        }
      : undefined;

  const setupIncomplete =
    access?.user != null &&
    linkVisibility != null &&
    !(
      linkVisibility.orders ||
      linkVisibility.reports ||
      linkVisibility.consolidation ||
      linkVisibility.wms ||
      linkVisibility.crm ||
      linkVisibility.products ||
      linkVisibility.settings ||
      linkVisibility.suppliers
    );

  return (
    <AppNav
      linkVisibility={linkVisibility}
      setupIncomplete={setupIncomplete}
    />
  );
}
