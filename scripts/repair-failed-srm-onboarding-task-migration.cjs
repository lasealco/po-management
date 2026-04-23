/**
 * Fix Prisma P3009 for migration `20260422120000_supplier_onboarding_task_srm_phase_b`
 * (SRM Phase B — SupplierOnboardingTask) after a failed `migrate deploy` (e.g. pooler timeout).
 *
 * Uses the same URL order as prisma.config.ts (UNPOOLED / DIRECT / DATABASE).
 *
 *   npm run db:repair:srm-onboarding-task-migration
 *   npm run db:repair:srm-onboarding-task-migration -- --dry-run
 *
 * vercel-build runs this before prisma migrate deploy when SKIP_DB_MIGRATE is unset.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = "20260422120000_supplier_onboarding_task_srm_phase_b";
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

function runMigrateResolve(flag, prismaEnv) {
  const r = spawnSync(
    "npx",
    ["prisma", "migrate", "resolve", flag, MIGRATION],
    {
      env: prismaEnv,
      shell: true,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  const out = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
  if (r.status === 0) {
    if (out) console.log(out);
    return 0;
  }
  const p3008 =
    /\bP3008\b/.test(out) || /already recorded as applied/i.test(out);
  if (flag === "--applied" && p3008) {
    console.log(
      "[repair] Migration already recorded as applied (P3008) — continuing.\n",
    );
    return 0;
  }
  if (out) console.error(out);
  return r.status ?? 1;
}

function ignorableStatementError(e) {
  if (!e || typeof e !== "object") return false;
  const c = e.code;
  if (
    c === "42P07" ||
    c === "42710" ||
    c === "42P16" ||
    c === "23505" ||
    c === "42701"
  ) {
    return true;
  }
  const m = (e.message || "").toLowerCase();
  if (
    m.includes("already exists") ||
    m.includes("duplicate key") ||
    m.includes("duplicate relation")
  ) {
    return true;
  }
  return false;
}

/** One statement per entry (matches prisma/migrations/.../migration.sql). */
function statementsFromFile() {
  const sqlPath = path.join(MIGRATION_DIR, "migration.sql");
  const raw = fs.readFileSync(sqlPath, "utf8");
  const noLineComments = raw.replace(/--[^\n]*/g, "");
  return noLineComments
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(";") ? s : `${s};`));
}

async function tableExists(client) {
  const { rows } = await client.query(
    `SELECT to_regclass('public."SupplierOnboardingTask"') IS NOT NULL AS ok`,
  );
  return !!(rows[0] && rows[0].ok);
}

/** Full migration result: table + unique on (supplierId, taskKey) + 3 FKs. */
async function isComplete(client) {
  if (!(await tableExists(client))) return false;
  const { rows: uq } = await client.query(
    `SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'SupplierOnboardingTask_supplierId_taskKey_key' LIMIT 1`,
  );
  if (uq.length === 0) return false;
  const { rows: fks } = await client.query(
    `SELECT COUNT(*)::int AS n
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public' AND t.relname = 'SupplierOnboardingTask' AND c.contype = 'f'`,
  );
  return fks[0] && fks[0].n === 3;
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

  const { rows: mig } = await client.query(
    `SELECT migration_name, finished_at, started_at
     FROM "_prisma_migrations"
     WHERE migration_name = $1`,
    [MIGRATION],
  );
  const row = mig[0];

  if (!row) {
    console.log(
      `[repair] No _prisma_migrations row for ${MIGRATION} — not in a failed/stuck state. OK.`,
    );
    await client.end();
    return;
  }

  if (row.finished_at) {
    console.log(`[repair] ${MIGRATION} already finished — OK.`);
    await client.end();
    return;
  }

  console.log(
    `[repair] Stuck/failed migration detected (finished_at null) — fixing ${MIGRATION}…`,
  );

  const complete = await isComplete(client);
  const hasTable = await tableExists(client);
  console.log("Database check:", {
    SupplierOnboardingTask: hasTable,
    expectedDDLComplete: complete,
    migration: { finished_at: row.finished_at, started_at: row.started_at },
  });

  const prismaEnv = {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
  };

  if (complete) {
    console.log(
      "\n→ SRM Phase B onboarding-task DDL present. Marking migration applied (prisma migrate resolve --applied).\n",
    );
    await client.end();
    if (dry) return;
    process.exit(runMigrateResolve("--applied", prismaEnv));
  }

  if (!hasTable) {
    console.log(
      "\n→ No SupplierOnboardingTask table. Marking failed migration rolled back so deploy can apply from scratch.\n",
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

  console.log(
    "\n→ Partial SRM Phase B: applying remaining statements from migration.sql (idempotent).\n",
  );
  const stmts = statementsFromFile();
  if (dry) {
    console.log("--dry-run: would run", stmts.length, "statements (show first):", stmts[0]?.slice(0, 80), "…");
    await client.end();
    return;
  }
  try {
    await client.query("BEGIN");
    for (const q of stmts) {
      try {
        await client.query(q);
      } catch (e) {
        if (ignorableStatementError(e)) continue;
        throw e;
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    await client.end();
    console.error("\n[repair] Applying SRM Phase B DDL failed:", e && e.message ? e.message : e);
    process.exit(1);
  }

  const okAfter = await isComplete(client);
  if (!okAfter) {
    await client.end();
    console.error(
      "\n[repair] DDL run finished but expected objects still missing. Manual intervention required.\n",
    );
    process.exit(1);
  }

  await client.end();
  console.log("\n→ Marking migration applied (prisma migrate resolve --applied).\n");
  process.exit(runMigrateResolve("--applied", prismaEnv));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
