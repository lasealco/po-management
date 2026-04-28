import { GET } from "@/app/api/assistant/observability/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ObservabilityClient } from "./observability-client";

export const dynamic = "force-dynamic";

export default async function AssistantObservabilityPage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") || viewerHas(access.grantSet, "org.controltower", "view"));
  if (!canOpen) {
    return <AccessDenied title="Assistant observability" message="You need settings or operations view access to open AMP28." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <ObservabilityClient initialSnapshot={snapshot} />;
}
