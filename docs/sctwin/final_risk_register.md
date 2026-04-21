# Supply Chain Twin Final Risk Register

Residual risk view for Twin program closeout, with explicit status, owner, and next action.

## Accepted risks

| Risk | Why accepted now | Owner | Next action |
| --- | --- | --- | --- |
| Non-production health index remains a stub (`healthIndex.mode=stub`) | Current operator workflows use readiness + contract checks; no production SLA decisions rely on score math yet. | Twin engineering lead | Replace stub scorer with production-backed KPI inputs in next planning cycle. |
| Maintenance governance is process-driven (not all controls are runtime-enforced) | Current maintenance routes are already permission-gated; runbook/governance docs cover approval/rollback flow adequately for this tranche. | Incident commander / platform on-call | Add policy-enforced approval metadata checks before any future maintenance-apply expansion. |
| Contract baseline v1 is curated by review process (not auto-generated snapshots) | Team prefers explicit baseline diffs and human intent review for Twin API contract changes. | API owner (Twin) | Revisit automated snapshot generation only if baseline churn creates review overhead. |

## Deferred risks

| Risk | Deferred impact | Owner | Next action |
| --- | --- | --- | --- |
| Runtime smoke still depends on reachable seeded app target | Program gates can pass while runtime smoke remains blocked in disconnected/local-offline sessions. | DevOps + Twin operator | Run smoke against seeded reachable target (`SCTWIN_SMOKE_BASE_URL=<url> npm run smoke:sctwin:e2e`) before final release approval. |
| No retained evidence yet for seeded runtime smoke PASS in current RC log | Stakeholders lack a complete runtime validation artifact for this tranche. | Release manager | Append PASS evidence to RC log once seeded smoke completes; include output summary and timestamp. |
| Retention apply path is not implemented (dry-run only) | Data lifecycle cleanup remains manual/process-driven; long-lived data growth risk is managed operationally for now. | Data platform owner | Design and ship guarded retention apply endpoint with audit trail and rollback playbook. |

## Status legend

- **Accepted:** Known limitation intentionally carried with mitigation.
- **Deferred:** Open item scheduled for follow-up before/after release window.

## References

- RC findings: `docs/sctwin/release_candidate_dry_run_2026-04-21.md`
- Governance controls: `docs/sctwin/governance_runbook.md`
- Operational command/route map: `docs/sctwin/runbook.md`
