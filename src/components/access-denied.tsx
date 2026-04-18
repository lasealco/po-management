import type { ReactNode } from "react";

export function AccessDenied({
  title,
  message,
}: {
  title: string;
  /** Plain text or rich content (e.g. links) for operational unblock instructions. */
  message: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
      <div className="mt-3 text-sm leading-relaxed text-zinc-600">{message}</div>
    </main>
  );
}
