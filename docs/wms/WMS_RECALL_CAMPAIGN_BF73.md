# BF-73 — Recall campaign workflow stub

**Scope:** Named **recall campaigns** with persisted scope (**warehouse ids × product ids**, optional **lot** filter) that **materialize** once into the same **`InventoryBalance`** freeze patch as **`apply_inventory_freeze`** (**BF-58**). **`CLOSED`** is administrative only—releases still use **`release_inventory_freeze`** per balance.

## Schema

- **`WmsRecallCampaign`** — `campaignCode` (unique per tenant), `title`, optional `note`, `status` (`DRAFT` → `MATERIALIZED` → `CLOSED`), **`scopeJson`** (`bf73.v1`), `holdReasonCode` / `holdReleaseGrant`, optional `materializedAt` / `frozenBalanceCount`, **`createdById`**.

## Scope JSON (`bf73.v1`)

```json
{
  "schemaVersion": "bf73.v1",
  "warehouseIds": ["…"],
  "productIds": ["…"],
  "lotCodes": ["…"]
}
```

`lotCodes` omitted or empty → all lot buckets in each warehouse × product cell match **`apply_inventory_freeze`** bulk semantics.

## API (`POST /api/wms`)

| Action | Tier | Purpose |
|--------|------|--------|
| `create_recall_campaign_bf73` | inventory | Body: **`recallCampaignCode`**, **`recallCampaignTitle`**, optional **`recallCampaignNote`**, **`recallScopeWarehouseIds`**, **`recallScopeProductIds`**, optional **`recallScopeLotCodes`**, optional **`recallHoldReasonCode`** (defaults `RECALL`), optional **`recallHoldReleaseGrant`**. Validates FKs to **`Warehouse`** / **`Product`**. |
| `materialize_recall_campaign_bf73` | inventory | **`recallCampaignId`** — **`DRAFT` only**; runs scoped **`updateMany`** freeze patch; sets **`MATERIALIZED`** + counts. |
| `close_recall_campaign_bf73` | inventory | **`recallCampaignId`** — sets **`CLOSED`** (not already closed). |

**Audit:** **`CtAuditLog`** on entity **`WMS_RECALL_CAMPAIGN`** — **`bf73_recall_campaign_created`**, **`bf73_recall_campaign_materialized`**, **`bf73_recall_campaign_closed`**.

## Dashboard payload

**`GET /api/wms`** includes **`recallCampaigns`** (recent rows + scope JSON + status metadata).

## Stock UI

WMS client **Stock** section — create draft, list rows, **Materialize** / **Close** (requires **`org.wms.inventory` → edit** path).

## Out of scope

FDA/regulatory filing portals; automated release when closing a campaign.
