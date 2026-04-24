# Control Tower — agent todo list

**GitHub label:** `module:tower`  
**Typical allowed paths:** `src/app/control-tower/**`, `src/app/api/control-tower/**`, `src/lib/control-tower/**`, `src/components/control-tower-*.tsx`  
**Avoid without an issue saying so:** `prisma/schema.prisma` (migrations), global `src/components/app-nav.tsx`, shared auth unless the task requires it.

**Source of truth:** `docs/controltower/GAP_MAP.md` + PDFs in `docs/controltower/`.

**Engineering sequence (read this before a big Assist change):** The biggest gap to `control_tower_search_and_chatbot_spec_*.pdf` is **Assist + RAG + tools + chat sessions**—but shipping that as one PR is the wrong default. **Sequence along Phase 1** in the roadmap table (**1A → 1B → 1C → 1D → 1E**, one **vertical** per issue/PR) and carve **Assist** work into the **smallest** follow-ups in `GAP_MAP` near-term **#4** (not “chatbot v2”). R3 PDF checklist + [#6](https://github.com/lasealco/po-management/issues/6) for planning, not a monolithic runtime drop.

**Phased program (CT + WMS together):** [`docs/engineering/CONTROL_TOWER_WMS_PHASED_ROADMAP.md`](../CONTROL_TOWER_WMS_PHASED_ROADMAP.md) (phases 0–3, exit criteria). **Phase 0 re-pass complete** (2026-04-25) — `verify:apihub`, GAP near-term re-check; see triage block below. **Phase 3.4 (partial, 2026-04-25):** `/wms` home → **Open shipment map**; `/control-tower/map` → **WMS workspace**; when the actor has both `org.wms` and `org.controltower` view.

### Phase 0 triage (2026-04-25 re-pass)

- **[#3](https://github.com/lasealco/po-management/issues/3) (GAP refresh)** — Re-pass logged in `controltower/GAP_MAP.md` + `CONTROL_TOWER_WMS_PHASED_ROADMAP.md` changelog; maintainers may **close** #3 or keep as recurring hygiene.
- **[#4](https://github.com/lasealco/po-management/issues/4) (inbound webhook tests)** — `src/lib/control-tower/inbound-webhook.test.ts` exists with idempotency + batch coverage; re-read #4 for any **remaining** acceptance; close or add follow-up issues for gaps.
- **[#5](https://github.com/lasealco/po-management/issues/5) (report / exceptions per row)** — **Product/engineering** — follow latest issue comments vs `report-engine` + workbench; not changed in Phase 0.
- **[#6](https://github.com/lasealco/po-management/issues/6) (Assist / chatbot checklist)** — `GAP_MAP` **R3** subsection is the **docs-only** parity checklist; runtime unchanged. Close or keep #6 for future embedding/tool work per Phase 1.

---

## Already filed as GitHub issues (do those first)

Track in GitHub; check off here when merged.

- [ ] **#3** — Refresh GAP_MAP near-term backlog (docs only)
- [ ] **#4** — Vitest for inbound webhook (`inbound-webhook.ts`)
- [ ] **#5** — Report engine: open **exceptions** counted **per exception row**, dimension = catalog code + label (see latest comment on #5)
- [ ] **#6** — Assist/chatbot: spec parity checklist in GAP_MAP (docs only)

---

## Next slices (from GAP_MAP “near-term” / partials)

Turn each into an **Agent task** issue before starting if not already covered above.

- [x] **Assist / chatbot — embedding hybrid (Phase 1A)** — `assist-retrieval-embed.ts` + `CONTROL_TOWER_ASSIST_EMBEDDINGS=1`; keyword fallback. **Next:** audited tool calls or re-rank (separate issues).
- [ ] **Reporting PDFs** — richer branded templates vs `control_tower_reporting_and_kpi_spec` (likely needs design input first).
- [ ] **Workbench** — saved ledger views (if still desired after GAP “optional increments”).
- [ ] **Inbound** — carrier-specific mapper example + tests (extend `inbound-webhook.ts` patterns).
- [ ] **Command center / ops** — deeper parity with PDF where GAP shows 🟡.

---

## Hygiene

- [ ] After each CT PR: update **changelog** + “Near-term build order” in `docs/controltower/GAP_MAP.md` (can be its own small issue).
