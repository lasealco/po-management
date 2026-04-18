"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMarkLink } from "@/components/brand-mark";
import type { AppNavLinkVisibility } from "@/lib/nav-visibility";

type TopNavItem =
  | { kind: "po"; key: "poManagement"; label: string; href: string }
  | {
      kind: "link";
      key: Exclude<keyof AppNavLinkVisibility, "poManagement">;
      label: string;
      href: string;
    };

const topNavItems: TopNavItem[] = [
  { kind: "po", key: "poManagement", label: "PO Management", href: "/orders" },
  { kind: "link", key: "salesOrders", label: "Sales Orders", href: "/sales-orders" },
  { kind: "link", key: "executive", label: "Executive", href: "/executive" },
  { kind: "link", key: "reports", label: "Reporting", href: "/reporting" },
  { kind: "link", key: "controlTower", label: "Control Tower", href: "/control-tower" },
  { kind: "link", key: "wms", label: "WMS", href: "/wms" },
  { kind: "link", key: "crm", label: "CRM", href: "/crm" },
  { kind: "link", key: "srm", label: "SRM", href: "/srm" },
  { kind: "link", key: "tariffs", label: "Tariffs", href: "/tariffs/contracts" },
  {
    kind: "link",
    key: "pricingSnapshots",
    label: "Snapshots",
    href: "/pricing-snapshots",
  },
  { kind: "link", key: "rfq", label: "RFQ", href: "/rfq/requests" },
  { kind: "link", key: "settings", label: "Settings", href: "/settings" },
];

export function AppNav({
  linkVisibility,
  setupIncomplete = false,
}: {
  linkVisibility?: AppNavLinkVisibility;
  setupIncomplete?: boolean;
}) {
  const pathname = usePathname();
  const visible =
    setupIncomplete || !linkVisibility
      ? [...topNavItems]
      : topNavItems.filter((item) => linkVisibility[item.key]);

  const poActive =
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname.startsWith("/consolidation") ||
    pathname.startsWith("/products");

  return (
    <header className="sticky top-0 z-10 border-b-2 border-[var(--arscmp-primary)] bg-white shadow-[0_1px_0_rgba(22,91,103,0.06)]">
      {setupIncomplete ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 sm:text-left">
          <div className="mx-auto max-w-7xl">
            <strong className="font-semibold">Demo permissions missing.</strong>{" "}
            Users exist but this account has no role grants (
            <code className="rounded bg-amber-200/70 px-1 py-0.5 text-xs">
              RolePermission
            </code>
            ). From your machine run{" "}
            <code className="rounded bg-amber-200/70 px-1 py-0.5 text-xs">
              npm run db:seed
            </code>{" "}
            with the same{" "}
            <code className="rounded bg-amber-200/70 px-1 py-0.5 text-xs">
              DATABASE_URL
            </code>{" "}
            as Vercel, then reload.
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2 pl-2 pr-6 sm:pl-3 md:pl-6">
        <BrandMarkLink
          href="/platform"
          className="mr-auto shrink-0 py-1"
          aria-label="AR SCMP — platform home"
        />
        <nav
          className="flex max-w-[min(100%,52rem)] flex-wrap items-center justify-end gap-x-1 gap-y-1 sm:gap-x-1"
          aria-label="Main"
        >
          {visible.map((item) => {
            const active =
              item.kind === "po"
                ? poActive
                : item.href === "/settings"
                  ? pathname.startsWith("/settings")
                  : item.href === "/srm"
                    ? pathname === "/srm" || pathname.startsWith("/srm/")
                  : item.href === "/sales-orders"
                    ? pathname === "/sales-orders" || pathname.startsWith("/sales-orders/")
                  : item.href === "/reporting"
                    ? pathname === "/reporting" ||
                      pathname === "/reports" ||
                      pathname.startsWith("/reports/") ||
                      pathname === "/crm/reporting" ||
                      pathname === "/wms/reporting"
                    : item.href === "/crm"
                      ? pathname === "/crm" || pathname.startsWith("/crm/")
                      : item.href === "/control-tower"
                        ? pathname === "/control-tower" || pathname.startsWith("/control-tower/")
                        : item.href === "/tariffs/contracts"
                          ? pathname.startsWith("/tariffs")
                          : item.href === "/pricing-snapshots"
                          ? pathname.startsWith("/pricing-snapshots")
                          : item.href === "/rfq/requests"
                            ? pathname.startsWith("/rfq")
                            : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const isSettings = item.key === "settings";
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3 ${
                  isSettings ? "ml-1 border-l border-zinc-200 pl-3 sm:ml-2 sm:pl-4" : ""
                } ${
                  active
                    ? "bg-[var(--arscmp-primary-50)] text-[var(--arscmp-primary)] ring-1 ring-[var(--arscmp-primary)]/20"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
