# Local Neon connection (copy this file → `neon-credentials.local.md`)

This repo **gitignores** `docs/neon-credentials.local.md` so you can keep a Neon “Copy snippet” URL for development without committing it.

1. Duplicate this file:

   ```bash
   cp docs/neon-connection.local.example.md docs/neon-credentials.local.md
   ```

2. Open `docs/neon-credentials.local.md` and replace the placeholder below with your **exact** Neon snippet (one line, no quotes).

3. **Full demo stack** (migrate + main seed + CRM bulk + Control Tower volume) in one command:

   ```bash
   npm run db:seed:demo-full
   ```

   Uses `DATABASE_URL` from the environment if set; otherwise reads the `postgresql://` line from `docs/neon-credentials.local.md`. Skip migrate if already current: `npm run db:seed:demo-full -- --skip-migrate`. Smaller volume test: `CT_VOL_COUNT=500 npm run db:seed:demo-full`.

4. Or load env manually when migrating / seeding step by step:

   ```bash
   export DATABASE_URL="$(grep -E '^postgresql://' docs/neon-credentials.local.md | head -1)"
   export DIRECT_URL="$DATABASE_URL"
   export DATABASE_URL_UNPOOLED="$DATABASE_URL"
   npm run db:migrate
   ```

5. When development is done, **rotate the Neon password** and delete or blank the local file.

```text
postgresql://USER:PASSWORD@HOST/DB?sslmode=require&channel_binding=require
```
