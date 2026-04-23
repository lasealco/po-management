# System (tenancy, org, RBAC) — agent todo list

**GitHub label:** `module:system`  
**Typical allowed paths:** `prisma/schema.prisma` + `prisma/migrations/**` (only when issue explicitly includes migrations), `src/lib/authz.ts`, `src/lib/permission-catalog.ts`, `src/lib/viewer.ts`, user/org APIs under `src/app/api/**` as named in issue  
**Warning:** High blast radius — prefer **design issue** with `needs-alex` before large schema work.

**Source of truth:** `docs/icp-and-tenancy.md`. **Users / roles / permissions (today vs deeper RBAC roadmap):** `docs/engineering/USER_ROLES_AND_RBAC.md`.

---

## Engineering todos (from doc — one GitHub issue per major bullet)

- [x] **Decide representation** — decision captured: keep single-tenant isolation and model hierarchy with in-tenant org units (`docs/icp-and-tenancy.md`).
- [ ] **Enterprise hierarchy** — model sketch (`OrgUnit`, `UserOrgUnit`, links); no UI until model approved.
- [ ] **Scoped permissions** — extend RBAC; audit `tenantId` query patterns (issue must list first modules to audit).
- [ ] **Delegation guardrails** — subset-of-assigner on role assignment APIs (once org model direction exists).
- [ ] **Customer as scope** — standardize customer dimension on ops entities (align with CRM account); phased by module.
- [ ] **Portals** — customer users + invitation + least-privilege roles (epic; split issues).
- [ ] **Reporting** — cockpit respects active scope (after scopes exist).

---

## Hygiene

- [ ] Keep **investor / GTM** language in slide/docs aligned with “MVP = single tenant” until hierarchy ships (`docs/icp-and-tenancy.md`).
