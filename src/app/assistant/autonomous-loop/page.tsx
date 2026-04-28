import { GET } from "@/app/api/assistant/autonomous-loop/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { AutonomousLoopClient } from "./autonomous-loop-client";

export const dynamic = "force-dynamic";

export default async function AssistantAutonomousLoopPage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") || viewerHas(access.grantSet, "org.controltower", "view"));
  if (!canOpen) {
    return <AccessDenied title="Assistant autonomous loop" message="You need settings or operations view access to open AMP32." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <AutonomousLoopClient initialSnapshot={snapshot} />;
}
