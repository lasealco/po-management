"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items: { href: string; label: string }[] = [
  { href: "/control-tower", label: "Dashboard" },
  { href: "/control-tower/workbench", label: "Workbench" },
  { href: "/control-tower/reports", label: "Reports" },
  { href: "/control-tower/search", label: "Search & assist" },
];

export function ControlTowerSubNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-6 py-2">
        <span className="mr-2 self-center text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Control Tower
        </span>
        {items.map(({ href, label }) => {
          const active =
            href === "/control-tower"
              ? pathname === "/control-tower"
              : href === "/control-tower/workbench"
                ? pathname === href ||
                  pathname.startsWith(`${href}/`) ||
                  pathname.startsWith("/control-tower/shipments/")
                : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-sky-100 text-sky-900"
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
