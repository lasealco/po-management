# Tariff / rates vertical — 60-slice batch backlog (3 tracks × 20)

**HTTP surface map:** [`API_ROUTE_INDEX.md`](./API_ROUTE_INDEX.md) — every `src/app/api/tariffs/**/route.ts` handler (maintain when routes change).

**Domain lib map:** [`LIB_MODULE_INDEX.md`](./LIB_MODULE_INDEX.md) — every `src/lib/tariff/*.ts` module (maintain when files change).

Use this when you want **parallel agents** without stomping the same files: each **track** is intentionally skewed toward different primary paths. Within a track, work **top to bottom** when in doubt.

- **Track A** — Import pipeline, staging/promote, normalized charge codes, geography **catalog/lib**, providers/legal **lib**, matching **API** routes.
- **Track B** — Contract headers/versions, charge/rate/free-time **lib**, contract + geography **API** (non-import), **tariffs UI** for contracts/geography/reference.
- **Track C** — Rating engine, shipment hints/applications, investor rate lookup, **RFQ**, **booking pricing snapshots**, **invoice-audit** snapshot/tolerance paths, rating **UI**.

**Rules of engagement**

1. One agent **owns one track** per wave; do not split a single slice across agents.
2. If a slice touches a file another track owns, **finish the other track’s slice first** or **narrow the change** to stay in primary paths listed.
3. After a wave, run **`npm run verify:tariff-engine`** (or the narrowest script the slice needs).
4. **GitHub:** label `module:tariff`; paste slice id (e.g. `A-07`) in the issue title or body.

---

## Track A — Import & reference data (~20)

| Id | Slice |
|----|--------|
| A-01 | Audit **`src/lib/tariff/import-pipeline.ts`** — document stages, list promote failure modes, add or extend tests in **`import-pipeline.test.ts`**. |
| A-02 | Harden **`src/lib/tariff/promote-staging-import.ts`** — edge cases (empty batch, partial rows, idempotency); extend **`promote-staging-import.test.ts`**. |
| A-03 | Review **`src/lib/tariff/import-batches.ts`** batch lifecycle vs **`import-batch-statuses.ts`**; align labels with UI if needed. |
| A-04 | **`src/lib/tariff/import-staging-rows.ts`** — validation rules vs PATCH bodies on **`src/app/api/tariffs/import-batches/[id]/staging-rows/[rowId]/route.ts`**. |
| A-05 | **`src/lib/tariff/store-tariff-import-file.ts`** + **`store-tariff-import-file.test.ts`** — storage errors, size limits, tenant scope. |
| A-06 | **`src/app/api/tariffs/import-batches/route.ts`** — list/create contracts: auth, limits, error shape. |
| A-07 | **`src/app/api/tariffs/import-batches/[id]/route.ts`** — get/patch; consistency with lib. |
| A-08 | **`src/app/api/tariffs/import-batches/[id]/promote/route.ts`** + **`promote/route.test.ts`** — promote body validation and outcomes. |
| A-09 | **`src/app/api/tariffs/import-batches/[id]/sample-staging/route.ts`** — sampling rules and errors. |
| A-10 | **`src/app/api/tariffs/import-batches/[id]/fixture-promotable-rows/route.ts`** — demo/fixture safety. |
| A-11 | **`src/lib/tariff/normalized-charge-codes.ts`** + **`normalized-charge-codes.test.ts`** — catalog invariants. |
| A-12 | **`src/lib/tariff/normalized-charge-catalog-shared.ts`** vs **`src/app/tariffs/charge-codes/`** UI — drift check. |
| A-13 | **`src/app/api/tariffs/normalized-charge-codes/route.ts`** + **`[id]/route.ts`** — CRUD parity with lib. |
| A-14 | **`src/lib/tariff/geography-catalog.ts`** — reference data vs seeds; cross-check **`src/app/api/tariffs/geography/catalog-check/route.ts`**. |
| A-15 | **`src/lib/tariff/geography-groups.ts`** — group invariants; extend tests if gaps. |
| A-16 | **`src/lib/tariff/geography-members.ts`** + **`geography-members`** API routes under **`src/app/api/tariffs/geography-groups/`**. |
| A-17 | **`src/lib/tariff/geography-labels.ts`** + **`geography-labels.test.ts`** — label resolution edge cases. |
| A-18 | **`src/lib/tariff/legal-entities.ts`** + **`src/app/api/tariffs/legal-entities/route.ts`** + **`[id]/route.ts`**. |
| A-19 | **`src/lib/tariff/providers.ts`** + **`src/app/api/tariffs/providers/route.ts`** + **`[id]/route.ts`**. |
| A-20 | **`src/lib/tariff/audit-log.ts`** — ensure promote/import mutations emit auditable events; gaps + tests. |

