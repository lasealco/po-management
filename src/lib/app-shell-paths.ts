/**
 * Paths that render **without** the main app shell:
 * - `AppNav` (PO Management, Sales Orders, …)
 * - PO subnav, guide callout, command palette, help assistant, bottom legal strip
 *
 * These routes use page-local layout only (marketing hero, pricing, or `LegalSiteNav` on legal pages).
 * Every other path uses the full app chrome when the user is allowed to load it.
 */
export const PATHS_WITHOUT_APP_CHROME = new Set([
  "/",
  "/pricing",
  "/privacy",
  "/terms",
  "/cookies",
]);

export function pathUsesAppChrome(pathname: string): boolean {
  return !PATHS_WITHOUT_APP_CHROME.has(pathname);
}
