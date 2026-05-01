# Customer portal SSO & identity (BF-30)

**Purpose:** Give **BF-09** portal flows a minimal **identity bridge**: external **`sub`** + email map to a tenant **`User`** with **`customerCrmAccountId`** (CRM scope). Align **`/wms/vas-intake`** UI and **`request_customer_vas_work_order`** so customer-scoped actors cannot attribute intake to another CRM account.

**Authority:** Capsule **BF-30** ([`BLUEPRINT_FINISH_BACKLOG.md`](./BLUEPRINT_FINISH_BACKLOG.md), [`BF21_BF30_MEGA_PHASES.md`](./BF21_BF30_MEGA_PHASES.md)).

---

## Schema (`User`)

| Field | Meaning |
|-------|---------|
| **`customerCrmAccountId`** | Existing FK — portal CRM scope (required for SSO resolution and VAS intake lock). |
| **`customerPortalExternalSubject`** | Optional stable IdP **`sub`** (or broker subject); unique per **`tenantId`** when set (`@@unique([tenantId, customerPortalExternalSubject])`). |

Migration: `prisma/migrations/20260501180000_wms_bf30_customer_portal_external_subject/migration.sql`.

---

## SSO bridge (`POST /api/auth/customer-portal/sso`)

Sets **`po_auth_user`** to the resolved email and clears **`po_demo_user`** (same pattern as password login).

**Modes** (at least one env secret required):

1. **Simulate / dev broker** — `CUSTOMER_PORTAL_SSO_SIMULATE_SECRET` + request header **`x-customer-portal-sso-secret`** matching that secret. JSON body: **`externalSubject`** and/or **`email`** (either may be omitted if the other resolves the user).
2. **Signed assertion** — `CUSTOMER_PORTAL_SSO_HMAC_SECRET`. JSON body: **`sub`**, **`email`**, **`ts`** (Unix ms), **`sig`** (hex HMAC-SHA256 over canonical `${sub}\n${emailLower}\n${ts}`).

Implementation: `src/lib/auth/customer-portal-sso.ts`, route `src/app/api/auth/customer-portal/sso/route.ts`. Vitest: `src/lib/auth/customer-portal-sso.test.ts`.

**Resolution order:** match **`customerPortalExternalSubject`** to **`sub`** / **`externalSubject`** when provided; else match **`email`** (case-insensitive). User must be active and have **`customerCrmAccountId`**.

---

## VAS intake alignment

- **API:** `request_customer_vas_work_order` rejects **`crmAccountId`** ≠ **`User.customerCrmAccountId`** when the actor is customer CRM–scoped (`actorIsCustomerCrmScoped` in `src/lib/wms/post-actions.ts`).
- **UI:** `/wms/vas-intake` loads **`lockedCrmAccountId`** from the viewer’s **`customerCrmAccountId`**; CRM picker is read-only when locked (`src/app/wms/vas-intake/page.tsx`, `src/components/vas-intake-client.tsx`).

---

## RBAC / demo seed

Customer portal role (**`customer@demo-company.com`**) includes **`org.wms` → view**, **`org.crm` → view**, **`org.wms.operations` → edit** (plus existing CT/orders grants) so intake submit works. Seed sets **`customerPortalExternalSubject: demo-customer-portal-sub`** for SSO demos (`prisma/seed.mjs`).

---

## Exit sketch (remaining)

SAML/OIDC or JWKS-verified JWT from a real IdP; multi-tenant broker routing; session hardening beyond cookie TTL; grant matrix tests for every portal route.

**Out of scope:** Full B2B marketplace, vendor SSO.

_Last updated: 2026-04-29 — minimal HMAC/simulate bridge + CRM lock on VAS intake._
