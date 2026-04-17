import Link from "next/link";

export function SiteLegalStrip() {
  return (
    <footer
      role="contentinfo"
      className="mt-auto border-t border-zinc-200/90 bg-zinc-50/90 py-3 text-center text-xs text-zinc-500"
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link href="/privacy" className="underline-offset-2 hover:text-zinc-800 hover:underline">
          Privacy Policy
        </Link>
        <span className="text-zinc-300" aria-hidden>
          ·
        </span>
        <Link href="/terms" className="underline-offset-2 hover:text-zinc-800 hover:underline">
          Terms of Use
        </Link>
        <span className="text-zinc-300" aria-hidden>
          ·
        </span>
        <Link href="/cookies" className="underline-offset-2 hover:text-zinc-800 hover:underline">
          Cookie Notice
        </Link>
      </span>
    </footer>
  );
}
