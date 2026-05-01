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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Assistant</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">
          Governed assistant workspaces are grouped below: core tools, everyday operations chips, a searchable{" "}
          <strong className="text-zinc-800">program track</strong> (numbered demo rollout — not your Jira sprints), and an{" "}
          <strong className="text-zinc-800">advanced programs</strong> catalog for AMP review packets. Chat needs orders
          view; other tabs depend on grants — hover any chip for its full title.
        </p>
        <section className="mt-4 max-w-3xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">How this navigator is organized</p>
          <ul className="mt-2 space-y-2 text-sm text-zinc-600">
            <li>
              <span className="font-semibold text-zinc-800">Core &amp; cockpit</span> — Chat, inbox, mail pilot,
              workbenches, evidence, automation, admin.
            </li>
            <li>
              <span className="font-semibold text-zinc-800">Operations modules</span> — Short labels for frequent
              domains. Planning / Contracts / Frontline match Sprint 22–24 on the program track.
            </li>
            <li>
              <span className="font-semibold text-zinc-800">Program track</span> — One catalog link opens Sprint 1–25 with
              plain-language names and search (fills gaps like missing Sprint numbers in the old chip strip).
            </li>
            <li>
              <span className="font-semibold text-zinc-800">Advanced programs</span> — Large AMP packet list for deep,
              evidence-first reviews (different numbering from the sprint track).
            </li>
          </ul>
        </section>
        <AssistantSubnav />
        {children}
      </div>
    </div>
  );
}
