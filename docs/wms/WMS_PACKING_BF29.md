# BF-29 — Packing scan verify + demo carrier label adapter

**Purpose:** **BF-08** depth — device-shaped **scan confirmation** before pack/ship and a **vendor-neutral carrier label** demo path without hardware certification.

**Authority:** [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md) §BF-29; baseline packing ([`WMS_PACKING_LABELS.md`](./WMS_PACKING_LABELS.md), [`WMS_PACKING_LABELS_BF08.md`](./WMS_PACKING_LABELS_BF08.md)).

---

## What shipped

| Piece | Role |
|-------|------|
| **`pack-scan-verify.ts`** | Normalize scan tokens; multiset match vs **picked** units (pack) or **packed** units (ship); optional **BF-81** RFID/GTIN/SSCC URI expansion before multiset verify — [`WMS_RFID_COMMISSIONING_BF81.md`](./WMS_RFID_COMMISSIONING_BF81.md); `validate_outbound_pack_scan` for UX. |
| **Env guardrails** | `WMS_REQUIRE_PACK_SCAN=1` → `packScanTokens` required on `mark_outbound_packed`; `WMS_REQUIRE_SHIP_SCAN=1` → `shipScanTokens` required on `mark_outbound_shipped`. |
| **`GET /api/wms`** | `packShipScanPolicy` + per-outbound `packScanPlan` (expected codes × qty). |
| **`validate_outbound_pack_scan`** | Non-mutating check; returns `plan`, `missing`, `unexpected`. |
| **`request_demo_carrier_label`** | `DEMO_PARCEL` synthetic tracking + ZPL (extends BF-08 stub). |
| **`carrier-label-demo-adapter.ts`** | Adapter-shaped API for future real carriers. |
| **Operations UI** | Pack / ship scan queues, verify, optional policy hints; **Demo carrier ZPL** download. |

---

## Backlog

USB/BLE scanner drivers, purchasable carrier APIs (FedEx/UPS/DHL), 4×6 PDF, partial-carton SSCC per carton, certify lab.

---

_Last updated: 2026-05-05 — **BF-81** RFID commissioning bridge on multiset expansion._
