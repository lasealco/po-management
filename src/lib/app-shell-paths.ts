import { LEGAL_PUBLIC_HELP_PATHS } from "@/lib/legal-public-paths";
import { MARKETING_PRICING_PATH } from "@/lib/marketing-public-paths";

/**
 * Paths that render **without** the main app shell:
 * - `AppNav` (PO Management, Sales Orders, …)
 * - PO subnav, guide callout, command palette, help assistant, bottom legal strip
 *
 * These routes use page-local layout only (marketing hero, pricing, or `LegalSiteNav` on legal pages).
 * `RootChrome` still mounts `GuideCallout` and `CommandPalette` here so playbook deep links and ⌘K / Ctrl+K
 * work without the main nav shell.
 * Every other path uses the full app chrome when the user is allowed to load it.
 */
export const PATHS_WITHOUT_APP_CHROME = new Set([
  "/",
  MARKETING_PRICING_PATH,
  ...LEGAL_PUBLIC_HELP_PATHS,
]);

export function pathUsesAppChrome(pathname: string): boolean {
  return !PATHS_WITHOUT_APP_CHROME.has(pathname);
}
