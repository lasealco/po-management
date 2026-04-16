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

## Engineering todos (backlog—prioritize with product)

- [ ] **Decide representation:** org units inside one tenant vs multiple tenants vs hybrid; document the choice.
- [ ] **(a) Enterprise hierarchy:** model (e.g. `OrgUnit`, `UserOrgUnit`, entity→org links); admin UI; migration story for existing tenants.
- [ ] **(a) Scoped permissions:** extend RBAC (resource/action + scope) or equivalent; audit all `tenantId` queries.
- [ ] **(b) Customer as scope:** standardize `customerAccountId` (or shipper org id) on shipments, billing, WMS where needed; align with CRM account.
- [ ] **(b) Portals:** customer users, invitation flow, least-privilege roles; extend visibility rules beyond Control Tower.
- [ ] **Reporting:** cockpit and reports respect **active scope** (tenant + org + customer) once scopes exist.
- [ ] **Investor / GTM:** keep slide language aligned with this doc—**MVP = single tenant / single company**; hierarchy = **roadmap**, not implied shipped.

## Related code (for implementers)

- Prisma: `Tenant`, `User` (`tenantId`, `customerCrmAccountId`), `CrmAccount` (`parentAccountId`).
- Permissions: `src/lib/permission-catalog.ts`, `src/lib/authz.ts`, `Role` / `RolePermission` in `prisma/schema.prisma`.

## Changelog

- **2026-04-16:** Initial write-up from architecture discussion (ICP (a)/(b) vs current tenancy).
