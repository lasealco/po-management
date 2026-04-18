# Cursor SRM Prompt Sequence

## First upload
- SRM markdown sidecar pack
- optionally the SRM PDF pack for reference

## Prompt 1 — session rules
Use the tariff-style session pattern but adapt the branch/module name for SRM.

## Prompt 2 — inspect repo
Ask Cursor to inspect the repo and propose a Phase 1 plan for SRM only:
- module location
- migration tooling
- auth/permission reuse
- UI reuse
- what to build first

## Prompt 3 — schema
Build schema and migrations for:
- suppliers
- supplier_entities
- supplier_contacts
- supplier_categories/capabilities
- qualification_records
- document_records
- compliance_checks
- contract_summary
- performance_snapshots
- risk_assessments
- review_meetings
- action_plan_items
- audit_logs

## Prompt 4 — repositories/services
Build backend/domain services for the core SRM entities.

## Prompt 5 — directory and supplier 360
Build:
- supplier directory
- supplier 360
- tabs for profile, contacts, capabilities, compliance, performance, risk, relationship, documents, audit

## Prompt 6 — onboarding workflow
Build:
- supplier application intake
- onboarding checklist
- approval workflow
- document request center

## Prompt 7 — compliance/document control
Build:
- expiring-doc views
- upload/review/approval flows
- missing-doc requests
- suspension hooks

## Prompt 8 — performance/risk
Build:
- scorecards
- risk views
- review workspace
- action plans

## Prompt 9 — integration scaffolding
Build payloads and sync scaffolding for:
- control tower
- ERP/finance
- tender/tariff modules later
