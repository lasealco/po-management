# API Error/Guard Contract Baseline

## Scope

This baseline freezes one shared response contract for API domain errors and permission/guard failures.

- **Body shape:** `{ error: string; code: string; ...optionalMetadata }`
- **Status:** explicit HTTP status selected by code mapping (`statusFromErrorCode`) or direct guard status.
- **Response helper:** `toApiErrorResponse(...)` from `src/app/api/_lib/api-error-contract.ts`.

## Contract Rules

1. Every non-2xx API error response should include both `error` and `code`.
2. Keep `error` human-readable and suitable for logs and troubleshooting.
3. Keep `code` machine-stable (UPPER_SNAKE_CASE) for client branching and tests.
4. Use optional metadata only for actionable remediation context (for example `migrationsHint`).
5. Map status from code with `statusFromErrorCode` for repo/domain errors; set status directly for pure guard checks.

## Helper Location Policy

- **Shared contract helpers live in:** `src/app/api/_lib/`.
- **Slice adapters stay local** (for example `src/app/api/rfq/_lib/rfq-api-error.ts`) and should only:
  - narrow unknown errors to the slice error class;
  - map slice-specific codes to status;
  - delegate final body/response shaping to shared contract helpers.
- **Permission/guard checks** that return `NextResponse` should also delegate to the shared contract helper to keep shape parity.

## Examples

```ts
import { statusFromErrorCode, toApiErrorResponse } from "@/app/api/_lib/api-error-contract";

const status = statusFromErrorCode(e.code, { NOT_FOUND: 404, CONFLICT: 409 }, 400);
return toApiErrorResponse({ error: e.message, code: e.code, status });
```

```ts
return toApiErrorResponse({
  error: "Forbidden: requires org.tariffs -> edit.",
  code: "FORBIDDEN",
  status: 403,
});
```

## Backward Compatibility Note

This baseline introduces `code` in two representative slices that previously returned `{ error }` only:

- RFQ API error adapter (`jsonFromRfqError`)
- Booking pricing snapshot API error adapter (`jsonFromSnapshotError`)
- Pricing snapshot guard helper responses in `require-pricing-snapshot-access`

Clients that parsed only `error` remain compatible; clients that validated exact key sets should accept the additional `code` field.
