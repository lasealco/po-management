import { GET } from "@/app/api/assistant/master-data-quality/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { MasterDataQualityClient } from "./master-data-quality-client";

export const dynamic = "force-dynamic";

export default async function AssistantMasterDataQualityPage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.products", "view") ||
      viewerHas(access.grantSet, "org.suppliers", "view") ||
      viewerHas(access.grantSet, "org.crm", "view") ||
      viewerHas(access.grantSet, "org.apihub", "view") ||
      viewerHas(access.grantSet, "org.settings", "view"));
  if (!canOpen) {
    return <AccessDenied title="Master data quality" message="You need product, supplier, CRM, API Hub, or settings view to open AMP21." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <MasterDataQualityClient initialSnapshot={snapshot} />;
}
