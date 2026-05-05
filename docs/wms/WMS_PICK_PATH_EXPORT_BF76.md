# Pick path export (BF-76 minimal)

**Authority:** [`BF71_BF100_MEGA_PHASES.md`](./BF71_BF100_MEGA_PHASES.md) §BF-76; complements **BF-56** batch/cluster waves ([`WMS_BATCH_PICK_BF56.md`](./WMS_BATCH_PICK_BF56.md)) and **BF-50** topology fields on **`WarehouseBin`**.

## Landed behavior

| Surface | Detail |
|--------|--------|
| **GET** | **`/api/wms/pick-path-export?waveId=`** — requires **`waveId`**. **`org.wms` → view**; respects **`loadWmsViewReadScope`** on **`WmsWave`**, **`WmsTask`**, and **`OutboundOrderLine`** joins. Default response is **`bf76.v1`** JSON. **`format=csv`** returns **`text/csv`** attachment. |
| **Ordering** | **OPEN** **`PICK`** tasks on the wave: grouped by **`binId`** where present; bins sorted by **`compareBinsTopology`** (cross-dock staging → zone → aisle → rack → bay → level → position → pick-face tie-breaks → bin code). Tasks without a resolved bin emit **one visit each** ( **`binCode`** falls back to **`batchGroupKey`** when set ). Lines within a visit sort by **`outboundNo`**, **`lineNo`**, **`batchGroupKey`**, **`taskId`**. |
| **Payload shape** | **`schemaVersion`**: **`bf76.v1`**; **`visits[]`** with **`visitSeq`**, bin topology snapshot fields, **`lines`** (`taskId`, outbound refs, SKU token, qty, lot). Counts: **`openPickTaskCount`**, **`visitCount`**. **`generatedAt`** ISO timestamp. |
| **UI** | **`/wms`** Wave picking section — per-wave **BF-76 JSON** / **BF-76 CSV** links (same-session cookie auth). |

## Out of scope

MILP / TSP routing, AMR dispatch replanning, labor heatmaps.

_Last updated: 2026-04-29 — BF-76 minimal slice._
