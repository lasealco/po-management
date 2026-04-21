import { SalesOrdersSubNav } from "@/components/sales-orders-subnav";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export default async function SalesOrdersLayout({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  const { linkVisibility } = await resolveNavState(access);

  return (
    <>
      {linkVisibility?.salesOrders ? <SalesOrdersSubNav /> : null}
      {children}
    </>
  );
}
