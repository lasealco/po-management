import type { AppNavLinkVisibility } from "@/lib/nav-visibility";
import { TARIFF_CONTRACTS_DIRECTORY_PATH, TARIFFS_MODULE_BASE_PATH } from "@/lib/tariff/tariff-workbench-urls";

export const RATES_AUDIT_NAV_LABEL = "Rates & Audit";

/** Active state for Rates & Audit sidebar links (matches legacy strip behavior). */
export function ratesAuditNavLinkActive(pathname: string, href: string): boolean {
  if (href === TARIFF_CONTRACTS_DIRECTORY_PATH) return pathname.startsWith(TARIFFS_MODULE_BASE_PATH);
  if (href === "/pricing-snapshots") return pathname.startsWith("/pricing-snapshots");
  if (href === "/invoice-audit") return pathname.startsWith("/invoice-audit");
  if (href === "/rfq/requests") return pathname.startsWith("/rfq");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const ratesAuditSubNavItems: Array<{
  key: keyof Pick<AppNavLinkVisibility, "tariffs" | "pricingSnapshots" | "invoiceAudit" | "rfq">;
  label: string;
  href: string;
}> = [
  { key: "tariffs", label: "Tariffs", href: TARIFFS_MODULE_BASE_PATH },
  { key: "pricingSnapshots", label: "Pricing snapshots", href: "/pricing-snapshots" },
  { key: "invoiceAudit", label: "Invoice audit", href: "/invoice-audit" },
  { key: "rfq", label: "RFQ", href: "/rfq/requests" },
];

export function isRatesAuditSectionPath(pathname: string): boolean {
  return (
    pathname.startsWith(TARIFFS_MODULE_BASE_PATH) ||
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
  if (setupIncomplete || !linkVisibility) return TARIFFS_MODULE_BASE_PATH;
  if (linkVisibility.tariffs) return TARIFFS_MODULE_BASE_PATH;
  if (linkVisibility.rfq) return "/rfq/requests";
  if (linkVisibility.invoiceAudit) return "/invoice-audit";
  if (linkVisibility.pricingSnapshots) return "/pricing-snapshots";
  return TARIFFS_MODULE_BASE_PATH;
}
