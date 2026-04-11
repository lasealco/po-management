/**
 * Idempotent CRM demo dataset for the demo tenant.
 * Markers: accounts.segment = "crm-demo-bulk", leads.source = "DEMO_BULK",
 * opportunities.forecastCategory = "DEMO_BULK", activities.subject starts with "[CRM Demo]".
 *
 * Run: npm run db:seed:crm-demo
 * Or: SEED_CRM_DEMO=1 npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import path, { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const DEMO_SEGMENT = "crm-demo-bulk";
const LEAD_SOURCE = "DEMO_BULK";
const OPP_DEMO_FLAG = "DEMO_BULK";
const ACTIVITY_PREFIX = "[CRM Demo]";

const STAGES = [
  "IDENTIFIED",
  "QUALIFIED",
  "DISCOVERY",
  "SOLUTION_DESIGN",
  "PROPOSAL_SUBMITTED",
  "NEGOTIATION",
  "VERBAL_AGREEMENT",
  "WON_IMPLEMENTATION_PENDING",
  "WON_LIVE",
  "LOST",
  "ON_HOLD",
];

const ACTIVITY_TYPES = ["TASK", "CALL", "MEETING", "NOTE", "EMAIL"];

const PORTS = [
  "Shanghai",
  "Rotterdam",
  "Los Angeles",
  "Hamburg",
  "Singapore",
  "Dubai",
  "Chicago",
  "Tokyo",
  "Mumbai",
  "Santos",
  "Antwerp",
  "Felixstowe",
  "Busan",
  "Savannah",
  "Vancouver",
];

const VERTICALS = [
  "Electronics",
  "Apparel",
  "Food & beverage",
  "Industrial parts",
  "Consumer goods",
  "Automotive",
  "Chemicals",
  "Pharma",
];

/** Deterministic PRNG (same data every run). */
function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function stageFromRand(rand) {
  const u = rand();
  if (u < 0.12) return STAGES[0];
  if (u < 0.24) return STAGES[1];
  if (u < 0.36) return STAGES[2];
  if (u < 0.46) return STAGES[3];
  if (u < 0.56) return STAGES[4];
  if (u < 0.66) return STAGES[5];
  if (u < 0.72) return STAGES[6];
  if (u < 0.78) return STAGES[7];
  if (u < 0.84) return STAGES[8];
  if (u < 0.92) return STAGES[9];
  return STAGES[10];
}

function probabilityForStage(stage) {
  const map = {
    IDENTIFIED: 12,
    QUALIFIED: 20,
    DISCOVERY: 28,
    SOLUTION_DESIGN: 40,
    PROPOSAL_SUBMITTED: 52,
    NEGOTIATION: 65,
    VERBAL_AGREEMENT: 78,
    WON_IMPLEMENTATION_PENDING: 88,
    WON_LIVE: 100,
    LOST: 0,
    ON_HOLD: 35,
  };
  return map[stage] ?? 25;
}

function leadStatusFromRand(rand) {
  const u = rand();
  if (u < 0.35) return "NEW";
  if (u < 0.7) return "WORKING";
  if (u < 0.9) return "QUALIFIED";
  return "DISQUALIFIED";
}

