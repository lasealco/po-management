import { AccessDenied } from "@/components/access-denied";
import { AssistantWorkEngineClient } from "@/components/assistant/assistant-work-engine-client";
import { getViewerGrantSet } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantWorkEnginePage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Assistant work engine"
        message="Choose an active demo user: open Settings -> Demo session (/settings/demo)."
      />
    );
  }
  return <AssistantWorkEngineClient />;
}
