import Link from "next/link";

import { LEGAL_COOKIES_PATH, LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from "@/lib/legal-public-paths";

export function SiteLegalStrip() {
  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-zinc-200/90 bg-zinc-50/90 py-3 text-center text-xs text-zinc-500"
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link href={LEGAL_PRIVACY_PATH} className="underline-offset-2 hover:text-zinc-800 hover:underline">
          Privacy Policy
        </Link>
        <span className="text-zinc-300" aria-hidden>
          ·
        </span>
        <Link href={LEGAL_TERMS_PATH} className="underline-offset-2 hover:text-zinc-800 hover:underline">
          Terms of Use
        </Link>
        <span className="text-zinc-300" aria-hidden>
          ·
        </span>
        <Link href={LEGAL_COOKIES_PATH} className="underline-offset-2 hover:text-zinc-800 hover:underline">
          Cookie Notice
        </Link>
      </span>
    </footer>
  );
}
