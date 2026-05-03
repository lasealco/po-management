# BF-68 — Customs filing export JSON handoff

**Scope:** Minimal **AES / customs filing–style** JSON built from **`OutboundOrder`** ship/pack quantities, **tenant exporter** address, **warehouse** origin site, **ship-to** / optional **CRM bill-to**, and **`Product.hsCode`** + dangerous-goods hints + optional **`OutboundOrderLine.commercial*`** snapshots (**BF-22**). Intended for **broker middleware**, not direct agency submission.

## API

### `GET /api/wms/customs-filing-export`

- Query: **`outboundOrderId`** (required), optional **`pretty=1`**.
- Auth: **`org.wms` → view**; **`loadWmsViewReadScope`** on outbound.
- **400** unless status is **`PACKED`** or **`SHIPPED`**; **400** if no lines.
- Response: attachment **`{outboundNo}-customs-filing-bf68.json`**, schema **`bf68.v1`**, profile **`CUSTOMS_FILING_HANDOFF_STUB_V1`**.
- **`totals.sumCommercialExtendedAmount`**: set only when **every** line has **`commercialExtendedAmount`** (otherwise `null` so brokers do not rely on a partial sum).
- Quantity basis matches **BF-40** DESADV: **`PACKED`** vs **`SHIPPED`** qty per line depending on outbound status.

## Implementation

- Builder: `buildCustomsFilingExportV1` in [`src/lib/wms/customs-filing-bf68.ts`](../../src/lib/wms/customs-filing-bf68.ts).
- Vitest: [`src/lib/wms/customs-filing-bf68.test.ts`](../../src/lib/wms/customs-filing-bf68.test.ts).

## Out of scope

- Government message signing, AES/EEI **ITN**, PGA connectors, customs broker APIs, currency conversion beyond stored line snapshots.
