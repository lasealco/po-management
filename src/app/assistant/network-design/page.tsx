import { GET } from "@/app/api/assistant/network-design/route";
import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { NetworkDesignClient } from "./network-design-client";

export const dynamic = "force-dynamic";

export default async function AssistantNetworkDesignPage() {
  const access = await getViewerGrantSet();
  const canOpen =
    access?.user &&
    (viewerHas(access.grantSet, "org.settings", "view") ||
      viewerHas(access.grantSet, "org.controltower", "view") ||
      viewerHas(access.grantSet, "org.wms", "view") ||
      viewerHas(access.grantSet, "org.orders", "view"));
  if (!canOpen) {
    return <AccessDenied title="Assistant network design" message="You need settings, operations, WMS, or orders view access to open AMP33." />;
  }
  const response = await GET();
  const snapshot = await response.json();
  return <NetworkDesignClient initialSnapshot={snapshot} />;
}
