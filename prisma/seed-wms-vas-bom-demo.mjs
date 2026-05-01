/**
 * BF-18 — Idempotent demo work order + two BOM lines (demo-company, WH-DEMO-DC1).
 *
 * Prerequisites: `npm run db:seed` + `npm run db:seed:wms-demo` (tenant, buyer, products, warehouse).
 *
 *   USE_DOTENV_LOCAL=1 npm run db:seed:wms-vas-bom-demo
 *
 * Safe re-run: recreates BOM snapshot unless any line has consumedQty > 0.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const DEMO_SLUG = "demo-company";
const WH_CODE = "WH-DEMO-DC1";
const WO_NO = "WO-DEMO-VAS-BOM-BF18";

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) {
  process.env.DATABASE_URL = cliDatabaseUrl;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[bf18-seed] Missing DATABASE_URL.");
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
    where: { slug: DEMO_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    console.error("[bf18-seed] Tenant demo-company not found. Run npm run db:seed first.");
    process.exit(1);
  }
  const tenantId = tenant.id;

  const buyer = await prisma.user.findFirst({
    where: { tenantId, email: "buyer@demo-company.com" },
    select: { id: true },
  });
  if (!buyer) {
    console.error("[bf18-seed] buyer@demo-company.com not found.");
    process.exit(1);
  }
  const actorId = buyer.id;

  const wh = await prisma.warehouse.findFirst({
    where: { tenantId, code: WH_CODE },
    select: { id: true },
  });
  if (!wh) {
    console.error("[bf18-seed] Warehouse WH-DEMO-DC1 not found. Run npm run db:seed:wms-demo first.");
    process.exit(1);
  }

  const skus = ["OFF-PAPER-A4-500", "OFF-TONER-GEN-1"];
  const products = await prisma.product.findMany({
    where: { tenantId, sku: { in: skus } },
    select: { id: true, sku: true },
  });
  const bySku = new Map(products.map((p) => [p.sku, p.id]));
  for (const s of skus) {
    if (!bySku.has(s)) {
      console.error(`[bf18-seed] Missing product SKU ${s}.`);
      process.exit(1);
    }
  }
  const paperId = bySku.get("OFF-PAPER-A4-500");
  const tonerId = bySku.get("OFF-TONER-GEN-1");

  let wo = await prisma.wmsWorkOrder.findFirst({
    where: { tenantId, workOrderNo: WO_NO },
    include: { bomLines: true },
  });

  if (wo) {
    const consumed = wo.bomLines.some((bl) => Number(bl.consumedQty) > 0);
    if (consumed) {
      console.log("[bf18-seed] Existing WO has BOM consumption — leaving rows unchanged.");
      console.log(`[bf18-seed] Work order id: ${wo.id}`);
      return;
    }
    await prisma.wmsWorkOrderBomLine.deleteMany({ where: { workOrderId: wo.id } });
    await prisma.wmsWorkOrderBomLine.createMany({
      data: [
        {
          tenantId,
          workOrderId: wo.id,
          lineNo: 1,
          componentProductId: paperId,
          plannedQty: "10",
        },
        {
          tenantId,
          workOrderId: wo.id,
          lineNo: 2,
          componentProductId: tonerId,
          plannedQty: "2",
        },
      ],
    });
    console.log("[bf18-seed] Refreshed BOM lines on existing demo WO.");
    console.log(`[bf18-seed] Work order id: ${wo.id}`);
    return;
  }

  wo = await prisma.wmsWorkOrder.create({
    data: {
      tenantId,
      warehouseId: wh.id,
      workOrderNo: WO_NO,
      title: "BF-18 VAS BOM demo",
      description: "Seed work order for multi-line BOM consumption (BF-18).",
      intakeChannel: "OPS",
      createdById: actorId,
      bomLines: {
        create: [
          {
            tenantId,
            lineNo: 1,
            componentProductId: paperId,
            plannedQty: "10",
          },
          {
            tenantId,
            lineNo: 2,
            componentProductId: tonerId,
            plannedQty: "2",
          },
        ],
      },
    },
    include: { bomLines: true },
  });

  console.log("[bf18-seed] Created demo work order + BOM lines.");
  console.log(`[bf18-seed] Work order id: ${wo.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
