"use client";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";

export function PricingSnapshotTraceIds(props: { snapshotId: string; sourceRecordId: string }) {
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-start sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Snapshot id</div>
        <div className="mt-1">
          <RecordIdCopy id={props.snapshotId} copyButtonLabel="Copy snapshot id" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Source record id</div>
        <div className="mt-1">
          {props.sourceRecordId.trim() ? (
            <RecordIdCopy id={props.sourceRecordId} copyButtonLabel="Copy source record id" />
          ) : (
            <span className="text-xs text-zinc-400">—</span>
          )}
        </div>
      </div>
    </div>
  );
}
