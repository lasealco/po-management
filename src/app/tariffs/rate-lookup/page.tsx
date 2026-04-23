import { InvestorDoorRatesClient } from "./investor-door-rates-client";

export const dynamic = "force-dynamic";

export default function TariffRateLookupPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Investor preview</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Door-to-door rate lookup</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Compare two pre-loaded ocean FCL options for Hamburg to Chicago: pre-carriage, carrier ocean base,
          forwarder-style accessorials, and on-carriage in one total per column. Figures are{" "}
          <strong>tenant-scoped</strong>, require <strong>org.tariffs → view</strong> (signed-in demo session), and are
          not a public tariff feed or carrier offer.
        </p>
        <div className="mt-8">
          <InvestorDoorRatesClient />
        </div>
      </section>
    </main>
  );
}
