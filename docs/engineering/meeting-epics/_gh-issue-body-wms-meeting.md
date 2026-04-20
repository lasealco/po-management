## Goal (meeting batch — WMS)

Deepen **stock / movement** operator UX and add **regression tests** for pure helpers. Target **~2+ hours**.

## Scope (allowed)

- `src/app/wms/stock/**`
- `src/components/wms-*` files that are **only** used by stock / movement UI (discover via imports from stock page)
- `src/lib/wms/**` for small extracted helpers + tests

## Do **not**

- CRM, Control Tower, tariff
- `db:seed` / `db:migrate` — **stop and ask** if schema changes seem required

## Checklist (complete all)

- [ ] **Movement ledger UX:** add **preset chips** or a **quick filter row** for common `mvType` values (reuse existing query param contract from stock page — read current implementation first).
- [ ] **URL / shareability:** ensure filter choices sync to the URL so operators can share links (if not already).
- [ ] **CSV export:** confirm export reflects **visible** filtered ledger rows; fix if a mismatch is found; document behavior in PR.
- [ ] **Edge states:** empty ledger, truncated cap message (if server returns truncation), and error banner consistency.
- [ ] **Tests:** add **Vitest** for **one** extracted pure function (e.g. building query strings, normalizing filter params, or formatting movement type labels) in `src/lib/wms/**`.
- [ ] **Green gate:** `npm run lint && npx tsc --noEmit && npm run test`

## Git

- Branch from `main`; one PR; do not merge.

## Ref

- `docs/wms/GAP_MAP.md`
- `docs/engineering/agent-todos/wms.md`
