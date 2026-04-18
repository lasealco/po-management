/**
 * Idempotent demo row for Phase 06 invoice audit (demo-company only).
 *
 * Prerequisites:
 * - DATABASE_URL (same as main seed; optional USE_DOTENV_LOCAL=1 via npm script)
 * - Prisma migrations applied (including invoice audit + accounting handoff columns)
 * - At least one booking_pricing_snapshots row for demo-company (freeze from contract/RFQ UI first)
 *
 * Re-run safe: deletes prior seed intake by fixed external invoice no, then recreates PARSED intake + lines.
 *
 * Demo flow (manual, after this script):
 *   1) Open the printed /invoice-audit/{id} URL as a demo user with org.invoice_audit edit.
 *   2) Run audit vs snapshot — expect line-level GREEN/WARN/FAIL from your snapshot’s breakdown.
 *   3) On the same page: Ops notes (Step 1) → Finance review (Step 2) → Accounting handoff (Step 3).
 *
 * If the UI says the database is not ready: GET /api/invoice-audit/readiness (same auth as invoice audit)
 * returns { ok, issues, requiredMigrationsHint } — run prisma migrate deploy on this DATABASE_URL.
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
  const schemaRows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoice_intakes'
      AND column_name = 'approvedForAccounting'
    LIMIT 1
  `;
  if (!Array.isArray(schemaRows) || schemaRows.length === 0) {
    console.error(
      "[db:seed:invoice-audit-demo] Database is missing column invoice_intakes.approvedForAccounting.\n" +
        "  Run: npm run db:migrate   (or prisma migrate deploy on the target DB), then retry.",
    );
    process.exit(1);
  }

  const expectedInvoiceAuditMigrations = [
    "20260419100000_invoice_audit_foundation",
    "20260420120000_invoice_audit_ocean_matching",
    "20260421103000_invoice_intake_accounting_handoff",
  ];
  try {
    const migRows = await prisma.$queryRaw`
      SELECT migration_name::text AS migration_name
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
        AND migration_name IN (
          '20260419100000_invoice_audit_foundation',
          '20260420120000_invoice_audit_ocean_matching',
          '20260421103000_invoice_intake_accounting_handoff'
        )
    `;
    const have = new Set(
      Array.isArray(migRows) ? migRows.map((r) => (typeof r.migration_name === "string" ? r.migration_name : "")) : [],
    );
    const missing = expectedInvoiceAuditMigrations.filter((n) => !have.has(n));
    if (missing.length > 0) {
      console.warn(
        `[db:seed:invoice-audit-demo] Expected ${expectedInvoiceAuditMigrations.length} finished Prisma migrations for invoice audit; missing: ${missing.join(", ")}. Apply migrate deploy if the demo behaves oddly.`,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[db:seed:invoice-audit-demo] Could not read _prisma_migrations (${msg}). Skipping migration-name check.`);
  }

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
  console.log(`[db:seed:invoice-audit-demo] Demo path:`);
  console.log(`  (1) Open /invoice-audit/${intake.id} with a demo user that has org.invoice_audit → edit.`);
  console.log(`  (2) Click "Run audit vs snapshot" (intake is PARSED; lines mirror the new-intake form demo).`);
  console.log(`  (3) Complete closeout on the same page: ops notes → finance review → accounting handoff.`);
  console.log(
    `[db:seed:invoice-audit-demo] Tip: snapshot "${snapshot.sourceSummary ?? snapshot.id}" — mismatch amounts on lines are OK for testing WARN/FAIL.`,
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
