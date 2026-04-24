# Control Tower — agent todo list

**GitHub label:** `module:tower`  
**Typical allowed paths:** `src/app/control-tower/**`, `src/app/api/control-tower/**`, `src/lib/control-tower/**`, `src/components/control-tower-*.tsx`  
**Avoid without an issue saying so:** `prisma/schema.prisma` (migrations), global `src/components/app-nav.tsx`, shared auth unless the task requires it.

**Source of truth:** `docs/controltower/GAP_MAP.md` + PDFs in `docs/controltower/`.

**Engineering sequence (read this before a big Assist change):** The biggest gap to `control_tower_search_and_chatbot_spec_*.pdf` is **Assist + RAG + tools + chat sessions**—but shipping that as one PR is the wrong default. **Sequence along Phase 1** in the roadmap table (**1A → 1B → 1C → 1D → 1E**, one **vertical** per issue/PR) and carve **Assist** work into the **smallest** follow-ups in `GAP_MAP` near-term **#4** (not “chatbot v2”). R3 PDF checklist + [#6](https://github.com/lasealco/po-management/issues/6) for planning, not a monolithic runtime drop.

**Phased program (CT + WMS together):** [`docs/engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../CONTROL_TOWER_WMS_PHASED_ROADMAP.md) (phases 0–3, exit criteria). **Tranche handoff (2026-04-26):** Phases **0** + **1A–1E** + GAP **near-term 1–4** + **Phase 3** map MVP + **3.4** cross-surface are **closed** for this line — see [§ Program tranche handoff](../CONTROL_TOWER_WMS_PHASED_ROADMAP.md#program-tranche-handoff-2026-04-26). Ongoing = **backlog** (issues, 🟡 MVP rows in GAP).

### Phase 0 triage (standing)

- **[#3](https://github.com/lasealco/po-management/issues/3) (GAP refresh)** — **Met on `main` (2026-04-26 re-pass);** maintainers may **close** #3 on GitHub or keep as hygiene.
- **[#4](https://github.com/lasealco/po-management/issues/4) (inbound webhook tests)** — `src/lib/control-tower/inbound-webhook.test.ts` + mapper tests; **met on `main` —** close on GitHub if issue acceptance matches.
- **[#5](https://github.com/lasealco/po-management/issues/5) (report / exceptions per row)** — **Backlog** — product/eng vs `report-engine`.
- **[#6](https://github.com/lasealco/po-management/issues/6) (Assist / chatbot checklist)** — **Backlog** (PDF parity); planning checklist lives in `GAP_MAP` R3; runtime = incremental PRs (not one drop).

---

## Filed issues (backlog; not tranche blockers)

| Status | Item |
|--------|------|
| (maintainers) | **#3** / **#4** — close on GitHub if comments agree after handoff. |
| Open | **#5** — per-exception report dimension / product. |
| Open | **#6** — full chatbot / sessions vs PDF. |

---

## Next slices (from GAP_MAP — post-handoff)

These are **optional** product bets, not unfinished “program gaps”:

- [x] **Assist** — Phase **1A** + near-term **#4** (tool catalog + allowlisted `execute-post-action` 2026-04-23). **Next:** expand allowlist, optional LLM-suggested + confirm.
- [ ] **Reporting PDFs** — multi-section / tenant logo UX if product wants (beyond 1B).
- [x] **Workbench bulk** — 1C + **bulk_assign_ct_exception_owner** (2026-04-23). **Next:** GAP **near-term #6** (default columns per actor).
- [x] **Inbound** — 1E `sea_port_track_v1` + mapper; **simple_carrier_event_v1** (2026-04-23). **Next:** next carrier `payloadFormat`.
- [x] **Report engine** — 1D `openExceptionRatePct` + **exceptionRootCause** (2026-04-23). **Next:** GAP **#7** (NC catalog / templates) or **#5** (PDF/tenant logo).
- [ ] **Command center / ops** — deeper PDF parity where GAP shows 🟡 (optional).

---

## Hygiene

- [x] **2026-04-26** — GAP + roadmap handoff; future PRs should still **append changelog** in `controltower/GAP_MAP.md` when changing CT.
