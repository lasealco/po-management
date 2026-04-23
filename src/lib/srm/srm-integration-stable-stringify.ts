/** Deterministic JSON for idempotency body hashing. */
export function srmIntegrationStableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(srmIntegrationStableStringify).join(",")}]`;
  }
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + srmIntegrationStableStringify(o[k])).join(",")}}`;
}
