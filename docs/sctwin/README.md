# AI-Driven Supply Chain Twin — Developer Documentation Pack

This pack is the developer-ready documentation set for building the **AI-Driven Supply Chain Twin** module.

**Terms:** [Twin glossary](./glossary.md) (entity snapshot, edge, ingest event, scenario draft, risk signal, readiness).
**Ops:** [Twin runbook](./runbook.md) (verify commands, troubleshooting matrix, seed flow, key routes, logging pointers).
**Smoke pack:** `npm run smoke:sctwin:e2e` (sequential readiness -> explorer -> scenarios -> risks -> exports checks with JSON summary).
**Governance:** [Twin governance runbook](./governance_runbook.md) (escalation path, approval levels, rollback guidance for maintenance actions).
**Large fixture validation:** [Twin large fixture checklist](./large_fixture_validation_checklist.md) (expected minimum counts, smoke endpoints, troubleshooting).
**Permissions:** [Twin permission and visibility matrix](./supply_chain_twin_permissions_and_visibility.md) (route/action mapping for view/edit/export/admin semantics).
**Performance:** runbook section "Performance Notes (Query Plan + Index Intent)" (index-to-query mapping + revisit triggers).
**Release checklist:** [Twin release checklist](./release_checklist.md) (migrations, verify gates, smoke URLs, rollback hints).
**Release gate:** run `npm run verify:sctwin:full` before handoff for the slices 88-107 tranche.
**API contracts:** [Twin API contract snapshot](./api_contract_snapshot.md) (request/response shapes and stable errors for slices 68-97).
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
