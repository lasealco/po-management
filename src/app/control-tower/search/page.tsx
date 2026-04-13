import { ControlTowerSearchClient } from "./search-client";

export const dynamic = "force-dynamic";

export default function ControlTowerSearchPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Search & assist</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Structured shipment search (R5) plus a small on-platform assistant that suggests filters from your wording —
          wire to an LLM later if needed.
        </p>
      </header>
      <ControlTowerSearchClient />
    </main>
  );
}
