# SRM activation guards (operational eligibility)

Suppliers must be **active** and **approvalStatus = approved** before they can be used in operational flows that create or reference purchase orders as the line supplier or as a **forwarder**.

## Enforced routes (Phase B)

| Surface | Behavior |
|---------|----------|
| `POST /api/orders` | Line `supplierId` and optional `forwarderSupplierId` are loaded without requiring `isActive: true` in the query so the API returns **400** with a clear reason when the supplier exists but is pending, rejected, or inactive. |

## Shared helper

`src/lib/srm/supplier-operational-eligibility.ts` — `supplierOperationalBlockReason()` returns a human-readable string or `null` when the supplier may be used.

## Approval state machine

`src/lib/srm/supplier-approval-transitions.ts` documents and enforces allowed `approvalStatus` changes on:

- `POST /api/suppliers/[id]/approval` (`approve` | `reject` | `reopen`)
- `PATCH /api/suppliers/[id]` when `approvalStatus` is present (requires `org.suppliers` → approve for activation/approval fields)
