import type { Metadata } from "next";
import Link from "next/link";

import { DemoIntroFooterNav, DemoIntroShell } from "@/components/demo-intro-shell";
import { WorkflowHeader } from "@/components/workflow-header";
import { DEMO_INTRO_HIGHLIGHTS_PATH } from "@/lib/marketing-public-paths";

export const metadata: Metadata = {
  title: "NEOLINK — Guided demo highlights (2 of 2)",
  description: "Feature highlights and entry-point links for the NEOLINK demo.",
  alternates: { canonical: DEMO_INTRO_HIGHLIGHTS_PATH },
};

type Highlight = {
  href: string;
  title: string;
  blurb: string;
};

const HIGHLIGHTS: Highlight[] = [
  {
    href: "/orders",
    title: "PO management",
    blurb: "Queues, approvals, supplier messaging, splits, and fulfillment telemetry tied to catalog products.",
  },
  {
    href: "/sales-orders",
    title: "Sales orders",
    blurb: "Demand-side lifecycle from draft through fulfillment readiness with CRM-aligned customer context.",
  },
  {
    href: "/control-tower",
    title: "Control Tower",
    blurb: "Shipment workspaces, milestones, exceptions, and operational command views across modes.",
  },
  {
    href: "/wms",
    title: "Warehouse & fulfillment",
    blurb: "Inventory, tasks, operations consoles, and billing hooks for high-volume DC demos.",
  },
  {
    href: "/crm",
    title: "CRM",
    blurb: "Accounts, pipeline, and revenue motions when commercial teams join the same tenant.",
  },
  {
    href: "/srm",
    title: "Supplier Relationship Management",
    blurb: "Supplier 360, onboarding checklist, capabilities, compliance tabs, and governance workspace.",
  },
  {
    href: "/assistant",
    title: "Assistant hub",
    blurb: "Natural-language drafting, sprint workspaces, inbox routing, and governed follow-up queues.",
  },
  {
    href: "/tariffs",
    title: "Tariff & commercial engine",
    blurb: "Contracts, geography, imports, lane rating, RFQ comparisons, snapshots, and invoice audit entry.",
  },
  {
    href: "/consolidation",
    title: "Consolidation & finance signals",
    blurb: "Cross-order lenses where finance and ops teams reconcile exposure during the storyline.",
  },
  {
    href: "/reporting",
    title: "Reporting & analytics",
    blurb: "Module-spanning KPI hub plus executive summaries when leadership joins the session.",
  },
];

export default function DemoIntroHighlightsPage() {
  return (
    <DemoIntroShell step={2}>
      <WorkflowHeader
        eyebrow="Guided demo"
        title="Highlights you can click through"
        description="Each tile jumps to the live module after you sign in or choose a demo user. Use this page as a scripted agenda — reorder rows to match your narrative."
      />

      <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
        Not signed in yet? Open{" "}
        <Link href="/settings/demo" className="font-semibold text-[var(--arscmp-primary)] underline-offset-2 hover:underline">
          Settings → Demo session
        </Link>{" "}
        first; module links below respect role grants from that session.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {HIGHLIGHTS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-[var(--arscmp-primary)]/40 hover:shadow-md"
            >
              <span className="text-base font-semibold text-zinc-900">{item.title}</span>
              <span className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">{item.blurb}</span>
              <span className="mt-4 text-sm font-semibold text-[var(--arscmp-primary)]">
                Open {item.href} →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <DemoIntroFooterNav step={2} />
    </DemoIntroShell>
  );
}
