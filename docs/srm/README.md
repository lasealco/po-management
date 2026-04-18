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
| Shipped app behavior | `src/app/srm`, `src/lib/srm` ([`src/lib/srm/README.md`](../../src/lib/srm/README.md)), `prisma/schema.prisma`, `docs/srm/README.md` (checklist below) |

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
- **Automated verify + DB sanity (optional):** `npm run verify:srm:with-db` — same as **`verify:srm`**, then if **`DATABASE_URL`** (or **`DATABASE_URL_UNPOOLED`** / **`DIRECT_URL`**) is set (e.g. from **`.env.local`**), checks that core SRM tables/columns exist and, when **SUP-001** is present, that seed-linked onboarding/documents/alerts/capabilities rows exist. Without a DB URL, it still runs **`verify:srm`** and exits **0**. To force static checks only while **`.env.local`** still defines a URL, run **`SKIP_SRM_DB_VERIFY=1 npm run verify:srm:with-db`**.
- **Full local verify (with database):** `npm run db:migrate` → `npm run db:seed` → `npm run verify:srm:with-db` (or `verify:srm`) → `npm run build` → `npm run dev` (demo user via Settings → Demo session) → `/srm` → open **SUP-001**.
- **Activation rule (onboarding core):** `POST /api/suppliers/[id]/approval` with `decision: "approve"`, and `PATCH /api/suppliers/[id]` when transitioning into **approved + active**, require **every** onboarding task to be **done** or **waived** (HTTP **409** otherwise). Responses may include **`onboarding.pendingTasks`** (labels + keys) so the UI can show what is still open. Existing suppliers that are already approved and active are unchanged.

### R1 foundation — runnable & demoable (assessment)

With **migrations applied**, **seed loaded**, **`.env.local`** (or equivalent) pointing at that database, and **`npm run verify:srm`** passing, the current branch is **runnable** for local **`npm run dev`**. Onboarding + approval are **demoable** end-to-end using the script below (buyer → checklist → approver); **SUP-001** remains a stable **approved** 360 demo. Gaps intentionally left for later phases: no public **supplier master upsert** HTTP route yet (parse/map only in `src/lib/srm`), no sync/outbox, and **Prompt 7** document-control depth (e.g. formal “document request” center) is only partially covered by the Compliance readiness strip.

### Next planned SRM scope (after this assessment)

Per **`docs/srm/cursor_srm_prompt_sequence.md`**, the next sequential focus is **Prompt 7 — compliance / document control** (expiring-doc workflows, missing-document requests, suspension hooks—beyond the current readiness strip). **Prompt 9 — integration scaffolding** (secured **HTTP** for supplier master upsert + sync/outbox) can proceed in parallel if integration is the higher priority.

### Demo script — create supplier through activation

Use **`npm run dev`**, **Settings → Demo session**, seeded password **`demo12345`**.

1. **Buyer:** Act as **`buyer@demo-company.com`**. Open **`/srm/new`**, submit the form. You land on **`/srm/[id]?tab=onboarding`** with **pending approval** (buyers do not auto-approve).
2. **Onboarding:** Complete the checklist (**done** or **waived** for every row). Use tab shortcuts on the yellow **Pending procurement** banner if helpful. Complete **approval_chain** before marking **activation_decision** as done (workflow rule).
3. **Documents:** Open the **Documents** tab; register metadata (and optional **expiry**) for at least one **insurance**, **license**, or **certificate** row so **Compliance** has controlled-category evidence.
4. **Compliance:** Open **Compliance**; confirm the document readiness strip and latest review hints.
5. **Approver:** Switch demo user to **`approver@demo-company.com`**, reopen the supplier, and choose **Approve and activate** on the same banner. If anything is still open, the API responds with **409** and the client surfaces remaining checklist labels.

If you create a supplier while already acting as **`approver@demo-company.com`**, the API may create it **approved** immediately — use the **buyer** account to exercise the full governed flow.

#### Setup and reference (not sequential with the demo above)

