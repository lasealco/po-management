# BF-22 — CPQ contracted pricing on outbound (minimal)

**Purpose:** Capture **list vs contracted** unit economics on CRM quote lines and surface them when **`explode_crm_quote_to_outbound`** previews/applies, with **durable snapshots** on **`OutboundOrderLine`** for Operations / billing handoff — without a full CPQ configurator.

## Landed slice

| Area | Behavior |
|------|-----------|
| **CRM quote lines** | Optional **`listUnitPrice`** (positive catalog/list unit) and **`priceTierLabel`** (≤64 chars). **`unitPrice`** remains the **contracted** line unit; **`extendedAmount`** / quote **`subtotal`** stay **qty × contracted unit** only. |
| **Resolver** | **`resolveQuoteLineCommercialPricing`** (`src/lib/wms/cpq-contract-pricing.ts`) derives extended contracted/list amounts and **Δ/unit** when list is set. |
| **Explosion preview** | Each preview row includes **`contractUnitPrice`**, optional list + delta + extended pair, **`priceTierLabel`**. |
| **Outbound lines** | On confirm, **`commercialUnitPrice`**, **`commercialListUnitPrice`**, **`commercialPriceTierLabel`**, **`commercialExtendedAmount`** populated from the resolver at explosion time (legacy lines remain **null**). |
| **Audit** | **`outbound_quote_lines_exploded`** payload includes **`commercialSnapshots: true`**. |

## API / UI

- **CRM:** `POST/PATCH /api/crm/quotes/[id]/lines` accept **`listUnitPrice`** / **`priceTierLabel`** (see handlers).
- **WMS:** `GET /api/wms` outbound **`lines`** expose commercial snapshot strings; Operations quote-explosion table shows **Commercial (BF-22)** column.

## Explicit backlog

- Tier matrices / volume ladders / solver-driven CPQ.
- Subscription / ramp pricing.
- Automatic sync from external price books.

## References

- [`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md)
- [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-22
