import Link from "next/link";

import { BrandMark, BrandMarkLink, SITE_BRAND_HEX } from "@/components/brand-mark";
import { LEGAL_COOKIES_PATH, LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from "@/lib/legal-public-paths";

export function LegalSiteNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandMarkLink href="/" />
        <div className="flex shrink-0 items-center gap-3 sm:gap-8">
          <Link
            href="/"
            className="text-sm font-medium text-slate-700 transition-colors hover:text-[var(--arscmp-primary)]"
          >
            Back to Home
          </Link>
          <Link
            href="/#demo"
            className="rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-95"
            style={{ backgroundColor: SITE_BRAND_HEX }}
          >
            Request Demo
          </Link>
        </div>
      </div>
    </nav>
  );
}

const legalFooterLink =
  "text-slate-400 transition-colors hover:text-[var(--arscmp-primary)] text-sm";
const legalFooterActive =
  "text-sm font-bold text-slate-900 underline decoration-[var(--arscmp-primary)] underline-offset-4";

export function LegalSiteFooter({
  highlight,
}: {
  highlight?: "privacy" | "terms" | "cookies";
}) {
  return (
    <footer className="border-t border-slate-100 bg-white py-16">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 md:flex-row sm:px-6 lg:px-8">
        <BrandMark />
        <div className="text-center text-sm italic text-slate-400 md:text-left">
          NEOLINK
        </div>
        <div className="flex max-w-md flex-wrap justify-center gap-x-6 gap-y-2 text-sm sm:max-w-none sm:gap-x-8">
          <Link href="/" className={legalFooterLink}>
            Home
          </Link>
          <Link
            href={LEGAL_PRIVACY_PATH}
            className={highlight === "privacy" ? legalFooterActive : legalFooterLink}
          >
            Privacy
          </Link>
          <Link href={LEGAL_TERMS_PATH} className={highlight === "terms" ? legalFooterActive : legalFooterLink}>
            Terms
          </Link>
          <Link
            href={LEGAL_COOKIES_PATH}
            className={highlight === "cookies" ? legalFooterActive : legalFooterLink}
          >
            Cookies
          </Link>
        </div>
      </div>
    </footer>
  );
}
