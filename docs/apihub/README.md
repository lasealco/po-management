# API hub — documentation home

This folder is the **documentation home** for **integration / ingestion APIs and UX**: how external data and files enter the platform, how operators confirm mappings, and how runs are **repeatable** and **auditable**.

**Browse on GitHub (public):** [`lasealco/po-management` → `docs/apihub/`](https://github.com/lasealco/po-management/tree/main/docs/apihub)

## Specs (markdown)

| Document | Purpose |
|----------|---------|
| [integrations-ai-assisted-ingestion.md](./integrations-ai-assisted-ingestion.md) | End-to-end product + technical spec: AI-assisted ingestion, templates, API + file parity, guardrails, phased delivery |
| [RUNBOOK.md](./RUNBOOK.md) | Docs-only execution runbook for API Hub updates, scope boundaries, and PR checklist |

**Gap map (spec ↔ code):** [GAP_MAP.md](./GAP_MAP.md)

## In-app entry (P0+)

- Authenticated demo session: **`/apihub`** — workflow placeholders + **Connectors** registry (Phase 1 stub list with health + last-sync display; see [GAP_MAP](./GAP_MAP.md)).
- **Health stub:** `GET /api/apihub/health` — JSON `{ ok, service, phase }` for discovery and deploy checks (no auth).
- **Connector registry (Phase 2 slice):** `GET` / `POST` **`/api/apihub/connectors`** + `PATCH` **`/api/apihub/connectors/:id`** — demo tenant + active demo actor; supports status updates, optional `lastSyncAt` stamp, and lightweight audit rows (no secrets).

## Related material elsewhere

- **Control Tower** inbound / integration context: `docs/controltower/` (PDF pack + `GAP_MAP.md`).
- **Agent execution list (integration hub slice):** [`../engineering/agent-todos/integration-hub.md`](../engineering/agent-todos/integration-hub.md)

## Naming

- **`docs/apihub/`** = docs and product language for this initiative.
- **Application routes** use `/apihub` for the P0 shell; final product naming is tracked in the spec open decisions. Keep this README, [GAP_MAP](./GAP_MAP.md), and the [phased delivery table](./integrations-ai-assisted-ingestion.md#8-phased-delivery-proposal) aligned when shipping phases.
