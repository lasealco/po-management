"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type OppRow = {
  id: string;
  name: string;
  stage: string;
  probability: number;
  closeDate: string | null;
  nextStepDate: string | null;
  nextStep: string | null;
  account: { id: string; name: string };
  owner: { name: string };
};

const STAGES = [
  "IDENTIFIED",
  "QUALIFIED",
  "DISCOVERY",
  "SOLUTION_DESIGN",
  "PROPOSAL_SUBMITTED",
  "NEGOTIATION",
  "VERBAL_AGREEMENT",
  "WON_IMPLEMENTATION_PENDING",
  "WON_LIVE",
  "LOST",
  "ON_HOLD",
] as const;

export function CrmOpportunitiesList() {
  const searchParams = useSearchParams();
  const staleOnly = searchParams.get("stale") === "1";

  const [rows, setRows] = useState<OppRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/crm/opportunities");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setRows(data.opportunities ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const terminal = new Set(["LOST", "WON_LIVE"]);
    return rows.filter((r) => {
      if (stageFilter && r.stage !== stageFilter) return false;
      if (staleOnly) {
        if (terminal.has(r.stage)) return false;
        const cd = r.closeDate ? new Date(r.closeDate) : null;
        const nd = r.nextStepDate ? new Date(r.nextStepDate) : null;
        const stale =
          (cd !== null && cd < startOfToday) || (nd !== null && nd < startOfToday);
        if (!stale) return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.account.name.toLowerCase().includes(q) ||
        r.stage.toLowerCase().includes(q)
      );
    });
  }, [rows, stageFilter, query, staleOnly]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Opportunities</h1>
          <p className="text-sm text-zinc-600">
            Table view of open pipeline. Use{" "}
            <Link href="/crm/pipeline" className="text-violet-700 hover:underline">
              Pipeline
            </Link>{" "}
            for a stage board.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="self-start rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="text-sm sm:w-64">
          <span className="text-zinc-600">Stage</span>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-sm">
          <span className="text-zinc-600">Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, account, or stage"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <p className="mb-2 text-xs text-zinc-500">
        Showing {filtered.length} of {rows.length} loaded
      </p>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Opportunity</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2">Stage</th>
              <th className="px-4 py-2">%</th>
              <th className="px-4 py-2">Close</th>
              <th className="px-4 py-2">Next step</th>
              <th className="px-4 py-2">Owner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No opportunities match.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/crm/opportunities/${row.id}`}
                      className="font-medium text-violet-700 hover:text-violet-900 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/crm/accounts/${row.account.id}`}
                      className="text-zinc-700 hover:text-violet-800 hover:underline"
                    >
                      {row.account.name}
                    </Link>
                  </td>
                  <td className="max-w-[10rem] truncate px-4 py-2 text-zinc-600" title={row.stage}>
                    {row.stage.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{row.probability}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {row.closeDate ? new Date(row.closeDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {row.nextStepDate
                      ? new Date(row.nextStepDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{row.owner.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
