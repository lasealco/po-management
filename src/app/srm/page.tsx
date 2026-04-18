import Link from "next/link";

import { ActionLink } from "@/components/action-button";
import { AccessDenied } from "@/components/access-denied";
import { SupplierKindTabs, type SupplierSrmKind } from "@/components/supplier-kind-tabs";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import {
  buildSupplierDirectoryExtraQuery,
  parseDirectoryActive,
  parseDirectoryApproval,
  parseDirectoryKind,
  parseDirectorySearchQ,
  parseDirectorySort,
  supplierDirectoryOrderBy,
  supplierDirectoryWhere,
} from "@/lib/srm/supplier-directory-list";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatUpdated(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function SrmPage({
  searchParams,
}: {
  searchParams?: Promise<{
    kind?: string | string[];
    q?: string | string[];
    approval?: string | string[];
    active?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const kind: SupplierSrmKind = parseDirectoryKind(sp.kind);
  const q = parseDirectorySearchQ(sp.q);
  const approval = parseDirectoryApproval(sp.approval);
  const active = parseDirectoryActive(sp.active);
  const sort = parseDirectorySort(sp.sort);

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

  if (!viewerHas(access.grantSet, "org.suppliers", "view")) {
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
    where: supplierDirectoryWhere(tenant.id, kind, q, approval, active),
    orderBy: supplierDirectoryOrderBy(sort),
    select: {
      id: true,
      name: true,
      code: true,
      email: true,
      phone: true,
      isActive: true,
      srmCategory: true,
      approvalStatus: true,
      updatedAt: true,
      _count: { select: { orders: true, contacts: true, offices: true } },
    },
  });

  const rows = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    email: s.email,
    phone: s.phone,
    isActive: s.isActive,
    updatedAt: s.updatedAt,
    orderCount: s._count.orders,
    contactCount: s._count.contacts,
    officeCount: s._count.offices,
    srmCategory: s.srmCategory === "logistics" ? ("logistics" as const) : ("product" as const),
    approvalStatus:
      s.approvalStatus === "pending_approval"
        ? ("pending_approval" as const)
        : s.approvalStatus === "rejected"
          ? ("rejected" as const)
          : ("approved" as const),
  }));

  const canEdit = viewerHas(access.grantSet, "org.suppliers", "edit");
  const canApprove = viewerHas(access.grantSet, "org.suppliers", "approve");

  const listExtraQuery = buildSupplierDirectoryExtraQuery({
    q,
    approval,
    active,
    sort,
  });

  const hasListFilters = Boolean(q) || approval !== "all" || active !== "all" || sort !== "name";

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <SupplierKindTabs active={kind} basePath="/srm" extraQuery={listExtraQuery} />

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

          <form
            method="get"
            className="mt-6 flex flex-col gap-4"
            role="search"
            aria-label="Filter suppliers"
          >
            <input type="hidden" name="kind" value={kind} />
            <div className="flex max-w-4xl flex-wrap items-end gap-3">
              <label className="flex min-w-[12rem] flex-1 flex-col text-sm">
                <span className="font-medium text-zinc-700">Search name or code</span>
                <input
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="e.g. Acme or SUP-001"
                  className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                  autoComplete="off"
                />
              </label>
              <label className="flex min-w-[9rem] flex-col text-sm">
                <span className="font-medium text-zinc-700">Approval</span>
                <select
                  name="approval"
                  defaultValue={approval}
                  className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
              <label className="flex min-w-[9rem] flex-col text-sm">
                <span className="font-medium text-zinc-700">Activation</span>
                <select
                  name="active"
                  defaultValue={active}
                  className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </label>
              <label className="flex min-w-[10rem] flex-col text-sm">
                <span className="font-medium text-zinc-700">Sort by</span>
                <select
                  name="sort"
                  defaultValue={sort}
                  className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="name">Name (A–Z)</option>
                  <option value="code">Code (A–Z)</option>
                  <option value="updated">Recently updated</option>
                </select>
              </label>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Apply
              </button>
              {hasListFilters ? (
                <Link
                  href={`/srm?kind=${kind}`}
                  className="rounded-md px-3 py-2 text-sm text-zinc-600 underline hover:text-zinc-900"
                >
                  Clear filters
                </Link>
              ) : null}
            </div>
          </form>

          <section className="mt-8 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3 text-center">People</th>
                  <th className="px-4 py-3 text-center">Sites</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-center">Orders</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-900">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-600">
                      {q || approval !== "all" || active !== "all"
                        ? "No suppliers match these filters."
                        : "No suppliers in this category yet."}
                    </td>
                  </tr>
                ) : null}
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">{s.code ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {[s.email, s.phone].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-zinc-600">
                      {s.contactCount}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-zinc-600">
                      {s.officeCount}
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
                    <td className="px-4 py-3 text-center tabular-nums">{s.orderCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-600">
                      {formatUpdated(s.updatedAt)}
                    </td>
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

          {!canEdit ? <p className="mt-8 text-sm text-zinc-500">View-only for your role.</p> : null}
        </div>
      </main>
    </div>
  );
}
