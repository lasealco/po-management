"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext } from "react";

import {
  ModuleSidebarAside,
  ModuleSidebarLink,
  ModuleSidebarSection,
} from "@/components/shell/module-sidebar-primitives";
import { TwinSubNavVisibilityContext } from "@/components/supply-chain-twin/twin-subnav";

const BASE = "/supply-chain-twin";

export function TwinModuleSidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const { supplyChainTwin } = useContext(TwinSubNavVisibilityContext);
  const isOverview = pathname === BASE;
  const isAssistant = pathname.startsWith(`${BASE}/assistant`);
  const isExplorer = pathname.startsWith(`${BASE}/explorer`);
  const isCompare = pathname.startsWith(`${BASE}/scenarios/compare`);
  const isScenarios = pathname.startsWith(`${BASE}/scenarios`) && !isCompare;

  return (
    <ModuleSidebarAside
      aria-label="Supply Chain Twin navigation"
      className={`w-full lg:w-56 lg:shrink-0 ${className ?? ""}`}
    >
      <Link href={BASE} className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]">
        Twin home
      </Link>
      <div className="space-y-4">
        <ModuleSidebarSection label="Workspace">
          <ModuleSidebarLink href={BASE} active={isOverview}>
            Overview
          </ModuleSidebarLink>
          <ModuleSidebarLink href={`${BASE}/assistant`} active={isAssistant}>
            Assistant
          </ModuleSidebarLink>
          <ModuleSidebarLink href={`${BASE}/explorer`} active={isExplorer}>
            Explorer
          </ModuleSidebarLink>
          <ModuleSidebarLink href={`${BASE}/scenarios`} active={isScenarios}>
            Scenarios
          </ModuleSidebarLink>
          {supplyChainTwin ? (
            <ModuleSidebarLink href={`${BASE}/scenarios/compare`} active={isCompare}>
              Compare
            </ModuleSidebarLink>
          ) : null}
        </ModuleSidebarSection>
      </div>
    </ModuleSidebarAside>
  );
}
