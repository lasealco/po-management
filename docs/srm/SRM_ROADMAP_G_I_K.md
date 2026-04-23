# SRM post-MVP program — **G, I, K** (current priority)

**Status:** This is a **new program** after the **30-slice MVP** (Phases A–F). It does **not** re-open slices 1–30; it tracks milestones for **Phase G** (operator lifecycle + notifications), **Phase I** (compliance / document control beyond vault v1), and **Phase K** (field-level and enterprise polish).

**Non-goals for this program (unless you re-prioritize):** **H** (supplier self-service portal), **J** (KPI/FX/ERP integration depth) — see [`SRM_FINISH_SLICES.md`](./SRM_FINISH_SLICES.md) Post-MVP.

---

## Can we “handle” G, I, and K?

**Yes — as a sequence of shippable milestones**, not as a single “finish everything in the PDFs” release. The repo already has foundations (see table below). What remains is **product depth**: rules, routing, more UI, and (for G) optional **email/integrations** that need infra decisions.

| Phase | Already in repo (baseline) | Typical “v1” milestone (example — refine in issues) | Still heavy / v2+ |
|-------|----------------------------|--------------------------------------------------------|-------------------|
| **G** | `srmOnboardingStage` on `Supplier`, Onboarding tab UI, `SrmOperatorNotification`, `/srm/notifications`, assignee change → notification, webhook/email **not** wired | **G-v1:** define stage **rules** (e.g. auto-advance, blockers), notification **read/dismiss** polish, filter/snooze; optional **email** behind env + provider | Full lifecycle PDF, complex automation bus |
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
