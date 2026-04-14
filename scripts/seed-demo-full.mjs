#!/usr/bin/env node
/**
 * One-shot demo stack for Neon/local:
 * 1) prisma migrate deploy
 * 2) db:seed with SEED_CRM_DEMO=1 (tower base + CRM bulk demo)
 * 3) db:seed:ct-volume (Control Tower shipment volume)
 *
 * DATABASE_URL: use shell env, else first `postgresql://...` line in
 * docs/neon-credentials.local.md (gitignored).
 *
 *   npm run db:seed:demo-full
 *   npm run db:seed:demo-full -- --skip-migrate
 *   CT_VOL_COUNT=500 npm run db:seed:demo-full
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const NEON_DOC = resolve(process.cwd(), "docs/neon-credentials.local.md");
const skipMigrate = process.argv.includes("--skip-migrate");

function databaseUrlFromDoc() {
  if (!existsSync(NEON_DOC)) return null;
  const s = readFileSync(NEON_DOC, "utf8");
  const line = s.split("\n").find((l) => /^postgresql:\/\//.test(l.trim()));
  return line?.trim() ?? null;
}

function getDatabaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  const fromDoc = databaseUrlFromDoc();
  if (fromDoc) return fromDoc;
  console.error(
    "[seed-demo-full] Set DATABASE_URL or add one postgresql:// line to docs/neon-credentials.local.md",
  );
  process.exit(1);
}

const url = getDatabaseUrl();
const baseEnv = {
  ...process.env,
  DATABASE_URL: url,
  DIRECT_URL: url,
  DATABASE_URL_UNPOOLED: url,
};

if (!skipMigrate) {
  console.log("[seed-demo-full] 1/3 migrate deploy…");
  execSync("npm run db:migrate", { stdio: "inherit", env: baseEnv });
} else {
  console.log("[seed-demo-full] 1/3 migrate deploy skipped (--skip-migrate)");
}

console.log("[seed-demo-full] 2/3 seed + CRM demo bulk (SEED_CRM_DEMO=1)…");
execSync("npm run db:seed", {
  stdio: "inherit",
  env: { ...baseEnv, SEED_CRM_DEMO: "1" },
});

console.log("[seed-demo-full] 3/3 Control Tower volume shipments…");
execSync("npm run db:seed:ct-volume", { stdio: "inherit", env: baseEnv });

console.log("[seed-demo-full] Done. Logins: buyer@ / approver@ / … @demo-company.com — password demo12345");
