/**
 * Idempotent Supply Chain Twin catalog demo row (`demo-company` tenant only).
 *
 * Run: `npm run db:seed:supply-chain-twin-demo` (optional `USE_DOTENV_LOCAL=1` from repo root — see other db:seed scripts)
 *
 * Prerequisites:
 * - DATABASE_URL
 * - Migrations through `20260428103000_supply_chain_twin_scenario_drafts` (includes scenario drafts for Slice 67)
 * - Main `npm run db:seed` at least once (tenant `demo-company`)
 *
 * After run: open `/supply-chain-twin` — Twin entity catalog lists one supplier node. Two fixed-id scenario drafts are
 * upserted for `/supply-chain-twin/scenarios/compare` (see console output for `left` / `right` query values).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const DEMO_SLUG = "demo-company";
/** Must match `src/lib/supply-chain-twin/demo-seed.ts`. */
const DEMO_ENTITY_KIND = "supplier";
const DEMO_ENTITY_KEY = "DEMO-SCTWIN-SEED-SUPPLIER";
/** Must match `src/lib/supply-chain-twin/demo-seed.ts` (`SCTWIN_DEMO_SEED_RISK_CODE`). */
const DEMO_RISK_CODE = "DEMO-SCTWIN-SEED-RISK";
const DEMO_RISK_HIGH_CODE = "DEMO-SCTWIN-SEED-RISK-HIGH";
const DEMO_INGEST_EVENT_1_KEY = "seed-sctwin-event-entity-upsert-v1";
const DEMO_INGEST_EVENT_2_KEY = "seed-sctwin-event-risk-signal-v1";

/**
 * Slice 67 — stable primary keys for compare demos (`TwinScenarioDraft` / compare URL validation: lowercase
 * `[a-z][a-z0-9]{11,127}`). Idempotent `upsert` by `id` only for `demo-company`.
 */
const DEMO_SCENARIO_COMPARE_LEFT_ID = "cldemocompareleftaa00";
const DEMO_SCENARIO_COMPARE_RIGHT_ID = "cldemocomparerightab0";

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

