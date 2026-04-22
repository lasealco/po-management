/**
 * Shallow field paths from the first sample record (for assistant context only).
 */
export function collectImportAssistantSamplePaths(firstRecord: unknown, maxPaths: number): string[] {
  const out: string[] = [];

  function walk(v: unknown, prefix: string, depth: number) {
    if (out.length >= maxPaths || depth > 8) return;
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) {
      if (v.length > 0) {
        walk(v[0], prefix ? `${prefix}[0]` : "[0]", depth + 1);
      }
      return;
    }
    if (typeof v !== "object") return;
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (out.length >= maxPaths) return;
      const p = prefix ? `${prefix}.${k}` : k;
      out.push(p);
      walk(val, p, depth + 1);
    }
  }

  walk(firstRecord, "", 0);
  return out;
}
