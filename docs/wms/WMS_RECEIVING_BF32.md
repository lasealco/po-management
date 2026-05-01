# BF-32 — Receiving accrual & finance staging hooks

**Purpose:** Stage **receiving economics** for accounting (**GRNI-style** visibility) without ERP GL posting — complements Phase B **`WmsBillingEvent`** materialization from movements.

**Minimal slice shipped (repo):**

- **`WmsReceivingAccrualStaging`** — one immutable row per **`close_wms_receipt`** (same transaction as receipt close); **`crmAccountId`** copied from **`Shipment.customerCrmAccountId`** when set; **`snapshotJson`** version **1** line economics (shipped/received qty, variance disposition, product refs, PO #, GRN, currency).
- **`GET /api/wms/receiving-accrual-staging`** — JSON list + **`?format=csv`** flattened export; **`since` / `until`** ISO filters on **`createdAt`**; read scope via **`loadWmsViewReadScope`** (`shipment` visibility), max **500** rows per request.
- **Billing workspace** — **`/wms/billing`**: preview table + primary **Download staging CSV** link (`src/components/wms-billing-client.tsx`).

**Out of scope:** Tax engine, FX hedge, automatic GL posts, standard cost valuation engine, reversing entries.

**Depends on:** **BF-21** idempotent dock receipt close; **BF-31** GRN on close (snapshot includes **`grnReference`**).

See program catalog: [`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md) §BF-32.

_Last updated: 2026-05-08 — BF-32 minimal slice shipped._