## Goal (meeting batch — CRM)

Ship a **visible CRM slice**: opportunities UX + quote detail depth. Target **~2+ hours** (scope is multi-file).

## Scope (allowed)

- `src/components/crm-opportunities-list.tsx` (and tiny types only if colocated)
- `src/app/crm/opportunities/**`
- `src/components/crm-quote-detail.tsx` or quote detail under `src/components/crm-*` / `src/app/crm/quotes/**` (only files that already relate to quote detail)
- `src/app/api/crm/**` **only** for read-only list endpoints if missing (prefer **no** new migrations; use existing `CrmQuoteLine` access patterns from `src/app/api/crm/quotes/[id]/lines/route.ts`)

## Do **not**

- Control Tower, WMS, tariff, SRM routes
- `db:seed` / `db:migrate` unless you hit a **blocking** schema gap — **stop and ask Alex** first

## Checklist (complete all)

- [ ] **Opportunities list:** add **stage** and **owner** (or **text search**) filters with **URL query sync** (`?stage=&owner=` or your choice) so links are shareable; preserve existing columns.
- [ ] **Opportunities list:** empty / error / loading states polished (match existing CRM styling).
- [ ] **Quote detail:** show **line items** in a read-only table (description, qty, unit price, line total if fields exist on `CrmQuoteLine`); load via existing CRM APIs (`GET …/quotes/[id]/lines` or equivalent already in repo — **discover and reuse**, do not duplicate business logic).
- [ ] **Quote detail:** clear “add line” affordance may stay **link to existing edit flow** if full inline edit is out of scope — document in PR if so.
- [ ] **Tests:** add **Vitest** for any **new pure helpers** (e.g. query-string builders) in `src/lib/crm/**` if you extract them; if no pure helpers, add **one** minimal component test only if the repo already has that pattern for CRM — otherwise skip and note why.
- [ ] **Green gate:** `npm run lint && npx tsc --noEmit && npm run test`

## Git

- Branch from `main`; one PR; do not merge.

## Ref

- `docs/engineering/agent-todos/crm.md`
- `docs/crm/BACKLOG.md`
