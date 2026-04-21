/**
 * Optional large-tenant Supply Chain Twin performance fixture (idempotent).
 *
 * Run:
 *   USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-large-fixture
 *
 * Notes:
 * - Opt-in only; does not run during default `db:seed`.
 * - Targets tenant `demo-company`.
 * - Seeds 1k+ entities plus realistic edge/event/risk/scenario volumes for pagination and perf UX checks.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const DEMO_SLUG = "demo-company";
const FIXTURE_TAG = "sctwin-large-fixture-v1";
const REL_PREFIX = "perf_fixture/";

const ENTITY_COUNT = 1200;
const EDGE_COUNT = 2200;
const EVENT_COUNT = 3200;
const RISK_COUNT = 180;
const SCENARIO_COUNT = 140;

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) process.env.DATABASE_URL = cliDatabaseUrl;

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[db:seed:supply-chain-twin-large-fixture] Missing DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

async function assertScenarioIdTenantOwnership(id, tenantId) {
  const existing = await prisma.supplyChainTwinScenarioDraft.findUnique({
    where: { id },
    select: { tenantId: true },
  });
  if (existing && existing.tenantId !== tenantId) {
    console.error(
      `[db:seed:supply-chain-twin-large-fixture] Scenario id collision for "${id}". ` +
        `Existing row belongs to another tenant; refusing to mutate cross-tenant data.`,
    );
    process.exit(1);
  }
}

function entityKindForIndex(i) {
  const kinds = ["supplier", "site", "warehouse", "shipment", "purchase_order", "sku"];
  return kinds[i % kinds.length];
}

async function ensureTwinTablesExist() {
  const tableRows = await prisma.$queryRaw`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'SupplyChainTwinEntitySnapshot',
        'SupplyChainTwinEntityEdge',
        'SupplyChainTwinIngestEvent',
        'SupplyChainTwinRiskSignal',
        'SupplyChainTwinScenarioDraft'
      )
  `;
  const found = new Set((Array.isArray(tableRows) ? tableRows : []).map((r) => r.table_name));
  const required = [
    "SupplyChainTwinEntitySnapshot",
    "SupplyChainTwinEntityEdge",
    "SupplyChainTwinIngestEvent",
    "SupplyChainTwinRiskSignal",
    "SupplyChainTwinScenarioDraft",
  ];
  for (const tableName of required) {
    if (!found.has(tableName)) {
      console.error(
        `[db:seed:supply-chain-twin-large-fixture] Table ${tableName} is missing.\n` +
          "  Run: npm run db:migrate   then retry.",
      );
      process.exit(1);
    }
  }
}

async function main() {
  await ensureTwinTablesExist();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SLUG },
    select: { id: true, name: true },
  });
  if (!tenant) {
    console.error(`[db:seed:supply-chain-twin-large-fixture] Tenant "${DEMO_SLUG}" not found. Run npm run db:seed first.`);
    process.exit(1);
  }

  const snapshots = [];
  for (let i = 0; i < ENTITY_COUNT; i += 1) {
    const entityKind = entityKindForIndex(i);
    const entityKey = `PERF-${entityKind.toUpperCase()}-${String(i).padStart(5, "0")}`;
    const row = await prisma.supplyChainTwinEntitySnapshot.upsert({
      where: {
        tenantId_entityKind_entityKey: {
          tenantId: tenant.id,
          entityKind,
          entityKey,
        },
      },
      create: {
        tenantId: tenant.id,
        entityKind,
        entityKey,
        payload: {
          fixtureTag: FIXTURE_TAG,
          index: i,
          score: (i * 17) % 101,
        },
      },
      update: {
        payload: {
          fixtureTag: FIXTURE_TAG,
          index: i,
          score: (i * 17) % 101,
        },
      },
      select: { id: true },
    });
    snapshots.push(row.id);
  }

  // Keep edge fixture idempotent even without a dedicated DB unique key by replacing this fixture slice.
  await prisma.supplyChainTwinEntityEdge.deleteMany({
    where: { tenantId: tenant.id, relation: { startsWith: REL_PREFIX } },
  });
  const edgeRows = [];
  for (let i = 0; i < EDGE_COUNT; i += 1) {
    const fromSnapshotId = snapshots[i % snapshots.length];
    const toSnapshotId = snapshots[(i * 7 + 11) % snapshots.length];
    if (fromSnapshotId === toSnapshotId) continue;
    edgeRows.push({
      tenantId: tenant.id,
      fromSnapshotId,
      toSnapshotId,
      relation: `${REL_PREFIX}${i % 5 === 0 ? "depends_on" : "flows_to"}`,
    });
  }
  if (edgeRows.length > 0) {
    await prisma.supplyChainTwinEntityEdge.createMany({ data: edgeRows });
  }

  for (let i = 0; i < EVENT_COUNT; i += 1) {
    const entityIdx = i % snapshots.length;
    const kind = i % 3 === 0 ? "entity_upsert" : i % 3 === 1 ? "edge_upsert" : "risk_signal";
    const key = `${FIXTURE_TAG}-event-${String(i).padStart(5, "0")}`;
    await prisma.supplyChainTwinIngestEvent.upsert({
      where: {
        tenantId_idempotencyKey: {
          tenantId: tenant.id,
          idempotencyKey: key,
        },
      },
      create: {
        tenantId: tenant.id,
        type: kind,
        idempotencyKey: key,
        payloadJson: {
          fixtureTag: FIXTURE_TAG,
          entitySnapshotId: snapshots[entityIdx],
          ordinal: i,
        },
      },
      update: {
        type: kind,
        payloadJson: {
          fixtureTag: FIXTURE_TAG,
          entitySnapshotId: snapshots[entityIdx],
          ordinal: i,
        },
      },
    });
  }

  for (let i = 0; i < RISK_COUNT; i += 1) {
    const code = `${FIXTURE_TAG.toUpperCase()}-RISK-${String(i).padStart(4, "0")}`;
    const severity = i % 5 === 0 ? "HIGH" : i % 3 === 0 ? "MEDIUM" : "LOW";
    await prisma.supplyChainTwinRiskSignal.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code,
        },
      },
      create: {
        tenantId: tenant.id,
        code,
        severity,
        title: `Perf fixture signal ${i}`,
        detail: `Synthetic ${severity} signal for twin pagination/perf validation.`,
      },
      update: {
        severity,
        title: `Perf fixture signal ${i}`,
        detail: `Synthetic ${severity} signal for twin pagination/perf validation.`,
      },
    });
  }

  // Keep scenario fixture deterministic across reruns even if `SCENARIO_COUNT` changes.
  await prisma.supplyChainTwinScenarioDraft.deleteMany({
    where: {
      tenantId: tenant.id,
      title: { startsWith: "Perf fixture scenario " },
    },
  });
  for (let i = 0; i < SCENARIO_COUNT; i += 1) {
    const id = `cl${String(i).padStart(10, "0")}perfseedx`;
    await assertScenarioIdTenantOwnership(id, tenant.id);
    await prisma.supplyChainTwinScenarioDraft.upsert({
      where: { id },
      create: {
        id,
        tenantId: tenant.id,
        title: `Perf fixture scenario ${i}`,
        status: i % 7 === 0 ? "archived" : "draft",
        draftJson: {
          fixtureTag: FIXTURE_TAG,
          scenarioOrdinal: i,
          shocks: [{ type: "lead_time_days", delta: (i % 9) - 4 }],
        },
      },
      update: {
        tenantId: tenant.id,
        title: `Perf fixture scenario ${i}`,
        status: i % 7 === 0 ? "archived" : "draft",
        draftJson: {
          fixtureTag: FIXTURE_TAG,
          scenarioOrdinal: i,
          shocks: [{ type: "lead_time_days", delta: (i % 9) - 4 }],
        },
      },
    });
  }

  console.log(
    `[db:seed:supply-chain-twin-large-fixture] OK — tenant "${tenant.name}" (${DEMO_SLUG}): ` +
      `${ENTITY_COUNT} entities, ${edgeRows.length} edges, ${EVENT_COUNT} events, ${RISK_COUNT} risks, ${SCENARIO_COUNT} scenarios.`,
  );
}

main()
  .catch((e) => {
    console.error("[db:seed:supply-chain-twin-large-fixture] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
