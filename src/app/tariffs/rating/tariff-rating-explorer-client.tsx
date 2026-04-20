"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { labelTariffShipmentApplicationSource } from "@/lib/tariff/tariff-shipment-application-labels";
import { TARIFF_CONTRACTS_DIRECTORY_PATH, tariffContractVersionPath } from "@/lib/tariff/tariff-workbench-urls";

type RatedLine = {
  kind: "RATE" | "CHARGE";
  id: string;
  label: string;
  rateType?: string;
  currency: string;
  amount: number;
  payable: boolean;
  matchReason: string;
};

type Candidate = {
  contractHeaderId: string;
  contractNumber: string | null;
  contractTitle: string;
  versionId: string;
  versionNo: number;
  providerLegalName: string;
  providerTradingName: string | null;
  transportMode: string;
  geographyScore: number;
  lines: RatedLine[];
  totalsByCurrency: Record<string, number>;
  warnings: string[];
};

type RateResponse = {
  candidates: Candidate[];
  meta: { pol: string; pod: string; equipment: string; asOf: string; transportMode: string };
};

type HintsResponse = {
  shipmentId: string;
  pol: string | null;
  pod: string | null;
  equipment: string;
  transportMode: string;
  bookingOriginCode: string | null;
  bookingDestinationCode: string | null;
};

type ShipmentTariffAppRow = {
  id: string;
  isPrimary: boolean;
  source: string;
  sourceLabel?: string;
  polCode: string | null;
  podCode: string | null;
  equipmentType: string | null;
  contractVersionId: string;
  contractVersion?: {
    versionNo: number;
    contractHeader?: {
      id: string;
      title: string;
      contractNumber: string | null;
    };
  };
};

