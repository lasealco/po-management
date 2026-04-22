# API Hub — one-agent milestones (1–100)

Use this doc as the single execution plan for API Hub work. Implement one slice at a time unless explicitly asked otherwise.

## Rules

- Stay in API Hub scope unless a slice explicitly allows a minimal shared touch.
- Prefer these paths: `src/app/apihub/**`, `src/app/api/apihub/**`, `src/lib/apihub/**`, and `prisma/**` only when required.
- No secrets in git. Use refs/placeholders.
- Keep commits small, and stop after each slice.

---

## Slice 1 — Contracts inventory
**Goal:** Catalog existing API Hub endpoints, payloads, and error codes.
**Paths:** `docs/apihub/**`
**Done when:** One table lists routes, methods, auth, and status.

## Slice 2 — Error code registry
**Goal:** Define canonical API Hub error code map in docs.
**Paths:** `docs/apihub/**`, optional `src/lib/apihub/**`
**Done when:** Routes can reference one source of truth.

## Slice 3 — Connector DTO freeze v1
**Goal:** Freeze `connector` response contract with examples.
**Paths:** `docs/apihub/**`, `src/lib/apihub/**`, tests
**Done when:** Contract test parses route payload.

## Slice 4 — Ingestion run DTO freeze v1
**Goal:** Freeze run DTO and audit event schema.
**Paths:** `docs/apihub/**`, `src/lib/apihub/**`, tests
**Done when:** Contract docs and tests align.

## Slice 5 — Mapping preview DTO freeze
**Goal:** Standardize mapping preview response shape.
**Paths:** `src/app/api/apihub/**`, `src/lib/apihub/**`, tests
**Done when:** Preview payload is stable and validated.

## Slice 6 — Apply result DTO freeze
**Goal:** Standardize apply route response fields and replay semantics.
**Paths:** `src/app/api/apihub/**`, `src/lib/apihub/**`, tests
**Done when:** Apply response consistent across applied/replayed cases.

## Slice 7 — Route-level schema assertions
**Goal:** Add zod-based response assertions in route tests.
**Paths:** `src/app/api/apihub/**`, `src/lib/apihub/**`
**Done when:** Core route contracts fail fast on drift.

## Slice 8 — Request-id propagation
**Goal:** Add consistent request-id handling for API Hub success/error responses.
**Paths:** `src/app/api/apihub/**`, `src/lib/apihub/**`
**Done when:** All routes emit traceable id.

## Slice 9 — Central query limit helper
**Goal:** Reuse one helper for limit/window parsing and caps.
**Paths:** `src/lib/apihub/**`, route handlers + tests
**Done when:** No duplicate limit parsing logic remains.

## Slice 10 — Limit error normalization
**Goal:** Standardize validation/limit error payloads.
**Paths:** `src/lib/apihub/**`, `src/app/api/apihub/**`
**Done when:** Clients can rely on one error format.

---

## Slice 11 — Connector list filters v1
**Goal:** Add status/authMode filters and tests.
**Paths:** connectors API/repo/tests
**Done when:** Filtered list route returns deterministic results.

## Slice 12 — Connector search q
**Goal:** Add `q` search for connectors with stable ranking.
**Paths:** connectors API/repo/tests
**Done when:** Name exact/prefix/contains ranking tested.

## Slice 13 — Connector sort options
**Goal:** Add safe allowlist sort options.
**Paths:** connectors API/repo/schemas/tests
**Done when:** Unsupported sort gives validation error.

## Slice 14 — Connector audit history endpoint
**Goal:** Add `GET /api/apihub/connectors/:id/audit`.
**Paths:** connectors route + repo + tests
**Done when:** Audit rows are tenant-scoped and paged.

## Slice 15 — Connector lifecycle timeline UI
**Goal:** Display connector audit timeline on `/apihub`.
**Paths:** `src/app/apihub/**`, `src/components/**` in apihub scope
**Done when:** Operator can inspect connector changes.

