import { AccessDenied } from "@/components/access-denied";
import { ControlTowerReportingHubWorkbenchLinks } from "@/components/control-tower-reporting-hub-workbench-links";
import { ProductTraceExplorer } from "@/components/product-trace-explorer";
import {
  getActorUserId,
  getViewerGrantSet,
  userHasGlobalGrant,
  viewerHas,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getProductTracePayload } from "@/lib/product-trace";

export const dynamic = "force-dynamic";

function formatQueryParam(sp: Record<string, string | string[] | undefined>, key: string) {
  const v = sp[key];
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return (v ?? "").trim();
}

export default async function ProductTracePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const q = formatQueryParam(sp, "q");

  const access = await getViewerGrantSet();
  if (!access) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold text-zinc-900">Product trace</h1>
        <p className="mt-4 text-zinc-600">
          Demo data not found. Run <code>npm run db:seed</code> locally, then reload.
        </p>
      </main>
    );
  }

  if (!access.user) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AccessDenied
          title="Product trace"
          message="Choose an active demo user: Settings → Demo session (/settings/demo), then reload this page."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.orders", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <AccessDenied
          title="Product trace"
          message="You do not have permission to view purchase orders (org.orders → view)."
        />
      </div>
    );
  }

  const tenant = await getDemoTenant();
  const actorUserId = await getActorUserId();
  if (!tenant || !actorUserId) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold text-zinc-900">Product trace</h1>
        <p className="mt-4 text-zinc-600">Session or tenant is not available.</p>
      </main>
    );
  }

  const canSeeWms = await userHasGlobalGrant(actorUserId, "org.wms", "view");
  const canSeeCt = viewerHas(access.grantSet, "org.controltower", "view");

  const trace =
    q.length > 0
      ? await getProductTracePayload({
          tenantId: tenant.id,
          actorUserId,
          query: q,
          includeInventory: canSeeWms,
        })
      : null;

  const notFound = trace && !trace.ok && trace.error === "product_not_found";

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Product trace</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Customer-safe view: suppliers, simulated in-transit positions along booking lanes, and warehouse stock
          (when permitted) on a map — then list or tile details below.
        </p>
        {canSeeCt ? (
          <ControlTowerReportingHubWorkbenchLinks className="mt-4 flex flex-wrap gap-4 text-sm" />
        ) : null}
      </header>

      <form method="get" className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="q" className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
            SKU, product code, or product id
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="e.g. SKU-1001"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-[var(--arscmp-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--arscmp-primary)]"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-[var(--arscmp-primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
        >
          Trace
        </button>
      </form>

      {q.length === 0 ? (
        <p className="text-sm text-zinc-600">Enter a SKU or product code to load ordered, in-transit, and stock.</p>
      ) : notFound ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No product matched <span className="font-mono">{q}</span> for this tenant (or it is outside your portal
          scope).
        </p>
      ) : trace && trace.ok ? (
        <ProductTraceExplorer data={trace.data} canSeeCt={canSeeCt} />
      ) : null}
    </main>
  );
}
