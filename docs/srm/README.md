# SRM documentation

This directory is the **product documentation pack** for Supplier Relationship Management (SRM) in this repo: PDF specifications, Markdown sidecars for tooling, and a **local runnable checklist** for the app under `/srm`.

---

## Canonical layout

```text
docs/srm/
  README.md                         # This file: layout rules + pairing table + dev checklist
  cursor_srm_prompt_sequence.md     # Optional phased build prompts (not a PDF sidecar)
  pdf/                              # Versioned PDF pack — human-readable source specs
  md/                               # Markdown sidecars — agent/IDE-friendly (stable filenames)
```

### Non-ambiguous rules

1. **PDFs** — Only under **`docs/srm/pdf/`**. Never commit `docs/srm/*.pdf` at the SRM docs root.
2. **Spec sidecars** — Only under **`docs/srm/md/`**, named `srm_<topic>.md` (no date stamp in the basename).
3. **Pairing** — Each sidecar `md/srm_<topic>.md` corresponds to exactly one PDF  
   `pdf/srm_<topic>_20260417_063215.pdf`: same `<topic>` segment; the PDF carries a fixed **export timestamp** suffix.
4. **`cursor_srm_prompt_sequence.md`** — Lives at **`docs/srm/`** root on purpose: workflow helper, not tied 1:1 to a single PDF.
5. **Truth order** — When docs and code disagree, **code + Prisma schema** win; update docs in a deliberate follow-up.

### PDF ↔ Markdown pairing

| Markdown sidecar | PDF pack file |
|------------------|---------------|
| `md/srm_blueprint_and_module_definition.md` | `pdf/srm_blueprint_and_module_definition_20260417_063215.pdf` |
| `md/srm_compliance_and_document_control_spec.md` | `pdf/srm_compliance_and_document_control_spec_20260417_063215.pdf` |
| `md/srm_data_model_and_er_spec.md` | `pdf/srm_data_model_and_er_spec_20260417_063215.pdf` |
| `md/srm_functional_prd.md` | `pdf/srm_functional_prd_20260417_063215.pdf` |
| `md/srm_integration_and_api_payload_pack.md` | `pdf/srm_integration_and_api_payload_pack_20260417_063215.pdf` |
| `md/srm_performance_risk_and_kpi_spec.md` | `pdf/srm_performance_risk_and_kpi_spec_20260417_063215.pdf` |
| `md/srm_permission_and_visibility_matrix.md` | `pdf/srm_permission_and_visibility_matrix_20260417_063215.pdf` |
| `md/srm_sprint_backlog_and_release_plan.md` | `pdf/srm_sprint_backlog_and_release_plan_20260417_063215.pdf` |
| `md/srm_supplier_lifecycle_and_onboarding_spec.md` | `pdf/srm_supplier_lifecycle_and_onboarding_spec_20260417_063215.pdf` |
| `md/srm_ux_ui_design_guideline_and_wireframe_pack.md` | `pdf/srm_ux_ui_design_guideline_and_wireframe_pack_20260417_063215.pdf` |
| `md/srm_workflow_and_business_rules.md` | `pdf/srm_workflow_and_business_rules_20260417_063215.pdf` |

---

## Who should read what

| Audience | Path |
|----------|------|
| Humans (print / legal-style review) | `pdf/*.pdf` |
| Cursor / agents / ripgrep | `md/*.md` |
| Shipped app behavior | `src/app/srm`, `src/lib/srm`, `prisma/schema.prisma`, `docs/srm/README.md` (checklist below) |

---

## Using this pack in Cursor

1. Point the session at **`docs/srm/md/`** for spec text; use **`cursor_srm_prompt_sequence.md`** if you want phased build guidance.
2. Inspect the repo (schema, migrations, `/srm` routes) before large changes.
3. Build in slices: schema → lifecycle/onboarding → compliance/documents → UI → integrations (see prompt file).

---

## Development (SRM foundation)

Work for new schema/UI ships on **`feature/srm-foundation`** (not `main`) until review.

### Early phase (R1) — runnable checklist