## Slice 16 — Connector disable guardrails
**Goal:** Prevent disabling active connector with running jobs unless forced note.
**Paths:** connector patch route/repo/tests
**Done when:** Conflict contract covered by tests.

## Slice 17 — Connector metadata notes
**Goal:** Optional ops note field with length cap.
**Paths:** prisma optional, connector route/repo/tests
**Done when:** Notes persist and appear in audit.

## Slice 18 — Connector readiness summary
**Goal:** Compute per-connector readiness summary fields.
**Paths:** `src/lib/apihub/**`, connectors API/tests
**Done when:** Summary appears in list/detail payload.

## Slice 19 — Connector health checks endpoint
**Goal:** Add lightweight health probe endpoint per connector.
**Paths:** `src/app/api/apihub/connectors/[id]/health/**`, lib/tests
**Done when:** Health response stable with safe messages.

## Slice 20 — Connector secrets ref validation hardening
**Goal:** Tighten `authConfigRef` format validation.
**Paths:** connector routes/lib/tests
**Done when:** Invalid ref patterns rejected consistently.

---

## Slice 21 — Ingestion run list pagination
**Goal:** Keyset cursor for ingestion runs.
**Paths:** ingestion jobs API/repo/schemas/tests
**Done when:** `nextCursor` flow works across filters.

## Slice 22 — Ingestion run list filters expansion
**Goal:** Add `connectorId`, `triggerKind`, `attemptRange` filters.
**Paths:** ingestion jobs API/repo/tests
**Done when:** Combined filter behavior covered.

## Slice 23 — Ingestion run detail enrichment
**Goal:** Include derived timings + retry counters in detail.
**Paths:** `src/lib/apihub/run-observability.ts`, route/tests
**Done when:** Detail payload includes derived metrics.

## Slice 24 — Retry idempotency hardening
**Goal:** Strict replay contract for retry idempotency key collisions.
**Paths:** retry route/repo/tests
**Done when:** Replay returns predictable status + body.

## Slice 25 — Retry budget policy
**Goal:** Configurable retry max attempts per run type.
**Paths:** lib/constants + repo + tests
**Done when:** Policy enforced with clear errors.

## Slice 26 — Run transition guards hardening
**Goal:** Ensure no illegal transitions under race conditions.
**Paths:** run lifecycle/repo/tests
**Done when:** Transition check is atomic/tested.

## Slice 27 — Run status timeline endpoint
**Goal:** Add condensed status timeline endpoint.
**Paths:** ingestion jobs API/repo/tests
**Done when:** Timeline powers UI and is paged.

## Slice 28 — Run apply conflict modes
**Goal:** Distinguish apply conflicts (not succeeded, already applied, blocked).
**Paths:** apply route/repo/tests
**Done when:** Conflict codes are specific and stable.

## Slice 29 — Run ops summary endpoint
**Goal:** Tenant-wide run ops summary (`queued/running/failed/succeeded` + trends).
**Paths:** ingestion jobs API/lib/tests
**Done when:** Ops dashboard can render from one endpoint.

## Slice 30 — Run ops panel UI
**Goal:** Add run summary cards and quick filters on `/apihub`.
**Paths:** `src/app/apihub/**`, apihub components
**Done when:** Operators can triage by status quickly.

---

## Slice 31 — Mapping rule validator v2
**Goal:** Add stricter rule validation (duplicate targets, invalid paths).
**Paths:** mapping engine + preview route/tests
**Done when:** Invalid rule sets rejected with detailed issues.

## Slice 32 — Mapping transform coverage expansion
**Goal:** Add transforms for boolean/currency and tests.
**Paths:** mapping engine/tests
**Done when:** New transforms deterministic and documented.

## Slice 33 — Mapping issue severity taxonomy
**Goal:** Classify mapping issues (error/warn/info).
**Paths:** mapping engine, preview API/tests
**Done when:** UI can separate blocking vs non-blocking issues.

