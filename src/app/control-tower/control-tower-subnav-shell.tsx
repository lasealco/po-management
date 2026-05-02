import { ControlTowerModuleSidebar } from "@/components/control-tower-module-sidebar";
import { getActorUserId } from "@/lib/authz";
import { getControlTowerPortalContext } from "@/lib/control-tower/viewer";

/**
 * Resolves portal vs internal scope so the client subnav can show digest only when it is most relevant
 * (supplier portal or CRM-linked customer), while `/control-tower/digest` remains reachable by URL.
 */
export async function ControlTowerSubNavShell() {
  const actorId = await getActorUserId();
  const includeDigestNav =
    actorId !== null ? (await getControlTowerPortalContext(actorId)).isRestrictedView : false;
  return <ControlTowerModuleSidebar includeDigestNav={includeDigestNav} />;
}
