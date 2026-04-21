/** Client helpers for `GET /api/supply-chain-twin/scenarios` (keyset list; Slice 51). */

export type TwinScenarioDraftListRow = {
  id: string;
  title: string | null;
  status: string;
  updatedAt: string;
};

export type TwinScenarioDraftsListResult =
  | { ok: true; items: TwinScenarioDraftListRow[]; nextCursor: string | null }
  | { ok: false; message: string };

const DEFAULT_PAGE_LIMIT = 50;

export function parseTwinScenarioDraftsListPayload(body: unknown): TwinScenarioDraftsListResult {
  if (typeof body !== "object" || body == null || !("items" in body) || !Array.isArray((body as { items: unknown }).items)) {
    return { ok: false, message: "Unexpected response from scenarios API." };
  }
  const rawItems = (body as { items: unknown[] }).items;
  const items: TwinScenarioDraftListRow[] = [];
  for (const row of rawItems) {
    if (
      typeof row === "object" &&
      row != null &&
      "id" in row &&
      typeof (row as { id: unknown }).id === "string" &&
      (row as { id: string }).id.length > 0 &&
      "title" in row &&
      ((row as { title: unknown }).title === null || typeof (row as { title: unknown }).title === "string") &&
      "status" in row &&
      typeof (row as { status: unknown }).status === "string" &&
      "updatedAt" in row &&
      typeof (row as { updatedAt: unknown }).updatedAt === "string"
    ) {
      items.push({
        id: (row as { id: string }).id,
        title: (row as { title: string | null }).title,
        status: (row as { status: string }).status,
        updatedAt: (row as { updatedAt: string }).updatedAt,
      });
    }
  }
  if (items.length !== rawItems.length) {
    return { ok: false, message: "Unexpected response from scenarios API." };
  }
  let nextCursor: string | null = null;
  if ("nextCursor" in body && (body as { nextCursor?: unknown }).nextCursor != null) {
    const c = (body as { nextCursor: unknown }).nextCursor;
    if (typeof c !== "string" || c.length === 0) {
      return { ok: false, message: "Unexpected response from scenarios API." };
    }
    nextCursor = c;
  }
  return { ok: true, items, nextCursor };
}

export async function fetchTwinScenarioDraftsPage(
  cursor: string | undefined,
  options?: { limit?: number },
): Promise<TwinScenarioDraftsListResult> {
  const params = new URLSearchParams();
  params.set("limit", String(options?.limit ?? DEFAULT_PAGE_LIMIT));
  if (cursor) {
    params.set("cursor", cursor);
  }
  try {
    const res = await fetch(`/api/supply-chain-twin/scenarios?${params.toString()}`, { cache: "no-store" });
    const body = (await res.json()) as unknown;
    if (!res.ok) {
      const message =
        typeof body === "object" && body != null && "error" in body && typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : "Scenario drafts could not be loaded.";
      return { ok: false, message };
    }
    return parseTwinScenarioDraftsListPayload(body);
  } catch {
    return { ok: false, message: "Network error while loading scenario drafts." };
  }
}
