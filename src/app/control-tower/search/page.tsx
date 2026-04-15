import { ControlTowerSearchClient } from "./search-client";

export const dynamic = "force-dynamic";

export default function ControlTowerSearchPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Search & assist</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Rule-based assist (R5): tokens like <code className="rounded bg-zinc-100 px-1">shipper:</code>,{" "}
          <code className="rounded bg-zinc-100 px-1">lane:</code>, and status words map to API filters. Free text
          matches PO/shipment id, tracking, carrier, container, milestones, booking and references, then results open
          in Shipment 360.
        </p>
      </header>
      <ControlTowerSearchClient />
    </main>
  );
}
