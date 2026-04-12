"use client";

import { usePathname } from "next/navigation";

import { PoMgmtSubNav } from "@/components/po-mgmt-subnav";
import type { PoMgmtSubNavVisibility } from "@/lib/nav-visibility";

export function LayoutPoSubnav({ visibility }: { visibility: PoMgmtSubNavVisibility }) {
  const pathname = usePathname();
  const show =
    pathname === "/" ||
    pathname.startsWith("/orders/") ||
    pathname.startsWith("/consolidation") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/suppliers");

  if (!show) return null;
  return <PoMgmtSubNav visibility={visibility} />;
}
