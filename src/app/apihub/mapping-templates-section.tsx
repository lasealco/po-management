"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { readApiHubErrorMessageFromJsonBody } from "@/lib/apihub/api-error";
import type { ApiHubMappingTemplateAuditTrailDto } from "@/lib/apihub/mapping-template-audit-dto";
import type { ApiHubMappingTemplateDto } from "@/lib/apihub/mapping-template-dto";

import { MappingRulesDiffPanel } from "./mapping-rules-diff-panel";

type Props = {
  initialTemplates: ApiHubMappingTemplateDto[];
  canManage: boolean;
};

const DEFAULT_RULES_JSON = `[
  {
    "sourcePath": "shipment.id",
    "targetField": "shipmentId",
    "transform": "trim",
    "required": true
  }
]`;

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function rulesToJson(rules: ApiHubMappingTemplateDto["rules"]) {
  return `${JSON.stringify(rules, null, 2)}\n`;
}

export function MappingTemplatesSection({ initialTemplates, canManage }: Props) {
  const router = useRouter();
  const [detailBoost, setDetailBoost] = useState<ApiHubMappingTemplateDto | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "detail" | "create" | "edit">("none");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRulesJson, setFormRulesJson] = useState(DEFAULT_RULES_JSON);
  const [formAuditNote, setFormAuditNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [auditRows, setAuditRows] = useState<ApiHubMappingTemplateAuditTrailDto[] | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (detailBoost && initialTemplates.some((t) => t.id === detailBoost.id)) {
      setDetailBoost(null);
    }
  }, [initialTemplates, detailBoost]);

  const templates = useMemo(() => {
    if (!detailBoost) {
      return initialTemplates;
    }
    if (initialTemplates.some((t) => t.id === detailBoost.id)) {
      return initialTemplates;
    }
    return [detailBoost, ...initialTemplates];
  }, [initialTemplates, detailBoost]);

  const selected = useMemo(
    () => (selectedId ? templates.find((t) => t.id === selectedId) ?? null : null),
    [templates, selectedId],
  );

  function openDetail(id: string) {
    setDetailBoost(null);
    setSelectedId(id);
    setPanel("detail");
    setError(null);
    setAuditRows(null);
  }

  function openCreate() {
    setDetailBoost(null);
    setSelectedId(null);
    setPanel("create");
    setFormName("");
    setFormDescription("");
    setFormRulesJson(DEFAULT_RULES_JSON);
    setFormAuditNote("");
    setError(null);
    setAuditRows(null);
  }

  function openEdit() {
    if (!selected) return;
    setPanel("edit");
    setFormName(selected.name);
    setFormDescription(selected.description ?? "");
    setFormRulesJson(rulesToJson(selected.rules));
    setFormAuditNote("");
    setError(null);
    setAuditRows(null);
  }

  function closePanel() {
    setDetailBoost(null);
    setPanel("none");
    setSelectedId(null);
    setError(null);
    setAuditRows(null);
  }

  function parseRulesFromForm(): unknown[] | null {
    try {
      const parsed: unknown = JSON.parse(formRulesJson.trim());
      if (!Array.isArray(parsed)) {
        setError("Rules must be a JSON array.");
        return null;
      }
      return parsed;
    } catch {
      setError("Rules must be valid JSON.");
      return null;
    }
  }

  async function submitCreate() {
    setError(null);
    const rules = parseRulesFromForm();
    if (!rules) return;
    const name = formName.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/apihub/mapping-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: formDescription.trim().length > 0 ? formDescription.trim() : undefined,
          rules,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not create template."));
        return;
      }
      const created = data as { template?: ApiHubMappingTemplateDto };
      if (created.template) {
        setDetailBoost(created.template);
        setSelectedId(created.template.id);
        setPanel("detail");
      } else {
        closePanel();
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitEdit() {
    if (!selected) return;
    setError(null);
    const rules = parseRulesFromForm();
    if (!rules) return;
    const name = formName.trim();
    if (!name) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        description: formDescription.trim().length > 0 ? formDescription.trim() : null,
        rules,
      };
      const note = formAuditNote.trim();
      if (note.length > 0) {
        payload.note = note;
      }
      const res = await fetch(`/api/apihub/mapping-templates/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not update template."));
        return;
      }
      router.refresh();
      setPanel("detail");
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected) return;
    if (!window.confirm(`Delete mapping template “${selected.name}”? This cannot be undone.`)) {
      return;
    }
    setError(null);
    setRowBusyId(selected.id);
    try {
      const res = await fetch(`/api/apihub/mapping-templates/${selected.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not delete template."));
        return;
      }
      closePanel();
      router.refresh();
    } finally {
      setRowBusyId(null);
    }
  }

  async function loadAudit() {
    if (!selected) return;
    setAuditLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apihub/mapping-templates/${selected.id}/audit?limit=20`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(readApiHubErrorMessageFromJsonBody(data, "Could not load audit trail."));
        setAuditRows(null);
        return;
      }
      const body = data as { audit?: ApiHubMappingTemplateAuditTrailDto[] };
      setAuditRows(Array.isArray(body.audit) ? body.audit : []);
    } finally {
      setAuditLoading(false);
    }
  }

  return (
    <section id="mapping-templates" className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Step — Mapping templates</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-900">Mapping templates</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Save reusable field-mapping rule sets for ingestion. Rules are validated on the server; use JSON that
            matches the mapping preview contract (<code className="rounded bg-zinc-100 px-1 font-mono text-xs">sourcePath</code>,{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">targetField</code>, optional{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">transform</code>,{" "}
            <code className="rounded bg-zinc-100 px-1 font-mono text-xs">required</code>).
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => openCreate()}
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
          >
            New template
          </button>
        ) : (
          <p className="max-w-xs text-right text-sm text-zinc-600">
            Choose a demo user in{" "}
            <a href="/settings/demo" className="font-medium text-[var(--arscmp-primary)] hover:underline">
              Settings → Demo session
            </a>{" "}
            to manage templates.
          </p>
        )}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
              <p className="font-medium text-zinc-800">No templates yet</p>
              <p className="mt-2">
                {canManage ? "Create one with “New template” to reuse rules across runs." : "Enable a demo session to add templates."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-200">
              <ul className="divide-y divide-zinc-100">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openDetail(t.id)}
                      className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left text-sm transition hover:bg-zinc-50 ${
                        selectedId === t.id && panel !== "create" ? "bg-zinc-50 ring-1 ring-inset ring-zinc-200" : ""
                      }`}
                    >
                      <span className="font-medium text-zinc-900">{t.name}</span>
                      <span className="text-xs text-zinc-500">
                        {t.rules.length} rule{t.rules.length === 1 ? "" : "s"} · Updated {formatWhen(t.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          {panel === "none" ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-600">
              Select a template from the list, or create a new one.
            </div>
          ) : null}

          {panel === "detail" && selected ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">{selected.name}</h3>
                  <p className="mt-1 text-xs text-zinc-500">Updated {formatWhen(selected.updatedAt)}</p>
                  {selected.description ? (
                    <p className="mt-3 text-sm text-zinc-700">{selected.description}</p>
                  ) : (
                    <p className="mt-3 text-sm italic text-zinc-500">No description</p>
                  )}
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void loadAudit()}
                      disabled={auditLoading}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {auditLoading ? "Loading audit…" : "View audit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit()}
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSelected()}
                      disabled={rowBusyId === selected.id}
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-800 shadow-sm hover:bg-red-50 disabled:opacity-60"
                    >
                      {rowBusyId === selected.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Rules (JSON)</p>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-800">
                {rulesToJson(selected.rules).trimEnd()}
              </pre>
              {auditRows ? (
                <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent audit</p>
                  <ul className="mt-2 space-y-2 text-sm text-zinc-800">
                    {auditRows.length === 0 ? (
                      <li className="text-zinc-500">No audit entries.</li>
                    ) : (
                      auditRows.map((a) => (
                        <li key={a.id} className="border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
                          <span className="font-mono text-xs text-zinc-600">{a.action}</span>
                          <span className="mx-2 text-zinc-400">·</span>
                          <span className="text-xs text-zinc-500">{formatWhen(a.createdAt)}</span>
                          {a.note ? <p className="mt-1 text-xs text-zinc-600">{a.note}</p> : null}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {(panel === "create" || panel === "edit") && canManage ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-zinc-900">{panel === "create" ? "New template" : "Edit template"}</h3>
              <p className="mt-2 text-sm text-zinc-600">
                {panel === "create"
                  ? "Provide a display name and a rules array. The API validates paths and transforms."
                  : "Update fields and save. Optional note is recorded on the audit log only."}
              </p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-zinc-800">Name</span>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm"
                    autoComplete="off"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-zinc-800">Description (optional)</span>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm"
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium text-zinc-800">Rules (JSON array)</span>
                  <textarea
                    value={formRulesJson}
                    onChange={(e) => setFormRulesJson(e.target.value)}
                    rows={12}
                    className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs shadow-sm"
                    spellCheck={false}
                  />
                </label>
                {panel === "edit" ? (
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-zinc-800">Audit note (optional)</span>
                    <input
                      value={formAuditNote}
                      onChange={(e) => setFormAuditNote(e.target.value)}
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm"
                      placeholder="Reason for change"
                      autoComplete="off"
                    />
                  </label>
                ) : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => (panel === "create" ? void submitCreate() : void submitEdit())}
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-60"
                >
                  {busy ? "Saving…" : panel === "create" ? "Create template" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (panel === "create") {
                      closePanel();
                    } else if (selected) {
                      setPanel("detail");
                      setError(null);
                    }
                  }}
                  disabled={busy}
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <MappingRulesDiffPanel templates={templates} />
    </section>
  );
}
