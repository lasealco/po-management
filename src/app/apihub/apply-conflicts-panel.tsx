"use client";

import Link from "next/link";
import { Fragment, useCallback, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubApplyConflictListItemDto } from "@/lib/apihub/ingestion-apply-conflict-dto";
import { workspaceTabHref } from "@/app/apihub/workspace-tabs";

import { ApiHubAdvancedJsonDisclosure } from "./apihub-advanced-json";

type Props = {
  canView: boolean;
  initialItems: ApiHubApplyConflictListItemDto[];
  initialNextCursor: string | null;
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function resultBadgeClass(code: string) {
  if (code.includes("BLOCKED")) return "border-amber-200 bg-amber-50 text-amber-950";
  if (code.includes("IDEMPOTENCY")) return "border-violet-200 bg-violet-50 text-violet-950";
  return "border-red-200 bg-red-50 text-red-900";
}

export function ApplyConflictsPanel({ canView, initialItems, initialNextCursor }: Props) {
  const [items, setItems] = useState<ApiHubApplyConflictListItemDto[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [busy, setBusy] = useState(false);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiErrorBody, setApiErrorBody] = useState<unknown | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refreshFirstPage = useCallback(async () => {
    setError(null);
    setApiErrorBody(null);
    setBusy(true);
    try {
      const res = await fetch("/api/apihub/ingestion-apply-conflicts?limit=20", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApiErrorBody(data);
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not load apply conflicts."));
        return;
      }
      const payload = data as { conflicts?: ApiHubApplyConflictListItemDto[]; nextCursor?: string | null };
      setItems(payload.conflicts ?? []);
      setNextCursor(payload.nextCursor ?? null);
    } catch (e) {
      setApiErrorBody(null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setError(null);
    setApiErrorBody(null);
    setLoadMoreBusy(true);
    try {
      const params = new URLSearchParams({ limit: "20", cursor: nextCursor });
      const res = await fetch(`/api/apihub/ingestion-apply-conflicts?${params.toString()}`, { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApiErrorBody(data);
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not load more conflicts."));
        return;
      }
      const payload = data as { conflicts?: ApiHubApplyConflictListItemDto[]; nextCursor?: string | null };
      setItems((prev) => [...prev, ...(payload.conflicts ?? [])]);
      setNextCursor(payload.nextCursor ?? null);
    } catch (e) {
      setApiErrorBody(null);
      setError(e instanceof Error ? e.message : "Could not load more.");
    } finally {
      setLoadMoreBusy(false);
    }
  }, [nextCursor]);

  const copyText = useCallback(async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg(`${label} copied`);
      window.setTimeout(() => setCopyMsg(null), 2000);
    } catch {
      setCopyMsg("Copy not supported in this browser");
      window.setTimeout(() => setCopyMsg(null), 2500);
    }
  }, []);

  if (!canView) {
    return (
      <section id="apply-conflicts" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <h2 className="mt-1 text-xl font-semibold text-zinc-900">Apply conflicts</h2>
        <p className="mt-3 max-w-xl text-sm text-zinc-600">
          Choose a demo user in{" "}
          <Link href="/settings/demo" className="font-medium text-[var(--arscmp-primary)] hover:underline">
            Settings → Demo session
          </Link>{" "}
          to review apply failures logged for this tenant.
        </p>
      </section>
    );
  }

  return (
    <section id="apply-conflicts" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">Apply conflicts</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Client-error outcomes from <span className="font-medium text-zinc-800">POST apply</span> (409/400-class),
            sourced from audit metadata. Use <span className="font-medium text-zinc-800">Refresh</span> after
            reproducing issues. <span className="font-medium text-zinc-800">View</span> on a row shows a field summary;
            expand <span className="font-medium text-zinc-800">Advanced</span> for the raw list DTO.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshFirstPage()}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
          {apiErrorBody != null ? (
            <ApiHubAdvancedJsonDisclosure
              value={apiErrorBody}
              label="Advanced — apply-conflicts API error body"
              description="From the most recent failed conflicts list request on this panel."
              maxHeightClass="max-h-56"
              dark={false}
            />
          ) : null}
        </div>
      ) : null}
      {copyMsg ? (
        <p className="mt-3 text-xs font-medium text-emerald-800" role="status">
          {copyMsg}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200">
        <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">HTTP</th>
              <th className="px-4 py-3">Run</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3">Actions</th>
              <th className="px-4 py-3 w-24">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white text-zinc-800">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-600">
                  No apply conflicts recorded yet. Failed apply attempts (4xx) will appear here.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-600">
                      {formatWhen(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex max-w-[220px] truncate rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold ${resultBadgeClass(row.resultCode)}`}
                        title={row.resultCode}
                      >
                        {row.resultCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs">{row.httpStatus}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-700">{row.ingestionRunId}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {row.dryRun ? <span className="font-medium text-zinc-800">dry-run</span> : "live"}
                      {row.idempotencyKeyPresent ? " · idem" : ""}
                      {row.idempotentReplay ? " · replay" : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                        <a
                          href={`/api/apihub/ingestion-jobs/${encodeURIComponent(row.ingestionRunId)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-[var(--arscmp-primary)] hover:underline"
                        >
                          Open job JSON
                        </a>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                          onClick={() => void copyText("Run id", row.ingestionRunId)}
                        >
                          Copy run id
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-left text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                          onClick={() =>
                            void copyText(
                              "Diagnostics",
                              JSON.stringify(
                                {
                                  resultCode: row.resultCode,
                                  httpStatus: row.httpStatus,
                                  ingestionRunId: row.ingestionRunId,
                                  requestId: row.requestId,
                                  runStatusAtDecision: row.runStatusAtDecision,
                                  connectorId: row.connectorId,
                                  dryRun: row.dryRun,
                                  idempotencyKeyPresent: row.idempotencyKeyPresent,
                                  idempotentReplay: row.idempotentReplay,
                                },
                                null,
                                2,
                              ),
                            )
                          }
                        >
                          Copy diagnostics
                        </button>
                        <Link
                          href={workspaceTabHref("ingestion-ops")}
                          className="text-xs font-semibold text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
                        >
                          Runs list
                        </Link>
                        <button
                          type="button"
                          disabled
                          title="Reserved for a future operator workflow"
                          className="cursor-not-allowed rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1 text-left text-xs font-semibold text-zinc-400"
                        >
                          Mark reviewed
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId((cur) => (cur === row.id ? null : row.id))}
                        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                        aria-expanded={expandedId === row.id}
                      >
                        {expandedId === row.id ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === row.id ? (
                    <tr className="bg-zinc-50/90">
                      <td colSpan={7} className="p-0">
                        <div className="border-t border-zinc-100 px-4 py-4 text-sm text-zinc-800">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Summary</p>
                          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                            <div>
                              <dt className="text-zinc-500">Result code</dt>
                              <dd className="font-mono font-medium text-zinc-900">{row.resultCode}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">HTTP status</dt>
                              <dd className="tabular-nums font-medium">{row.httpStatus}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Run id</dt>
                              <dd className="break-all font-mono text-[11px]">{row.ingestionRunId}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Request id</dt>
                              <dd className="break-all font-mono text-[11px]">{row.requestId ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Run status at decision</dt>
                              <dd className="font-medium">{row.runStatusAtDecision ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Connector id</dt>
                              <dd className="break-all font-mono text-[11px]">{row.connectorId ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Flags</dt>
                              <dd>
                                {row.dryRun ? "dry-run" : "live"}
                                {row.idempotencyKeyPresent ? " · idempotency key" : ""}
                                {row.idempotentReplay ? " · idempotent replay" : ""}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Actor</dt>
                              <dd className="break-all font-mono text-[11px]">{row.actorUserId}</dd>
                            </div>
                          </dl>
                          <div className="mt-4">
                            <ApiHubAdvancedJsonDisclosure
                              value={row}
                              description="Exact list-row DTO from the apply-conflicts API."
                              maxHeightClass="max-h-56"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadMoreBusy}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
          >
            {loadMoreBusy ? "Loading…" : "Load older conflicts"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
