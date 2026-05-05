# BF-85 — Bulk RMA disposition rules

**Objective:** Tenants define ordered rules that map **text patterns** on customer-return shipments (**BF-41**) to **`ShipmentItem.wmsReturnDisposition`** (and optionally attach a **BF-42** receiving disposition template per matched line).

## Data model

- **`WmsRmaDispositionRuleBf85`** (`tenantId`, `priority`, `matchField`, `matchMode`, `pattern`, `applyDisposition`, optional `receivingDispositionTemplateId`, optional `note`).
- **`priority`:** lower numbers run first; ties broken by rule `id`.
- **`matchField`:** `ORDER_LINE_DESCRIPTION` (PO line `description`), `PRODUCT_SKU`, `PRODUCT_CODE` (`Product.productCode`), `SHIPMENT_RMA_REFERENCE` (`Shipment.wmsRmaReference`).
- **`matchMode`:** `EXACT`, `PREFIX`, `CONTAINS` — comparison is **case-insensitive** after trim.

## API (`POST /api/wms`)

| Action | Tier | Purpose |
|--------|------|---------|
| `upsert_wms_rma_disposition_rule_bf85` | setup | Create (omit `wmsRmaDispositionRuleIdBf85`) or patch rule |
| `delete_wms_rma_disposition_rule_bf85` | setup | Delete rule (`wmsRmaDispositionRuleIdBf85`) |
| `apply_rma_disposition_rules_bf85` | operations | `shipmentId`, optional `wmsRmaDispositionRulesOverwriteBf85` |

**Apply:** Requires **`CUSTOMER_RETURN`** inbound subtype. For each line, the first matching rule wins. When `wmsRmaDispositionRulesOverwriteBf85` is false (default), lines that already have **`wmsReturnDisposition`** set are skipped. When a matching rule has **`receivingDispositionTemplateId`**, that FK is written on the line; if the rule has no template, existing line template is left unchanged.

Audit: shipment-level **`rma_disposition_rules_applied_bf85`** with counts and matched rule ids; rule CRUD uses entity type **`WMS_RMA_DISPOSITION_RULE_BF85`**.

## Read model

**`GET /api/wms`** includes **`rmaDispositionRulesBf85`** (sorted by priority, id).

## UI

- **Setup:** rules table + create/edit form (after BF-42 templates).
- **Operations:** apply panel under inbound intro (shipment id + overwrite + primary action).

## Out of scope

Refund orchestration and ERP RMA workflow — disposition + optional QA template only.

See **BF-41** — [`WMS_RETURNS_BF41.md`](./WMS_RETURNS_BF41.md).