## Slice 34 — Mapping preview sampling controls
**Goal:** Add `sampleSize` + max cap for preview responses.
**Paths:** mapping preview route/schemas/tests
**Done when:** Large payload previews remain bounded.

## Slice 35 — Mapping template save endpoint
**Goal:** Create mapping template persistence API.
**Paths:** apihub mapping API/lib, prisma optional, tests
**Done when:** Templates are create/list/read capable.

## Slice 36 — Mapping template update/delete
**Goal:** Add patch/delete for templates with audit.
**Paths:** mapping templates API/lib/tests
**Done when:** Lifecycle complete and tenant-scoped.

## Slice 37 — Mapping templates UI manager
**Goal:** Manage templates in API Hub page.
**Paths:** `src/app/apihub/**`, apihub components
**Done when:** Users can create/select/edit/delete templates.

## Slice 38 — Mapping diff preview
**Goal:** Compare current rules vs selected template.
**Paths:** mapping preview/lib + UI/tests
**Done when:** Rule delta shown before apply.

## Slice 39 — Mapping validation report export
**Goal:** Download mapping preview issues as JSON/CSV.
**Paths:** mapping preview/export API + UI/tests
**Done when:** Ops can attach reports to tickets.

## Slice 40 — Mapping docs synchronization
**Goal:** Update API Hub docs with mapping contract and examples.
**Paths:** `docs/apihub/**`
**Done when:** README/GAP_MAP/RUNBOOK reflect mapping state.

---

## Slice 41 — Apply write-path dry-run
**Goal:** Add dry-run mode for apply endpoint.
**Paths:** apply route/repo/tests
**Done when:** Dry-run returns intended write summary only.

## Slice 42 — Apply idempotency explicit key
**Goal:** Add idempotency-key support for apply calls.
**Paths:** apply route/repo/tests
**Done when:** Apply replay behavior is deterministic.

## Slice 43 — Apply target summary enrichment
**Goal:** Return counts of created/updated/skipped items.
**Paths:** apply route/lib/tests
**Done when:** Apply results are operationally useful.

## Slice 44 — Apply rollback stub contract
**Goal:** Define rollback response contract (stub/no-op if not implemented).
**Paths:** apply API/lib/tests/docs
**Done when:** Future rollback path is documented and routable.

## Slice 45 — Apply audit expansion
**Goal:** Add richer structured audit metadata on apply/retry.
**Paths:** repo/audit model/tests
**Done when:** Audit records support root-cause analysis.

## Slice 46 — Apply conflict queue endpoint
**Goal:** List apply conflicts for operator review.
**Paths:** apihub API/lib, prisma optional, tests
**Done when:** Conflicts view is queryable.

## Slice 47 — Apply conflicts UI queue
**Goal:** Add conflicts table and resolution actions scaffold.
**Paths:** `/apihub` UI/components
**Done when:** Operators can inspect conflict queue.

## Slice 48 — Post-apply alerts summary
**Goal:** Emit alert-style summaries tied to failed/apply outcomes.
**Paths:** apihub lib/API/tests
**Done when:** Alert payload available for UI + integrations.

## Slice 49 — Alert panel UI
**Goal:** Show alert summary panel in API Hub page.
**Paths:** `/apihub` UI/components
**Done when:** Priority issues visible on page load.

## Slice 50 — Apply runbook docs
**Goal:** Document apply workflow, dry-run, replay, conflicts.
**Paths:** `docs/apihub/**`
**Done when:** Operators can run/triage apply safely.

---

## Slice 51 — API Hub permissions matrix
**Goal:** Define explicit permissions for connector/run/mapping/apply actions.
**Paths:** `docs/apihub/**`, optional `src/lib/apihub/**`
**Done when:** Matrix aligns with route guards.

## Slice 52 — Route guard parity pass
**Goal:** Apply permission checks consistently across API Hub endpoints.
**Paths:** `src/app/api/apihub/**`, tests
**Done when:** No endpoint bypasses intended checks.

