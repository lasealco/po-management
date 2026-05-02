# BF-51 — Structured cycle counts (`WmsCycleCountSession`)

**Scope:** Multi-line **cycle count programs** with **frozen expected qty** per balance row, operator **submit**, optional **supervisor approval** before **`InventoryMovement`** **`ADJUSTMENT`** postings. Complements legacy **`WmsTask`** **`CYCLE_COUNT`** (`create_cycle_count_task` / `complete_cycle_count_task`), which still posts variance immediately on complete.

**Shipped**
- Models: **`WmsCycleCountSession`**, **`WmsCycleCountLine`** (`prisma/schema.prisma`).
- **`POST /api/wms`** actions (inventory tier — same coarse gates as other qty mutations):
  - **`create_cycle_count_session`** — `warehouseId`, optional **`cycleCountScopeNote`**; returns **`referenceCode`** (unique `CC-…`).
  - **`add_cycle_count_line`** — **`cycleCountSessionId`**, **`balanceId`** (must belong to session warehouse); snapshots **`expectedQty`** from current **`InventoryBalance.onHandQty`**.
  - **`set_cycle_count_line_count`** — **`cycleCountLineId`**, **`countedQty`**, optional **`cycleCountVarianceReasonCode`** / **`varianceNote`** (reason validated when non-empty).
  - **`submit_cycle_count`** — **`cycleCountSessionId`** (session **`OPEN`**): every line must have **`countedQty`**; variance lines must carry an allowed reason (**`SHRINK`**, **`DAMAGE`**, **`DATA_ENTRY`**, **`FOUND`**, **`OTHER`**). Lines with zero variance → **`MATCH_CLOSED`** (no movement). Non-zero → **`VARIANCE_PENDING`**; header **`SUBMITTED`**. All matched → header **`CLOSED`** immediately.
  - **`approve_cycle_count_variance`** — **`cycleCountSessionId`** (header **`SUBMITTED`**): posts **`ADJUSTMENT`** per **`VARIANCE_PENDING`** line (`referenceType` **`WMS_CYCLE_COUNT_LINE`**, **`referenceId`** = line id), updates **`InventoryBalance`**, sets line **`VARIANCE_POSTED`** + **`inventoryMovementId`**, closes session.
- **`GET /api/wms`** includes **`cycleCountSessions`** (recent sessions + lines, product-scoped read filter via existing view scope).
- **Operations** UI: **Cycle count program (BF-51)** workflow panel (`src/components/wms-client.tsx`).

**Variance reason codes** — enforced on submit when **counted ≠ expected** (frozen expected): `SHRINK`, `DAMAGE`, `DATA_ENTRY`, `FOUND`, `OTHER`.

**Out of scope (explicit)** — RFID wall-to-wall PI, ERP perpetual sync, recount/reopen workflow, separate supervisor role (same **`inventory`** mutation tier as other count writes).

**Related:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-51 · [`GAP_MAP.md`](./GAP_MAP.md) Cycle count row · [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md) catalog **BF-51**.

---

_Last updated: 2026-05-02 — BF-51 minimal slice landed._
