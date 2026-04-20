# Integration hub / API hub — agent todo list (greenfield)

**GitHub label:** `module:integration-hub`  
**Live spec + docs:** **[`docs/apihub/README.md`](../../apihub/README.md)** — ingestion / integration API hub; full draft: [`integrations-ai-assisted-ingestion.md`](../../apihub/integrations-ai-assisted-ingestion.md).  
**Gap map:** [`docs/apihub/GAP_MAP.md`](../../apihub/GAP_MAP.md).

**Suggested allowed paths (P0):** `docs/apihub/**`, `docs/engineering/agent-todos/integration-hub.md`, `src/app/apihub/**`, `src/app/api/apihub/**`, optional tiny `src/lib/apihub/**`

---

## Phase 0 — skeleton (safe, no backend contract yet)

- [x] **Product / technical spec** — [`docs/apihub/integrations-ai-assisted-ingestion.md`](../../apihub/integrations-ai-assisted-ingestion.md) (v1 draft; iterate in PRs).
- [ ] **Route shell** — `/apihub` landing + step placeholders — GitHub [#16](https://github.com/lasealco/po-management/issues/16) (meeting batch P0).
- [ ] **Health API** — `GET /api/apihub/health` stub (same issue).
- [ ] **Nav / command palette** — optional single entry (minimal diff; see #16).

---

## Phase 1 — contracts (after P0)

- [ ] **Connector registry** — DB table + CRUD API stub + empty UI list (issue must include Prisma scope).
- [ ] **Health / last sync** — display-only fields on registry rows (mock data ok until integrations exist).
- [ ] **Audit log slice** — who changed connector config (may reuse existing audit patterns).

---

## Hygiene

- [ ] Keep [`docs/apihub/GAP_MAP.md`](../../apihub/GAP_MAP.md) current when merging API hub PRs.
