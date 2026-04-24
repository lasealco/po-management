# Users, roles, and permissions — what exists vs roadmap (RBAC)

**Purpose:** Single place to describe the **sophisticated user / role / permission** story without overstating what is shipped. **Deeper, org-scoped RBAC remains roadmap**; see `docs/icp-and-tenancy.md` and `docs/engineering/agent-todos/system.md`.

---

## What is implemented today (single tenant, flat grants)

| Concept | Implementation |
|--------|------------------|
| **Tenant** | `Tenant`; users belong to **one** `tenantId`. Hard isolation for operational data. |
| **User** | `User` — `email` (login id for `/api/auth/login`), `passwordHash`, `isActive`, optional portal/CRM scoping fields (e.g. `customerCrmAccountId` for Control Tower). |
| **Role** | `Role` (per tenant) — e.g. **Buyer**, **Approver**, **Supplier portal**, **Superuser** (seeded names; `isSystem` for built-ins). |
| **Binding** | `UserRole` — many-to-many user ↔ role. |
| **Permissions** | `RolePermission` — `(resource, action, effect)` pairs such as `org.controltower` + `view` / `edit`. Checked in `src/lib/authz.ts` and route handlers. Catalog: `src/lib/permission-catalog.ts`. |

**Not implemented:** per-resource object ACLs, org-unit subtrees, inherited roles, or “row-level” security beyond a few explicit scoping fields (e.g. CT list scope by CRM account for portal users). **Practical read scoping** (org / product-division / customer / portal) is implemented in code via helpers; inventory and an advisory API audit: `docs/engineering/READ_SCOPE_INVENTORY.md`, barrel `src/lib/viewer-scopes.ts`.

---

## “Superuser” in demo seed (password login)

After **`npm run db:seed`** (or equivalent) against a database that includes the `demo-company` tenant, the seed creates a **Superuser** role and user:

- **Email:** `superuser@arscmp.com` (valid email for HTML `type="email"` and password managers; not a fake “username” without `@`.)  
- **Password:** `superuser`  
- **Migration:** older seeds used `superuser@demo-company.com`; re-run seed so `prisma/seed.mjs` can `updateMany` to `superuser@arscmp.com` and refresh the password hash.

**Security:** This is a **known demo credential** for local/staging. Replace with proper identity, SSO, or at least strong unique passwords before any production that holds real data.

---

## Roadmap: deeper RBAC (explicitly not done)

The following are **out of scope for the current app** and tracked as design/implementation work:

- **Org units** inside a tenant and **scoped** grants (HQ → region → site).  
- **Delegation rules** (cannot grant beyond assigner’s effective permissions + org scope) on user/role admin APIs.  
- **3PL customer tenant** or full customer-isolation without additional model work.  
- **Field-level** permission matrix per module (see WMS/blueprint PRDs) — not enforced globally today.

**Authoritative notes:** `docs/icp-and-tenancy.md` (Wave 3 direction, non-goals), `docs/engineering/agent-todos/system.md` (issue-sized backlog).

When login is **fully “live”** in an environment, run the main seed (or a targeted upsert) so the superuser user exists, then sign in with the credentials above or via Settings → user admin as your process allows.
