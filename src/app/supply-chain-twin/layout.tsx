import type { ReactNode } from "react";

import { TwinSubNavProvider } from "@/components/supply-chain-twin/twin-subnav";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export const dynamic = "force-dynamic";

/**
 * Makes `linkVisibility.supplyChainTwin` available to in-module UI (e.g. {@link TwinSubNav} Compare link) without
 * editing global chrome.
 */
export default async function SupplyChainTwinLayout({ children }: { children: ReactNode }) {
  const access = await getViewerGrantSet();
  const { linkVisibility } = await resolveNavState(access);
  const supplyChainTwin = Boolean(access?.user && linkVisibility?.supplyChainTwin);

  return <TwinSubNavProvider supplyChainTwin={supplyChainTwin}>{children}</TwinSubNavProvider>;
}
