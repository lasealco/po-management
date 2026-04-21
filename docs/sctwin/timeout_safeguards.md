# Supply Chain Twin Timeout Safeguards

This note defines the Twin timeout behavior introduced for heavy API operations.

## Stable timeout contract

When an operation exceeds the route budget, return a stable error shape:

```json
{
  "error": "Operation timed out after <N>ms. Please retry with a narrower request scope.",
  "code": "TIMEOUT_BUDGET_EXCEEDED"
}
```

- `code` is machine-stable for clients and runbooks.
- Message is operator-safe and does not include tenant names, ids, or payloads.

## Helper APIs

Use shared helper utilities from `src/lib/supply-chain-twin/timeout-guard.ts`:

- `runWithTwinTimeoutBudget(operation, timeoutMs, onTimeout?)`
  - wraps expensive work with a strict budget
  - throws `TwinTimeoutBudgetExceededError` on timeout
- `getTwinTimeoutErrorBody(timeoutMs)`
  - returns the canonical JSON error payload with `TIMEOUT_BUDGET_EXCEEDED`

## Route usage guidance

For heavy endpoints (for example large filters/exports):

1. Wrap expensive work in `runWithTwinTimeoutBudget(...)`.
2. Catch `TwinTimeoutBudgetExceededError`.
3. Return `408` (or route-specific timeout status) with `getTwinTimeoutErrorBody(timeoutMs)`.
4. Log a normalized warning/error using Twin structured logging (`requestId`, `route`, `errorCode`).

## Deferred work

This slice adds the shared contract and helper/test coverage so routes can adopt timeout handling consistently without duplicating ad-hoc timeout strings.
