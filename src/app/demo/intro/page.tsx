import type { Metadata } from "next";

import { DemoIntroFooterNav, DemoIntroShell } from "@/components/demo-intro-shell";
import { WorkflowHeader } from "@/components/workflow-header";
import { DEMO_INTRO_PATH } from "@/lib/marketing-public-paths";

export const metadata: Metadata = {
  title: "NEOLINK — Guided demo (1 of 2)",
  description: "Quick orientation to NEOLINK before exploring the live demo tenant.",
  alternates: { canonical: DEMO_INTRO_PATH },
};

export default function DemoIntroPageOne() {
  return (
    <DemoIntroShell step={1}>
      <WorkflowHeader
        eyebrow="Guided demo"
        title="Welcome — what you are about to see"
        description="Two short screens to frame the walkthrough. Everything below reflects this repository’s demo scope; swap copy anytime as your story tightens."
        steps={["Step 1: Orientation (this page)", "Step 2: Highlights & deep links", "Step 3: Live tenant via demo session"]}
      />

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Unified ops</p>
          <h2 className="mt-2 text-base font-semibold text-zinc-900">One canvas for procurement & logistics</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Purchase orders, shipment execution, warehouse moves, and CRM accounts share the same tenant so
            teams stop reconciling spreadsheets across siloed tools.
          </p>
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Decision-ready</p>
          <h2 className="mt-2 text-base font-semibold text-zinc-900">Reporting built on real workflows</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Executive and reporting hubs summarize throughput and risk. Tariff, RFQ, pricing snapshots, and
            invoice audit threads plug in where your rollout enables them.
          </p>
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Governed automation</p>
          <h2 className="mt-2 text-base font-semibold text-zinc-900">Assistants that queue human approval</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Assistant workspaces draft work and surface exceptions; approvals and audit trails stay with the
            operators who own the outcome.
          </p>
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Presenter tip</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700">
          Start from{" "}
          <strong className="font-semibold text-zinc-900">Settings → Demo session</strong> with the seeded
          superuser when you need full module visibility, then use{" "}
          <strong className="font-semibold text-zinc-900">Platform hub</strong> as your launch pad between areas.
        </p>
      </section>

      <DemoIntroFooterNav step={1} />
    </DemoIntroShell>
  );
}
