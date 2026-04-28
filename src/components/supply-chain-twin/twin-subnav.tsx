"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

const BASE = "/supply-chain-twin";

type TwinSubNavVisibilityValue = { supplyChainTwin: boolean };

const TwinSubNavVisibilityContext = createContext<TwinSubNavVisibilityValue>({
  supplyChainTwin: false,
});

/**
 * Wraps `/supply-chain-twin/*` so {@link TwinSubNav} can show the **Compare** tab only when twin preview is allowed
 * for this session (same gate as `linkVisibility.supplyChainTwin`).
 */
export function TwinSubNavProvider(props: { supplyChainTwin: boolean; children: ReactNode }) {
  return (
    <TwinSubNavVisibilityContext.Provider value={{ supplyChainTwin: props.supplyChainTwin }}>
      {props.children}
    </TwinSubNavVisibilityContext.Provider>
  );
}

export function TwinSubNav() {
  const pathname = usePathname() ?? "";
  const { supplyChainTwin } = useContext(TwinSubNavVisibilityContext);
  const isOverview = pathname === BASE;
  const isAssistant = pathname.startsWith(`${BASE}/assistant`);
  const isExplorer = pathname.startsWith(`${BASE}/explorer`);
  const isCompare = pathname.startsWith(`${BASE}/scenarios/compare`);
  const isScenarios = pathname.startsWith(`${BASE}/scenarios`) && !isCompare;

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    }`;

  return (
    <nav
      className="mb-8 flex flex-wrap gap-2 border-b border-zinc-200 pb-4"
      aria-label="Supply Chain Twin sections"
    >
      <Link href={BASE} className={tabClass(isOverview)}>
        Overview
      </Link>
      <Link href={`${BASE}/assistant`} className={tabClass(isAssistant)}>
        Assistant
      </Link>
      <Link href={`${BASE}/explorer`} className={tabClass(isExplorer)}>
        Explorer
      </Link>
      <Link href={`${BASE}/scenarios`} className={tabClass(isScenarios)}>
        Scenarios
      </Link>
      {supplyChainTwin ? (
        <Link href={`${BASE}/scenarios/compare`} className={tabClass(isCompare)}>
          Compare
        </Link>
      ) : null}
    </nav>
  );
}