---

## Track B — Contracts, versions, geography UI (~20)

| Id | Slice |
|----|--------|
| B-01 | **`src/lib/tariff/contract-headers.ts`** — header fields vs **`src/app/api/tariffs/contracts/route.ts`** and **`[id]/route.ts`**. |
| B-02 | **`src/lib/tariff/contract-versions.ts`** + **`version-guards.ts`** — guard all mutating version paths. |
| B-03 | **`src/lib/tariff/contract-version-source-types.ts`** (+ test file) — source metadata consistency. |
| B-04 | **`src/lib/tariff/charge-lines.ts`** — model vs **`src/app/api/tariffs/contracts/[id]/versions/[versionId]/charge-lines/`** routes. |
| B-05 | **`src/lib/tariff/rate-lines.ts`** vs **`.../rate-lines/`** API routes (collection + **`[lineId]`**). |
| B-06 | **`src/lib/tariff/free-time-rules.ts`** vs **`.../free-time-rules/`** + **`[ruleId]`** routes. |
| B-07 | **`src/app/api/tariffs/contracts/[id]/versions/route.ts`** — version list/create. |
| B-08 | **`src/app/api/tariffs/contracts/[id]/versions/[versionId]/route.ts`** — get/patch version. |
| B-09 | **`src/app/api/tariffs/geography-groups/route.ts`** + **`[id]/route.ts`** — group CRUD. |
| B-10 | **`src/components/tariffs/tariff-contract-header-client.tsx`** + **`tariff-contract-header-ids-bar.tsx`** — UX + workflow design system pass. |
| B-11 | **`src/components/tariffs/tariff-version-workbench-client.tsx`** + **`src/app/tariffs/contracts/[contractId]/versions/[versionId]/page.tsx`**. |
| B-12 | **`src/components/tariffs/tariff-new-contract-form.tsx`** + **`src/app/tariffs/contracts/new/page.tsx`**. |
| B-13 | **`src/app/tariffs/contracts/page.tsx`** + **`[contractId]/page.tsx`** — directory + detail. |
| B-14 | **`src/components/tariffs/tariffs-subnav.tsx`** + **`src/app/tariffs/layout.tsx`** + **`tariffs-gate.tsx`** — nav + gating copy. |
| B-15 | **`src/app/tariffs/geography/page.tsx`** + **`new/page.tsx`** + **`[groupId]/page.tsx`**. |
| B-16 | **`src/components/tariffs/geography-group-form-client.tsx`** + **`geography-group-trace-bar.tsx`**. |
| B-17 | **`src/app/tariffs/providers/`** + **`tariff-providers-directory-client.tsx`**. |
| B-18 | **`src/app/tariffs/legal-entities/`** + **`tariff-legal-entities-directory-client.tsx`**. |
| B-19 | **`src/app/tariffs/charge-codes/page.tsx`** + **`tariff-charge-codes-client.tsx`**. |
| B-20 | **`src/components/tariffs/tariff-import-batch-workflow-client.tsx`** + **`tariff-import-promote-panel.tsx`** + **`src/app/tariffs/import/`** pages — operator flow polish (coordinate with Track A only for API contract changes). |

