"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { AssistantMp1Client } from "@/components/assistant/assistant-mp1-client";
import type { AssistantWorkbenchMode } from "@/lib/assistant/sales-operations-assistant-modes";

const MODE_CARDS: Array<{ mode: AssistantWorkbenchMode; title: string; hint: string }> = [
  { mode: "sales-order", title: "Create sales order", hint: "Draft from customer wording" },
  { mode: "stock", title: "Check stock", hint: "On-hand & locations" },
  { mode: "trace", title: "Trace product", hint: "Shipments, POs, movement" },
  { mode: "drafts", title: "Review drafts", hint: "Open SO drafts" },
];

export function AssistantSalesOperationsCockpit({ canCreateSalesOrder }: { canCreateSalesOrder: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasModeQuery = searchParams.has("mode");
  const urlMode = searchParams.get("mode");
  const activeMode: AssistantWorkbenchMode =
    urlMode === "stock" || urlMode === "trace" || urlMode === "drafts" || urlMode === "sales-order"
      ? urlMode
      : "sales-order";

  function selectMode(mode: AssistantWorkbenchMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", mode);
    router.replace(`/assistant?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sales &amp; operations cockpit</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Sales &amp; Operations Assistant</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          Create sales order drafts, check stock, and trace product movement with linked operational evidence.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {MODE_CARDS.map((card) => {
            const visuallySelected = activeMode === card.mode;
            return (
              <button
                key={card.mode}
                type="button"
                onClick={() => selectMode(card.mode)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  visuallySelected
                    ? "border-[var(--arscmp-primary)] bg-orange-50/60 shadow-sm ring-2 ring-[var(--arscmp-primary)]/25"
                    : "border-zinc-200 bg-zinc-50/80 hover:border-zinc-300"
                }`}
              >
                <p className="text-sm font-semibold text-zinc-900">{card.title}</p>
                <p className="mt-1 text-xs text-zinc-600">{card.hint}</p>
              </button>
            );
          })}
        </div>
        {!hasModeQuery ? (
          <p className="mt-3 text-xs text-zinc-500">
            Tip: <strong className="font-medium text-zinc-700">New request</strong> in the sidebar clears the mode query;
            you can still use every mode from the cards above.
          </p>
        ) : null}
      </header>

      <AssistantMp1Client canCreateSalesOrder={canCreateSalesOrder} assistantMode={activeMode} />
    </div>
  );
}
