import { NextResponse } from "next/server";

import { requireApiGrant } from "@/lib/authz";
import { runControlTowerAssist } from "@/lib/control-tower/assist-llm";

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.controltower", "view");
  if (gate) return gate;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const q =
    typeof (body as { q?: unknown }).q === "string" ? (body as { q: string }).q : "";

  const result = await runControlTowerAssist({ raw: q });
  return NextResponse.json({
    hints: result.hints,
    suggestedFilters: result.suggestedFilters,
    capabilities: result.capabilities,
    usedLlm: result.usedLlm,
  });
}
