# Neon database (demo / development)

## Start here (so nothing gets ùlostù again)

- **One-shot migrate + full demo stack:** step-by-step in [`docs/neon-connection.local.example.md`](./neon-connection.local.example.md) ù command is `npm run db:seed:demo-full` (or `-- --skip-migrate` if schema is already current).
- **Where the Neon ùCopy snippetù line lives in-repo:** `docs/neon-credentials.local.md` ù **gitignored** (never committed). Create it by copying [`docs/neon-connection.local.example.md`](./neon-connection.local.example.md) or [`docs/neon-credentials.local.md.example`](./neon-credentials.local.md.example), then paste one `postgresql://ù` line.
- **Day-to-day Next.js / Prisma:** `.env.local` at the repo root is fine; `seed-demo-full` and `db:migrate` can use either env **or** that doc file (see script comments).

## Where the connection string lives

Real URLs and passwords must **not** be committed to git.

- **Local only (gitignored):** `docs/neon-credentials.local.md` ù create this file on your machine (see template below). It is listed in `.gitignore`.
- **Template (safe to commit):** `neon-credentials.local.md.example` in this folder ù copy to `neon-credentials.local.md` and fill in your values.

## Using the URL with this repo

Put the Neon `postgresql://ù` snippet in **`.env.local`** (or the gitignored `docs/neon-credentials.local.md` scratch file). Then agents and scripts can run seeds **without** pasting the URL into chat:

```bash
cd po-management
USE_DOTENV_LOCAL=1 npm run db:seed
USE_DOTENV_LOCAL=1 npm run db:seed:wms-demo
USE_DOTENV_LOCAL=1 npm run db:seed:srm-demo
```

`USE_DOTENV_LOCAL=1` merges `.env.local` over `.env` the same way the WMS seed header documents.

From the project root, with Node 22+ (explicit export is also fine):

```bash
export DATABASE_URL="paste-from-neon-credentials-local.md"
# Optional: Neon direct host for migrations (see Neon + Prisma docs)
# export DATABASE_URL_UNPOOLED="..."

npx prisma generate
npx prisma migrate deploy
npm run db:seed
```

## Vercel build-time seeds (optional)

`scripts/vercel-build.cjs` can run seeds during deploy when env vars are set on the **Vercel** project (Preview / Production). Uses `DATABASE_URL` from Vercel, not `.env.local`.

| Variable | Effect |
|----------|--------|
| `RUN_DB_SEED=1` | Runs `npm run db:seed` once; **unset after** a good deploy so every build does not re-seed. |
| `RUN_WMS_DEMO_SEED=1` | Runs `npm run db:seed:wms-demo` (long). Needs `demo-company` from a prior main seed ù set **`RUN_DB_SEED=1` together** on a fresh DB, or seed main first, then enable WMS only. **Unset after** success. |

Do not leave these on permanently: builds become slow and seeds may reset demo data.

## Invoice audit (Phase 06) ù migrations + demo row

Use the **same** `DATABASE_URL` the deployed app uses (Neon pooled URL is fine for `prisma migrate deploy` in this repoùs scripts; see Vercel build hints if migrate fails).

1. **Migrations:** Invoice audit expects Prisma folders **`20260419100000_invoice_audit_foundation`**, **`20260420120000_invoice_audit_ocean_matching`**, and **`20260421103000_invoice_intake_accounting_handoff`** under `prisma/migrations/`. If any are missing from `_prisma_migrations`, APIs and pages under `/invoice-audit` can return schema errors at runtime.
2. **Verify before a demo:** Open **`/invoice-audit/readiness`** in the app (with `org.invoice_audit` view), or call **`GET /api/invoice-audit/readiness`** ù same checks as the page (`information_schema` + finished migration rows). Use **`?refresh=1`** on the page after `migrate deploy` to bypass the short server cache.
3. **Seed the demo intake:** After **`USE_DOTENV_LOCAL=1 npm run db:seed`** (creates `demo-company` and tolerance defaults), run **`USE_DOTENV_LOCAL=1 npm run db:seed:invoice-audit-demo`**. If there is **no** `booking_pricing_snapshots` row yet for that tenant, the script **creates a minimal QUOTE_RESPONSE snapshot** from `prisma/invoice-audit-demo-snapshot.breakdown.json`, then creates/replaces PARSED intake **`DEMO-INVOICE-AUDIT-SEED`**. Open the printed URL ? **Run audit** ? closeout (ops / finance / accounting).

