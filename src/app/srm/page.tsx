import Link from "next/link";

import { ActionLink } from "@/components/action-button";
import { AccessDenied } from "@/components/access-denied";
import { SupplierKindTabs } from "@/components/supplier-kind-tabs";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseSrmListQuery } from "@/lib/srm/list-query";
import { resolveSrmPermissions } from "@/lib/srm/permissions";

export const dynamic = "force-dynamic";

export default async function SrmPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string | string[]; q?: string | string[] }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const { kind, q } = parseSrmListQuery(sp);

  const access = await getViewerGrantSet();

  if (!access) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  if (!access.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="SRM"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }

  const permissions = resolveSrmPermissions(access.grantSet);

  if (!permissions.canViewSuppliers) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="SRM"
          message="You do not have permission to view supplier data (org.suppliers → view)."
        />
      </div>
    );
  }

  const { tenant } = access;

  const suppliers = await prisma.supplier.findMany({
    where: {
      tenantId: tenant.id,
      srmCategory: kind === "logistics" ? "logistics" : "product",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      email: true,
      phone: true,
      isActive: true,
      srmCategory: true,
      approvalStatus: true,
      ...(permissions.canViewOrders ? { _count: { select: { orders: true } } } : {}),
    },
  });

  const rows = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    email: s.email,
    phone: s.phone,
    isActive: s.isActive,
    orderCount: permissions.canViewOrders && "_count" in s ? s._count.orders : null,
    srmCategory: s.srmCategory === "logistics" ? "logistics" as const : "product" as const,
    approvalStatus:
      s.approvalStatus === "pending_approval"
        ? ("pending_approval" as const)
        : s.approvalStatus === "rejected"
          ? ("rejected" as const)
          : ("approved" as const),
  }));

  const canEdit = permissions.canEditSuppliers;
  const canApprove = permissions.canApproveSuppliers;
  const canViewOrders = permissions.canViewOrders;

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <SupplierKindTabs active={kind} basePath="/srm" />

        <div className="rounded-b-lg rounded-tr-lg border border-t-0 border-zinc-200 bg-white px-6 py-8">
          <WorkflowHeader
            eyebrow="Supplier relationship management"
            title={kind === "logistics" ? "Forwarders, carriers, and logistics partners" : "Product suppliers"}
            description={`Manage supplier master data directly in SRM: company profile, addresses, contacts, and commercial terms.${kind === "logistics" ? " This is the source of truth for forwarders/carriers used by bookings and shipments." : ""}`}
            steps={["Step 1: Review supplier list", "Step 2: Create or update partner profile", "Step 3: Approve and activate"]}
            className="border-0 bg-transparent p-0 shadow-none"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {canEdit ? <ActionLink href={`/srm/new?kind=${kind}`}>Create new partner</ActionLink> : null}
            <Link href={`/suppliers?kind=${kind}`} className="text-sm text-zinc-600 underline hover:text-zinc-900">
              Open legacy supplier directory view
            </Link>
          </div>

          <section className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <form method="get" className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="kind" value={kind} />
              <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Search partners</span>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search by name, code, or email"
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 shadow-sm outline-none focus:border-[var(--arscmp-primary)] focus:ring-2 focus:ring-[var(--arscmp-primary)]/20"
                />
              </label>
              <button
                type="submit"
                className="h-10 rounded-lg bg-[var(--arscmp-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95"
              >
                Search
              </button>
              {q ? (
                <Link href={`/srm?kind=${kind}`} className="h-10 rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
                  Reset
                </Link>
              ) : null}
            </form>
          </section>

          {rows.length > 0 ? (
            <>
            <section className="mt-8 hidden overflow-x-auto rounded-lg border border-zinc-200 md:block">
              <table className="min-w-full divide-y divide-zinc-200 text-sm">
                <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Approval</th>
                    <th className="px-4 py-3">Status</th>
                    {canViewOrders ? <th className="px-4 py-3 text-center">Orders</th> : null}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-900">
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-600">{s.code ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {[s.email, s.phone].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.approvalStatus === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : s.approvalStatus === "pending_approval"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {s.approvalStatus === "pending_approval"
                            ? "Pending"
                            : s.approvalStatus === "approved"
                              ? "Approved"
                              : "Rejected"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.isActive ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"
                          }`}
                        >
                          {s.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {canViewOrders ? <td className="px-4 py-3 text-center tabular-nums">{s.orderCount}</td> : null}
                      <td className="px-4 py-3">
                        <Link href={`/srm/${s.id}`} className="font-medium text-[var(--arscmp-primary)] hover:underline">
                          {canEdit || canApprove ? "Open profile" : "View profile"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <ul className="mt-8 space-y-3 md:hidden">
              {rows.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <p className="font-semibold text-zinc-900">{s.name}</p>
                  <p className="mt-1 font-mono text-xs text-zinc-600">{s.code ?? "—"}</p>
                  <p className="mt-2 text-xs text-zinc-600">
                    {[s.email, s.phone].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        s.approvalStatus === "approved"
                          ? "bg-emerald-100 text-emerald-800"
                          : s.approvalStatus === "pending_approval"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {s.approvalStatus === "pending_approval"
                        ? "Pending"
                        : s.approvalStatus === "approved"
                          ? "Approved"
                          : "Rejected"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        s.isActive ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"
                      }`}
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                    {canViewOrders ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 tabular-nums text-zinc-700">
                        {s.orderCount} orders
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/srm/${s.id}`}
                    className="mt-4 inline-flex text-sm font-semibold text-[var(--arscmp-primary)] hover:underline"
                  >
                    {canEdit || canApprove ? "Open profile" : "View profile"}
                  </Link>
                </li>
              ))}
            </ul>
            </>
          ) : !q ? (
            <section className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/90 px-6 py-12 text-center shadow-sm">
              <h2 className="text-base font-semibold text-zinc-900">
                No {kind === "logistics" ? "logistics" : "product"} partners yet
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Create your first partner to populate this list. You can add contacts and sites on the
                supplier profile.
              </p>
              {canEdit ? (
                <div className="mt-6">
                  <ActionLink href={`/srm/new?kind=${kind}`}>Create first partner</ActionLink>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">Your role is view-only for supplier master data.</p>
              )}
            </section>
          ) : (
            <section className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-center">
              <h2 className="text-base font-semibold text-zinc-900">No partners match your search</h2>
              <p className="mt-2 text-sm text-zinc-600">
                No {kind === "logistics" ? "logistics" : "product"} partners match
                {q ? ` "${q}"` : " your current filters"}.
              </p>
              <Link href={`/srm?kind=${kind}`} className="mt-4 inline-flex text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
                Reset and show all partners
              </Link>
            </section>
          )}

          {!canViewOrders ? (
            <p className="mt-6 text-sm text-zinc-500">Order metrics are hidden for your role (requires org.orders → view).</p>
          ) : null}
          {!canEdit ? <p className="mt-2 text-sm text-zinc-500">View-only for your role.</p> : null}
        </div>
      </main>
    </div>
  );
}
