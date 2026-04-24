import Link from "next/link";

import { getActorUserId } from "@/lib/authz";
import { buildControlTowerDigest } from "@/lib/control-tower/customer-digest";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";
import { controlTowerWorkbenchPath } from "@/lib/control-tower/workbench-url-sync";
import { ControlTowerReportingHubWorkbenchLinks } from "@/components/control-tower-reporting-hub-workbench-links";
import { getDemoTenant } from "@/lib/demo-tenant";

import { ControlTowerDigestExportCsvButton } from "./digest-export-csv-button";

export const dynamic = "force-dynamic";

function fmtEta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default async function ControlTowerDigestPage() {
  const tenant = await getDemoTenant();
  const actorId = await getActorUserId();
  if (!tenant || !actorId) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <p className="text-sm text-zinc-600">Digest is unavailable for this session.</p>
      </main>
    );
  }
  const ctx = await getControlTowerPortalContext(actorId);
  const digest = await buildControlTowerDigest({
    tenantId: tenant.id,
    ctx,
    actorUserId: actorId,
  });
  const csvRows = digest.items.map((row) => ({
    id: row.id,
    shipmentNo: row.shipmentNo,
    status: row.status,
    originCode: row.originCode,
    destinationCode: row.destinationCode,
    eta: row.eta,
    milestoneCode: row.latestMilestone?.code ?? null,
    milestoneHasActual: row.latestMilestone ? row.latestMilestone.hasActual : null,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Shipment digest</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Lightweight list of the most recently updated shipments in your scope (same data as{" "}
            <code className="rounded bg-zinc-100 px-1">GET /api/control-tower/customer/digest</code>
            ). Open Shipment 360 for full detail.
            {digest.view.restricted
              ? " Customer or supplier portal views only see shipments allowed for your account."
              : " Internal users see the full tenant pipeline (still capped per load). The Digest item is omitted from the top nav for internal sessions — use this URL, the command palette (⌘K / Ctrl+K) → “shipment digest”, Reporting hub → Control Tower, the workbench, or Help → Control Tower."}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Generated {new Date(digest.generatedAt).toLocaleString()} · {digest.itemCount} row
            {digest.itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <ControlTowerDigestExportCsvButton
          rows={csvRows}
          digestLimit={digest.digestLimit}
          itemCount={digest.itemCount}
          truncated={digest.truncated}
          generatedAt={digest.generatedAt}
        />
      </header>

      {digest.truncated ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Showing the most recent <strong>{digest.digestLimit}</strong> shipments; older updates are not listed here.{" "}
          <Link href={controlTowerWorkbenchPath({})} className="font-medium text-sky-800 underline">
            Open workbench
          </Link>{" "}
          for filters, search, and workbench CSV export. This page can still <strong>Download CSV</strong> for the
          visible digest rows.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Shipment</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Route</th>
              <th className="px-3 py-2">ETA</th>
              <th className="px-3 py-2">Latest milestone</th>
              <th className="px-3 py-2 text-right">360</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {digest.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  No shipments in this scope.
                </td>
              </tr>
            ) : (
              digest.items.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50/80">
                  <td className="px-3 py-2 font-medium text-zinc-900">
                    {row.shipmentNo?.trim() || row.id.slice(0, 8) + "…"}
                  </td>
                  <td className="px-3 py-2 text-zinc-700">{row.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2 text-zinc-600">
                    {(row.originCode || "—") + " → " + (row.destinationCode || "—")}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{fmtEta(row.eta)}</td>
                  <td className="px-3 py-2 text-zinc-600">
                    {row.latestMilestone ? (
                      <>
                        {row.latestMilestone.code}
                        {row.latestMilestone.hasActual ? (
                          <span className="ml-1 text-xs text-emerald-700">(actual)</span>
                        ) : (
                          <span className="ml-1 text-xs text-zinc-400">(planned)</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/control-tower/shipments/${row.id}`}
                      className="font-medium text-sky-800 hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <nav className="mt-8 flex flex-wrap gap-6 border-t border-zinc-200 pt-6 text-sm text-zinc-700">
        <ControlTowerReportingHubWorkbenchLinks
          noWrapper
          reportingLabel="Reporting hub — Control Tower"
          workbenchLabel="Tracking workbench"
        />
        <Link href="/control-tower" className="font-medium text-sky-800 hover:underline">
          Control Tower home
        </Link>
      </nav>
    </main>
  );
}
