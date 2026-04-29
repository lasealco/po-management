/**
 * Idempotent repair for **product trace** demos on DBs seeded before booking / stock were added.
 *
 * Ensures for demo corrugated (`PKG-CORR-ROLL` / `CORR-ROLL`):
 * - PO-1002 shipment `ASN-PO1002-1` is IN_TRANSIT with ShipmentBooking CNSZX→USLAX (rolling ETD/ETA)
 * - WH-LAX has zone/bin `PT-DEMO` / `PTRACE-01` and on-hand inventory
 *
 *   node prisma/product-trace-demo-repair.mjs
 *   npm run db:seed:product-trace-demo
 *
 * Requires `npm run db:seed` at least once (demo tenant, PO-1002, products, warehouses).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) process.env.DATABASE_URL = cliDatabaseUrl;

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[product-trace-demo] Missing DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  ),
});

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "demo-company" },
    select: { id: true },
  });
  if (!tenant) {
    console.error("[product-trace-demo] Tenant demo-company not found. Run npm run db:seed first.");
    process.exit(1);
  }

  const buyer = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "buyer@demo-company.com", isActive: true },
    select: { id: true },
  });
  if (!buyer) {
    console.error("[product-trace-demo] buyer@demo-company.com not found.");
    process.exit(1);
  }

  const product = await prisma.product.findFirst({
    where: { tenantId: tenant.id, sku: "PKG-CORR-ROLL" },
    select: { id: true, sku: true, productCode: true },
  });
  if (!product) {
    console.error("[product-trace-demo] Product PKG-CORR-ROLL not found.");
    process.exit(1);
  }

  const wh = await prisma.warehouse.findFirst({
    where: { tenantId: tenant.id, code: "WH-LAX" },
    select: { id: true },
  });
  if (!wh) {
    console.error("[product-trace-demo] Warehouse WH-LAX not found.");
    process.exit(1);
  }

  await prisma.warehouse.updateMany({
    where: { id: wh.id },
    data: { addressLine1: "5000 Distribution Pkwy" },
  });

  const zone = await prisma.warehouseZone.upsert({
    where: { warehouseId_code: { warehouseId: wh.id, code: "PT-DEMO" } },
    update: {},
    create: {
      tenantId: tenant.id,
      warehouseId: wh.id,
      code: "PT-DEMO",
      name: "Product trace demo",
      zoneType: "RESERVE",
    },
  });
  const bin = await prisma.warehouseBin.upsert({
    where: { warehouseId_code: { warehouseId: wh.id, code: "PTRACE-01" } },
    update: { zoneId: zone.id },
    create: {
      tenantId: tenant.id,
      warehouseId: wh.id,
      zoneId: zone.id,
      code: "PTRACE-01",
      name: "Staging (product trace demo)",
      storageType: "PALLET",
    },
  });

  await prisma.inventoryBalance.upsert({
    where: {
      warehouseId_binId_productId_lotCode: {
        warehouseId: wh.id,
        binId: bin.id,
        productId: product.id,
        lotCode: "",
      },
    },
    update: { onHandQty: "125.000", allocatedQty: "5.000" },
    create: {
      tenantId: tenant.id,
      warehouseId: wh.id,
      binId: bin.id,
      productId: product.id,
      lotCode: "",
      onHandQty: "125.000",
      allocatedQty: "5.000",
    },
  });

  const po = await prisma.purchaseOrder.findFirst({
    where: { tenantId: tenant.id, orderNumber: "PO-1002" },
    select: { id: true },
  });
  if (!po) {
    console.error("[product-trace-demo] PO-1002 not found.");
    process.exit(1);
  }

  const traceEtd = new Date(Date.now() - 6 * 86_400_000);
  const traceEta = new Date(Date.now() + 20 * 86_400_000);

  let shipment = await prisma.shipment.findFirst({
    where: { orderId: po.id, shipmentNo: "ASN-PO1002-1" },
    select: { id: true },
  });

  if (!shipment) {
    shipment = await prisma.shipment.findFirst({
      where: { orderId: po.id },
      orderBy: { shippedAt: "desc" },
      select: { id: true },
    });
  }

  if (!shipment) {
    console.error("[product-trace-demo] No shipment on PO-1002. Re-run npm run db:seed.");
    process.exit(1);
  }

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: "IN_TRANSIT",
      shippedAt: traceEtd,
      expectedReceiveAt: traceEta,
      transportMode: "OCEAN",
    },
  });

  await prisma.shipmentBooking.upsert({
    where: { shipmentId: shipment.id },
    update: {
      status: "CONFIRMED",
      mode: "OCEAN",
      originCode: "CNSZX",
      destinationCode: "USLAX",
      etd: traceEtd,
      eta: traceEta,
      updatedById: buyer.id,
    },
    create: {
      shipmentId: shipment.id,
      status: "CONFIRMED",
      mode: "OCEAN",
      originCode: "CNSZX",
      destinationCode: "USLAX",
      etd: traceEtd,
      eta: traceEta,
      createdById: buyer.id,
      updatedById: buyer.id,
    },
  });

  const hasContainer = await prisma.ctShipmentContainer.findFirst({
    where: { shipmentId: shipment.id },
    select: { id: true },
  });
  if (!hasContainer) {
    const leg = await prisma.ctShipmentLeg.findFirst({
      where: { shipmentId: shipment.id, legNo: 1 },
      select: { id: true },
    });
    if (leg) {
      await prisma.ctShipmentContainer.create({
        data: {
          tenantId: tenant.id,
          shipmentId: shipment.id,
          legId: leg.id,
          containerNumber: "MSCU1234567",
          containerType: "40HC",
          status: "IN_TRANSIT",
        },
      });
    }
  }

  console.log(
    "[product-trace-demo] OK — open /product-trace?q=PKG-CORR-ROLL (or q=CORR-ROLL). PO-1002 / ASN-PO1002-1 + WH-LAX stock.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
