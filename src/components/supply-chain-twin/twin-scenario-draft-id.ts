/**
 * Validates Prisma-style primary keys for `SupplyChainTwinScenarioDraft` (`@id @default(cuid())` / cuid2-style).
 * Aligned with `GET /api/supply-chain-twin/scenarios/[id]` path rules: non-empty, max 128, plus a narrow charset so
 * obvious garbage never hits the network from compare URLs.
 */
const MIN_LEN = 12;
const MAX_LEN = 128;

/** Lowercase letter + lowercase alphanumerics; length in [MIN_LEN, MAX_LEN]. */
const DRAFT_ID_RE = /^[a-z][a-z0-9]{11,127}$/;

export function isValidTwinScenarioDraftCuid(value: string): boolean {
  const t = value.trim().toLowerCase();
  if (t.length < MIN_LEN || t.length > MAX_LEN) {
    return false;
  }
  return DRAFT_ID_RE.test(t);
}

export type TwinScenarioDraftQueryParse =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "ok"; id: string };

export function parseTwinScenarioDraftQueryValue(
  raw: string | string[] | undefined,
): TwinScenarioDraftQueryParse {
  if (raw === undefined) {
    return { status: "missing" };
  }
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (typeof s !== "string") {
    return { status: "missing" };
  }
  const t = s.trim();
  if (!t) {
    return { status: "missing" };
  }
  if (!isValidTwinScenarioDraftCuid(t)) {
    return { status: "invalid" };
  }
  return { status: "ok", id: t.toLowerCase() };
}
