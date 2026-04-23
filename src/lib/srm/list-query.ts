export type SrmListKind = "product" | "logistics";

export type SrmListQuery = {
  kind: SrmListKind;
  q: string;
  /** When true, only suppliers with an incomplete onboarding task assigned to the current user. */
  onboardingMine: boolean;
};

type QueryValue = string | string[] | undefined;

function firstValue(raw: QueryValue): string {
  if (Array.isArray(raw)) {
    return raw[0]?.trim() ?? "";
  }
  return raw?.trim() ?? "";
}

function truthyOnboardingMine(raw: QueryValue): boolean {
  const v = firstValue(raw);
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

export function parseSrmListQuery(searchParams: {
  kind?: QueryValue;
  q?: QueryValue;
  onboardingMine?: QueryValue;
}): SrmListQuery {
  const kindValue = firstValue(searchParams.kind);
  const q = firstValue(searchParams.q);

  return {
    kind: kindValue === "logistics" ? "logistics" : "product",
    q,
    onboardingMine: truthyOnboardingMine(searchParams.onboardingMine),
  };
}
