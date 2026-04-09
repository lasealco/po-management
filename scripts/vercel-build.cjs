/**
 * Vercel build: prisma generate → P3009 repair if needed → migrate → optional seed → next build.
 * Set SKIP_DB_MIGRATE=1 if you run migrations elsewhere.
 * Set RUN_DB_SEED=1 for a one-time seed from Vercel (useful when local network cannot reach Neon).
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
        "[vercel-build] P3009: ensure DATABASE_URL_UNPOOLED (direct Neon host) is set for migrate.\n" +
          "[vercel-build] Repair runs before migrate deploy; locally: npm run db:repair:supplier-migration\n",
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

if (process.env.SKIP_DB_MIGRATE === "1") {
  console.log(
    "\n[vercel-build] SKIP_DB_MIGRATE=1 — skipping prisma migrate deploy\n",
  );
} else {
  run(
    "pre-migrate: repair supplier P3009 if stuck",
    "node",
    ["scripts/repair-failed-supplier-migration.cjs"],
  );
  run("prisma migrate deploy", "npm", ["run", "db:migrate"]);
}

if (process.env.RUN_DB_SEED === "1") {
  console.log(
    "\n[vercel-build] RUN_DB_SEED=1 — running db seed (remove after successful deploy)\n",
  );
  run("db seed", "npm", ["run", "db:seed"]);
}

run("next build", "npm", ["run", "build"]);

console.log("\n[vercel-build] ✓ Done\n");
