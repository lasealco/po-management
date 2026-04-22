# Tariffs HTTP API — route index

**Prefix:** `/api/tariffs`  
**App router:** `src/app/api/tariffs/**/route.ts` (**29** route modules as of 2026-04-22).

**Tenant & auth:** Almost all handlers use **`getDemoTenant()`** and **`requireApiGrant("org.tariffs", "view" | "edit")`** (see each `route.ts`). Errors generally use **`toApiErrorResponse`** / **`jsonFromTariffError`**.

**Maintenance:** When you add or remove a `route.ts` under this tree, update this file in the same PR.

---

## Contracts & versions

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/tariffs/contracts` | List contract headers (query filters). |
| `POST` | `/api/tariffs/contracts` | Create header (+ initial version flow per body). |
| `GET` | `/api/tariffs/contracts/[id]` | Header detail. |
| `PATCH` | `/api/tariffs/contracts/[id]` | Update header. |
| `GET` | `/api/tariffs/contracts/[id]/versions` | List versions for header. |
| `POST` | `/api/tariffs/contracts/[id]/versions` | Create new version. |
| `GET` | `/api/tariffs/contracts/[id]/versions/[versionId]` | Version detail. |
| `PATCH` | `/api/tariffs/contracts/[id]/versions/[versionId]` | Update version metadata / guards. |
| `GET` | `/api/tariffs/contracts/[id]/versions/[versionId]/rate-lines` | List ocean/base rate lines. |
| `POST` | `/api/tariffs/contracts/[id]/versions/[versionId]/rate-lines` | Create rate line. |
| `PATCH` | `/api/tariffs/contracts/[id]/versions/[versionId]/rate-lines/[lineId]` | Update rate line. |
| `DELETE` | `/api/tariffs/contracts/[id]/versions/[versionId]/rate-lines/[lineId]` | Delete rate line. |
| `GET` | `/api/tariffs/contracts/[id]/versions/[versionId]/charge-lines` | List surcharge/charge lines. |
| `POST` | `/api/tariffs/contracts/[id]/versions/[versionId]/charge-lines` | Create charge line. |
| `PATCH` | `/api/tariffs/contracts/[id]/versions/[versionId]/charge-lines/[lineId]` | Update charge line. |
| `DELETE` | `/api/tariffs/contracts/[id]/versions/[versionId]/charge-lines/[lineId]` | Delete charge line. |
| `GET` | `/api/tariffs/contracts/[id]/versions/[versionId]/free-time-rules` | List free-time rules. |
| `POST` | `/api/tariffs/contracts/[id]/versions/[versionId]/free-time-rules` | Create rule. |
| `PATCH` | `/api/tariffs/contracts/[id]/versions/[versionId]/free-time-rules/[ruleId]` | Update rule. |
| `DELETE` | `/api/tariffs/contracts/[id]/versions/[versionId]/free-time-rules/[ruleId]` | Delete rule. |

**Lib touchpoints:** `src/lib/tariff/contract-headers.ts`, `contract-versions.ts`, `rate-lines.ts`, `charge-lines.ts`, `free-time-rules.ts`, `version-guards.ts`, `audit-log.ts`, etc.

---

## Geography

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/tariffs/geography-groups` | List geography groups. |
| `POST` | `/api/tariffs/geography-groups` | Create group. |
| `GET` | `/api/tariffs/geography-groups/[id]` | Group detail. |
| `PATCH` | `/api/tariffs/geography-groups/[id]` | Update group. |
| `DELETE` | `/api/tariffs/geography-groups/[id]` | Delete group. |
| `GET` | `/api/tariffs/geography-groups/[id]/members` | List members. |
| `POST` | `/api/tariffs/geography-groups/[id]/members` | Add member. |
| `PATCH` | `/api/tariffs/geography-groups/[id]/members/[memberId]` | Update member. |
| `DELETE` | `/api/tariffs/geography-groups/[id]/members/[memberId]` | Remove member. |
| `POST` | `/api/tariffs/geography/catalog-check` | Validate catalog / labels (operator tooling). |

**Lib touchpoints:** `geography-groups.ts`, `geography-members.ts`, `geography-catalog.ts`, `geography-labels.ts`.

---

## Import batches & staging

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/tariffs/import-batches` | List batches. |
| `POST` | `/api/tariffs/import-batches` | Create batch / upload metadata. |
| `GET` | `/api/tariffs/import-batches/[id]` | Batch detail. |
| `PATCH` | `/api/tariffs/import-batches/[id]` | Update batch metadata/status. |
| `PATCH` | `/api/tariffs/import-batches/[id]/staging-rows/[rowId]` | Edit staged row. |
| `POST` | `/api/tariffs/import-batches/[id]/sample-staging` | Sample rows for review. |
| `POST` | `/api/tariffs/import-batches/[id]/fixture-promotable-rows` | Demo/fixture promotable rows. |
| `POST` | `/api/tariffs/import-batches/[id]/promote` | Promote staging into contract version(s). |

**Lib touchpoints:** `import-batches.ts`, `import-staging-rows.ts`, `promote-staging-import.ts`, `import-pipeline.ts`, `store-tariff-import-file.ts`.

---

## Reference data (providers, legal entities, charge codes)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/tariffs/providers` | List providers. |
| `POST` | `/api/tariffs/providers` | Create provider. |
| `PATCH` | `/api/tariffs/providers/[id]` | Update provider. |
| `GET` | `/api/tariffs/legal-entities` | List legal entities. |
| `POST` | `/api/tariffs/legal-entities` | Create entity. |
| `PATCH` | `/api/tariffs/legal-entities/[id]` | Update entity. |
| `GET` | `/api/tariffs/normalized-charge-codes` | List normalized codes. |
| `POST` | `/api/tariffs/normalized-charge-codes` | Create code. |
| `PATCH` | `/api/tariffs/normalized-charge-codes/[id]` | Update code. |

**Lib touchpoints:** `providers.ts`, `legal-entities.ts`, `normalized-charge-codes.ts`.

---

## Rating & investor demos

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/tariffs/rate` | Lane rating (POL/POD, equipment, mode, date, optional version hints). |
| `GET` | `/api/tariffs/investor-door-rates` | Pre-seeded DEHAM ↔ USCHI door stacks (requires investor demo seed). |

**Lib touchpoints:** `rating-engine.ts`, `investor-door-rate-lookup.ts`.

---

## Shared API helpers

| Path | Role |
|------|------|
| `src/app/api/tariffs/_lib/tariff-api-error.ts` | Map domain errors to JSON responses. |
| `src/app/api/tariffs/_lib/parse-tariff-date.ts` | Date parsing for route bodies. |

---

## Related (outside `/api/tariffs`)

Shipment-scoped tariff helpers live under **`/api/shipments/...`** (e.g. tariff rating hints, tariff applications). Booking pricing snapshots and invoice-audit APIs are separate modules; see `npm run verify:tariff-engine` scope in `.cursor/rules/tariff-engine-scope.mdc`.

---

## Quality gate

After changing routes or handlers:

```bash
npm run verify:tariff-engine
```

For a narrower loop:

```bash
npm run check:tariff-rfq
```
