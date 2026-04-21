/**
 * Module secondary nav — active chip sits on `moduleSubNavShellClass` (muted brand strip).
 * Primary AppNav uses `appNavActiveClass` / `appNavInactiveClass`.
 */
export const subNavActiveClass =
  "rounded-lg bg-[var(--arscmp-primary-50)] px-2.5 py-1.5 text-sm font-semibold text-[var(--arscmp-primary)] shadow-sm ring-1 ring-[var(--arscmp-primary)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arscmp-primary)]/35 sm:px-3";

/** Full-width bar directly under AppNav (uses `--arscmp-nav-substrip` in globals.css). */
export const moduleSubNavShellClass =
  "border-b border-[var(--arscmp-primary)]/12 bg-[var(--arscmp-nav-substrip)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]";

/** Inactive links on the muted module subnav strip. */
export const moduleSubNavLinkInactiveClass =
  "rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:bg-white/50 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arscmp-primary)]/25 sm:px-3";

/** AppNav — active top-level module (inverted brand). */
export const appNavActiveClass =
  "rounded-lg bg-[var(--arscmp-primary)] px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--arscmp-primary-700)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--arscmp-primary)] sm:px-3";

export const appNavInactiveClass =
  "rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arscmp-primary)]/30 sm:px-3";
