import { ControlTowerSearchClient } from "./search-client";

export const dynamic = "force-dynamic";

export default function ControlTowerSearchPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Search & assist</h1>
        <p className="mt-1 text-sm text-zinc-600">
          R5: rule-based tokens (<code className="rounded bg-zinc-100 px-1">shipper:</code>,{" "}
          <code className="rounded bg-zinc-100 px-1">lane:</code>, status words) map to API filters; free text matches
          PO/shipment id, tracking, carrier, container, milestones, booking, and references. With{" "}
          <code className="rounded bg-zinc-100 px-1">OPENAI_API_KEY</code> and{" "}
          <code className="rounded bg-zinc-100 px-1">CONTROL_TOWER_ASSIST_LLM=1</code>, each search also merges a
          small OpenAI JSON patch on top of the rules (no UI toggle).
        </p>
      </header>
      <ControlTowerSearchClient />
    </main>
  );
}
