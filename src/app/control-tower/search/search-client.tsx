"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { AssistSuggestedFilters } from "@/lib/control-tower/assist";
import { appendAssistToSearchParams, hasStructuredSearchInput } from "@/lib/control-tower/search-query";

type Hit = {
  id: string;
  orderNumber: string;
  shipmentNo: string | null;
  status: string;
  transportMode: string | null;
  carrier: string | null;
  originCode: string | null;
  destinationCode: string | null;
};

function buildWorkbenchUrl(filters: AssistSuggestedFilters, rawInput: string): string {
  const sp = new URLSearchParams();
  appendAssistToSearchParams(sp, filters, { take: 150 });
  if (!sp.has("q") && rawInput.trim()) {
    sp.set("q", rawInput.trim());
  }
  return `/control-tower/workbench?${sp.toString()}`;
}

export function ControlTowerSearchClient() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<AssistSuggestedFilters | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const workbenchHref = useMemo(() => {
    if (!suggested && !q.trim()) return "/control-tower/workbench";
    return buildWorkbenchUrl(suggested ?? {}, q);
  }, [suggested, q]);

  const run = useCallback(async () => {
    const raw = q.trim();
    setBusy(true);
    setErr(null);
    try {
      const assistRes = await fetch("/api/control-tower/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: raw }),
      });
      const assistJson = (await assistRes.json()) as {
        hints?: string[];
        suggestedFilters?: AssistSuggestedFilters;
      };
      if (assistRes.ok) {
        setHints(assistJson.hints ?? []);
        setSuggested(assistJson.suggestedFilters ?? {});
      } else {
        setHints([]);
        setSuggested(null);
      }

      const filters = assistRes.ok ? (assistJson.suggestedFilters ?? {}) : {};
      const sp = new URLSearchParams();
      appendAssistToSearchParams(sp, filters, { take: 60 });
      if (!sp.has("q") && raw) {
        sp.set("q", raw);
      }
      if (!sp.toString()) {
        throw new Error("Enter search text or structured tokens (e.g. shipper:, lane:, overdue).");
      }

      const searchRes = await fetch(`/api/control-tower/search?${sp.toString()}`);
      const data = (await searchRes.json()) as { shipments?: Hit[]; error?: string };
      if (!searchRes.ok) throw new Error(data.error || searchRes.statusText);
      setHits(data.shipments ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }, [q]);

  const structuredSummary = suggested && hasStructuredSearchInput(suggested) && (
    <p className="text-xs text-zinc-600">
      Structured:{" "}
      {[
        suggested.mode && `mode=${suggested.mode}`,
        suggested.status && `status=${suggested.status}`,
        suggested.onlyOverdueEta && "overdueEta",
        suggested.shipperName && `shipper=${suggested.shipperName}`,
        suggested.consigneeName && `consignee=${suggested.consigneeName}`,
        suggested.lane && `lane=${suggested.lane}`,
      ]
        .filter(Boolean)
        .join(" · ")}
    </p>
  );

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="PO-…, MEDU1234567, lane:CNSHA, shipper:Acme, overdue SHIPPED…"
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
      {structuredSummary}
      <div className="flex flex-wrap gap-2 text-xs">
        <Link
          href={workbenchHref}
          className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 font-medium text-sky-900 hover:bg-sky-100"
        >
          Open same filters in Workbench →
        </Link>
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
                  {h.carrier ? ` · ${h.carrier}` : ""}
                </span>
                {h.originCode || h.destinationCode ? (
                  <div className="text-xs text-zinc-500">
                    {(h.originCode || "—") + " → " + (h.destinationCode || "—")}
                  </div>
                ) : null}
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
