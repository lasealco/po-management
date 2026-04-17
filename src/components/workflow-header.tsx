import type { ReactNode } from "react";

type WorkflowHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  steps?: [string, string, string] | string[];
  className?: string;
  children?: ReactNode;
};

export function WorkflowHeader({
  eyebrow,
  title,
  description,
  steps = [],
  className,
  children,
}: WorkflowHeaderProps) {
  return (
    <section className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{title}</h1>
      {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
      {steps.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {steps.slice(0, 3).map((step, idx) => (
            <p key={`${step}-${idx}`} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
              {step}
            </p>
          ))}
        </div>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
