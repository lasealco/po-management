import Link from "next/link";

import { ControlTowerNewShipment } from "@/components/control-tower-new-shipment";
import { ControlTowerReportingHubWorkbenchLinks } from "@/components/control-tower-reporting-hub-workbench-links";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ControlTowerNewShipmentPage() {
  const access = await getViewerGrantSet();
  const canEdit = Boolean(
    access?.user && viewerHas(access.grantSet, "org.controltower", "edit"),
  );

  if (!canEdit) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="text-sm text-zinc-700">You do not have permission to create logistics shipments.</p>
        <Link href="/control-tower/workbench" className="mt-4 inline-block text-sm text-sky-800 underline">
          Back to workbench
        </Link>
      </main>
    );
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="text-sm text-zinc-700">Tenant not found.</p>
        <Link href="/control-tower/workbench" className="mt-4 inline-block text-sm text-sky-800 underline">
          Back to workbench
        </Link>
      </main>
    );
  }

  const [suppliers, crmAccounts] = await Promise.all([
    prisma.supplier.findMany({
      where: { tenantId: tenant.id, isActive: true, productSuppliers: { none: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 1000,
    }),
    prisma.crmAccount.findMany({
      where: { tenantId: tenant.id, lifecycle: "ACTIVE", accountType: "CUSTOMER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, legalName: true },
      take: 1000,
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8">
        <div className="mb-4">
          <ControlTowerReportingHubWorkbenchLinks className="flex flex-wrap gap-4 text-sm" />
        </div>
        <WorkflowHeader
          eyebrow="Control Tower"
          title="New booking request"
          description="Start in booking draft: capture order context, mode, routing, and parties. From Shipment 360 you send the booking to the forwarder; after confirmation, legs, milestones, and KPIs apply."
          steps={[
            "Step 1: Order or export parties",
            "Step 2: Mode and booking draft",
            "Step 3: Create draft, then send from Shipment 360",
          ]}
        />
      </header>
      <ControlTowerNewShipment suppliers={suppliers} crmAccounts={crmAccounts} />
    </main>
  );
}
