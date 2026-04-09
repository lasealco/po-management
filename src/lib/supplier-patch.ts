/** Parse optional string field from JSON body: omit = no change, null = clear, string = set. */
export function optionalStringField(
  o: Record<string, unknown>,
  key: string,
): string | null | undefined {
  if (!(key in o)) return undefined;
  const v = o[key];
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : null;
}
