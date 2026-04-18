export function decString(v: { toString(): string } | null | undefined): string | null {
  if (v == null) return null;
  return v.toString();
}

export function dateIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}
