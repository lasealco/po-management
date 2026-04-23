# SRM — 30 finish slices (module completion program)

**Purpose:** Turn “finish SRM” into **30 agent-sized issues** (one PR per slice when possible). After **all 30** are merged and `GAP_MAP.md` is updated, the module can be marked **done** for the **MVP scope defined below** (not every PDF page—enterprise depth stays explicitly out of scope unless a slice says otherwise).

**Sources:** `docs/srm/GAP_MAP.md`, `docs/srm/*.pdf`, `docs/engineering/agent-todos/srm.md`.

**Typical allowed paths:** `src/app/srm/**`, `src/app/suppliers/**` (SRM-scoped), `src/lib/srm/**`, `src/components/**` when clearly SRM-only, `src/app/api/**` for SRM-named routes, `prisma/**` only when the slice says schema/migration.

**Quality bar (each slice):** `npm run lint && npx tsc --noEmit && npm run test` (plus any slice-specific `verify:*` if touched).

**Parallelism:** Do not run two slices that both edit `prisma/schema.prisma` or the same hot client without coordination.

---

## MVP “done” definition (what slice 30 closes)

- `/srm` list, `/srm/new`, `/srm/[id]` meet **workflow design system** guardrails where applicable.
- **Lifecycle:** staged onboarding or task checklist is usable for demo tenant (not necessarily supplier portal).
- **Compliance:** document types + expiry/visibility rules **read/write** in UI with API guards (vault v1).
- **KPI:** at least one **tenant-scoped** supplier health / concentration / SLA view backed by real aggregates.
- **Integration:** one **versioned inbound** payload (+ idempotency story) and tests; optional small outbound export slice if timeboxed.
- **Permissions:** SRM APIs and mutations aligned with `org.suppliers` + related grants; no silent bypass.
- **`GAP_MAP.md`:** every blueprint row either **✅** (MVP met) or **⏸ deferred** with a one-line reason and link to a future epic.

---

## Phase A — Baseline, UX shell, and permissions (slices 1–10)

| # | Slice | Goal | Acceptance (checklist for the issue) |
|---|--------|------|--------------------------------------|
| **1** | **SRM completion index** | Register this program in-repo | **Done:** `GAP_MAP.md` § **Completion program (SRM MVP)**; `agent-todos/srm.md` links here + GAP anchor. Slice 3 adds issue/PR tracker. |
| **2** | **Definition-of-done checklist** | Single page reviewers use | **Done:** `GAP_MAP.md` § **SRM MVP sign-off checklist** — routes, grants, migrations, seeds, manual smoke table, doc gate for slice 30. |
| **3** | **Slice tracker table** | Traceability | **Done:** `GAP_MAP.md` § **Slice tracker** (+ Phase A ship note). |
| **4** | **List page polish** | `/srm` production feel | **Done:** Zero-state without search; mobile card list (`md:hidden`); desktop table unchanged; primary **Create** via `ActionLink`. |
| **5** | **Create partner wizard polish** | `/srm/new` | **Done:** Client **name** validation; success **`router.push(/srm/[id])`**; existing `WorkflowHeader` steps. |
| **6** | **360 layout & navigation** | `/srm/[id]` IA | **Done:** Tabs Profile · Contacts & sites · Capabilities · Orders · Compliance · Activity; sticky nav; Compliance/Activity copy points to later phases. |
| **7** | **360 profile completeness** | Core supplier fields | **Done:** **`bookingConfirmationSlaHours`** in snapshot, PATCH API, and commercial form (logistics SLA); remaining header fields already on 360. |
| **8** | **Contacts & offices CRUD** | Sub-entities | **Done:** Office **PATCH** UI (edit inline); contacts unchanged; delete confirm preserved. |
| **9** | **Capabilities matrix UX** | `SupplierServiceCapability` | **Done:** Empty-state panel + table hint; primary **Add capability** button (`--arscmp-primary`). |
| **10** | **API guard pass (read)** | Hardening | **Done:** Vitest for **`GET /api/suppliers`** (gate, tenant 404, happy path) and **`GET /api/suppliers/[id]`** (gate, 404, happy path). |

---

## Phase B — Lifecycle & onboarding (slices 11–15)

