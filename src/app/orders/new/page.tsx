import { AccessDenied } from "@/components/access-denied";
import { OrderCreateForm } from "@/components/order-create-form";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Create order"
          message="Choose an active user in the header to create purchase orders."
        />
      </div>
    );
  }
  if (!viewerHas(access.grantSet, "org.orders", "edit")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="Create order"
          message="You need org.orders -> edit to create purchase orders."
        />
      </div>
    );
  }

  const [suppliers, products, warehouses, forwarders] = await Promise.all([
    prisma.supplier.findMany({
      where: { tenantId: access.tenant.id, isActive: true },
      orderBy: [{ code: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        phone: true,
        registeredAddressLine1: true,
        registeredCity: true,
        registeredRegion: true,
        registeredPostalCode: true,
        registeredCountryCode: true,
        paymentTermsDays: true,
        paymentTermsLabel: true,
        defaultIncoterm: true,
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          select: { id: true, name: true, email: true, phone: true, isPrimary: true },
        },
      },
    }),
    prisma.product.findMany({
      where: { tenantId: access.tenant.id, isActive: true },
      orderBy: [{ productCode: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        sku: true,
        productCode: true,
        unit: true,
        productSuppliers: { select: { supplierId: true } },
      },
    }),
    prisma.warehouse.findMany({
      where: { tenantId: access.tenant.id, isActive: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        addressLine1: true,
        city: true,
        region: true,
        countryCode: true,
      },
    }),
    prisma.supplier.findMany({
      where: { tenantId: access.tenant.id, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        offices: {
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            addressLine1: true,
            city: true,
            region: true,
            countryCode: true,
          },
        },
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          select: { id: true, name: true, email: true, phone: true, isPrimary: true },
        },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50">
      <OrderCreateForm
        buyerUser={access.user}
        canSendDirect={viewerHas(access.grantSet, "org.orders", "transition")}
        suppliers={suppliers}
        warehouses={warehouses}
        forwarders={forwarders}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          productCode: p.productCode,
          unit: p.unit,
          supplierIds: p.productSuppliers.map((sp) => sp.supplierId),
        }))}
      />
    </div>
  );
}

