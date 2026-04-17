import Link from "next/link";

import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { ControlTowerNewShipment } from "@/components/control-tower-new-shipment";
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
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 1000,
    }),
    prisma.crmAccount.findMany({
      where: { tenantId: tenant.id, lifecycle: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, legalName: true },
      take: 1000,
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Control Tower</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">New logistics shipment</h1>
        <p className="mt-2 text-sm text-zinc-600">
          For when carrier or forwarder data is not integrated yet: create the shipment from a PO, set mode and
          optional booking fields, and optionally apply a mode-specific milestone template once.
        </p>
      </header>
      <ControlTowerNewShipment suppliers={suppliers} crmAccounts={crmAccounts} />
    </main>
  );
}