## Slice 53 — UI permission gating pass
**Goal:** Hide/disable actions based on API Hub permissions.
**Paths:** `src/app/apihub/**`, apihub components
**Done when:** UI/API permission behavior is consistent.

## Slice 54 — Sensitive data leakage audit
**Goal:** Ensure no secrets/raw source payloads leak in errors/logs.
**Paths:** `src/app/api/apihub/**`, `src/lib/apihub/**`, tests
**Done when:** Leakage tests/checklist pass.

## Slice 55 — Request budget/abuse protections
**Goal:** Add caps on rows, payload size, and expensive query windows.
**Paths:** API routes + shared helpers/tests
**Done when:** Abuse-limit tests pass.

## Slice 56 — API Hub contract conformance suite
**Goal:** Add schema conformance tests for all major APIs.
**Paths:** `src/app/api/apihub/**/*.test.ts`, `src/lib/apihub/**`
**Done when:** Contract drift fails CI.

## Slice 57 — verify:apihub script
**Goal:** Add scoped verify script (ts + tests + optional lint subset).
**Paths:** `package.json`, optional `vitest.config.ts`, docs
**Done when:** One command validates API Hub slice quality.

## Slice 58 — Performance/index tuning pass
**Goal:** Add prisma indexes for API Hub hot paths.
**Paths:** `prisma/schema.prisma`, `prisma/migrations/**`
**Done when:** List/detail/filter routes avoid full scans.

## Slice 59 — Release checklist + smoke suite
**Goal:** Add API Hub release checklist and smoke command sequence.
**Paths:** `docs/apihub/**`, tests/scripts if needed
**Done when:** Release process is repeatable.

## Slice 60 — API Hub closeout audit
**Goal:** Full module audit and cleanup pass (code, contracts, docs, tests).
**Paths:** API Hub scope only
**Done when:** Module is handoff-ready with residual risk log.

---

## Enterprise polish tranche (61–100)

## Slice 61 — Multi-tenant isolation hardening
**Goal:** Deep-pass tenant scoping assertions on all API Hub repository queries.
**Paths:** `src/lib/apihub/**`, `src/app/api/apihub/**`, tests
**Done when:** No query can read/write across tenant boundary.

## Slice 62 — Actor attribution parity
**Goal:** Ensure all mutating actions persist actor id in audit metadata.
**Paths:** apihub routes/repos/tests
**Done when:** Every mutation has actor traceability.

**Status:** Complete — `POST .../apply` and `POST .../retry` append `metadata.actorUserId` alongside the `ApiHubIngestionRunAuditLog.actorUserId` column; see [ACTOR_ATTRIBUTION.md](./ACTOR_ATTRIBUTION.md).

## Slice 63 — Audit schema normalization
**Goal:** Standardize audit event names and payload structure across connectors/runs/apply.
**Paths:** `src/lib/apihub/**`, tests, docs
**Done when:** Audit consumers parse one stable shape.

**Status:** Complete — canonical `apihub.<resource>.<event>` `action` values (writers + migration `20260430110000_apihub_audit_action_normalize`); ingestion-run audit `metadata` includes `schemaVersion` + `resourceType`. See [AUDIT_SCHEMA.md](./AUDIT_SCHEMA.md).

## Slice 64 — API versioning envelope
**Goal:** Introduce explicit API version metadata in responses/headers.
**Paths:** `src/app/api/apihub/**`, `src/lib/apihub/**`, docs/tests
**Done when:** Clients can detect contract version cleanly.

## Slice 65 — Backward compatibility test pack
**Goal:** Add compatibility tests for v1 payload assumptions.
**Paths:** `src/app/api/apihub/**/*.test.ts`
**Done when:** Breaking changes trigger obvious failures.

## Slice 66 — Cursor pagination consistency pass
**Goal:** Align cursor semantics across connectors/runs/audits.
**Paths:** apihub routes/repos/schemas/tests
**Done when:** Pagination behavior is uniform.

