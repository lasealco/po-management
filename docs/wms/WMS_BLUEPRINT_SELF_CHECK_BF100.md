# Blueprint self-check — POST /api/wms actions vs GAP_MAP (BF-100)

**Objective:** Catch drift between shipped **`handleWmsPost`** discriminators in [`src/lib/wms/post-actions.ts`](../../src/lib/wms/post-actions.ts) and the human-maintained action inventory under **`GAP_MAP.md`** ([§ Existing API actions](./GAP_MAP.md)).

## Run

From repository root:

```bash
npm run check:wms-blueprint
```

Options:

- **`--json`** — machine-readable report (`bf100.v1` schema) on stdout.

Exit code **`0`** when every `if (action === "…")` branch in `handleWmsPost` has a matching lowercase **snake_case** token (with underscore) in the **first** prose paragraph under **Existing API actions (`POST /api/wms`)** in [`GAP_MAP.md`](./GAP_MAP.md), and vice versa.

Exit code **`1`** lists actions **in code but missing from** that paragraph, or tokens **in the paragraph that are not** wired as discriminators (often typos or stale docs).

## Maintenance

When adding a new **`POST /api/wms`** action:

1. Implement the branch in **`post-actions.ts`**.
2. Append the action id (same string as **`body.action`**) to the long comma-separated paragraph in **`GAP_MAP.md`** so the self-check stays green.

The paragraph intentionally excludes the short **BF-100** helper note below it (so words like “snake_case” in that note are not parsed as actions).

## Out of scope

Formal ISO / SOC evidence tooling — this is a lightweight engineering regression guard only.
