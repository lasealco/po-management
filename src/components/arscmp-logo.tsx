"use client";

type ARSCMPLogoProps = {
  className?: string;
  compact?: boolean;
};

/**
 * ARSCMP primary logo lockup.
 * Brand primary color: #165B67.
 */
export function ARSCMPLogo({ className = "", compact = false }: ARSCMPLogoProps) {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div className="flex items-center gap-2">
        <div className="arscmp-logo-box flex aspect-square items-center justify-center rounded-xl px-2.5 py-1.5">
          <span className="select-none text-2xl font-black leading-none text-white sm:text-3xl">
            AR
          </span>
        </div>
        <span className="arscmp-brand select-none text-3xl font-black leading-none tracking-tight sm:text-4xl">
          SCMP
        </span>
      </div>
      {!compact ? (
        <div className="mt-1 select-none text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500 sm:text-[10px]">
          Supply Chain Management Platform
        </div>
      ) : null}
    </div>
  );
}
