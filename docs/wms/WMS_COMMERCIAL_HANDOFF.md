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

1. **Commercial** agrees SKU/qty/pricing in CRM (quote/opportunity) — contracted **`unitPrice`** on lines; optional **`listUnitPrice`** / **`priceTierLabel`** for catalog-vs-contract deltas (**BF-22**, [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md)).
2. **Operations** creates an outbound in WMS (**`create_outbound_order`**) with a **`crmAccountId`** selected from accounts the actor may access (**`org.crm` → view** + CRM scope — see `assertOutboundCrmAccountLinkable`).
3. **Pick → pack → ship** proceeds as in [`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md); CRM link is **locked after pack** (existing product rule).
4. **Billing**: **`syncBillingEventsFromMovements`** resolves **`crmAccountId`** onto movements via outbound/shipment lineage (**`src/lib/wms/billing-crm-resolve.ts`**); invoice runs can aggregate under **`CRM_ACCOUNT`** profile source when events align.

## BF-10 — CRM quote lineage

Optional **`OutboundOrder.sourceCrmQuoteId → CrmQuote`** stores commercial quote attribution alongside **`crmAccountId`** when **`CrmQuote.accountId`** matches the outbound bill-to (**`assertOutboundSourceQuoteAttachable`** in **`src/lib/wms/crm-account-link.ts`**). **`set_outbound_crm_account`** clears **`sourceCrmQuoteId`** when CRM unlinks or when the new bill-to no longer matches the quote’s account. CRM **`CrmQuote`** detail includes **Open WMS outbound handoff** (prefill **`/wms/operations`**); WMS shows quote links on open outbounds.

## BF-14 — CPQ quote lines → outbound lines

CRM **`CrmQuoteLine.inventorySku`** holds the warehouse SKU (**maps to tenant **`Product.sku`**)** maintained from **`/crm/quotes/[id]`**. **`explode_crm_quote_to_outbound`** (**`POST /api/wms`**) previews SKU/qty mapping under the viewer’s **product-division read scope**; with **`quoteExplosionConfirm: true`** it inserts **`OutboundOrderLine`** rows on **quote-linked outbounds that have no lines yet** (DRAFT or RELEASED, not packed/shipped/cancelled). **`create_outbound_order`** accepts **zero lines** when **`sourceCrmQuoteId`** is present so operators can materialize lines after CRM SKU hygiene — **`CtAuditLog`** **`outbound_quote_lines_exploded`**.

## BF-22 — List vs contracted pricing (minimal)

Optional **`CrmQuoteLine.listUnitPrice`** and **`priceTierLabel`** document catalog/list vs **contracted **`unitPrice`**. Resolver **`resolveQuoteLineCommercialPricing`** drives explosion **preview deltas**; confirmed explosions snapshot **`commercial*`** fields on **`OutboundOrderLine`**. See [`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md).

## API surfaces (WMS)

| Mechanism | Role |
|-----------|------|
| **`create_outbound_order`** (`crmAccountId` required today for create flow in product) | Anchors bill-to for downstream billing resolution |
| **`create_outbound_order`** **`sourceCrmQuoteId`** (optional, BF-10) | Stores CRM quote lineage when **`CrmQuote.accountId`** matches **`crmAccountId`** |
| **`create_outbound_order`** empty **`lines`** + **`sourceCrmQuoteId`** (BF-14) | Quote-shell outbound → explode fills SKU rows |
| **`explode_crm_quote_to_outbound`** | BF-14 preview / confirm quote **`OutboundOrderLine`** explosion (`quoteExplosionConfirm`); **BF-22** commercial columns on preview + line snapshots on apply |
| **`set_outbound_crm_account`** | Adjust CRM link before pack where allowed; clears incompatible **`sourceCrmQuoteId`** |
| **`mark_outbound_shipped`** | Emits **`SHIPMENT`** movements that feed billing materialization |

## Deferred (explicit)

| Item | Owner / note |
|------|----------------|
| Quote → outbound **line auto-create from CRM quote lines** | **BF-14 minimal landed** — `inventorySku` on **`CrmQuoteLine`** + **`explode_crm_quote_to_outbound`**; **full CPQ configurator / solver still backlog** |
| Price list / contracted rates on outbound lines | **BF-22 minimal landed** — list unit + tier on quote line, resolver + explosion preview + **`OutboundOrderLine.commercial*`** snapshots ([`WMS_CPQ_CONTRACT_PRICING_BF22.md`](./WMS_CPQ_CONTRACT_PRICING_BF22.md)); external price books / ladder engines backlog |
| Multi-currency quote alignment | Backlog |

## References

- Phase prioritization: [`IMPLEMENTATION_STRATEGY.md`](./IMPLEMENTATION_STRATEGY.md) Phase C
- Billing resolution: `src/lib/wms/billing-crm-resolve.ts`, `src/lib/wms/billing-materialize.ts`
