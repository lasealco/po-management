import { AccessDenied } from "@/components/access-denied";
import { GET } from "@/app/api/assistant/finance-control/route";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { FinanceControlClient } from "./finance-control-client";

export const dynamic = "force-dynamic";

export default async function AssistantFinanceControlPage() {
  const access = await getViewerGrantSet();
  if (!access?.user || !viewerHas(access.grantSet, "org.invoice_audit", "view")) {
    return <AccessDenied title="Finance control tower" message="You need org.invoice_audit view to open AMP19 finance control." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <FinanceControlClient initialSnapshot={snapshot} />;
}
