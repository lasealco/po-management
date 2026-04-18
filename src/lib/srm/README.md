# `src/lib/srm` — Supplier Relationship Management (library)

All **non-UI** SRM logic for this app: parsers, small workflows, snapshot shaping, and integration **parse/map** helpers. Routes under `src/app/api/suppliers/**` and pages under `src/app/srm/**` should stay thin and delegate here where practical.

## Verify

```bash
npm run test:srm          # Vitest: only this directory
npm run verify:srm        # prisma validate + tsc + test:srm
npm run verify:srm:with-db # verify:srm + optional Postgres SRM table/seed checks (needs DATABASE_URL)
```

## Key modules

| Area | Files |
|------|--------|
| **Onboarding** | `ensure-supplier-onboarding-tasks.ts`, `supplier-onboarding-workflow.ts`, `supplier-onboarding-patch.ts`, `supplier-onboarding-activation-guard.ts`, `supplier-onboarding-types.ts` |
| **Qualification** | `supplier-qualification-patch.ts`, `supplier-qualification-suggest.ts` |
| **Documents** | `supplier-document-parse.ts`, `supplier-document-expiry.ts` (tiered badge: expired / critical ≤14d / soon ≤30d, days-until + summary phrase) |
| **Compliance signals** | `supplier-compliance-document-signals.ts` (summary, findings, missing-type slots, readiness score, `SRM_CONTROLLED_DOCUMENT_CATEGORIES`), `compliance-review-due.ts` |
| **Other SRM entities** | `supplier-*-parse.ts` (alerts, contracts, relationship notes, scorecards, risk, compliance reviews), `supplier-capability-types.ts` |
| **360 snapshot** | `load-supplier-detail-snapshot.ts` (server loader; keep Prisma `include` in sync with UI) |
| **Inbound integration (minimal)** | `srm-supplier-master-upsert-payload.ts`, `srm-supplier-master-upsert-map.ts` — no HTTP/sync here yet |
| **Directory list (server)** | `supplier-directory-list.ts` — shared `/srm` + `/suppliers` filters (`approval`, `active`, `sort`) and Prisma `where` / `orderBy` |

## Product docs

- [`docs/srm/README.md`](../../docs/srm/README.md) — runnable checklist and **demo script**
- [`docs/srm/SRM_MIGRATIONS.md`](../../docs/srm/SRM_MIGRATIONS.md) — ordered supplier/SRM migrations
