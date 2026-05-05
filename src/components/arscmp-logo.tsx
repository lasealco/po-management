"use client";

import Image from "next/image";

type ARSCMPLogoProps = {
  className?: string;
  compact?: boolean;
};

const LOGO_SRC = "/neolink-logo.png";

/**
 * Primary logo lockup (NEOLINK). Matches `--arscmp-primary` in `globals.css`.
 */
export function ARSCMPLogo({ className = "", compact = false }: ARSCMPLogoProps) {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <Image
        src={LOGO_SRC}
        alt="NEOLINK"
        width={compact ? 160 : 220}
        height={compact ? 36 : 48}
        priority
        className="h-9 w-auto object-contain object-left sm:h-11 sm:w-auto"
      />
      {!compact ? (
        <div className="mt-1 select-none text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px]">
          Connected operations platform
        </div>
      ) : null}
    </div>
  );
}
