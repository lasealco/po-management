import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { WmsHomeOverview } from "@/components/wms-home-overview";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function WmsReportingPage() {
  const access = await getViewerGrantSet();
  const tenant = await getDemoTenant();

  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="WMS reporting" message="Choose an active user in the header." />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.wms", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="WMS reporting" message="You do not have WMS view access." />
      </div>
    );
  }
  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Tenant not found.</p>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/wms" className="text-violet-800 hover:underline">
          WMS
        </Link>
        <span className="mx-1">/</span>
        <span className="text-zinc-700">Reporting</span>
      </nav>
      <h1 className="text-2xl font-semibold text-zinc-900">WMS reporting</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">
        Warehouse throughput, stock, and billing analytics will plug into the same reporting layer. Stock and operations
        screens remain the day-to-day operational home.
      </p>
      <WmsHomeOverview tenantId={tenant.id} />
      <ul className="mt-6 space-y-3 text-sm">
        <li>
          <Link href="/reporting?focus=wms" className="font-medium text-violet-800 hover:underline">
            All reporting modules →
          </Link>
        </li>
        <li>
          <Link href="/wms/stock" className="font-medium text-violet-800 hover:underline">
            Stock & ledger
          </Link>
        </li>
        <li>
          <Link href="/wms/operations" className="font-medium text-violet-800 hover:underline">
            Operations
          </Link>
        </li>
        <li>
          <Link href="/control-tower/reports" className="font-medium text-sky-800 hover:underline">
            Control Tower report builder (inbound/outbound logistics)
          </Link>
        </li>
      </ul>
    </main>
  );
}
