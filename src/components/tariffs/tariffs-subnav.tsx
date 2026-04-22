"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  moduleTertiarySubNavLinkInactiveClass,
  moduleTertiarySubNavShellClass,
  subNavActiveClass,
} from "@/lib/subnav-active-class";
import {
  TARIFF_CHARGE_CODES_PATH,
  TARIFF_CONTRACTS_DIRECTORY_PATH,
  TARIFF_GEOGRAPHY_PATH,
  TARIFF_IMPORT_PATH,
  TARIFF_LEGAL_ENTITIES_PATH,
  TARIFF_PROVIDERS_PATH,
  TARIFF_RATE_LOOKUP_PATH,
  TARIFF_RATING_PATH,
  tariffLaneRatingPath,
} from "@/lib/tariff/tariff-workbench-urls";

const items: { href: string; label: string; isActive: (pathname: string) => boolean }[] = [
  {
    href: TARIFF_RATE_LOOKUP_PATH,
    label: "Rate lookup",
    isActive: (pathname) => pathname.startsWith(TARIFF_RATE_LOOKUP_PATH),
  },
  {
    href: tariffLaneRatingPath(),
    label: "Rating",
    isActive: (pathname) => pathname.startsWith(TARIFF_RATING_PATH),
  },
  {
    href: TARIFF_CONTRACTS_DIRECTORY_PATH,
    label: "Contracts",
    isActive: (pathname) => pathname.startsWith(TARIFF_CONTRACTS_DIRECTORY_PATH),
  },
  {
    href: TARIFF_PROVIDERS_PATH,
    label: "Providers",
    isActive: (pathname) => pathname.startsWith(TARIFF_PROVIDERS_PATH),
  },
  {
    href: TARIFF_LEGAL_ENTITIES_PATH,
    label: "Legal entities",
    isActive: (pathname) => pathname.startsWith(TARIFF_LEGAL_ENTITIES_PATH),
  },
  {
    href: TARIFF_IMPORT_PATH,
    label: "Import",
    isActive: (pathname) => pathname.startsWith(TARIFF_IMPORT_PATH),
  },
  {
    href: TARIFF_GEOGRAPHY_PATH,
    label: "Geography",
    isActive: (pathname) => pathname.startsWith(TARIFF_GEOGRAPHY_PATH),
  },
  {
    href: TARIFF_CHARGE_CODES_PATH,
    label: "Charge codes",
    isActive: (pathname) => pathname.startsWith(TARIFF_CHARGE_CODES_PATH),
  },
];

export function TariffsSubNav() {
  const pathname = usePathname();

  return (
    <div className={moduleTertiarySubNavShellClass}>
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 py-2.5 pl-2 pr-6 sm:pl-3 md:pl-6">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          Tariffs
        </span>
        {items.map(({ href, label, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={active ? subNavActiveClass : moduleTertiarySubNavLinkInactiveClass}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
