"use client";

import { CopyTextButton } from "@/components/invoice-audit/copy-text-button";
import { INVOICE_AUDIT_DEMO_SEED_CLI } from "@/lib/invoice-audit/invoice-audit-demo-constants";

export function DemoSeedCopyBlock(props: { className?: string; intro?: string }) {
  return (
    <div className={props.className}>
      {props.intro ? <p className="text-xs text-zinc-600">{props.intro}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <code className="max-w-full break-all rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-mono text-[11px] text-zinc-800">
          {INVOICE_AUDIT_DEMO_SEED_CLI}
        </code>
        <CopyTextButton text={INVOICE_AUDIT_DEMO_SEED_CLI} label="Copy command" copiedLabel="Command copied" />
      </div>
    </div>
  );
}
