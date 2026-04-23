/**
 * Fast idempotent SCRI slice: org.scri grants for Buyer/Approver/Superuser + three demo events.
 * Does not run bulk GEN-* volume. Use when full `npm run db:seed` is too slow.
 *
 * Env: same as prisma/seed.mjs (.env + .env.local, DATABASE_URL required).
 */
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
  console.error("[db:seed:scri] Missing DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  ),
});

async function scriTablesExist() {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS x
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ScriExternalEvent'
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

const DEMO_SCRI_SEED_INGEST_PREFIX = "seed-scri-";

/** Move demo seed rows that still point at an old tenant id so /risk-intelligence (demo-company) can see them. */
async function rehomeOrphanSeedEvent(tenantId, ingestKey) {
  if (!ingestKey.startsWith(DEMO_SCRI_SEED_INGEST_PREFIX)) return false;

  const withKey = await prisma.scriExternalEvent.findMany({
    where: { ingestKey },
    select: { id: true, tenantId: true },
  });
  if (withKey.length !== 1) return false;
  const only = withKey[0];
  if (only.tenantId === tenantId) return false;

  await prisma.$transaction(async (tx) => {
    await tx.scriExternalEvent.update({
      where: { id: only.id },
      data: { tenantId },
    });
    await tx.scriEventAffectedEntity.updateMany({
      where: { eventId: only.id },
      data: { tenantId },
    });
  });
  console.log(
    `[db:seed:scri] Re-homed "${ingestKey}" to current demo-company tenant (was on another tenant id).`,
  );
  return true;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "demo-company" },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    console.error('[db:seed:scri] Tenant "demo-company" not found. Run full db:seed once first.');
    process.exit(1);
  }

  if (!(await scriTablesExist())) {
    console.error(
      "[db:seed:scri] SCRI tables are missing. Apply migrations first: npm run db:migrate",
    );
    process.exit(1);
  }

  const roles = await prisma.role.findMany({
    where: { tenantId: tenant.id, name: { in: ["Buyer", "Approver", "Superuser"] } },
    select: { id: true, name: true },
  });

  const permRows = [];
  for (const r of roles) {
    permRows.push({
      roleId: r.id,
      resource: "org.scri",
      action: "view",
      effect: "allow",
      workflowStatusId: null,
    });
    permRows.push({
      roleId: r.id,
      resource: "org.scri",
      action: "edit",
      effect: "allow",
      workflowStatusId: null,
    });
  }
  if (permRows.length) {
    await prisma.rolePermission.createMany({ data: permRows, skipDuplicates: true });
    console.log(`[db:seed:scri] Ensured org.scri grants for ${roles.length} role(s).`);
  }

  const bundles = [
    {
      ingestKey: "seed-scri-shanghai-congestion-2026",
      eventType: "PORT_CONGESTION",
      title: "Shanghai: elevated berth delays",
      shortSummary:
        "Industry notices cite backlog at primary box terminals. Validate exposure on Asia–EU lanes and pending bookings.",
      longSummary: null,
      severity: "HIGH",
      confidence: 68,
      geographies: [{ countryCode: "CN", label: "Shanghai port area", portUnloc: "CNSHA" }],
      sourceHeadline: "Terminal advisory — berth queue (demo seed)",
    },
    {
      ingestKey: "seed-scri-panama-canal-draft-2026",
      eventType: "CANAL_TRANSIT",
      title: "Panama Canal: draft / transit restrictions",
      shortSummary:
        "Seasonal draft limits may add transit time for relevant strings. Check USEC–Asia routings using the canal.",
      longSummary: null,
      severity: "MEDIUM",
      confidence: 55,
      geographies: [{ countryCode: "PA", label: "Panama Canal", portUnloc: "PAPTY" }],
      sourceHeadline: "Canal authority notice (demo seed)",
    },
    {
      ingestKey: "seed-scri-border-customs-delay-2026",
      eventType: "BORDER_DELAY",
      title: "Border crossing: extended customs inspections",
      shortSummary:
        "Reports of stepped-up inspections on selected truck corridors. May affect inland legs after port discharge.",
      longSummary: null,
      severity: "MEDIUM",
      confidence: 52,
      geographies: [{ countryCode: "US", region: "Southwest", label: "Land border corridor (demo)" }],
      sourceHeadline: "Trade press — inspection surge (demo seed)",
    },
  ];

  let created = 0;
  let rehomed = 0;
  for (const b of bundles) {
    const exists = await prisma.scriExternalEvent.findUnique({
      where: { tenantId_ingestKey: { tenantId: tenant.id, ingestKey: b.ingestKey } },
      select: { id: true },
    });
    if (exists) continue;

    if (await rehomeOrphanSeedEvent(tenant.id, b.ingestKey)) {
      rehomed += 1;
      continue;
    }

    await prisma.scriExternalEvent.create({
      data: {
        tenantId: tenant.id,
        ingestKey: b.ingestKey,
        eventType: b.eventType,
        title: b.title,
        shortSummary: b.shortSummary,
        longSummary: b.longSummary,
        severity: b.severity,
        confidence: b.confidence,
        sourceCount: 1,
        structuredPayload: { demoSeed: true, pack: "SCRI_R1" },
        sources: {
          create: [
            {
              sourceType: "demo_seed",
              publisher: "prisma/seed-scri-quick.mjs",
              headline: b.sourceHeadline,
            },
          ],
        },
        geographies: { create: b.geographies },
      },
    });
    created += 1;
  }

  const unchanged = bundles.length - created - rehomed;
  console.log(
    `[db:seed:scri] Demo events: ${created} created, ${rehomed} re-homed, ${unchanged} already on tenant (idempotent).`,
  );
  console.log(`[db:seed:scri] Done for tenant "${tenant.slug}". Open /risk-intelligence and run network match on an event.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
