import { GET } from "@/app/api/assistant/risk-war-room/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { RiskWarRoomClient } from "./risk-war-room-client";

export const dynamic = "force-dynamic";

export default async function AssistantRiskWarRoomPage() {
  const access = await getViewerGrantSet();
  if (!access?.user || !viewerHas(access.grantSet, "org.scri", "view")) {
    return <AccessDenied title="Risk war room" message="You need org.scri view to open AMP20 risk intelligence." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <RiskWarRoomClient initialSnapshot={snapshot} />;
}
