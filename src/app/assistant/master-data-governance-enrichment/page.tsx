import { GET } from "@/app/api/assistant/master-data-governance-enrichment/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { MasterDataGovernanceEnrichmentClient } from "./master-data-governance-enrichment-client";

export const dynamic = "force-dynamic";

export default async function MasterDataGovernanceEnrichmentPage() {
  const access = await getViewerGrantSet();
  const canView =
    access?.user &&
    (viewerHas(access.grantSet, "org.apihub", "view") ||
      viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.products", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view") ||
      viewerHas(access.grantSet, "org.reports", "view"));
  if (!canView) {
    return (
      <AccessDenied
        title="Master Data Governance & Enrichment"
        message="You need API Hub, settings, products, suppliers, or reports view access to open Sprint 21."
      />
    );
  }
  const response = await GET();
  const snapshot = await response.json();
  const canEdit =
    viewerHas(access.grantSet, "org.apihub", "edit") ||
    viewerHas(access.grantSet, "org.settings", "edit") ||
    viewerHas(access.grantSet, "org.products", "edit") ||
    viewerHas(access.grantSet, "org.suppliers", "edit") ||
    viewerHas(access.grantSet, "org.reports", "edit");
  return <MasterDataGovernanceEnrichmentClient initialSnapshot={snapshot} canEdit={canEdit} />;
}
