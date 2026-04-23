# SRM post-MVP program — **G, I, K** (current priority)

**Status:** This is a **new program** after the **30-slice MVP** (Phases A–F). It does **not** re-open slices 1–30; it tracks milestones for **Phase G** (operator lifecycle + notifications), **Phase I** (compliance / document control beyond vault v1), and **Phase K** (field-level and enterprise polish).

### G-v1 (landed)

- **Stage rule:** when **all** `SupplierOnboardingTask` rows for a supplier are `done`, and `srmOnboardingStage` is not already `cleared`, the server sets **`cleared`** (`maybeAutoClearSrmOnboardingStage` + `PATCH` onboarding task response `supplierOnboarding`). UI copy on the Onboarding tab explains the behavior; parent state updates from the response.
- **Notifications:** `GET /api/srm/notifications?unread=1` filters to unread; **POST** `{ markAllRead: true }` marks all for the current user; notifications page: **Unread only** toggle, **Mark all as read** (primary CTA). List JSON includes **`actorUserId`** and **`actorName`** (when the assigner / actor is linked); the page shows **From …** with the assigner's display name when available.
- **Optional email mirror (G follow-up):** set `SRM_OPERATOR_EMAIL_NOTIFICATIONS=1` plus existing Resend vars (`RESEND_API_KEY`, and `SRM_EMAIL_FROM` or `CONTROL_TOWER_REPORTS_EMAIL_FROM`) to send a plain-text email to the notification recipient when an in-app row is created (e.g. onboarding assignee). Off by default; in-app rows remain the source of truth.
- **Optional outbound webhook (G follow-up):** set `SRM_OPERATOR_WEBHOOK_URL` to a valid `http`/`https` URL to `POST` JSON (`specVersion: 1`, `event: srm.operator_notification.created`, `notification: { id, tenantId, …, actorUserId, actorName, … }`). `actorName` is the assigner’s display name when resolvable, else `null`. Optional `SRM_OPERATOR_WEBHOOK_SECRET` is sent as `X-SRM-Webhook-Secret`. Off by default; in-app rows remain the source of truth.
- **Not in G-v1 until follow-ups above:** no automation beyond the stage rule + these opt-in channels; no inbound webhooks, custom multi-step automation, or “notification bus” product.

### I-v1 (landed)

- **Audit-friendly manifest export:** `GET /api/suppliers/[id]/srm-documents?format=csv` returns **metadata only** (same filters as the JSON list, e.g. `includeArchived=1` when the operator checks **Include archived** on the Compliance tab). The CSV does **not** include `fileUrl` (safer to share in audits and tickets). The response is UTF-8 with a **BOM** so Excel and similar tools open encoding predictably. Columns include uploader/last editor **emails and display names**. The Compliance tab exposes **Download manifest (CSV)**.
- **Not in I-v1:** new Prisma document columns, DMS state machine, retention, approval routing.

### K-v1 (landed)

- **Policy:** `org.suppliers` → **view** is **not** enough for **procurement-sensitive** values; **edit** or **approve** is required to see them (unchanged from MVP hook).
- **Redaction (server + initial 360):** in addition to prior fields (tax / credit / internal notes / contact free-text `notes`), view-only users now get **no values** for: `legalName`, company **email** & **phone**, full **registered address**, **payment** and **Incoterm** and **booking SLA** fields, **contact email** & **phone**, **office** location fields on `GET` (full address; snapshot only had city/country, now cleared), **capability** `geography` and `notes`. `GET /api/suppliers/[id]` and `redactSupplierDetailSnapshot` stay aligned.
- **UI:** 360 & SRM read-only callouts (amber) for hidden blocks; **Capabilities** table masks geography/notes with an explanatory line.
- **Field list in code** — `src/lib/srm/redact-supplier-sensitive.ts` (keep in sync when adding sensitive columns).
- **Onboarding tasks API:** `GET /api/suppliers/[id]/onboarding-tasks` redacts per-task `notes` and assignee `email` for view-only (same **edit/approve** bar as 360). UI disables checklist controls when the user only has view.
- **Supplier list & export:** `GET /api/suppliers` and `GET` integration **supplier export** (JSON/CSV) apply the same top-level field redaction for view-only. SRM list search does not match on **email** without edit/approve; legacy `/suppliers` list hides contact and terms columns unless sensitive access.
- **Grant helpers (implementation):** `canViewSupplierSensitiveFieldsForGrantSet` (sync, given a grant set) and `getCanViewSupplierSensitiveFieldsForActor` (async, current API actor) in `src/lib/srm/permissions.ts`. Use the async helper in supplier **read** handlers after the view gate, or the sync one when you already have grants (e.g. server components using `getViewerGrantSet`).
- **Not in K-v1:** per-role field matrix, SRM settings table, or rules engine (see table below).

