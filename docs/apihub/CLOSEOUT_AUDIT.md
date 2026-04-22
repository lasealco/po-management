# API Hub — closeout audit (Slice 60)

**Purpose:** Single handoff artifact for the **integration / ingestion hub** slice as shipped on `main`: what exists, how to verify it, and what risks remain for the next owner or enterprise tranche (milestones 61+).

**Audience:** Engineering leads, on-call, and agents picking up **Slice 61+** without re-deriving scope from git history.

---

## 1) Scope inventory (canonical paths)

| Layer | Paths |
|-------|--------|
| HTTP API | `src/app/api/apihub/**` |
| Domain / shared logic | `src/lib/apihub/**` |
| Operator UI | `src/app/apihub/**` (RSC + client panels; demo session gate) |
| Persistence | `prisma/schema.prisma` — `ApiHubConnector`, `ApiHubConnectorAuditLog`, `ApiHubIngestionRun`, `ApiHubIngestionRunAuditLog`, `ApiHubIngestionApplyIdempotency`, `ApiHubMappingTemplate`, `ApiHubMappingTemplateAuditLog` |
| Migrations | `prisma/migrations/*apihub*` and related hot-path index migration (`20260430103000_apihub_hot_path_indexes`) |
| Contracts & ops docs | `docs/apihub/README.md`, `GAP_MAP.md`, `apply-operator-runbook.md`, `permissions-matrix.md`, `RUNBOOK.md`, `RELEASE_CHECKLIST.md` |

Out of **this** module’s contract: Control Tower, PO/SO/WMS, tariff engine, CRM — except where apply/mapping explicitly documents future downstream wiring.

---

## 2) Shipped capabilities (summary)

- **Discovery:** `GET /api/apihub/health` — no auth; stable JSON envelope.
- **Connectors:** registry CRUD-lite (`GET`/`POST`/`PATCH`), audit timeline, per-connector health probe, readiness summary on DTOs, `authConfigRef` validation, disable guardrails with in-flight ingestion.
- **Ingestion runs:** list (keyset cursor + filters), detail + observability, timeline, retry (idempotency + budget), ops summary, alerts summary, apply-conflicts list.
- **Mapping:** engine + preview + CSV/JSON export, templates CRUD + audit, rule diff API.
- **Apply:** live + dry-run, idempotency cache, target/write summaries, rollback **stub**, structured audit rows on apply/retry.
- **Quality gates:** `npm run verify:apihub`, `npm run smoke:apihub` (see [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)).

Authoritative route table: **[README.md](./README.md)**.

---

## 3) Verification (repeatable)

```bash
npm run verify:apihub
```

With a running app:

```bash
npm run smoke:apihub
# or
APIHUB_SMOKE_BASE_URL="https://<host>" npm run smoke:apihub
```

Pre/post release steps: **[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)**.

---

## 4) Residual risk log

These are **accepted** gaps for the current phase unless an issue explicitly rescopes them. Track mitigation in new milestones (61+) or product issues.

| ID | Risk | Severity | Mitigation / next step |
|----|------|----------|-------------------------|
| R1 | **Demo-session gate**, not full RBAC: most API Hub routes require demo tenant + demo actor, not org-scoped grants. | Medium (prod misuse if routes exposed without edge auth) | **Slice 52–53** route/UI permission parity; edge middleware / session policy per environment. |
| R2 | **No background workers** for ingestion: runs are registry + API transitions; no queue consumer ships in this slice. | Medium (operational — “runs” do not imply ETL) | Document in runbooks; add workers in P2+ per spec. |
| R3 | **Apply → downstream systems** is scenario-specific / partially stubbed (rollback stub, CT/PO wiring not universal). | Medium | Extend apply adapters per scenario; expand operator runbook when wiring changes. |
| R4 | **AI-assisted mapping job** (async LLM) not implemented — mapping is deterministic + human-driven. | Low for current MVP | Spec in `integrations-ai-assisted-ingestion.md`; track as P2+. |
| R5 | **Batch / staging Prisma tables** not present — rules live on templates + request payloads. | Low | `GAP_MAP.md` row; add tables when batch UX ships. |
| R6 | **Tenant isolation** not exhaustively proven by automated tests across every repo method. | Medium | **Slice 61** — atomic mapping `updateMany`/`deleteMany` + `*.tenant-scope.test.ts` guards; extend as new repos ship. |
| R7 | **Secrets / PII in logs and error payloads** not covered by a dedicated leakage test pack in-repo. | Medium | **Slice 54** — leakage audit + tests. |
| R8 | **Abuse limits** (payload size, row caps beyond per-route validation) not centralized. | Low | **Slice 55** — request budget helpers. |
| R9 | **Contract drift** — major APIs lack a single generated-schema gate in CI. | Low | **Slice 56** — conformance suite. |

---

## 5) Handoff checklist (sign-off)

Use this for a formal “module ready for adjacent teams” sign-off:

- [x] `README.md` **Route index** matches `src/app/api/apihub/**` `route.ts` files on `main` (20 handlers; audited 2026-04-22).
- [x] `GAP_MAP.md` legend reflects shipped vs stub for connectors, mapping, apply, alerts, conflicts.
- [x] `permissions-matrix.md` matches demo-tenant / demo-actor guards on routes (health public; all other handlers use tenant + actor).
- [x] `npm run verify:apihub` runs in GitHub Actions CI after the main test suite (`.github/workflows/ci.yml`).
- [ ] `npm run smoke:apihub` passes against staging (or prod smoke window) — **operator / env**; see [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).
- [ ] Residual table above reviewed with PM / security; owners assigned for R1–R9 or explicitly deferred.

---

## 6) Suggested next milestones (from plan)

| Slice | Theme |
|-------|--------|
| 61 | Multi-tenant isolation hardening |
| 62 | Actor attribution parity |
| 63 | Audit schema normalization |
| 64 | API versioning envelope |

Full list: `docs/apihub/agent_milestones_one_agent.md` (enterprise tranche 61–100).

---

**Last updated:** 2026-04-22 (Slice 60 — doc/CI closeout for Phase 1 module MVP)
