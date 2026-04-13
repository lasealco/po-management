"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

type Hit = {
  id: string;
  orderNumber: string;
  shipmentNo: string | null;
  status: string;
  transportMode: string | null;
};

export function ControlTowerSearchClient() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const [assistRes, searchRes] = await Promise.all([
        fetch("/api/control-tower/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q }),
        }),
        fetch(`/api/control-tower/search?q=${encodeURIComponent(q.trim())}`),
      ]);
      const assistJson = (await assistRes.json()) as { hints?: string[] };
      if (assistRes.ok) setHints(assistJson.hints ?? []);
      const data = (await searchRes.json()) as { shipments?: Hit[]; error?: string };
      if (!searchRes.ok) throw new Error(data.error || searchRes.statusText);
      setHits(data.shipments ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }, [q]);

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try PO-…, AWB, FCL, carrier name…"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") void run();
          }}
        />
        <button
          type="button"
          disabled={busy || !q.trim()}
          onClick={() => void run()}
          className="rounded-lg border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Search
        </button>
      </div>
      {hints.length > 0 ? (
        <ul className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          {hints.map((h) => (
            <li key={h}>· {h}</li>
          ))}
        </ul>
      ) : null}
      {err ? <p className="text-sm text-red-700">{err}</p> : null}
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {hits.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-zinc-500">
            {busy ? "Searching…" : "No results yet."}
          </li>
        ) : (
          hits.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div>
                <span className="font-medium text-zinc-900">{h.orderNumber}</span>{" "}
                <span className="text-zinc-500">{h.shipmentNo || h.id.slice(0, 8)}</span>
                <span className="ml-2 text-xs text-zinc-500">
                  {h.status} · {h.transportMode || "—"}
                </span>
              </div>
              <Link href={`/control-tower/shipments/${h.id}`} className="text-sky-800 hover:underline">
                Open 360 →
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
