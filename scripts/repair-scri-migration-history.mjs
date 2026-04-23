/**
 * When `_prisma_migrations` says SCRI migrations ran but `ScriExternalEvent` is missing
 * (history out of sync with schema), remove those two rows and re-run `prisma migrate deploy`.
 *
 * Uses the same URL order as prisma.config.ts: UNPOOLED → DIRECT → DATABASE.
 *
 *   npm run db:repair:scri-migrations
 */
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const MIGRATIONS = [
  "20260430200000_scri_r1_external_events",
  "20260430210000_scri_r2_affected_entities",
];

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) {
  process.env.DATABASE_URL = cliDatabaseUrl;
}

function dsn() {
  return (
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

const url = dsn();
if (!url) {
  console.error("[repair:scri] Missing DATABASE_URL (or UNPOOLED/DIRECT).");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

async function tableExists(client, name) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

async function main() {
  const client = await pool.connect();
  try {
    if (await tableExists(client, "ScriExternalEvent")) {
      console.log(
        "[repair:scri] ScriExternalEvent already exists — nothing to repair.",
      );
      return;
    }

    const del = await client.query(
      `DELETE FROM "_prisma_migrations"
       WHERE migration_name = ANY($1::text[])`,
      [MIGRATIONS],
    );
    console.log(
      `[repair:scri] Removed ${del.rowCount} row(s) from _prisma_migrations (SCRI only).`,
    );
  } finally {
    client.release();
    await pool.end();
  }

  const r = spawnSync("npm", ["run", "db:migrate"], {
    env: { ...process.env },
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
  console.log("[repair:scri] Done. You can run: npm run db:seed:scri");
}

main().catch((e) => {
  console.error("[repair:scri]", e);
  process.exit(1);
});
