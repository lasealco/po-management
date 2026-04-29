# WMS commercial handoff — quote → outbound → billing

## Purpose

Define the **cross-module contract** for capsule **WE-07**: how commercial CRM objects relate to **WMS outbound execution** and **Phase B billing**, without implementing a full quote-to-order engine inside WMS.

## Ownership

| Concern | Owning surface (this repo) |
|---------|----------------------------|
| Quotes, opportunities, commercial workflow | **CRM** app routes under **`/crm/**`** (`CrmQuote`, `CrmOpportunity`, …) |
| Warehouse fulfillment | **`OutboundOrder`** / **`OutboundOrderLine`** under **`/api/wms`** |
| Bill-to identity for 3PL billing | **`OutboundOrder.crmAccountId` → `CrmAccount`** (tenant-scoped) |
| Billing events & invoice runs | **`wmsBillingEvents`** + **`/wms/billing`** (Phase B) |

## Minimal path (today)

1. **Commercial** agrees SKU/qty/pricing in CRM (quote/opportunity) — outside WMS.
2. **Operations** creates an outbound in WMS (**`create_outbound_order`**) with a **`crmAccountId`** selected from accounts the actor may access (**`org.crm` → view** + CRM scope — see `assertOutboundCrmAccountLinkable`).
3. **Pick → pack → ship** proceeds as in [`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md); CRM link is **locked after pack** (existing product rule).
4. **Billing**: **`syncBillingEventsFromMovements`** resolves **`crmAccountId`** onto movements via outbound/shipment lineage (**`src/lib/wms/billing-crm-resolve.ts`**); invoice runs can aggregate under **`CRM_ACCOUNT`** profile source when events align.

There is **no automated `CrmQuote.id → OutboundOrder` FK** in the WMS slice shipped with WE-07. Adding **`sourceCrmQuoteId`** (or similar) on **`OutboundOrder`** would be a **follow-on migration** owned with CRM/commercial UX — call it explicitly in planning.

## API surfaces (WMS)

| Mechanism | Role |
|-----------|------|
| **`create_outbound_order`** (`crmAccountId` required today for create flow in product) | Anchors bill-to for downstream billing resolution |
| **`set_outbound_crm_account`** | Adjust CRM link before pack where allowed |
| **`mark_outbound_shipped`** | Emits **`SHIPMENT`** movements that feed billing materialization |

## Deferred (explicit)

| Item | Owner / note |
|------|----------------|
| Quote → outbound **auto-create** | CRM + optional schema FK — not part of WE-07 |
| Price list / contracted rates on outbound lines | Commercial pricing module — billing rates today are movement-type based |
| Multi-currency quote alignment | Backlog |

## References

- Phase prioritization: [`IMPLEMENTATION_STRATEGY.md`](./IMPLEMENTATION_STRATEGY.md) Phase C
- Billing resolution: `src/lib/wms/billing-crm-resolve.ts`, `src/lib/wms/billing-materialize.ts`
