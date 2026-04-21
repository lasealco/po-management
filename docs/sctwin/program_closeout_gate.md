# Supply Chain Twin Program Closeout Gate (Slices 1-200)

This gate is the final closeout check for the Twin program tranche covering slices 1-200.

## Program closeout command (doc equivalent)

- Run from repo root:
  - `npm run verify:sctwin:full && echo "[sctwin-program] PASS: release gate complete for slices 1-200"`
- This composes the current full Twin release gate and prints a pass marker on success.

## What "done" means for slices 1-200

Mark the tranche as done only when all are true:

1. **Gate passes cleanly**
   - `npm run verify:sctwin:program` exits with status `0`.
2. **No untracked required artifacts**
   - Intended Twin docs/scripts/migrations for this tranche are committed.
3. **Release checklist completed**
   - `docs/sctwin/release_checklist.md` sections completed for the target environment.
4. **Smoke checks pass**
   - Core Twin pages and APIs respond as expected (overview, explorer, scenarios, readiness/entities/edges/events/metrics).
5. **Handoff package recorded**
   - Verification commands, migration/seed actions, and known risks are documented in release notes.

## Final closeout status template

Use this template in PR notes, release notes, or handoff docs.

```md
## Supply Chain Twin Program Closeout (Slices 1-200)

- Date:
- Owner:
- Commit SHA:
- Environment:

### Gate results
- `npm run verify:sctwin:full && echo "[sctwin-program] PASS: release gate complete for slices 1-200"`: PASS/FAIL
- `npm run verify:sctwin:full`: PASS/FAIL

### Migrations and seed actions
- Migrations applied:
- Seed commands run:

### Smoke routes checked
- `/supply-chain-twin`:
- `/supply-chain-twin/explorer`:
- `/supply-chain-twin/scenarios`:
- `/api/supply-chain-twin/readiness`:
- `/api/supply-chain-twin/entities`:
- `/api/supply-chain-twin/edges`:
- `/api/supply-chain-twin/events`:
- `/api/supply-chain-twin/metrics`:

### Outcome
- Program tranche status: COMPLETE / BLOCKED
- Blocking issues (if any):
```

## Final risk log template

Track residual risks at closeout using this format.

```md
## Twin Final Risk Log (Slices 1-200)

| Risk ID | Area | Severity | Description | Mitigation | Owner | Next Action | Target Date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCTWIN-R001 | Example: Exports | Medium | Example risk summary | Existing guardrails and caps | Team/Person | Specific follow-up step | YYYY-MM-DD | Open / Mitigated / Accepted |
```

## Notes

- Keep this document environment-secret-free.
- Prefer forward-fix migrations for DB issues; avoid destructive rollback operations.
