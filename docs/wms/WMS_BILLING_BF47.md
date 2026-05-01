# BF-47 — Posted billing disputes & credit memo stubs

**Purpose:** Extend **BF-28** (uninvoiced dispute hold) to **posted** invoice runs: finance-visible dispute status, standardized reason codes, optional **credit memo stub** rows with ERP / AR document placeholders, and outbound webhook hooks for integrations.

**Authority:** [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-47; Phase B billing context [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md); uninvoiced disputes [`WMS_BILLING_BF28.md`](./WMS_BILLING_BF28.md).

---

## What shipped (minimal slice)

| Piece | Role |
|-------|------|
| **`WmsBillingInvoiceStatus.POST_DISPUTED`** | Posted run flagged for finance follow-up (distinct from **DRAFT** / **POSTED**). |
| **`WmsBillingInvoiceRun`** dispute columns | **`postedDisputeOpenedAt`**, **`postedDisputeReasonCode`**, **`postedDisputeNote`**, **`postedDisputeOpenedById`**. |
| **`WmsBillingCreditMemoStub`** | Stub row: **`sourceInvoiceRunId`**, **`creditAmount`**, **`reasonCode`**, optional **`memoNote`**, optional **`externalArDocumentRef`**. |
| **`POST /api/wms/billing`** **`set_invoice_run_posted_dispute`** | **`postedBillingDisputed: true`** — **POSTED** → **POST_DISPUTED** (requires **`postedBillingDisputeReasonCode`**). **`false`** — **POST_DISPUTED** → **POSTED**, clears dispute columns. |
| **`POST /api/wms/billing`** **`create_billing_credit_memo_stub`** | Creates stub when source run is **POST_DISPUTED**; optional **`creditMemoCreditAmount`** defaults to invoice **`totalAmount`**. |
| **`GET /api/wms/billing`** | **`postedDisputedInvoiceRunCount`**; invoice runs include dispute fields + recent **`creditMemoStubs`** (read surface). |
| **Billing workspace UI** | Posted dispute flow + credit memo stub form; badges / row tint for **POST_DISPUTED**. |
| **Outbound webhooks (BF-44)** | **`BILLING_INVOICE_POST_DISPUTED`**, **`BILLING_CREDIT_MEMO_STUB_CREATED`** — Setup checkboxes on **`/wms`**. |
| **Finance cash controls assistant** | **`POST_DISPUTED`** treated like **POSTED** for “pending unposted billing” exposure (no double-count as draft). |

### Reason codes

Shared allowlist (dispute + stub): **`RATE_DISPUTE`**, **`QUANTITY_DISPUTE`**, **`SERVICE_LEVEL`**, **`DUPLICATE_CHARGE`**, **`OTHER`** — see **`src/lib/wms/billing-bf47.ts`**.

---

## Backlog

Full AR subledger, automated tax reversal, credit memo approval workflow, deleting or voiding posted runs, multi-stub reconciliation UI.

---

_Last updated: 2026-04-30 — BF-47 minimal slice shipped._
