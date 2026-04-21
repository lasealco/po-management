# Supply Chain Twin RC Dry Run — 2026-04-21

Observation-only release-candidate dry run for the current Twin slice stack.

## Environment

- Workspace: local checkout (`main`)
- Runtime target for smoke pack: `http://localhost:3000` (default `SCTWIN_SMOKE_BASE_URL`)
- Notes: this run records findings only; no feature changes were made.

## Commands executed

1. `npm run verify:sctwin:program`
2. `npm run smoke:sctwin:e2e`

## Findings (ordered by severity)

### High

1. **Runtime smoke target unavailable**
   - Status: **Resolved (Slice 238 stabilization)**
   - Command: `npm run smoke:sctwin:e2e`
   - Result: `overall fail (0/5 steps passed)`
   - Evidence: all API steps (`readiness`, `explorer`, `scenarios`, `risks`, `exports`) returned connection-level `TypeError` with `status: 0`.
   - Impact: RC runtime/API health could not be validated in this environment.
   - Stabilization fix: smoke pack now emits explicit `BASE_URL_UNREACHABLE` classification with `baseUrlReachable=false` and `blockingReason` summary instead of opaque TypeError-only output.
   - Next step: run smoke pack against a live seeded app (`SCTWIN_SMOKE_BASE_URL=<reachable-url> npm run smoke:sctwin:e2e`).

### Medium

1. **No seeded runtime evidence captured**
   - Status: **Open**
   - Because the app endpoint was unreachable, this dry run does not confirm seeded tenant behavior for UI/API smoke flows.
   - Suggested next step: execute smoke pack after confirming app runtime + database seed alignment.

### Low

1. **Program gate healthy**
   - Status: **Accepted**
   - Command: `npm run verify:sctwin:program`
   - Result: `PASS`
   - Summary:
     - `PASS pre-release gate`
     - `PASS release gate`
     - `overall=PASS passed=2/2 failed=0 total=45.19s`

## RC conclusion

- **Status:** `CONDITIONAL PASS`
- Code-quality and contract gates are green.
- Runtime acceptance remains blocked until smoke pack runs successfully against a reachable seeded environment.
