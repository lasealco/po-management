/**
 * Idempotent demo row for Phase 06 invoice audit (demo-company only).
 *
 * Prerequisites:
 * - DATABASE_URL (same as main seed; optional USE_DOTENV_LOCAL=1 via npm script)
 * - Prisma migrations applied (including invoice audit + accounting handoff columns)
 * - At least one booking_pricing_snapshots row for demo-company (freeze from contract/RFQ UI first)
 *
 * Re-run safe: deletes prior seed intake by fixed external invoice no, then recreates PARSED intake + lines.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const DEMO_SLUG = "demo-company";
const DEMO_EXTERNAL_INVOICE_NO = "DEMO-INVOICE-AUDIT-SEED";

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) {
  process.env.DATABASE_URL = cliDatabaseUrl;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[db:seed:invoice-audit-demo] Missing DATABASE_URL.");
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
    console.error(`[db:seed:invoice-audit-demo] Tenant "${DEMO_SLUG}" not found. Run main db:seed first.`);
    process.exit(1);
  }

  const snapshot = await prisma.bookingPricingSnapshot.findFirst({
    where: { tenantId: tenant.id },
    orderBy: [{ frozenAt: "desc" }, { id: "desc" }],
    select: { id: true, sourceSummary: true, currency: true },
  });

  if (!snapshot) {
    console.log(
      `[db:seed:invoice-audit-demo] No booking pricing snapshot for ${DEMO_SLUG}. Freeze one under Pricing snapshots, then re-run this script.`,
    );
    process.exit(0);
  }

  const deleted = await prisma.invoiceIntake.deleteMany({
    where: { tenantId: tenant.id, externalInvoiceNo: DEMO_EXTERNAL_INVOICE_NO },
  });
  if (deleted.count) {
    console.log(`[db:seed:invoice-audit-demo] Removed ${deleted.count} prior seed intake(s).`);
  }

  const intake = await prisma.$transaction(async (tx) => {
    const row = await tx.invoiceIntake.create({
      data: {
        tenantId: tenant.id,
        status: "PARSED",
        bookingPricingSnapshotId: snapshot.id,
        externalInvoiceNo: DEMO_EXTERNAL_INVOICE_NO,
        vendorLabel: "Demo carrier (seed)",
        invoiceDate: new Date("2026-04-10T00:00:00.000Z"),
        currency: snapshot.currency?.trim().toUpperCase().slice(0, 3) || "USD",
        polCode: "USNYC",
        podCode: "DEHAM",
        rawSourceNotes: "Seeded for invoice-audit E2E demo. Re-run audit from UI after tolerance changes.",
        rollupOutcome: "PENDING",
        reviewDecision: "NONE",
        approvedForAccounting: false,
      },
    });

    const lines = [
      {
        lineNo: 1,
        rawDescription: "Ocean freight FCL 40HC base rate",
        normalizedLabel: null,
        currency: row.currency,
        amount: new Prisma.Decimal("2500"),
        unitBasis: "PER_CONTAINER",
        equipmentType: "40HC",
        chargeStructureHint: null,
      },
      {
        lineNo: 2,
        rawDescription: "Bunker adjustment factor (BAF)",
        normalizedLabel: null,
        currency: row.currency,
        amount: new Prisma.Decimal("350"),
        unitBasis: null,
        equipmentType: null,
        chargeStructureHint: null,
      },
      {
        lineNo: 3,
        rawDescription: "Terminal handling charge origin",
        normalizedLabel: null,
        currency: row.currency,
        amount: new Prisma.Decimal("185"),
        unitBasis: "PER_CONTAINER",
        equipmentType: "40HC",
        chargeStructureHint: null,
      },
    ];

    for (const ln of lines) {
      await tx.invoiceLine.create({
        data: {
          invoiceIntakeId: row.id,
          lineNo: ln.lineNo,
          rawDescription: ln.rawDescription,
          normalizedLabel: ln.normalizedLabel,
          currency: ln.currency,
          amount: ln.amount,
          unitBasis: ln.unitBasis,
          equipmentType: ln.equipmentType,
          chargeStructureHint: ln.chargeStructureHint,
        },
      });
    }

    return row;
  });

  console.log(
    `[db:seed:invoice-audit-demo] Created intake ${intake.id} (${DEMO_EXTERNAL_INVOICE_NO}) → snapshot ${snapshot.id}`,
  );
  console.log(
    `[db:seed:invoice-audit-demo] Open /invoice-audit/${intake.id} (log in as demo user with org.invoice_audit edit) and run audit.`,
  );
}

main()
  .catch((e) => {
    console.error("[db:seed:invoice-audit-demo] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
