/**
 * Slice 44 — reserved apply rollback contract (stub until downstream revert exists).
 * Callers should treat `effect: "none"` as a successful no-op probe; future versions may
 * set `implemented: true` and other `effect` values without changing the route shape.
 */
export const API_HUB_APPLY_ROLLBACK_STUB_ROLLBACK = {
  stub: true as const,
  implemented: false as const,
  effect: "none" as const,
  message: "Apply rollback is not implemented; no database or downstream changes were made.",
} as const;

export type ApiHubApplyRollbackStubRollback = typeof API_HUB_APPLY_ROLLBACK_STUB_ROLLBACK;
