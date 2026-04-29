"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

type Snapshot = {
  signals: {
    agents: number;
    highRiskAgents: number;
    toolScopes: number;
    promptAssets: number;
    memoryCandidates: number;
    observabilitySignals: number;
    previewScore: number;
  };
  preview: {
    governanceScore: number;
    leadershipSummary: string;
    agentRegistry: { agents: Array<{ agentKey: string; label: string; status: string; evidenceCoveragePct: number; negativeFeedbackCount: number; toolScopeCount: number; certificationOwner: string }>; highRiskAgents: unknown[] };
    toolScopes: { scopes: Array<{ actionKind: string; label: string; status: string; readinessScore: number; threshold: number; risk: string }>; highRiskScopes: unknown[]; reviewRequired: unknown[] };
    promptSupplyChain: { promptCount: number; approvedCount: number; draftCount: number; domains: string[]; reviewQueue: Array<{ id: string; title: string; status: string; domain: string | null }>; guardrail: string };
    memoryGovernance: { policyCount: number; policies: string[]; weakEvidenceCount: number; correctionCandidates: Array<{ auditEventId: string; surface: string; answerKind: string }> };
    observability: { evidenceCoveragePct: number; negativeFeedbackCount: number; openIncidentCount: number; highIncidentCount: number; actionBacklogCount: number; signalCount: number };
    certificationPlan: { status: string; owners: string[]; blockers: string[]; steps: string[] };
    rollbackPlan: { steps: string[] };
  };
  packets: Array<{
    id: string;
    title: string;
    status: string;
    governanceScore: number;
    agentCount: number;
    highRiskAgentCount: number;
    toolScopeCount: number;
    promptAssetCount: number;
    memoryPolicyCount: number;
    observabilitySignalCount: number;
    agentRegistryJson: unknown;
    toolScopeJson: unknown;
    promptSupplyChainJson: unknown;
    memoryGovernanceJson: unknown;
    observabilityJson: unknown;
    certificationPlanJson: unknown;
    rollbackPlanJson: unknown;
    leadershipSummary: string;
    actionQueueItemId: string | null;
    certifiedAt: string | null;
    certificationNote: string | null;
    updatedAt: string;
  }>;
};

function readArray<T>(value: unknown, key?: string): T[] {
  const next = key && value && typeof value === "object" ? (value as Record<string, unknown>)[key] : value;
  return Array.isArray(next) ? (next as T[]) : [];
}

