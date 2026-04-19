import Link from "next/link";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { listQuoteRequestsForTenant } from "@/lib/rfq/quote-requests";
import { getDemoTenant } from "@/lib/demo-tenant";

export const dynamic = "force-dynamic";

export default async function RfqRequestsListPage() {
  const tenant = await getDemoTenant();
  const access = await getViewerGrantSet();
  const canEdit = Boolean(access?.user && viewerHas(access.grantSet, "org.rfq", "edit"));

  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-zinc-600">Tenant not found.</p>
      </main>
    );
  }

  const requests = await listQuoteRequestsForTenant({ tenantId: tenant.id, take: 200 });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Ocean procurement</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Quote requests (RFQ)</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600">
              Ad hoc lane pricing: invite logistics partners, collect structured quotes, compare totals, validity,
              charges, and free time.
            </p>
          </div>
          {canEdit ? (
            <Link
              href="/rfq/requests/new"
              className="rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95"
            >
              New RFQ
            </Link>
          ) : null}
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Request id</th>
                <th className="py-2 pr-4">Lane</th>
                <th className="py-2 pr-4">Mode</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Recipients</th>
                <th className="py-2 pr-4">Updated</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-500">
                    No RFQs yet.
                    {canEdit ? (
                      <>
                        {" "}
                        <Link href="/rfq/requests/new" className="font-medium text-[var(--arscmp-primary)] hover:underline">
                          Create one
                        </Link>
                        .
                      </>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100">
                  <td className="py-3 pr-4">
                    <Link href={`/rfq/requests/${r.id}`} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 align-top">
                    <RecordIdCopy id={r.id} copyButtonLabel="Copy request id" />
                  </td>
                  <td className="max-w-xs py-3 pr-4 text-xs text-zinc-600">
                    {r.originLabel} → {r.destinationLabel}
                  </td>
                  <td className="py-3 pr-4 text-xs">{r.transportMode}</td>
                  <td className="py-3 pr-4 text-xs font-medium text-zinc-800">{r.status}</td>
                  <td className="py-3 pr-4 text-xs text-zinc-600">
                    {r._count.recipients} / {r._count.responses} quotes
                  </td>
                  <td className="py-3 pr-4 text-xs text-zinc-500">{r.updatedAt.toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
