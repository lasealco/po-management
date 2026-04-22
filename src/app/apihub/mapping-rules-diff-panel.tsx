"use client";

import { useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubMappingRulesDiffResult } from "@/lib/apihub/mapping-rules-diff";
import type { ApiHubMappingTemplateDto } from "@/lib/apihub/mapping-template-dto";

import { ApiHubAdvancedJsonDisclosure } from "./apihub-advanced-json";

type Props = {
  templates: ApiHubMappingTemplateDto[];
};

const EMPTY_DRAFT = `[
  {
    "sourcePath": "draft.path",
    "targetField": "outField",
    "transform": "trim"
  }
]`;

export function MappingRulesDiffPanel({ templates }: Props) {
  const [templateId, setTemplateId] = useState("");
  const [draftJson, setDraftJson] = useState(EMPTY_DRAFT);
  const [result, setResult] = useState<ApiHubMappingRulesDiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function runDiff() {
    setError(null);
    setResult(null);
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) {
      setError("Choose a template to use as the baseline (reference).");
      return;
    }
    let draft: unknown;
    try {
      draft = JSON.parse(draftJson.trim());
    } catch {
      setError("Draft rules must be valid JSON.");
      return;
    }
    if (!Array.isArray(draft)) {
      setError("Draft rules must be a JSON array.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/apihub/mapping-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baselineRules: tpl.rules,
          compareRules: draft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not compute diff."));
        return;
      }
      const body = data as { diff?: ApiHubMappingRulesDiffResult };
      if (!body.diff) {
        setError("Unexpected response.");
        return;
      }
      setResult(body.diff);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5">
      <h3 className="text-base font-semibold text-zinc-900">Compare draft to template</h3>
      <p className="mt-2 text-sm text-zinc-600">
        Baseline is the <span className="font-medium text-zinc-800">saved template</span>; compare is your{" "}
        <span className="font-medium text-zinc-800">draft JSON</span>. The delta shows what would change if you adopt
        the draft (fields keyed by <code className="font-mono text-xs">targetField</code>).
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">Baseline template</span>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm"
          >
            <option value="">Select template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div />
        <label className="grid gap-1 text-sm lg:col-span-2">
          <span className="font-medium text-zinc-800">Draft rules (JSON array)</span>
          <textarea
            value={draftJson}
            onChange={(e) => setDraftJson(e.target.value)}
            rows={8}
            spellCheck={false}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs shadow-sm"
          />
        </label>
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void runDiff()}
          disabled={busy || templates.length === 0}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
        >
          {busy ? "Computing…" : "Run diff"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-5 space-y-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-800">
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-900">
              Unchanged {result.summary.unchanged}
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-900">
              Added {result.summary.added}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
              Changed {result.summary.changed}
            </span>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-1 text-zinc-800">
              Removed {result.summary.removed}
            </span>
          </div>

          {result.added.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Added in draft</p>
              <ul className="mt-2 space-y-2 text-xs">
                {result.added.map((r) => (
                  <li key={r.targetField} className="rounded border border-sky-100 bg-sky-50/50 px-2 py-2 text-zinc-800">
                    <p className="font-semibold text-sky-950">{r.targetField}</p>
                    <p className="mt-0.5 text-zinc-600">
                      Source: <span className="font-mono text-[11px] text-zinc-800">{r.sourcePath}</span>
                    </p>
                    <div className="mt-2">
                      <ApiHubAdvancedJsonDisclosure
                        value={r}
                        label="Advanced — full rule JSON"
                        maxHeightClass="max-h-36"
                        dark={false}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.removed.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Removed vs template</p>
              <ul className="mt-2 space-y-2 text-xs">
                {result.removed.map((r) => (
                  <li key={r.targetField} className="rounded border border-zinc-200 bg-zinc-50 px-2 py-2 text-zinc-800">
                    <p className="font-semibold text-zinc-900">{r.targetField}</p>
                    <p className="mt-0.5 text-zinc-600">
                      Source: <span className="font-mono text-[11px] text-zinc-800">{r.sourcePath}</span>
                    </p>
                    <div className="mt-2">
                      <ApiHubAdvancedJsonDisclosure
                        value={r}
                        label="Advanced — full rule JSON"
                        maxHeightClass="max-h-36"
                        dark={false}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.changed.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Same target, different rule</p>
              <ul className="mt-2 space-y-3 text-xs">
                {result.changed.map((c) => (
                  <li key={c.targetField} className="rounded border border-amber-200 bg-amber-50/40 px-2 py-2">
                    <p className="font-semibold text-amber-950">{c.targetField}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <ApiHubAdvancedJsonDisclosure
                        value={c.baseline}
                        label="Advanced — template rule"
                        maxHeightClass="max-h-32"
                        dark={false}
                      />
                      <ApiHubAdvancedJsonDisclosure
                        value={c.compare}
                        label="Advanced — draft rule"
                        maxHeightClass="max-h-32"
                        dark={false}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.unchanged.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Unchanged</p>
              <ul className="mt-2 flex flex-wrap gap-1">
                {result.unchanged.map((r) => (
                  <li key={r.targetField} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px] text-emerald-900">
                    {r.targetField}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
