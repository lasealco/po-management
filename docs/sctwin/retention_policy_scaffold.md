# Supply Chain Twin Retention Policy Scaffold (Dry-Run)

Slice 226 adds a safe, read-only retention scaffold so operators can estimate cleanup impact before any destructive path exists.

## What exists now

- Library dry-run report: `src/lib/supply-chain-twin/retention-dry-run.ts`
- Function: `getTwinRetentionDryRunForTenant(tenantId, options?)`
- Behavior: read-only candidate counts + sample IDs per bucket (no deletes).

## Current policy buckets

- Ingest events older than policy cutoff (`createdAt`)
- Scenario revisions older than policy cutoff (`createdAt`)
- Archived scenario drafts older than policy cutoff (`updatedAt`)

## Policy source (env scaffold)

Optional environment variables:

- `SCTWIN_RETENTION_INGEST_EVENTS_DAYS` (default `180`)
- `SCTWIN_RETENTION_SCENARIO_REVISIONS_DAYS` (default `365`)
- `SCTWIN_RETENTION_ARCHIVED_SCENARIOS_DAYS` (default `365`)

Invalid values fall back to defaults (range guard: `1..3650` days).

## Example usage (code-level)

```ts
import { getTwinRetentionDryRunForTenant } from "@/lib/supply-chain-twin/retention-dry-run";

const report = await getTwinRetentionDryRunForTenant("tenant-id", { sampleLimit: 20 });
```

Output includes:

- `policy` in effect
- `candidates` counts and sample IDs
- explicit `deferred` list

## Explicitly deferred (not in this slice)

- No retention apply/delete endpoint or scheduled job
- No tenant-level persisted policy UI/settings model
- No cascade strategy beyond the three dry-run buckets above
- No irreversible operations; this slice remains read-only by design
