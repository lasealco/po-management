"use client";

import { useTwinCachedAsync } from "./use-twin-cached-async";

type ReadinessPayload =
  | { tag: "error" }
  | { tag: "ready"; ok: boolean; reasons: string[] };

async function fetchReadiness(): Promise<ReadinessPayload> {
  try {
    const res = await fetch("/api/supply-chain-twin/readiness", { cache: "no-store" });
    if (!res.ok) {
      return { tag: "error" };
    }
    const body: unknown = await res.json();
    if (typeof body !== "object" || body === null) {
      return { tag: "error" };
    }
    const rec = body as Record<string, unknown>;
    if (typeof rec.ok !== "boolean" || !Array.isArray(rec.reasons)) {
      return { tag: "error" };
    }
    const reasons: string[] = [];
    for (const item of rec.reasons) {
      if (typeof item !== "string") {
        return { tag: "error" };
      }
      reasons.push(item);
    }
    return { tag: "ready", ok: rec.ok, reasons };
  } catch {
    return { tag: "error" };
  }
}

function TwinReadinessBannerInner({
  docsReadmeHref,
  docsTreeHref,
}: {
  docsReadmeHref: string;
  docsTreeHref: string;
}) {
  const snapshot = useTwinCachedAsync("sctwin:readiness:v1", () => fetchReadiness());

  if (snapshot.status === "pending") {
    return <p className="mt-6 text-sm text-zinc-500">Checking module readiness…</p>;
  }

  if (snapshot.status === "rejected") {
    return (
      <aside className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm" role="alert">
        <p className="font-semibold">Readiness unavailable</p>
        <p className="mt-1">The readiness check could not be loaded. Try again later.</p>
      </aside>
    );
  }

  const data = snapshot.data;

  if (data.tag === "error") {
    return (
      <aside className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 shadow-sm" role="alert">
        <p className="font-semibold">Readiness unavailable</p>
        <p className="mt-1">The readiness check could not be loaded. Try again later.</p>
      </aside>
    );
  }

  if (data.ok) {
    return null;
  }

  return (
    <aside
      className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm"
      role="alert"
    >
      <p className="font-semibold text-amber-900">Twin module is not fully ready</p>
      {data.reasons.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900/90">
          {data.reasons.map((r, i) => (
            <li key={`${i}:${r}`}>{r}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-amber-900/90">See operator notes in the developer pack or contact support.</p>
      )}
      <p className="mt-3">
        <a href={docsReadmeHref} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
          docs/sctwin README
        </a>
        <span className="mx-2 text-amber-800/60">·</span>
        <a href={docsTreeHref} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">
          Full spec tree on GitHub
        </a>
      </p>
    </aside>
  );
}

export function TwinReadinessBanner({
  docsReadmeHref,
  docsTreeHref,
}: {
  docsReadmeHref: string;
  docsTreeHref: string;
}) {
  return <TwinReadinessBannerInner docsReadmeHref={docsReadmeHref} docsTreeHref={docsTreeHref} />;
}
