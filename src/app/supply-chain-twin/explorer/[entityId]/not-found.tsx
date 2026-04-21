import Link from "next/link";

import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";

export default function ExplorerEntityNotFound() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TwinSubNav />
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-zinc-900">Snapshot not found</h1>
        <p className="mt-2 text-sm text-zinc-600">
          This entity id is missing or not available for your workspace session. Return to the catalog and pick another
          row.
        </p>
        <p className="mt-4">
          <Link
            href="/supply-chain-twin/explorer"
            className="text-sm font-semibold text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
          >
            ← Back to explorer
          </Link>
        </p>
      </section>
    </main>
  );
}
