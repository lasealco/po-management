import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { TwinScenariosComparePanel } from "@/components/supply-chain-twin/twin-scenarios-compare-panel";
import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Compare scenarios",
  description: "Side-by-side scenario draft comparison (read-only).",
};

function pickDraftId(
  sp: Record<string, string | string[] | undefined> | undefined,
  key: "left" | "right",
): string | null {
  if (!sp) {
    return null;
  }
  const raw = sp[key];
  const s = Array.isArray(raw) ? raw[0] : raw;
  const t = typeof s === "string" ? s.trim() : "";
  if (!t || t.length > 128) {
    return null;
  }
  return t;
}

export default async function SupplyChainTwinScenariosComparePage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getViewerGrantSet();
  const { linkVisibility } = await resolveNavState(access);

  if (!access?.user) {
    return (
      <AccessDenied
        title="Supply Chain Twin"
        message="Choose an active demo user in Settings → Demo session, then return here."
      />
    );
  }

  if (!linkVisibility?.supplyChainTwin) {
    return (
      <AccessDenied
        title="Supply Chain Twin"
        message="This preview is available for workspace sessions with cross-module access. Try a broader demo role or open the platform hub."
      />
    );
  }

  const sp = (await (props.searchParams ?? Promise.resolve({}))) as Record<string, string | string[] | undefined>;
  const leftId = pickDraftId(sp, "left");
  const rightId = pickDraftId(sp, "right");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TwinSubNav />

      <div className="mb-6">
        <Link
          href="/supply-chain-twin/scenarios"
          className="text-sm font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
        >
          ← Back to scenario drafts
        </Link>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">Compare scenario drafts</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          Read-only side-by-side view of two tenant drafts. Pass{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">left</code> and{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">right</code> query parameters (cuid ids from your
          drafts list). Data loads from{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">GET /api/supply-chain-twin/scenarios/[id]</code> — no
          solver or KPI engine.
        </p>
      </section>

      <div className="mt-6">
        <TwinScenariosComparePanel leftId={leftId} rightId={rightId} />
      </div>
    </main>
  );
}
