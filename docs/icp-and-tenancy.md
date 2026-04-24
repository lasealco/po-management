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
- **Users:** Each `User` belongs to **exactly one** `tenantId`. Roles and `RolePermission` grants are **global within that tenant** (e.g. `org.orders`, `org.settings`, …). For a concise summary of the permission model, demo **Superuser** sign-in, and what is **still roadmap** (org-scoped RBAC, delegation), see [`docs/engineering/USER_ROLES_AND_RBAC.md`](./engineering/USER_ROLES_AND_RBAC.md).
- **CRM:** `CrmAccount` supports **parent/child account hierarchy** (`parentAccountId`) **within** a tenant—good for **commercial** org charts, not by itself full operational scoping for every module.
- **3PL-oriented hint:** `User.customerCrmAccountId` scopes **Control Tower** lists/detail to shipments linked to that CRM account when set—an early **customer scope** lever, not yet a platform-wide “customer tenant.”

## Gap summary (honest)

| Theme | Today | Needed for (a) / (b) |
|--------|--------|----------------------|
| Enterprise org tree | **In progress:** in-tenant `OrgUnit` tree + user primary org + `ProductDivision` matrix (Settings UI) | Scoped **data** filters & roll-up reporting still roadmap |
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

**Implementation note:** today’s flat `RolePermission` per tenant does not encode org scope in the table shape; org placement, read filters, and assignment validators are layered in application code; a **policy engine** (Phase 4, product) would formalize that.

## Path toward scoped RBAC (pragmatic)

1. **Now shipped:** `tenantId` + flat `RolePermission` + **user org** + **product divisions**; **read filters** in `src/lib/org-scope.ts` and **delegation** in `src/lib/delegation-guard.ts`.
2. **In progress, module by module:** same org/division read rules on **Control Tower** (workbench, hub, ops/reports summaries, digest, `runControlTowerReport`, product trace) by scoping on the shipment’s **linked purchase order** (requester + line divisions).
3. **Later (product call):** **policies** as a formal **policy engine** (conditions, effects, evaluation) rather than only code paths.

## Engineering todos (backlog—prioritize with product)

- [x] **Decide representation:** in-tenant `OrgUnit` tree; single-tenant hard boundary; see **System tenancy representation** above.
- [x] **(a) Enterprise hierarchy (v1):** `OrgUnit` + `User.primaryOrgUnitId` + `UserProductDivision` + Settings UI; entity→org links and roll-up reporting are incremental.
- [ ] **(a) Scoped permissions / policy layer:** extend RBAC or add a policy engine; audit remaining `tenantId`-only queries (CRM, WMS, other CT surfaces, etc.).
- [x] **(a) Delegation guardrails:** on `POST`/`PATCH` users and role permission updates, enforce **subset-of-assigner’s-effective-grants** + **org / product-division scope**; **Superuser** role/permission edits are **superuser-only**; document break-glass roles (e.g. platform super-admin only).
- [ ] **(b) Customer as scope:** standardize `customerAccountId` (or shipper org id) on shipments, billing, WMS where needed; align with CRM account.
- [ ] **(b) Portals:** customer users, invitation flow, least-privilege roles; extend visibility rules beyond Control Tower.
- [ ] **Reporting:** remaining hubs respect **active scope** (PO-based reports and CT **shipment** reports use org scope; widen to other datasets as modeled).
- [ ] **Investor / GTM:** keep slide language aligned with this doc—**MVP = single tenant / single company**; hierarchy = **roadmap**, not implied shipped.

## Related code (for implementers)

- Prisma: `Tenant`, `User` (`tenantId`, `primaryOrgUnitId`, `customerCrmAccountId`), `OrgUnit`, `UserProductDivision`, `CrmAccount` (`parentAccountId`).
- Permissions: `src/lib/permission-catalog.ts`, `src/lib/authz.ts`, `Role` / `RolePermission` in `prisma/schema.prisma`.
- **Modular SaaS / shop / bundles:** `docs/modular-product-and-crm-strategy.md` (entitlements + Stripe-shaped plan).

## Changelog

- **2026-04-25:** **Control Tower + product trace (org read scope):** internal users with primary org and/or product divisions see only **shipments** whose linked **PO** passes the same rules as the PO workbench; hub overview, workbench list, map pins, search, digest, report runs, ops/reports summaries, and `getProductTracePayload` use `controlTowerShipmentAccessWhere` / merged PO `where`. Superusers and supplier portal bypass unchanged; **Phase 4 policy engine** remains a separate product track.
- **2026-04-23:** **Phase 3:** **delegation guardrails** on user create/update and role `PUT` permissions: assigner must hold every permission on the roles they assign, **or** be a **Superuser**; primary org and product-division links must stay within the assigner’s scope; non-superusers cannot assign the **Superuser** role or edit that role’s permission rows. Clearing another user’s primary org is disallowed for admins who themselves have a primary org.
- **2026-04-25:** **Phase 2 (partial):** org/division **read scope** on **purchase orders** (lists, detail, transitions, messages, control-tower order picker, consolidation shipment list) and order-based **reports**; uses requester’s primary org subtree + optional product-division line match. Superusers and supplier-portal views bypass internal org filter. Other modules (CRM, WMS, etc.) not yet org-scoped.
- **2026-04-24:** Shipped **Phase 1** of in-tenant org: `OrgUnit` tree, user **primary org** + **product division** matrix in Settings; permissions remain tenant-wide; enforcement in ops modules TBD.
- **2026-04-20:** Chose tenancy representation for system scope: keep **single tenant isolation** and model hierarchy with **in-tenant org units**; documented rationale and non-goals.
- **2026-04-18:** Added **scoped admin / delegation subset rule** (cannot grant permissions or scope you don’t hold) and matching engineering todo.
- **2026-04-16:** Initial write-up from architecture discussion (ICP (a)/(b) vs current tenancy).
