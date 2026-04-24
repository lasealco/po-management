# WMS — receiving state machine (Phase 2.3)

**Status:** Published spec (implementation backlog). **Does not** change runtime behavior by itself.  
**Last updated:** 2026-04-23

**Parent plan:** [CONTROL_TOWER_WMS_PHASED_ROADMAP.md](../engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md) Phase **2.3** · [GAP_MAP.md](./GAP_MAP.md) optional increments.

---

## 1. Why this document exists

The roadmap and GAP call for **deeper receiving states** (Phase **2.3**) as an optional increment **after a short spec**. This file is that spec: it anchors vocabulary, data-model options, and a phased path so a future issue/PR can implement without inventing the machine on the spot.

**Non-goals here:** EDI, carrier appointment systems, or full WMS v2 receiving — those stay in deferred epics (dock appointments, etc.) in `GAP_MAP` R3.

---

## 2. Current behavior in this repo (baseline)

| Area | How receiving works today |
|------|----------------------------|
| **Shipment (tenant PO / ocean)** | `Shipment.asnReference`, `expectedReceiveAt` via `set_shipment_inbound_fields` (`src/lib/wms/post-actions.ts`). Inbound list + edit UI in `Wms` payload (`inboundShipments` in `get-wms-payload.ts` / `wms-client.tsx`). |
| **Physical receipt to stock** | **Putaway** `WmsTask` (`taskType: PUTAWAY`) created from `create_putaway_task`, completed with `complete_putaway_task` — materializes `InventoryMovement` and updates `InventoryBalance` (`src/lib/wms/post-actions.ts`). |
| **Task model** | `WmsTaskType` = `PUTAWAY` \| `PICK` \| `REPLENISH` \| `CYCLE_COUNT` only — there is **no** dedicated `RECEIVE` task type yet (`prisma/schema.prisma`). |
| **Shipment lifecycle** | `Shipment.status` includes `RECEIVED` and milestones via `record_shipment_milestone` in Control Tower; WMS reuses the same `Shipment` where linked. |

So “receiving” is currently **a bridge**: ASN/ETA fields on the order-of-record + **putaway** as the warehouse execution primitive. There is **no** first-class **dock → check-in → variances** state beyond what operators infer from open putaway, milestones, and `receivedAt`.

---

## 3. Product intent (what “deeper states” should mean)

Operators need a **finite, explorable** receiving pipeline per inbound shipment (or per ASN line) that answers:

- Is this shipment **expected** at the dock, **in progress**, **fully received** (or **discrepant**), before putaway and inventory posting?
- Who advanced the state, and when (audit for exceptions / billing)?

This is **orthogonal** to putaway: you can receive **into a staging / receiving zone** and only later **put away** to pick faces — the gap is **visibility and gates**, not necessarily new inventory math.

---

## 4. Proposed logical states (v1)

These are **logical** names for product and API design. Exact enum values can be `SCREAMING_SNAKE` in code.

| State | Meaning |
|--------|---------|
| `NOT_TRACKED` | No receiving workflow; legacy or out-of-WMS. |
| `EXPECTED` | ASN / ETA set; goods not yet checked in. |
| `AT_DOCK` / `CHECK_IN_STARTED` | Trailer/pallet present; count may be partial. |
| `RECEIVING` | Count/scan in progress; may allow partials. |
| `RECEIPT_COMPLETE` | All declared lines match tolerances; ready for (or in) putaway. |
| `DISCREPANCY` | Over/short/damage; exception owner resolves before closing. |
| `CLOSED` | Receiving case closed (ties to shipment received + putaway done or policy override). |

**Transitions** should be **explicit** (no silent jumps): each move is either a `POST` action or a system rule (e.g. “all putaway tasks DONE → `CLOSED` if policy allows”).

---

## 5. Data-model options (pick in an implementation issue)

**Option A — Ship on `Shipment` (or a thin 1:1 `WmsInboundReceipt`)**  
Add `wmsReceiveStatus` (enum) + optional `wmsReceiveNote`, `wmsReceiveUpdatedAt`, `wmsReceiveUpdatedById`. **Pros:** one row per order-of-record; **cons:** conflates PO-shipment with multi-step dock handling if the same row serves multiple consignments.

**Option B — `WmsReceipt` / line table**  
Header per dock event + line-level received qty vs expected. **Pros:** clean variance; **cons:** more schema, migration, and UI.

**Option C — Milestone-only (lighter)**  
Encode states as `CtTrackingMilestone` / shipment milestones with fixed codes. **Pros:** no new WMS table; **cons:** weak typing and harder to query in WMS home.

A future issue should **choose A, B, or C** and reference this doc.

---

## 6. API & UI (future PRs)

- **Read path:** `GET /api/wms` (or shipment slice) should expose status + “next allowed actions” for `org.wms` editors.
- **Write path:** one `POST` action per transition (e.g. `set_wms_receiving_status` with `{ shipmentId, toStatus, note? }`) with tenant + warehouse scoping, mirroring `set_shipment_inbound_fields`.
- **Audit:** `Wms` or `Shipment`-scoped audit line per transition (pattern already used elsewhere).

---

## 7. Relation to other GAP items

- **2.4 (dashboard / packing):** the `/wms` “At a glance” panel (`WmsHomeOverview`) already surfaces task/outbound/cycle health; deepening KPIs is **separate** from 2.3 and can ship without this state machine.
- **Deferred ❌ (appointments, VAS, commercial quotes):** do **not** block 2.3; do not conflate with receiving states.

---

## 8. Exit criteria (Phase 2.3 in the phased roadmap)

- [x] **This spec** published under `docs/wms/` and linked from [GAP_MAP.md](./GAP_MAP.md).
- [ ] **Implementation** issue filed with: chosen option (A/B/C), first transition slice, and allowed paths.
- [ ] **Engineering** merge: at least read-only status in API/UI **or** explicit defer with product sign-off.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-23 | Initial spec for Phase 2.3; baseline inventory from current WMS/Prisma. |
