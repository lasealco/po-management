"use client";

import { CopyTextButton } from "@/components/invoice-audit/copy-text-button";

/** Truncated primary key + copy for dense admin tables (tariffs, snapshots, invoice audit). */
export function RecordIdCopy({ id, copyButtonLabel = "Copy id" }: { id: string; copyButtonLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="max-w-[11rem] truncate font-mono text-[10px] text-zinc-600" title={id}>
        {id}
      </span>
      <CopyTextButton text={id} label={copyButtonLabel} copiedLabel="Copied" />
    </div>
  );
}
