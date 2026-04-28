import { AccessDenied } from "@/components/access-denied";
import { AssistantGovernedAutomationClient } from "@/components/assistant/assistant-governed-automation-client";
import { getViewerGrantSet } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantGovernedAutomationPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Assistant governed automation"
        message="Choose an active demo user: open Settings -> Demo session (/settings/demo)."
      />
    );
  }
  return <AssistantGovernedAutomationClient />;
}
