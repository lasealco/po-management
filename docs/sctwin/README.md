# AI-Driven Supply Chain Twin — Developer Documentation Pack

This pack is the developer-ready documentation set for building the **AI-Driven Supply Chain Twin** module.

**Terms:** [Twin glossary](./glossary.md) (entity snapshot, edge, ingest event, scenario draft, risk signal, readiness).
**Ops:** [Twin runbook](./runbook.md) (canonical command map, route map, troubleshooting matrix, seed flow, logging pointers).
**Smoke pack:** `npm run smoke:sctwin:e2e` (sequential readiness -> explorer -> scenarios -> risks -> exports checks with JSON summary).
**Governance:** [Twin governance runbook](./governance_runbook.md) (escalation path, approval levels, rollback guidance for maintenance actions).
**Large fixture validation:** [Twin large fixture checklist](./large_fixture_validation_checklist.md) (expected minimum counts, smoke endpoints, troubleshooting).
**Permissions:** [Twin permission and visibility matrix](./supply_chain_twin_permissions_and_visibility.md) (route/action mapping for view/edit/export/admin semantics).
**Performance:** runbook section "Performance Notes (Query Plan + Index Intent)" (index-to-query mapping + revisit triggers).
**Release checklist:** [Twin release checklist](./release_checklist.md) (migrations, verify gates, smoke URLs, rollback hints).
**Program closeout + handoff:** [Twin program closeout and handoff](./program_closeout_and_handoff.md) (Slices 1–240 anchor doc + checklist).
**RC dry run log:** [Twin RC dry run 2026-04-21](./release_candidate_dry_run_2026-04-21.md) (findings list with severity and follow-ups).
**Final risk register:** [Twin final risk register](./final_risk_register.md) (accepted vs deferred residual risks with owner/next action).
**Release gate:** run `npm run verify:sctwin:full` before handoff/release.
**API contracts:** [Twin API contract snapshot](./api_contract_snapshot.md) (live endpoint request/response shapes and stable errors).
**API contract freeze:** [Twin API contract v1 reference](./api-contract-v1.md) (frozen milestone contract reference).
**Contract baseline:** [Twin contract snapshot baseline](./contract_snapshot_baseline.md) (version-controlled v1 endpoint payload baselines + review flow).

## Module Positioning
The Supply Chain Twin is a cross-module intelligence layer that sits above:
- PO Management
- Sales Orders
- WMS
- Control Tower
- CRM
- SRM
- Tariff / RFQ / Invoice Audit

It is **not** a separate transactional system. It is the live digital model of supply, demand, inventory, transport, cost, and risk — with AI services on top.

## Recommended Build Order
1. Twin object model and graph relationships
2. Event / ingestion layer
3. Current-state and expected-state engine
4. Risk and KPI calculations
5. AI assistant / query layer
6. Prediction services
7. Recommendation engine
8. Scenario engine
9. Action / task orchestration
