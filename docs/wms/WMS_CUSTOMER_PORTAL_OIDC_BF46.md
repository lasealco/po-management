# Customer portal OIDC (BF-46)

**Purpose:** Augment **BF-30** with an env-driven **OpenID Connect** authorization-code flow (**PKCE**, **JWKS** `id_token` verification, **`iss` / `aud` / `nonce`** checks) while preserving the same session cookies and **`resolveUserForCustomerPortalSso`** mapping as simulate/HMAC SSO.

**Authority:** Capsule **BF-46** ([`BF31_BF50_MEGA_PHASES.md`](./BF31_BF50_MEGA_PHASES.md)). SAML and multi-tenant IdP routing remain backlog.

---

## Flow

1. User opens **`GET /api/auth/customer-portal/oidc/start`** (linked from `/wms/vas-intake` when OIDC env is configured).
2. Server stores **`state`**, **`nonce`**, and **`code_verifier`** in an httpOnly cookie (**`cp_oidc_ctx`**, HMAC-sealed, ~10 minute TTL), then redirects to the IdP **`authorization_endpoint`**.
3. IdP redirects to **`GET /api/auth/customer-portal/oidc/callback`** with `?code=&state=`.
4. Server validates cookie **`state`**, exchanges **`code`** at **`token_endpoint`**, verifies **`id_token`** with **`jose`** against **`jwks_uri`** (`issuer`, `audience`, `nonce`, clock skew tolerance).
5. **`sub`** (and optional **`email`** claim) resolve the tenant **`User`** via **`customerPortalExternalSubject`** / email — same rules as BF-30 — then **`po_auth_user`** is set and **`po_demo_user`** cleared.

---

## Required environment variables

All must be set for OIDC to activate (`readCustomerPortalOidcEnv()` returns non-null):

| Variable | Meaning |
|----------|---------|
| **`CUSTOMER_PORTAL_OIDC_ISSUER`** | Base issuer URL (no trailing slash required); discovery at `{issuer}/.well-known/openid-configuration`. |
| **`CUSTOMER_PORTAL_OIDC_CLIENT_ID`** | OAuth client id. |
| **`CUSTOMER_PORTAL_OIDC_CLIENT_SECRET`** | Confidential client secret (token endpoint uses basic auth-style body params). |
| **`CUSTOMER_PORTAL_OIDC_REDIRECT_URI`** | Registered redirect URI, must match exactly (e.g. `https://your-app.example/api/auth/customer-portal/oidc/callback`). |
| **`CUSTOMER_PORTAL_OIDC_COOKIE_SECRET`** | HMAC key for sealed **`cp_oidc_ctx`** cookie (minimum **16** characters). |

---

## Optional environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| **`CUSTOMER_PORTAL_OIDC_SUCCESS_REDIRECT`** | `/wms/vas-intake` | Path-only redirect after successful login (must start with `/`). |
| **`CUSTOMER_PORTAL_OIDC_SCOPES`** | `openid email profile` | Space-separated scopes for authorize URL. |
| **`CUSTOMER_PORTAL_OIDC_EMAIL_CLAIM`** | `email` | JWT claim used for email fallback (also tries **`preferred_username`** if unset). |
| **`CUSTOMER_PORTAL_OIDC_AUDIENCE`** | same as client id | JWT **`aud`** when IdP uses a resource identifier different from client id. |

---

## Implementation references

- **`src/lib/auth/customer-portal-oidc.ts`** — discovery memoization, PKCE, cookie seal, token exchange, **`jwtVerify`** via **`jose`** `createRemoteJWKSet`.
- **`src/app/api/auth/customer-portal/oidc/start/route.ts`**
- **`src/app/api/auth/customer-portal/oidc/callback/route.ts`**
- Vitest: **`src/lib/auth/customer-portal-oidc.test.ts`** (PKCE + cookie helpers).

---

## SAML

**Not implemented** in this slice — document IdP metadata / XML signature validation as future work if product chooses SAML over OIDC.

---

## Related

- BF-30 — [`WMS_CUSTOMER_PORTAL_BF30.md`](./WMS_CUSTOMER_PORTAL_BF30.md) (simulate + HMAC SSO, CRM lock)

_Last updated: 2026-04-29 — OIDC code + PKCE minimal landed._
