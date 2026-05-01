import type { ComponentProps } from "react";

import { GET } from "@/app/api/assistant/meeting-intelligence/route";
import { AccessDenied } from "@/components/access-denied";
import { AssistantSnapshotLoadError } from "@/components/assistant/assistant-snapshot-load-error";
import { readAssistantRouteResponse } from "@/lib/assistant/read-assistant-route-response";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { MeetingIntelligenceClient } from "./meeting-intelligence-client";

type MeetingSnapshot = ComponentProps<typeof MeetingIntelligenceClient>["initialSnapshot"];

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
  const parsed = await readAssistantRouteResponse(await GET());
  if (!parsed.ok) {
    return (
      <AssistantSnapshotLoadError
        eyebrow="AMP27"
        title="Could not load Meeting intelligence"
        message={parsed.message}
        hint={
          parsed.status === 503
            ? "Run `npm run db:migrate` against this environment’s database (or confirm Vercel build migrations include AMP27)."
            : undefined
        }
      />
    );
  }
  return <MeetingIntelligenceClient initialSnapshot={parsed.data as MeetingSnapshot} />;
}
