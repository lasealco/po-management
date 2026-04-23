"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ScriTuningDto } from "@/lib/scri/tuning-repo";
import type { WatchlistRuleDto } from "@/lib/scri/watchlist-repo";

type UserOpt = { id: string; name: string; email: string };

export function ScriRiskSettingsClient({
  initialTuning,
  initialRules,
  users,
  canEdit,
}: {
  initialTuning: ScriTuningDto & { persisted: boolean };
  initialRules: WatchlistRuleDto[];
  users: UserOpt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [trustMin, setTrustMin] = useState(
    initialTuning.sourceTrustMin != null ? String(initialTuning.sourceTrustMin) : "",
  );
  const [highlight, setHighlight] = useState(initialTuning.severityHighlightMin ?? "");
  const [aliasesText, setAliasesText] = useState(JSON.stringify(initialTuning.geoAliases, null, 2));
  const [autoWatch, setAutoWatch] = useState(initialTuning.automationAutoWatch);
  const [autoSev, setAutoSev] = useState(initialTuning.automationMinSeverity);
  const [actorId, setActorId] = useState(initialTuning.automationActorUserId ?? "");

  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleTypes, setNewRuleTypes] = useState("");
  const [newRuleCountries, setNewRuleCountries] = useState("");

  async function saveTuning() {
    if (!canEdit) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      let geoAliases: Record<string, string> = {};
      try {
        const parsed = JSON.parse(aliasesText || "{}") as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          geoAliases = parsed as Record<string, string>;
        } else {
          throw new Error("Geo aliases must be a JSON object.");
        }
      } catch {
        setErr("Geo aliases must be valid JSON object, e.g. {\"UK\":\"GB\"}.");
        return;
      }

      const rawTrust = trustMin.trim() === "" ? null : parseInt(trustMin, 10);
      const sourceTrustMin =
        rawTrust == null || !Number.isFinite(rawTrust)
          ? null
          : Math.min(100, Math.max(0, rawTrust));

      const res = await fetch("/api/scri/tuning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTrustMin,
          severityHighlightMin: highlight === "" ? null : highlight,
          geoAliases,
          automationAutoWatch: autoWatch,
          automationMinSeverity: autoSev,
          automationActorUserId: actorId === "" ? null : actorId,
        }),
      });
      const payload = (await res.json()) as { error?: string; tuning?: ScriTuningDto };
      if (!res.ok) {
        setErr(payload.error ?? "Save failed.");
        return;
      }
      if (payload.tuning) {
        setMsg("Tuning saved.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function addRule() {
    if (!canEdit || !newRuleName.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const eventTypes = newRuleTypes
        .split(/[, \n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const countryCodes = newRuleCountries
        .split(/[, \n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/scri/watchlist-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRuleName.trim(), eventTypes, countryCodes }),
      });
      const payload = (await res.json()) as { error?: string; rule?: WatchlistRuleDto };
      if (!res.ok) {
        setErr(payload.error ?? "Could not add rule.");
        return;
      }
      if (payload.rule) {
        setRules((r) => [...r, payload.rule!]);
        setNewRuleName("");
        setNewRuleTypes("");
        setNewRuleCountries("");
        setMsg("Watchlist rule added.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(id: string, isActive: boolean) {
    if (!canEdit) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/scri/watchlist-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const payload = (await res.json()) as { error?: string; rule?: WatchlistRuleDto };
      if (!res.ok) {
        setErr(payload.error ?? "Update failed.");
        return;
      }
      if (payload.rule) {
        setRules((prev) => prev.map((r) => (r.id === id ? payload.rule! : r)));
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(id: string) {
    if (!canEdit) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/scri/watchlist-rules/${id}`, { method: "DELETE" });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(payload.error ?? "Delete failed.");
        return;
      }
      setRules((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <h2 className="mt-2 text-lg font-semibold text-zinc-900">Trust, geography, automation</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Tuning applies on ingest. Set <span className="font-medium text-zinc-800">SCR_AUTOMATION_DISABLED=1</span> in
          the environment to disable auto-watch globally.
        </p>
        {msg ? <p className="mt-3 text-sm text-emerald-700">{msg}</p> : null}
        {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-zinc-700">
            Source trust floor (0–100, empty = off)
            <input
              type="number"
              min={0}
              max={100}
              value={trustMin}
              onChange={(e) => setTrustMin(e.target.value)}
              disabled={!canEdit || busy}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm text-zinc-700">
            Dashboard severity highlight (empty = off)
            <select
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              disabled={!canEdit || busy}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="INFO">INFO+</option>
              <option value="LOW">LOW+</option>
              <option value="MEDIUM">MEDIUM+</option>
              <option value="HIGH">HIGH+</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
        </div>
        <label className="mt-4 block text-sm text-zinc-700">
          Geography aliases (JSON object)
          <textarea
            value={aliasesText}
            onChange={(e) => setAliasesText(e.target.value)}
            disabled={!canEdit || busy}
            rows={4}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs"
          />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={autoWatch}
              onChange={(e) => setAutoWatch(e.target.checked)}
              disabled={!canEdit || busy}
            />
            Auto-watch new events
          </label>
          <label className="text-sm text-zinc-700">
            from
            <select
              value={autoSev}
              onChange={(e) => setAutoSev(e.target.value as typeof autoSev)}
              disabled={!canEdit || busy}
              className="ml-2 rounded-lg border border-zinc-200 px-2 py-1 text-sm"
            >
              <option value="INFO">INFO</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
        </div>
        <label className="mt-3 block text-sm text-zinc-700">
          Automation actor (triage log author)
          <select
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            disabled={!canEdit || busy}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </label>
        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveTuning()}
            className="mt-5 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save tuning
          </button>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">You need org.scri → edit to change tuning.</p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Watchlist rules</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Empty event-type or country lists mean &quot;match all&quot;. Rules power dashboard watchlist counts and feed
          badges.
        </p>
        <ul className="mt-4 divide-y divide-zinc-100">
          {rules.map((r) => (
            <li key={r.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-zinc-900">{r.name}</span>
                <span className="text-xs text-zinc-500">{r.isActive ? "Active" : "Off"}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Types: {r.eventTypes.length ? r.eventTypes.join(", ") : "any"} · Countries:{" "}
                {r.countryCodes.length ? r.countryCodes.join(", ") : "any"}
                {r.minSeverity ? ` · min ${r.minSeverity}` : ""}
              </p>
              {canEdit ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleRule(r.id, r.isActive)}
                    className="rounded-lg border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700"
                  >
                    {r.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeRule(r.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <div className="mt-6 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">New rule</p>
            <input
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              placeholder="Rule name"
              disabled={busy}
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
            <input
              value={newRuleTypes}
              onChange={(e) => setNewRuleTypes(e.target.value)}
              placeholder="Event types (comma-separated, e.g. PORT_CONGESTION)"
              disabled={busy}
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
            <input
              value={newRuleCountries}
              onChange={(e) => setNewRuleCountries(e.target.value)}
              placeholder="ISO countries (comma-separated, e.g. US,CN)"
              disabled={busy}
              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void addRule()}
              className="mt-3 rounded-xl bg-[var(--arscmp-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Add rule
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
