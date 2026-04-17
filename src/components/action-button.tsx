import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "accent" | "ai";

const BUTTON_VARIANTS: Record<Variant, string> = {
  primary: "bg-[var(--arscmp-primary)] text-white hover:brightness-95",
  secondary: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
  accent: "border border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700",
  ai: "border border-violet-700 bg-violet-600 text-white hover:bg-violet-700",
};

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function ActionButton({ variant = "primary", className, type = "button", ...props }: ActionButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}

type ActionLinkProps = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

export function ActionLink({ href, children, variant = "primary", className }: ActionLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold ${BUTTON_VARIANTS[variant]} ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}
