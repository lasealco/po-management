import { GET } from "@/app/api/assistant/partner-ecosystem/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { PartnerEcosystemClient } from "./partner-ecosystem-client";

export const dynamic = "force-dynamic";

export default async function AssistantPartnerEcosystemPage() {
  const access = await getViewerGrantSet();
  const canApiHub = access?.user && viewerHas(access.grantSet, "org.apihub", "view");
  const canPartners =
    access?.user &&
    (viewerHas(access.grantSet, "org.suppliers", "view") || viewerHas(access.grantSet, "org.crm", "view"));
  if (!canApiHub || !canPartners) {
    return <AccessDenied title="Partner ecosystem" message="You need API Hub and supplier or CRM view access to open AMP25." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <PartnerEcosystemClient initialSnapshot={snapshot} />;
}
