"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { INVOICE_AUDIT_NAV_ITEMS } from "@/components/invoice-audit/invoice-audit-subnav";
import { PRICING_SNAPSHOTS_NAV_ITEMS } from "@/components/pricing-snapshots/pricing-snapshots-subnav";
import { RFQ_WORKBENCH_NAV_ITEMS } from "@/components/rfq/rfq-subnav";
import {
  ModuleSidebarAside,
  ModuleSidebarLink,
  ModuleSidebarSection,
} from "@/components/shell/module-sidebar-primitives";
import { TARIFF_WORKBENCH_NAV_ITEMS } from "@/components/tariffs/tariffs-subnav";
import type { AppNavLinkVisibility } from "@/lib/nav-visibility";
import {
  RATES_AUDIT_NAV_LABEL,
  ratesAuditNavLinkActive,
  ratesAuditSubNavItems,
} from "@/lib/rates-audit-nav";
import { TARIFFS_MODULE_BASE_PATH } from "@/lib/tariff/tariff-workbench-urls";

export type RatesModuleSidebarVariant = "tariffs" | "rfq" | "pricing-snapshots" | "invoice-audit";

export function RatesModuleSidebar({
  variant,
  linkVisibility,
  setupIncomplete,
  className,
}: {
  variant: RatesModuleSidebarVariant;
  linkVisibility?: AppNavLinkVisibility;
  setupIncomplete: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const visibleRates = ratesAuditSubNavItems.filter(
    (i) => setupIncomplete || !linkVisibility || linkVisibility[i.key],
  );

  const homeHref =
    variant === "tariffs"
      ? TARIFFS_MODULE_BASE_PATH
      : variant === "rfq"
        ? "/rfq/requests"
        : variant === "pricing-snapshots"
          ? "/pricing-snapshots"
          : "/invoice-audit";

  const homeLabel =
    variant === "tariffs"
      ? "Tariffs home"
      : variant === "rfq"
        ? "RFQ home"
        : variant === "pricing-snapshots"
          ? "Snapshots home"
          : "Invoice audit home";

  return (
    <ModuleSidebarAside
      aria-label="Rates, audit, and module navigation"
      className={`w-full lg:w-60 lg:shrink-0 ${className ?? ""}`}
    >
      <Link
        href={homeHref}
        className="mb-3 block text-xs font-semibold text-zinc-900 hover:text-[var(--arscmp-primary)]"
      >
        {homeLabel}
      </Link>

      <div className="space-y-4">
        <ModuleSidebarSection label={RATES_AUDIT_NAV_LABEL}>
          {visibleRates.map(({ href, label }) => (
            <ModuleSidebarLink key={href} href={href} active={ratesAuditNavLinkActive(pathname, href)}>
              {label}
            </ModuleSidebarLink>
          ))}
        </ModuleSidebarSection>

        {variant === "tariffs" ? (
          <ModuleSidebarSection label="Tariffs">
            {TARIFF_WORKBENCH_NAV_ITEMS.map(({ href, label, isActive }) => (
              <ModuleSidebarLink key={href} href={href} active={isActive(pathname)}>
                {label}
              </ModuleSidebarLink>
            ))}
          </ModuleSidebarSection>
        ) : null}

        {variant === "rfq" ? (
          <ModuleSidebarSection label="RFQ">
            {RFQ_WORKBENCH_NAV_ITEMS.map(({ href, label, match }) => (
              <ModuleSidebarLink key={href} href={href} active={match(pathname)}>
                {label}
              </ModuleSidebarLink>
            ))}
          </ModuleSidebarSection>
        ) : null}

        {variant === "pricing-snapshots" ? (
          <ModuleSidebarSection label="Snapshots">
            {PRICING_SNAPSHOTS_NAV_ITEMS.map(({ href, label, match }) => (
              <ModuleSidebarLink key={href} href={href} active={match(pathname)}>
                {label}
              </ModuleSidebarLink>
            ))}
            <ModuleSidebarLink
              href="/pricing-snapshots/new"
              active={pathname === "/pricing-snapshots/new"}
            >
              Freeze snapshot
            </ModuleSidebarLink>
          </ModuleSidebarSection>
        ) : null}

        {variant === "invoice-audit" ? (
          <ModuleSidebarSection label="Invoice audit">
            {INVOICE_AUDIT_NAV_ITEMS.map(({ href, label, match }) => (
              <ModuleSidebarLink key={href} href={href} active={match(pathname)}>
                {label}
              </ModuleSidebarLink>
            ))}
          </ModuleSidebarSection>
        ) : null}
      </div>
    </ModuleSidebarAside>
  );
}
