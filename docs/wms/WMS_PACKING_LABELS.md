# WMS packing, labels & ship station

## Purpose

Align blueprint **packing / labels** expectations with what the repo ships today: **pick confirmation → pack gate → ship**, with optional **printed pack-slip evidence** and **audit** on pack/ship transitions.

## Flow (API-aligned)

| Step | Operator intent | `POST /api/wms` action | Preconditions |
|------|----------------|------------------------|----------------|
| 1 Pick | Confirm inventory allocated/picked onto the order | _(implicit via picks / waves)_ — line `pickedQty` increases | Order **RELEASED** / **PICKING** |
| 2 Pack | Freeze packed quantities for carrier handoff | `mark_outbound_packed` | All lines `pickedQty ≥ quantity`; status **RELEASED** or **PICKING**. Sets line `packedQty := pickedQty`, order **PACKED**. CRM link locked after pack (existing rule). |
| 3 Ship | Post shipment movements | `mark_outbound_shipped` | Status **PACKED**; lines fully packed. Posts **`SHIPMENT`** movements and sets **SHIPPED**. |

Related: **`set_outbound_order_asn_fields`**, **`set_outbound_crm_account`** (before pack where applicable).

## Scan gates

There is **no hardware scanner integration** in this slice. The **gate** is procedural: **`mark_outbound_packed`** rejects unless **every line is fully picked**, which matches a “don’t pack until picks are complete” rule.

## Label artifacts

| Artifact | MVP |
|----------|-----|
| **Pack slip** | **Browser print** from Operations (**Print pack slip**) — HTML summary with ship-to, ASN, requested ship, and line pick/pack quantities (see `src/lib/wms/pack-slip-print.ts`). |
| **GS1 / carrier labels / ZPL** | Not generated in-app — integrate external label service or ERP when product requires. |

## Audit

Successful **`mark_outbound_packed`** and **`mark_outbound_shipped`** append **`CtAuditLog`** rows (`entityType: OUTBOUND_ORDER`) for traceability.

## Deferred / backlog

- Partial pack per carton with SSCC
- Reprint / pack station hardware profiles
- Inline capture of weights/dims at pack time
