import { notFound } from "next/navigation";
import {
  SupplierDetailClient,
  type SupplierDetailSnapshot,
} from "@/components/supplier-detail-client";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getDemoTenant();
  if (!tenant) notFound();

  const supplier = await prisma.supplier.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      offices: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          city: true,
          countryCode: true,
          isActive: true,
        },
      },
      _count: { select: { productSuppliers: true, orders: true } },
    },
  });

  if (!supplier) notFound();

  const snapshot: SupplierDetailSnapshot = {
    id: supplier.id,
    name: supplier.name,
    code: supplier.code,
    email: supplier.email,
    phone: supplier.phone,
    isActive: supplier.isActive,
    offices: supplier.offices,
    productLinkCount: supplier._count.productSuppliers,
    orderCount: supplier._count.orders,
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <SupplierDetailClient key={supplier.id} initial={snapshot} />
      </main>
    </div>
  );
}
