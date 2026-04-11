# Modular product strategy: PO, WMS, 3PL CRM

This note answers: *Should the upcoming 3PL CRM live in this repo or in a separate project, given we want to sell the **full platform** or **PO-only**, **CRM-only**, **WMS-only**, etc.?*

## Goals (what “good” looks like)

- **Commercial flexibility**: enable/disable modules per customer (or per org) without maintaining unrelated codebases forever.
- **Operational simplicity**: one auth model, one deployment pipeline, one database story where shared concepts (orgs, users, tenants, audit) stay consistent.
- **Velocity**: shipping CRM alongside PO/WMS without duplicating primitives (permissions, API style, UI shell, Prisma patterns).

## Option A — One application (this repo), modules as product slices

**Shape**: Single Next.js app, single Postgres database, **entitlements** (feature flags / `org` capabilities) gate routes, APIs, and nav — similar to how WMS can be permission-scoped today.

**Pros**

- One deploy, one schema migration story, shared **org / user / RBAC** model.
- Cross-module workflows are natural (e.g. PO → shipment → warehouse → CRM account) without distributed transactions or duplicate entities.
- Easier to offer **bundles** (PO + WMS + CRM) and evolve pricing as columns/flags, not as cross-repo version matrices.

**Cons**

- Repo and bundle size grow; discipline is required (clear **bounded contexts** in `src/`, Prisma domains, API namespaces like `/api/crm/...`).
- “CRM-only” customers still ship a larger artifact unless you add **build-time or runtime tree-shaking** of nav/routes (usually acceptable on Vercel if unused code is dead enough).

**When it is the right default**

- You expect **shared customers**, **shared identity**, and **shared data** between modules within one org — which is typical for 3PL + shipper platforms.

## Option B — Separate CRM application (own repo / own deploy)

**Shape**: Second Next.js (or other) service, optional **shared** auth (SSO) and either a **shared DB** (tight coupling) or **sync/API** (looser coupling).

**Pros**

- Independent release cadence and team ownership.
- CRM-only customers get a **minimal surface** artifact (smaller app, fewer dependencies).

**Cons**

- **Duplication tax**: auth UX, design system, API conventions, background jobs, observability, unless you invest in **shared packages** (`@company/ui`, `@company/auth`, etc.) — which reintroduces monorepo complexity anyway.
- **Data split pain**: 3PL CRM naturally touches orders, shipments, contacts, and warehouse events; two apps + two DBs means integration work, consistency bugs, and harder reporting.

**When it makes sense**

- CRM is sold to a **completely different buyer** with **no shared org model**, or regulatory boundaries **require** hard isolation.
- A separate team needs **fully independent** release cycles and you accept the integration cost.

## Recommendation for this product

**Default: build the 3PL CRM inside this project as a module** (Option A), with:

1. **Explicit product entitlements** per org (e.g. `org.modules` or capability flags: `po`, `wms`, `crm_3pl`, …) driving:
   - middleware / route access,
   - API guards,
   - navigation and command palette entries.
2. **Clear code boundaries**: `src/app/(crm)/…`, `src/lib/crm/…`, `prisma` models grouped or prefixed so the domain does not blur into PO/WMS by accident.
3. **One database**, single migration stream — avoids split-brain between “CRM orders” and “PO orders.”
4. **Optional later extraction**: if CRM-only SKU becomes huge, **extract** into a separate deploy **after** boundaries and shared packages are proven — not before.

**Avoid** starting a second full app unless you have a hard constraint (compliance, separate team with separate SLA) that outweighs integration cost.

## Packaging “PO only” / “CRM only” / “WMS only”

Technical packaging options (can be combined):

| Approach | What it does |
|----------|----------------|
| **Entitlements (runtime)** | Same binary; disabled modules hidden and APIs return 403. Simplest operationally. |
| **Environment / plan flags** | `ENABLED_MODULES=po,wms` in Vercel env per project or per customer deployment. |
| **Separate Vercel projects** | Same repo, different **root env** pointing at different DBs or same DB with different default org — still one codebase. |
| **Monorepo packages** (future) | `apps/web` + `packages/crm-core` if the repo outgrows a flat structure — extraction without splitting auth/DB. |

For **true air-gapped** CRM-only with zero PO/WMS code paths, separate deploy is cleaner — but that is a **commercial packaging** choice, not a requirement to **author** CRM in another repository on day one.

## Summary

- **Author CRM in this codebase** behind entitlements and clear module boundaries.
- **Sell slices** via flags and UI/API gating; split deploys only when a customer or compliance story **requires** a physically smaller or isolated surface.
- **Revisit a second app** only when integration pain of staying together exceeds the cost of shared packages + APIs — usually later, not at CRM v1.

---

*Document created for internal planning; update as product packaging and compliance requirements evolve.*
