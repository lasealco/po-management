# AI-assisted uploads — catalog, logistics docs, and tariffs (customer playbook)

**Status:** Product + engineering alignment. **Companion to:** [integrations-ai-assisted-ingestion.md](./integrations-ai-assisted-ingestion.md). **Tariff implementation slice:** `docs/engineering/agent-todos/tariff.md` (code paths and verify commands).

---

## 1. Why this doc exists

Customers routinely upload **products**, **inventory**, **ASNs**, **ocean contracts**, **trucking tariffs**, **air rates**, **LCL tariffs**, and similar artifacts. This document explains **how AI fits** without pretending the model “knows” ocean FCL pricing: **AI proposes structure**; **your product encodes domain rules**, **staging**, and **promotion** into authoritative data.

---

## 2. What AI does vs what the product owns

| Role | AI (LLM + layout/table helpers) | Platform (deterministic) |
|------|----------------------------------|---------------------------|
| **Perception** | Detect tables, headers, blocks of text; classify document *layout family* (rate card vs amendment vs email quote). | File storage, virus scan, size limits, tenant scope. |
| **Extraction** | Propose **structured rows** (JSON) with fields you define: POL/POD, box size, basis, amount, currency, validity, surcharge label, notes. | Schema validation, charge-code mapping, geography resolution, rounding, min/max, currency rules. |
| **Domain language** | Use **glossary + few-shot examples** in context (gate-in all-in, CY/CY, BAF/PSS, etc.) — not silent invention. | Canonical **glossary** in app; **unknown** surcharge → operator mapping or reject. |
| **Quality** | Confidence, citations (page/table region), “needs review” flags. | **Staging**, diff, audit trail, idempotent **promote** to contracts / catalog / WMS. |

**Principle (same as the hub spec):** *AI proposes → operator confirms → deterministic runtime.*

---

## 3. Typical customer upload types

| Upload | AI assist | After extraction |
|--------|-----------|------------------|
| **Products** | Column/header inference, unit/SKU cleanup hints, mapping proposal to catalog fields. | Master data rules, dedupe, approval, golden SKU logic. |
| **Inventory** | Normalize locations/units; flag obvious anomalies. | WMS truth, reservations, ledger rules. |
| **ASN** | Line hierarchy, refs/dates; match hints to PO/SO lines. | Receiving workflow, discrepancy handling. |
| **Ocean contracts / FCL** | Table boundaries, rate scales, surcharge lines, validity windows, “all-in” vs itemized **as text**; propose **candidate** rate rows. | Contract versioning, geography groups, charge catalog, **pricing / snapshot** engine. |
| **Trucking / air / LCL** | Same pattern: layout family + row candidates + notes. | Mode-specific rating, accessorials, breakpoints. |

---

## 4. “Training” the model on ocean FCL (practical meaning)

Customers care that the system understands **surcharges**, **all-in** wording (**gate-in / gate-out**, **full door**, etc.). In production you rarely rely on **fine-tuning alone**:

1. **Structured outputs** — Responses must match your **JSON schema** (rate line, surcharge line, validity, basis, optional `confidence` / `rawLabel`).
2. **RAG / short context packs** — Per tenant or per carrier: glossary snippets + 1–3 **redacted** exemplar tables showing *your* expected shape.
3. **Few-shot by layout family** — Prompt variants for “Maersk-style scale”, “CH Robinson-style appendix”, etc., not one prompt for all PDFs.
4. **Human-in-the-loop** — Staging grid corrections feed **mappings** (e.g. free-text “FUEL ADJ” → charge code `BAF`) and future prompt/example updates.
5. **Evaluation** — Golden files per layout family; track extraction F1 and **downstream** promotion success, not just BLEU on text.

Domain truth (what “all-in” *means* for pricing) lives in **policy + engine**, not in model weights.

---

## 5. Ocean / multimodal tariff flow (target architecture)

1. **Ingest** — Upload or API; store blob + metadata; **redact** secrets before any model call.
2. **Classify** — Document type + layout family (rules + optional LLM).
3. **Extract** — LLM or specialized table model → **candidate rows** + provenance.
4. **Normalize** — Map labels to **charge codes**; resolve geography; validate currency/unit/basis.
5. **Stage** — Same conceptual **staging** as API Hub (tariff import staging today; future parity with mapping analysis jobs).
6. **Review** — Operator diff, fix rows, approve.
7. **Promote** — Idempotent promote into **contract version** / draft rates (see tariff import promote pipeline in code).
8. **Price / audit** — Frozen snapshots and invoice audit stay **deterministic** off promoted data.

Cross-link: **API Hub** mapping analysis and staging apply patterns ([README route index](./README.md)) are the **generic** pattern; **tariff** vertical uses `src/lib/tariff/**` import/staging/promote for rate-specific tables.

---

## 6. Guardrails (tariff-specific)

- **No fabricated rates** — Missing amount/currency/basis → explicit null + reason; never invent competitive numbers.
- **Inclusive / exclusive** — Extract **verbatim** notes; pricing engine applies **your** rules for whether a line is all-in or additive.
- **Validity overlap** — Flag overlaps; resolution is policy (manual or automated).
- **Audit** — Model id, input hash, template/job id, promoter user id on staged and promoted rows.

---

## 7. What we tell customers (one paragraph)

AI **speeds up** turning carrier and forwarder documents into **reviewable, structured candidates**. Your definitions of **all-in**, **surcharges**, and **rating logic** stay in the platform. Reliability comes from **staging, promotion, and versioning**—not from the model memorizing FCL.

---

## 8. Cross-links

- [integrations-ai-assisted-ingestion.md](./integrations-ai-assisted-ingestion.md) — principles, phases, guardrails.
- [README.md](./README.md) — API Hub routes (mapping jobs, staging batches, apply).
- `docs/engineering/agent-todos/tariff.md` — tariff engine scope and verify commands.
- `docs/controltower/` — Control Tower context where ingestion touches milestones / shipments.
