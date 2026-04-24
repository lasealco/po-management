# Organization dimensions, operating roles, and phased delivery

This document describes a **multi-dimensional** model for enterprise structure and procurement, aligned with use cases such as **centralized procurement** (headquarters buying **for** a subsidiary) and **global vs. regional** supply chain visibility. It complements [`icp-and-tenancy.md`](./icp-and-tenancy.md) and the implementation inventory in [`engineering/READ_SCOPE_INVENTORY.md`](./engineering/READ_SCOPE_INVENTORY.md).

**Status:** *Design and delivery plan* — not a committed implementation checklist for a single release. Prioritize with product and adjust phases after discovery.

---

## 1. Problem statement

A single org tree, used alone, cannot express all real-world needs:

- **Where a user “sits”** in the company (home organization, for access and community).
- **Whose budget or legal shell** a purchase or shipment serves (**on whose behalf** the transaction runs) — often different from the buyer’s home org in **centralized procurement**.
- **What** category or product line applies (product / commercial **matrix**).
- **What application permissions** the user has (RBAC), independent of “this node is regional HQ in the business model.”

Conflating these into one field (for example, only `User.primaryOrgUnitId`) leads to either incorrect visibility or contrived master data (duplicated users, fake org placement).

**Design goal:** work in **named dimensions**, wire them in **increments**, and keep **read scope** and **workflows** explicit and testable per module.

---

## 2. Conceptual model: dimensions (summary)

| Dimension | Question it answers | Typical carriers (target shape) | Notes |
|-----------|----------------------|----------------------------------|--------|
| **A. Isolation** | Which account owns all data? | `Tenant` | Unchanged: single hard boundary per environment. |
| **B. Structure** | Where does an entity **sit** (legal, geographic, site hierarchy)? | `OrgUnit` tree (`kind`, parent/child) | Already in product (Settings → Org & sites). Uniquely codes nodes per tenant. |
| **C. Operating / functional role** | **What part of the model** is this node (regional HQ, plant, shared service center, …)? | Flags, **tags**, or a controlled vocabulary on `OrgUnit` (not the same as app RBAC) | *Roadmap* — does not replace `kind` but refines it for **process and routing** (e.g. “this region **runs** procurement for children”). |
| **D. Product / category matrix** | **What** is bought or sold? | `ProductDivision` + `UserProductDivision` (and line-level product) | In use; intersects with org for scoping. |
| **E. Document / transaction context** | **For which org or legal** is this PO, requisition, or SO? | Optional FKs on `PurchaseOrder`, `SalesOrder`, etc. | *Roadmap* — the missing piece for **“HQ orders for entity X”** when the requester is **not** in node X. |
| **F. App permissions** | **Who** may do **what** (`org.orders` edit, …)? | `Role` + `RolePermission` | [`USER_ROLES_AND_RBAC.md`](./engineering/USER_ROLES_AND_RBAC.md); distinct from (C). |
| **G. Read scope (today)** | What rows can this **user** list or open? | Composed: org subtree + product divisions + optional customer CRM; requester/owner-based for PO/CRM | `src/lib/org-scope.ts`, `src/lib/crm-scope.ts` — see §3. |
| **H. Contracting (tariff vertical)** | **Our** legal for **pricing** contracts? | `TariffLegalEntity` (DB `legal_entities`) | Coexistence / alignment with (B) and (E) is a **data governance** product decision. |

**Principle:** (B) and (C) describe **master data**; (E) describes **operational fact** on each document; (F) and (G) describe **access** — do not use one to silently mean the others.

---

## 3. Current implementation baseline (honest)

The following is accurate for the codebase at the time of this writing; re-verify in schema and `org-scope` / `crm-scope` as you ship.

