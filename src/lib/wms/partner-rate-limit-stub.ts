/**
 * BF-45 — rate-limit surface for partner routes (stub: fixed advisory headers only).
 */

export function partnerRateLimitStubHeaders(): Record<string, string> {
  return {
    "X-RateLimit-Limit": "1000",
    "X-RateLimit-Remaining": "999",
    "X-RateLimit-Policy": "stub-no-enforcement",
  };
}
