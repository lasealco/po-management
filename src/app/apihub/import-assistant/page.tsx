import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ImportAssistantClient } from "./import-assistant-client";

export const dynamic = "force-dynamic";

export default async function ImportAssistantPage() {
  const access = await getViewerGrantSet();
  const grantSet = access?.grantSet ?? new Set<string>();
  const canEdit = Boolean(
    access?.user &&
      access?.tenant &&
      viewerHas(grantSet, "org.apihub", "view") &&
      viewerHas(grantSet, "org.apihub", "edit"),
  );

  return <ImportAssistantClient canEdit={canEdit} />;
}
