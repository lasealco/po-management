import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) {
  process.env.DATABASE_URL = cliDatabaseUrl;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[repair-so-customers] Missing DATABASE_URL. Add it to .env or .env.local, then run again.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  ),
});

/** Map demo naming "{Vertical} forwarder — …" → "{Vertical} customer — …" (handles ASCII hyphen + Unicode dashes). */
function customerizeName(name) {
  if (!name) return name;
  const dashed = name.replace(/^(.+?)\s+forwarder\s*[—\-–]\s*/i, "$1 customer — ");
  if (dashed !== name) return dashed;
  return name.replace(/\s+forwarder\s*[—\-–]\s*/gi, " customer — ");
}

function customerizeLegalName(name) {
  if (!name) return name;
  return name
    .replace(/\s+Logistics\s+/gi, " Customer ")
    .replace(/\bForwarder\b/gi, "Customer");
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "demo-company" },
    select: { id: true },
  });
  if (!tenant) {
    console.error("[repair-so-customers] demo-company tenant not found.");
    process.exit(1);
  }

  const accounts = await prisma.crmAccount.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { name: { contains: "forwarder", mode: "insensitive" } },
        { legalName: { contains: "forwarder", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, legalName: true },
  });

  let accountsUpdated = 0;
  for (const account of accounts) {
    const nextName = customerizeName(account.name);
    const nextLegalName = account.legalName ? customerizeLegalName(account.legalName) : account.legalName;
    if (nextName === account.name && nextLegalName === account.legalName) continue;
    await prisma.crmAccount.update({
      where: { id: account.id },
      data: {
        name: nextName,
        legalName: nextLegalName,
        website: `https://example-customer-${account.id.slice(0, 8)}.example`,
      },
    });
    accountsUpdated += 1;
  }

  const linkedSalesOrders = await prisma.salesOrder.findMany({
    where: {
      tenantId: tenant.id,
      customerName: { contains: "forwarder", mode: "insensitive" },
    },
    select: {
      id: true,
      customerName: true,
      customerCrmAccount: { select: { name: true } },
    },
  });

  let salesOrdersUpdated = 0;
  for (const salesOrder of linkedSalesOrders) {
    const nextCustomerName = customerizeName(
      salesOrder.customerCrmAccount?.name ?? salesOrder.customerName,
    );
    if (!nextCustomerName || nextCustomerName === salesOrder.customerName) continue;
    await prisma.salesOrder.update({
      where: { id: salesOrder.id },
      data: { customerName: nextCustomerName },
    });
    salesOrdersUpdated += 1;
  }

  console.log(
    `[repair-so-customers] Updated ${accountsUpdated} CRM account(s) and ${salesOrdersUpdated} sales order customer name(s).`,
  );
}

main()
  .catch((err) => {
    console.error("[repair-so-customers] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
