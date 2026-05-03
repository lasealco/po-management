import { NextResponse } from "next/server";

import { userHasGlobalGrant } from "@/lib/authz";

import { evaluateWmsInventoryPostMutationAccess } from "./wms-inventory-field-acl";
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
 * After this returns null, **BF-70** may call `evaluateExternalWmsPolicy` when `WMS_EXTERNAL_PDP_URL` is set (`src/app/api/wms/route.ts`).
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

  /** BF-16 + BF-48 — manifest-driven inventory splits (`inventory.lot`, `inventory.serial`, full inventory). */
  if (tier === "inventory") {
    const inventoryEdit = await userHasGlobalGrant(actorId, "org.wms.inventory", "edit");
    const inventoryLotEdit = await userHasGlobalGrant(actorId, "org.wms.inventory.lot", "edit");
    const inventorySerialEdit = await userHasGlobalGrant(actorId, "org.wms.inventory.serial", "edit");
    const decision = evaluateWmsInventoryPostMutationAccess({
      action: raw,
      legacyWmsEdit: false,
      inventoryEdit,
      inventoryLotEdit,
      inventorySerialEdit,
    });
    if (decision.allowed) return null;
    /** BF-58 — delegated release paths; handler enforces per-row grant + standard-hold inventory edit. */
    if (raw === "clear_balance_hold" || raw === "release_inventory_freeze") {
      const q = await userHasGlobalGrant(actorId, "org.wms.inventory.hold.release_quality", "edit");
      const c = await userHasGlobalGrant(actorId, "org.wms.inventory.hold.release_compliance", "edit");
      if (q || c) return null;
    }
    return NextResponse.json({ error: decision.error }, { status: 403 });
  }

  if (await hasTierEdit(actorId, tier)) return null;
  return NextResponse.json(
    { error: `Forbidden: requires org.wms → edit or org.wms.${tier} → edit for action "${raw}".` },
    { status: 403 },
  );
}
