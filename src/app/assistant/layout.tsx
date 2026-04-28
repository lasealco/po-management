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
    !canRisk
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
          evidence. <strong>Workbench</strong> is the LMP1-LMP10 cockpit for sales, products, suppliers, POs, and
          shipments. <strong>Execution</strong> runs LMP11-LMP30 across carrier/customer comms, WMS, finance, quality,
          and simulation readiness. <strong>Work engine</strong> is AMP6 for assigned actions, SLA playbooks, and memory cleanup.{" "}
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
