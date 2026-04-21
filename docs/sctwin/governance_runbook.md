# Supply Chain Twin Governance Runbook

Operational governance for Twin maintenance and high-impact actions.

## Roles and approval levels

- **Operator (Twin-enabled session):**
  - Can run read-only diagnostics and dry-run checks.
  - Examples: readiness checks, integrity read-only endpoints, retention dry-run reports.
- **Maintenance admin (`org.settings` + `edit`):**
  - Can execute guarded maintenance routes.
  - Examples: integrity repair apply endpoint.
- **Change approver (engineering lead or incident commander):**
  - Required for production-affecting maintenance apply actions.
  - Confirms scope, timing window, and rollback plan before execution.

## Action matrix (who can do what)

| Action | Role required | Approval required | Notes |
| --- | --- | --- | --- |
| Readiness/metrics/list/export reads | Operator | No | Standard Twin API access rules still apply. |
| Integrity dry-run (`GET /integrity/repair-dry-run`) | Maintenance admin | No | Read-only preview; safe to run repeatedly. |
| Integrity apply (`POST /integrity/repair-apply`) | Maintenance admin | Yes | Requires explicit change approval in prod-like envs. |
| Retention dry-run report | Operator | No | Read-only scaffold; no deletes in current slice. |

## Pre-flight checklist (before maintenance apply)

1. Confirm requester/runner has maintenance admin access.
2. Capture current dry-run output and expected action count.
3. Confirm backup/restore posture and maintenance window.
4. Run `npm run verify:sctwin:full` on target release commit.
5. Define rollback trigger thresholds (unexpected row delta, error spikes, support impact).

## Rollback guidance (practical)

- **If apply command fails before writes complete:**
  - Stop retries and capture error payload/log context.
  - Re-run dry-run to confirm residual candidate set.
- **If apply succeeds but outcome is unexpected:**
  - Pause further maintenance actions.
  - Use audit markers and API logs to identify action scope and target IDs.
  - Restore from DB backup/snapshot if data correctness is impacted.
- **If endpoint access/policy is incorrect:**
  - Revert offending deploy/commit and redeploy.
  - Validate route guard behavior with unauthorized test cases before re-run.

## Escalation path

1. Operator pages on-call engineer when maintenance output deviates from dry-run expectation.
2. On-call engineer engages incident commander for production-impact decisions.
3. Incident commander approves rollback or forward-fix plan.
4. Post-incident, attach:
  - dry-run summary,
  - apply summary,
  - audit marker evidence,
  - rollback/fix decision log.

## Current constraints (explicit)

- Maintenance governance currently covers integrity maintenance paths.
- Retention is dry-run only in the current tranche; no retention apply endpoint yet.
