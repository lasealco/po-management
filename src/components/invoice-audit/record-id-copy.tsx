"use client";

import { CopyTextButton } from "@/components/invoice-audit/copy-text-button";

/** Truncated primary key + copy for dense admin tables (tariffs, snapshots, invoice audit). */
export function RecordIdCopy({ id, copyButtonLabel = "Copy id" }: { id: string; copyButtonLabel?: string }) {
  const t = id.trim();
  if (!t) {
    return <span className="text-xs text-zinc-400">—</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="max-w-[11rem] truncate font-mono text-[10px] text-zinc-600" title={t}>
        {t}
      </span>
      <CopyTextButton text={t} label={copyButtonLabel} copiedLabel="Copied" />
    </div>
  );
}