function fmtMoney(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function TariffRatingExplorerClient() {
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get("shipmentId")?.trim() ?? "";

  const [pol, setPol] = useState("DEHAM");
  const [pod, setPod] = useState("USCHI");
  const [equipment, setEquipment] = useState("40HC");
  const [transportMode, setTransportMode] = useState("OCEAN");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<RateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hintsError, setHintsError] = useState<string | null>(null);
  const [applyBusyId, setApplyBusyId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [linkedApps, setLinkedApps] = useState<ShipmentTariffAppRow[] | null>(null);
  const [linkedError, setLinkedError] = useState<string | null>(null);
  const [linkedLoading, setLinkedLoading] = useState(false);

  const loadLinkedApplications = useCallback(async () => {
    if (!shipmentId) return;
    setLinkedLoading(true);
    setLinkedError(null);
    try {
      const res = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/tariff-applications`, {
        credentials: "include",
      });
      const json = (await res.json()) as { applications?: ShipmentTariffAppRow[]; error?: string };
      if (!res.ok) {
        setLinkedError(json.error ?? `Load failed (${res.status})`);
        setLinkedApps(null);
        return;
      }
      setLinkedApps(json.applications ?? []);
    } catch (e) {
      setLinkedError(e instanceof Error ? e.message : "Failed to load tariff links.");
      setLinkedApps(null);
    } finally {
      setLinkedLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    if (!shipmentId) {
      setLinkedApps(null);
      setLinkedError(null);
      return;
    }
    void loadLinkedApplications();
  }, [shipmentId, loadLinkedApplications]);

  useEffect(() => {
    if (!shipmentId) return;
    let cancelled = false;
    (async () => {
      setHintsError(null);
      try {
        const res = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/tariff-rating-hints`, {
          credentials: "include",
        });
        const json = (await res.json()) as HintsResponse & { error?: string };
        if (!res.ok) {
          if (!cancelled) setHintsError(json.error ?? `Hints failed (${res.status})`);
          return;
        }
        if (cancelled) return;
        if (json.pol) setPol(json.pol);
        if (json.pod) setPod(json.pod);
        setEquipment(json.equipment);
        setTransportMode(json.transportMode);
      } catch (e) {
        if (!cancelled) setHintsError(e instanceof Error ? e.message : "Hints failed.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shipmentId]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tariffs/rate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pol, pod, equipment, transportMode, asOf }),
      });
      const json = (await res.json()) as RateResponse & { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [pol, pod, equipment, transportMode, asOf]);

  async function applyVersion(versionId: string) {
    if (!shipmentId) return;
    setApplyBusyId(versionId);
    setApplyMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/shipments/${encodeURIComponent(shipmentId)}/tariff-applications`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractVersionId: versionId,
          isPrimary: true,
          source: "RATING_ENGINE",
          polCode: pol || null,
          podCode: pod || null,
          equipmentType: equipment || null,
          appliedNotes: "Applied from lane rating explorer",
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setApplyMessage(json.error ?? `Apply failed (${res.status})`);
        return;
      }
      setApplyMessage("Tariff version linked as primary for this shipment.");
      await loadLinkedApplications();
    } catch (e) {
      setApplyMessage(e instanceof Error ? e.message : "Apply failed.");
    } finally {
      setApplyBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      {shipmentId ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
          <span className="font-semibold">Shipment context:</span>{" "}
          <code className="rounded bg-white/80 px-1.5 py-0.5 text-xs">{shipmentId}</code>
          {hintsError ? <span className="ml-2 text-red-800">({hintsError})</span> : null}
          <span className="mt-1 block text-xs text-sky-900">
            POL/POD pre-filled from booking when available. Use <strong>Apply</strong> on a candidate to set the
            primary tariff version on this shipment.
          </span>
        </div>
      ) : null}

      {shipmentId ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 text-sm text-violet-950">
          <p className="font-semibold text-violet-900">Current tariff links on this shipment</p>
          {linkedLoading ? (
            <p className="mt-1 text-xs text-violet-800">Loading…</p>
          ) : linkedError ? (
            <p className="mt-1 text-xs text-red-800">{linkedError}</p>
          ) : !linkedApps || linkedApps.length === 0 ? (
            <p className="mt-1 text-xs text-violet-900">None yet — run rating below and apply a version.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {linkedApps.map((app) => {
                const h = app.contractVersion?.contractHeader;
                const vno = app.contractVersion?.versionNo;
                return (
                  <li key={app.id} className="text-violet-950">
                    <span className="font-medium">{app.isPrimary ? "Primary · " : ""}</span>
                    {h?.title ?? "Linked version"}
                    {h?.contractNumber ? (
                      <span className="ml-1 font-mono text-[10px] text-violet-800">{h.contractNumber}</span>
                    ) : null}
                    {vno != null ? <span className="text-violet-800"> · v{vno}</span> : null}
                    {h?.id ? (
                      <Link
                        href={tariffContractVersionPath(h.id, app.contractVersionId, { shipmentId })}
                        className="ml-2 font-semibold text-[var(--arscmp-primary)] hover:underline"
                      >
                        Open
                      </Link>
                    ) : null}
                    <span className="text-violet-800">
                      {" "}
                      ·{" "}
                      {app.polCode || app.podCode
                        ? `${app.polCode ?? "—"} → ${app.podCode ?? "—"}`
                        : "lane not set"}
                      {app.equipmentType ? ` · ${app.equipmentType}` : ""}
                    </span>
                    <span className="text-violet-700">
                      {" "}
                      · {app.sourceLabel ?? labelTariffShipmentApplicationSource(app.source)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">POL</span>
            <input
              value={pol}
              onChange={(e) => setPol(e.target.value.toUpperCase())}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">POD</span>
            <input
              value={pod}
              onChange={(e) => setPod(e.target.value.toUpperCase())}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">Equipment</span>
            <input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="40HC, 20GP, …"
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">Tariff mode</span>
            <select
              value={transportMode}
              onChange={(e) => setTransportMode(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            >
              {["OCEAN", "AIR", "LCL", "TRUCK", "RAIL", "LOCAL_SERVICE"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-700">As of</span>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void run()}
            className="rounded-lg bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            {loading ? "Rating…" : "Run rating engine"}
          </button>
          <Link
            href={TARIFF_CONTRACTS_DIRECTORY_PATH}
            className="self-center text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
          >
            Contracts
          </Link>
        </div>
      </div>

      {applyMessage ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            applyMessage.startsWith("Tariff version") ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {applyMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}

      {data ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">
            <span className="font-medium text-zinc-900">
              {data.meta.pol} → {data.meta.pod}
            </span>
            <span className="mx-2 text-zinc-400">·</span>
            {data.meta.equipment}
            <span className="mx-2 text-zinc-400">·</span>
            {data.meta.transportMode}
            <span className="mx-2 text-zinc-400">·</span>
            effective {data.meta.asOf}
          </p>
          {data.candidates.length === 0 ? (
            <p className="text-sm text-zinc-600">No approved contract versions matched this lane (check dates and header status).</p>
          ) : (
            <div className="space-y-6">
              {data.candidates.map((c) => (
                <section key={c.versionId} className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
                  <header className="border-b border-zinc-100 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      Geography score {c.geographyScore} · v{c.versionNo}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-zinc-900">{c.contractTitle}</h2>
                    <p className="mt-1 text-sm text-zinc-600">
                      {c.providerTradingName ? `${c.providerTradingName} — ` : ""}
                      {c.providerLegalName}
                      {c.contractNumber ? (
                        <>
                          {" "}
                          · <span className="font-mono text-xs">{c.contractNumber}</span>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-2">
                      <Link
                        href={tariffContractVersionPath(c.contractHeaderId, c.versionId, { shipmentId })}
                        className="text-xs font-semibold text-[var(--arscmp-primary)] hover:underline"
                      >
                        Open version workbench
                      </Link>
                    </p>
                    {shipmentId ? (
                      <button
                        type="button"
                        disabled={Boolean(applyBusyId)}
                        onClick={() => void applyVersion(c.versionId)}
                        className="mt-3 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                      >
                        {applyBusyId === c.versionId ? "Applying…" : "Apply to shipment (primary)"}
                      </button>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">
                        Open this page with <code className="rounded bg-zinc-100 px-1">?shipmentId=…</code> from an
                        order to enable <strong>Apply</strong>.
                      </p>
                    )}
                    {c.warnings.length ? (
                      <ul className="mt-2 list-inside list-disc text-xs text-amber-900">
                        {c.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    ) : null}
                  </header>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[360px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                          <th className="px-5 py-2 font-medium">Line</th>
                          <th className="px-5 py-2 font-medium">Match</th>
                          <th className="px-5 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.lines.map((line) => (
                          <tr key={line.id} className="border-b border-zinc-50 last:border-0">
                            <td className="px-5 py-2.5 text-zinc-800">
                              <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                                {line.kind}
                              </span>
                              {line.label}
                              {line.rateType ? (
                                <span className="mt-0.5 block text-xs text-zinc-500">{line.rateType}</span>
                              ) : null}
                            </td>
                            <td className="px-5 py-2.5 text-xs text-zinc-600">{line.matchReason}</td>
                            <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium tabular-nums text-zinc-900">
                              {fmtMoney(line.currency, line.amount)}
                              {!line.payable ? (
                                <span className="ml-1 text-[10px] font-normal uppercase text-zinc-400">non-pay</span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-zinc-50">
                          <td colSpan={2} className="px-5 py-3 text-sm font-semibold text-zinc-800">
                            Payable totals
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-bold text-zinc-900">
                            {Object.entries(c.totalsByCurrency).map(([cur, amt]) => (
                              <div key={cur}>{fmtMoney(cur, amt)}</div>
                            ))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