- **Tenant** is the top isolation level; `OrgUnit` is an in-tenant **hierarchy** with kinds such as `GROUP`, `LEGAL_ENTITY`, `REGION`, `COUNTRY`, `SITE`, `OFFICE`.
- **Users** can have `primaryOrgUnitId` and links to **product divisions**; permissions remain **tenant-wide** grants, with **read** scoping in application code for many modules.
- **Purchase order visibility** (non–superuser, non–supplier-portal) filters largely by the **order requester’s** `primaryOrgUnitId` within the **viewer’s** org **subtree**, with a **lenient** match for requesters with no org yet. Product-division scoping can further restrict by **line** product. See `getPurchaseOrderScopeWhere` in `src/lib/org-scope.ts`.
- **CRM** visibility follows **account owner** (`User`) with analogous org/division leniency — `src/lib/crm-scope.ts`.
- **Control Tower** shipment reads combine portal/customer context with the same PO-linked org/division idea where implemented — `controlTowerShipmentAccessWhere` in `src/lib/control-tower/viewer.ts`.
- **PO/SO headers** do not yet require a first-class “**served** / **ordering** org” separate from the requester; **centralized procurement** (“buy for entity X”) is therefore **not fully modeled** in the document layer until (E) exists.

This baseline is **compatible** with a phased add-on: introduce **(E)**, then evolve **(G)** with explicit product rules, without removing the tenant model.

---

## 4. Design guardrails (non-negotiables for later phases)

1. **Server-side enforcement** — any scope that protects data must be applied in **APIs and jobs**, not only in the UI.
2. **Backwards compatibility** — existing tenants without new fields should keep working (nullable FKs, lenient rules until migration).
3. **One vocabulary for “org role”** — if (C) is added, use a **small controlled set** (enum or tag table) to avoid unbounded string chaos.
4. **Delegation** — when admins assign users to orgs or roles, **subset-of-scope** rules (see `icp-and-tenancy.md`, `delegation-guard`) must still hold.
5. **Unify with tariff / legal** deliberately — if `TariffLegalEntity` and `OrgUnit` (LEGAL_ENTITY) should converge, do it as a **governed** migration, not ad hoc duplicate entry.

---

## 5. Phased delivery plan

Phases are **ordered**; some work can **overlap** in later steps once foundations exist. Each phase should end with **testable** behavior and, where possible, a **short release note** for operators.

### Phase 1 — Foundation: language, governance, and optional org “operating” metadata

**Status:** **Shipped** (see `OrgUnitOperatingRole` enum, `org_unit_role_assignments` table, Settings → Org & sites UI, `src/lib/org-unit-operating-roles.ts`).

**Objective:** Stabilize **(B)**, document **(C)** as a product list, and persist **(C)** without changing PO semantics yet.

**Outcomes (delivered)**

- Dimension glossary remains this document; **Org & sites** page copy explains **operating roles** vs. app sign-in / permissions.
- **V1 role catalog (fixed enum):** `REGIONAL_HQ`, `GROUP_PROCUREMENT`, `PLANT`, `DIST_CENTER`, `SALES_HUB`, `SHARED_SERVICE`, `R_AND_D`, `CORPORATE_FUNCTION`, `LOGISTICS_HUB` — extend only via new migrations + catalog updates.
- **Schema:** `OrgUnitRoleAssignment` rows (`org_unit_role_assignments`), one row per (org unit, role); API validates with `parseOperatingRolesInput` on create/update; **Settings UI** for add + edit + list column.
- **Read scope:** `getPurchaseOrderScopeWhere` is **unchanged** (no use of operating roles in filters in Phase 1).

**Risks:** Tag sprawl — mitigated by **enum** (not free text). Future: optional rules “role R only for `OrgUnitKind` K” are **not** enforced in v1 (product can add later).

**Exit criteria:** Met — (C) is persisted, documented, and admin-editable; (G) for POs unchanged.

---

### Phase 2 — Transaction context: “on behalf of” / served organization on documents

**Objective:** Introduce **(E)** for the highest-value object first (e.g. **PurchaseOrder**, then **SalesOrder** as needed).

**Outcomes**

- Nullable `servedOrgUnitId` (name indicative) or equivalent, plus optional future `billTo` / `legalEntity` alignment — **exact column names and FK targets** to be specified in a schema PRD.
- Create/edit APIs and UI: buyer selects **served** org when **creating** a PO (for users allowed to do so); validation: served org must be in tenant and, if rules require, under a subtree the buyer is allowed to buy for.
- **Reporting and exports** can group by **served** org, not only by requester.

