import { GET } from "@/app/api/assistant/sustainability/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { SustainabilityClient } from "./sustainability-client";

export const dynamic = "force-dynamic";

export default async function AssistantSustainabilityPage() {
  const access = await getViewerGrantSet();
  const canOps =
    access?.user &&
    (viewerHas(access.grantSet, "org.controltower", "view") || viewerHas(access.grantSet, "org.wms", "view"));
  const canPartners =
    access?.user &&
    (viewerHas(access.grantSet, "org.suppliers", "view") || viewerHas(access.grantSet, "org.crm", "view"));
  if (!canOps || !canPartners) {
    return <AccessDenied title="Sustainability" message="You need operational and partner evidence access to open AMP24." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <SustainabilityClient initialSnapshot={snapshot} />;
}
