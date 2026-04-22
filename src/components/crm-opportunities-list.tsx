"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import {
  buildOpportunitiesListSearch,
  parseOpportunitiesListQuery,
} from "@/lib/crm/opportunities-list-query";

type OppRow = {
  id: string;
  name: string;
  stage: string;
  probability: number;
  closeDate: string | null;
  nextStepDate: string | null;
  nextStep: string | null;
  account: { id: string; name: string };
  owner: { id: string; name: string };
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

const SEARCH_DEBOUNCE_MS = 400;

export function CrmOpportunitiesList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { stage: stageFilter, owner: ownerFilter, q: qFromUrl, stale: staleOnly } = useMemo(
    () => parseOpportunitiesListQuery(searchParams),
    [searchParams],
  );

  const [rows, setRows] = useState<OppRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qDraft, setQDraft] = useState(qFromUrl);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQDraft(qFromUrl);
  }, [qFromUrl]);

  const replaceListQuery = useCallback(
    (patch: Partial<{ stage: string; owner: string; q: string }>) => {
      const nextQs = buildOpportunitiesListSearch(new URLSearchParams(searchParams.toString()), patch);
      router.replace(nextQs ? `${pathname}?${nextQs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const onSearchInput = useCallback(
    (value: string) => {
      setQDraft(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        replaceListQuery({ q: value });
      }, SEARCH_DEBOUNCE_MS);
    },
    [replaceListQuery],
  );

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/crm/opportunities");
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Failed to load"));
      setRows((data as { opportunities?: OppRow[] }).opportunities ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) {
      if (!byId.has(r.owner.id)) byId.set(r.owner.id, r.owner.name);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const ownerSelectValue =
    !ownerFilter || ownerOptions.some((o) => o.id === ownerFilter) ? ownerFilter : "";

  const filtered = useMemo(() => {
    const q = qDraft.trim().toLowerCase();
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const terminal = new Set(["LOST", "WON_LIVE"]);
    return rows.filter((r) => {
      if (stageFilter && r.stage !== stageFilter) return false;
      if (ownerFilter && r.owner.id !== ownerFilter) return false;
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
        r.stage.toLowerCase().includes(q) ||
        r.owner.name.toLowerCase().includes(q)
      );
    });
  }, [rows, stageFilter, ownerFilter, qDraft, staleOnly]);

  const hasActiveFilters =
    Boolean(stageFilter) || Boolean(ownerFilter) || Boolean(qDraft.trim()) || staleOnly;

  const clearFiltersHref = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("stage");
    next.delete("owner");
    next.delete("q");
    next.delete("stale");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

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
          disabled={loading}
          className="self-start rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="mb-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="text-sm">
          <span className="font-medium text-zinc-700">Stage</span>
          <select
            value={stageFilter}
            onChange={(e) => replaceListQuery({ stage: e.target.value })}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-zinc-700">Owner</span>
          <select
            value={ownerSelectValue}
            onChange={(e) => replaceListQuery({ owner: e.target.value })}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          >
            <option value="">All owners</option>
            {ownerOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-1">
          <span className="font-medium text-zinc-700">Search</span>
          <input
            value={qDraft}
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder="Name, account, stage, or owner"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
          />
        </label>
      </div>

      {error ? (
        <div
          className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 shadow-sm"
          role="alert"
        >
          <p className="text-sm font-medium text-red-900">Could not load opportunities</p>
          <p className="mt-1 text-sm text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      ) : null}

      {staleOnly ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
          <span>
            Showing opportunities whose close date or next-step date is before today (UTC).
          </span>
          <Link
            href="/crm/opportunities"
            className="shrink-0 font-medium text-violet-800 underline-offset-2 hover:underline"
          >
            Clear stale filter
          </Link>
        </div>
      ) : null}

      {hasActiveFilters && !staleOnly ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-700">
          <span>Filters are synced to the URL — copy the address bar to share this view.</span>
          <Link
            href={clearFiltersHref}
            className="shrink-0 font-medium text-violet-800 underline-offset-2 hover:underline"
          >
            Clear filters
          </Link>
        </div>
      ) : null}

      <p className="mb-2 text-xs text-zinc-500">
        {loading && rows.length === 0
          ? "Loading…"
          : `Showing ${filtered.length} of ${rows.length} loaded`}
      </p>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading && rows.length === 0 && !error ? (
          <div className="px-4 py-10 text-center">
            <div className="mx-auto mb-3 h-8 w-48 animate-pulse rounded bg-zinc-100" />
            <div className="mx-auto h-4 w-64 animate-pulse rounded bg-zinc-50" />
            <p className="mt-3 text-sm text-zinc-500">Loading opportunities…</p>
          </div>
        ) : error && rows.length === 0 ? null : (
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
              {!error && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-zinc-800">No opportunities in this workspace</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Create one from an account or check your CRM role scope.
                    </p>
                  </td>
                </tr>
              ) : null}
              {rows.length > 0 && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-zinc-800">No opportunities match</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      Try widening stage, owner, or search — or{" "}
                      <Link href={clearFiltersHref} className="font-medium text-violet-800 hover:underline">
                        clear filters
                      </Link>
                      .
                    </p>
                  </td>
                </tr>
              ) : null}
              {filtered.length > 0
                ? filtered.map((row) => (
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
                : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
