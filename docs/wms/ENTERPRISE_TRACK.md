# WMS Enterprise Track — capsule index

**Purpose:** Single place to **prompt work by capsule** (`WE-01` … `WE-12`) toward an **enterprise finish line** vs [`GAP_MAP.md`](./GAP_MAP.md) and blueprint deferrals. This track is **independent** of Assistant global **Sprint 1–25** numbering; you may surface progress as **Enterprise WMS · E1–E12** in UI later.

**Sources of truth**

| Doc | Role |
|-----|------|
| [`GAP_MAP.md`](./GAP_MAP.md) | Blueprint ↔ repo rows (✅ 🟡 ❌) |
| [`IMPLEMENTATION_STRATEGY.md`](./IMPLEMENTATION_STRATEGY.md) | Phases A/B/C (ops → billing → commercial) |
| [`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md) | CT+WMS phased program + Phase 2 handoff |
| [`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md) | Receiving state machine (WE-01) |

**How to prompt**

> **“Execute capsule WE-0N from `docs/wms/ENTERPRISE_TRACK.md`. Update `GAP_MAP.md` when behavior changes; keep migrations + tests with the capsule scope.”**

Parallel agents: **non-overlapping paths only** (see [`agent-todos/README.md`](../engineering/agent-todos/README.md)).

**Rough scale:** Estimates are **two-week sprints**, **one primary capsule thread** unless you explicitly parallelize. Total serial span **~18–24 sprints** if all capsules run at full depth; **±4 sprints** if scope is cut (see notes per capsule).

---

## Capsule summary

| ID | Name | Est. sprints | Depends on |
|----|------|--------------|--------------|
| **WE-01** | Receiving state machine | 2–3 | Spec published; choose model option |
| **WE-02** | Dock & appointments | 2–3 | WE-01 recommended first |
| **WE-03** | Allocation v2 (multi-strategy) | 3–4 | Inventory/task model stability |
| **WE-04** | VAS / work orders | 4–6 | WE-03 partial if shared task engine |
| **WE-05** | Lot / serialization / constraints | 2–4 | Product scope: WMS-native vs catalog |
| **WE-06** | Packing / labels / ship-station | 2 | Outbound flow maturity |
| **WE-07** | Commercial handoff (quotes → billing) | 3–5 | CRM/commercial Phase C readiness |
| **WE-08** | Field-level WMS RBAC + audit | 2 | Grants model in `icp-and-tenancy` |
| **WE-09** | Executive / KPI dashboard depth | 2 | [`WMS_EXECUTIVE_KPIS.md`](./WMS_EXECUTIVE_KPIS.md) |
| **WE-10** | Zone/site topology (beyond flat zone+bin) | 2–3 | [`WMS_ZONE_TOPOLOGY_ADR.md`](./WMS_ZONE_TOPOLOGY_ADR.md) |
| **WE-11** | Map 3.4 — floor / globe / deep links | 2–3 | [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md); CT Phase 3 — [`CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md`](../engineering/CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md) |
| **WE-12** | Hardening + enterprise exit sign-off | 2 | Prior capsules merged |

**UI label alias:** **E1** = WE-01 … **E12** = WE-12 (optional Assistant sub-program copy).

---

## WE-01 — Receiving state machine

**Goal:** First-class receiving visibility and gates before/at putaway (orthogonal to inventory posting).

**Exit criteria**

- [x] Choose **Option A / B / C** from [`WMS_RECEIVING_STATE_MACHINE_SPEC.md`](./WMS_RECEIVING_STATE_MACHINE_SPEC.md) in an implementation note or ADR.
- [x] `GET /api/wms` (or shipment slice) exposes status + **next allowed actions** for editors.
- [x] Explicit `POST` transition(s) with tenant + warehouse scope + audit line per transition.
- [x] `GAP_MAP.md` updated: Phase **2.3** row reflects **✅** or **🟡** with honest limits.

**References:** Roadmap Phase 2.3, [`CONTROL_TOWER_WMS_BACKLOG_5_PHASES.md`](../engineering/CONTROL_TOWER_WMS_BACKLOG_5_PHASES.md) Phase 4 · [`WMS_RECEIVING_OPTION_A.md`](./WMS_RECEIVING_OPTION_A.md).

---

## WE-02 — Dock & appointments

**Goal:** Blueprint row **appointment scheduling** moves off ❌ to shipped minimal scheduling (dock/window conflicts, tenant-scoped).

**Exit criteria**

- [x] Schema/API for appointments aligned to blueprint slice you approve (not full TMS).
- [x] UI entry points from WMS inbound/outbound as scoped.
- [x] `GAP_MAP.md` R2 **Appointment scheduling** updated.

