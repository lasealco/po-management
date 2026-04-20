# ICP, tenancy, and hierarchy (working notes)

This document captures **who we want to sell to** and how that maps to **today’s product** vs **future work**. Use it as a checklist for roadmap and engineering todos—not as a promise of current capability.

## Target customer profiles

### (a) Global enterprises (single legal entity or family of companies)

**Need:** Internal hierarchy (HQ, regional HQ, business units, sites) with **scoped visibility**, **roll-up reporting**, and often **segregation of duties** across nodes.

**Implication:** “Company” is not always a flat tenant. Users may act **in context of** a branch or region; reporting may need **aggregation across** org nodes.

### (b) Global forwarder / 3PL

**Need:** **Internal** hierarchy (same as (a) in spirit) **plus** many **customers** (shippers / BCOs), each with their own org tree, **data isolation** between customers, and **customer-facing** experiences (portals, limited roles).

**Implication:** One operating company (the 3PL) serves many **external orgs**. Operational data (shipments, billing, warehouse activity) must be tie-able to **customer** as well as to **internal** org.

## What the product does today (baseline)

- **Tenant model:** A `Tenant` is a **single isolation boundary**. Nearly all operational and master data is keyed by `tenantId`. There is **no** parent/child tenant tree or first-class **org unit** entity at the tenant level.
- **Users:** Each `User` belongs to **exactly one** `tenantId`. Roles and `RolePermission` grants are **global within that tenant** (e.g. `org.orders`, `org.settings`, …).
- **CRM:** `CrmAccount` supports **parent/child account hierarchy** (`parentAccountId`) **within** a tenant—good for **commercial** org charts, not by itself full operational scoping for every module.
- **3PL-oriented hint:** `User.customerCrmAccountId` scopes **Control Tower** lists/detail to shipments linked to that CRM account when set—an early **customer scope** lever, not yet a platform-wide “customer tenant.”

## Gap summary (honest)

| Theme | Today | Needed for (a) / (b) |
|--------|--------|----------------------|
| Enterprise org tree | Flat tenant | Org unit / legal entity model **or** explicit multi-tenant + federation story |
| Permissions | Flat grants per tenant | Scoped grants and/or inheritance by org node / customer |
| 3PL customer isolation | Partial (CRM tree; CT user scope) | Consistent **customer dimension** on ops entities + portal roles |
| Reporting / cockpit | Aggregates by `tenantId` | Scoped and roll-up queries by org / customer when models exist |

## System tenancy representation decision

**Decision (Wave 3):** use a **single tenant as the hard isolation boundary** and add **org units inside the tenant** for hierarchy and scoped access.

**Why this decision:**

- Preserves today's proven `tenantId` isolation model and avoids high-risk cross-tenant joins for core operations.
- Matches current user/account assumptions (`User.tenantId` = one tenant membership) while enabling HQ/region/country/site hierarchy.
- Supports both ICP segments: enterprise internal hierarchy and 3PL customer scoping, without turning each customer into a separate tenant.
- Keeps migration path incremental: introduce scoped models first, then evolve per-module visibility/reporting.

**Non-goals in this phase:**

- No parent/child tenant federation model.
- No per-customer tenant split as the default architecture.
- No claim that scoped org RBAC is already shipped; this remains roadmap implementation.

**Target model shape (design intent):**

- `Tenant` remains the top-level isolation container.
- `OrgUnit` tree (within tenant) models internal hierarchy.
- Membership and grants become scope-aware (user assignment to org subtree + permission checks on assigner scope).
- Operational entities add optional org/customer dimensions as required by module rollout.

## Scoped admin and delegation (“cannot give what you don’t have”)

For **global → regional → country** (and similar) admin patterns, product intent is:

1. **Org hierarchy** (HQ → region → country → site, …) defines **where** an admin is responsible (**scope**).
2. **Roles / permissions** still define **what** actions exist (`org.settings` edit, `org.orders` view, …).
3. **Delegation rule:** when user A assigns a role or permission set to user B, the system must enforce:
   - **Subset of permissions:** B’s new grants must be **⊆** A’s **effective** grants (no privilege escalation through the admin UI).
   - **Subset of scope (when org units exist):** B’s org scope must sit **inside** A’s org scope (B cannot administer a branch outside A’s subtree unless a separate break-glass platform role exists).

**Baby-language summary:** *What I don’t have, I cannot hand to someone else* — correct, and it must be **enforced server-side** on every role/user change, not only hidden in the UI.

**Implementation note:** today’s flat `RolePermission` per tenant does not encode org scope or assigner checks; adding hierarchy implies new tables **and** validators on invitation / role-assignment APIs.

## Engineering todos (backlog—prioritize with product)

- [ ] **Decide representation:** org units inside one tenant vs multiple tenants vs hybrid; document the choice.
- [ ] **(a) Enterprise hierarchy:** model (e.g. `OrgUnit`, `UserOrgUnit`, entity→org links); admin UI; migration story for existing tenants.
- [ ] **(a) Scoped permissions:** extend RBAC (resource/action + scope) or equivalent; audit all `tenantId` queries.
- [ ] **(a) Delegation guardrails:** on role assignment / user invite APIs, enforce **subset-of-assigner’s-effective-grants** + **scope contained in assigner’s org subtree** (once `OrgUnit` exists); document break-glass roles (e.g. platform super-admin only).
- [ ] **(b) Customer as scope:** standardize `customerAccountId` (or shipper org id) on shipments, billing, WMS where needed; align with CRM account.
- [ ] **(b) Portals:** customer users, invitation flow, least-privilege roles; extend visibility rules beyond Control Tower.
- [ ] **Reporting:** cockpit and reports respect **active scope** (tenant + org + customer) once scopes exist.
- [ ] **Investor / GTM:** keep slide language aligned with this doc—**MVP = single tenant / single company**; hierarchy = **roadmap**, not implied shipped.

## Related code (for implementers)

- Prisma: `Tenant`, `User` (`tenantId`, `customerCrmAccountId`), `CrmAccount` (`parentAccountId`).
- Permissions: `src/lib/permission-catalog.ts`, `src/lib/authz.ts`, `Role` / `RolePermission` in `prisma/schema.prisma`.
- **Modular SaaS / shop / bundles:** `docs/modular-product-and-crm-strategy.md` (entitlements + Stripe-shaped plan).

## Changelog

- **2026-04-20:** Chose tenancy representation for system scope: keep **single tenant isolation** and model hierarchy with **in-tenant org units**; documented rationale and non-goals.
- **2026-04-18:** Added **scoped admin / delegation subset rule** (cannot grant permissions or scope you don’t hold) and matching engineering todo.
- **2026-04-16:** Initial write-up from architecture discussion (ICP (a)/(b) vs current tenancy).
