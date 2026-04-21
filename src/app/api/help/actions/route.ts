import { NextResponse } from "next/server";
import { getViewerGrantSet } from "@/lib/authz";
import {
  executeHelpDoAction,
  type HelpDoAction,
} from "@/lib/help-actions";
import { isValidHelpEventId } from "@/lib/help-event-id";
import { logHelpActionTelemetry } from "@/lib/help-telemetry";

type Body = {
  action?: HelpDoAction;
  helpEventId?: string;
};

export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return NextResponse.json(
      { error: "You need an active session to run help actions." },
      { status: 403 },
    );
  }
  const tenantId = access.tenant.id;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as Body;
  const rawEventId = typeof input.helpEventId === "string" ? input.helpEventId.trim() : "";
  const helpEventId = isValidHelpEventId(rawEventId) ? rawEventId : undefined;
  const action = input.action;
  if (
    !action ||
    typeof action.type !== "string" ||
    typeof action.label !== "string" ||
    (action.payload != null && typeof action.payload !== "object")
  ) {
    logHelpActionTelemetry({
      kind: "help_action",
      tenantId,
      actionType: "malformed_request",
      ok: false,
      httpStatus: 400,
      helpEventId,
    });
    return NextResponse.json({ error: "Invalid action payload." }, { status: 400 });
  }

  const normalized: HelpDoAction = {
    type: action.type as HelpDoAction["type"],
    label: action.label,
    payload:
      action.payload && typeof action.payload === "object" && !Array.isArray(action.payload)
        ? (action.payload as Record<string, unknown>)
        : undefined,
  };

  if (
    normalized.type !== "open_order" &&
    normalized.type !== "open_orders_queue" &&
    normalized.type !== "open_path"
  ) {
    logHelpActionTelemetry({
      kind: "help_action",
      tenantId,
      actionType: "unsupported_type",
      ok: false,
      httpStatus: 400,
      helpEventId,
    });
    return NextResponse.json({ error: "Unsupported action type." }, { status: 400 });
  }

  const result = await executeHelpDoAction(access, normalized);
  if (!result.ok) {
    logHelpActionTelemetry({
      kind: "help_action",
      tenantId,
      actionType: normalized.type,
      ok: false,
      httpStatus: 400,
      pathKey:
        normalized.type === "open_path" && typeof normalized.payload?.path === "string"
          ? (normalized.payload.path as string).split("?")[0]
          : undefined,
      queueKey:
        normalized.type === "open_orders_queue" && typeof normalized.payload?.queue === "string"
          ? (normalized.payload.queue as string)
          : undefined,
      openOrderAttempt: normalized.type === "open_order",
      helpEventId,
    });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  logHelpActionTelemetry({
    kind: "help_action",
    tenantId,
    actionType: normalized.type,
    ok: true,
    httpStatus: 200,
    pathKey:
      normalized.type === "open_path" && typeof normalized.payload?.path === "string"
        ? (normalized.payload.path as string).split("?")[0]
        : undefined,
    queueKey:
      normalized.type === "open_orders_queue" && typeof normalized.payload?.queue === "string"
        ? (normalized.payload.queue as string)
        : undefined,
    openOrderAttempt: normalized.type === "open_order",
    helpEventId,
  });
  return NextResponse.json(result);
}
