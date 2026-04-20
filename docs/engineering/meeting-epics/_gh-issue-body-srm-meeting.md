## Goal (meeting batch — SRM)

Ship **documentation parity** (like Control Tower / WMS) **plus** operator UX on the existing **SRM partner list**. Target **~2+ hours**.

## Scope (allowed)

- **New** `docs/srm/GAP_MAP.md` (markdown only for this file’s initial version)
- `docs/engineering/agent-todos/srm.md` — add a **link row** under “Hygiene” pointing to the new GAP file (small edit)
- `src/app/srm/**` (list + detail pages only)
- `src/components/supplier-kind-tabs.tsx` **only** if required for URL parity (prefer not; prefer changes in `srm/page.tsx` first)
- **New** small pure helpers + tests under `src/lib/srm/**` (e.g. query normalization)

## Do **not**

- Control Tower, CRM, WMS, tariff modules
- `db:seed` / `db:migrate` / `prisma/schema.prisma` — **stop and ask Alex** if you think schema is required

## Checklist (complete all)

- [ ] **`docs/srm/GAP_MAP.md`:** first version with **legend** (✅ / 🟡 / ❌), tables mapping **blueprint PDF filenames** in `docs/srm/` to **repo reality** (`/srm`, `/srm/new`, `/srm/[id]`, `org.suppliers`, `Supplier` model fields you rely on). Include a **“Near-term build order”** numbered list (5–8 bullets) aligned with `srm_sprint_backlog_and_release_plan*.pdf` themes (no line-by-line PDF copy).
- [ ] **SRM list UX:** add **search** (`?q=`) synced to the URL; filter server-side `Supplier` by name/code/email (case-insensitive `contains` is fine); preserve existing `kind=` logistics vs product behavior.
- [ ] **Empty / no-results** state when `q` filters to zero rows (clear copy + reset link).
- [ ] **Tests:** add **Vitest** for any **new pure helper** in `src/lib/srm/**` (query parsing / `kind` defaulting). If no helper extracted, add **one** focused test file that tests a tiny exported function you add for `q` + `kind` parsing — do not skip tests entirely.
- [ ] **Green gate:** `npm run lint && npx tsc --noEmit && npm run test`

## Git

- Branch from `main`; one PR; do not merge.

## Ref

- `docs/engineering/agent-todos/srm.md`
- `docs/srm/*.pdf` (read for mapping titles only)