**Non-goals for this program (unless you re-prioritize):** **H** (supplier self-service portal), **J** (KPI/FX/ERP integration depth) — see [`SRM_FINISH_SLICES.md`](./SRM_FINISH_SLICES.md) Post-MVP.

---

## Can we “handle” G, I, and K?

**Yes — as a sequence of shippable milestones**, not as a single “finish everything in the PDFs” release. The repo already has foundations (see table below). What remains is **product depth**: rules, routing, more UI, and (for G) optional **email/integrations** that need infra decisions.

| Phase | Already in repo (baseline) | Typical “v1” milestone (example — refine in issues) | Still heavy / v2+ |
|-------|----------------------------|--------------------------------------------------------|-------------------|
| **G** | `srmOnboardingStage` on `Supplier`, Onboarding tab UI, `SrmOperatorNotification`, `/srm/notifications`, assignee change → notification; optional **outbound** email + webhook (env) | **G-v1 + follow-ups:** stage rule + notification UX; optional **email** + **outbound JSON webhook** (opt-in) | Full lifecycle PDF, complex automation bus, **inbound** webhooks to app |
| **I** | `revisionGroupId` / `revisionNumber` / `supersedesDocumentId`, new-version upload path, matrix-by-family in Compliance, audit log with supersede | **I-v1:** document **state machine** (e.g. draft/review/approved) if product wants it, **retention** flags, export bundle; **approval routing** as separate epic | Full enterprise DMS, legal hold, e-sign |
| **K** | `canViewSupplierSensitiveFields` (view + needs edit/approve for sensitive), `redactSupplierDetailSnapshot` on API + 360, read-only callouts | **K-v1:** expand **sensitive** field set + list in docs; optional **per-role** field map in `org` grants or a small SRM **settings** table | Full PDF permission matrix, pixel wireframe parity, **rules engine** (explicitly out of scope in finish doc until an epic) |

**Dependency note:** If Phase **I** adds **new sensitive fields**, implement or extend **K** redaction for those fields **in the same or preceding milestone** so view-only users never see them.

**Suggested execution order (matches stated priority G → I → K):** ship **G-v1** first (operator experience + notification behavior), then **I-v1** (compliance depth), then deepen **K** (matrix / field policy). Revisit order if a compliance project **must** add sensitive columns before G is done.

---

## How to run the program

1. **One GitHub issue per milestone** (e.g. `srm(phase-g): v1 — stage rules + notification UX`).
2. **Update [`GAP_MAP.md`](./GAP_MAP.md)** blueprint rows (🟡 → ✅ for themes you accept as “met for v1”) and/or add a small **“Post-MVP (G/I/K)”** table when a milestone lands.
3. **Quality bar:** `npm run lint`, `npx tsc --noEmit`, and scoped Vitest for any new API paths (same as MVP slices).

---

## Explicit boundaries (from product strategy)

- **G:** Operator-side only; **no** supplier portal (that is **H**).
- **I:** “Vault v2” in increments; full legal/DMS parity is a **multi-release** track.
- **K:** A **full** field-level matrix for every column in the PDF is **K-v2+**; **K-v1** is “no leaks + clear policy for sensitive data.”
- **Rules engine** and **pixel-perfect wireframes** stay **separate epics** unless you scope a narrow automatable subset.

---

_Roadmap for coordination; dates and issue links belong in your tracker when you file work._