**References:** [`WMS_DOCK_APPOINTMENTS.md`](./WMS_DOCK_APPOINTMENTS.md).

## WE-03 — Allocation v2

**Goal:** Beyond current **line `allocatedQty` + pick tasks** — documented allocation strategies/rules (`GAP_MAP` 🟡 enterprise depth).

**Exit criteria**

- [x] Allocation rules engine or staged profiles **documented + tested**.
- [x] No silent stock moves — human-approved or policy-gated where required.
- [x] `GAP_MAP.md` **Allocation** row upgraded from 🟡 with stated limits.

**References:** [`WMS_ALLOCATION_STRATEGIES.md`](./WMS_ALLOCATION_STRATEGIES.md).

---

## WE-04 — VAS / work orders

**Goal:** Blueprint **VAS / work orders** ❌ → MVP service/work-order path tied to warehouse tasks and costing hooks.

**Exit criteria**

- [x] Work order / VAS entities or task extensions **scoped in ADR**.
- [x] Create/complete path + audit; billing linkage if Phase B events apply.
- [x] `GAP_MAP.md` R3 **VAS / work orders** no longer ❌ for chosen MVP depth.

---

## WE-05 — Lot / serialization / constraints

**Goal:** Address **lot master** / serialization gaps vs blueprint — **either** WMS-native tables **or** explicit **reuse Product + constraints** with signed product decision.

**Exit criteria**

- [x] Decision recorded (native vs reuse).
- [x] Implemented slice + tests + GAP row update.

---

## WE-06 — Packing / labels / ship-station

**Goal:** Deepen **packing / labels** 🟡 — workflow, scan gates, label artifacts as product requires.

**Exit criteria**

- [x] Documented pack/label flow + API/UI alignment.
- [x] `GAP_MAP.md` R2 packing row tightened.

---

## WE-07 — Commercial handoff (quotes → outbound billing)

**Goal:** **Commercial / quotes** Phase C alignment — document **`crmAccountId`** bill-to bridge + Phase B billing vs deferred automated quote→outbound ([`WMS_COMMERCIAL_HANDOFF.md`](./WMS_COMMERCIAL_HANDOFF.md)).

**Exit criteria**

- [x] Contract with CRM/commercial module for quote→order→billing handoff (minimal path).
- [x] `GAP_MAP.md` R3 **Commercial / quotes** reflects shipped slice or explicit deferral with owner.

---

## WE-08 — Field-level WMS RBAC + audit

**Goal:** Move from **🟡 org.wms + user on movements** toward **field-level matrix** where blueprint requires — or document enterprise alternative.

**Exit criteria**

- [x] RBAC model + enforcement points listed; critical paths tested.
- [x] Audit parity for sensitive actions.
- [x] `GAP_MAP.md` **Permissions / audit** row updated.

---

## WE-09 — Executive / KPI dashboard depth

**Goal:** `/wms` **At a glance** and leadership KPIs vs blueprint — not just triage tiles.

**Exit criteria**

- [x] KPI set agreed + implemented or exported.
- [x] `GAP_MAP.md` **Dashboards** row updated.

---

## WE-10 — Zone/site topology

**Goal:** Beyond **flat zone+bin** — hierarchy or network semantics per blueprint slice (rack addressing exists partially on bins; extend as scoped).

**Exit criteria**

- [x] ADR for topology scope; migrations if needed.
- [x] `GAP_MAP.md` R1 zone row reflects outcome.

---

## WE-11 — Map 3.4 (floor / globe / layers)

**Goal:** [`CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md`](../engineering/CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md) **3.4** — WMS floor / globe / CRM layers **as funded**.

**Exit criteria**

- [x] Shipped slice OR explicit **won’t do** with doc link.
- [x] Cross-links from CT map where dual-grant users apply.

---

## WE-12 — Hardening + enterprise exit

**Goal:** Performance, demo parity, integration/regression gates, **GAP_MAP enterprise review** — sign-off that deferrals are intentional.

**Exit criteria**

- [ ] Checklist: build, critical paths, seed/demo notes.
- [ ] `GAP_MAP.md` changelog line + **Enterprise track closed** or **next wave** pointer.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-29 | **WE-11:** CT map Phase 3.4 scope captured in [`WMS_CT_MAP_PHASE34_WE11.md`](./WMS_CT_MAP_PHASE34_WE11.md); dual-grant cross-links verified; in-map WMS/CRM layers deferred. |
| 2026-04-29 | Initial capsule index for enterprise WMS finish-line prompting (`WE-01`–`WE-12`). |
