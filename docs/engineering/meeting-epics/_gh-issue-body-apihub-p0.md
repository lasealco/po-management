## Goal (meeting batch — API hub / ingestion, **P0 only**)

Land the **documentation home** + **read-only product shell** + **tiny health API** for the new **API hub** initiative described in `docs/apihub/integrations-ai-assisted-ingestion.md`. Target **~2+ hours**. **No** `db:migrate` / `db:seed` unless Alex explicitly approves in a comment (default: **no schema** in P0).

## Scope (allowed)

### Docs (required)

- `docs/apihub/**` — polish README + spec cross-links; keep `GAP_MAP.md` accurate after code stubs exist.
- `docs/engineering/agent-todos/integration-hub.md` — point here as the **live spec home**; mark “product one-pager / spec” style todos as superseded by `docs/apihub/` with links (checkbox hygiene).

### App (P0 shell)

- `src/app/apihub/**` — layout + landing page: explain purpose, link to `docs/apihub` on GitHub (public path), **step placeholders** (1–5) aligned with spec §4 UX (non-functional is fine).
- `src/app/api/apihub/health/route.ts` — `GET` returns JSON `{ ok: true, service: "apihub", phase: "P0" }` (or equivalent); no secrets.

### Optional (only if time remains)

- **One** `src/lib/apihub/**` file with exported constants (phase enum, route helpers) + **Vitest** for a trivial pure function.
- **Command palette** entry for “API hub” → `/apihub` — **minimal** touch to `src/components/command-palette.tsx` / `src/lib/help-actions.ts` only if you can mirror an existing pattern in **≤30 lines** changed; otherwise **skip** and note in PR.

## Do **not**

- Prisma schema / migrations, connector tables, LLM calls, Blob uploads for production ingestion (P1+).
- Control Tower inbound rewrite, tariff engine, CRM core — **no drive-by** refactors.

## Checklist (complete all)

- [ ] **Docs:** `docs/apihub/README.md` + `integrations-ai-assisted-ingestion.md` readable and mutually linked; `GAP_MAP.md` updated to reflect whatever you ship in code (✅/🟡/❌).
- [ ] **integration-hub todo:** `docs/engineering/agent-todos/integration-hub.md` updated — top section references `docs/apihub/` and clarifies P0 vs later phases.
- [ ] **UI:** `/apihub` renders for a logged-in demo user; uses existing layout/chrome patterns; primary CTA uses `var(--arscmp-primary)` where you add a button (see workflow design system rule).
- [ ] **API:** `GET /api/apihub/health` works locally.
- [ ] **Quality:** `npm run lint && npx tsc --noEmit && npm run test` (add tests only if you added `src/lib/apihub` tests).
- [ ] **PR:** one branch, one PR, do not merge.

## Ref

- `docs/apihub/integrations-ai-assisted-ingestion.md` — phased delivery §8.

