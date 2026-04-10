import { NextResponse } from "next/server";
import {
  executeHelpDoAction,
  type HelpDoAction,
} from "@/lib/help-actions";
import { getViewerGrantSet } from "@/lib/authz";

type Body = {
  action?: HelpDoAction;
};

export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) {
    return NextResponse.json(
      { error: "You need an active session to run help actions." },
      { status: 403 },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = (body && typeof body === "object" ? body : {}) as Body;
  const action = input.action;
  if (
    !action ||
    typeof action.type !== "string" ||
    typeof action.label !== "string" ||
    (action.payload != null && typeof action.payload !== "object")
  ) {
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
    return NextResponse.json({ error: "Unsupported action type." }, { status: 400 });
  }

  const result = await executeHelpDoAction(access, normalized);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
