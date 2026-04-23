import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet } from "@/lib/authz";
import { loadPortalLinkedSupplier } from "@/lib/srm/portal-linked-supplier";

export const dynamic = "force-dynamic";

function formatOnboardingStage(stage: string): string {
  return stage.replace(/_/g, " ");
}

export default async function SrmSupplierPortalPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AccessDenied
          title="Supplier workspace"
          message="Choose an active user: open Settings → Demo session (/settings/demo) or sign in."
        />
      </div>
    );
  }
  const result = await loadPortalLinkedSupplier(access.user.id);
  if (!result.ok) {
    if (result.reason === "not_portal") {
      return (
        <div className="min-h-screen bg-zinc-50">
          <AccessDenied
            title="Supplier workspace"
            message="This area is for supplier portal accounts only. Procurement users manage partners under SRM."
          />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-zinc-50 px-4 py-10">
        <main className="mx-auto max-w-2xl">
          <h1 className="text-lg font-semibold text-zinc-900">Supplier workspace</h1>
          <p className="mt-2 text-sm text-zinc-600">
            No supplier is linked to this login yet. Ask your buyer organization to connect your
            user account to the correct supplier record.
          </p>
        </main>
      </div>
    );
  }

  const s = result.supplier;
  const place = [s.registeredCity, s.registeredRegion, s.registeredCountryCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10">
      <main className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Supplier workspace</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Your company on file with the buyer. Purchase orders and logistics tasks stay under{" "}
            <Link href="/orders" className="font-medium text-[var(--arscmp-primary)] underline">
              PO Management
            </Link>
            .
          </p>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-800">Your company (read-only)</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Trade name</dt>
              <dd className="font-medium text-zinc-900">{s.name}</dd>
            </div>
            {s.legalName ? (
              <div>
                <dt className="text-zinc-500">Legal name</dt>
                <dd className="text-zinc-900">{s.legalName}</dd>
              </div>
            ) : null}
            {s.code ? (
              <div>
                <dt className="text-zinc-500">Code</dt>
                <dd className="text-zinc-900">{s.code}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-zinc-500">Status</dt>
              <dd className="text-zinc-900">{s.approvalStatus.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Onboarding stage (buyer)</dt>
              <dd className="text-zinc-900">{formatOnboardingStage(s.srmOnboardingStage)}</dd>
            </div>
            {s.email ? (
              <div>
                <dt className="text-zinc-500">Main email on file</dt>
                <dd className="text-zinc-900">{s.email}</dd>
              </div>
            ) : null}
            {s.phone ? (
              <div>
                <dt className="text-zinc-500">Phone</dt>
                <dd className="text-zinc-900">{s.phone}</dd>
              </div>
            ) : null}
            {s.website ? (
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Website</dt>
                <dd className="text-zinc-900">{s.website}</dd>
              </div>
            ) : null}
            {place ? (
              <div className="sm:col-span-2">
                <dt className="text-zinc-500">Registered location</dt>
                <dd className="text-zinc-900">{place}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/orders"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Open purchase orders
          </Link>
        </div>
      </main>
    </div>
  );
}
