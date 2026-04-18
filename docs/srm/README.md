# SRM Markdown Sidecar Pack

This pack is the Cursor-readable companion to the SRM PDF documentation set.

## Purpose
Use these markdown files when Cursor cannot reliably read PDFs.
The PDFs remain the human-readable source package; these markdown files are the agent-friendly sidecars.

## Recommended usage in Cursor
1. Upload or place these markdown files in `docs/srm/`
2. Start the session with the SRM session rules
3. Ask Cursor to inspect the repo first
4. Build phase by phase:
   - schema
   - onboarding/lifecycle
   - compliance/document control
   - performance/risk
   - UI/workflows
   - integrations
   - rollout

## Repository layout (this project)

```text
docs/srm/
  README.md                         # This file: Cursor usage + local dev checklist
  pdf/                              # Versioned PDF pack (human-readable source specs)
  srm_*.md                          # Markdown sidecars (agent-friendly; same themes as the PDFs)
  cursor_srm_prompt_sequence.md     # Suggested build prompts for phased delivery
```

PDFs are **not** duplicated at `docs/srm/*.pdf`; they live only under **`docs/srm/pdf/`**. Markdown mirrors live next to `README.md` at the `docs/srm/` root for easy discovery.

## Source alignment
These markdown files are derived from the SRM PDF pack and are intended to mirror the same structure and intent.

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
