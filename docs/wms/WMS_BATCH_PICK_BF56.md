# Batch / cluster pick waves — BF-56 (minimal)

**Purpose:** **Cluster-oriented pick waves** — optional **`BATCH`** mode on **`create_pick_wave`** walks **bins in stable visit order** (cross-dock staging first, then bin code) and allocates picks across **released/picking outbound lines** at each stop. Pick tasks carry **`batchGroupKey`** (source **`binId`**) so UIs can group cart-style work. Complements existing **BF-15** wave + allocation strategies without AMR re-batch.

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-56; catalog [`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md).

---

## What shipped

| Piece | Details |
|-------|---------|
| **Schema** | `WmsWavePickMode` (**`SINGLE_ORDER`**, **`BATCH`**); **`WmsWave.pickMode`** (default **`SINGLE_ORDER`**); **`WmsTask.batchGroupKey`** (nullable, set for **`BATCH`** picks). |
| **POST** | **`create_pick_wave`** accepts **`pickWavePickMode`** or alias **`pickMode`**: **`SINGLE_ORDER`** (default, legacy loop) or **`BATCH`**. **Batch is rejected** for **solver prototype** allocation strategies (`SOLVER_PROTOTYPE_*`); use **`SINGLE_ORDER`** there. |
| **Behavior** | **`BATCH`:** clone slot pools, compute bin visit order, for each bin then each outbound line (stable **`openLines`** order) allocate from matching slot; carton cap + balance allocation same as single-order path. |
| **Payload** | **`GET /api/wms`** waves include **`pickMode`**; open pick tasks include **`batchGroupKey`**; task **`wave`** includes **`pickMode`**. |

## UI

- **`/wms`** — Wave picking section: **Pick wave mode** selector + **Create pick wave**; wave list shows **Batch BF-56** chip; open tasks show **Batch wave** + **Cluster stop · bin …** when **`batchGroupKey`** is set.

## Out of scope

AMR cluster bots, dynamic **re-batch** during pick, merging multiple outbound lines into a single pick row (tasks stay **one outbound line** per task; clustering is **visit order + group key**).

---

_Last updated: 2026-04-29 — BF-56 minimal slice._
