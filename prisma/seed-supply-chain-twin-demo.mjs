/**
 * Idempotent Supply Chain Twin **customer demo** pack for tenant `demo-company`.
 *
 * Run: `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-demo`
 *
 * Prerequisites:
 * - DATABASE_URL (with `USE_DOTENV_LOCAL=1`, same merge as `npm run db:seed` — includes `.env.local` for Neon)
 * - Migrations applied on **that same** database. If you use Neon in `.env.local` but keep a local `DATABASE_URL`
 *   in `.env`, run `npm run db:migrate:local` (not plain `db:migrate`) so Prisma targets Neon before this seed.
 * - Main `npm run db:seed` at least once (tenant `demo-company`)
 *
 * After run, open (as a demo user with Twin access):
 * - `/supply-chain-twin` — overview + risk callouts
 * - `/supply-chain-twin/explorer` — multi-node catalog (supplier, DC, store, SKU, shipment)
 * - Pick **Aurora Components** in explorer → graph + neighbors show inbound network
 * - `/supply-chain-twin/scenarios` — three drafts (two for compare + one walkthrough)
 * - Compare URL is printed at end of this script
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const DEMO_SLUG = "demo-company";

/** Primary supplier — must match `src/lib/supply-chain-twin/demo-seed.ts`. */
const DEMO_ENTITY_KIND = "supplier";
const DEMO_ENTITY_KEY = "DEMO-SCTWIN-SEED-SUPPLIER";

/** Must match `src/lib/supply-chain-twin/demo-seed.ts` (`SCTWIN_DEMO_SEED_RISK_CODE`). */
const DEMO_RISK_CODE = "DEMO-SCTWIN-SEED-RISK";
const DEMO_RISK_HIGH_CODE = "DEMO-SCTWIN-SEED-RISK-HIGH";
const DEMO_RISK_PORT_CODE = "DEMO-SCTWIN-SEED-RISK-PORT";

const DEMO_WAREHOUSE_KEY = "DEMO-SCTWIN-SEED-DC-EAST";
const DEMO_SITE_KEY = "DEMO-SCTWIN-SEED-SITE-CHI";
const DEMO_SKU_KEY = "DEMO-SCTWIN-SEED-SKU-SMART-LAMP";
const DEMO_SHIPMENT_KEY = "DEMO-SCTWIN-SEED-OCEAN-CONTAINER-01";

const DEMO_INGEST_EVENT_1_KEY = "seed-sctwin-event-entity-upsert-v1";
const DEMO_INGEST_EVENT_2_KEY = "seed-sctwin-event-risk-signal-v1";
const DEMO_INGEST_EVENT_3_KEY = "seed-sctwin-event-entity-network-v1";
const DEMO_INGEST_EVENT_4_KEY = "seed-sctwin-event-lane-update-v1";

/** Stable primary keys for compare demos (`TwinScenarioDraft`). Idempotent upsert by `id` for `demo-company` only. */
const DEMO_SCENARIO_COMPARE_LEFT_ID = "cldemocompareleftaa00";
const DEMO_SCENARIO_COMPARE_RIGHT_ID = "cldemocomparerightab0";
/** Extra draft for scenarios list + history walkthrough (not used by compare URL). */
const DEMO_SCENARIO_WALKTHROUGH_ID = "cldemocustomerscen00";

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) {
  process.env.DATABASE_URL = cliDatabaseUrl;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[db:seed:supply-chain-twin-demo] Missing DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  ),
});

async function assertScenarioIdTenantOwnership(id, tenantId) {
  const existing = await prisma.supplyChainTwinScenarioDraft.findUnique({
    where: { id },
    select: { tenantId: true },
  });
  if (existing && existing.tenantId !== tenantId) {
    console.error(
      `[db:seed:supply-chain-twin-demo] Scenario id collision for "${id}". ` +
        `Existing row belongs to another tenant; refusing to mutate cross-tenant data.`,
    );
    process.exit(1);
  }
}

async function upsertEntitySnapshot(tenantId, entityKind, entityKey, payload) {
  return prisma.supplyChainTwinEntitySnapshot.upsert({
    where: {
      tenantId_entityKind_entityKey: {
        tenantId,
        entityKind,
        entityKey,
      },
    },
    create: {
      tenantId,
      entityKind,
      entityKey,
      payload,
    },
    update: {
      payload,
    },
    select: { id: true },
  });
}

