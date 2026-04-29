import { NextResponse } from "next/server";

import { userHasGlobalGrant } from "@/lib/authz";

import { wmsMutationTierForPostAction, type WmsMutationTier } from "./wms-mutation-tiers";

async function hasLegacyWmsEdit(actorId: string): Promise<boolean> {
  return userHasGlobalGrant(actorId, "org.wms", "edit");
}

async function hasTierEdit(actorId: string, tier: WmsMutationTier): Promise<boolean> {
  return userHasGlobalGrant(actorId, `org.wms.${tier}`, "edit");
}

/** Requires `org.wms` → edit **or** `org.wms.{tier}` → edit. */
export async function gateWmsTierMutation(actorId: string, tier: WmsMutationTier): Promise<NextResponse | null> {
  if (await hasLegacyWmsEdit(actorId)) return null;
  if (await hasTierEdit(actorId, tier)) return null;
  return NextResponse.json(
    { error: `Forbidden: requires org.wms → edit or org.wms.${tier} → edit.` },
    { status: 403 },
  );
}

/**
 * After `org.wms` → view is satisfied: gate POST body `action` against tier map + grants.
 * Unknown actions require legacy `org.wms` → edit only (handler may still reject as unsupported).
 */
export async function gateWmsPostMutation(actorId: string, action: string | undefined): Promise<NextResponse | null> {
  const raw = action?.trim();
  if (!raw) {
    return NextResponse.json({ error: "action required." }, { status: 400 });
  }
  const tier = wmsMutationTierForPostAction(raw);
  if (tier === undefined) {
    if (!(await hasLegacyWmsEdit(actorId))) {
      return NextResponse.json({ error: "Forbidden: requires org.wms → edit for this action." }, { status: 403 });
    }
    return null;
  }
  if (await hasLegacyWmsEdit(actorId)) return null;
  if (await hasTierEdit(actorId, tier)) return null;
  return NextResponse.json(
    { error: `Forbidden: requires org.wms → edit or org.wms.${tier} → edit for action "${raw}".` },
    { status: 403 },
  );
}
