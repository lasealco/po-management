import { getViewerGrantSet, viewerHas } from "@/lib/authz";

import { ApiHubAssistantClient } from "./apihub-assistant-client";

export const dynamic = "force-dynamic";

export default async function ApiHubAssistantPage() {
  const access = await getViewerGrantSet();
  const canView = Boolean(access?.user && access?.tenant && viewerHas(access.grantSet, "org.apihub", "view"));
  if (!canView) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">
          API Hub assistant evidence requires org.apihub view access.
        </div>
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <ApiHubAssistantClient />
    </main>
  );
}
