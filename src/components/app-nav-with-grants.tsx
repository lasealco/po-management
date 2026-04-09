import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { AppNav } from "@/components/app-nav";

/** Server wrapper: hides main nav items the active demo user cannot access. */
export async function AppNavWithGrants() {
  const access = await getViewerGrantSet();
  const linkVisibility =
    access?.user != null
      ? {
          orders: viewerHas(access.grantSet, "org.orders", "view"),
          products: viewerHas(access.grantSet, "org.products", "view"),
          settings: viewerHas(access.grantSet, "org.settings", "view"),
          suppliers: viewerHas(access.grantSet, "org.suppliers", "view"),
        }
      : undefined;

  return <AppNav linkVisibility={linkVisibility} />;
}
