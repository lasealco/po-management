# Supply Chain Twin Contract Snapshot Baseline (v1)

This baseline freezes canonical response payloads for key Twin endpoints so contract drift is explicit in pull-request diffs.

## Baseline artifact

- Source of truth: `src/app/api/supply-chain-twin/contract-snapshot-baseline.v1.ts`
- Verification test: `src/app/api/supply-chain-twin/contract-snapshot-baseline.contract.test.ts`
- Included endpoints (v1):
  - `/api/supply-chain-twin/readiness`
  - `/api/supply-chain-twin/entities?fields=summary&limit=1`
  - `/api/supply-chain-twin/scenarios?limit=1`
  - `/api/supply-chain-twin/risk-signals?limit=1`
  - `/api/supply-chain-twin/events/export?format=json&limit=1&includePayload=false`

## Review process for baseline updates

1. Make the intended API contract change in Twin routes/schemas.
2. Run `npm run test:sctwin:contracts` and inspect the failing baseline diff.
3. Update `contract-snapshot-baseline.v1.ts` only for intentional contract changes.
4. In PR description, include:
   - Why contract changed,
   - Which clients/operators are affected,
   - Any rollout/migration notes.
5. Re-run `npm run verify:sctwin:full` before merge.

## Policy

- Do not update the baseline for unrelated refactors.
- If a response shape change is accidental, fix route/schema code instead of editing the baseline.
