import { GET } from "@/app/api/assistant/meeting-intelligence/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { MeetingIntelligenceClient } from "./meeting-intelligence-client";

export const dynamic = "force-dynamic";

export default async function AssistantMeetingIntelligencePage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.crm", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view"));
  if (!canOpen) {
    return <AccessDenied title="Meeting intelligence" message="You need CRM, Control Tower, or supplier view access to open AMP27." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <MeetingIntelligenceClient initialSnapshot={snapshot} />;
}
