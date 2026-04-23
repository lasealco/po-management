/**
 * Idempotent SRM demo dataset for `demo-company` (finish program slice 29).
 *
 * Markers: supplier `code` = `DEMO-SRM-001`…`DEMO-SRM-005`; SRM document `fileName` contains `srm-demo-seed`.
 *
 * Prerequisites:
 * - `DATABASE_URL` (optional `USE_DOTENV_LOCAL=1` like other add-on seeds)
 * - `npm run db:seed` (creates `demo-company` + `buyer@` / `approver@` users)
 * - Migrations through SRM compliance tables (see `docs/database-neon.md`)
 *
 * Run: npm run db:seed:srm-demo
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import path, { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) {
  process.env.DATABASE_URL = cliDatabaseUrl;
}

const ONBOARDING_DEFAULTS = [
  { taskKey: "supplier_profile", title: "Verify company profile and tax ID", sortOrder: 10 },
  { taskKey: "bank_payment", title: "Collect bank / payment details", sortOrder: 20 },
  { taskKey: "insurance_docs", title: "Insurance or liability documentation", sortOrder: 30 },
  { taskKey: "code_of_conduct", title: "Code of conduct / compliance acknowledgment", sortOrder: 40 },
];

const DEMO_PDF =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} tenantId
 * @param {string} supplierId
 */
async function ensureOnboardingTasks(prisma, tenantId, supplierId) {
  await prisma.supplierOnboardingTask.createMany({
    data: ONBOARDING_DEFAULTS.map((d) => ({
      tenantId,
      supplierId,
      taskKey: d.taskKey,
      title: d.title,
      sortOrder: d.sortOrder,
    })),
    skipDuplicates: true,
  });
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} supplierId
 * @param {string[]} doneKeys
 * @param {{ approverId: string; incompleteAssignee: string | null }} assign
 *   incompleteAssignee — `null` clears assignee on incomplete tasks (e.g. rejected supplier).
 * @param {Record<string, Date>} [dueByKey]
 */
async function setTaskState(prisma, supplierId, doneKeys, { approverId, incompleteAssignee }, dueByKey) {
  for (const { taskKey } of ONBOARDING_DEFAULTS) {
    const done = doneKeys.includes(taskKey);
    const dueAt = !done && dueByKey && taskKey in dueByKey ? dueByKey[taskKey] : null;
    const assigneeUserId = done ? approverId : incompleteAssignee;
    await prisma.supplierOnboardingTask.updateMany({
      where: { supplierId, taskKey },
      data: {
        done,
        assigneeUserId,
        dueAt: done ? null : dueAt,
      },
    });
  }
}

const SUPPLIERS = [
  {
    code: "DEMO-SRM-001",
    name: "Demo Parts East LLC",
    email: "ops@demo-parts-east.example",
    srmCategory: "product",
    approvalStatus: "pending_approval",
    internalNotes: "[SRM-DEMO-SEED] Awaiting first-line approval; mixed onboarding progress.",
    doneKeys: ["supplier_profile", "bank_payment"],
  },
  {
    code: "DEMO-SRM-002",
    name: "Seafreight Partners GmbH",
    email: "chartering@seafreight-partners.example",
    srmCategory: "logistics",
    approvalStatus: "approved",
    internalNotes: "[SRM-DEMO-SEED] Active logistics forwarder; onboarding complete.",
    doneKeys: ["supplier_profile", "bank_payment", "insurance_docs", "code_of_conduct"],
  },
  {
    code: "DEMO-SRM-003",
    name: "Riverside Components Inc.",
    email: "sales@riverside.example",
    srmCategory: "product",
    approvalStatus: "rejected",
    internalNotes: "[SRM-DEMO-SEED] Rejected in demo; use for guardrail / 360 copy tests.",
    doneKeys: [],
  },
  {
    code: "DEMO-SRM-004",
    name: "Coastal Logistics Co.",
    email: "bookings@coastal-logistics.example",
    srmCategory: "logistics",
    approvalStatus: "approved",
    internalNotes: "[SRM-DEMO-SEED] US domestic trucking + port dray; partial checklist.",
    doneKeys: ["supplier_profile", "insurance_docs"],
  },
  {
    code: "DEMO-SRM-005",
    name: "Summit Mfg Supply",
    email: "ap@summit-mfg.example",
    srmCategory: "product",
    approvalStatus: "pending_approval",
    internalNotes: "[SRM-DEMO-SEED] New vendor; one task done; expiring cert on file.",
    doneKeys: ["supplier_profile"],
  },
];