**Status:** ✅ Landed (see `GAP_MAP.md` Phase B note).

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **11** | **Approval / status transitions** | Explicit state machine | **Done:** `src/lib/srm/supplier-approval-transitions.ts` + enforcement on **`POST /api/suppliers/[id]/approval`** and **`PATCH /api/suppliers/[id]`**; UI: pending / rejected / revoke flows; Vitest for illegal edges. |
| **12** | **Activation guard** | Align with PO/booking usage | **Done:** `supplierOperationalBlockReason` on **`POST /api/orders`** (supplier + forwarder); `docs/srm/SRM_ACTIVATION_GUARDS.md`; 360 copy for pending/rejected. |
| **13** | **Onboarding task list v1** | Lifecycle spec foothold | **Done:** `SupplierOnboardingTask` + defaults; **Onboarding** tab with % complete; APIs **`GET /api/suppliers/[id]/onboarding-tasks`**, **`PATCH .../tasks/[taskId]`**. |
| **14** | **Onboarding task assignee & due** | Operator workflow | **Done:** assignee + due + notes; **`/srm?onboardingMine=1`** filter; editors PATCH via `org.suppliers` → edit. |
| **15** | **Notifications hook (optional)** | Future-ready | **Done (stub):** `src/lib/srm/srm-notification-hook.ts` logs JSON on approval POST; in-app/email **deferred** until a bus exists. |

---

## Phase C — Compliance & documents (slices 16–20)

**Status:** ✅ Landed (see `GAP_MAP.md` Phase C note).

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **16** | **Document schema v1** | Persist metadata | **Done:** `SrmSupplierDocument` + `SrmSupplierDocumentAuditLog`; migration `20260423140000_srm_phase_c_compliance_documents` (rollback SQL in header). |
| **17** | **Document list & upload** | Vault v1 UI | **Done:** **`GET`/`POST`** `/api/suppliers/[id]/srm-documents` (multipart); **Compliance** tab list + upload; dev `public/uploads/srm-documents` or Vercel Blob when `BLOB_READ_WRITE_TOKEN` set. |
| **18** | **Expiry signals** | Control tower or badge | **Done:** Query-time `expirySignal` on API + badge on 360 (30d “expiring soon”). |
| **19** | **Compliance read-only mode** | Grants | **Done:** Upload/archive require **`org.suppliers` → edit**; view + audit + download with **view**; copy in UI for view-only users. |
| **20** | **Document audit trail** | Trust | **Done:** Append-only audit log; **`GET`** `/api/suppliers/[id]/srm-documents/[docId]/audit-logs`; last change line + expandable trail in UI. |

---

## Phase D — Performance, risk & KPI (slices 21–24)

**Status:** ✅ Landed (see `GAP_MAP.md` Phase D note).

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **21** | **KPI data: spend / volume by supplier** | Aggregates | **Done:** `loadSrmOrderVolumeKpis` — parent POs in UTC range, `Supplier` category filter; spend by `totalAmount` + `currency` (no FX); see `src/lib/srm/srm-analytics-aggregates.ts`. |
| **22** | **KPI dashboard route** | `/srm/analytics` or tab | **Done:** **`/srm/analytics`** + **`GET /api/srm/analytics`**; `org.suppliers` → view; PO metrics need `org.orders` → view (API returns `orderMetricsRequiresOrdersView` when blocked). |
| **23** | **Concentration / top-N risk** | Simple risk signal | **Done:** Top-3 **order-count** % + per-currency **spend** top-3 % on dashboard; MVP copy explains limitation. |
| **24** | **SLA / booking SLA widget** | Uses existing fields | **Done:** Logistics: `loadSrmBookingSlaStats` — `bookingSentAt` vs first `BOOKING_CONFIRMED` milestone vs `bookingConfirmationSlaHours` (default 24h); sparse-data callout; **GAP_MAP** Phase D caveat. |

---

## Phase E — Integration pack (slices 25–28)

**Status:** ✅ Landed (see `GAP_MAP.md` Phase E note).

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **25** | **Inbound payload: supplier upsert v1** | Versioned JSON | **Done:** **`POST /api/srm/integrations/v1/suppliers/upsert`** — `schemaVersion: 1`, `match.id` / `match.code` / create; maps to `Supplier`; **`SrmIntegrationIdempotency`** + `Idempotency-Key`. |
| **26** | **Inbound tests** | Contract | **Done:** Vitest for gate, idempotency replay, idempotency conflict (`route.test.ts`). |
| **27** | **Outbound export (optional)** | CSV or JSON | **Done:** **`GET /api/srm/integrations/v1/suppliers/export`** — `format=json` (default) or `csv`, optional `kind=`. |
| **28** | **Integration docs** | Operator-facing | **Done:** **`docs/srm/INTEGRATION.md`**. |

---

## Phase F — Closeout (slices 29–30)

