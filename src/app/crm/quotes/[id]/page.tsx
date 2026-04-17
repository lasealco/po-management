import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { CrmQuoteDetail } from "@/components/crm-quote-detail";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function CrmQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="px-6 py-16">
        <AccessDenied title="Quote" message="Choose an active demo user: open Settings → Demo session (/settings/demo)." />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.crm", "view")) {
    return (
      <div className="px-6 py-16">
        <AccessDenied title="Quote" message="You need org.crm → view permission." />
      </div>
    );
  }

  const { id } = await params;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <p className="text-sm">
          <Link href="/crm/quotes" className="font-medium text-violet-800 hover:underline">
            ← Quotes
          </Link>
        </p>
        <div className="mt-3 mb-5">
          <WorkflowHeader
            eyebrow="CRM quote workspace"
            title="Quote detail"
            steps={["Step 1: Validate pricing scope", "Step 2: Adjust lines and terms", "Step 3: Finalize customer decision"]}
          />
        </div>
        <CrmQuoteDetail
          quoteId={id}
          actorUserId={access.user.id}
          canEditAll={viewerHas(access.grantSet, "org.crm", "edit")}
        />
      </div>
    </main>
  );
}
