# CRM — agent todo list

**GitHub label:** `module:crm`  
**Typical allowed paths:** `src/app/crm/**`, `src/app/api/crm/**`, `src/lib/crm/**`, CRM-related components under `src/components/**` only if clearly CRM-scoped  
**Avoid:** Control Tower, WMS, tariff verticals unless the issue explicitly names a cross-module touch.

**Source of truth:** `docs/crm/BACKLOG.md` + PDFs in `docs/crm/`.

---

## Suggested sequence (from BACKLOG — one issue per row or smaller)

- [ ] **Opportunities** — filters + table polish; stage-gate fields when you define which fields are required per stage.
- [ ] **Quotes MVP** — data model + UI shell + API stub (per PRD slice you choose).
- [ ] **Account workspace “360”** — tabbed shell with **placeholder** panels (shipments/finance) until integrations exist.
- [ ] **Lead conversion wizard** — extend basic convert: duplicate detection, link existing account/contact, carry notes/activities.
- [ ] **Opportunity kanban** — drag-drop with validation + forecast categories (after rules are written in an issue).
- [ ] **Activities / notifications** — in-app notifications first (email later).
- [ ] **Workflow automation** — stale deals, shipment drop, overdue (engine + in-app channel first).

---

## Integrations (later / own issues — usually `needs-alex`)

- [ ] **Integration portal** — connectors, tokens, health UI + API boundaries.
- [ ] **Microsoft 365 / Outlook** — OAuth, token storage, calendar sync (heavy; separate epic).
- [ ] **Control Tower / execution** — snapshots, milestones, revenue/cost sync (cross-module; own issues).
- [ ] **ERP / accounting** — read-only snapshots + webhook/polling.

---

## Engineering

- [ ] **E2E / integration tests** — convert flow, contacts, account detail (define runner in issue).
- [ ] **Reporting / marts** — defer until product picks first dashboard.
