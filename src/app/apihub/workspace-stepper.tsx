"use client";

import Link from "next/link";

const STEPS = [
  { n: 1, label: "Demo", hash: "demo-sync" },
  { n: 2, label: "Runs", hash: "ingestion-ops" },
  { n: 3, label: "Alerts", hash: "ingestion-alerts" },
  { n: 4, label: "Conflicts", hash: "apply-conflicts" },
  { n: 5, label: "Analysis", hash: "mapping-analysis-jobs" },
  { n: 6, label: "Templates", hash: "mapping-templates" },
  { n: 7, label: "Preview", hash: "mapping-preview-export" },
  { n: 8, label: "Staging", hash: "staging-batches" },
  { n: 9, label: "Connectors", hash: "connectors" },
] as const;

const BASE = "/apihub/workspace";

export function ApihubWorkspaceStepper() {
  return (
    <nav aria-label="Workspace sections" className="mb-8 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Manual operator path</p>
      <p className="mt-1 text-sm text-zinc-600">
        Step through the console in order, or jump ahead. Prefer a guided flow? Start at{" "}
        <Link href="/apihub" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          Guided import
        </Link>
        .
      </p>
      <ol className="mt-4 flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <li key={s.hash}>
            <Link
              href={`${BASE}#${s.hash}`}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 hover:border-[var(--arscmp-primary)] hover:bg-white"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--arscmp-primary)] text-xs font-semibold text-white">
                {s.n}
              </span>
              {s.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
