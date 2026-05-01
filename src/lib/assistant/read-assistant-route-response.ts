/** Parse JSON from a route-handler Response used by assistant server pages (direct GET() imports). */
export async function readAssistantRouteResponse(response: Response): Promise<
  | { ok: true; data: unknown }
  | { ok: false; status: number; message: string }
> {
  const raw: unknown = await response.json().catch(() => null);
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const errorMsg = obj && typeof obj.error === "string" ? obj.error : null;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: errorMsg ?? `Workspace request failed (${response.status}).`,
    };
  }

  return { ok: true, data: raw };
}
