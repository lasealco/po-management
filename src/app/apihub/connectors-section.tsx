"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubConnectorDto } from "@/lib/apihub/connector-dto";

import { ApiHubAdvancedJsonDisclosure } from "./apihub-advanced-json";
import { ConnectorAuditTimeline } from "./connector-audit-timeline";

type Props = {
  initialConnectors: ApiHubConnectorDto[];
  canCreate: boolean;
};

type LiveHealthPayload = {
  state: string;
  summary: string;
  lastSyncAt: string | null;
  checkedAt: string;
  readinessOverall: string;
  lifecycleStatus: string;
  sourceKind: string;
};

type HealthProbeUi = {
  loading: boolean;
  error: string | null;
  /** Parsed JSON body when the probe HTTP call failed (for Advanced). */
  errorBody?: unknown;
  data: LiveHealthPayload | null;
};

type BadgeTone = "green" | "amber" | "red" | "zinc";

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

function parseIso(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeFromNow(iso: string) {
  const date = parseIso(iso);
  if (!date) {
    return null;
  }

  const diffMs = date.getTime() - Date.now();
  const absSeconds = Math.abs(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (absSeconds < 60) {
    return rtf.format(Math.round(diffMs / 1000), "second");
  }
  if (absSeconds < 60 * 60) {
    return rtf.format(Math.round(diffMs / (60 * 1000)), "minute");
  }
  if (absSeconds < 60 * 60 * 24) {
    return rtf.format(Math.round(diffMs / (60 * 60 * 1000)), "hour");
  }
  return rtf.format(Math.round(diffMs / (24 * 60 * 60 * 1000)), "day");
}

function toneClass(tone: BadgeTone) {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "red":
      return "border-red-200 bg-red-50 text-red-800";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
  }
}

function getHealthDisplay(status: string, healthSummary: string | null): { label: string; tone: BadgeTone } {
  const summary = (healthSummary ?? "").trim();
  const haystack = `${status} ${summary}`.toLowerCase();
  if (/(error|fail|down|degrad|outage|unhealthy)/.test(haystack)) {
    return { label: summary || "Error", tone: "red" };
  }
  if (/(ok|healthy|up|good)/.test(haystack)) {
    return { label: summary || "Healthy", tone: "green" };
  }
  if (/(draft|stub|not connected|pending)/.test(haystack)) {
    return { label: summary || "Not connected", tone: "amber" };
  }
  return { label: summary || "Unknown", tone: "zinc" };
}

export function ConnectorsSection({ initialConnectors, canCreate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timelineConnectorId, setTimelineConnectorId] = useState<string | null>(null);
  const [expandedConnectorId, setExpandedConnectorId] = useState<string | null>(null);
  const [healthProbeById, setHealthProbeById] = useState<Record<string, HealthProbeUi>>({});
  const [lastConnectorApiErrorBody, setLastConnectorApiErrorBody] = useState<unknown | null>(null);

  async function addStub() {
    setError(null);
    setLastConnectorApiErrorBody(null);
    setBusy(true);
    try {
      const res = await fetch("/api/apihub/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLastConnectorApiErrorBody(data);
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not create connector."));
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runHealthProbe(connectorId: string) {
    if (!canCreate) {
      return;
    }
    setHealthProbeById((prev) => ({
      ...prev,
      [connectorId]: {
        loading: true,
        error: null,
        errorBody: undefined,
        data: prev[connectorId]?.data ?? null,
      },
    }));
    try {
      const res = await fetch(`/api/apihub/connectors/${encodeURIComponent(connectorId)}/health`);
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        health?: LiveHealthPayload;
      };
      if (!res.ok || !data.health) {
        setHealthProbeById((prev) => ({
          ...prev,
          [connectorId]: {
            loading: false,
            error: readApiHubErrorMessageFromJsonBody(data, "Health probe failed."),
            errorBody: data,
            data: null,
          },
        }));
        return;
      }
      setHealthProbeById((prev) => ({
        ...prev,
        [connectorId]: { loading: false, error: null, errorBody: undefined, data: data.health! },
      }));
    } catch {
      setHealthProbeById((prev) => ({
        ...prev,
        [connectorId]: { loading: false, error: "Health probe failed.", errorBody: undefined, data: null },
      }));
    }
  }

  async function applyLifecycle(connectorId: string, status: string, markSyncedNow: boolean) {
    setError(null);
    setLastConnectorApiErrorBody(null);
    setRowBusyId(connectorId);
    try {
      const res = await fetch(`/api/apihub/connectors/${connectorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, markSyncedNow }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLastConnectorApiErrorBody(data);
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not update connector."));
        return;
      }
      router.refresh();
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <section
      id="connectors"
      className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Phase 1</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">Connectors</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Registry rows for partner or internal sources. This build stores{" "}
            <span className="font-medium">metadata + lifecycle events</span> — no secrets, OAuth, or background sync
            worker yet. Use <span className="font-medium text-zinc-800">Detail → View</span> for readiness fields and the
            full connector DTO; failed API calls include <span className="font-medium text-zinc-800">Advanced</span>{" "}
            error bodies when JSON is returned.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => void addStub()}
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add stub connector"}
          </button>
        ) : (
          <p className="max-w-xs text-right text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">View-only:</span> org.apihub → edit is required to add connectors.
            Ask an admin in{" "}
            <a href="/settings/roles" className="font-medium text-[var(--arscmp-primary)] hover:underline">
              Settings → Roles
            </a>
            .
          </p>
        )}
      </div>

      {error ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
          {lastConnectorApiErrorBody != null ? (
            <ApiHubAdvancedJsonDisclosure
              value={lastConnectorApiErrorBody}
              label="Advanced — last connector API error body"
              description="Parsed JSON from the failed POST/PATCH (if the response was JSON)."
              maxHeightClass="max-h-56"
              dark={false}
            />
          ) : null}
        </div>
      ) : null}

      {initialConnectors.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
          <p className="font-medium text-zinc-800">No connectors yet</p>
          <p className="mt-2">
            {canCreate
              ? "Use “Add stub connector” to insert a draft row for UI and API checks."
              : "With org.apihub → edit, add stub rows from this page or POST /api/apihub/connectors."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Readiness</th>
                <th className="px-4 py-3">Last sync</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Actions</th>
                <th className="px-4 py-3">Audit</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 w-24">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white text-zinc-800">
              {initialConnectors.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600">{c.sourceKind}</td>
                  <td className="px-4 py-3">{c.status}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(
                        c.readinessSummary.overall === "ready"
                          ? "green"
                          : c.readinessSummary.overall === "blocked"
                            ? "red"
                            : "amber",
                      )}`}
                    >
                      {c.readinessSummary.overall}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.lastSyncAt ? (
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="font-medium text-zinc-800">{formatRelativeFromNow(c.lastSyncAt) ?? "Unknown"}</span>
                        <span className="text-zinc-500">{formatWhen(c.lastSyncAt)}</span>
                      </div>
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass("amber")}`}
                      >
                        Never synced
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-xs flex-col gap-2">
                      {(() => {
                        const health = getHealthDisplay(c.status, c.healthSummary);
                        return (
                          <span
                            className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(health.tone)}`}
                          >
                            {health.label}
                          </span>
                        );
                      })()}
                      <p className="text-xs text-zinc-500">
                        Stored summary on the registry row (integrations still stubbed).
                      </p>
                      <button
                        type="button"
                        disabled={!canCreate || healthProbeById[c.id]?.loading}
                        onClick={() => void runHealthProbe(c.id)}
                        className="w-fit rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {healthProbeById[c.id]?.loading ? "Probing…" : "Run live health probe"}
                      </button>
                      {healthProbeById[c.id]?.error ? (
                        <div className="space-y-2">
                          <p className="text-xs text-red-700" role="alert">
                            {healthProbeById[c.id]?.error}
                          </p>
                          {healthProbeById[c.id]?.errorBody != null ? (
                            <ApiHubAdvancedJsonDisclosure
                              value={healthProbeById[c.id]!.errorBody}
                              label="Advanced — health probe response"
                              maxHeightClass="max-h-40"
                              dark={false}
                            />
                          ) : null}
                        </div>
                      ) : null}
                      {healthProbeById[c.id]?.data ? (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 text-xs text-emerald-950">
                          <p className="font-semibold text-emerald-900">
                            Live: {healthProbeById[c.id]?.data?.state} ·{" "}
                            {healthProbeById[c.id]?.data?.readinessOverall}
                          </p>
                          <p className="mt-1">{healthProbeById[c.id]?.data?.summary}</p>
                          <p className="mt-1 text-emerald-800/90">
                            Last sync (registry):{" "}
                            {healthProbeById[c.id]?.data?.lastSyncAt
                              ? formatWhen(healthProbeById[c.id]!.data!.lastSyncAt!)
                              : "—"}
                          </p>
                          <p className="mt-1 text-emerald-800/80">
                            Checked {formatWhen(healthProbeById[c.id]!.data!.checkedAt)}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!canCreate || rowBusyId === c.id}
                        onClick={() => void applyLifecycle(c.id, "active", true)}
                        className="inline-flex items-center rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 disabled:opacity-50"
                      >
                        {rowBusyId === c.id ? "Saving..." : "Set active + sync now"}
                      </button>
                      <button
                        type="button"
                        disabled={!canCreate || rowBusyId === c.id}
                        onClick={() => void applyLifecycle(c.id, "paused", false)}
                        className="inline-flex items-center rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50"
                      >
                        Pause
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.auditTrail.length > 0 ? (
                      <div className="text-xs text-zinc-600">
                        <p className="font-medium text-zinc-800">{c.auditTrail[0].action}</p>
                        <p className="mt-1 text-zinc-700">
                          {c.auditTrail[0].actorName || "Unknown user"}
                          {c.auditTrail[0].actorEmail ? (
                            <span className="text-zinc-500"> · {c.auditTrail[0].actorEmail}</span>
                          ) : null}
                        </p>
                        <p className="mt-1">{c.auditTrail[0].note ?? "No note"}</p>
                        <p className="mt-1 text-zinc-500">{formatWhen(c.auditTrail[0].createdAt)}</p>
                        <button
                          type="button"
                          onClick={() =>
                            setTimelineConnectorId((prev) => (prev === c.id ? null : c.id))
                          }
                          className="mt-2 text-left text-xs font-semibold text-[var(--arscmp-primary)] hover:underline"
                        >
                          {timelineConnectorId === c.id ? "Hide full timeline" : "View full timeline"}
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500">
                        <span>No events yet</span>
                        <button
                          type="button"
                          onClick={() =>
                            setTimelineConnectorId((prev) => (prev === c.id ? null : c.id))
                          }
                          className="mt-2 block text-left font-semibold text-[var(--arscmp-primary)] hover:underline"
                        >
                          {timelineConnectorId === c.id ? "Hide timeline" : "Open timeline"}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{formatWhen(c.updatedAt)}</td>
                  <td className="px-4 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => setExpandedConnectorId((cur) => (cur === c.id ? null : c.id))}
                      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                      aria-expanded={expandedConnectorId === c.id}
                    >
                      {expandedConnectorId === c.id ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
                  {expandedConnectorId === c.id ? (
                    <tr className="bg-zinc-50/90">
                      <td colSpan={10} className="p-0">
                        <div className="border-t border-zinc-100 px-4 py-4 text-sm text-zinc-800">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Connector summary</p>
                          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
                            <div className="sm:col-span-2 lg:col-span-3">
                              <dt className="text-zinc-500">Id</dt>
                              <dd className="break-all font-mono text-[11px] text-zinc-900">{c.id}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Name</dt>
                              <dd className="font-medium">{c.name}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Source kind</dt>
                              <dd className="font-mono text-[11px]">{c.sourceKind}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Status</dt>
                              <dd className="font-medium">{c.status}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Auth mode</dt>
                              <dd className="font-mono text-[11px]">{c.authMode}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Readiness</dt>
                              <dd className="font-medium capitalize">{c.readinessSummary.overall}</dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-zinc-500">Readiness reasons</dt>
                              <dd className="font-mono text-[11px]">
                                {c.readinessSummary.reasons.length > 0
                                  ? c.readinessSummary.reasons.join(", ")
                                  : "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Auth ready</dt>
                              <dd>{c.readinessSummary.authReady ? "yes" : "no"}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Auth state</dt>
                              <dd className="font-mono text-[11px]">{c.readinessSummary.authState}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Has auth config ref</dt>
                              <dd>{c.readinessSummary.hasAuthConfigRef ? "yes" : "no"}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Lifecycle active</dt>
                              <dd>{c.readinessSummary.lifecycleActive ? "yes" : "no"}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Sync observed</dt>
                              <dd>{c.readinessSummary.syncObserved ? "yes" : "no"}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Last sync</dt>
                              <dd className="text-xs">{c.lastSyncAt ? formatWhen(c.lastSyncAt) : "—"}</dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-zinc-500">Health summary (stored)</dt>
                              <dd className="text-zinc-700">{c.healthSummary?.trim() || "—"}</dd>
                            </div>
                            <div className="sm:col-span-2">
                              <dt className="text-zinc-500">Ops note</dt>
                              <dd className="text-zinc-700">{c.opsNote?.trim() || "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Created</dt>
                              <dd className="text-xs">{formatWhen(c.createdAt)}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Updated</dt>
                              <dd className="text-xs">{formatWhen(c.updatedAt)}</dd>
                            </div>
                            <div>
                              <dt className="text-zinc-500">Audit events (embedded)</dt>
                              <dd className="tabular-nums">{c.auditTrail.length}</dd>
                            </div>
                          </dl>
                          {healthProbeById[c.id]?.data ? (
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-950">
                              <p className="font-semibold uppercase tracking-wide text-emerald-900">Latest live probe</p>
                              <p className="mt-1">
                                {healthProbeById[c.id]!.data!.state} · {healthProbeById[c.id]!.data!.readinessOverall}
                              </p>
                              <p className="mt-1 text-emerald-900/90">{healthProbeById[c.id]!.data!.summary}</p>
                            </div>
                          ) : null}
                          <div className="mt-4">
                            <ApiHubAdvancedJsonDisclosure
                              value={c}
                              description="Full list-row DTO including embedded audit trail sample from GET /connectors."
                              maxHeightClass="max-h-72"
                              dark={false}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {timelineConnectorId ? (
        <div className="mt-6">
          <ConnectorAuditTimeline connectorId={timelineConnectorId} allowFetch={canCreate} />
        </div>
      ) : null}

      <p className="mt-4 text-xs text-zinc-500">
        API: <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">GET /api/apihub/connectors</code>,{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">POST /api/apihub/connectors</code> (demo tenant +
        demo actor required),{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">PATCH /api/apihub/connectors/:id</code> for status
        + sync timestamp updates with audit rows,{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">GET /api/apihub/connectors/:id/audit</code> for
        paginated audit history,{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono">GET /api/apihub/connectors/:id/health</code> for
        a lightweight readiness probe (no secrets).
      </p>
    </section>
  );
}
