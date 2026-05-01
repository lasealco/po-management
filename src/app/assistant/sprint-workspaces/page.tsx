import Link from "next/link";

import { WorkflowHeader } from "@/components/workflow-header";
import { SPRINT_WORKSPACE_ENTRIES } from "@/lib/assistant/sprint-workspaces-catalog";

import { SprintWorkspacesCatalogClient } from "./sprint-workspaces-catalog-client";

export const dynamic = "force-dynamic";

export default function SprintWorkspacesCatalogPage() {
  return (
    <div>
      <p className="text-sm">
        <Link href="/assistant" className="font-medium text-[var(--arscmp-primary)] hover:underline">
          ← Assistant
        </Link>
      </p>

      <div className="mt-4">
        <WorkflowHeader
          eyebrow="Assistant navigator"
          title="Program track"
          description={
            "These labels are a rollout sequence for demo workspaces — not your company’s agile sprint board. " +
            "Sprints 22–24 use friendly names under Operations (Planning, Contracts, Frontline); they appear here too so you can match numbers to screens."
          }
          steps={["Step 1: Search or skim by sprint", "Step 2: Open the workspace", "Step 3: Review packets / evidence as prompted"]}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm text-zinc-700 shadow-sm">
        <p className="font-semibold text-zinc-900">Quick glossary</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5">
          <li>
            <strong className="text-zinc-800">Operations modules</strong> — short names for day-to-day domains (hover a chip for AMP / sprint hints).
          </li>
          <li>
            <strong className="text-zinc-800">Program track</strong> — this numbered list (Sprint 1–25); one URL per row.
          </li>
          <li>
            <strong className="text-zinc-800">Advanced programs</strong> — separate AMP review-packet catalog for deep dives.
          </li>
        </ul>
      </section>

      <SprintWorkspacesCatalogClient entries={SPRINT_WORKSPACE_ENTRIES} />
    </div>
  );
}
