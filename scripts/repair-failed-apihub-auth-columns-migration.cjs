/**
 * Fix Prisma P3018 for migration `20260430101500_apihub_connector_auth_columns`
 * when deploy failed because auth columns already exist on ApiHubConnector (e.g. db push / drift).
 *
 * Uses the same URL order as prisma.config.ts (UNPOOLED / DIRECT / DATABASE).
 *
 *   npm run db:repair:apihub-auth-columns-migration
 *   npm run db:repair:apihub-auth-columns-migration -- --dry-run
 *
 * vercel-build runs this before prisma migrate deploy when SKIP_DB_MIGRATE is unset.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const MIGRATION = "20260430101500_apihub_connector_auth_columns";

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

async function columnExists(client, columnName) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ApiHubConnector' AND column_name = $1`,
    [columnName],
  );
  return rows.length > 0;
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

  if (row.rolled_back_at != null) {
    console.log(
      `[repair] ${MIGRATION} marked rolled back — migrate deploy will apply. OK.`,
    );
    await client.end();
    return;
  }

  console.log(
    `[repair] Stuck migration (finished_at null) — unblocking ${MIGRATION}…`,
  );

  const authMode = await columnExists(client, "authMode");
  const authConfigRef = await columnExists(client, "authConfigRef");
  const authState = await columnExists(client, "authState");

  console.log("Database check:", {
    authMode,
    authConfigRef,
    authState,
    migration: { finished_at: row.finished_at, started_at: row.started_at },
  });

  const prismaEnv = {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
  };

  await client.end();

  if (authMode && authConfigRef && authState) {
    console.log(
      "\n→ ApiHubConnector auth columns present. Marking migration applied (prisma migrate resolve --applied).\n",
    );
    if (dry) return;
    process.exit(runMigrateResolve("--applied", prismaEnv));
  }

  console.log(
    "\n→ Columns missing or partial. Marking failed migration rolled back so deploy can retry.\n" +
      "  (prisma migrate resolve --rolled-back)\n",
  );
  if (dry) return;
  const r = spawnSync(
    "npx",
    ["prisma", "migrate", "resolve", "--rolled-back", MIGRATION],
    { stdio: "inherit", env: prismaEnv, shell: true },
  );
  process.exit(r.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
