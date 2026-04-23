import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveSrmPermissions } from "@/lib/srm/permissions";
import { SrmNotificationsClient } from "./srm-notifications-client";

export const dynamic = "force-dynamic";

export default async function SrmNotificationsPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="SRM · Notifications"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  const permissions = resolveSrmPermissions(access.grantSet);
  if (!permissions.canViewSuppliers) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="SRM"
          message="You do not have permission to view SRM (org.suppliers → view)."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm">
          <Link href="/srm" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            ← SRM
          </Link>
        </p>
        <div className="mt-4">
          <WorkflowHeader
            eyebrow="SRM · Phase G"
            title="In-app notifications"
            description="Operator alerts (e.g. onboarding task assigned). Email and webhooks are out of scope for this slice."
            steps={[]}
            className="border-0 bg-transparent p-0 shadow-none"
          />
        </div>
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <SrmNotificationsClient />
        </div>
      </main>
    </div>
  );
}
