/**
 * Fix Prisma P3009 for migration `20260409140000_supplier_extended_details`
 * after a failed `migrate deploy` (e.g. pooler timeout).
 *
 * Uses the same URL order as prisma.config.ts (UNPOOLED / DIRECT / DATABASE).
 *
 * Usage (production URL from Vercel → paste into .env.local or export):
 *   npm run db:repair:supplier-migration
 *   npm run db:repair:supplier-migration -- --dry-run
 *
 * Then: npx prisma migrate deploy — or on Vercel set PRISMA_REPAIR_SUPPLIER_MIGRATION=1 for one build
 * (see scripts/vercel-build.cjs), then remove it after a successful deploy.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = "20260409140000_supplier_extended_details";
const MIGRATION_DIR = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  MIGRATION,
);

function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
}

function dsn() {
  return (
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    ""
  );
}

/** SQL after Supplier ALTER — SupplierContact table, indexes, FKs. */
function tailStatementsFromMigrationFile() {
  const sqlPath = path.join(MIGRATION_DIR, "migration.sql");
  const full = fs.readFileSync(sqlPath, "utf8");
  const i = full.indexOf('CREATE TABLE "SupplierContact"');
  if (i === -1) {
    throw new Error(`Could not find SupplierContact DDL in ${sqlPath}`);
  }
  const tail = full.slice(i);
  const parts = tail.split(/\n(?=-- )/);
  const out = [];
  for (const part of parts) {
    const s = part.replace(/^-- [^\n]+\n?/m, "").trim();
    if (s) out.push(s.endsWith(";") ? s : `${s};`);
  }
  return out;
}

async function main() {
  const dry =
    process.argv.includes("--dry-run") || process.argv.includes("-n");
  loadEnvFiles();
  const connectionString = dsn();
  if (!connectionString) {
    console.error(
      "Set DATABASE_URL_UNPOOLED (recommended), DIRECT_URL, or DATABASE_URL.\n" +
        "For Neon, use the direct (non-pooler) connection string from the dashboard.",
    );
    process.exit(1);
  }

  const client = new pg.Client({ connectionString });
  await client.connect();

  const { rows: col } = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'Supplier' AND column_name = 'legalName'`,
  );
  const supplierExtended = col.length > 0;

  const { rows: tab } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'SupplierContact'`,
  );
  const contactTable = tab.length > 0;

  const { rows: mig } = await client.query(
    `SELECT migration_name, finished_at, rolled_back_at, started_at
     FROM "_prisma_migrations"
     WHERE migration_name = $1`,
    [MIGRATION],
  );
  const row = mig[0];

  console.log("Database check:", {
    supplierExtended,
    contactTable,
    migration: row
      ? {
          finished_at: row.finished_at,
          rolled_back_at: row.rolled_back_at,
          started_at: row.started_at,
        }
      : null,
  });

  if (row?.finished_at && !row?.rolled_back_at) {
    console.log(
      "\nThis migration is already marked applied. Run:\n  npx prisma migrate deploy\n",
    );
    await client.end();
    return;
  }

  if (!supplierExtended && contactTable) {
    console.error(
      "\nInconsistent state: SupplierContact exists but Supplier has no extended columns.\n" +
        "Manual repair or restore from backup is required.\n",
    );
    await client.end();
    process.exit(1);
  }

  const prismaEnv = {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
  };

  if (supplierExtended && contactTable) {
    console.log(
      "\n→ DDL matches a full migration. Marking as applied (prisma migrate resolve --applied).\n",
    );
    await client.end();
    if (dry) return;
    const r = spawnSync(
      "npx",
      ["prisma", "migrate", "resolve", "--applied", MIGRATION],
      { stdio: "inherit", env: prismaEnv, shell: true },
    );
    process.exit(r.status ?? 1);
  }

  if (!supplierExtended && !contactTable) {
    console.log(
      "\n→ No Supplier extended columns / no SupplierContact. " +
        "Marking failed migration rolled back so deploy can retry.\n" +
        "  (prisma migrate resolve --rolled-back)\n",
    );
    await client.end();
    if (dry) return;
    const r = spawnSync(
      "npx",
      ["prisma", "migrate", "resolve", "--rolled-back", MIGRATION],
      { stdio: "inherit", env: prismaEnv, shell: true },
    );
    process.exit(r.status ?? 1);
  }

  // Partial: Supplier ALTER ran, SupplierContact not present
  console.log(
    "\n→ Supplier columns exist but SupplierContact is missing. " +
      "Applying remaining DDL, then marking migration applied.\n",
  );
  const stmts = tailStatementsFromMigrationFile();
  if (dry) {
    console.log("--dry-run: would execute:\n", stmts.join("\n\n---\n\n"));
    await client.end();
    return;
  }

  try {
    await client.query("BEGIN");
    for (const q of stmts) {
      await client.query(q);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    await client.end();
    console.error("\nApplying tail DDL failed:", e.message);
    process.exit(1);
  }
  await client.end();

  console.log("\n→ Marking migration applied (prisma migrate resolve --applied).\n");
  const r = spawnSync(
    "npx",
    ["prisma", "migrate", "resolve", "--applied", MIGRATION],
    { stdio: "inherit", env: prismaEnv, shell: true },
  );
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
