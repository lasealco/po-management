# CRM — deferred / later work

Parking lot so we can ship vertical slices without losing track of the full PRD (`docs/crm/*.pdf`).

## Suggested build sequence (Outlook / M365 last)

1. CRM entity depth: opportunities table + filters (done incrementally), quotes MVP, richer lead convert.
2. Account workspace: tabbed “360” with **placeholder** panels until integrations exist.
3. Automation & notifications (in-app first, email later).
4. **Integration portal** (connectors, tokens, health) — then **Outlook** as one connector.

## In the app today (not “all” PDF pages — core R1 + multi-page shell)

- CRM sub-nav: Overview, Leads, Accounts, Contacts, Opportunities, Pipeline, Activities.
- List hubs + detail: lead (`/crm/leads/[id]`), account, opportunity (`/crm/opportunities/[id]`), tenant-scoped contacts list; opportunities **table** at `/crm/opportunities`.
- APIs: `GET`/`PATCH` lead, opportunity, activity by id; `GET` contacts without `accountId` (scoped via account ownership).
- Pipeline board (read-only columns by stage); activities hub with create + status updates.

Everything below remains **out of scope** until picked up intentionally.

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