const DOC_ROWS = [
  { code: "DEMO-SRM-001", fileSuffix: "coi-001", documentType: "certificate_of_insurance", title: "COI 2025 (demo)" },
  { code: "DEMO-SRM-001", fileSuffix: "w9-001", documentType: "w9", title: "W-9" },
  { code: "DEMO-SRM-002", fileSuffix: "coc-002", documentType: "code_of_conduct", title: "Code of conduct ack" },
  { code: "DEMO-SRM-002", fileSuffix: "qa-002", documentType: "quality_agreement", title: "Quality agreement" },
  { code: "DEMO-SRM-003", fileSuffix: "other-003", documentType: "other", title: "Prior correspondence" },
  { code: "DEMO-SRM-004", fileSuffix: "tax-004", documentType: "tax_certificate", title: "Resale certificate" },
  { code: "DEMO-SRM-005", fileSuffix: "w9-005", documentType: "w9", title: "W-9" },
  {
    code: "DEMO-SRM-005",
    fileSuffix: "coi-005",
    documentType: "certificate_of_insurance",
    title: "COI (expires soon — demo)",
    expiresAt: () => {
      const d = new Date();
      d.setDate(d.getDate() + 20);
      return d;
    },
  },
];

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ buyerId: string; approverId: string }} users
 */
async function runSrmDemoSeed(prisma, tenantId, users) {
  const { buyerId, approverId } = users;

  const removed = await prisma.srmSupplierDocument.deleteMany({
    where: {
      tenantId,
      fileName: { contains: "srm-demo-seed" },
    },
  });
  if (removed.count > 0) {
    console.log(`[db:seed:srm-demo] Cleared ${removed.count} prior seed document row(s).`);
  }

  const idByCode = new Map();

  for (const s of SUPPLIERS) {
    const sup = await prisma.supplier.upsert({
      where: { tenantId_code: { tenantId, code: s.code } },
      create: {
        tenantId,
        code: s.code,
        name: s.name,
        email: s.email,
        srmCategory: s.srmCategory,
        approvalStatus: s.approvalStatus,
        internalNotes: s.internalNotes,
        isActive: true,
      },
      update: {
        name: s.name,
        email: s.email,
        srmCategory: s.srmCategory,
        approvalStatus: s.approvalStatus,
        internalNotes: s.internalNotes,
        isActive: true,
      },
    });
    idByCode.set(s.code, sup.id);

    await ensureOnboardingTasks(prisma, tenantId, sup.id);
    const due = new Date();
    due.setDate(due.getDate() + 14);
    const dueByKey = { insurance_docs: due };
    const incompleteAssignee = s.approvalStatus === "rejected" ? null : buyerId;
    await setTaskState(prisma, sup.id, s.doneKeys, { approverId, incompleteAssignee }, dueByKey);
  }

  for (const row of DOC_ROWS) {
    const supplierId = idByCode.get(row.code);
    if (!supplierId) continue;
    const fileName = `srm-demo-seed-${row.fileSuffix}.pdf`;
    const expiresAt = typeof row.expiresAt === "function" ? row.expiresAt() : null;
    await prisma.srmSupplierDocument.create({
      data: {
        tenantId,
        supplierId,
        documentType: row.documentType,
        status: "active",
        title: row.title ?? null,
        fileName,
        mimeType: "application/pdf",
        fileSize: 13264,
        storageKey: null,
        fileUrl: DEMO_PDF,
        expiresAt,
        uploadedById: buyerId,
        lastModifiedById: approverId,
      },
    });
  }

  console.log(
    `[db:seed:srm-demo] Done — ${SUPPLIERS.length} suppliers (DEMO-SRM-001…005), onboarding tasks, ${DOC_ROWS.length} compliance file rows.`,
  );
  console.log("[db:seed:srm-demo] Open /srm and filter or search for “Demo” / “DEMO-SRM”.");
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[db:seed:srm-demo] Missing DATABASE_URL.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: process.env.DATABASE_URL,
      }),
    ),
  });

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: "demo-company" },
      select: { id: true },
    });
    if (!tenant) {
      console.error('[db:seed:srm-demo] Tenant "demo-company" not found. Run npm run db:seed first.');
      process.exit(1);
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        email: { in: ["buyer@demo-company.com", "approver@demo-company.com"] },
        isActive: true,
      },
      select: { id: true, email: true },
    });
    const buyer = users.find((u) => u.email === "buyer@demo-company.com");
    const approver = users.find((u) => u.email === "approver@demo-company.com");
    if (!buyer || !approver) {
      console.error("[db:seed:srm-demo] Need buyer and approver demo users. Run npm run db:seed first.");
      process.exit(1);
    }

    try {
      await prisma.srmSupplierDocument.findFirst({ take: 1, select: { id: true } });
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "P2021") {
        console.error(
          "[db:seed:srm-demo] Table SrmSupplierDocument is missing on this DATABASE_URL. Run `npm run db:migrate` (same env as this script, e.g. USE_DOTENV_LOCAL=1), then retry.",
        );
        process.exit(1);
      }
      throw e;
    }

    await runSrmDemoSeed(prisma, tenant.id, { buyerId: buyer.id, approverId: approver.id });
  } finally {
    await prisma.$disconnect();
  }
}

const isMain =
  typeof process.argv[1] === "string" &&
  path.basename(process.argv[1]) === path.basename(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
