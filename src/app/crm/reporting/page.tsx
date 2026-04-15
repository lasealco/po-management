import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function CrmReportingPage() {
  const access = await getViewerGrantSet();

  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="CRM reporting" message="Choose an active user in the header." />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.crm", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied title="CRM reporting" message="You do not have CRM view access." />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <nav className="mb-4 text-xs text-zinc-500">
        <Link href="/crm" className="text-violet-800 hover:underline">
          CRM
        </Link>
        <span className="mx-1">/</span>
        <span className="text-zinc-700">Reporting</span>
      </nav>
      <h1 className="text-2xl font-semibold text-zinc-900">CRM reporting</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">
        CRM-specific charts and saved definitions will live here as we connect the shared reporting engine. Until then, use
        the global reporting hub and — where relevant — Control Tower for shipment-linked customer metrics.
      </p>
      <ul className="mt-6 space-y-3 text-sm">
        <li>
          <Link href="/reporting?focus=crm" className="font-medium text-violet-800 hover:underline">
            All reporting modules →
          </Link>
        </li>
        <li>
          <Link href="/crm/pipeline" className="font-medium text-violet-800 hover:underline">
            Pipeline board (operational)
          </Link>
        </li>
        <li>
          <Link href="/control-tower/reports" className="font-medium text-sky-800 hover:underline">
            Control Tower report builder (logistics)
          </Link>
        </li>
      </ul>
    </main>
  );
}
