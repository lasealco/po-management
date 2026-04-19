import type { AppNavLinkVisibility } from "@/lib/nav-visibility";

export const RATES_AUDIT_NAV_LABEL = "Rates & Audit";

export const ratesAuditSubNavItems: Array<{
  key: keyof Pick<AppNavLinkVisibility, "tariffs" | "pricingSnapshots" | "invoiceAudit" | "rfq">;
  label: string;
  href: string;
}> = [
  { key: "tariffs", label: "Tariffs", href: "/tariffs/contracts" },
  { key: "pricingSnapshots", label: "Pricing snapshots", href: "/pricing-snapshots" },
  { key: "invoiceAudit", label: "Invoice audit", href: "/invoice-audit" },
  { key: "rfq", label: "RFQ", href: "/rfq/requests" },
];

export function isRatesAuditSectionPath(pathname: string): boolean {
  return (
    pathname.startsWith("/tariffs") ||
    pathname.startsWith("/pricing-snapshots") ||
    pathname.startsWith("/invoice-audit") ||
    pathname.startsWith("/rfq")
  );
}

/** Default landing when opening "Rates & Audit" from the top bar. */
export function ratesAuditTopNavHref(
  linkVisibility: AppNavLinkVisibility | undefined,
  setupIncomplete: boolean,
): string {
  if (setupIncomplete || !linkVisibility) return "/tariffs/contracts";
  if (linkVisibility.tariffs) return "/tariffs/contracts";
  if (linkVisibility.rfq) return "/rfq/requests";
  if (linkVisibility.invoiceAudit) return "/invoice-audit";
  if (linkVisibility.pricingSnapshots) return "/pricing-snapshots";
  return "/tariffs/contracts";
}
