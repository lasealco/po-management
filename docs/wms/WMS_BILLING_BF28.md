# BF-28 — Billing event disputes (invoice hold)

**Purpose:** Minimal **Phase B+** billing depth — flag **`WmsBillingEvent`** rows as disputed so they stay out of new draft invoice runs until cleared.

**Authority:** [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-28; commercial context [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md).

---

## What shipped

| Piece | Role |
|-------|------|
| **Schema** | **`billingDisputed`** (default false), optional **`billingDisputeNote`** (`VarChar(800)`); composite index on **`tenantId` / `invoiceRunId` / `billingDisputed`**. |
| **`invoiceEligibleBillingEventsWhere`** | Shared filter: unbilled + non-disputed + period (`src/lib/wms/billing-invoice-eligibility.ts`). |
| **`createInvoiceRunFromUnbilledEvents`** | Selects only non-disputed open events; clearer error when none are billable. |
| **`GET /api/wms/billing`** | **`unbilledEventCount`** = eligible only; **`disputedUnbilledEventCount`**; event rows expose dispute fields. |
| **`POST /api/wms/billing`** **`set_billing_event_dispute`** | Toggle dispute on **uninvoiced** events in read scope (`billingEventId`, `billingDisputed`, optional `billingDisputeNote`). |
| **WMS billing UI** | Dispute / clear dispute on uninvoiced rows; held badge + note; summary counts. |
| **Home KPIs + cockpit** | Uninvoiced aggregates exclude disputed rows. |

---

## Backlog

Accrual placeholders, posted-run reversal workflows, approval gates, accounting export beyond CSV, full AR subledger, tax engine.

---

_Last updated: 2026-04-29 — BF-28 minimal billing dispute hold._
