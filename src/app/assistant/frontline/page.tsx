import type { ComponentProps } from "react";

import { GET } from "@/app/api/assistant/frontline/route";
import { AccessDenied } from "@/components/access-denied";
import { AssistantSnapshotLoadError } from "@/components/assistant/assistant-snapshot-load-error";
import { readAssistantRouteResponse } from "@/lib/assistant/read-assistant-route-response";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { FrontlineClient } from "./frontline-client";

type FrontlineSnapshot = ComponentProps<typeof FrontlineClient>["initialSnapshot"];

export const dynamic = "force-dynamic";

export default async function AssistantFrontlinePage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.wms", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view"));
  if (!canOpen) {
    return <AccessDenied title="Frontline & Mobile Execution Intelligence" message="You need WMS, Control Tower, or supplier view access to open Sprint 24 (AMP26)." />;
  }
  const parsed = await readAssistantRouteResponse(await GET());
  if (!parsed.ok) {
    return (
      <AssistantSnapshotLoadError
        eyebrow="Sprint 24 · AMP26"
        title="Could not load Frontline workspace"
        message={parsed.message}
        hint={
          parsed.status === 503
            ? "Run `npm run db:migrate` against this environment’s database (or confirm Vercel build migrations include AMP26)."
            : undefined
        }
      />
    );
  }
  return <FrontlineClient initialSnapshot={parsed.data as FrontlineSnapshot} />;
}
