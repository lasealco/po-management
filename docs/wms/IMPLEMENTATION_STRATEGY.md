# WMS (and billing) — implementation strategy

**Decisions already locked in**

- Build **on top of** existing Prisma models, `/api/wms`, and UI — no greenfield rewrite.
- **Priority:** (1) Operations → (2) Billing → (3) Commercial/CRM later.
- **Prod DB changes:** Migrations ship with the repo; **Vercel build** runs `prisma migrate deploy` unless `SKIP_DB_MIGRATE=1`.

---

## How we work while you are offline

### What can be done without you

- Code, schema, migrations (SQL in repo), components, APIs, types, lint fixes.
- **Local** verification in this environment: `npx tsc --noEmit`, `npm run build`, `npm run lint` when applicable.
- **Local DB** (your machine’s Postgres from `.env.local`): migrate/seed **only if** the agent session has DB access and non-interactive commands succeed; otherwise work stays **migration + code only** until you run migrate once.

### What must wait for you (batch for evenings / when online)

Do **not** block a whole phase on these; ship code + migrations, then you run a **short checklist**:

| Step | When needed | One-liner / place |
|------|-------------|-------------------|
| `git pull` + push | Deploy | Your machine or CI |
| Neon / prod seed | Demo or role data | `DATABASE_URL='…' npm run db:seed` (see repo seed docs) |
| Vercel env | New flags | Dashboard → Env → Redeploy |
| Interactive prompts | Rare | Avoided by design below |

**Agent rule:** Prefer a **single** terminal invocation per task (e.g. one `npm run build`) to reduce approval clicks. If a command fails (sandbox, no DB), **continue with code + migration files** and note “verify locally” in the PR/commit message — never stall the branch.

---

## Phases (what to build in what order)

### Phase A — Operations baseline (P1)

**Goal:** Doc-aligned **operational** depth on existing entities: clearer inventory lifecycle, tasks, outbound/receiving gaps, movement traceability as far as schema allows **without** billing tables yet.

**Exit criteria**

- [x] Target flows from `wms_blueprint` R1–R3 mapped to **existing** models + explicit “gap” list → **`docs/wms/GAP_MAP.md`**.
- [x] No regression: `npm run build` green; WMS page + API still usable for demo tenant.
- [x] Movement ledger surfaced on GET `/api/wms` as `recentMovements` + WMS UI table (extend existing contract).

### Phase B — Billing foundation (P2)

**Goal:** **Event-oriented** billing: immutable **billing events** + **rate/charge definitions** + **invoice run** (or export) that **reads** ops data — does **not** replace `InventoryBalance` / task truth.

**Exit criteria**

- [ ] Schema + migrations committed; deploy applies them on next Vercel build.
- [ ] Manual or scripted path to generate a **minimal** invoice from stored events (even CSV/PDF stub is OK for v1).
- [ ] Commercial/quotation **out of scope** here except a **placeholder** link or enum for “profile source = manual”.

### Phase C — Commercial / CRM handoff (P3, later)

**Goal:** Only after A+B stable: either CRM objects or a small **Commercial** module feeding billing profiles — **no** hard dependency from A or B.

---

## Risk controls

1. **Migrations:** One logical change per migration folder; avoid advisory-lock issues on Neon (project already sets `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK` for migrate).
2. **Large `/api/wms` route:** Split by domain (e.g. `lib/wms-handlers/*.ts`) before adding huge new blocks — reduces merge pain.
3. **Secrets:** Never commit; agent uses placeholders in docs only.
4. **If agent cannot run terminal:** Still commit code + `migration.sql`; you run `npm run build` once when back.

---

## Your end-of-day checklist (when you have 5 minutes)

1. Pull latest `main`, skim commit messages / `docs/wms/IMPLEMENTATION_STRATEGY.md` “Exit criteria” boxes.
2. Confirm Vercel deployment green; if migration failed, check build log for `DATABASE_URL_UNPOOLED` / Neon direct URL.
3. Optional: run seed against prod Neon if we added demo data requirements.

---

## Revision

Update this file when phases complete or priorities change. Last aligned with: **build on top**, **ops → billing → commercial**.
