"use client";

import { useCallback, useEffect, useState } from "react";

type Breakdown = {
  kind: "RATE" | "CHARGE";
  label: string;
  rateType?: string | null;
  rawChargeName?: string | null;
  normalizedCode?: string | null;
  unitBasis: string;
  currency: string;
  amount: number;
};

type Option = {
  contractNumber: string;
  title: string;
  carrierLegalName: string;
  carrierTradingName: string | null;
  lines: Breakdown[];
  totalUsd: number;
};

type Payload = {
  lane: string;
  equipment: string;
  options: Option[];
  missingSeed?: boolean;
  hint?: string | null;
};

function fmtUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function InvestorDoorRatesClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tariffs/investor-door-rates", { cache: "no-store" });
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Request failed (${res.status})`);
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          Synthetic stacks for investor walkthrough — not live carrier pricing.
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}

      {data?.missingSeed && data.hint ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">No demo contracts yet.</span> {data.hint}
        </div>
      ) : null}

      {data && !data.missingSeed ? (
        <div>
          <p className="mb-4 text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">{data.lane}</span>
            <span className="mx-2 text-zinc-400">·</span>
            <span>{data.equipment}</span>
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            {data.options.map((opt) => (
              <section
                key={opt.contractNumber}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
              >
                <header className="border-b border-zinc-100 bg-zinc-50/80 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                    {opt.contractNumber}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-900">{opt.title}</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {opt.carrierTradingName ? `${opt.carrierTradingName} — ` : null}
                    {opt.carrierLegalName}
                  </p>
                </header>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                        <th className="px-5 py-2 font-medium">Line</th>
                        <th className="px-5 py-2 font-medium">Basis</th>
                        <th className="px-5 py-2 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opt.lines.map((line, i) => (
                        <tr key={`${line.kind}-${i}`} className="border-b border-zinc-50 last:border-0">
                          <td className="px-5 py-2.5 text-zinc-800">
                            <span className="mr-2 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                              {line.kind}
                            </span>
                            {line.label}
                            {line.normalizedCode ? (
                              <span className="mt-0.5 block text-xs text-zinc-500">Code: {line.normalizedCode}</span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-5 py-2.5 text-zinc-600">{line.unitBasis}</td>
                          <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium tabular-nums text-zinc-900">
                            {line.currency === "USD" ? fmtUsd(line.amount) : `${line.amount} ${line.currency}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-zinc-50">
                        <td colSpan={2} className="px-5 py-3 text-sm font-semibold text-zinc-800">
                          Door-to-door total (USD)
                        </td>
                        <td className="px-5 py-3 text-right text-base font-bold tabular-nums text-zinc-900">
                          {fmtUsd(opt.totalUsd)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}

      {loading && !data && !error ? (
        <p className="text-sm text-zinc-500">Loading rate stacks…</p>
      ) : null}
    </div>
  );
}
