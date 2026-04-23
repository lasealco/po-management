/**
 * Normalize tenant `geoAliases` JSON into uppercase key → ISO-2 value.
 */
export function normalizeGeoAliasMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "string") continue;
    const kk = k.trim().toUpperCase();
    const vv = v.trim().toUpperCase();
    if (kk.length > 0 && /^[A-Z]{2}$/.test(vv)) {
      out[kk] = vv;
    }
  }
  return out;
}