async function ensureEdge(tenantId, fromSnapshotId, toSnapshotId, relation) {
  const existing = await prisma.supplyChainTwinEntityEdge.findFirst({
    where: { tenantId, fromSnapshotId, toSnapshotId, relation },
    select: { id: true },
  });
  if (existing) return;
  await prisma.supplyChainTwinEntityEdge.create({
    data: { tenantId, fromSnapshotId, toSnapshotId, relation },
  });
}

async function snapshotIdFor(tenantId, entityKind, entityKey) {
  const row = await prisma.supplyChainTwinEntitySnapshot.findUnique({
    where: {
      tenantId_entityKind_entityKey: {
        tenantId,
        entityKind,
        entityKey,
      },
    },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function main() {
  const tableRows = await prisma.$queryRaw`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'SupplyChainTwinEntitySnapshot',
        'SupplyChainTwinEntityEdge',
        'SupplyChainTwinRiskSignal',
        'SupplyChainTwinScenarioDraft',
        'SupplyChainTwinScenarioRevision',
        'SupplyChainTwinIngestEvent'
      )
  `;
  const found = new Set((Array.isArray(tableRows) ? tableRows : []).map((r) => r.table_name));
  for (const required of [
    "SupplyChainTwinEntitySnapshot",
    "SupplyChainTwinEntityEdge",
    "SupplyChainTwinRiskSignal",
    "SupplyChainTwinScenarioDraft",
    "SupplyChainTwinIngestEvent",
  ]) {
    if (!found.has(required)) {
      console.error(
        `[db:seed:supply-chain-twin-demo] Table ${required} is missing.\n` +
          "  Run: npm run db:migrate   then retry.",
      );
      process.exit(1);
    }
  }
  if (!found.has("SupplyChainTwinScenarioRevision")) {
    console.warn(
      "[db:seed:supply-chain-twin-demo] SupplyChainTwinScenarioRevision missing — skip revision seed. Run db:migrate.",
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SLUG },
    select: { id: true, name: true },
  });
  if (!tenant) {
    console.error(
      `[db:seed:supply-chain-twin-demo] Tenant slug "${DEMO_SLUG}" not found. Run npm run db:seed first.`,
    );
    process.exit(1);
  }

  const tid = tenant.id;

  await prisma.supplyChainTwinRiskSignal.upsert({
    where: { tenantId_code: { tenantId: tid, code: DEMO_RISK_CODE } },
    create: {
      tenantId: tid,
      code: DEMO_RISK_CODE,
      severity: "MEDIUM",
      title: "Lead time drift — Midwest lane",
      detail:
        "Seeded demo signal: modeled transit time is 2–4 days above the rolling 8-week baseline. Use for acknowledgement and severity filters.",
      acknowledged: true,
      acknowledgedAt: new Date("2026-04-01T14:00:00.000Z"),
      acknowledgedByActorId: null,
    },
    update: {
      severity: "MEDIUM",
      title: "Lead time drift — Midwest lane",
      detail:
        "Seeded demo signal: modeled transit time is 2–4 days above the rolling 8-week baseline. Use for acknowledgement and severity filters.",
      acknowledged: true,
      acknowledgedAt: new Date("2026-04-01T14:00:00.000Z"),
      acknowledgedByActorId: null,
    },
  });

  await prisma.supplyChainTwinRiskSignal.upsert({
    where: { tenantId_code: { tenantId: tid, code: DEMO_RISK_HIGH_CODE } },
    create: {
      tenantId: tid,
      code: DEMO_RISK_HIGH_CODE,
      severity: "HIGH",
      title: "Disruption watch — alternate port congestion",
      detail:
        "Seeded demo signal: berth window risk on the alternate discharge port for expedited replenishment. Pair with scenarios compare for a live storyline.",
    },
    update: {
      severity: "HIGH",
      title: "Disruption watch — alternate port congestion",
      detail:
        "Seeded demo signal: berth window risk on the alternate discharge port for expedited replenishment. Pair with scenarios compare for a live storyline.",
    },
  });

  await prisma.supplyChainTwinRiskSignal.upsert({
    where: { tenantId_code: { tenantId: tid, code: DEMO_RISK_PORT_CODE } },
    create: {
      tenantId: tid,
      code: DEMO_RISK_PORT_CODE,
      severity: "LOW",
      title: "Port schedule noise — Baltimore",
      detail: "Seeded demo signal: minor schedule variance; useful for severity filters and exports.",
    },
    update: {
      severity: "LOW",
      title: "Port schedule noise — Baltimore",
      detail: "Seeded demo signal: minor schedule variance; useful for severity filters and exports.",
    },
  });

  await upsertEntitySnapshot(tid, "supplier", DEMO_ENTITY_KEY, {
    label: "Aurora Components Inc.",
    region: "North America",
    tier: "strategic",
    source: "seed-supply-chain-twin-demo",
    story:
      "Primary contract manufacturer for the hero SKU in this walkthrough. Explorer → open this node to show neighbors + stub graph.",
  });

  await upsertEntitySnapshot(tid, "warehouse", DEMO_WAREHOUSE_KEY, {
    label: "East Coast DC — Carteret, NJ",
    code: "DC-EAST-01",
    capacityUtilizationPct: 0.78,
    source: "seed-supply-chain-twin-demo",
  });

  await upsertEntitySnapshot(tid, "site", DEMO_SITE_KEY, {
    label: "Flagship store — Chicago, IL",
    format: "retail",
    weeklyDemandUnits: 420,
    source: "seed-supply-chain-twin-demo",
  });

  await upsertEntitySnapshot(tid, "sku", DEMO_SKU_KEY, {
    label: "Smart LED floor lamp — SKU-4421",
    category: "Home lighting",
    abcClass: "A",
    source: "seed-supply-chain-twin-demo",
  });

  await upsertEntitySnapshot(tid, "shipment", DEMO_SHIPMENT_KEY, {
    label: "Ocean move — Ningbo → Newark",
    mode: "ocean",
    containerId: "MSKU9988776",
    etd: "2026-04-18",
    eta: "2026-05-12",
    source: "seed-supply-chain-twin-demo",
  });

  const supplierId = await snapshotIdFor(tid, "supplier", DEMO_ENTITY_KEY);
  const warehouseId = await snapshotIdFor(tid, "warehouse", DEMO_WAREHOUSE_KEY);
  const siteId = await snapshotIdFor(tid, "site", DEMO_SITE_KEY);
  const skuId = await snapshotIdFor(tid, "sku", DEMO_SKU_KEY);
  const shipmentId = await snapshotIdFor(tid, "shipment", DEMO_SHIPMENT_KEY);
  if (!supplierId || !warehouseId || !siteId || !skuId || !shipmentId) {
    console.error("[db:seed:supply-chain-twin-demo] Failed to resolve snapshot ids after upsert.");
    process.exit(1);
  }

  await ensureEdge(tid, supplierId, warehouseId, "primary_inbound_lane");
  await ensureEdge(tid, warehouseId, skuId, "fulfills_demand");
  await ensureEdge(tid, supplierId, skuId, "contract_manufactures");
  await ensureEdge(tid, warehouseId, siteId, "store_replenishment");
  await ensureEdge(tid, shipmentId, warehouseId, "docks_at");

  const draftJsonLeft = {
    scenarioLabel: "baseline_lane",
    leadTimeDays: 14,
    monthlyUnits: 1200,
    bufferStockDays: 5,
    narrative: "Balanced cost/service posture for Q3 sell-in.",
  };
  const draftJsonRight = {
    scenarioLabel: "expedited_lane",
    expediteFeeUsd: 250,
    monthlyUnits: 1100,
    alternatePorts: ["baltimore", "norfolk"],
    narrative: "Protects in-stock on hero SKU during port volatility windows.",
  };
  const draftJsonWalkthrough = {
    scenarioLabel: "exec_walkthrough",
    focus: "resilience",
    checkpoints: ["readiness", "explorer", "scenarios_compare", "risk_ack", "events_export"],
    notes: "Use this draft to narrate the twin spine without changing compare URLs.",
  };

  await assertScenarioIdTenantOwnership(DEMO_SCENARIO_COMPARE_LEFT_ID, tid);
  await assertScenarioIdTenantOwnership(DEMO_SCENARIO_COMPARE_RIGHT_ID, tid);
  await assertScenarioIdTenantOwnership(DEMO_SCENARIO_WALKTHROUGH_ID, tid);

  await prisma.supplyChainTwinScenarioDraft.upsert({
    where: { id: DEMO_SCENARIO_COMPARE_LEFT_ID },
    create: {
      id: DEMO_SCENARIO_COMPARE_LEFT_ID,
      tenantId: tid,
      title: "Q3 plan — baseline ocean + DC safety stock",
      status: "draft",
      draftJson: draftJsonLeft,
    },
    update: {
      tenantId: tid,
      title: "Q3 plan — baseline ocean + DC safety stock",
      status: "draft",
      draftJson: draftJsonLeft,
    },
  });

  await prisma.supplyChainTwinScenarioDraft.upsert({
    where: { id: DEMO_SCENARIO_COMPARE_RIGHT_ID },
    create: {
      id: DEMO_SCENARIO_COMPARE_RIGHT_ID,
      tenantId: tid,
      title: "Q3 plan — expedited lane + alternate discharge",
      status: "draft",
      draftJson: draftJsonRight,
    },
    update: {
      tenantId: tid,
      title: "Q3 plan — expedited lane + alternate discharge",
      status: "draft",
      draftJson: draftJsonRight,
    },
  });

  await prisma.supplyChainTwinScenarioDraft.upsert({
    where: { id: DEMO_SCENARIO_WALKTHROUGH_ID },
    create: {
      id: DEMO_SCENARIO_WALKTHROUGH_ID,
      tenantId: tid,
      title: "Customer walkthrough — twin spine (read-only storyline)",
      status: "draft",
      draftJson: draftJsonWalkthrough,
    },
    update: {
      tenantId: tid,
      title: "Customer walkthrough — twin spine (read-only storyline)",
      status: "draft",
      draftJson: draftJsonWalkthrough,
    },
  });

  if (found.has("SupplyChainTwinScenarioRevision")) {
    const revCount = await prisma.supplyChainTwinScenarioRevision.count({
      where: { scenarioDraftId: DEMO_SCENARIO_WALKTHROUGH_ID },
    });
    if (revCount === 0) {
      const now = new Date();
      await prisma.supplyChainTwinScenarioRevision.createMany({
        data: [
          {
            tenantId: tid,
            scenarioDraftId: DEMO_SCENARIO_WALKTHROUGH_ID,
            actorId: null,
            action: "draft_created",
            titleBefore: null,
            titleAfter: "Customer walkthrough — twin spine (read-only storyline)",
            statusBefore: null,
            statusAfter: "draft",
            createdAt: new Date(now.getTime() - 86_400_000 * 2),
          },
          {
            tenantId: tid,
            scenarioDraftId: DEMO_SCENARIO_WALKTHROUGH_ID,
            actorId: null,
            action: "storyline_updated",
            titleBefore: "Customer walkthrough — twin spine (read-only storyline)",
            titleAfter: "Customer walkthrough — twin spine (read-only storyline)",
            statusBefore: "draft",
            statusAfter: "draft",
            createdAt: new Date(now.getTime() - 86_400_000),
          },
        ],
      });
    }
  }

  await prisma.supplyChainTwinIngestEvent.upsert({
    where: { tenantId_idempotencyKey: { tenantId: tid, idempotencyKey: DEMO_INGEST_EVENT_1_KEY } },
    create: {
      tenantId: tid,
      type: "entity_upsert",
      idempotencyKey: DEMO_INGEST_EVENT_1_KEY,
      payloadJson: {
        entityKind: DEMO_ENTITY_KIND,
        entityKey: DEMO_ENTITY_KEY,
        source: "seed-supply-chain-twin-demo",
      },
    },
    update: {
      type: "entity_upsert",
      payloadJson: {
        entityKind: DEMO_ENTITY_KIND,
        entityKey: DEMO_ENTITY_KEY,
        source: "seed-supply-chain-twin-demo",
      },
    },
  });

  await prisma.supplyChainTwinIngestEvent.upsert({
    where: { tenantId_idempotencyKey: { tenantId: tid, idempotencyKey: DEMO_INGEST_EVENT_2_KEY } },
    create: {
      tenantId: tid,
      type: "risk_signal",
      idempotencyKey: DEMO_INGEST_EVENT_2_KEY,
      payloadJson: {
        code: DEMO_RISK_HIGH_CODE,
        severity: "HIGH",
        source: "seed-supply-chain-twin-demo",
      },
    },
    update: {
      type: "risk_signal",
      payloadJson: {
        code: DEMO_RISK_HIGH_CODE,
        severity: "HIGH",
        source: "seed-supply-chain-twin-demo",
      },
    },
  });

  await prisma.supplyChainTwinIngestEvent.upsert({
    where: { tenantId_idempotencyKey: { tenantId: tid, idempotencyKey: DEMO_INGEST_EVENT_3_KEY } },
    create: {
      tenantId: tid,
      type: "network_refresh",
      idempotencyKey: DEMO_INGEST_EVENT_3_KEY,
      payloadJson: {
        summary: "Linked supplier → DC → SKU → store for customer demo",
        source: "seed-supply-chain-twin-demo",
      },
    },
    update: {
      type: "network_refresh",
      payloadJson: {
        summary: "Linked supplier → DC → SKU → store for customer demo",
        source: "seed-supply-chain-twin-demo",
      },
    },
  });

  await prisma.supplyChainTwinIngestEvent.upsert({
    where: { tenantId_idempotencyKey: { tenantId: tid, idempotencyKey: DEMO_INGEST_EVENT_4_KEY } },
    create: {
      tenantId: tid,
      type: "lane_parameters_updated",
      idempotencyKey: DEMO_INGEST_EVENT_4_KEY,
      payloadJson: {
        scenarioDraftId: DEMO_SCENARIO_COMPARE_LEFT_ID,
        leadTimeDays: 14,
        source: "seed-supply-chain-twin-demo",
      },
    },
    update: {
      type: "lane_parameters_updated",
      payloadJson: {
        scenarioDraftId: DEMO_SCENARIO_COMPARE_LEFT_ID,
        leadTimeDays: 14,
        source: "seed-supply-chain-twin-demo",
      },
    },
  });

  const compareUrl =
    `/supply-chain-twin/scenarios/compare?left=${encodeURIComponent(DEMO_SCENARIO_COMPARE_LEFT_ID)}` +
    `&right=${encodeURIComponent(DEMO_SCENARIO_COMPARE_RIGHT_ID)}`;

  console.log(
    `[db:seed:supply-chain-twin-demo] OK — tenant "${tenant.name}" (${DEMO_SLUG}): ` +
      `entities supplier+warehouse+site+sku+shipment; edges (5); risks ${DEMO_RISK_CODE} (MEDIUM, acked), ${DEMO_RISK_HIGH_CODE} (HIGH), ${DEMO_RISK_PORT_CODE} (LOW); ` +
      `ingest events ×4; scenarios compare ${DEMO_SCENARIO_COMPARE_LEFT_ID} / ${DEMO_SCENARIO_COMPARE_RIGHT_ID}; walkthrough ${DEMO_SCENARIO_WALKTHROUGH_ID}.`,
  );
  console.log(`[db:seed:supply-chain-twin-demo] Compare demo URL: ${compareUrl}`);
  console.log(
    `[db:seed:supply-chain-twin-demo] Walkthrough scenario: /supply-chain-twin/scenarios/${encodeURIComponent(DEMO_SCENARIO_WALKTHROUGH_ID)}`,
  );
  console.log(
    `[db:seed:supply-chain-twin-demo] Explorer: filter or search for "Aurora" / open supplier snapshot ${DEMO_ENTITY_KEY}.`,
  );

  await upsertEntitySnapshot(tid, "supplier", DEMO_ENTITY_KEY, {
    label: "Aurora Components Inc.",
    region: "North America",
    tier: "strategic",
    source: "seed-supply-chain-twin-demo",
    story:
      "Primary contract manufacturer for the hero SKU in this walkthrough. Explorer → open this node to show neighbors + stub graph.",
    demoFocus: true,
  });
}

main()
  .catch((e) => {
    console.error("[db:seed:supply-chain-twin-demo] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
