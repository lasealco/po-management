import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { PricingSnapshotsNewClient } from "./pricing-snapshots-new-client";

export const dynamic = "force-dynamic";

export default async function PricingSnapshotsNewPage() {
  const access = await getViewerGrantSet();
  const canContract = Boolean(access?.user && viewerHas(access.grantSet, "org.tariffs", "edit"));
  const canRfq = Boolean(access?.user && viewerHas(access.grantSet, "org.rfq", "edit"));

  return <PricingSnapshotsNewClient canContract={canContract} canRfq={canRfq} />;
}
