import Link from "next/link";

import { ActionLink } from "@/components/action-button";
import { AccessDenied } from "@/components/access-denied";
import { SupplierKindTabs, type SupplierSrmKind } from "@/components/supplier-kind-tabs";
import { WorkflowHeader } from "@/components/workflow-header";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function parseKind(raw: string | string[] | undefined): SupplierSrmKind {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "logistics" ? "logistics" : "product";
}

function parseSearchQ(raw: string | string[] | undefined): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (v ?? "").trim().slice(0, 120);
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string | string[]; q?: string | string[] }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const kind = parseKind(sp.kind);
  const q = parseSearchQ(sp.q);

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
          title="Suppliers"
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.suppliers", "view")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Suppliers"
          message="You do not have permission to view suppliers (org.suppliers → view)."
        />
      </div>
    );
  }

  const { tenant } = access;
  const canEdit = viewerHas(access.grantSet, "org.suppliers", "edit");
  const canApprove = viewerHas(access.grantSet, "org.suppliers", "approve");

  const suppliers = await prisma.supplier.findMany({
    where: {
      tenantId: tenant.id,
      srmCategory: kind === "logistics" ? "logistics" : "product",
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { code: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          offices: true,
          productSuppliers: true,
          orders: true,
          shipmentBookings: true,
        },
      },
    },
  });

  const title =
    kind === "logistics" ? "Logistics suppliers" : "Product suppliers";

  const listExtraQuery = q ? `q=${encodeURIComponent(q)}` : undefined;

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <SupplierKindTabs active={kind} extraQuery={listExtraQuery} />

        <div className="rounded-b-lg rounded-tr-lg border border-t-0 border-zinc-200 bg-white px-6 py-8">
          <WorkflowHeader
            eyebrow="Supplier workspace"
            title={title}
            description={`Tenant: ${tenant.name}${kind === "logistics" ? " — forwarders and other logistics parties live here; existing booking forwarders were auto-tagged as logistics." : ""}`}
            steps={["Step 1: Review supplier list", "Step 2: Add supplier profile", "Step 3: Submit for approval"]}
            className="border-0 bg-transparent p-0 shadow-none"
          />
          {canEdit ? (
            <div className="mt-4">
              <ActionLink href={`/srm/new?kind=${kind}`}>
                Create new supplier
              </ActionLink>
            </div>
          ) : null}

          <form
            method="get"
            className="mt-6 flex max-w-xl flex-wrap items-end gap-2"
            role="search"
            aria-label="Filter suppliers by name or code"
          >
            <input type="hidden" name="kind" value={kind} />
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
            <button
              type="submit"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              Apply
            </button>
            {q ? (
              <Link
                href={`/suppliers?kind=${kind}`}
                className="rounded-md px-3 py-2 text-sm text-zinc-600 underline hover:text-zinc-900"
              >
                Clear
              </Link>
            ) : null}
          </form>

          <section className="mt-8 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Terms</th>
                  <th className="px-4 py-3 text-center">Offices</th>
                  {kind === "product" ? (
                    <th className="px-4 py-3 text-center">Products</th>
                  ) : (
                    <th className="px-4 py-3 text-center">Bookings</th>
                  )}
                  <th className="px-4 py-3 text-center">POs</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-900">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-zinc-600">
                      {q ? "No suppliers match this search." : "No suppliers in this category yet."}
                    </td>
                  </tr>
                ) : null}
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                      {s.code ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {[s.email, s.phone].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {s.paymentTermsLabel ??
                        (s.paymentTermsDays != null
                          ? `Net ${s.paymentTermsDays}`
                          : "—")}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">
                      {s._count.offices}
                    </td>
                    {kind === "product" ? (
                      <td className="px-4 py-3 text-center tabular-nums">
                        {s._count.productSuppliers}
                      </td>
                    ) : (
                      <td className="px-4 py-3 text-center tabular-nums">
                        {s._count.shipmentBookings}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center tabular-nums">{s._count.orders}</td>
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
                          s.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/suppliers/${s.id}`}
                        className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
                      >
                        {canEdit || canApprove ? "Open" : "View"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

        </div>
      </main>
    </div>
  );
}