async function main() {
  const tableRows = await prisma.$queryRaw`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('SupplyChainTwinEntitySnapshot', 'SupplyChainTwinRiskSignal', 'SupplyChainTwinScenarioDraft', 'SupplyChainTwinIngestEvent')
  `;
  const found = new Set((Array.isArray(tableRows) ? tableRows : []).map((r) => r.table_name));
  if (!found.has("SupplyChainTwinEntitySnapshot")) {
    console.error(
      "[db:seed:supply-chain-twin-demo] Table SupplyChainTwinEntitySnapshot is missing.\n" +
        "  Run: npm run db:migrate   then retry.",
    );
    process.exit(1);
  }
  if (!found.has("SupplyChainTwinRiskSignal")) {
    console.error(
      "[db:seed:supply-chain-twin-demo] Table SupplyChainTwinRiskSignal is missing.\n" +
        "  Run: npm run db:migrate   then retry.",
    );
    process.exit(1);
  }
  if (!found.has("SupplyChainTwinScenarioDraft")) {
    console.error(
      "[db:seed:supply-chain-twin-demo] Table SupplyChainTwinScenarioDraft is missing.\n" +
        "  Run: npm run db:migrate   then retry.",
    );
    process.exit(1);
  }
  if (!found.has("SupplyChainTwinIngestEvent")) {
    console.error(
      "[db:seed:supply-chain-twin-demo] Table SupplyChainTwinIngestEvent is missing.\n" +
        "  Run: npm run db:migrate   then retry.",
    );
    process.exit(1);
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

  await prisma.supplyChainTwinRiskSignal.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: DEMO_RISK_CODE,
      },
    },
    create: {
      tenantId: tenant.id,
      code: DEMO_RISK_CODE,
      severity: "MEDIUM",
      title: "Demo Twin — seeded latency watch (non-production)",
      detail: "Slice-22 placeholder risk row for investor demos; not evaluated from live KPIs.",
    },
    update: {
      severity: "MEDIUM",
      title: "Demo Twin — seeded latency watch (non-production)",
      detail: "Slice-22 placeholder risk row for investor demos; not evaluated from live KPIs.",
    },
  });

  await prisma.supplyChainTwinRiskSignal.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: DEMO_RISK_HIGH_CODE,
      },
    },
    create: {
      tenantId: tenant.id,
      code: DEMO_RISK_HIGH_CODE,
      severity: "HIGH",
      title: "Demo Twin — seeded disruption alert (non-production)",
      detail: "Slice-84 demo risk row for severity filtering and overview callouts.",
    },
    update: {
      severity: "HIGH",
      title: "Demo Twin — seeded disruption alert (non-production)",
      detail: "Slice-84 demo risk row for severity filtering and overview callouts.",
    },
  });

  await prisma.supplyChainTwinEntitySnapshot.upsert({
    where: {
      tenantId_entityKind_entityKey: {
        tenantId: tenant.id,
        entityKind: DEMO_ENTITY_KIND,
        entityKey: DEMO_ENTITY_KEY,
      },
    },
    create: {
      tenantId: tenant.id,
      entityKind: DEMO_ENTITY_KIND,
      entityKey: DEMO_ENTITY_KEY,
      payload: {
        label: "Demo Twin — seeded supplier",
        source: "seed-supply-chain-twin-demo",
      },
    },
    update: {
      payload: {
        label: "Demo Twin — seeded supplier",
        source: "seed-supply-chain-twin-demo",
      },
    },
  });

  const draftJsonLeft = {
    scenarioLabel: "baseline_lane",
    leadTimeDays: 14,
    monthlyUnits: 1200,
    bufferStockDays: 5,
  };
  const draftJsonRight = {
    scenarioLabel: "expedited_lane",
    expediteFeeUsd: 250,
    monthlyUnits: 1100,
    alternatePorts: ["baltimore", "norfolk"],
  };

  await prisma.supplyChainTwinScenarioDraft.upsert({
    where: { id: DEMO_SCENARIO_COMPARE_LEFT_ID },
    create: {
      id: DEMO_SCENARIO_COMPARE_LEFT_ID,
      tenantId: tenant.id,
      title: "Demo compare — baseline lane",
      status: "draft",
      draftJson: draftJsonLeft,
    },
    update: {
      tenantId: tenant.id,
      title: "Demo compare — baseline lane",
      status: "draft",
      draftJson: draftJsonLeft,
    },
  });

  await prisma.supplyChainTwinIngestEvent.upsert({
    where: {
      tenantId_idempotencyKey: {
        tenantId: tenant.id,
        idempotencyKey: DEMO_INGEST_EVENT_1_KEY,
      },
    },
    create: {
      tenantId: tenant.id,
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
    where: {
      tenantId_idempotencyKey: {
        tenantId: tenant.id,
        idempotencyKey: DEMO_INGEST_EVENT_2_KEY,
      },
    },
    create: {
      tenantId: tenant.id,
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

  await prisma.supplyChainTwinScenarioDraft.upsert({
    where: { id: DEMO_SCENARIO_COMPARE_RIGHT_ID },
    create: {
      id: DEMO_SCENARIO_COMPARE_RIGHT_ID,
      tenantId: tenant.id,
      title: "Demo compare — expedited lane",
      status: "draft",
      draftJson: draftJsonRight,
    },
    update: {
      tenantId: tenant.id,
      title: "Demo compare — expedited lane",
      status: "draft",
      draftJson: draftJsonRight,
    },
  });

  const compareUrl =
    `/supply-chain-twin/scenarios/compare?left=${encodeURIComponent(DEMO_SCENARIO_COMPARE_LEFT_ID)}` +
    `&right=${encodeURIComponent(DEMO_SCENARIO_COMPARE_RIGHT_ID)}`;

  console.log(
    `[db:seed:supply-chain-twin-demo] OK — tenant "${tenant.name}" (${DEMO_SLUG}): ` +
      `${DEMO_ENTITY_KIND} / ${DEMO_ENTITY_KEY}; risks ${DEMO_RISK_CODE} (MEDIUM) + ${DEMO_RISK_HIGH_CODE} (HIGH); ` +
      `events entity_upsert + risk_signal; ` +
      `compare drafts ${DEMO_SCENARIO_COMPARE_LEFT_ID} / ${DEMO_SCENARIO_COMPARE_RIGHT_ID}.`,
  );
  console.log(`[db:seed:supply-chain-twin-demo] Compare demo URL: ${compareUrl}`);
}

main()
  .catch((e) => {
    console.error("[db:seed:supply-chain-twin-demo] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
