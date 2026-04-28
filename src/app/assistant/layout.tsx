import { AccessDenied } from "@/components/access-denied";
import { AssistantSubnav } from "@/components/assistant/assistant-subnav";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function AssistantLayout({ children }: { children: React.ReactNode }) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Assistant"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }
  const canCt = viewerHas(access.grantSet, "org.controltower", "view");
  const canOrders = viewerHas(access.grantSet, "org.orders", "view");
  const canProducts = viewerHas(access.grantSet, "org.products", "view");
  const canSuppliers = viewerHas(access.grantSet, "org.suppliers", "view");
  const canWms = viewerHas(access.grantSet, "org.wms", "view");
  const canTariffs = viewerHas(access.grantSet, "org.tariffs", "view");
  const canRfq = viewerHas(access.grantSet, "org.rfq", "view");
  const canInvoiceAudit = viewerHas(access.grantSet, "org.invoice_audit", "view");
  const canApiHub = viewerHas(access.grantSet, "org.apihub", "view");
  const canRisk = viewerHas(access.grantSet, "org.scri", "view");
  const canSettings = viewerHas(access.grantSet, "org.settings", "view");
  const canReports = viewerHas(access.grantSet, "org.reports", "view");
  if (
    !canCt &&
    !canOrders &&
    !canProducts &&
    !canSuppliers &&
    !canWms &&
    !canTariffs &&
    !canRfq &&
    !canInvoiceAudit &&
    !canApiHub &&
    !canRisk &&
    !canSettings &&
    !canReports
  ) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Assistant"
          message="You need at least one operational view grant to use the assistant workspace."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Assistant</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-600">
          <strong>Chat</strong> can draft sales orders and answer stock / product-trace questions with links to
          evidence. <strong>Order orchestration</strong> is AMP13 for demand-to-promise planning with ATP and approval controls.{" "}
          <strong>Warehouse capacity</strong> is AMP15 for WMS bottlenecks, labor recovery, and supervisor-approved recovery work.{" "}
          <strong>Exception center</strong> is AMP17 for cross-module incident rooms, blast radius, playbooks, and root-cause closure.{" "}
          <strong>Customer intelligence</strong> is AMP18 for account service briefs and customer-ready replies.{" "}
          <strong>Finance control</strong> is AMP19 for leakage, disputes, accruals, and accounting handoff review.{" "}
          <strong>Risk war room</strong> is AMP20 for external event triage, Twin scenarios, mitigations, and communication drafts.{" "}
          <strong>Master data</strong> is AMP21 for duplicate, gap, stale-record, and integration hygiene review.{" "}
          <strong>Planning</strong> is AMP22 for constrained S&OP scenarios across demand, supply, inventory, WMS, and transport.{" "}
          <strong>Contracts</strong> is AMP23 for obligations, renewal risk, supplier documents, RFQs, and tariff compliance.{" "}
          <strong>Sustainability</strong> is AMP24 for emissions estimates, ESG data gaps, greener options, and approved reporting packets.{" "}
          <strong>Partners</strong> is AMP25 for connector readiness, portal scope, mapping review, and ecosystem launch approvals.{" "}
          <strong>Frontline</strong> is AMP26 for mobile WMS, delivery exception, supplier task, evidence, and offline quick-action review.{" "}
          <strong>Meetings</strong> is AMP27 for call notes, transcript-style inputs, redaction, actions, risks, decisions, and minutes review.{" "}
          <strong>Observability</strong> is AMP28 for assistant health, drift, degraded mode, rollback, and incident postmortems.{" "}
          <strong>Governance</strong> is AMP29 for retention dry-runs, privacy-safe exports, deletion review, and legal-hold controls.{" "}
          <strong>Rollout</strong> is AMP30 for tenant templates, role grants, module flags, seed packs, launch review, and rollback plans.{" "}
          <strong>Value</strong> is AMP31 for adoption, savings, service impact, ROI assumptions, and role-safe reports.{" "}
          <strong>Loop</strong> is AMP32 for governed observe/decide/act/learn cycles with policy, outcome, and rollback oversight.{" "}
          <strong>Workbench</strong> is the LMP1-LMP10 cockpit for sales, products, suppliers, POs, and
          shipments. <strong>Execution</strong> runs LMP11-LMP30 across carrier/customer comms, WMS, finance, quality,
          and simulation readiness. <strong>Work engine</strong> is AMP6 for assigned actions, SLA playbooks, and memory cleanup.{" "}
          <strong>Evidence quality</strong> is AMP7 for grounding, review examples, prompt starters, and release gates.{" "}
          <strong>Governed automation</strong> is AMP8 for shadow policies, controlled enablement, pause, and rollback.{" "}
          <strong>Admin</strong> is AMP11 for rollout controls, permissions visibility, thresholds, and compliance packets.{" "}
          <strong>Operating system</strong> is AMP12 for customer demo runbooks and board-ready reports.{" "}
          <strong>Autonomy</strong> completes LMP31-LMP50 with governed automation, twin
          readiness, rollout, resilience, and board reporting. <strong>Inbox</strong> includes Control Tower, drafts, and open email.{" "}
          <strong>Command center</strong> shows audit, feedback, queued actions, playbooks, and health.
        </p>
        <AssistantSubnav />
        {children}
      </div>
    </div>
  );
}