**Dependencies:** Phase 1 recommended so **which nodes can be “served”** is clear (e.g. only `LEGAL_ENTITY` and below).

**Risks:** Double entry — mitigate with **defaults** (default served org from a template, copy from requisition) later.

**Exit criteria:** A centralized buyer can create a PO **for** entity X; the field is **persisted** and **auditable**.

---

### Phase 3 — Read scope: combine actor scope with document context

**Status:** **Shipped** (2026-04-24): `getPurchaseOrderScopeWhere` treats a PO as org-visible if the requester still matches the existing lenient requester rule **or** `servedOrgUnitId` is in the viewer’s org subtree; superusers and supplier portal unchanged. Consumers (CT shipments, reports, order APIs) use the same helper.

**Objective:** Evolve **(G)** so list/detail **reflect** the new dimension when present, without surprise data loss for legacy rows.

**Outcomes**

- **Documented rules** (e.g.): user sees a PO if current rules pass **or** the PO’s **served** org is in the viewer’s subtree, **or** the user is a **superuser** — **product must sign the matrix**.
- Update `getPurchaseOrderScopeWhere` and consumers (Control Tower, reports) per [`READ_SCOPE_INVENTORY.md`](./engineering/READ_SCOPE_INVENTORY.md).
- **Tests** for cross-org buyers, regional readers, and superusers.
- `read-scope-audit` script re-run; gaps closed for touched routes.

**Risks:** Over-broad access if OR rules are wrong — require **security review** and fixture tests.

**Exit criteria:** Aligned **visibility** for subsidiary vs. HQ use cases, with no regression for existing tenants under chosen lenient mode.

---

### Phase 4 — Workflows and policy hooks

**Status:** **Shipped (MVP)** (2026-04-24): buyer transition **`send_to_supplier`** (draft → sent) is gated when `servedOrgUnitId` is set: served org must lie under the actor’s **primary org** subtree; if served ≠ primary, the primary org must have **GROUP_PROCUREMENT** or **REGIONAL_HQ** in `org_unit_role_assignments`. **Superusers** bypass. `GET` order detail **hides** the action when policy fails. Implementation: `src/lib/po-served-org-workflow-policy.ts`, `POST /api/orders/:id/transition`, `GET /api/orders/:id`. Demo seed: **GROUP_PROCUREMENT** on org **US** (buyer) + draft **PO-1004** with **“order for”** `US-CHI-PL1` (Chicago plant).

**Objective:** Use **(C) + (E)** for **approvals, routing, and SOD** (e.g. “regional HQ approves up to N for sites in region”).

**Outcomes**

- Workflow or status rules can reference **served** org and **org role** tags.
- Optional: **delegation** updates so admins cannot assign “buy for” scope outside their branch. *(Primary-org delegation already uses subtree checks in `delegation-guard`; no change required for this MVP.)*

**Dependencies:** Phases 2–3 stable.

**Exit criteria:** At least one **end-to-end** path (e.g. PO creation → approval) respects **served** org + **operating** role in rules.

---

### Phase 5 — Convergence, reporting, and long-tail modules

**Status:** **Shipped (MVP)** (2026-04-24): **Executive** dashboard (`/executive`, `buildExecutiveSummary`) includes **Order-for org exposure (open PO)** — rows grouped by `servedOrgUnitId` (with **operating role tags** on the served org). **Report** `orders_by_served_org` lists open parent POs by served org + `OrgUnit` kind and tags. Same viewer PO scope as other reports via `purchaseOrderWhereWithViewerScope` & org inventory. **Tariff** ↔ **OrgUnit (LEGAL_ENTITY)** alignment: no new FK in this pass — **governance path** = optional future nullable `alignedOrgUnitId` (or a join table) on `legal_entities` toward an `OrgUnit` of `kind: LEGAL_ENTITY`, plus manual naming discipline until then.

**Objective:** **Dashboards and roll-ups** (executive, WMS, CT) use the same **dimensions**; **Tariff** `legal_entities` and **OrgUnit** `LEGAL_ENTITY` **alignment** decided and partially automated (link or sync rules).

**Outcomes**

- Reporting definitions updated to key off **served** org and org tags where product requires.
- Documented path for new modules: **use** `viewer-scopes` / org helpers per inventory.

