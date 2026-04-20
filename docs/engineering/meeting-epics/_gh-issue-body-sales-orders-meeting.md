## Goal (meeting batch — Sales orders)

Improve **operator UX** on the sales order hub (`org.orders`) and add **regression tests**. Target **~2+ hours**. **Not** tariff work — do not open `src/lib/tariff/**` or `src/app/tariffs/**`.

## Scope (allowed)

- `src/app/sales-orders/**`
- `src/app/api/sales-orders/**`
- `src/components/sales-order*.tsx` (only components used by those pages)

## Do **not**

- Tariff / RFQ / pricing-snapshot / invoice-audit slices (see `.cursor/rules/tariff-engine-scope.mdc`)
- CRM, WMS, Control Tower — unless a one-line deep link already exists and you only adjust href text
- `db:seed` / `db:migrate` — **stop and ask Alex** first

## Checklist (complete all)

- [ ] **List page:** add **URL-synced** filters — at minimum **`?q=`** text search (name / external ref / id substring) and **`?status=`** if `SalesOrder` has a status field (inspect Prisma model); preserve `take`/perf guard (e.g. cap 200 or paginate).
- [ ] **List page:** empty state + “clear filters” when zero rows.
- [ ] **Detail page:** shipments section — add **explicit link** to Control Tower shipment 360 when user has `org.controltower` **view** (reuse existing path pattern from elsewhere in repo; if no pattern, add a TODO in PR and only show link when you find the canonical URL builder).
- [ ] **Tests:** add **Vitest** under `src/lib/sales-orders/**` for **query string → Prisma where** builder or equivalent pure logic introduced for list filters (if nothing pure to extract, add **one** API route test only if repo already has route test harness — otherwise document skip reason in PR).
- [ ] **Green gate:** `npm run lint && npx tsc --noEmit && npm run test`

## Git

- Branch from `main`; one PR; do not merge.

## Ref

- `docs/engineering/agent-todos/sales-orders.md`
