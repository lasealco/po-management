/**
 * Vercel build: prisma generate → migrate (optional) → next build.
 * One-shot P3009: set PRISMA_REPAIR_SUPPLIER_MIGRATION=1 (+ DATABASE_URL_UNPOOLED),
 * deploy once, then remove the repair flag.
 * Set SKIP_DB_MIGRATE=1 if you run migrations elsewhere.
 */
const { spawnSync } = require("node:child_process");

function run(label, command, args) {
  console.log(`\n[vercel-build] ▶ ${label}\n`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if (result.status !== 0 && result.status !== null) {
    console.error(
      `\n[vercel-build] ✖ Failed: ${label} (exit ${result.status}). Check logs above.\n`,
    );
    if (label.includes("migrate")) {
      console.error(
        "[vercel-build] Hint: For Neon/Supabase/Vercel Postgres, set DIRECT_URL or DATABASE_URL_UNPOOLED\n" +
          "to a non-pooler connection for migrate; keep DATABASE_URL pooled for the app.\n",
      );
      console.error(
        "[vercel-build] P3009 fix on Vercel: add env PRISMA_REPAIR_SUPPLIER_MIGRATION=1 (one deploy), ensure\n" +
          "DATABASE_URL_UNPOOLED is the direct Neon URL, redeploy, then remove that env var.\n" +
          "[vercel-build] Or locally: DATABASE_URL_UNPOOLED=... npm run db:repair:supplier-migration\n",
      );
    }
    process.exit(result.status);
  }
  if (result.signal) {
    console.error(`\n[vercel-build] ✖ ${label} killed (${result.signal})\n`);
    process.exit(1);
  }
}

run("prisma generate", "npx", ["prisma", "generate"]);

if (process.env.PRISMA_REPAIR_SUPPLIER_MIGRATION === "1") {
  console.log(
    "\n[vercel-build] PRISMA_REPAIR_SUPPLIER_MIGRATION=1 — running repair script (remove after one good deploy)\n",
  );
  run(
    "repair failed supplier migration (P3009)",
    "node",
    ["scripts/repair-failed-supplier-migration.cjs"],
  );
}

if (process.env.SKIP_DB_MIGRATE === "1") {
  console.log(
    "\n[vercel-build] SKIP_DB_MIGRATE=1 — skipping prisma migrate deploy\n",
  );
} else {
  run("prisma migrate deploy", "npm", ["run", "db:migrate"]);
}

run("next build", "npm", ["run", "build"]);

console.log("\n[vercel-build] ✓ Done\n");
