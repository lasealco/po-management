/**
 * Fix Prisma P3009 for migration `20260430200000_scri_r1_external_events`
 * after a failed `migrate deploy` (e.g. pooler timeout, transient error).
 *
 * Uses the same URL order as prisma.config.ts (UNPOOLED / DIRECT / DATABASE).
 *
 *   npm run db:repair:scri-r1-migration
 *   npm run db:repair:scri-r1-migration -- --dry-run
 *
 * vercel-build runs this before prisma migrate deploy when SKIP_DB_MIGRATE is unset.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = "20260430200000_scri_r1_external_events";
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

async function enumExists(client, typname) {
  const { rows } = await client.query(
    `SELECT 1 FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = $1 LIMIT 1`,
    [typname],
  );
  return rows.length > 0;
}

/** Split migration.sql into executable statements from a line starting with `marker` (e.g. CREATE TABLE…). */
function statementsFromMarker(marker) {
  const sqlPath = path.join(MIGRATION_DIR, "migration.sql");
  const full = fs.readFileSync(sqlPath, "utf8");
  const i = full.indexOf(marker);
  if (i === -1) {
    throw new Error(`Could not find ${marker.slice(0, 40)}… in ${sqlPath}`);
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
    `[repair] Stuck migration detected (finished_at null) — fixing ${MIGRATION}…`,
  );

  const hasEvent = await tableExists(client, "ScriExternalEvent");
  const hasSource = await tableExists(client, "ScriEventSource");
  const hasGeo = await tableExists(client, "ScriEventGeography");
  const hasEnum = await enumExists(client, "ScriEventReviewState");

  console.log("Database check:", {
    ScriExternalEvent: hasEvent,
    ScriEventSource: hasSource,
    ScriEventGeography: hasGeo,
    ScriEventReviewState: hasEnum,
    migration: { finished_at: row.finished_at, started_at: row.started_at },
  });

  const prismaEnv = {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
  };

  if (hasEvent && hasSource && hasGeo) {
    console.log(
      "\n→ SCRI R1 DDL present. Marking migration applied (prisma migrate resolve --applied).\n",
    );
    await client.end();
    if (dry) return;
    process.exit(runMigrateResolve("--applied", prismaEnv));
  }

  if (!hasEvent && !hasEnum) {
    console.log(
      "\n→ No SCRI R1 objects. Marking failed migration rolled back so deploy can retry.\n",
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

  if (!hasEvent && hasEnum) {
    console.log(
      "\n→ Enum exists without core table (orphan). Dropping enum CASCADE, then rolled-back.\n",
    );
    if (!dry) {
      await client.query('DROP TYPE IF EXISTS "ScriEventReviewState" CASCADE');
    }
    await client.end();
    if (dry) return;
    const r = spawnSync(
      "npx",
      ["prisma", "migrate", "resolve", "--rolled-back", MIGRATION],
      { stdio: "inherit", env: prismaEnv, shell: true },
    );
    process.exit(r.status ?? 1);
  }

  if (hasEvent && (!hasSource || !hasGeo)) {
    const stmts = !hasSource
      ? statementsFromMarker('CREATE TABLE "ScriEventSource"')
      : statementsFromMarker('CREATE TABLE "ScriEventGeography"');
    console.log(
      `\n→ Partial R1: applying ${!hasSource ? "ScriEventSource + ScriEventGeography" : "ScriEventGeography"} DDL.\n`,
    );
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
    process.exit(runMigrateResolve("--applied", prismaEnv));
  }

  // hasEnum, no event — handled above; remaining: should not reach
  console.error("\n[repair] Unrecognized partial state — manual intervention required.\n");
  await client.end();
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
