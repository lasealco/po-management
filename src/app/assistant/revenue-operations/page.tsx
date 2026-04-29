import { GET } from "@/app/api/assistant/revenue-operations/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { RevenueOperationsClient } from "./revenue-operations-client";

export const dynamic = "force-dynamic";

export default async function AssistantRevenueOperationsPage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.crm", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.settings", "view"));
  if (!canOpen) {
    return <AccessDenied title="Assistant revenue operations" message="You need CRM, orders, or settings view access to open AMP36." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <RevenueOperationsClient initialSnapshot={snapshot} />;
}
