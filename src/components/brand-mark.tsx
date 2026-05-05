import Image from "next/image";
import Link from "next/link";

/** Primary brand orange (NEOLINK logo hex). */
export const SITE_BRAND_HEX = "#E8912D" as const;

const LOGO_SRC = "/neolink-logo.png";

function NeolinkLogoImage({ className = "" }: { className?: string }) {
  return (
    <Image
      src={LOGO_SRC}
      alt="NEOLINK"
      width={200}
      height={44}
      priority
      className={["h-8 w-auto max-h-9 object-contain object-left sm:h-9", className].filter(Boolean).join(" ")}
    />
  );
}

export function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <NeolinkLogoImage />
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
      className={["flex items-center gap-2 py-0.5", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? "NEOLINK — home"}
    >
      <NeolinkLogoImage />
    </Link>
  );
}