**Status:** ✅ Landed (see `GAP_MAP.md` Phase F note).

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **29** | **Seed & demo data** | Repeatable demo | `db:seed` or `db:seed:srm-demo` (idempotent): 3–5 suppliers with docs, tasks, varied approval states; documented in `docs/database-neon.md` if Neon-specific. |
| **30** | **GAP_MAP + module done** | Sign-off | Update `GAP_MAP.md` blueprint rows to **✅** or **⏸**; mark near-term build order complete; add “SRM MVP complete as of &lt;date&gt;” banner; archive open “finish” bullets in `agent-todos/srm.md` or point here only. |

---

## Post-MVP (optional) — **5 phases (G–K)** — *not* part of the 30 slices

After **Phase F** (slices 29–30), **no slice numbers** are defined in repo until you start a new program. The **⏸** rows in `GAP_MAP.md` and the follow-ups in `docs/engineering/agent-todos/srm.md` are grouped here for planning only — open **one epic/issue per row** when you prioritize.

| Phase | Name | What it covers (deferred from MVP / PDFs) |
|-------|------|---------------------------------------------|
| **G** | **Deep lifecycle (operator-side)** | Staged capture beyond today’s checklist, notification bus (in-app / email), richer onboarding per lifecycle PDF — **excludes** external supplier login. **Started in repo:** operator **pipeline stage** (`Supplier.srmOnboardingStage` on `/srm/[id]` Onboarding tab) + persisted **in-app notifications** (`SrmOperatorNotification`, assignee on onboarding task → `/srm/notifications`). Email/webhooks still future. |
| **H** | **Supplier self-service portal** | External identity, supplier-facing flows, self-service (called out as post-MVP in the finish program). **Started in repo:** optional `User.portalLinkedSupplierId` → `Supplier`; demo seed links `supplier@demo-company.com` to **SUP-001**; **`/srm/portal`** read-only “Your company” + **`GET /api/srm/portal/me`**. Full self-service edits and separate auth are still future. |
| **I** | **Compliance / document control v2** | Full DMS-style workflow, revision matrix, beyond **vault v1** (`SrmSupplierDocument` + audit). **Started in repo:** per-family **`revisionGroupId` + `revisionNumber` + `supersedesDocumentId`**; upload **new version** supersedes prior row; Compliance tab **matrix** by family; audit actions `superseded` / enriched `upload`. Approvals/routing still future. |
| **J** | **KPI, risk & integration depth** | Full **`srm_performance_risk_and_kpi_spec` depth** (e.g. FX, forecasting) + **remaining integration payloads** + outbound/ERP from **`srm_integration_and_api_payload_pack`**. **Started in repo:** **operational signals** (approval mix + onboarding open/overdue) on **`GET /api/srm/analytics`** + **`/srm/analytics`**; integration **`GET /api/srm/integrations/v1/analytics/snapshot`** (`schemaVersion: 1`); `parseSrmAnalyticsQuery` shared parser. **Still future:** multi-currency FX, forecasting, extra inbound payload types. |
| **K** | **Enterprise polish** | **Field-level** permission matrix, **pixel/wireframe** pack parity, **workflow/rules** engine depth, multi-tenant cross-org (if in scope) — *pick as separate issues*. **Started in repo:** `canViewSupplierSensitiveFields` on **`resolveSrmPermissions`** (`org.suppliers` → **edit** or **approve**); centralized **`redact-supplier-sensitive`** clears **`internalNotes`**, **tax / VAT ID**, **credit** fields, and **per-contact notes** for API + 360 when view-only; read-only UI callouts. **Still future:** full matrix, wireframe parity, rules engine, cross-tenant. |

**Count:** **5 phases** (G through K), separate from **6 MVP phases** (A–F). Slices **1–30** map only to **A–F**.

---

## How to run this program

1. Create **GitHub issue per slice** (Agent task template): title `srm(finish): slice N — &lt;short name&gt;`, body = copy the row + allowed paths + verify command.
2. **One PR per slice** when possible; if a slice is too small, merge only with Alex approval.
3. After merge, fill the **tracker** in `GAP_MAP.md` (slice # → issue → PR).
4. When slice **30** merges, declare **SRM MVP done** per the definition above.

---

## Explicitly out of scope (unless you open a new epic)

- Supplier **self-service portal** (external login).
- Full **workflow builder** / business rules engine.
- **Pixel-perfect** wireframe pack parity.
- Multi-tenant **cross-org** supplier networks.

---

_Last created: program kickoff. Refresh tracker rows as issues are filed._
