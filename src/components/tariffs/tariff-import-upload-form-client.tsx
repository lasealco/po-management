"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TARIFF_IMPORT_PATH, tariffImportBatchPath } from "@/lib/tariff/tariff-workbench-urls";

type LegalEntityOption = { id: string; name: string; code: string | null };

export function TariffImportUploadFormClient({
  canEdit,
  legalEntities,
}: {
  canEdit: boolean;
  legalEntities: LegalEntityOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) {
      setError("Choose a PDF or Excel file.");
      return;
    }
    setPending(true);
    try {
      const up = new FormData();
      up.set("file", file);
      const le = String(fd.get("legalEntityId") ?? "").trim();
      if (le) up.set("legalEntityId", le);
      const res = await fetch("/api/tariffs/import-batches", { method: "POST", body: up });
      const data = (await res.json().catch(() => ({}))) as { error?: string; batch?: { id: string } };
      if (!res.ok) {
        const fromServer = typeof data.error === "string" ? data.error.trim() : "";
        const detail = fromServer || "The server did not accept this upload.";
        setError(`${detail} If this keeps happening, note HTTP ${res.status} for support.");
        return;
      }
      if (data.batch?.id) {
        router.push(tariffImportBatchPath(data.batch.id));
        router.refresh();
        return;
      }
      setError("Unexpected response.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={(ev) => void onSubmit(ev)}>
      {error ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="font-semibold text-red-900">Upload could not complete</p>
          <p className="mt-1 text-red-800">{error}</p>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Legal entity (optional)</span>
        <select
          name="legalEntityId"
          className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:bg-zinc-100"
          disabled={!canEdit}
          defaultValue=""
        >
          <option value="">— None —</option>
          {legalEntities.map((le) => (
            <option key={le.id} value={le.id}>
              {le.name}
              {le.code ? ` (${le.code})` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium text-zinc-700">Tariff file</span>
        <p className="mt-1 text-xs text-zinc-500">PDF or Excel (.xlsx, .xls). Parsing is not run yet; the file is stored for a future worker.</p>
        <input
          type="file"
          name="file"
          accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          required
          disabled={!canEdit}
          className="mt-2 block w-full max-w-lg text-sm text-zinc-700 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:font-medium file:text-zinc-800 hover:file:bg-zinc-200"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            {pending ? "Uploading…" : "Upload and create batch"}
          </button>
        ) : null}
        <Link
          href={TARIFF_IMPORT_PATH}
          className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
