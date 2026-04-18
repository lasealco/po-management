"use client";

import { CopyTextButton } from "@/components/invoice-audit/copy-text-button";

export function TariffImportBatchIdsBar({ batchId }: { batchId: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Batch id</span>
      <span className="max-w-[min(100%,42rem)] break-all font-mono text-xs text-zinc-800">{batchId}</span>
      <CopyTextButton text={batchId} label="Copy batch id" copiedLabel="Copied" />
    </div>
  );
}
