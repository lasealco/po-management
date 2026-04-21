import type { Metadata } from "next";
import Link from "next/link";

import { AccessDenied } from "@/components/access-denied";
import { TwinScenariosComparePanel } from "@/components/supply-chain-twin/twin-scenarios-compare-panel";
import { parseTwinScenarioDraftQueryValue } from "@/components/supply-chain-twin/twin-scenario-draft-id";
import { TwinSubNav } from "@/components/supply-chain-twin/twin-subnav";
import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supply Chain Twin — Compare scenarios",
  description: "Side-by-side scenario draft comparison (read-only).",
};

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
  const left = parseTwinScenarioDraftQueryValue(sp.left);
  const right = parseTwinScenarioDraftQueryValue(sp.right);
  const showInvalidHint = left.status === "invalid" || right.status === "invalid";

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
          Read-only side-by-side view of two tenant drafts. Use{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">left</code> and{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">right</code> query parameters with the same
          lowercase ids shown in your drafts list (format matches{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">GET /api/supply-chain-twin/scenarios/[id]</code>
          ). No solver or KPI engine.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-zinc-600">
          After <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">db:seed</code> / twin demo seed, pick any two
          draft rows from the scenarios list: empty <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">{}</code>{" "}
          bodies still render, and the diff panel highlights top-level key adds/removes once you diverge the JSON (for
          example via PATCH on each draft).
        </p>
      </section>

      {showInvalidHint ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          One or more query values are not in the expected draft id shape. Fix the URL or open this page without query
          parameters—invalid ids are not sent to the server.
        </div>
      ) : null}

      <div className="mt-6">
        <TwinScenariosComparePanel left={left} right={right} />
      </div>
    </main>
  );
}
