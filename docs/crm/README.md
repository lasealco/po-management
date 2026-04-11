# 3PL logistics CRM — product documentation

PDFs exported from the CRM specification pack:

- `logistics_crm_blueprint_and_prd.pdf` — vision, scope, workflows, screen PRD
- `logistics_crm_data_model_er_spec.pdf` — logical schema and integration notes
- `logistics_crm_role_permission_matrix.pdf` — RBAC and field-level intent
- `logistics_crm_sprint_backlog_and_release_plan.pdf` — phased backlog and acceptance criteria
- `logistics_crm_ui_wireframe_pack.pdf` — screen inventory and layout guidance
- `logistics_crm_ux_ui_design_guideline.pdf` — UX/UI rules

See also `docs/modular-product-and-crm-strategy.md` for how CRM fits into this monorepo.

## Implementation (R1 in app)

- **Tenant** is the CRM data boundary (`tenantId` on all CRM tables), same as PO/WMS.
- **Permissions:** `org.crm` → `view` (own records) and `edit` (all tenant CRM rows). Granted to Buyer/Approver in `prisma/seed.mjs`; add to other roles in **Settings → Roles** as needed.
- **UI:** `/crm` · **API:** `/api/crm/*` — run `npm run db:migrate:local` after pulling so the CRM migration is applied.
