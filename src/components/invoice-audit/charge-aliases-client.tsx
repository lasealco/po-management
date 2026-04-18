"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { RecordIdCopy } from "@/components/invoice-audit/record-id-copy";
import { INVOICE_CHARGE_ALIAS_TARGET_KINDS } from "@/lib/invoice-audit/invoice-charge-alias-constants";
import { formatInvoiceAuditApiError } from "@/lib/invoice-audit/invoice-audit-api-client-error";

export type SerializedInvoiceChargeAlias = {
  id: string;
  tenantId: string;
  name: string | null;
  pattern: string;
  canonicalTokens: string[];
  targetKind: string | null;
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

function tokensSummary(tokens: string[], max = 4): string {
  if (tokens.length === 0) return "—";
  const head = tokens.slice(0, max).join("; ");
  return tokens.length > max ? `${head} (+${tokens.length - max} more)` : head;
}

export function ChargeAliasesClient(props: { canEdit: boolean; initialAliases: SerializedInvoiceChargeAlias[] }) {
  const router = useRouter();
  const [aliases, setAliases] = useState(props.initialAliases);
  useEffect(() => {
    setAliases(props.initialAliases);
  }, [props.initialAliases]);

  const [actionError, setActionError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState("");
  const [tokensText, setTokensText] = useState("");
  const [targetKind, setTargetKind] = useState<string>("");
  const [priority, setPriority] = useState("10");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    pattern: string;
    tokensText: string;
    targetKind: string;
    priority: string;
  } | null>(null);

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateBusy(true);
    setActionError(null);
    try {
      const pr = Number.parseInt(priority, 10);
      if (!pattern.trim()) {
        setActionError("Pattern is required (substring matched on normalized invoice text).");
        return;
      }
      if (!tokensText.trim()) {
        setActionError("Enter at least one canonical token (snapshot label hints), one per line or comma-separated.");
        return;
      }
      if (!Number.isFinite(pr)) {
        setActionError("Priority must be a number.");
        return;
      }
      const res = await fetch("/api/invoice-audit/charge-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          pattern: pattern.trim(),
          canonicalTokens: tokensText,
          targetKind: targetKind.trim() || null,
          priority: pr,
          active: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Parameters<typeof formatInvoiceAuditApiError>[0];
      if (!res.ok) {
        setActionError(formatInvoiceAuditApiError(data, res.status));
        return;
      }
      setName("");
      setPattern("");
      setTokensText("");
      setTargetKind("");
      setPriority("10");
      router.refresh();
    } finally {
      setCreateBusy(false);
    }
  }

  async function toggleActive(row: SerializedInvoiceChargeAlias) {
    setRowBusyId(row.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/invoice-audit/charge-aliases/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !row.active }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Parameters<typeof formatInvoiceAuditApiError>[0];
        setActionError(formatInvoiceAuditApiError(data, res.status));
        return;
      }
      router.refresh();
    } finally {
      setRowBusyId(null);
    }
  }

  function startEdit(row: SerializedInvoiceChargeAlias) {
    setEditingId(row.id);
    setEditDraft({
      name: row.name ?? "",
      pattern: row.pattern,
      tokensText: row.canonicalTokens.join("\n"),
      targetKind: row.targetKind ?? "",
      priority: String(row.priority),
    });
    setActionError(null);
  }

  async function saveEdit(rowId: string) {
    if (!editDraft) return;
    setRowBusyId(rowId);
    setActionError(null);
    try {
      const pr = Number.parseInt(editDraft.priority, 10);
      if (!editDraft.pattern.trim()) {
        setActionError("Pattern cannot be empty.");
        return;
      }
      if (!editDraft.tokensText.trim()) {
        setActionError("At least one canonical token is required.");
        return;
      }
      if (!Number.isFinite(pr)) {
        setActionError("Priority must be a number.");
        return;
      }
      const res = await fetch(`/api/invoice-audit/charge-aliases/${encodeURIComponent(rowId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editDraft.name.trim() || null,
          pattern: editDraft.pattern.trim(),
          canonicalTokens: editDraft.tokensText,
          targetKind: editDraft.targetKind.trim() || null,
          priority: pr,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Parameters<typeof formatInvoiceAuditApiError>[0];
      if (!res.ok) {
        setActionError(formatInvoiceAuditApiError(data, res.status));
        return;
      }
      setEditingId(null);
      setEditDraft(null);
      router.refresh();
    } finally {
      setRowBusyId(null);
    }
  }

  const sorted = [...aliases].sort((a, b) => b.priority - a.priority || (a.name ?? "").localeCompare(b.name ?? ""));

  return (
    <>
      {actionError && props.canEdit ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>
      ) : null}

      {props.canEdit ? (
        <form onSubmit={(e) => void submitCreate(e)} className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
          <p className="text-sm font-medium text-zinc-800">Add alias</p>
          <p className="mt-1 text-xs text-zinc-600">
            When the normalized invoice line contains <span className="font-medium">pattern</span> (case-insensitive
            substring), the matcher appends <span className="font-medium">canonical tokens</span> for scoring against
            snapshot lines. Higher <span className="font-medium">priority</span> runs first. Optional{" "}
            <span className="font-medium">target kind</span> limits boosts to contract rates, contract charges, or RFQ
            lines only.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <span className="font-medium text-zinc-600">Display name (optional)</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="font-medium text-zinc-600">Priority</span>
              <input
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="grid gap-1 text-xs sm:col-span-2">
              <span className="font-medium text-zinc-600">Pattern (substring)</span>
              <input
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
                placeholder="e.g. terminal handling"
              />
            </label>
            <label className="grid gap-1 text-xs sm:col-span-2">
              <span className="font-medium text-zinc-600">Canonical tokens</span>
              <textarea
                value={tokensText}
                onChange={(e) => setTokensText(e.target.value)}
                rows={3}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
                placeholder={"thc\nterminal handling"}
              />
            </label>
            <label className="grid gap-1 text-xs sm:col-span-2">
              <span className="font-medium text-zinc-600">Target kind (optional)</span>
              <select
                value={targetKind}
                onChange={(e) => setTargetKind(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm"
              >
                <option value="">Any snapshot line kind</option>
                {INVOICE_CHARGE_ALIAS_TARGET_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={createBusy}
            className="mt-4 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50"
          >
            {createBusy ? "Saving…" : "Create alias"}
          </button>
        </form>
      ) : null}

      <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600">
              <th className="py-3 pl-4 pr-2">Name / pattern</th>
              <th className="py-3 pr-2">Alias id</th>
              <th className="py-3 pr-2">Tokens</th>
              <th className="py-3 pr-2">Target</th>
              <th className="py-3 pr-2">Pri</th>
              <th className="py-3 pr-2">Active</th>
              {props.canEdit ? <th className="py-3 pr-4">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={props.canEdit ? 7 : 6} className="px-4 py-10 text-center text-zinc-500">
                  No charge aliases yet. Seed data may add examples; otherwise create one above.
                </td>
              </tr>
            ) : null}
            {sorted.map((r) => {
              const editing = editingId === r.id && editDraft;
              return (
                <tr key={r.id} className="border-b border-zinc-100 align-top">
                  <td className="max-w-[14rem] py-3 pl-4 pr-2">
                    {editing ? (
                      <div className="grid gap-2">
                        <input
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs"
                          placeholder="Display name"
                        />
                        <input
                          value={editDraft.pattern}
                          onChange={(e) => setEditDraft((d) => (d ? { ...d, pattern: e.target.value } : d))}
                          className="rounded border border-zinc-300 px-2 py-1 font-mono text-xs"
                          placeholder="pattern"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="font-medium text-zinc-900">{r.name ?? "—"}</div>
                        <div className="mt-0.5 font-mono text-xs text-zinc-600">{r.pattern}</div>
                      </>
                    )}
                  </td>
                  <td className="py-3 pr-2 align-top">
                    <RecordIdCopy id={r.id} copyButtonLabel="Copy alias id" />
                  </td>
                  <td className="max-w-[12rem] py-3 pr-2 text-xs text-zinc-700">
                    {editing ? (
                      <textarea
                        value={editDraft.tokensText}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, tokensText: e.target.value } : d))}
                        rows={4}
                        className="w-full rounded border border-zinc-300 px-2 py-1 font-mono text-[11px]"
                      />
                    ) : (
                      tokensSummary(r.canonicalTokens)
                    )}
                  </td>
                  <td className="py-3 pr-2 font-mono text-xs text-zinc-600">
                    {editing ? (
                      <select
                        value={editDraft.targetKind}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, targetKind: e.target.value } : d))}
                        className="max-w-full rounded border border-zinc-300 px-1 py-1 text-[11px]"
                      >
                        <option value="">Any</option>
                        {INVOICE_CHARGE_ALIAS_TARGET_KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    ) : (
                      (r.targetKind ?? "—")
                    )}
                  </td>
                  <td className="py-3 pr-2 tabular-nums text-zinc-700">
                    {editing ? (
                      <input
                        value={editDraft.priority}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, priority: e.target.value } : d))}
                        className="w-16 rounded border border-zinc-300 px-1 py-1 text-xs"
                      />
                    ) : (
                      r.priority
                    )}
                  </td>
                  <td className="py-3 pr-2 text-xs text-zinc-600">{r.active ? "Yes" : "No"}</td>
                  {props.canEdit ? (
                    <td className="py-3 pr-4">
                      <div className="flex flex-col gap-2">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              disabled={rowBusyId === r.id}
                              onClick={() => void saveEdit(r.id)}
                              className="text-left text-xs font-semibold text-[var(--arscmp-primary)] hover:underline disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={rowBusyId === r.id}
                              onClick={() => {
                                setEditingId(null);
                                setEditDraft(null);
                              }}
                              className="text-left text-xs text-zinc-600 hover:underline"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={rowBusyId === r.id}
                              onClick={() => startEdit(r)}
                              className="text-left text-xs font-medium text-[var(--arscmp-primary)] hover:underline disabled:opacity-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={rowBusyId === r.id}
                              onClick={() => void toggleActive(r)}
                              className="text-left text-xs text-zinc-600 hover:underline disabled:opacity-50"
                            >
                              {rowBusyId === r.id ? "…" : r.active ? "Deactivate" : "Activate"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
