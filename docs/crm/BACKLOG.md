# CRM — deferred / later work

Parking lot so we can ship vertical slices without losing track of the full PRD (`docs/crm/*.pdf`).

## Integrations (extra infra / contracts)

- **Microsoft 365 / Outlook** — OAuth app registration, token storage, calendar two-way sync, `external_calendar_id` on activities, conflict handling.
- **Control tower / execution** — shipment snapshots, milestones, revenue/cost sync; mapping tables and freshness SLAs.
- **ERP / accounting** — invoices, payments, DSO; read-only snapshots + webhook or polling.

## CRM product depth (from PRD, not yet in app)

- **Lead conversion wizard** — duplicate detection, link to existing account/contact, carry notes/activities (basic convert exists; extend).
- **Account 360** — full tabbed shell (shipments/finance placeholders until integrations).
- **Opportunity** — kanban, stage-gate required fields, forecast categories, drag-drop with validation.
- **Quotes** — versions, lines, margin, approval routing.
- **Field-level & export permissions** — matrix in PDF; start with record-level only.
- **Workflow automation & alerts** — stale deals, shipment drop, overdue (engine + notification channel).
- **Reporting / marts** — star schema or materialized views for exec dashboards.
- **Account plans** — strategic workspace, quarterly reviews.

## Engineering hygiene

- **E2E tests** for convert + contacts + account detail.
- **Prisma migrate on Mac** — P1001 on engine; pg fallback is OK until root cause found.

When picking up an item, move it to a short-lived tech note or PR description and link back here.
