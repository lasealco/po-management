/**
 * Idempotent Supply Chain Twin catalog demo row (`demo-company` tenant only).
 *
 * Run: `npm run db:seed:supply-chain-twin-demo` (optional `USE_DOTENV_LOCAL=1` from repo root — see other db:seed scripts)
 *
 * Prerequisites:
 * - DATABASE_URL
 * - Migrations through `20260427100000_supply_chain_twin_risk_signal` (twin snapshots + edges + ingest + risk)
 * - Main `npm run db:seed` at least once (tenant `demo-company`)
 *
 * After run: open `/supply-chain-twin` — Twin entity catalog lists one supplier node.
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
      AND table_name IN ('SupplyChainTwinEntitySnapshot', 'SupplyChainTwinRiskSignal')
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

  console.log(
    `[db:seed:supply-chain-twin-demo] OK — tenant "${tenant.name}" (${DEMO_SLUG}): ` +
      `${DEMO_ENTITY_KIND} / ${DEMO_ENTITY_KEY}; risk ${DEMO_RISK_CODE} (MEDIUM). Open /supply-chain-twin.`,
  );
}

main()
  .catch((e) => {
    console.error("[db:seed:supply-chain-twin-demo] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
