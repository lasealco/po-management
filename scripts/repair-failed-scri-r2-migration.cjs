/**
 * Fix Prisma P3018 / deploy failures for `20260430210000_scri_r2_affected_entities`
 * when `ScriEventAffectedEntity` already exists (e.g. prior partial apply + history drift).
 *
 * Uses the same URL order as prisma.config.ts (UNPOOLED / DIRECT / DATABASE).
 *
 *   npm run db:repair:scri-r2-migration
 *   npm run db:repair:scri-r2-migration -- --dry-run
 *
 * vercel-build runs this before prisma migrate deploy when SKIP_DB_MIGRATE is unset.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = "20260430210000_scri_r2_affected_entities";
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

async function tableExists(client, name) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [name],
  );
  return rows.length > 0;
}

async function indexExists(client, indexname) {
  const { rows } = await client.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1 LIMIT 1`,
    [indexname],
  );
  return rows.length > 0;
}

async function fkCount(client, tableName) {
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS c FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = $1 AND constraint_type = 'FOREIGN KEY'`,
    [tableName],
  );
  return rows[0]?.c ?? 0;
}

/** Executable DDL statements from first line matching `marker` to EOF (R2 has no `--` section breaks). */
function statementsFromMarker(marker) {
  const sqlPath = path.join(MIGRATION_DIR, "migration.sql");
  const full = fs.readFileSync(sqlPath, "utf8");
  const i = full.indexOf(marker);
  if (i === -1) {
    throw new Error(`Could not find marker in ${sqlPath}`);
  }
  const tail = full.slice(i);
  const out = [];
  let cur = "";
  for (const line of tail.split("\n")) {
    const noComment = line.replace(/--.*$/, "");
    const t = noComment.trimEnd();
    if (!cur && !t.trim()) continue;
    cur = cur ? `${cur}\n${t}` : t;
    if (t.trim().endsWith(";")) {
      const s = cur.trim();
      if (s) out.push(s);
      cur = "";
    }
  }
  if (cur.trim()) {
    const s = cur.trim();
    out.push(s.endsWith(";") ? s : `${s};`);
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

  const { rows: mig } = await client.query(
    `SELECT migration_name, finished_at, started_at, rolled_back_at
     FROM "_prisma_migrations"
     WHERE migration_name = $1`,
    [MIGRATION],
  );
  const row = mig[0];

  if (row?.finished_at) {
    console.log(`[repair] ${MIGRATION} already finished — OK.`);
    await client.end();
    return;
  }

  if (row?.rolled_back_at != null) {
    console.log(
      `[repair] ${MIGRATION} marked rolled back — migrate deploy will apply. OK.`,
    );
    await client.end();
    return;
  }

  const hasTable = await tableExists(client, "ScriEventAffectedEntity");
  const hasUnique = await indexExists(
    client,
    "ScriEventAffectedEntity_eventId_objectType_objectId_matchType_key",
  );
  const fks = await fkCount(client, "ScriEventAffectedEntity");

  console.log("Database check:", {
    ScriEventAffectedEntity: hasTable,
    uniqueIndex: hasUnique,
    foreignKeys: fks,
    migrationRow: row
      ? { finished_at: row.finished_at, started_at: row.started_at }
      : null,
  });

  const prismaEnv = {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
  };

  const ddlComplete = hasTable && hasUnique && fks >= 2;

  if (!row && !hasTable) {
    console.log(
      `[repair] No migration row and no table — migrate deploy will create. OK.`,
    );
    await client.end();
    return;
  }

  if (!row && hasTable && ddlComplete) {
    console.log(
      "\n→ R2 table present but no _prisma_migrations row; marking migration applied.\n",
    );
    await client.end();
    if (dry) return;
    process.exit(runMigrateResolve("--applied", prismaEnv));
  }

  if (!row && hasTable && !ddlComplete) {
    console.error(
      "\n[repair] Table exists but schema incomplete and no migration row — manual fix required.\n",
    );
    await client.end();
    process.exit(1);
  }

  // row exists, not finished, not rolled back — stuck / failed
  if (!hasTable) {
    console.log(
      "\n→ R2 table missing. Marking failed migration rolled back so deploy can retry.\n",
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

  if (ddlComplete) {
    console.log(
      "\n→ SCRI R2 DDL complete. Marking migration applied (prisma migrate resolve --applied).\n",
    );
    await client.end();
    if (dry) return;
    process.exit(runMigrateResolve("--applied", prismaEnv));
  }

  console.log(
    "\n→ Partial R2: applying indexes and FKs from migration tail.\n",
  );
  const marker = 'CREATE UNIQUE INDEX "ScriEventAffectedEntity_eventId_objectType_objectId_matchType_key"';
  const stmts = statementsFromMarker(marker);
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
    console.error("\nApplying R2 tail DDL failed:", e.message);
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
