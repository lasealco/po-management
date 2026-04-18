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

## Suggested folder layout
```text
docs/
  srm/
    pdf/
    md/
    README.md
```

## Source alignment
These files are derived from the SRM PDF pack created earlier and are intended to mirror the same structure and intent.

## Development (SRM foundation)

Work for new schema/UI ships on **`feature/srm-foundation`** (not `main`) until review.

1. **Migrate:** `npm run db:migrate` (or `npx prisma migrate deploy`) so SRM tables and columns exist (`SupplierServiceCapability`, `SupplierOnboardingTask`, `Supplier.qualificationStatus` / summary / last reviewed, …).
2. **Seed:** `npm run db:seed` — demo **SUP-001** gets sample **capabilities** and a full **onboarding checklist** (first three items marked done).
3. **Tests (SRM lib):** `npm run test:srm` — runs all Vitest files under `src/lib/srm/` (capability payload parsing, onboarding PATCH parsing, default checklist shape).
4. **Full suite:** `npm run test` — includes the same SRM tests plus the rest of the repo.
5. **Manual:** `npm run dev` → `/srm` → open **SUP-001** → **Capabilities** and **Onboarding** tabs (SRM shell), or `/suppliers/[id]` for legacy single-page layout with the same blocks.
