# Integration hub — agent todo list (greenfield)

**GitHub label:** `module:integration-hub` (create label when first issue ships, or reuse `module:system` until then)  
**Status:** Module **not started** — there is no `docs/integration-hub/` pack in-repo yet. Treat this file as **first slices** until a spec lands.

**Suggested allowed paths (v0):** `src/app/integration/**` (new segment), `src/lib/integration/**`, `src/app/api/integration/**` — adjust when product picks names.

---

## Phase 0 — skeleton (safe, no backend contract yet)

- [ ] **Product one-pager** — what “hub” connects (CT, CRM, WMS, tariff, external webhooks); link from issue or add `docs/integration-hub/README.md`.
- [ ] **Route shell** — read-only page: title, steps 1–3 placeholder, links to existing module hubs (no new secrets).
- [ ] **Nav / command palette** — single entry behind entitlement flag (reuse pattern from other modules; coordinate in issue if touching `app-nav`).

---

## Phase 1 — contracts (after one-pager)

- [ ] **Connector registry** — DB table + CRUD API stub + empty UI list (issue must include Prisma scope).
- [ ] **Health / last sync** — display-only fields on registry rows (mock data ok until integrations exist).
- [ ] **Audit log slice** — who changed connector config (may reuse existing audit patterns).

---

## Hygiene

- [ ] When PDF/spec exists, add `docs/integration-hub/GAP_MAP.md` and trim this file so checkboxes map 1:1 to spec sections.
