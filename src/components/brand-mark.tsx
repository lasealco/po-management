import Link from "next/link";

export const SITE_BRAND_HEX = "#165B67" as const;

export function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="arscmp-logo-box flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-[0.6rem] py-[0.4rem]">
        <span className="text-xl font-black leading-none text-white">AR</span>
      </div>
      <span className="arscmp-brand text-3xl font-black tracking-[-0.02em]">SCMP</span>
    </div>
  );
}

export function BrandMarkLink({
  href = "/",
  className = "",
  "aria-label": ariaLabel,
}: {
  href?: string;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <Link
      href={href}
      className={["flex items-center gap-2", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      <div className="arscmp-logo-box flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg px-[0.6rem] py-[0.4rem]">
        <span className="text-xl font-black leading-none text-white">AR</span>
      </div>
      <span className="arscmp-brand text-3xl font-black tracking-[-0.02em]">SCMP</span>
    </Link>
  );
}
