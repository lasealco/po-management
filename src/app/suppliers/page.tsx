import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { SupplierCreateForm } from "@/components/supplier-create-form";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
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
          message="Choose a demo user in the header."
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

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { offices: true, productSuppliers: true, orders: true } },
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-zinc-900">Suppliers</h1>
        <p className="mt-2 text-zinc-600">
          Tenant: <span className="font-medium">{tenant.name}</span>
        </p>

        <section className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Terms</th>
                <th className="px-4 py-3 text-center">Offices</th>
                <th className="px-4 py-3 text-center">Products</th>
                <th className="px-4 py-3 text-center">POs</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{s.name}</td>
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
                  <td className="px-4 py-3 text-center tabular-nums">
                    {s._count.productSuppliers}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {s._count.orders}
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
                      className="font-medium text-amber-800 underline-offset-2 hover:underline"
                    >
                      {canEdit ? "Manage" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {canEdit ? (
          <section className="mt-10 border-t border-zinc-200 pt-10">
            <SupplierCreateForm />
          </section>
        ) : null}
      </main>
    </div>
  );
}
