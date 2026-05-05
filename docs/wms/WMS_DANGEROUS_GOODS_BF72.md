# BF-72 — Dangerous goods checklist + DG manifest JSON

**Scope:** Operator **checklist attestation** on **`OutboundOrder`** when any line SKU has **`Product.isDangerousGoods`**, plus a **`bf72.v1`** manifest JSON alongside **BF-68** customs handoff. Uses existing **`Product`** dangerous goods columns (`unNumber`, `dangerousGoodsClass`, `packingGroup`, `properShippingName`, `msdsUrl`, …).

## Schema

- **`OutboundOrder.wmsDangerousGoodsChecklistJson`** — nullable JSON document **`wms.dg_checklist_state.bf72.v1`** with `completedAt`, `actorUserId`, and checklist rows `{ code, label, ok }` matching server template.

## API (`POST /api/wms`)

| Action | Tier | Purpose |
|--------|------|--------|
| `validate_outbound_dangerous_goods_bf72` | operations | Returns `checklistRequired`, `checklistComplete`, `warnings`, parsed checklist |
| `submit_outbound_dangerous_goods_checklist_bf72` | operations | Body **`dangerousGoodsChecklistItems`**: map of checklist codes → `true` (all required **must** be true). Blocks SHIPPED/CANCELLED |
| `clear_outbound_dangerous_goods_checklist_bf72` | operations | Clears checklist JSON (not SHIPPED/CANCELLED) |

**Audit:** `CtAuditLog` **`bf72_outbound_dangerous_goods_checklist_submitted`** / **`bf72_outbound_dangerous_goods_checklist_cleared`** on **`OUTBOUND_ORDER`**.

## `GET /api/wms/dangerous-goods-manifest`

- Query **`outboundOrderId`**, optional **`pretty=1`**
- Auth: **`org.wms` → view** + **`loadWmsViewReadScope`**
- **400** unless outbound **PACKED** or **SHIPPED**

Attachment **`{outboundNo}-dangerous-goods-manifest-bf72.json`** (`schemaVersion: bf72.v1`).

## Ship gate

**`WMS_ENFORCE_DG_CHECKLIST_BF72=1`** — when any line product **`isDangerousGoods`**, **`mark_outbound_shipped`** requires a valid checklist snapshot (`checklistStateSatisfiesTemplate`).

## Dashboard payload

**`GET /api/wms`** outbound rows expose DG checklist hints:

- **`dangerousGoodsChecklistRequired`**, **`dangerousGoodsChecklistComplete`**, **`dangerousGoodsChecklist`** (parsed snapshot or `null`).
- **`product`** refs include DG columns (`isDangerousGoods`, `unNumber`, …).

## Out of scope

IMDG-certified placarding / labeling automation; carrier DG APIs.

_Last updated: 2026-04-29._
