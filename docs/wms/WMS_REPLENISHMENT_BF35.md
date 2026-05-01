# BF-35 — Replenishment automation & priority queues (minimal slice)

## Data model

- **`ReplenishmentRule`**
  - **`priority`** (`Int`, default `0`) — higher values are evaluated earlier **within the same tier**.
  - **`maxTasksPerRun`** (`Int?`) — maximum automated `REPLENISH` tasks this rule may emit per **`create_replenishment_tasks`** invocation; `null` = no cap; **`0`** skips automation for that rule while it stays active.
  - **`exceptionQueue`** (`Bool`, default `false`) — **exception tier**: batch processing runs all **non-exception** rules first (sorted by priority), then exception-queue rules (sorted by priority).

- **`WmsTask`** (system-created replenishments)
  - **`replenishmentRuleId`** — optional FK to the rule (`ON DELETE SET NULL`).
  - **`replenishmentPriority`** / **`replenishmentException`** — snapshots at creation for Operations filtering without parsing `note`.

## Batch behavior

`create_replenishment_tasks`:

1. Loads active rules for the warehouse.
2. Sorts with **`sortReplenishmentRulesForBatch`** (`src/lib/wms/replenishment-batch.ts`): normal tier → exception tier; within tier by **descending `priority`**, then `productId`.
3. For each rule, respects **`maxTasksPerRun`** (`<= 0` skips).
4. Creates at most one replenishment task per rule per run when pick-face stock is below **`minPickQty`** (unchanged shortage logic).

## API / UI

- **`set_replenishment_rule`** accepts optional **`priority`**, **`maxTasksPerRun`** (omit field to leave unchanged on update; send integer including `0`), **`exceptionQueue`**.
- **Setup** (`Replenishment setup`): priority, max/run, exception-queue checkbox; warehouse snapshot table shows **Pri / Max/run / Exc**.
- **Operations → Open tasks**: when filtered to **Replenish**, optional **Tier** (standard vs exception-only) and **Min priority**; list sorts by snapshot priority descending.

## Tests

- Vitest: `src/lib/wms/replenishment-batch.test.ts`.

## References

- Phase capsule: [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) § BF-35.
