import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ImportAssistantClient } from "./import-assistant/import-assistant-client";

export const dynamic = "force-dynamic";

/**
 * Integration hub landing: guided import (assistant) by default.
 * Operator console: `/apihub/workspace`.
 */
export default async function ApihubHomePage() {
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
