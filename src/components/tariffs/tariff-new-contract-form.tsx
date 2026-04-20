"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { TARIFF_CONTRACTS_DIRECTORY_PATH, tariffContractHeaderPath } from "@/lib/tariff/tariff-workbench-urls";

const TRANSPORT_MODES = ["OCEAN", "LCL", "AIR", "TRUCK", "RAIL", "LOCAL_SERVICE"] as const;

type ProviderOpt = { id: string; legalName: string; tradingName: string | null };
type EntityOpt = { id: string; name: string; code: string | null };

export function TariffNewContractForm({
  providers,
  legalEntities,
  canEdit,
}: {
  providers: ProviderOpt[];
  legalEntities: EntityOpt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [providerId, setProviderId] = useState(providers[0]?.id ?? "");
  const [legalEntityId, setLegalEntityId] = useState("");
  const [transportMode, setTransportMode] = useState<string>("OCEAN");
  const [contractNumber, setContractNumber] = useState("");

  async function submit() {
    setError(null);
    if (!canEdit) {
      setError("You do not have permission to create contracts.");
      return;
    }
    if (!title.trim() || !providerId) {
      setError("Title and provider are required.");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/tariffs/contracts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          providerId,
          transportMode,
          contractNumber: contractNumber.trim() || null,
          legalEntityId: legalEntityId || null,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; contract?: { id: string } } | null;
      if (!res.ok) {
        setError(data?.error ?? `Save failed (${res.status})`);
        return;
      }
      if (data?.contract?.id) {
        router.push(tariffContractHeaderPath(data.contract.id));
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">New tariff contract</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">
        Step 1: pick carrier or logistics provider and mode. Step 2: save to open the contract workspace and add
        versions.
      </p>

      <div className="mt-6 grid max-w-xl gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--arscmp-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--arscmp-primary)]"
            placeholder="e.g. Asia–USEC Q2 ocean FCL"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Provider</span>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--arscmp-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--arscmp-primary)]"
          >
            {providers.length === 0 ? (
              <option value="">No providers — seed or add a provider first</option>
            ) : null}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.tradingName ? `${p.tradingName} (${p.legalName})` : p.legalName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Legal entity (optional)</span>
          <select
            value={legalEntityId}
            onChange={(e) => setLegalEntityId(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--arscmp-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--arscmp-primary)]"
          >
            <option value="">— None —</option>
            {legalEntities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
                {e.code ? ` (${e.code})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Transport mode</span>
          <select
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--arscmp-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--arscmp-primary)]"
          >
            {TRANSPORT_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Contract number (optional)</span>
          <input
            value={contractNumber}
            onChange={(e) => setContractNumber(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--arscmp-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--arscmp-primary)]"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending || !canEdit}
          onClick={() => void submit()}
          className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Create contract"}
        </button>
        <button
          type="button"
          onClick={() => router.push(TARIFF_CONTRACTS_DIRECTORY_PATH)}
          className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
