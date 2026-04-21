"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  fetchTwinScenarioDraftsPage,
  type TwinScenarioDraftListRow,
} from "@/lib/supply-chain-twin/twin-scenarios-drafts-client";

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function TwinScenariosDraftsPanel() {
  const [rows, setRows] = useState<TwinScenarioDraftListRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const reloadFirstPage = useCallback(async () => {
    setListError(null);
    setLoading(true);
    const result = await fetchTwinScenarioDraftsPage(undefined);
    setLoading(false);
    if (!result.ok) {
      setListError(result.message);
      setRows([]);
      setNextCursor(null);
      return;
    }
    setRows(result.items);
    setNextCursor(result.nextCursor);
  }, []);

  useEffect(() => {
    void reloadFirstPage();
  }, [reloadFirstPage]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setListError(null);
    const result = await fetchTwinScenarioDraftsPage(nextCursor);
    setLoadingMore(false);
    if (!result.ok) {
      setListError(result.message);
      return;
    }
    setRows((prev) => [...prev, ...result.items]);
    setNextCursor(result.nextCursor);
  };

  const createDraft = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/supply-chain-twin/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New scenario draft", draft: {} }),
      });
      const body = (await res.json()) as unknown;
      if (!res.ok) {
        const message =
          typeof body === "object" && body != null && "error" in body && typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : "Could not create a draft.";
        setCreateError(message);
        return;
      }
      await reloadFirstPage();
    } catch {
      setCreateError("Network error while creating a draft.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Scenarios</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900">Drafts</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Rows load from{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">GET /api/supply-chain-twin/scenarios</code>{" "}
            (keyset pages of 50; <span className="text-zinc-500">Load more</span> uses the API <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">cursor</code>
            ). <span className="text-zinc-500">Create</span> uses the existing{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">POST</code> draft endpoint; the list refreshes after a
            successful create.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => void createDraft()}
            disabled={creating || loading}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create draft"}
          </button>
          {createError ? <p className="max-w-xs text-right text-xs text-red-700">{createError}</p> : null}
        </div>
      </div>

      {listError ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{listError}</p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500" aria-live="polite">
          Loading drafts…
        </p>
      ) : null}

      {!loading && !listError && rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-5 py-10 text-center">
          <p className="text-sm font-medium text-zinc-800">No scenario drafts yet</p>
          <p className="mt-2 text-sm text-zinc-600">Create a draft to start a what-if run. You can rename it when detail editing ships.</p>
          <button
            type="button"
            onClick={() => void createDraft()}
            disabled={creating}
            className="mt-5 inline-flex rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create draft"}
          </button>
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <>
          <p className="mt-4 text-xs text-zinc-500">
            Showing {rows.length} draft{rows.length === 1 ? "" : "s"}
            {nextCursor ? " · more below" : ""}
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-800">
                {rows.map((row) => {
                  // Slice 40 adds `/supply-chain-twin/scenarios/[id]`; href is stable for then.
                  const href = `/supply-chain-twin/scenarios/${encodeURIComponent(row.id)}`;
                  const titleLabel = row.title?.trim() ? row.title : "Untitled draft";
                  return (
                    <tr key={row.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-medium text-zinc-900">{titleLabel}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{row.status}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{formatUpdatedAt(row.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={href}
                          className="inline-flex rounded-lg px-3 py-2 text-sm font-semibold text-[var(--arscmp-primary)] underline-offset-2 outline-none ring-zinc-300 hover:underline focus-visible:ring-2"
                          aria-label={`Open scenario draft ${row.id}`}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {nextCursor ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
          <div className="mt-4" aria-live="polite">
            {loadingMore ? (
              <p className="text-center text-xs text-zinc-500">Loading more drafts…</p>
            ) : null}
            {!loading && !loadingMore && rows.length > 0 && !nextCursor ? (
              <p className="text-center text-xs text-zinc-500">All drafts in this workspace are shown.</p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
