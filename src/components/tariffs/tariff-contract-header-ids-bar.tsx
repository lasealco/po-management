"use client";

import Link from "next/link";

import { CopyTextButton } from "@/components/invoice-audit/copy-text-button";

export function TariffContractHeaderIdsBar({ contractId }: { contractId: string }) {
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Contract header id</span>
        <span className="max-w-[min(100%,36rem)] break-all font-mono text-xs text-zinc-800">{contractId}</span>
        <CopyTextButton text={contractId} label="Copy id" copiedLabel="Copied" />
      </div>
      <p className="text-xs text-zinc-600">
        Use a contract <span className="font-medium">version</span> id when{" "}
        <Link href="/pricing-snapshots/new" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          freezing a pricing snapshot
        </Link>
        . Version ids are on each version page.
      </p>
    </div>
  );
}
