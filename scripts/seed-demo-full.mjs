#!/usr/bin/env node
/**
 * One-shot demo stack for Neon/local:
 * 1) prisma migrate deploy
 * 2) db:seed with SEED_CRM_DEMO=1 (tower base + CRM bulk demo)
 * 3) db:seed:ct-volume (Control Tower shipment volume)
 * 4) db:seed:wms-demo (WMS DC layout, inventory, outbound demo)
 * 5) db:seed:supply-chain-twin-demo (Twin customer showcase graph + scenarios + risks)
 *
 * DATABASE_URL: use shell env, else first `postgresql://...` line in
 * docs/neon-credentials.local.md (gitignored).
 *
 *   npm run db:seed:demo-full
 *   npm run db:seed:demo-full -- --skip-migrate
 *   CT_VOL_COUNT=500 npm run db:seed:demo-full
 *
 * Volume seed uses larger DB batches by default (faster on Neon). Override any time:
 *   CT_VOL_BATCH=25 npm run db:seed:demo-full
 * Balanced scenario + fast batches:
 *   CT_VOL_BALANCED=1 CT_VOL_BATCH=80 npm run db:seed:demo-full
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
  console.log("[seed-demo-full] 1/5 migrate deploy…");
  execSync("npm run db:migrate", { stdio: "inherit", env: baseEnv });
} else {
  console.log("[seed-demo-full] 1/5 migrate deploy skipped (--skip-migrate)");
}

console.log("[seed-demo-full] 2/5 seed + CRM demo bulk (SEED_CRM_DEMO=1)…");
execSync("npm run db:seed", {
  stdio: "inherit",
  env: { ...baseEnv, SEED_CRM_DEMO: "1" },
});

console.log("[seed-demo-full] 3/5 Control Tower volume shipments…");
const ctVolumeEnv = { ...baseEnv };
if (!String(process.env.CT_VOL_BATCH ?? "").trim()) {
  ctVolumeEnv.CT_VOL_BATCH = "80";
}
execSync("npm run db:seed:ct-volume", { stdio: "inherit", env: ctVolumeEnv });

console.log("[seed-demo-full] 4/5 WMS demo warehouse…");
execSync("npm run db:seed:wms-demo", { stdio: "inherit", env: baseEnv });

console.log("[seed-demo-full] 5/5 Supply Chain Twin customer demo…");
execSync("npm run db:seed:supply-chain-twin-demo", { stdio: "inherit", env: baseEnv });

console.log("[seed-demo-full] Done. Logins: buyer@ / approver@ / … @demo-company.com — password demo12345");