## Slice 67 — Search and filter composability
**Goal:** Ensure combined filters are deterministic and documented.
**Paths:** routes/repos/tests/docs
**Done when:** Filter precedence is explicit and covered.

## Slice 68 — Sorting stability guarantees
**Goal:** Add deterministic secondary sort keys for all list endpoints.
**Paths:** apihub repos/routes/tests
**Done when:** Repeated queries return stable ordering.

## Slice 69 — Endpoint budget metrics
**Goal:** Emit per-endpoint budget metrics (row limits, runtime class).
**Paths:** API logging helper + routes/tests
**Done when:** Heavy endpoints are measurable and observable.

## Slice 70 — Timeout and retry guidance docs
**Goal:** Document expected timeout/retry strategy per endpoint class.
**Paths:** `docs/apihub/**`
**Done when:** Integrators have clear retry guidance.

---

## Slice 71 — Ingestion run dedupe hardening
**Goal:** Enforce stronger idempotency semantics for ingestion-run creation/retry.
**Paths:** run routes/repos/tests
**Done when:** Duplicate requests never create unintended extra runs.

## Slice 72 — Apply transactional boundaries review
**Goal:** Validate apply path transaction scopes and failure rollback behavior.
**Paths:** apply repo/route/tests
**Done when:** Partial apply states are prevented or clearly reported.

## Slice 73 — Conflict classification matrix
**Goal:** Expand and normalize conflict categories for apply/retry transitions.
**Paths:** apihub error helpers/routes/tests/docs
**Done when:** Operators see actionable conflict classes.

## Slice 74 — Retry escalation policy hooks
**Goal:** Add escalation metadata when retry limits are exhausted.
**Paths:** run retry route/lib/tests
**Done when:** Exhausted retries surface actionable escalation data.

## Slice 75 — Run SLA timer fields
**Goal:** Include SLA breach indicators in run observability payloads.
**Paths:** `src/lib/apihub/run-observability.ts`, routes/tests
**Done when:** UI can highlight SLA breaches without extra logic.

## Slice 76 — Ops digest endpoint v2
**Goal:** Add richer digest endpoint combining run, conflict, and alert summaries.
**Paths:** apihub API/lib/tests
**Done when:** One API call powers operations dashboard.

## Slice 77 — Ops digest UI refinement
**Goal:** Improve `/apihub` triage UX using digest v2 payload.
**Paths:** `src/app/apihub/**`, apihub components
**Done when:** Priority issues are surfaced clearly and quickly.

## Slice 78 — Alert deduplication semantics
**Goal:** Prevent duplicate alert rows for repeated identical failures.
**Paths:** alert lib/routes/tests
**Done when:** Alert stream stays high-signal.

## Slice 79 — Alert acknowledgment flow
**Goal:** Add ack/unack API contract and UI for API Hub alerts.
**Paths:** apihub alert API/UI/lib/tests, prisma optional
**Done when:** Operators can manage alert lifecycle.

## Slice 80 — Alert audit linkage
**Goal:** Link alert actions to run/apply audit trails.
**Paths:** apihub repos/routes/tests/docs
**Done when:** Alert handling is auditable end-to-end.

---

## Slice 81 — Mapping transform auditability
**Goal:** Persist transform version and rule hash with preview/apply operations.
**Paths:** mapping engine/routes/repos/tests
**Done when:** Mapping decisions are reproducible.

## Slice 82 — Template versioning v1
**Goal:** Add explicit versioning for mapping templates.
**Paths:** mapping template API/lib/prisma optional/tests
**Done when:** Template updates preserve historical revisions.

## Slice 83 — Template promotion workflow
**Goal:** Introduce draft/published states for mapping templates.
**Paths:** template routes/UI/lib/tests
**Done when:** Operators can stage template changes safely.

## Slice 84 — Template rollback action
**Goal:** Allow rollback to previous template version.
**Paths:** template API/lib/tests
**Done when:** Misconfigured templates are quickly recoverable.

