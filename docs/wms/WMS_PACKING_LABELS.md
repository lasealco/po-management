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

Optional **BF-08** adds downloadable **ZPL** and a **demo SSCC** line when `NEXT_PUBLIC_WMS_SSCC_COMPANY_PREFIX` is configured — see [`WMS_PACKING_LABELS_BF08.md`](./WMS_PACKING_LABELS_BF08.md).

## Label artifacts

| Artifact | MVP |
|----------|-----|
| **Pack slip** | **Browser print** from Operations (**Print pack slip**) — HTML summary with ship-to, ASN, requested ship, line pick/pack quantities, optional SSCC demo line (BF-08) — see `src/lib/wms/pack-slip-print.ts`. |
| **Ship-station ZPL (BF-08)** | **Download ZPL stub** next to pack slip — minimal thermal commands + Code 128 block; send `.zpl` to printer queue or middleware (`src/lib/wms/ship-station-zpl.ts`). |
| **Carrier / ERP labels** | GS1 logistics beyond demo SSCC + ZPL stub — integrate external label service or ERP when product requires. |

## Audit

Successful **`mark_outbound_packed`** and **`mark_outbound_shipped`** append **`CtAuditLog`** rows (`entityType: OUTBOUND_ORDER`) for traceability.

## Deferred / backlog

- Partial pack per carton with distinct SSCC (beyond BF-08 demo unit-level SSCC)
- Reprint / pack station hardware profiles
- Inline capture of weights/dims at pack time
