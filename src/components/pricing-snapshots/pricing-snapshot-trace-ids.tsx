"use client";

import { CopyTextButton } from "@/components/invoice-audit/copy-text-button";

export function PricingSnapshotTraceIds(props: { snapshotId: string; sourceRecordId: string }) {
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-start sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Snapshot id</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="break-all font-mono text-xs text-zinc-800">{props.snapshotId}</span>
          <CopyTextButton text={props.snapshotId} label="Copy" copiedLabel="Copied" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Source record id</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="break-all font-mono text-xs text-zinc-800">{props.sourceRecordId}</span>
          <CopyTextButton text={props.sourceRecordId} label="Copy" copiedLabel="Copied" />
        </div>
      </div>
    </div>
  );
}
