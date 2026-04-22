"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { TARIFF_CONTRACTS_DIRECTORY_PATH, tariffContractVersionPath } from "@/lib/tariff/tariff-workbench-urls";

export function TariffContractHeaderClient({
  contractId,
  canEdit,
  initialTitle,
  initialContractNumber,
  initialStatus,
}: {
  contractId: string;
  canEdit: boolean;
  initialTitle: string;
  initialContractNumber: string | null;
  initialStatus: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialTitle);
  const [contractNumber, setContractNumber] = useState(initialContractNumber ?? "");
  const [status, setStatus] = useState(initialStatus);

  async function saveHeader() {
    setError(null);
    const res = await fetch(`/api/tariffs/contracts/${contractId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        contractNumber: contractNumber.trim() || null,
        status,
      }),
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      setError(apiClientErrorMessage(data ?? {}, "Save failed"));
      return;
    }
    router.refresh();
  }

  async function addVersion() {
    setError(null);
    const res = await fetch(`/api/tariffs/contracts/${contractId}/versions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: "MANUAL" }),
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      setError(apiClientErrorMessage(data ?? {}, "Could not create version"));
      return;
    }
    const body = data as { version?: { id: string } } | null;
    if (body?.version?.id) {
      router.push(tariffContractVersionPath(contractId, body.version.id));
      router.refresh();
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Contract header</h1>
      <p className="mt-2 text-sm text-zinc-600">Step 2: maintain header data. Step 3: open a version to edit rate lines.</p>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid max-w-2xl gap-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Title</span>
          <input
            value={title}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-zinc-100"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Contract number</span>
          <input
            value={contractNumber}
            disabled={!canEdit}
            onChange={(e) => setContractNumber(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-zinc-100"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-700">Header status</span>
          <select
            value={status}
            disabled={!canEdit}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-zinc-100"
          >
            {["DRAFT", "UNDER_REVIEW", "APPROVED", "EXPIRED", "SUPERSEDED", "ARCHIVED"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => void saveHeader())}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save header"}
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => void addVersion())}
            className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            New version
          </button>
        ) : null}
        <Link
          href={TARIFF_CONTRACTS_DIRECTORY_PATH}
          className="inline-flex items-center rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm hover:bg-zinc-50"
        >
          Back to directory
        </Link>
      </div>
    </section>
  );
}
