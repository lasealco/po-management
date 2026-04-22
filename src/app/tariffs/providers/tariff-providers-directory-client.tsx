"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ProviderRow = {
  id: string;
  legalName: string;
  tradingName: string | null;
  providerType: string;
  countryCode: string | null;
  status: string;
};

export function TariffProvidersDirectoryClient({
  initialProviders,
  canEdit,
}: {
  initialProviders: ProviderRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [providerType, setProviderType] = useState("OCEAN_CARRIER");
  const [countryCode, setCountryCode] = useState("");

  async function createProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/tariffs/providers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legalName,
          tradingName: tradingName.trim() || null,
          providerType,
          countryCode: countryCode.trim() || null,
        }),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        setError(apiClientErrorMessage(data ?? {}, `Create failed (${res.status})`));
        return;
      }
      setLegalName("");
      setTradingName("");
      setCountryCode("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {canEdit ? (
        <form onSubmit={(e) => void createProvider(e)} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
          <h2 className="text-sm font-semibold text-zinc-900">New provider</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="text-zinc-600">Legal name</span>
              <input
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-600">Trading name</span>
              <input
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-600">Type</span>
              <select
                value={providerType}
                onChange={(e) => setProviderType(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              >
                {["OCEAN_CARRIER", "NVOCC", "FORWARDER", "AIRLINE", "TRUCKER", "RAIL_OPERATOR", "WAREHOUSE", "BROKER", "COURIER", "OTHER"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-600">Country (ISO-2)</span>
              <input
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))}
                maxLength={2}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-3 rounded-lg bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Create provider"}
          </button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-100">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-2 font-medium">Legal name</th>
              <th className="px-4 py-2 font-medium">Trading</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Country</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {initialProviders.map((p) => (
              <tr key={p.id} className="border-b border-zinc-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-zinc-900">{p.legalName}</td>
                <td className="px-4 py-2.5 text-zinc-700">{p.tradingName ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{p.providerType}</td>
                <td className="px-4 py-2.5 text-zinc-600">{p.countryCode ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
