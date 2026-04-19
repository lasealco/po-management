"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { subNavActiveClass } from "@/lib/subnav-active-class";

const items: { href: string; label: string; isActive: (pathname: string) => boolean }[] = [
  {
    href: "/tariffs/contracts",
    label: "Contracts",
    isActive: (pathname) => pathname.startsWith("/tariffs/contracts"),
  },
  {
    href: "/tariffs/import",
    label: "Import",
    isActive: (pathname) => pathname.startsWith("/tariffs/import"),
  },
  {
    href: "/tariffs/geography",
    label: "Geography",
    isActive: (pathname) => pathname.startsWith("/tariffs/geography"),
  },
  {
    href: "/tariffs/charge-codes",
    label: "Charge codes",
    isActive: (pathname) => pathname.startsWith("/tariffs/charge-codes"),
  },
];

export function TariffsSubNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2.5">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
          Tariffs
        </span>
        {items.map(({ href, label, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? subNavActiveClass
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
