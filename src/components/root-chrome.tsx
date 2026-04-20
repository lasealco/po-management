"use client";

import { usePathname } from "next/navigation";

import { AppNav } from "@/components/app-nav";
import { CommandPalette, type CommandPaletteGrants } from "@/components/command-palette";
import { GuideCallout } from "@/components/guide-callout";
import { HelpAssistant } from "@/components/help-assistant";
import { LayoutPoSubnav } from "@/components/layout-po-subnav";
import { LayoutRatesAuditSubnav } from "@/components/layout-rates-audit-subnav";
import { SiteLegalStrip } from "@/components/site-legal-strip";
import { pathUsesAppChrome } from "@/lib/app-shell-paths";
import type { AppNavLinkVisibility, PoMgmtSubNavVisibility } from "@/lib/nav-visibility";

export function RootChrome({
  children,
  linkVisibility,
  setupIncomplete,
  poSubNavVisibility,
  commandGrants,
}: {
  children: React.ReactNode;
  linkVisibility?: AppNavLinkVisibility;
  setupIncomplete: boolean;
  poSubNavVisibility: PoMgmtSubNavVisibility;
  commandGrants: CommandPaletteGrants;
}) {
  const pathname = usePathname();
  const showAppChrome = pathUsesAppChrome(pathname);

  if (!showAppChrome) {
    return (
      <div className="min-h-full bg-white">
        <GuideCallout />
        {children}
        <CommandPalette grants={commandGrants} />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <AppNav linkVisibility={linkVisibility} setupIncomplete={setupIncomplete} />
      <LayoutRatesAuditSubnav linkVisibility={linkVisibility} setupIncomplete={setupIncomplete} />
      <LayoutPoSubnav visibility={poSubNavVisibility} />
      <GuideCallout />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">{children}</div>
        <SiteLegalStrip />
      </div>
      <CommandPalette grants={commandGrants} />
      <HelpAssistant />
    </div>
  );
}