**Vercel:** `scripts/vercel-build.cjs` does **not** run the invoice-audit demo seed automatically. Run **`npm run db:seed:invoice-audit-demo`** manually against Preview/Production `DATABASE_URL` when you need that row on a fresh env.

Optional full CRM demo bulk (in addition to main seed):

```bash
SEED_CRM_DEMO=1 npm run db:seed
```

## SRM (finish program) ? demo partners on `demo-company`

After **`USE_DOTENV_LOCAL=1 npm run db:seed`** (creates **`demo-company`**, `buyer@` / `approver@` users, and baseline suppliers), you can add **repeatable SRM vertical demo rows**:

```bash
USE_DOTENV_LOCAL=1 npm run db:seed:srm-demo
```

- **Idempotent:** upserts five suppliers with codes **`DEMO-SRM-001`** through **`DEMO-SRM-005`**, recreates **compliance** file metadata rows (file names contain `srm-demo-seed`), and refreshes default **onboarding** tasks with mixed completion and assignees. Key strings in `prisma/seed-srm-demo.mjs` are covered by **`src/lib/srm/srm-demo-seed-file.contract.test.ts`** (CI, no DB).
- **Requires** migrations that include **`SrmSupplierDocument`** (SRM Phase C). If the script errors on missing table, run **`npm run db:migrate`** (or `prisma migrate deploy` on the target URL) and retry.
- **Neon / Vercel:** same as other add-on seeds ? not run in `vercel-build` by default; run manually against the environment **`DATABASE_URL`** when you need the slice-29 dataset on a fresh database.

## Settings ? company legal audit (org dimensions Phase 5)

- **Table:** `company_legal_entity_audit_logs` (append-only history for **Settings ? Organization ? Legal entities**). **Migration:** `prisma/migrations/20260523130000_company_legal_entity_audit_logs/`. If it is not applied, create/update/delete on company legal APIs (and the **Change history** block) can fail with Prisma/schema errors. Use the same **`DATABASE_URL`** as the app: **`npx prisma migrate deploy`** (or your normal Vercel build path, which includes migrate when configured). No separate seed is required for the audit table.

## Vercel build: P3009 / failed migration (`20260422120000_supplier_onboarding_task_srm_phase_b`)

If **`prisma migrate deploy`** fails with **P3009** and lists this **SRM Phase B** migration as **failed** (Neon pooler timeout, etc.), **`scripts/vercel-build.cjs`** now runs **`scripts/repair-failed-srm-onboarding-task-migration.cjs`** before migrate (same pattern as other stuck migrations). Locally, with a direct (`UNPOOLED`) URL: **`npm run db:repair:srm-onboarding-task-migration`**, then **`npm run db:migrate`**. Keep **`DATABASE_URL_UNPOOLED`** (or **`DIRECT_URL`**) on Vercel for reliable `migrate deploy`.

## Security checklist

1. **Rotate credentials** in the [Neon console](https://console.neon.tech) if the URL was ever pasted into chat, a ticket, or a shared doc. Treat that copy as exposed.
2. Prefer **`.env.local`** (already gitignored) for day-to-day local dev; use `docs/neon-credentials.local.md` only as a short-lived scratch pad if you want it in-repo but ignored.
3. Before making the repo public or sharing widely, delete `neon-credentials.local.md` and rely solely on env vars.
