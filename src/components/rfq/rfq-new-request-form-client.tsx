"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RfqNewRequestFormClient({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [originLabel, setOriginLabel] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [equipmentSummary, setEquipmentSummary] = useState("");
  const [cargoDescription, setCargoDescription] = useState("");
  const [quotesDueAt, setQuotesDueAt] = useState("");

  async function save() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/rfq/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          originLabel,
          destinationLabel,
          transportMode: "OCEAN",
          equipmentSummary: equipmentSummary.trim() || null,
          cargoDescription: cargoDescription.trim() || null,
          ...(quotesDueAt.trim() ? { quotesDueAt: quotesDueAt } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; request?: { id: string } };
      if (!res.ok) {
        setError(data.error ?? "Could not create RFQ.");
        return;
      }
      if (data.request?.id) {
        router.push(`/rfq/requests/${data.request.id}`);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Title</span>
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
          value={title}
          disabled={!canEdit}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Yantian → Los Angeles — April spot"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Origin (POL)</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
            value={originLabel}
            disabled={!canEdit}
            onChange={(e) => setOriginLabel(e.target.value)}
            placeholder="e.g. CNYTN / South China"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-zinc-700">Destination (POD)</span>
          <input
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
            value={destinationLabel}
            disabled={!canEdit}
            onChange={(e) => setDestinationLabel(e.target.value)}
            placeholder="e.g. USLAX"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Equipment</span>
        <input
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
          value={equipmentSummary}
          disabled={!canEdit}
          onChange={(e) => setEquipmentSummary(e.target.value)}
          placeholder="e.g. 2 x 40HC"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Cargo / notes</span>
        <textarea
          className="mt-1 min-h-[5rem] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
          value={cargoDescription}
          disabled={!canEdit}
          onChange={(e) => setCargoDescription(e.target.value)}
          placeholder="Commodity, weight, HS chapter, etc."
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Quotes due by</span>
        <input
          type="datetime-local"
          className="mt-1 w-full max-w-xs rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
          value={quotesDueAt}
          disabled={!canEdit}
          onChange={(e) => setQuotesDueAt(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <button
            type="button"
            disabled={pending || !title.trim() || !originLabel.trim() || !destinationLabel.trim()}
            onClick={() => void save()}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            Create RFQ
          </button>
        ) : null}
        <Link
          href="/rfq/requests"
          className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
