"use client";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";

export function GeographyGroupTraceBar({ groupId }: { groupId: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Geography group id</span>
      <RecordIdCopy id={groupId} copyButtonLabel="Copy group id" />
    </div>
  );
}