export function AgentGovernanceClient({ initialSnapshot, canEdit }: { initialSnapshot: Snapshot; canEdit: boolean }) {
  const [data, setData] = useState(initialSnapshot);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/assistant/agent-governance", { cache: "no-store" });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not load agent governance."));
      return;
    }
    setData(raw as Snapshot);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function post(action: string, body: Record<string, unknown>, success: string) {
    if (!canEdit) return;
    setBusy(String(body.packetId ?? action));
    setError(null);
    setMessage(null);
    const res = await fetch("/api/assistant/agent-governance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    const raw = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(apiClientErrorMessage(raw, "Could not update agent governance."));
      return;
    }
    setMessage(success);
    if (raw && typeof raw === "object" && "snapshot" in raw) setData((raw as { snapshot: Snapshot }).snapshot);
    else await load();
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You can view Sprint 1, but creating packets and certification actions require settings or reports edit access.
        </div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Sprint 1</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-950">Agent Governance Control Plane</h2>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Govern assistant agents as certified operating assets: registry, tool scopes, prompt supply chain, memory policy,
              observability, certification, review queue, and rollback controls in one durable workflow.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Preview score</p>
            <p className="mt-1 text-3xl font-semibold text-zinc-950">{data.preview.governanceScore}</p>
            <p className="text-sm text-zinc-600">{data.preview.certificationPlan.status}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ["Step 1", "Observe agents", "Inventory assistant surfaces, prompts, tools, memory candidates, and incidents."],
            ["Step 2", "Create packet", "Persist registry, scopes, supply-chain, memory, certification, and rollback evidence."],
            ["Step 3", "Certify by review", "Queue certification or mark certified without silently changing tools, prompts, or memories."],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--arscmp-primary)]">{step}</p>
              <h3 className="mt-2 text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!canEdit || busy === "create_packet"}
          onClick={() => void post("create_packet", {}, "Agent governance packet created.")}
          className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Create Sprint 1 packet
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Agents", data.signals.agents],
          ["High risk", data.signals.highRiskAgents],
          ["Tools", data.signals.toolScopes],
          ["Prompts", data.signals.promptAssets],
          ["Memory", data.signals.memoryCandidates],
          ["Signals", data.signals.observabilitySignals],
          ["Score", data.signals.previewScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Live Registry Preview</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{data.preview.leadershipSummary}</p>
          <div className="mt-4 space-y-3">
            {data.preview.agentRegistry.agents.slice(0, 8).map((agent) => (
              <article key={agent.agentKey} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">{agent.status} · {agent.certificationOwner}</p>
                <h4 className="mt-1 font-semibold capitalize text-zinc-950">{agent.label}</h4>
                <p className="mt-1 text-sm text-zinc-600">
                  Evidence {agent.evidenceCoveragePct}% · negative feedback {agent.negativeFeedbackCount} · tool scopes {agent.toolScopeCount}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-950">Tool, Prompt, and Memory Controls</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Tool scopes</p>
              <p className="mt-1 text-sm text-zinc-600">
                {data.preview.toolScopes.reviewRequired.length} review-required scope(s), {data.preview.toolScopes.highRiskScopes.length} high-risk.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Prompt supply chain</p>
              <p className="mt-1 text-sm text-zinc-600">
                {data.preview.promptSupplyChain.approvedCount}/{data.preview.promptSupplyChain.promptCount} approved across {data.preview.promptSupplyChain.domains.join(", ") || "general"}.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Memory governance</p>
              <p className="mt-1 text-sm text-zinc-600">
                {data.preview.memoryGovernance.policyCount} policy controls and {data.preview.memoryGovernance.weakEvidenceCount} correction candidate(s).
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="font-semibold text-zinc-950">Certification blockers</p>
              <p className="mt-1 text-sm text-zinc-600">{data.preview.certificationPlan.blockers.slice(0, 4).join("; ") || "No blockers in the live preview."}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-zinc-950">Durable Sprint Packets</h3>
        <div className="mt-4 space-y-4">
          {data.packets.map((packet) => {
            const agents = readArray<{ label: string; status: string; evidenceCoveragePct: number }>(packet.agentRegistryJson, "agents");
            const scopes = readArray<{ actionKind: string; risk: string; status: string }>(packet.toolScopeJson, "scopes");
            const cert = packet.certificationPlanJson && typeof packet.certificationPlanJson === "object" ? (packet.certificationPlanJson as { status?: string; blockers?: string[]; steps?: string[] }) : {};
            const rollback = readArray<string>(packet.rollbackPlanJson, "steps");
            return (
              <article key={packet.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--arscmp-primary)]">
                      {packet.status} · score {packet.governanceScore}/100 · updated {new Date(packet.updatedAt).toLocaleString()}
                    </p>
                    <h4 className="mt-1 font-semibold text-zinc-950">{packet.title}</h4>
                    <p className="mt-1 text-sm text-zinc-600">
                      Agents {packet.agentCount} · high risk {packet.highRiskAgentCount} · tools {packet.toolScopeCount} · prompts {packet.promptAssetCount} · telemetry {packet.observabilitySignalCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "REVIEW_QUEUED" || packet.status === "CERTIFIED"}
                      onClick={() => void post("queue_certification", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Certification review queued.")}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 disabled:opacity-50"
                    >
                      Queue review
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit || busy === packet.id || packet.status === "CERTIFIED"}
                      onClick={() => void post("certify_packet", { packetId: packet.id, note: notes[packet.id] ?? "" }, "Packet certified.")}
                      className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      Mark certified
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm text-zinc-700">{packet.leadershipSummary}</pre>
                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Agents</p>
                    <p className="mt-1">{agents.slice(0, 2).map((agent) => `${agent.label} ${agent.evidenceCoveragePct}%`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Tool scopes</p>
                    <p className="mt-1">{scopes.slice(0, 2).map((scope) => `${scope.risk} ${scope.actionKind}`).join("; ") || "None"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Certification</p>
                    <p className="mt-1">{cert.status ?? "Unknown"} · {(cert.blockers ?? []).slice(0, 2).join("; ") || "No blockers"}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-sm text-zinc-700">
                    <p className="font-semibold text-zinc-950">Rollback</p>
                    <p className="mt-1">{rollback.slice(0, 2).join("; ") || "No rollback steps"}</p>
                  </div>
                </div>
                <textarea
                  value={notes[packet.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [packet.id]: event.target.value }))}
                  placeholder="Optional certification note..."
                  className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800"
                />
              </article>
            );
          })}
          {data.packets.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">No Sprint 1 packets yet. Create one from the live preview.</p> : null}
        </div>
      </section>
    </div>
  );
}
