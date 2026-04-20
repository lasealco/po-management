## Goal (meeting batch — Tariff engine slice)

**Regression + polish** inside the tariff vertical. Target **~2+ hours**. Follow **`.cursor/rules/tariff-engine-scope.mdc`**.

## Scope (allowed)

Only paths under the tariff engine slice, for example:

- `src/lib/tariff/**`
- `src/app/tariffs/**`
- `src/app/api/tariffs/**`
- `src/components/tariffs/**`

(Plus invoice-audit / pricing-snapshot paths **only** if the issue explicitly lists them — **do not** for this batch unless you found a blocking bug.)

## Do **not**

- Control Tower, CRM, WMS, SRM, unrelated `app-nav` refactors
- `db:seed` / `db:migrate` — **stop and ask Alex** if you believe they are required

## Checklist (complete all)

- [ ] **Tests:** add or extend **Vitest** coverage for **two** of: `import-pipeline.ts`, `promote-import-body.ts`, `geography-catalog.ts`, `tariff-workbench-urls.ts` (pick files with lowest coverage / highest churn — justify in PR).
- [ ] **Import UI:** one **operator-visible** improvement on `src/app/tariffs/import/**` or `tariff-import-*` components (clearer error state, step header alignment with workflow design token `var(--arscmp-primary)` for primary button if you add a CTA — see `.cursor/rules/workflow-design-system.mdc`).
- [ ] **Pure helpers:** if you extract helpers for tests, keep them in `src/lib/tariff/**`.
- [ ] **Green gate:** `npm run verify:tariff-engine`

## Git

- Branch from `main`; one PR; do not merge.

## Ref

- `docs/engineering/agent-todos/tariff.md`