- **Migrate:** `npm run db:migrate` (or `npx prisma migrate deploy`) so SRM tables and columns exist (`SupplierServiceCapability`, `SupplierOnboardingTask`, `Supplier.qualificationStatus` / summary / last reviewed, `SupplierComplianceReview`, `SupplierPerformanceScorecard`, `SupplierRiskRecord`, `SupplierDocument`, `SupplierRelationshipNote`, `SupplierContractRecord`, `SupplierSrmAlert`, …). Recent additions include folders `20260418270000_supplier_srm_alert`, `20260418280000_supplier_document_expires_at`, and `20260418290000_supplier_document_archived_at` (alerts + document expiry + archive). **Ordered SRM migration reference:** [`SRM_MIGRATIONS.md`](./SRM_MIGRATIONS.md).
- **Seed:** `npm run db:seed` — demo **SUP-001** is normalized to **approved**, **active**, **product** category (stable 360 demo), with sample **capabilities**, a full **onboarding checklist** (first three items **done** + `completedAt`), **documents** (including `expiresAt`), **alerts**, and related SRM rows.
- **Tests (SRM lib):** `npm run test:srm` — Vitest under `src/lib/srm/`. Prefer **`npm run verify:srm`** when you also want schema + TypeScript checks in one command.
- **Full suite:** `npm run test` — includes the same SRM tests plus the rest of the repo.
- **Manual (SUP-001):** `npm run dev` → `/srm` → directory shows **People** / **Sites** counts; open **SUP-001** → **Overview** for full **office** address + active flag (edit/save like contacts), **Capabilities** / **Onboarding** tabs, or `/suppliers/[id]` for legacy layout with the same blocks.
- **Onboarding intake:** `POST /api/suppliers` persists optional **`internalNotes`**, seeds the **default checklist** immediately, and sets **`qualificationStatus`** to **in progress** for partners that start **pending approval**. `/srm/new` collects intake notes and redirects to **`/srm/[id]?tab=onboarding`** after create.
- **Qualification workflow:** On the **Qualification** tab, **Apply suggestion** writes the checklist-derived status (same fields as manual save). Checklist **waived** rows now stamp **`completedAt`** like **done** (cleared when returned to **pending**).
- **URLs:** Supplier 360 under `/srm/[id]` keeps the active workspace in **`?tab=`** (e.g. `overview`, `onboarding`, `compliance`, `contacts`, `documents`) so refresh and shared links reopen the same tab. **`?registerCategory=`** (`insurance`, `license`, `certificate`, `compliance_other`, `commercial_other`) opens **Documents** with that category pre-selected in the register flow; the param is removed after apply (legacy **`/suppliers/[id]`** scrolls to the documents block). The SRM directory (and legacy **`/suppliers`**) support **`?kind=`**, **`?q=`** (name/code), **`?approval=`** (`all` \| `pending` \| `approved` \| `rejected`), **`?active=`** (`all` \| `active` \| `inactive`), and **`?sort=`** (`name` \| `code` \| `updated`).
- **Compliance / performance / risk:** REST under `/api/suppliers/[id]/compliance-reviews`, `…/performance-scorecards`, `…/risk-records` (POST create; PATCH row). Data loads with the supplier snapshot for `/srm/[id]` and legacy detail. The **Compliance** tab **document control** strip uses **tiered expiry** (critical ≤14 days, soon ≤30 days, then expired), a **readiness score** (0–100 heuristic), **missing controlled document types** (no insurance/license/certificate row on file) with **Register {category}** actions that jump to **Documents** with the category pre-selected, row-level findings with detail lines, plus periodic review **next due** hints. Workspace tabs show **issue counts** on **Compliance** and **Documents** when attention is needed.
- **Documents:** `POST/PATCH/DELETE` `/api/suppliers/[id]/documents` — metadata + optional `http(s)` reference URL + optional **`expiresAt`** + optional soft **`archivedAt`** via PATCH body `{ "archived": true|false }` (archived rows are omitted from Compliance readiness counts). The **Documents** tab includes **All / Active / Archived / Needs attention** filters (row-level expiry + missing expiry on controlled rows); if **Needs attention** is empty but required categories are still absent, an inline hint points back to **Compliance** for supplier-level gaps. Row badges reflect **critical** vs **soon** expiry tiers. Not automated workflow, tender, tariff, or sourcing events.
- **Relationship notes:** `POST/PATCH/DELETE` `/api/suppliers/[id]/relationship-notes` — chronological account touchpoints (SRM supplier 360 only).
- **Contracts:** `POST/PATCH/DELETE` `/api/suppliers/[id]/contract-records` — commercial agreement summary + optional link (not tenders/tariffs/sourcing).
- **Alerts:** `POST/PATCH/DELETE` `/api/suppliers/[id]/srm-alerts` — manual buyer alerts on supplier 360 (resolve stamps `resolvedAt`; not automated tender/tariff/sourcing feeds).
- **Inbound supplier master (minimal slice):** `src/lib/srm/srm-supplier-master-upsert-payload.ts` (parse JSON) and `src/lib/srm/srm-supplier-master-upsert-map.ts` (map to `Supplier` field hints). Vitest-covered; **no** sync job, outbox, or public HTTP route yet.
