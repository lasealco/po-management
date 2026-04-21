# Supply Chain Twin Large Fixture Validation Checklist

Use this checklist after running the opt-in large tenant seed to confirm fixture health quickly and consistently.

Seed command:

- `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-large-fixture`

## 1) Fast data-shape checks (expected minimums)

Use tenant `demo-company` and verify these minimum counts:

- Entities: `>= 1200`
- Edges: `>= 2000`
- Events: `>= 3200`
- Risk signals: `>= 180`
- Scenario drafts: `>= 140`

Recommended API spot-checks (first page, default sort):

- `GET /api/supply-chain-twin/entities?limit=1`
- `GET /api/supply-chain-twin/edges?limit=1`
- `GET /api/supply-chain-twin/events?limit=1`
- `GET /api/supply-chain-twin/risk-signals?limit=1`
- `GET /api/supply-chain-twin/scenarios?limit=1`

Pass condition:

- All endpoints return `200`.
- Payload shape matches contracts (`items` arrays, `nextCursor` present or `null`).
- Results are non-empty for seeded tenant.

## 2) Key smoke routes (UI + API)

Open these routes and confirm no blocking errors:

- `/supply-chain-twin`
- `/supply-chain-twin/explorer`
- `/supply-chain-twin/scenarios`
- `/api/supply-chain-twin/readiness`
- `/api/supply-chain-twin/metrics`

Pass condition:

- Overview renders with non-zero catalog totals.
- Explorer/scenarios pages load and paginate.
- Readiness returns `ok: true` for healthy seeded environment.

## 3) Determinism rerun checks

Re-run seed once, then re-check:

- `USE_DOTENV_LOCAL=1 npm run db:seed:supply-chain-twin-large-fixture`

Expected outcomes:

- No runaway growth from duplicate fixture records.
- Event/risk/entity/scenario counts remain stable within expected minima.
- Edge/scenario fixture slices remain deterministic after replacement logic.

## 4) Troubleshooting quick map

- **`403` from Twin APIs**: verify permitted session and Twin access flags.
- **Empty lists**: ensure app and seed command target the same `DATABASE_URL`.
- **Readiness table/schema errors**: run `npm run db:migrate` then retry readiness.
- **Slow pages on high offsets**: verify latest Twin index migrations and narrow filters/window.
- **Export row-cap errors**: reduce scope (`since/until`, `type`) and export in smaller slices.

## 5) Suggested handoff snippet

```
Large fixture validation (demo-company):
- Seed run: PASS
- Min counts: entities>=1200, edges>=2000, events>=3200, risks>=180, scenarios>=140 (PASS/FAIL)
- Smoke routes: /supply-chain-twin, /explorer, /scenarios, /readiness, /metrics (PASS/FAIL)
- Determinism rerun: no duplicate growth observed (PASS/FAIL)
- Notes: <short operator notes>
```