- **Directory & 360:** `/srm`, `/srm/new`, `/srm/[id]` with `org.suppliers` view/edit/approve gates; legacy `/suppliers` still available.
- **Fast verify (no database required):** `npm run verify:srm` — runs **`prisma validate`**, **`npx tsc --noEmit`**, and **`npm run test:srm`** in one shot. Use this before pushing SRM schema or parser changes.
- **Full local verify (with database):** `npm run db:migrate` → `npm run db:seed` → `npm run verify:srm` → `npm run build` → `npm run dev` (demo user via Settings → Demo session) → `/srm` → open **SUP-001**.
- **Activation rule (onboarding core):** `POST /api/suppliers/[id]/approval` with `decision: "approve"`, and `PATCH /api/suppliers/[id]` when transitioning into **approved + active**, require **every** onboarding task to be **done** or **waived** (HTTP **409** otherwise). Existing suppliers that are already approved and active are unchanged.

1. **Migrate:** `npm run db:migrate` (or `npx prisma migrate deploy`) so SRM tables and columns exist (`SupplierServiceCapability`, `SupplierOnboardingTask`, `Supplier.qualificationStatus` / summary / last reviewed, `SupplierComplianceReview`, `SupplierPerformanceScorecard`, `SupplierRiskRecord`, `SupplierDocument`, `SupplierRelationshipNote`, `SupplierContractRecord`, `SupplierSrmAlert`, …). Recent additions include folders `20260418270000_supplier_srm_alert`, `20260418280000_supplier_document_expires_at`, and `20260418290000_supplier_document_archived_at` (alerts + document expiry + archive).
2. **Seed:** `npm run db:seed` — demo **SUP-001** is normalized to **approved**, **active**, **product** category (stable 360 demo), with sample **capabilities**, a full **onboarding checklist** (first three items **done** + `completedAt`), **documents** (including `expiresAt`), **alerts**, and related SRM rows.
3. **Tests (SRM lib):** `npm run test:srm` — Vitest under `src/lib/srm/`. Prefer **`npm run verify:srm`** when you also want schema + TypeScript checks in one command.
4. **Full suite:** `npm run test` — includes the same SRM tests plus the rest of the repo.
5. **Manual:** `npm run dev` → `/srm` → directory shows **People** / **Sites** counts; open **SUP-001** → **Overview** for full **office** address + active flag (edit/save like contacts), **Capabilities** / **Onboarding** tabs, or `/suppliers/[id]` for legacy layout with the same blocks.
6. **Onboarding intake:** `POST /api/suppliers` persists optional **`internalNotes`**, seeds the **default checklist** immediately, and sets **`qualificationStatus`** to **in progress** for partners that start **pending approval**. `/srm/new` collects intake notes and redirects to **`/srm/[id]?tab=onboarding`** after create.
7. **Qualification workflow:** On the **Qualification** tab, **Apply suggestion** writes the checklist-derived status (same fields as manual save). Checklist **waived** rows now stamp **`completedAt`** like **done** (cleared when returned to **pending**).
8. **URLs:** Supplier 360 under `/srm/[id]` keeps the active workspace in **`?tab=`** (e.g. `onboarding`, `qualification`) so refresh and shared links reopen the same tab. The SRM directory supports **`?q=`** (and legacy `/suppliers`) for name/code search.
9. **Compliance / performance / risk:** REST under `/api/suppliers/[id]/compliance-reviews`, `…/performance-scorecards`, `…/risk-records` (POST create; PATCH row). Data loads with the supplier snapshot for `/srm/[id]` and legacy detail. The **Compliance** tab includes a **document control (readiness)** strip (document expiry + missing expiry on controlled categories, archived excluded) and a **latest periodic review** summary with **next due** hints (overdue / within 14 days), plus a shortcut to **Documents**.
10. **Documents:** `POST/PATCH/DELETE` `/api/suppliers/[id]/documents` — metadata + optional `http(s)` reference URL + optional **`expiresAt`** + optional soft **`archivedAt`** via PATCH body `{ "archived": true|false }` (archived rows are omitted from Compliance readiness counts). Not automated workflow, tender, tariff, or sourcing events.
11. **Relationship notes:** `POST/PATCH/DELETE` `/api/suppliers/[id]/relationship-notes` — chronological account touchpoints (SRM supplier 360 only).
12. **Contracts:** `POST/PATCH/DELETE` `/api/suppliers/[id]/contract-records` — commercial agreement summary + optional link (not tenders/tariffs/sourcing).
13. **Alerts:** `POST/PATCH/DELETE` `/api/suppliers/[id]/srm-alerts` — manual buyer alerts on supplier 360 (resolve stamps `resolvedAt`; not automated tender/tariff/sourcing feeds).
