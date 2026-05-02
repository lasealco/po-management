import type { Metadata } from "next";

import { loadTwinAssistantSnapshot } from "@/app/api/supply-chain-twin/assistant/route";
import { requireTwinApiAccess } from "@/lib/supply-chain-twin/sctwin-api-access";
import { requireTwinPageAccess } from "../_lib/require-twin-page-access";

import { TwinAssistantClient } from "./twin-assistant-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Twin Assistant — AR SCMP",
};

export default async function SupplyChainTwinAssistantPage() {
  const gate = await requireTwinPageAccess();
  if (!gate.ok) return gate.deniedUi;

  const apiGate = await requireTwinApiAccess();
  if (!apiGate.ok) {
    return <p className="text-sm text-zinc-600">{apiGate.denied.error}</p>;
  }
  const snapshot = await loadTwinAssistantSnapshot(apiGate.access.tenant.id);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Supply Chain Twin</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900">Twin Assistant</h1>
      <p className="mt-3 max-w-3xl text-sm text-zinc-600">
        Explain graph confidence, turn risk signals into what-if scenario drafts, and queue human review before any
        operational action.
      </p>
      <div className="mt-8">
        <TwinAssistantClient initialSnapshot={snapshot} />
      </div>
    </main>
  );
}
