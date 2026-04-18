/**
 * SRM end-to-end readiness (automated slice):
 * 1. Runs `npm run verify:srm` (Prisma validate + tsc + Vitest `src/lib/srm`).
 * 2. If a Postgres URL is available, asserts core SRM tables/columns exist (post-migrate).
 * 3. If `Supplier` row `SUP-001` exists, asserts onboarding + document + alert rows (post-seed).
 *
 * Usage: `npm run verify:srm:with-db`
 *
 * Offline: omit `DATABASE_URL` / `.env.local` DB vars → step 1 only (exit 0).
 * Skip DB while `.env.local` has a URL: `SKIP_SRM_DB_VERIFY=1 npm run verify:srm:with-db`.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = path.join(root, ".env.local");
if (fs.existsSync(envLocal)) {
  const raw = fs.readFileSync(envLocal, "utf8").replace(/^\uFEFF/, "");
  const parsed = dotenv.parse(raw);
  for (const [k, v] of Object.entries(parsed)) {
    if (v !== undefined) process.env[k] = v;
  }
}

const verify = spawnSync("npm", ["run", "verify:srm"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (verify.status !== 0) {
  process.exit(verify.status ?? 1);
}

const skipDb =
  process.env.SKIP_SRM_DB_VERIFY === "1" ||
  process.env.SKIP_SRM_DB_VERIFY === "true";
if (skipDb) {
  console.log(
    "\nsrm-with-db-verify: SKIP_SRM_DB_VERIFY set — skipping DB checks (ran verify:srm only).",
  );
  process.exit(0);
}

const connectionString =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.log(
    "\nsrm-with-db-verify: no DATABASE_URL — skipping DB checks (still ran verify:srm).",
  );
  process.exit(0);
}

const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 20000,
});

async function assertSql(label, text, values = [], expectTrue = (row) => Boolean(row?.ok)) {
  const { rows } = await client.query(text, values);
  const ok = rows[0] && expectTrue(rows[0]);
  if (!ok) {
    console.error(`srm-with-db-verify: FAILED — ${label}`);
    console.error("  row:", rows[0]);
    if (label.startsWith("table ") || label.startsWith("column ")) {
      console.error(
        "  Hint: this database may be missing SRM migrations — run `npm run db:migrate` (then `npm run db:seed` for SUP-001 demo checks). See docs/srm/README.md.",
      );
    }
    process.exit(1);
  }
  console.log(`srm-with-db-verify: OK — ${label}`);
}

try {
  await client.connect();

  await assertSql(
    "table SupplierOnboardingTask",
    `SELECT to_regclass('public."SupplierOnboardingTask"') IS NOT NULL AS ok`,
  );
  await assertSql(
    "table SupplierDocument",
    `SELECT to_regclass('public."SupplierDocument"') IS NOT NULL AS ok`,
  );
  await assertSql(
    "table SupplierSrmAlert",
    `SELECT to_regclass('public."SupplierSrmAlert"') IS NOT NULL AS ok`,
  );

  await assertSql(
    "column SupplierDocument.expiresAt",
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'SupplierDocument' AND column_name = 'expiresAt'
    ) AS ok`,
  );
  await assertSql(
    "column SupplierDocument.archivedAt",
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'SupplierDocument' AND column_name = 'archivedAt'
    ) AS ok`,
  );

  const demo = await client.query(
    `SELECT id FROM "Supplier" WHERE code = 'SUP-001' LIMIT 1`,
  );
  if (demo.rows.length === 0) {
    console.log(
      "srm-with-db-verify: no SUP-001 row — run `npm run db:seed` for full demo data (migrate-only checks passed).",
    );
  } else {
    const supplierId = demo.rows[0].id;
    await assertSql(
      "seed SUP-001 has onboarding tasks",
      `SELECT EXISTS (SELECT 1 FROM "SupplierOnboardingTask" WHERE "supplierId" = $1) AS ok`,
      [supplierId],
    );
    await assertSql(
      "seed SUP-001 has documents",
      `SELECT EXISTS (SELECT 1 FROM "SupplierDocument" WHERE "supplierId" = $1) AS ok`,
      [supplierId],
    );
    await assertSql(
      "seed SUP-001 has SRM alerts",
      `SELECT EXISTS (SELECT 1 FROM "SupplierSrmAlert" WHERE "supplierId" = $1) AS ok`,
      [supplierId],
    );
  }

  console.log("\nsrm-with-db-verify: all checks passed.");
} catch (err) {
  console.error("srm-with-db-verify: DB error", err?.code || "", err?.message || err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
