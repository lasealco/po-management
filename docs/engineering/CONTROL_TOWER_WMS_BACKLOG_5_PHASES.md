# Control Tower + WMS — post-tranche backlog (5 phases)

**Status:** Portfolio rollup only. **Does not** replace [`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](./CONTROL_TOWER_WMS_PHASED_ROADMAP.md) Phases 0–3, [`docs/controltower/GAP_MAP.md`](../controltower/GAP_MAP.md), or [`docs/wms/GAP_MAP.md`](../wms/GAP_MAP.md). Use this for steering; use GAP + **one GitHub issue per PR** for execution.

**Last updated:** 2026-04-26

---

## How this maps from the 10-bucket view

| Five phases (here) | Ten themes (condensed) |
|--------------------|-------------------------|
| **1. Assist** | Trusted tool execution, retrieval quality (re-rank, chunking), chatbot / sessions / PDF-scale parity ([#6](https://github.com/lasealco/po-management/issues/6), GAP R3, near-term #4) |
| **2. Reporting & analytics** | Reporting templates / KPI / assets (#5), report engine rootCause / NC / trends (#7) |
| **3. Workbench & inbound** | Workbench next bulk + defaults (#6), next carrier mappers & `payloadFormat` (R4, post–1E) |
| **4. WMS evolution** | Receiving state machine (2.3) after spec, optional ops polish (packing, dashboard KPI) |
| **5. Map & WMS long-tail** | Operations map 3.4 (floor, globe, CRM layers), WMS deferred ❌ (appointments, VAS, commercial quotes) — split when funded |

**Out of scope here** (same as the phased roadmap): Twin, SRM, tariff, margin analytics, telematics, full enterprise RBAC — see [`CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](./CONTROL_TOWER_WMS_PHASED_ROADMAP.md) intro.

---

## Phase 1 — Assist program

**Intent:** One vertical per merge; no monolithic “chatbot v2.”

| Includes | Pointers |
|----------|----------|
| Audited, allowlisted tool path + operator confirm | GAP near-term #4, suggested PR *Assist: audited tool calls…* |
| Retrieval: re-rank, chunking, optional corpus | After embeddings; GAP R3 |
| Longer arc: multi-turn sessions, guardrails, PDF-scale parity | [issue #6](https://github.com/lasealco/po-management/issues/6) |

**Exit (steering):** each scheduled slice is a **closed issue** with a merge; GAP #4 / R3 checklist updated. **2026-04-23:** first allowlisted **`POST /api/control-tower/assist/execute-post-action`** (two actions, confirm gate, audit) + Search — not full PDF / sessions.

---

## Phase 2 — Reporting & analytics

| Includes | Pointers |
|----------|----------|
| Richer tabular / KPI PDF story, tenant logo path | GAP near-term #5 |
| `rootCause` / NC-style measures, exception trend templates | GAP near-term #7 (report-engine) |

**Exit:** product picks **one** of #5 depth vs #7 depth per quarter if capacity is tight.

---

## Phase 3 — Workbench & inbound

| Includes | Pointers |
|----------|----------|
| Bulk **exception** owner **or** server-stored default column visibility | GAP near-term #6 |
| Next **real** inbound partner: `payloadFormat` / mappers in `inbound-carrier-mappers` pattern | GAP R4, post–`sea_port_track_v1` |

**Exit:** workbench and webhook paths stay **tenant-scoped**; new formats get tests + audit pattern like existing inbound.

---

## Phase 4 — WMS evolution

| Includes | Pointers |
|----------|----------|
| **2.3** Receiving — state machine: **spec issue first** | Roadmap Phase 2, [`wms/GAP_MAP`](../wms/GAP_MAP.md) |
| Optional: packing/labels, dashboard “at a glance” | Roadmap 2.4, [`agent-todos/wms.md`](./agent-todos/wms.md) |

**Exit:** 2.3 either **in progress with published spec** or **explicitly deferred** with a one-line GAP reason.

---

## Phase 5 — Map depth & WMS long-tail

| Includes | Pointers |
|----------|----------|
| **3.4** WMS floor / world map (globe) / CRM map layers (if product wants adoption-based depth) | [`CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md`](./CONTROL_TOWER_OPERATIONS_MAP_PHASE3.md) |
| WMS **❌** epics: dock appointments, VAS / work orders, commercial quotes | [`wms/GAP_MAP`](../wms/GAP_MAP.md) deferred rows |

**Exit:** each deferred epic is **funded and filed** as its own issue before coding; map 3.4 is optional and adoption-gated in the phase-3 doc.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-23 | Phase 1 (Assist): link **execute-post-action** / Search confirm slice after merge. |
| 2026-04-26 | Initial 5-phase rollup (post [program tranche handoff](./CONTROL_TOWER_WMS_PHASED_ROADMAP.md#program-tranche-handoff-2026-04-26)). |
