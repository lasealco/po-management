import { AccessDenied } from "@/components/access-denied";
import { AssistantEvidenceQualityClient } from "@/components/assistant/assistant-evidence-quality-client";
import { getViewerGrantSet } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantEvidenceQualityPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <AccessDenied
        title="Assistant evidence quality"
        message="Choose an active demo user: open Settings -> Demo session (/settings/demo)."
      />
    );
  }
  return <AssistantEvidenceQualityClient />;
}