export async function runCrmDemoSeed(prisma, tenantId, { buyerId, approverId }) {
  const owners = [buyerId, approverId];
  const owner = (i) => owners[i % owners.length];

  console.log("[crm-demo] Purging previous demo bulk rows…");
  const demoAccounts = await prisma.crmAccount.findMany({
    where: { tenantId, segment: DEMO_SEGMENT },
    select: { id: true },
  });
  const accIds = demoAccounts.map((a) => a.id);

  if (accIds.length > 0) {
    const demoOpps = await prisma.crmOpportunity.findMany({
      where: { tenantId, accountId: { in: accIds } },
      select: { id: true },
    });
    const oppIds = demoOpps.map((o) => o.id);

    await prisma.crmActivity.deleteMany({
      where: {
        tenantId,
        OR: [
          { subject: { startsWith: ACTIVITY_PREFIX } },
          { relatedAccountId: { in: accIds } },
          ...(oppIds.length ? [{ relatedOpportunityId: { in: oppIds } }] : []),
        ],
      },
    });
    await prisma.crmOpportunity.deleteMany({
      where: { tenantId, accountId: { in: accIds } },
    });
    await prisma.crmContact.deleteMany({
      where: { tenantId, accountId: { in: accIds } },
    });
    await prisma.crmAccount.deleteMany({
      where: { tenantId, id: { in: accIds } },
    });
  }

  const deletedLeads = await prisma.crmLead.deleteMany({
    where: { tenantId, source: LEAD_SOURCE },
  });
  console.log(
    `[crm-demo] Purge done — removed ${accIds.length} demo account(s) (with opps/contacts/activities) and ${deletedLeads.count} demo lead(s).`,
  );

  const rand = mulberry32(0x9e3779b9);

  const ACCOUNT_COUNT = 50;
  const LEAD_COUNT = 200;
  const OPP_PER_ACCOUNT_MIN = 1;
  const OPP_PER_ACCOUNT_MAX = 3;
  const ACTIVITY_COUNT = 50;

  console.log(`[crm-demo] Creating ${ACCOUNT_COUNT} customer accounts…`);
  const accountRows = [];
  for (let i = 0; i < ACCOUNT_COUNT; i++) {
    const city = pick(rand, PORTS);
    const vert = pick(rand, VERTICALS);
    const suffix = 1000 + i;
    accountRows.push({
      tenantId,
      ownerUserId: owner(i),
      name: `${vert} forwarder — ${city} (${suffix})`,
      legalName: `${vert} Logistics ${suffix} LLC`,
      accountType: "CUSTOMER",
      lifecycle: "ACTIVE",
      industry: vert,
      segment: DEMO_SEGMENT,
      strategicFlag: rand() < 0.12,
      website: `https://example-logistics-${suffix}.example`,
    });
  }
  await prisma.crmAccount.createMany({ data: accountRows });

  const accounts = await prisma.crmAccount.findMany({
    where: { tenantId, segment: DEMO_SEGMENT },
    select: { id: true, name: true, ownerUserId: true },
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length !== ACCOUNT_COUNT) {
    console.warn(
      `[crm-demo] Expected ${ACCOUNT_COUNT} accounts, found ${accounts.length} (check segment marker).`,
    );
  }

  console.log(`[crm-demo] Creating ${LEAD_COUNT} leads…`);
  const leadBatchSize = 50;
  for (let offset = 0; offset < LEAD_COUNT; offset += leadBatchSize) {
    const chunk = [];
    for (let j = 0; j < leadBatchSize && offset + j < LEAD_COUNT; j++) {
      const idx = offset + j;
      chunk.push({
        tenantId,
        ownerUserId: owner(idx),
        companyName: `Import prospect ${idx + 1} — ${pick(rand, PORTS)}`,
        contactFirstName: pick(rand, ["Alex", "Jordan", "Sam", "Riley", "Casey"]),
        contactLastName: pick(rand, ["Nguyen", "Patel", "Garcia", "Kim", "Okafor"]),
        contactEmail: `prospect.lead.${idx + 1}@example.invalid`,
        contactPhone: `+1-555-${String(2000 + (idx % 8000)).padStart(4, "0")}`,
        status: leadStatusFromRand(rand),
        source: LEAD_SOURCE,
        serviceInterest: pick(rand, [
          "Ocean FCL Asia–EU",
          "Air charter peak",
          "Warehouse + D2C",
          "Customs brokerage",
          "Intermodal US domestic",
        ]),
        qualificationNotes: `Demo lead ${idx + 1}. Volume tier ${(idx % 5) + 1}.`,
      });
    }
    await prisma.crmLead.createMany({ data: chunk });
  }

  console.log("[crm-demo] Creating pipeline (opportunities per account)…");
  const accountIds = accounts.map((a) => a.id);
  const oppRows = [];
  for (let a = 0; a < accounts.length; a++) {
    const acc = accounts[a];
    const n =
      OPP_PER_ACCOUNT_MIN +
      Math.floor(rand() * (OPP_PER_ACCOUNT_MAX - OPP_PER_ACCOUNT_MIN + 1));
    for (let k = 0; k < n; k++) {
      const stage = stageFromRand(rand);
      const name =
        k === 0
          ? `${acc.name.split("—")[0].trim()} — anchor deal`
          : `${pick(rand, ["Lane bid", "Tender", "Pilot", "Renewal", "Expansion"])} — ${acc.name.slice(0, 40)}`;
      oppRows.push({
        tenantId,
        accountId: acc.id,
        ownerUserId: acc.ownerUserId,
        name,
        stage,
        probability: probabilityForStage(stage),
        forecastCategory: OPP_DEMO_FLAG,
        currency: "USD",
        estimatedRevenue: String((50 + Math.floor(rand() * 450)) * 1000),
        closeDate: new Date(
          Date.now() + (20 + Math.floor(rand() * 120)) * 86400000,
        ),
        nextStep: pick(rand, [
          "Send pricing grid",
          "Book exec workshop",
          "Align on SLA draft",
          "Legal review MSA",
          "Ops site visit",
        ]),
      });
    }
  }
  await prisma.crmOpportunity.createMany({ data: oppRows });
  const oppTotal = oppRows.length;
  const demoOppsForActivities = await prisma.crmOpportunity.findMany({
    where: {
      tenantId,
      accountId: { in: accountIds },
      forecastCategory: OPP_DEMO_FLAG,
    },
    select: { id: true },
  });
  const allOppIds = demoOppsForActivities.map((o) => o.id);
  console.log(`[crm-demo] Created ${oppTotal} opportunities.`);

  console.log(`[crm-demo] Creating ${ACTIVITY_COUNT} activities…`);
  const activityRows = [];
  for (let i = 0; i < ACTIVITY_COUNT; i++) {
    const acc = pick(rand, accounts);
    const linkOpp = rand() < 0.55 && allOppIds.length > 0;
    const oppId = linkOpp ? pick(rand, allOppIds) : null;
    const type = ACTIVITY_TYPES[i % ACTIVITY_TYPES.length];
    const due = new Date(Date.now() + (i - 10) * 86400000 * 2);
    activityRows.push({
      tenantId,
      ownerUserId: owner(i),
      type,
      subject: `${ACTIVITY_PREFIX} ${pick(rand, ["Follow up", "Prep QBR", "Rate review", "Intro call", "Demo slot", "Contract redlines"])} #${i + 1}`,
      body: `Auto-generated demo activity ${i + 1}.`,
      status: pick(rand, ["OPEN", "OPEN", "OPEN", "DONE"]),
      dueDate: due,
      relatedAccountId: acc.id,
      relatedOpportunityId: oppId,
    });
  }
  await prisma.crmActivity.createMany({ data: activityRows });

  console.log(
    `[crm-demo] Done — ${accounts.length} accounts, ${LEAD_COUNT} leads, ${oppTotal} opportunities, ${ACTIVITY_COUNT} activities.`,
  );
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[crm-demo] Missing DATABASE_URL.");
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
      console.error('[crm-demo] Tenant "demo-company" not found. Run npm run db:seed first.');
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
      console.error("[crm-demo] Need buyer and approver demo users. Run npm run db:seed first.");
      process.exit(1);
    }

    await runCrmDemoSeed(prisma, tenant.id, {
      buyerId: buyer.id,
      approverId: approver.id,
    });
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