---

## Track C — Rating, logistics hooks, RFQ, snapshots, invoice audit (~20)

| Id | Slice |
|----|--------|
| C-01 | **`src/lib/tariff/rating-engine.ts`** — expand **`rating-engine.test.ts`** / golden cases for regressions. |
| C-02 | **`src/app/api/tariffs/rate/route.ts`** — request validation, error body, tenant scope. |
| C-03 | **`src/lib/tariff/shipment-tariff-rating-hints.ts`** + **`src/app/api/shipments/[id]/tariff-rating-hints/route.ts`**. |
| C-04 | **`src/lib/tariff/shipment-tariff-applications.ts`** + **`src/app/api/shipments/[id]/tariff-applications/route.ts`**. |
| C-05 | **`src/lib/tariff/attach-tariff-application-request-body.ts`** + **`attach-tariff-application-request-body.test.ts`**. |
| C-06 | **`src/lib/tariff/tariff-shipment-application-labels.ts`** + **`tariff-shipment-application-labels.test.ts`**. |
| C-07 | **`src/lib/tariff/investor-door-rate-lookup.ts`** + **`src/app/api/tariffs/investor-door-rates/route.ts`**. |
| C-08 | **`src/app/tariffs/rating/page.tsx`** + **`tariff-rating-explorer-client.tsx`**. |
| C-09 | **`src/app/tariffs/rate-lookup/page.tsx`** + **`investor-door-rates-client.tsx`** — copy + public-safe messaging. |
| C-10 | **`src/lib/tariff/tariff-workbench-urls.ts`** + **`tariff-workbench-urls.test.ts`** — deep links from CT/shipment contexts. |
| C-11 | **`src/lib/rfq/quote-requests.ts`** + **`src/app/api/rfq/requests/route.ts`** + **`[id]/route.ts`**. |
| C-12 | **`src/lib/rfq/quote-responses.ts`** + responses API routes under **`src/app/api/rfq/`**. |
| C-13 | **`src/lib/rfq/build-compare-rows.ts`** + **`compare-helpers.ts`** (+ tests) — parity with RFQ UI. |
| C-14 | **`src/lib/rfq/rfq-repo-error.ts`** — error mapping vs API responses. |
| C-15 | **`src/lib/booking-pricing-snapshot/serialize.ts`** + **`serialize.test.ts`** — snapshot JSON stability. |
| C-16 | **`src/lib/booking-pricing-snapshot/freeze-from-contract-version.ts`** + **`freeze-composite-contract-versions.ts`** + **`freeze-from-quote-response.ts`**. |
| C-17 | **`src/lib/booking-pricing-snapshot/booking-pricing-snapshots.ts`** + **`src/app/api/booking-pricing-snapshots/route.ts`** + **`[id]/route.ts`**. |
| C-18 | **`src/components/pricing-snapshots/`** + **`src/app/pricing-snapshots/`** — UX/consistency pass (scoped to snapshot flows). |
| C-19 | **`src/lib/invoice-audit/pricing-snapshot-source-nav.ts`** + **`snapshot-candidates.ts`** + **`snapshot-match-label.ts`** (+ tests) — intake ↔ snapshot wiring. |
| C-20 | **`src/lib/invoice-audit/tolerance-rules.ts`** + **`tolerance-rule-pick.ts`** + **`ocean-line-match.ts`** / **`ocean-basket.ts`** — batch audit + **`npm run verify:tariff-engine`** sign-off for the wave. |

---

## After each wave

- [ ] No overlapping PRs on the same primary file without coordination.
- [ ] **`npm run verify:tariff-engine`** green for touched vertical.
- [ ] Update **`docs/engineering/agent-todos/tariff.md`** if a slice completes a recurring theme (optional).
