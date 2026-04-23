// Load .env then .env.local (override) — same as `prisma/seed.mjs` so `migrate` matches seeds/repair scripts.
import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    /** `package.json` prisma.seed is ignored when this config file exists. */
    seed: "node prisma/seed.mjs",
  },
  datasource: {
    // Migrate needs a session-capable Postgres connection. Poolers (PgBouncer, Neon
    // pooler, Supabase 6543) often break `pg_advisory_lock`. Prefer an unpooled URL
    // here; the app still uses `DATABASE_URL` in `src/lib/prisma.ts`.
    url:
      process.env["DATABASE_URL_UNPOOLED"] ??
      process.env["DIRECT_URL"] ??
      process.env["DATABASE_URL"],
  },
});
