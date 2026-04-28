import { AccessDenied } from "@/components/access-denied";
import { GET } from "@/app/api/assistant/customer-intelligence/route";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { CustomerIntelligenceClient } from "./customer-intelligence-client";

export const dynamic = "force-dynamic";

export default async function AssistantCustomerIntelligencePage() {
  const access = await getViewerGrantSet();
  if (!access?.user || !viewerHas(access.grantSet, "org.crm", "view")) {
    return <AccessDenied title="Customer intelligence" message="You need org.crm view to open AMP18 customer intelligence." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <CustomerIntelligenceClient initialSnapshot={snapshot} />;
}
