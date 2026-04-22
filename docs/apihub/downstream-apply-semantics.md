# Downstream apply semantics (R3)

**Scope:** how **mapped rows** become **SalesOrder**, **PurchaseOrder**, or **Control Tower audit** rows.  
**Implementation:** `src/lib/apihub/downstream-mapped-rows-apply.ts` (shared writers), `src/lib/apihub/staging-batch-apply.ts` (staging entry), `src/lib/apihub/ingestion-apply-repo.ts` (ingestion entry).  
**Operator HTTP details:** [apply-operator-runbook.md](./apply-operator-runbook.md), route index in [README.md](./README.md).

## Two entry points (same writers)

| Entry | HTTP | Transaction | SO/PO duplicate refs | Upsert / line merge |
|--------|------|-------------|------------------------|---------------------|
| **Staging batch apply** | `POST …/staging-batches/:batchId/apply` | Updates batch to `promoted` + `appliedAt` in the same transaction as row writes | **Ignored** — `salesOrderExternalRefPolicy` and `purchaseOrderBuyerRefPolicy` are both **`ignore`** | **Not available** — always create path for SO/PO (no header/line merge) |
| **Ingestion run apply** | `POST …/ingestion-jobs/:jobId/apply` with `target` + rows | Claims run + writes rows in one transaction | **`matchKey`** + **`writeMode`** (see below) | **`upsert`** only for SO+`sales_order_external_ref` or PO+`purchase_order_buyer_reference` |

**Control Tower audit** is **always create-only** (new `CtAuditLog` per row). Payload schema differs slightly: staging uses `entityType=ApiHubStagingRow` + `stagingRowId`; ingestion uses `entityType=ApiHubIngestionRun` + `runId`.

## Ingestion: `matchKey` and `writeMode`

Constants and guards: `src/lib/apihub/constants.ts` (`apiHubIngestionUpsertAllowed`, `apiHubPurchaseOrderLineMergeAllowed`).

| `matchKey` | `writeMode` | SO policy | PO policy |
|------------|-------------|-----------|-----------|
| `none` (default) | `create_only` (default) | **`ignore`** — no pre-check on `externalRef` | **`ignore`** — no pre-check on `buyerReference` |
| `sales_order_external_ref` | `create_only` | **`reject_duplicate`** — row fails if tenant already has SO with same `externalRef` | n/a |
| `sales_order_external_ref` | `upsert` | **`upsert`** — patch existing SO by `externalRef` if present, else create | n/a |
| `purchase_order_buyer_reference` | `create_only` | n/a | **`reject_duplicate`** — row fails if PO exists for `buyerReference` |
| `purchase_order_buyer_reference` | `upsert` | n/a | **`upsert`** — merge lines or replace all (see below) |

**`upsert`** is rejected by the API unless the target + `matchKey` pair is allowed (SO external ref or PO buyer ref only).

## Sales order upsert (ingestion only)

When policy is **`upsert`** and **`externalRef`** is present:

- If a SO exists for **tenant + `externalRef`**, the row **updates** that SO (no second row). Updatable fields when present on the mapped record: **`customerCrmAccountId`** (CRM account must exist), **`requestedDeliveryDate`**, **`requestedShipDate`**, **`currency`** (3-letter ISO; `null` → **USD**), **`notes`** (string or null). Uses partial key presence (`hasMappedKey`) so omitted keys are not cleared.
- If none exists, behavior matches **create**: **`customerCrmAccountId`** required, optional `soNumber`, `requestedDeliveryDate`, `requestedShipDate`, `currency`, `notes`, `externalRef`.

If **`externalRef`** is missing on the row, upsert path does not match; create path runs and **`customerCrmAccountId`** is required.

## Purchase order upsert (ingestion only)

When policy is **`upsert`** and **`buyerReference`** is present:

- **`purchaseOrderLineMerge`** (optional, default **`merge_by_line_no`**): only valid for PO + buyer ref + upsert.
  - **`merge_by_line_no`**: for each row, upsert **one line** by **`lineNo`** on the existing PO; update header fields when keys present (`title`, `supplierId` must match or update header supplier, `requestedDeliveryDate`, plus optional scalars: **`currency`**, **`supplierReference`**, **`paymentTermsDays`** / **`paymentTermsLabel`**, **`incoterm`**, **`shipTo*`** address fields, **`internalNotes`**, **`notesToSupplier`**). Totals recomputed from items.
  - **`replace_all`**: rows are **grouped by `buyerReference`**. For each group, **all lines** on the matched PO are deleted and recreated from **all rows in that group** in one step. Every row in the group must share the same **`supplierId`**; **`replace_all`** cannot mix suppliers. The same optional PO header scalars apply when patching the matched PO (first row of the group supplies header hints on create/update paths).

When no PO exists for **`buyerReference`**, the row (or group) **creates** a new PO with workflow defaults.

## Staging batch apply (create-only semantics)

`staging-batch-apply.ts` always calls `applyMappedRowsInTransaction` with:

- `salesOrderExternalRefPolicy: "ignore"`
- `purchaseOrderBuyerRefPolicy: "ignore"`

So duplicate **`externalRef`** / **`buyerReference`** in the DB do **not** block staging: the server always attempts **create**. If the database enforces a unique constraint and insert conflicts, the transaction fails with a generic apply error (operator should use ingestion apply with explicit **`matchKey`** / **`writeMode`** for idempotent updates).

## Partial failure and atomicity

Row-level validation returns **`ok: false`** on the row result. **`applyMappedRowsInTransaction`** **throws** on the first failed row, so **no partial commit** of mapped rows inside that helper — the outer transaction (staging batch update or ingestion run claim) **rolls back**.

Dry-run returns **all** row results with per-row errors; it does not throw for validation-only failures.

## Idempotency (ingestion apply)

Downstream apply participates in **`requestFingerprint`** (`matchKey`, `writeMode`, `purchaseOrderLineMerge`, rows source). See [apply-operator-runbook.md](./apply-operator-runbook.md#idempotency-safe-replay).

## Related code map

| Concern | Location |
|---------|----------|
| SO create / upsert patch | `applySalesOrderRowLive` |
| PO create / merge / replace_all | `applyPurchaseOrderRowLive`, `applyPoBuyerRefReplaceAllGroup` |
| CT audit log | `applyCtAuditRowLive` |
| Dry-run duplicate scan (ingestion) | `dryRunSalesOrderExternalRefConflicts`, `dryRunPurchaseOrderBuyerReferenceConflicts` |
| Policy wiring from HTTP body | `ingestion-apply-repo.ts` (`salesOrderExternalRefPolicy` / `purchaseOrderBuyerRefPolicy`) |