## Slice 85 — Preview sampling determinism
**Goal:** Ensure preview sampling is deterministic under same inputs.
**Paths:** preview route/lib/tests
**Done when:** Repeated preview runs produce consistent sample outputs.

## Slice 86 — Mapping issue export v2
**Goal:** Expand validation report export with severity/grouping metadata.
**Paths:** mapping export API/UI/tests
**Done when:** Reports are analyst-friendly.

## Slice 87 — Schema drift detector
**Goal:** Detect source schema drift against saved mapping templates.
**Paths:** apihub mapping lib/routes/tests, docs
**Done when:** Drift warnings surface before failed apply.

## Slice 88 — Source profile registry
**Goal:** Add source-profile model for reusable source schema/config signatures.
**Paths:** apihub API/lib/prisma/tests
**Done when:** Multiple mappings can reference common source profiles.

## Slice 89 — Source profile UI
**Goal:** Manage source profiles in API Hub UX.
**Paths:** `src/app/apihub/**`, components
**Done when:** Profiles can be created/edited/reused.

## Slice 90 — Mapping governance docs
**Goal:** Document template lifecycle, promotion, rollback, and drift management.
**Paths:** `docs/apihub/**`
**Done when:** Governance process is clear for operators.

---

## Slice 91 — Permission model hardening
**Goal:** Expand API Hub permission matrix with least-privilege defaults.
**Paths:** docs + apihub auth helpers/routes/tests
**Done when:** Permission boundaries are explicit and enforced.

## Slice 92 — Admin-only maintenance endpoints
**Goal:** Add guarded maintenance endpoints (reindex/recompute summaries).
**Paths:** `src/app/api/apihub/**`, auth helpers/tests
**Done when:** Maintenance actions are safe and audited.

## Slice 93 — Sensitive field redaction contract
**Goal:** Enforce and test redaction for sensitive fields across all responses/logs.
**Paths:** apihub lib/routes/tests
**Done when:** Sensitive data never leaks via API/logging.

## Slice 94 — Abuse and fuzz test suite
**Goal:** Add fuzz/abuse tests for payload caps, invalid enums, malformed refs.
**Paths:** apihub tests/schemas
**Done when:** Guardrails hold under malformed input.

## Slice 95 — Performance smoke suite
**Goal:** Add repeatable performance smoke checks for hot endpoints.
**Paths:** scripts/tests/docs
**Done when:** Regressions in latency/throughput are detectable.

## Slice 96 — Prisma migration hygiene pass
**Goal:** Ensure all API Hub migrations are ordered, documented, and reversible-safe.
**Paths:** `prisma/migrations/**`, docs
**Done when:** Migration chain is clean for production deploys.

## Slice 97 — `verify:apihub:full` gate
**Goal:** Add full verification command for enterprise readiness.
**Paths:** `package.json`, optional test config/docs
**Done when:** One command validates API Hub comprehensively.

## Slice 98 — Release candidate dry-run
**Goal:** Execute API Hub RC checklist and capture findings.
**Paths:** docs + tests/scripts as needed
**Done when:** RC issues are documented with severity.

## Slice 99 — Stabilization fixes only
**Goal:** Resolve RC findings without scope expansion.
**Paths:** API Hub files implicated by RC log
**Done when:** All blocker findings are closed.

## Slice 100 — Enterprise closeout audit
**Goal:** Final enterprise polish audit and handoff package.
**Paths:** API Hub scope + `docs/apihub/**`
**Done when:** API Hub is production-hardened with residual risk log.

---

## Prompt template for the agent

```text
Follow docs/apihub/agent_milestones_one_agent.md. Implement Slice N only.
Respect scope boundaries. If blocked by out-of-scope/shared files, stop and report.
Run relevant validation (prefer npm run verify:apihub when present), commit + push, then stop.
End with: what shipped, risks, and next slice.
```
