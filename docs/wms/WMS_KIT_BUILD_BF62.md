# BF-62 — Kit assembly / build-to-order postings (minimal slice)

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-62; extends **BF-18** BOM + **BF-53** labor standards.

## Landed behavior

| Surface | Detail |
|--------|--------|
| **Model** | **`WmsTaskType.KIT_BUILD`**; task **`productId`** / **`binId`** = output SKU / destination bin; **`quantity`** = kit count; **`note`** JSON **`{ bf62KitBuild: { v: 1, bomRepresentsOutputUnits, lines: [{ bomLineId, binId, lotCode }] } }`**. |
| **POST** | **`create_kit_build_task`** — `workOrderId`, `kitOutputProductId`, `kitOutputBinId`, `kitBuildQuantity`, optional `bomRepresentsOutputUnits` (default 1), **`kitBuildLines`** (one row per BOM line with positive scaled consumption vs remaining plan). Pre-checks component on-hand; creates OPEN task; WO **`IN_PROGRESS`**. **Tier:** `operations`. |
| **POST** | **`complete_kit_build_task`** — `taskId`. Recomputes deltas; **`ADJUSTMENT`** out of component bins (**`KIT_BUILD_TASK`** ref); increments **`WmsWorkOrderBomLine.consumedQty`**; upserts finished good into output bin + movement; task **DONE**; WO **DONE** when all BOM lines consumed; **`CtAuditLog`** `kit_build_task_completed`. |
| **Lib** | **`src/lib/wms/kit-build.ts`** — payload parse/serialize, **`computeKitBuildLineDeltas`**, **`validateKitBuildLinePicks`**. |
| **UI** | **`/wms`** — Value-add workflow **Step 3 · Kit build (BF-62)**; Open tasks filter + complete for **`KIT_BUILD`**. |

## Out of scope

Full discrete MES routing, multi-output kits, alternate BOM revisions.

_Last updated: 2026-04-29 — BF-62 minimal slice._
