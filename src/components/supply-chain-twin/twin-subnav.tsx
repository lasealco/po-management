"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/supply-chain-twin";

export function TwinSubNav() {
  const pathname = usePathname() ?? "";
  const isOverview = pathname === BASE;
  const isExplorer = pathname.startsWith(`${BASE}/explorer`);

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
      <Link href={`${BASE}/explorer`} className={tabClass(isExplorer)}>
        Explorer
      </Link>
    </nav>
  );
}
