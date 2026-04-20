import { Suspense } from "react";

import { TariffRatingExplorerClient } from "./tariff-rating-explorer-client";

export const dynamic = "force-dynamic";

export default function TariffRatingPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Rating engine (v1)</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Lane rating</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Selects <strong>approved</strong> tariff contract headers, latest <strong>approved</strong> version per header,
          matches POL/POD against geography members on the main leg, then rolls up ancillaries and charges. From an
          order shipment card, open <strong>Rate lane & apply</strong> to pass{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs">shipmentId</code>{" "}
          and link the chosen version in one step. Opening a contract version from logistics keeps{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs">shipmentId</code> in the URL so you can jump back to lane
          rating from the workbench.
        </p>
        <div className="mt-8">
          <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
            <TariffRatingExplorerClient />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
