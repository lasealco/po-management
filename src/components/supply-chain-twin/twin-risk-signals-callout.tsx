"use client";

import { twinApiClientErrorMessage } from "@/lib/supply-chain-twin/error-codes";
import Link from "next/link";
import { useState } from "react";
import { TwinFallbackState } from "./twin-fallback-state";
import { useTwinCachedAsync } from "./use-twin-cached-async";

const SEVERITIES = new Set(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);

type RiskRow = {
  id: string;
  code: string;
  severity: string;
  title: string;
  detail: string | null;
  createdAt: string;
  updatedAt: string;
  acknowledged?: boolean;
};

type RiskSignalsResult = { ok: true; items: RiskRow[] } | { ok: false; message: string };

async function fetchRiskSignalsTop(): Promise<RiskSignalsResult> {
  try {
    const res = await fetch("/api/supply-chain-twin/risk-signals?limit=5", { cache: "no-store" });
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: twinApiClientErrorMessage(body, "Risk signals could not be loaded.") };
    }
    if (typeof body !== "object" || body == null || !("items" in body) || !Array.isArray((body as { items: unknown }).items)) {
      return { ok: false, message: "Unexpected response from risk signals." };
    }
    const rawItems = (body as { items: unknown[] }).items;
    const items: RiskRow[] = [];
    for (const row of rawItems) {
      if (
        typeof row === "object" &&
        row != null &&
        "id" in row &&
        typeof (row as { id: unknown }).id === "string" &&
        "code" in row &&
        typeof (row as { code: unknown }).code === "string" &&
        "severity" in row &&
        typeof (row as { severity: unknown }).severity === "string" &&
        SEVERITIES.has((row as { severity: string }).severity) &&
        "title" in row &&
        typeof (row as { title: unknown }).title === "string" &&
        "detail" in row &&
        ((row as { detail: unknown }).detail === null || typeof (row as { detail: unknown }).detail === "string") &&
        "createdAt" in row &&
        typeof (row as { createdAt: unknown }).createdAt === "string" &&
        "updatedAt" in row &&
        typeof (row as { updatedAt: unknown }).updatedAt === "string" &&
        (!("acknowledged" in row) || typeof (row as { acknowledged: unknown }).acknowledged === "boolean")
      ) {
        items.push({
          id: (row as { id: string }).id,
          code: (row as { code: string }).code,
          severity: (row as { severity: string }).severity,
          title: (row as { title: string }).title,
          detail: (row as { detail: string | null }).detail,
          createdAt: (row as { createdAt: string }).createdAt,
          updatedAt: (row as { updatedAt: string }).updatedAt,
          ...(typeof (row as { acknowledged?: unknown }).acknowledged === "boolean"
            ? { acknowledged: (row as { acknowledged?: boolean }).acknowledged as boolean }
            : {}),
        });
      }
    }
    if (items.length !== rawItems.length) {
      return { ok: false, message: "Unexpected response from risk signals." };
    }
    return { ok: true, items };
  } catch {
    return { ok: false, message: "Network error while loading risk signals." };
  }
}

function TwinRiskSignalsCalloutInner() {
  const snapshot = useTwinCachedAsync("sctwin:risk-signals:top:v1", () => fetchRiskSignalsTop());
  const [activeTab, setActiveTab] = useState<"open" | "acknowledged">("open");

  if (snapshot.status === "pending") {
    return <TwinFallbackState tone="loading" title="Loading risk signals..." />;
  }

  if (snapshot.status === "rejected") {
    return (
      <TwinFallbackState
        tone="error"
        title="Unable to load risk signals"
        description="Network error while loading risk signals."
      />
    );
  }

  const data = snapshot.data;
  const supportsAckState = data.ok && data.items.some((row) => typeof row.acknowledged === "boolean");

  const openItems = data.ok
    ? data.items.filter((row) => (typeof row.acknowledged === "boolean" ? !row.acknowledged : true))
    : [];
  const acknowledgedItems = data.ok
    ? data.items.filter((row) => typeof row.acknowledged === "boolean" && row.acknowledged)
    : [];
  const visibleItems = !data.ok ? [] : activeTab === "open" ? openItems : acknowledgedItems;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Risk</p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-900">Top signals</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Latest rows from{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">GET /api/supply-chain-twin/risk-signals</code>{" "}
            (capped at five). Open the explorer for catalog drill-down; per-signal detail routes are not wired yet.
          </p>
          {supportsAckState ? (
            <div className="mt-3 inline-flex rounded-xl border border-zinc-300 bg-zinc-50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("open")}
                className={`rounded-lg px-3 py-1.5 font-semibold ${
                  activeTab === "open" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
                }`}
              >
                Open ({openItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("acknowledged")}
                className={`rounded-lg px-3 py-1.5 font-semibold ${
                  activeTab === "acknowledged" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
                }`}
              >
                Acknowledged ({acknowledgedItems.length})
              </button>
            </div>
          ) : null}
        </div>
        <Link
          href="/supply-chain-twin/explorer"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
        >
          Open explorer
        </Link>
      </div>

      {data.ok === false ? (
        <TwinFallbackState
          className="mt-4"
          tone="error"
          title="Unable to load risk signals"
          description={data.message}
        />
      ) : null}

      {data.ok && data.items.length === 0 ? (
        <TwinFallbackState
          className="mt-5 py-8"
          centered
          title="No risk signals yet"
          description="When the Twin demo seed runs, sample signals appear here. Use explorer to browse entity snapshots in the meantime."
          actions={
            <Link
              href="/supply-chain-twin/explorer"
              className="inline-flex rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              Open explorer
            </Link>
          }
        />
      ) : null}

      {data.ok && data.items.length > 0 ? (
        <>
          {!supportsAckState ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              Ack status is not available yet from this environment; showing all signals as open.
            </p>
          ) : null}
          {supportsAckState && visibleItems.length === 0 ? (
            <TwinFallbackState className="mt-5 py-6" centered title={`No ${activeTab} signals in this slice.`} />
          ) : null}
          <ul className="mt-5 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
            {(supportsAckState ? visibleItems : data.items).map((row) => (
              <li key={row.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{row.title}</p>
                  <p className="mt-0.5 font-mono text-xs text-zinc-500">
                    <span className="text-zinc-700">{row.severity}</span>
                    <span className="mx-1.5 text-zinc-400">·</span>
                    {row.code}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-zinc-500">Details coming</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            Per-signal drill-down is not available in this preview — details coming.
          </p>
        </>
      ) : null}
    </section>
  );
}

export function TwinRiskSignalsCallout() {
  return <TwinRiskSignalsCalloutInner />;
}
