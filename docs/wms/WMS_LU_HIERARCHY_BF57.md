# Nested LU hierarchy & SSCC validation — BF-57 (minimal)

**Purpose:** **Stricter GS1 SSCC-18 check-digit validation** and **acyclic parent/child closure** on **BF-43** **`WmsOutboundLogisticsUnit`** rows before ship, plus an explicit **read-only validate** API for Operations.

**Authority:** [`BF51_BF70_MEGA_PHASES.md`](./BF51_BF70_MEGA_PHASES.md) §BF-57; base model [`WMS_LOGISTICS_UNITS_BF43.md`](./WMS_LOGISTICS_UNITS_BF43.md).

---

## What shipped

| Piece | Details |
|-------|---------|
| **Pure validation** | `validateOutboundLuHierarchy` in **`src/lib/wms/outbound-lu-hierarchy.ts`** — parent refs exist on the outbound, **no cycles** when walking `parentUnitId`, **SSCC-18 Mod-10** on scan codes that match **`/^\d{18}$/`** (opaque LPN tokens unchanged). **Warnings** when a line-bound unit lacks a positive **`containedQty`**. |
| **POST** | **`validate_outbound_lu_hierarchy`** — `outboundOrderId`; returns **`{ ok, errors, warnings, ssccFailures, unitCount }`** (HTTP **200** so clients can show detail). |
| **Ship gate** | When **`WMS_ENFORCE_SSCC=1`**, **`mark_outbound_shipped`** runs the same validation on all LUs for the order (**400** if any errors). No-op when the order has **zero** LUs. |
| **UI** | **`/wms` operations** — **Validate LU hierarchy (BF-57)** under the BF-43 panel. |

## Out of scope

Full **EPCIS** repository, GS1 Digital Link resolver, mixed-SKU carton contents beyond BF-43 multiset rules.

---

_Last updated: 2026-04-29 — BF-57 minimal slice._
