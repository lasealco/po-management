/** Pure helpers for CRM opportunities list URL query (?stage=&owner=&q=&stale=). */

export type OpportunitiesListQuery = {
  stage: string;
  owner: string;
  q: string;
  stale: boolean;
};

export function parseOpportunitiesListQuery(searchParams: URLSearchParams): OpportunitiesListQuery {
  return {
    stage: (searchParams.get("stage") ?? "").trim(),
    owner: (searchParams.get("owner") ?? "").trim(),
    q: (searchParams.get("q") ?? "").trim(),
    stale: searchParams.get("stale") === "1",
  };
}

/**
 * Merge filter patch into current search string. Omits empty filter keys; preserves unrelated keys (e.g. stale=1).
 */
export function buildOpportunitiesListSearch(
  current: URLSearchParams,
  patch: Partial<{ stage: string; owner: string; q: string }>,
): string {
  const next = new URLSearchParams(current.toString());

  const apply = (key: "stage" | "owner" | "q", value: string | undefined) => {
    if (value === undefined) return;
    const t = value.trim();
    if (t) next.set(key, t);
    else next.delete(key);
  };

  if (patch.stage !== undefined) apply("stage", patch.stage);
  if (patch.owner !== undefined) apply("owner", patch.owner);
  if (patch.q !== undefined) apply("q", patch.q);

  return next.toString();
}
