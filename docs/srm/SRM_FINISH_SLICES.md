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
| **2** | **Definition-of-done checklist** | Single page reviewers use | Add a short “SRM MVP sign-off” checklist to `GAP_MAP.md` (or bottom of this file) listing: routes, grants, seeds, migrations, manual smoke URLs. |
| **3** | **Slice tracker table** | Traceability | In `GAP_MAP.md`, add a table column or appendix: slice # → GitHub issue → PR (empty until filled). |
| **4** | **List page polish** | `/srm` production feel | Empty/error/loading states; consistent filters (`kind`, `q`); mobile-friendly table or card fallback; primary actions use `--arscmp-primary`. |
| **5** | **Create partner wizard polish** | `/srm/new` | Step header (per design system); required-field validation messages; success path lands on 360; cancel/back safe. |
| **6** | **360 layout & navigation** | `/srm/[id]` IA | Sticky sub-nav or tabs: Profile · Contacts · Sites · Capabilities · Orders (if granted) · Compliance · Activity; no dead links. |
| **7** | **360 profile completeness** | Core supplier fields | All PRD “header” fields in snapshot editable with save/cancel; optimistic or refresh pattern documented; audit who changed what if pattern exists elsewhere. |
| **8** | **Contacts & offices CRUD** | Sub-entities | Full create/edit/delete for `SupplierContact` and `SupplierOffice` with grants (`edit`); confirm dialogs; server actions or API + revalidate. |
| **9** | **Capabilities matrix UX** | `SupplierServiceCapability` | Clear add/remove/edit; validation against taxonomy if present; empty state with CTA. |
| **10** | **API guard pass (read)** | Hardening | Every SRM list/detail JSON route checks tenant + `org.suppliers` **view**; add or extend tests for 403/404. |

---

## Phase B — Lifecycle & onboarding (slices 11–15)

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **11** | **Approval / status transitions** | Explicit state machine | Document allowed `approvalStatus` transitions; enforce on server; UI only offers valid next states; tests for illegal transitions. |
| **12** | **Activation guard** | Align with PO/booking usage | If `isActive` or approval blocks usage, surface message in UI and enforce in supplier-linked APIs (minimal scope—document which APIs). |
| **13** | **Onboarding task list v1** | Lifecycle spec foothold | New model **or** reuse existing task table: supplier-scoped checklist rows (e.g. profile, tax, insurance); % complete on 360. |
| **14** | **Onboarding task assignee & due** | Operator workflow | Optional owner + due date; filter “my tasks”; grant: only editors mutate. |
| **15** | **Notifications hook (optional)** | Future-ready | If product has in-app notifications pattern, emit one event on “supplier submitted” / “approved”; else stub `TODO` + doc flag **deferred** with issue link. |

---

## Phase C — Compliance & documents (slices 16–20)

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **16** | **Document schema v1** | Persist metadata | Prisma: supplier document type, status, `expiresAt`, storage key/URL, uploadedBy; migration + rollback note. |
| **17** | **Document list & upload** | Vault v1 UI | 360 “Compliance” tab: list + upload (Vercel Blob or existing pattern); view/download; tenant-scoped. |
| **18** | **Expiry signals** | Control tower or badge | Expiring soon / expired badges on list or 360; optional cron or query-time only—document choice. |
| **19** | **Compliance read-only mode** | Grants | Role without `edit` sees documents but cannot upload/delete; tests. |
| **20** | **Document audit trail** | Trust | Append-only log or `createdAt`/`updatedAt` + actor on row; show last change in UI. |

---

## Phase D — Performance, risk & KPI (slices 21–24)

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **21** | **KPI data: spend / volume by supplier** | Aggregates | One SQL/Prisma aggregate (PO or booking-linked) scoped to tenant; documented assumptions. |
| **22** | **KPI dashboard route** | `/srm/analytics` or tab | Single page with 1–2 charts/tables + date range; respects `org.suppliers` view. |
| **23** | **Concentration / top-N risk** | Simple risk signal | Table: % of spend or order count in top 3 suppliers; copy explains limitation (MVP). |
| **24** | **SLA / booking SLA widget** | Uses existing fields | Surface `bookingConfirmationSlaHours` (or related) vs actuals if data exists; else **placeholder with real data hook** + GAP_MAP ⏸ note. |

---

## Phase E — Integration pack (slices 25–28)

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **25** | **Inbound payload: supplier upsert v1** | Versioned JSON | `POST` route under `src/app/api/…/srm` or suppliers: body schema, `Idempotency-Key` or natural key; maps to `Supplier`. |
| **26** | **Inbound tests** | Contract | Vitest: happy path, duplicate idempotency, invalid tenant, validation errors; no secrets in fixtures. |
| **27** | **Outbound export (optional)** | CSV or JSON | If timeboxed: `/api/.../srm/suppliers/export` filtered list for integrations; else mark slice **skipped** in tracker with reason. |
| **28** | **Integration docs** | Operator-facing | `docs/srm/INTEGRATION.md`: auth, rate limits, example curl, error envelope. |

---

## Phase F — Closeout (slices 29–30)

| # | Slice | Goal | Acceptance |
|---|--------|------|------------|
| **29** | **Seed & demo data** | Repeatable demo | `db:seed` or `db:seed:srm-demo` (idempotent): 3–5 suppliers with docs, tasks, varied approval states; documented in `docs/database-neon.md` if Neon-specific. |
| **30** | **GAP_MAP + module done** | Sign-off | Update `GAP_MAP.md` blueprint rows to **✅** or **⏸**; mark near-term build order complete; add “SRM MVP complete as of &lt;date&gt;” banner; archive open “finish” bullets in `agent-todos/srm.md` or point here only. |

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
