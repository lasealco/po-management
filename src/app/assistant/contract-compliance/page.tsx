import { GET } from "@/app/api/assistant/contract-compliance/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ContractComplianceClient } from "./contract-compliance-client";

export const dynamic = "force-dynamic";

export default async function AssistantContractCompliancePage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.suppliers", "view") ||
      viewerHas(access.grantSet, "org.rfq", "view") ||
      viewerHas(access.grantSet, "org.tariffs", "view"));
  if (!canOpen) {
    return <AccessDenied title="Contract compliance" message="You need supplier, RFQ, or tariff view access to open AMP23." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <ContractComplianceClient initialSnapshot={snapshot} />;
}
