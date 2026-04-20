# Control Tower — agent todo list

**GitHub label:** `module:tower`  
**Typical allowed paths:** `src/app/control-tower/**`, `src/app/api/control-tower/**`, `src/lib/control-tower/**`, `src/components/control-tower-*.tsx`  
**Avoid without an issue saying so:** `prisma/schema.prisma` (migrations), global `src/components/app-nav.tsx`, shared auth unless the task requires it.

**Source of truth:** `docs/controltower/GAP_MAP.md` + PDFs in `docs/controltower/`.

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

- [ ] **Assist / chatbot** — embeddings or vector retrieval spike (after doc checklist in #6); keep inside `assist*.ts` + docs until approved.
- [ ] **Reporting PDFs** — richer branded templates vs `control_tower_reporting_and_kpi_spec` (likely needs design input first).
- [ ] **Workbench** — saved ledger views (if still desired after GAP “optional increments”).
- [ ] **Inbound** — carrier-specific mapper example + tests (extend `inbound-webhook.ts` patterns).
- [ ] **Command center / ops** — deeper parity with PDF where GAP shows 🟡.

---

## Hygiene

- [ ] After each CT PR: update **changelog** + “Near-term build order” in `docs/controltower/GAP_MAP.md` (can be its own small issue).
