import { GET } from "@/app/api/assistant/advanced-programs/[programKey]/route";
import { AccessDenied } from "@/components/access-denied";
import { getAdvancedProgramConfig } from "@/lib/assistant/advanced-programs";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { AdvancedProgramClient } from "./advanced-program-client";

export const dynamic = "force-dynamic";

export default async function AssistantAdvancedProgramPage({ params }: { params: Promise<{ programKey: string }> }) {
  const { programKey } = await params;
  const config = getAdvancedProgramConfig(programKey);
  if (!config) return <AccessDenied title="Assistant program" message="Advanced program not found." />;
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.orders", "view") ||
      viewerHas(access.grantSet, "org.wms", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view"));
  if (!canOpen) return <AccessDenied title={config.surfaceTitle} message={`You need operational view access to open AMP${config.ampNumber}.`} />;
  const response = await GET(new Request("http://local"), { params: Promise.resolve({ programKey }) });
  const snapshot = await response.json();
  return <AdvancedProgramClient initialSnapshot={snapshot} />;
}
