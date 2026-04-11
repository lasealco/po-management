/**
 * Apply Prisma migrations using node-pg only (same stack as db:ping).
 * Use when `prisma migrate deploy` fails with P1001 but `npm run db:ping` works.
 *
 * Checksums: SHA-256 of migration.sql bytes on disk (same as `shasum -a 256`).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "prisma", "migrations");

function loadEnvLocal() {
  const envLocal = path.join(root, ".env.local");
  if (!fs.existsSync(envLocal)) {
    console.error("prisma-migrate-pg: missing .env.local");
    process.exit(1);
  }
  const raw = fs.readFileSync(envLocal, "utf8").replace(/^\uFEFF/, "");
  const parsed = dotenv.parse(raw);
  for (const [k, v] of Object.entries(parsed)) {
    if (v !== undefined) process.env[k] = v;
  }
}

function connectionString() {
  return (
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL
  );
}

function migrationChecksum(sqlPath) {
  return crypto.createHash("sha256").update(fs.readFileSync(sqlPath)).digest("hex");
}

const DDL = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
`;

async function main() {
  loadEnvLocal();
  const url = connectionString();
  if (!url) {
    console.error("prisma-migrate-pg: set DATABASE_URL in .env.local");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 20000,
  });
  await client.connect();

  await client.query(DDL);

  const { rows: appliedRows } = await client.query(
    `SELECT "migration_name", "checksum" FROM "_prisma_migrations"
     WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL`,
  );
  const applied = new Map(appliedRows.map((r) => [r.migration_name, r.checksum]));

  const { rows: stuck } = await client.query(
    `SELECT "migration_name" FROM "_prisma_migrations"
     WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL`,
  );
  if (stuck.length > 0) {
    console.error(
      "prisma-migrate-pg: unfinished migration rows (fix with Neon SQL or prisma migrate repair):",
      stuck.map((r) => r.migration_name).join(", "),
    );
    process.exit(1);
  }

  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !name.startsWith("."))
    .sort();

  let appliedCount = 0;
  for (const name of dirs) {
    const sqlPath = path.join(migrationsDir, name, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    const checksum = migrationChecksum(sqlPath);
    const prev = applied.get(name);
    if (prev) {
      if (prev !== checksum) {
        console.error(
          `prisma-migrate-pg: checksum mismatch for ${name} (DB vs disk). Do not edit applied migrations; use prisma migrate repair if intentional.`,
        );
        process.exit(1);
      }
      continue;
    }

    const sql = fs.readFileSync(sqlPath, "utf8");
    const id = crypto.randomUUID();

    console.log(`prisma-migrate-pg: applying ${name} …`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO "_prisma_migrations"
         ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`,
        [id, checksum, name],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      console.error(`prisma-migrate-pg: FAILED on ${name}:`, e.message);
      process.exit(1);
    }
    applied.set(name, checksum);
    appliedCount += 1;
  }

  await client.end();

  if (appliedCount === 0) {
    console.log("prisma-migrate-pg: nothing pending (already in sync).");
  } else {
    console.log(`prisma-migrate-pg: applied ${appliedCount} migration(s).`);
  }
}

main().catch((e) => {
  console.error("prisma-migrate-pg:", e);
  process.exit(1);
});
