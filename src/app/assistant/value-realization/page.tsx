import { GET } from "@/app/api/assistant/value-realization/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ValueRealizationClient } from "./value-realization-client";

export const dynamic = "force-dynamic";

export default async function AssistantValueRealizationPage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") || viewerHas(access.grantSet, "org.reports", "view"));
  if (!canOpen) {
    return <AccessDenied title="Assistant value realization" message="You need settings or reports view access to open AMP31." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <ValueRealizationClient initialSnapshot={snapshot} />;
}
