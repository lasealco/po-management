# Tariffs domain logic — `src/lib/tariff` module index

**Root:** `src/lib/tariff/`  
**As of 2026-04-22:** **32** implementation modules (`.ts`) and **18** co-located Vitest files (`*.test.ts`).  
`index.ts` is currently a **placeholder** (empty barrel).

**Maintenance:** When you add, rename, or remove a non-test module here, update this file in the same PR.

**Related:** HTTP handlers are listed in [`API_ROUTE_INDEX.md`](./API_ROUTE_INDEX.md).

---

## Contracts & versions

| Module | Role |
|--------|------|
| `contract-headers.ts` | Contract header CRUD/list; tenant-scoped. |
| `contract-versions.ts` | Version lifecycle, create/list/get/update; ties to header + lines. |
| `version-guards.ts` | Mutations allowed only in correct approval/frozen states. |
| `contract-version-source-types.ts` | Source metadata enums / helpers for version provenance. |
| `rate-lines.ts` | Ocean / base rate lines on a version. |
| `charge-lines.ts` | Surcharge and ancillary charge lines on a version. |
| `free-time-rules.ts` | Demurrage/detention-style free-time rules on a version. |

---

## Geography

| Module | Role |
|--------|------|
| `geography-groups.ts` | Geography group CRUD; tenant-scoped. |
| `geography-members.ts` | Members (UN/LOCODE-style refs) under a group. |
| `geography-catalog.ts` | Reference catalog loading / validation vs seeds. |
| `geography-labels.ts` | Human-readable labels and resolution for UI + APIs. |

---

## Import pipeline, batches & staging

| Module | Role |
|--------|------|
| `import-pipeline.ts` | **Stage model** documentation, constants (`TARIFF_IMPORT_*`), promote failure-mode table; alignment for parsers and promote. |
| `import-batch-statuses.ts` | Parse/review status sets and labels for batches and rows. |
| `import-batches.ts` | Batch CRUD, listing, tenant-scoped transitions. |
| `import-staging-rows.ts` | Staging row validation, updates, normalized payload shapes. |
| `promote-staging-import.ts` | **Promote** approved staging rows → new contract version + rate/charge lines + audit. |
| `store-tariff-import-file.ts` | Upload storage, size/tenant rules, blob metadata. |

---

## Reference data (shared across contracts)

| Module | Role |
|--------|------|
| `providers.ts` | Tariff providers (carriers / NVOCC-style). |
| `legal-entities.ts` | Legal entities for contracting parties. |
| `normalized-charge-codes.ts` | Normalized surcharge code catalog (DB-backed ops). |
| `normalized-charge-catalog-shared.ts` | **Client-safe** option lists (`TARIFF_CHARGE_FAMILY_OPTIONS`, transport modes); must stay aligned with charge-codes UI. |

---

## Rating & investor demos

| Module | Role |
|--------|------|
| `rating-engine.ts` | Lane rating: geography matching, line selection, totals (`rateTariffLane`, equipment/mode normalization). |
| `investor-door-rate-lookup.ts` | Pre-composed door-rate stacks for investor/demo grids (e.g. DEHAM ↔ USCHI). |

---

## Shipment integration (logistics context)

| Module | Role |
|--------|------|
| `shipment-tariff-rating-hints.ts` | Hints for a shipment (POL/POD, equipment) to drive rating UI/API. |
| `shipment-tariff-applications.ts` | Persisted application of a rated snapshot to a shipment. |
| `attach-tariff-application-request-body.ts` | Parse/validate attach-application POST bodies. |
| `tariff-shipment-application-labels.ts` | Display labels / status copy for applications. |

---

## Cross-cutting

| Module | Role |
|--------|------|
| `audit-log.ts` | `TariffAuditLog` writes for mutations (contracts, lines, promote, etc.). |
| `tariff-repo-error.ts` | Typed domain errors (`TariffRepoError`) for APIs and promote. |
| `tariff-enum-sets.ts` | Shared allowlists (e.g. transport mode) for validation. |
| `tariff-workbench-urls.ts` | App-router paths and helpers for deep links (`/tariffs/...`, version URLs, import batch paths). |

---

## Tests

Vitest files mirror the modules above (e.g. `rating-engine.test.ts`, `promote-staging-import.test.ts`). Run the tariff vertical tests with:

```bash
npm run test:tariff-rfq
```

Full gate (includes invoice-audit slice + `tsc`):

```bash
npm run verify:tariff-engine
```

---

## Out of scope here

Logic in **`src/lib/rfq/**`**, **`src/lib/booking-pricing-snapshot/**`**, and **`src/lib/invoice-audit/**`** is documented by those modules and the tariff agent todo; only shipment/tariff **bridges** above live under `src/lib/tariff`.
