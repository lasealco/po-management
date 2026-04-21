"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { getPageHintForPath } from "@/lib/page-hints";

type Props = {
  title: string;
  /** Classes for the `<h1>` (visual size/weight). */
  titleClassName?: string;
  /** When set, the registry is ignored. */
  hints?: string[];
  footerNote?: string;
};

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function PageTitleWithHint({
  title,
  titleClassName = "text-2xl font-semibold tracking-tight text-zinc-900",
  hints: hintsProp,
  footerNote: footerProp,
}: Props) {
  const pathname = usePathname() ?? "";
  const fromRegistry = hintsProp == null ? getPageHintForPath(pathname) : null;
  const hints = hintsProp ?? fromRegistry?.bullets;
  const footerNote = footerProp ?? fromRegistry?.footerNote;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const headingId = useId();
  const panelTitleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: PointerEvent) {
      const el = wrapRef.current;
      if (!el?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [open]);

  if (!hints?.length) {
    return <h1 className={titleClassName}>{title}</h1>;
  }

  return (
    <div ref={wrapRef} className="inline-flex max-w-full flex-wrap items-baseline gap-2">
      <h1 id={headingId} className={titleClassName}>
        {title}
      </h1>
      <div className="relative shrink-0 self-center">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300/90 bg-white text-zinc-500 shadow-sm transition hover:border-[var(--arscmp-primary)]/35 hover:text-[var(--arscmp-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arscmp-primary)]/30"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`About this page: ${title}`}
          onClick={() => setOpen((v) => !v)}
        >
          <InfoIcon />
        </button>
        {open ? (
          <div
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={panelTitleId}
            className="absolute left-0 z-[60] mt-2 w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-lg sm:left-auto sm:right-0"
          >
            <h2 id={panelTitleId} className="text-sm font-semibold text-zinc-900">
              About this page
            </h2>
            <ul className="mt-3 list-outside list-disc space-y-2 pl-4 text-sm leading-relaxed text-zinc-700">
              {hints.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {footerNote ? <p className="mt-3 text-xs text-zinc-500">{footerNote}</p> : null}
            <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
              For guided tours open <span className="font-medium text-zinc-700">Help</span> (bottom-right). Ask
              questions in the same panel.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
