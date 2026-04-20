## Goal (meeting batch — Control Tower)

Substantive **tests + small hardening** for inbound integration logic. Target **~2+ hours** of focused work (may finish faster or need a follow-up message if CI surfaces edge cases).

## Scope (allowed)

- `src/lib/control-tower/inbound-webhook.ts` (small refactors **only** if required for testability — keep behavior identical unless fixing a proven bug uncovered by tests)
- **New** `src/lib/control-tower/inbound-webhook.test.ts` (or split `*.test.ts` files next to the lib)
- Optional: `docs/controltower/GAP_MAP.md` **changelog line only** for this PR

## Do **not**

- `db:seed`, `db:migrate`, or Prisma schema changes
- Other modules, global nav, unrelated APIs

## Checklist (complete all)

- [ ] **Idempotency:** tests for `idempotencyKey` replay vs first-time processing (match current audit / status semantics).
- [ ] **Batch cap:** tests for `carrier_webhook_v1` `data[]` length vs `getMaxCarrierWebhookRows()` / `maxBatchRows` in JSON.
- [ ] **Formats:** at least one happy-path test each for **`generic_carrier_v1`**, **`visibility_flat_v1`**, **`tms_event_v1`** (minimal payloads; use fixtures inline).
- [ ] **Errors:** at least two tests for **400** paths you can trigger without DB (invalid payload shape / missing shipment id) — mock Prisma where needed.
- [ ] **Green gate:** `npm run lint && npx tsc --noEmit && npm run test`

## Git

- Branch from `main`; one PR; do not merge.

## Ref

- GitHub **#4** (narrower); this epic supersedes for the meeting batch if you use this issue number instead.
- `docs/controltower/GAP_MAP.md` R4 inbound webhooks
