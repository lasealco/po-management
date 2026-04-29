import { GET } from "@/app/api/assistant/enterprise-knowledge-document-intelligence/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { EnterpriseKnowledgeDocumentIntelligenceClient } from "./enterprise-knowledge-document-intelligence-client";

export const dynamic = "force-dynamic";

export default async function EnterpriseKnowledgeDocumentIntelligencePage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") || viewerHas(access.grantSet, "org.reports", "view"));
  if (!canView) {
    return (
      <AccessDenied
        title="Enterprise Knowledge & Document Intelligence"
        message="You need settings or reporting view access to open Sprint 25."
      />
    );
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.settings", "edit") || viewerHas(access.grantSet, "org.reports", "edit");
  return <EnterpriseKnowledgeDocumentIntelligenceClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