**Exit criteria:** Stakeholder sign-off on **one** global dashboard slice using **(E)**.

---

### Phase 6 (optional) — “Acting in context” for global power users

**Status:** **Shipped (MVP)** (2026-04-24): `UserPreference` key `orders.defaultServedOrgUnit_v1` — JSON `{ "servedOrgUnitId": "…" }` per user; `updatedAt` is the audit surface. **GET/PUT** `/api/settings/served-order-default` (put requires `servedOrgUnitId: string | null` to set/clear, validates org in tenant; stale org ids are removed on read). **Create PO** and **Create SO** pre-fill the “order for” select when a default exists, show a **primary-colored banner** + **clear saved default**, and optional **checkbox** to persist the current selection for the next new order. Not a substitute for `servedOrgUnitId` on each document.

**Objective:** **Session** or **default** “**order for**” for users who work **many** entities daily (reduces clicks; not a substitute for (E) on the row).

**Outcomes**

- User preference or session `defaultServedOrgUnitId` (with audit).
- UI: clear **banner** of active context when creating orders.

**Risks:** Wrong-org orders — mitigate with **confirmation** and **defaults** from last selection.

**Exit criteria:** Usability tested with **centralized procurement** persona.

---

## 6. Open questions (to resolve in product/tech reviews)

- Should **served** org be required for all new POs, or optional in early rollout?
- How do **matrix organizations** (same site, two divisions) get **two** “hat” contexts?
- **Legal entity** on PO vs. **served** `OrgUnit` — one FK, or both with validation rules?
- **3PL** customers: does **(E)** for “our” side differ from `customerCrmAccountId` for the shipper — document clearly.

---

## 7. References

- [`docs/icp-and-tenancy.md`](./icp-and-tenancy.md) — tenancy, org tree decision, Phase 5–8 notes  
- [`docs/engineering/READ_SCOPE_INVENTORY.md`](./engineering/READ_SCOPE_INVENTORY.md) — scope helpers and audit  
- [`docs/engineering/USER_ROLES_AND_RBAC.md`](./engineering/USER_ROLES_AND_RBAC.md) — roles vs. read scope  
- `src/lib/org-scope.ts` — purchase order scope  
- `src/lib/crm-scope.ts` — CRM owner scope  
- `src/lib/control-tower/viewer.ts` — Control Tower composition  

---

*Document version: 1.5 (2026-04-24). Changelog: Phase 6 user default for “order for”; Phase 5 roll-ups; Phase 4 policy.*

### Changelog

| Date | Change |
|------|--------|
| 2026-04-24 | **Phase 6 (MVP) delivered:** `UserPreference` for default served org; `/api/settings/served-order-default`; create PO/SO pre-fill, banner, checkbox to save default, `updatedAt` audit on preference row. |
| 2026-04-24 | **Phase 5 (MVP) delivered:** Executive “order-for” open-PO table (served org + operating tags); report `orders_by_served_org`; seed **PLANT** on Chicago plant demo org; documented tariff legal ↔ `OrgUnit` alignment as a future optional FK, not in schema yet. |
| 2026-04-24 | **Phase 4 (MVP) delivered:** `assertSendToSupplierServedOrgPolicy` — `send_to_supplier` respects served org + `OrgUnitRoleAssignment` (GROUP_PROCUREMENT / REGIONAL_HQ) for cross-node release; list/detail and transition API; seed PO-1004 + org `US-CHI-PL1` + role on `US`. |
| 2026-04-24 | **Phase 3 delivered:** `getPurchaseOrderScopeWhere` — org-scoped users also see POs whose `servedOrgUnitId` is in their org subtree (OR with requester-based rule); `controlTowerShipmentAccessWhere` and other `mergePurchaseOrderWhere` call sites pick this up via the same helper. |
| 2026-04-24 | **Phase 1 delivered:** `OrgUnitOperatingRole` + `org_unit_role_assignments`; `GET`/`POST`/`PATCH` `/api/settings/org-units` carry `operatingRoles`; no change to `org-scope` PO filters. |
| 2026-04-23 | Initial v1.0. |
