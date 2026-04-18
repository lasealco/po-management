"use client";

import { CopyTextButton } from "@/components/invoice-audit/copy-text-button";

/** Compact snapshot primary key + copy for dense tables (list views). */
export function PricingSnapshotIdCopy({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="max-w-[11rem] truncate font-mono text-[10px] text-zinc-600" title={id}>
        {id}
      </span>
      <CopyTextButton text={id} label="Copy id" copiedLabel="Copied" />
    </div>
  );
}
