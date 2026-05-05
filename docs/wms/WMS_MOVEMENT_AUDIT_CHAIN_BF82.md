# Movement hash-chain audit export — BF-82

**Purpose:** Export a **contiguous tail** of **`InventoryMovement`** rows as a deterministic **SHA-256 hash chain** for tamper-evidence narratives (auditors compare **`chainTailHash`** across exports or recompute from the DB). No blockchain anchoring.

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-82; movement ledger filters pattern [**`movement-ledger-query`**](../../src/lib/wms/movement-ledger-query.ts); read scope [**`loadWmsViewReadScope`**](../../src/lib/wms/wms-read-scope.ts).

---

## Algorithm (`bf82.v1`)

1. Select movements for the tenant with optional **`since`**, **`until`**, **`warehouseId`**, **`movementType`** (same vocabulary as dashboard ledger **`MOVEMENT_LEDGER_TYPES`**).
2. Apply **`loadWmsViewReadScope`** product division filter when present (parity with Stock ledger).
3. Order strictly by **`createdAt` ascending**, then **`id` ascending** (this differs from the Stock UI table sort).
4. Take at most **`cap`** rows (default **200**, max **1000**).
5. For each row, **`entryDigest`** = SHA-256(UTF-8 canonical JSON). Canonical payload uses **sorted JSON keys** at every object level; decimals are decimal strings; timestamps ISO UTC.
6. **`chainHash`** folds: **`chain_0`** = genesis (**64 hex zeros**), then **`chain_i`** = SHA-256(`chain_{i-1}` ‖ **`entryDigest_i`**), each digest interpreted as **32-byte binary**.

Tampering a stored movement changes **`entryDigest`** for that row and every **`chainHash`** after it when the export is recomputed.

---

## API

| Surface | Grant | Notes |
|---------|-------|--------|
| **`GET /api/wms/movement-audit-chain`** | **`org.wms`** · **view** | Query: **`since`**, **`until`**, **`warehouseId`**, **`movementType`**, **`cap`**. Response **`schemaVersion`**: **`bf82.v1`**. |

---

## UI

Stock → **Recent stock movements**: link **Audit chain JSON (BF-82)** — carries current warehouse / type / date / row-cap filters into the GET query.

---

## Implementation

- [`src/lib/wms/movement-audit-chain-bf82.ts`](../../src/lib/wms/movement-audit-chain-bf82.ts)
- [`src/app/api/wms/movement-audit-chain/route.ts`](../../src/app/api/wms/movement-audit-chain/route.ts)
- [`buildMovementAuditChainBf82Url`](../../src/lib/wms/stock-ledger-url.ts)

---

## Tests

[`src/lib/wms/movement-audit-chain-bf82.test.ts`](../../src/lib/wms/movement-audit-chain-bf82.test.ts)

---

## Out of scope

- Persisted per-row chain anchors on **`InventoryMovement`** (possible future hardening).
- Public-chain anchoring.
