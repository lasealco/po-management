import { GET } from "@/app/api/assistant/rollout-factory/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { RolloutFactoryClient } from "./rollout-factory-client";

export const dynamic = "force-dynamic";

export default async function AssistantRolloutFactoryPage() {
  const access = await getViewerGrantSet();
  const canOpen = access?.user && viewerHas(access.grantSet, "org.settings", "view");
  if (!canOpen) {
    return <AccessDenied title="Assistant rollout factory" message="You need settings view access to open AMP30." />;
  }
  const request = new Request("http://localhost/api/assistant/rollout-factory?targetSlug=new-customer-pilot");
  const response = await GET(request);
  const snapshot = await response.json();
  return <RolloutFactoryClient initialSnapshot={snapshot} />;
}
