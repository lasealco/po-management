import { GET } from "@/app/api/assistant/governance/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { GovernanceClient } from "./governance-client";

export const dynamic = "force-dynamic";

export default async function AssistantGovernancePage() {
  const access = await getViewerGrantSet();
  const canOpen = access?.user && viewerHas(access.grantSet, "org.settings", "view");
  if (!canOpen) {
    return <AccessDenied title="Assistant governance" message="You need settings view access to open AMP29." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <GovernanceClient initialSnapshot={snapshot} />;
}
