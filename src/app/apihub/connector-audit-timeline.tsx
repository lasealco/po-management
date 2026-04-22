"use client";

import { useCallback, useEffect, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubConnectorAuditTrailDto } from "@/lib/apihub/connector-dto";

import { ApiHubAdvancedJsonDisclosure } from "./apihub-advanced-json";

type AuditListJson = {
  connectorId: string;
  page: number;
  limit: number;
  hasMore: boolean;
  audit: ApiHubConnectorAuditTrailDto[];
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

const PAGE_SIZE = 20;

type Props = {
  connectorId: string;
  /** Same gate as connector mutations: demo actor required for API Hub APIs. */
  allowFetch: boolean;
};

export function ConnectorAuditTimeline({ connectorId, allowFetch }: Props) {
  const [entries, setEntries] = useState<ApiHubConnectorAuditTrailDto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiErrorBody, setApiErrorBody] = useState<unknown | null>(null);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (!allowFetch) {
        setLoading(false);
        setApiErrorBody(null);
        setError("Choose a demo user in Settings → Demo session to load audit history.");
        setEntries([]);
        setHasMore(false);
        return;
      }
      const isFirst = !append;
      if (isFirst) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      setApiErrorBody(null);
      try {
        const res = await fetch(
          `/api/apihub/connectors/${encodeURIComponent(connectorId)}/audit?limit=${PAGE_SIZE}&page=${nextPage}`,
        );
        const data = (await res.json().catch(() => ({}))) as AuditListJson & { ok?: false };
        if (!res.ok) {
          setApiErrorBody(data);
          setError(readApiHubErrorMessageFromJsonBody(data, "Could not load audit history."));
          if (isFirst) {
            setEntries([]);
            setHasMore(false);
          }
          return;
        }
        const rows = data.audit ?? [];
        setEntries((prev) => (append ? [...prev, ...rows] : rows));
        setPage(data.page ?? nextPage);
        setHasMore(Boolean(data.hasMore));
      } finally {
        if (isFirst) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [allowFetch, connectorId],
  );

  useEffect(() => {
    void fetchPage(1, false);
  }, [fetchPage]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Connector</p>
          <h3 className="text-base font-semibold text-zinc-900">Lifecycle audit timeline</h3>
          <p className="mt-1 font-mono text-xs text-zinc-600">{connectorId}</p>
        </div>
        <p className="text-xs text-zinc-500">
          Newest first · <code className="rounded bg-white px-1 py-0.5 font-mono">GET …/audit</code>
        </p>
      </div>

      {error ? (
        <div className="mt-4 space-y-3">
          <p
            className={`rounded-lg border px-3 py-2 text-sm ${
              apiErrorBody != null
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
            role="alert"
          >
            {error}
          </p>
          {apiErrorBody != null ? (
            <ApiHubAdvancedJsonDisclosure
              value={apiErrorBody}
              label="Advanced — connector audit API error body"
              description="From GET …/connectors/[id]/audit when the response was not OK."
              maxHeightClass="max-h-56"
              dark={false}
            />
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-zinc-600">Loading audit events…</p>
      ) : entries.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600">No audit events for this connector yet.</p>
      ) : (
        <ol className="relative mt-6 border-l border-zinc-200 pl-6">
          {entries.map((e) => (
            <li key={e.id} className="mb-8 last:mb-0">
              <span
                className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border border-zinc-300 bg-[var(--arscmp-primary)] shadow-sm"
                aria-hidden
              />
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{formatWhen(e.createdAt)}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{e.action}</p>
              <p className="mt-1 text-sm text-zinc-800">
                {e.actorName || "Unknown user"}
                {e.actorEmail ? <span className="text-zinc-600"> · {e.actorEmail}</span> : null}
              </p>
              <p className="mt-0.5 font-mono text-xs text-zinc-500">User id {e.actorUserId}</p>
              {e.note ? <p className="mt-2 text-sm text-zinc-700">{e.note}</p> : null}
            </li>
          ))}
        </ol>
      )}

      {hasMore && !loading ? (
        <div className="mt-6 border-t border-zinc-200 pt-4">
          <button
            type="button"
            disabled={loadingMore || !allowFetch}
            onClick={() => void fetchPage(page + 1, true)}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load older events"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
