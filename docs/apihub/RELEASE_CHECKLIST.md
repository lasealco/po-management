# API Hub — release checklist (Slice 59)

Use this before tagging or right after a production deploy that touches **API Hub** (`src/app/api/apihub/**`, `src/lib/apihub/**`, `src/app/apihub/**`, or API Hub Prisma models).

## 1) Preconditions

- [ ] **Branch** is rebased on `origin/main` (or merge target is current).
- [ ] **Node** matches `package.json` `engines` (currently **22.x**).
- [ ] **Database:** `DATABASE_URL` for the target environment points at the DB that will run the app (Neon / Postgres). Migrations are applied **before** or as part of deploy (`npm run db:migrate` / Vercel build step per `docs/database-neon.md`). If **`ApiHubIngestionApplyIdempotency.requestFingerprint`** is new in this deploy, ensure migration **`20260430160000_apihub_apply_idempotency_fingerprint`** ran.
- [ ] **Demo data (optional):** if you rely on `/apihub` demos, confirm `demo-company` seed exists (`npm run db:seed` where appropriate). Do not leave `RUN_DB_SEED=1` on Vercel long-term unless you intend build-time re-seeding.

## 2) Quality gate (local or CI)

Run in repo root:

```bash
npm run verify:apihub
```

GitHub Actions **CI** runs this step after the main `npm run test` job (see `.github/workflows/ci.yml`).

- [ ] **`npm run test:apihub`** — Vitest for `src/lib/apihub` + `src/app/api/apihub` (also invoked by `verify:apihub`).
- [ ] **`npx tsc --noEmit`** — full project typecheck (final step of `verify:apihub`).

If `tsc` fails only in a dirty workspace, fix duplicate artifacts or reinstall; CI should stay green.

## 3) Smoke against a running app

With **`next start`** or a preview/prod URL:

```bash
# default: http://localhost:3000
npm run smoke:apihub

# e.g. Vercel preview
APIHUB_SMOKE_BASE_URL="https://your-deployment.vercel.app" npm run smoke:apihub
```

- [ ] **`smoke:apihub` exits 0** — checks `GET /api/apihub/health` (JSON body exactly **`ok`**, **`service`**=`apihub`, **`phase`** — no extra keys), `GET /api/cron/apihub-mapping-analysis-jobs` without auth (**401**/**503** JSON with exactly **`error`** + **`code`**), `GET /apihub` (guided import shell), and `GET /apihub/workspace` (full workspace when signed in with **`org.apihub`**, otherwise the **API hub** access gate HTML).
- [ ] Optional: manually hit **`/apihub`** with a demo session and spot-check **Connectors**, **Ingestion runs**, **Alerts**, **Apply conflicts** (see [apply-operator-runbook.md](./apply-operator-runbook.md)).
- [ ] When P3 ingestion **downstream** apply is in scope: confirm **`POST …/ingestion-jobs/:id/apply`** with **`target`** + grants matches [README](./README.md) / [apply-operator-runbook](./apply-operator-runbook.md) (dry-run, **`APPLY_DOWNSTREAM_FAILED`**, idempotency note).

Environment:

| Variable | Default | Purpose |
|----------|---------|---------|
| `APIHUB_SMOKE_BASE_URL` | `http://localhost:3000` | Origin for fetches (no trailing slash). |
| `APIHUB_SMOKE_TIMEOUT_MS` | `15000` | Per-request timeout. |

**API Hub JSON bodies (production contracts):** default POST/PATCH bodies are capped at **256 KiB**; mapping analysis, templates, diff, and mapping preview/export allow **1 MiB**. Oversize requests return **413** `PAYLOAD_TOO_LARGE`. See `APIHUB_JSON_BODY_MAX_BYTES*` in `src/lib/apihub/constants.ts` and [product-completion-v1.md](./product-completion-v1.md).

**Optional OpenAI:** `APIHUB_OPENAI_API_KEY` or `OPENAI_API_KEY`; `APIHUB_OPENAI_MODEL` (default `gpt-4o-mini`). Documented in [README.md](./README.md) route index.

## 4) After deploy

- [ ] Confirm **Vercel** (or host) build logs show **migrate** success if migrations shipped.
- [ ] Run **`smoke:apihub`** against production URL once (from a machine with outbound HTTPS).
- [ ] If contract or operator flows changed, update **README** / **GAP_MAP** / **apply-operator-runbook** / **permissions-matrix** in a fast-follow if not in the same PR (see [RUNBOOK.md](./RUNBOOK.md)).

## 5) Rollback

- Revert the release commit or redeploy prior **Git** revision.
- **Database:** rolling back *code* does not undo migrations; only run down/repair scripts if you have an approved DB rollback plan (rare). Document any manual DB steps in the incident notes.

---

**Related:** [RUNBOOK.md](./RUNBOOK.md) (docs-only PR workflow), [README.md](./README.md) (endpoint index), `npm run verify:apihub` (Slice 57).
