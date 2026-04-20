export type SrmListKind = "product" | "logistics";

export type SrmListQuery = {
  kind: SrmListKind;
  q: string;
};

type QueryValue = string | string[] | undefined;

function firstValue(raw: QueryValue): string {
  if (Array.isArray(raw)) {
    return raw[0]?.trim() ?? "";
  }
  return raw?.trim() ?? "";
}

export function parseSrmListQuery(searchParams: { kind?: QueryValue; q?: QueryValue }): SrmListQuery {
  const kindValue = firstValue(searchParams.kind);
  const q = firstValue(searchParams.q);

  return {
    kind: kindValue === "logistics" ? "logistics" : "product",
    q,
  };
}
