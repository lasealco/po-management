"use client";

import { createContext, type ReactNode } from "react";

type TwinSubNavVisibilityValue = { supplyChainTwin: boolean };

export const TwinSubNavVisibilityContext = createContext<TwinSubNavVisibilityValue>({
  supplyChainTwin: false,
});

/**
 * Wraps `/supply-chain-twin/*` so {@link TwinModuleSidebar} can show **Compare** only when twin preview is allowed
 * for this session (same gate as `linkVisibility.supplyChainTwin`).
 */
export function TwinSubNavProvider(props: { supplyChainTwin: boolean; children: ReactNode }) {
  return (
    <TwinSubNavVisibilityContext.Provider value={{ supplyChainTwin: props.supplyChainTwin }}>
      {props.children}
    </TwinSubNavVisibilityContext.Provider>
  );
}
