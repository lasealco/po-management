# AI-assisted ingestion — integration / API hub spec (v1 draft)

**Status:** Draft for engineering + product alignment. **Source docs home:** [`README.md`](./README.md). **Docs on GitHub (public tree):** [`docs/apihub/`](https://github.com/lasealco/po-management/tree/main/docs/apihub).

---

## 1. Purpose

Build a **single hub** for **ingesting** operational data (API payloads and/or files/XML) such that:

- **Operators** stay in control: AI **proposes** mappings and transforms; humans **confirm** before anything becomes authoritative runtime data.
- **Runtime** execution is **deterministic**: saved, versioned **templates** + validated rules drive imports — not ad-hoc model text.
- **Same engine** for **file upload** and **server-to-server API** ingestion (shared validation, idempotency, audit).

---

## 2. Principles

1. **AI proposes → user confirms → deterministic runtime**  
   LLM (or similar) may suggest field mappings, normalizations, and exception lists. **No silent commit** to production tables without explicit user confirmation and (where required) a second validation step.

2. **No secrets through the model**  
   API keys, webhook secrets, and raw credentials never enter the LLM context. Connectors store secrets in existing secret patterns (env / vault / encrypted columns — TBD per deployment).

3. **Tenant isolation**  
   All batches, staging rows, templates, and jobs are **`tenantId`**-scoped. Cross-tenant leakage is a hard **non-goal**.

4. **Auditability**  
   Every **template version**, **run**, **mapping change**, and **AI job** writes structured audit events (who, when, correlation id).

5. **Idempotency**  
   API ingestion accepts client **`Idempotency-Key`** (or body field) per batch; replays return the same outcome without double-applying side effects.

---

## 3. Scenarios

### Scenario A — PO / SO → booking → Control Tower enrichment

Internal documents already exist (purchase order, sales order). Flow: **intent** (“push booking / milestones”) → optional extra docs → mapping against known schema → validate → preview in **real UI** (e.g. Shipment 360 / booking panels) → save template → repeat runs via API or upload.

### Scenario B — External file / XML → shipment first (4PL-style)

Carrier / forwarder sends **XML or flat file** first. Flow: **intent** (“create or update shipment from file”) → upload → AI-assisted column/XML path mapping → validate → preview shipment + milestones → save template → scheduled or on-demand **API + file** runs.

**Same engine** for both; difference is **entry template**, **target entity**, and **default preview surface**.

### Scenario C — Catalog, ASN, and tariff / contract documents

**Products, inventory, ASN**, and **rate documents** (ocean FCL, trucking, air, LCL) share the same **propose → stage → confirm → promote** pattern; tariff rows additionally pass through **charge-code normalization** and the **pricing / contract** vertical. See **[ai-upload-playbook-catalog-tariffs.md](./ai-upload-playbook-catalog-tariffs.md)** for how AI assists (layout, extraction, glossary-backed language) vs how the platform owns rating semantics (all-in, surcharges, validity).

---

## 4. End-to-end UX (high level)

1. **Intent** — user picks scenario + target (e.g. “new shipments from ACME XML”).
2. **Uploads + optional docs** — file(s), sample API JSON, optional reference PDF (stored; **not** used as secret channel).
3. **AI analysis job** — async job produces **structured** mapping proposal (see guardrails).
4. **Mapping editor** — grid: source path / column → canonical field; transforms; required vs optional; sample values.
5. **Validate + real UI preview** — dry-run against staging; open **actual app pages** (read-only or flagged “preview”) where possible.
6. **Save versioned template** — semver or monotonic version; changelog note; who published.
7. **Run** — trigger via **upload** or **API** using saved template + idempotency key.

---

## 5. Documents in XML

- Support **embedded Base64** payloads vs **external references** (URI / attachment id) — product decision per connector.
- **Storage:** blobs in existing object storage pattern (e.g. Vercel Blob) where applicable; DB stores metadata + pointers.
- **Redaction:** strip or reject nodes that look like credentials before model call.

---

## 6. Sketch data model (implementation-agnostic)

| Concept | Role |
|---------|------|
| **Connector** | Who sends data (carrier, customer system, internal); auth binding; allowed directions. |
| **Template** | Mapping + transforms + target scenario; **versioned**. |
| **Batch** | One run (file or API payload); status; correlation id. |
| **Staging** | Normalized rows pre-commit; keyed for preview + diff. |
| **Provenance** | Link staging → template version → AI job id → user ids. |

**Implementation:** Prisma models include `ApiHubConnector`, `ApiHubMappingTemplate`, `ApiHubIngestionRun`, `ApiHubMappingAnalysisJob`, `ApiHubStagingBatch`, `ApiHubStagingRow`, and related audit tables — see migrations under `prisma/migrations/` and [`GAP_MAP.md`](./GAP_MAP.md).

---

## 7. AI guardrails

- **Structured output only** for mapping proposals (JSON schema / tool output); reject free-form where machine-parseable is required.
- **No fabricated values** — if unknown, emit explicit **`null`** / **`unknown`** with reason; never invent order numbers, dates, or IDs.
- **PII** — minimize fields sent to model; configurable redaction list per tenant (future).
- **Audit** — prompt hash, model id, input document checksums (not raw secrets), output checksum.

---

## 8. Phased delivery (proposal)

| Phase | Scope (summary) |
|-------|------------------|
| **P0** | Docs home (`docs/apihub/`), **GAP_MAP**, read-only **app shell** ([`/apihub`](https://github.com/lasealco/po-management/tree/main/src/app/apihub)), [`GET /api/apihub/health`](https://github.com/lasealco/po-management/tree/main/src/app/api/apihub/health), cross-links from integration-hub todos; no Prisma migrations unless explicitly approved. |
| **P1** | Prisma models for connector + template + batch + staging (minimal); CRUD API stubs; empty list UIs. |
| **P2** | Async “analysis job” pipeline + mapping editor UI + staging preview. |
| **P3** | Deterministic apply to production paths (per scenario); idempotent API; wire to CT/PO/SO as agreed. |
| **P4** | Hardening: conflict policy, match keys, naming, SLAs, operator training mode. |

**Implementation note (2026-04):** The repository ships deterministic mapping plus optional **OpenAI** structured proposals on analysis jobs, **persisted staging batches**, staging **apply** (sales order / purchase order / Control Tower audit) and **discard**, **`org.apihub`** RBAC, and **create mapping template from succeeded analysis job**. For **what exists in code today**, prefer [`README.md`](./README.md) and [`GAP_MAP.md`](./GAP_MAP.md).

---

## 9. Open decisions (need product / Alex)

- **Match keys** — natural keys for upsert (e.g. shipment id vs house B/L vs customer ref).
- **Conflict policy** — last-write-wins vs manual merge when staging disagrees with live row.
- **Public name** — “API hub”, “Integration hub”, “Ingestion” — align nav + URLs.

**Shipped (no longer open):** **`org.apihub`** **view** / **edit** gates `/apihub` and `/api/apihub/*` except `GET /health`; staging apply also requires **`org.orders`** or **`org.controltower`** **edit** per target. See [permissions-matrix.md](./permissions-matrix.md).

---

## 10. Cross-links

- Control Tower inbound: `docs/controltower/GAP_MAP.md` (R4).
- Engineering agent list: `docs/engineering/agent-todos/integration-hub.md`.
- **Catalog / tariff uploads (AI role vs deterministic pricing):** [ai-upload-playbook-catalog-tariffs.md](./ai-upload-playbook-catalog-tariffs.md).
- **P0 implementation pointers:** app shell `src/app/apihub/`, health route `src/app/api/apihub/health/route.ts`, shared constants `src/lib/apihub/`.
- **Definition of done / limits / ops:** [product-completion-v1.md](./product-completion-v1.md).
