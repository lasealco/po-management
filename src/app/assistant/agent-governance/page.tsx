import { GET } from "@/app/api/assistant/agent-governance/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { AgentGovernanceClient } from "./agent-governance-client";

export const dynamic = "force-dynamic";

export default async function AgentGovernancePage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") || viewerHas(access.grantSet, "org.reports", "view"));
  if (!canView) {
    return <AccessDenied title="Agent governance" message="You need settings or reports view access to open Sprint 1." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit = viewerHas(access.grantSet, "org.settings", "edit") || viewerHas(access.grantSet, "org.reports", "edit");
  return <AgentGovernanceClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
