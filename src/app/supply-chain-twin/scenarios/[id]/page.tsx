import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccessDenied } from "@/components/access-denied";
import { TwinEntityJsonPreview } from "@/components/supply-chain-twin/twin-entity-json-preview";
import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { getScenarioDraftByIdForTenant } from "@/lib/supply-chain-twin/scenarios-draft-repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Scenario draft",
  description: "Read-only view of a tenant scenario draft (preview).",
};

export default async function SupplyChainTwinScenarioDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const gate = await requireTwinApiAccess();
  if (!gate.ok) {
    return (
      <AccessDenied
        title="Supply Chain Twin"
        message={gate.denied.error}
      />
    );
  }
  const { access } = gate;

  const { id: rawId } = await params;
  const draftId = rawId.trim();
  if (!draftId || draftId.length > 128) {
    notFound();
  }

  let draft: Awaited<ReturnType<typeof getScenarioDraftByIdForTenant>>;
  try {
    draft = await getScenarioDraftByIdForTenant(access.tenant.id, draftId);
  } catch {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <TwinSubNav />
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900 shadow-sm">
          <p className="font-semibold">Unable to load this draft</p>
          <p className="mt-2">
            A server error occurred while reading the scenario. Try again later or return to the list.
          </p>
          <p className="mt-4">
            <Link
              href="/supply-chain-twin/scenarios"
              className="font-semibold text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
            >
              ← Back to scenarios
            </Link>
          </p>
        </section>
      </main>
    );
  }

  if (!draft) {
    notFound();
  }

  const titleLabel = draft.title?.trim() ? draft.title : "Untitled draft";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TwinSubNav />

      <div className="mb-6">
        <Link
          href="/supply-chain-twin/scenarios"
          className="text-sm font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
        >
          ← Back to scenarios
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Twin scenarios</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">{titleLabel}</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Read-only draft row for your workspace session. Editing uses the API in later slices; this view matches the
          Slice 34 detail contract.
        </p>

        <dl className="mt-6 grid gap-4 border-t border-zinc-100 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Draft id</dt>
            <dd className="mt-1 break-all font-mono text-sm text-zinc-900">{draft.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Status</dt>
            <dd className="mt-1 font-mono text-sm text-zinc-900">{draft.status}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Updated</dt>
            <dd className="mt-1 font-mono text-sm text-zinc-800">{draft.updatedAt.toISOString()}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Created</dt>
            <dd className="mt-1 font-mono text-sm text-zinc-800">{draft.createdAt.toISOString()}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Draft JSON</h2>
        <p className="mt-1 text-xs text-zinc-500">Preview is truncated when the serialized document is large.</p>
        <div className="mt-4">
          <TwinEntityJsonPreview payload={draft.draftJson} />
        </div>
      </section>
    </main>
  );
}
