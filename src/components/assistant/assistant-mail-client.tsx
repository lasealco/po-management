"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ThreadRow = {
  id: string;
  subject: string;
  fromAddress: string;
  toAddress: string;
  preview: string;
  receivedAt: string;
  status: string;
  draftReply: string | null;
  lastSendConfirmAt: string | null;
  lastSendMode: string | null;
  linkedCrmAccountId: string | null;
  linkedCrmAccount: { id: string; name: string } | null;
  salesOrder: { id: string; soNumber: string; status: string } | null;
};

type ThreadDetail = ThreadRow & {
  bodyText: string;
  linkedCrmAccount: { id: string; name: string; legalName: string | null } | null;
};

type CrmAccountOpt = { id: string; name: string };
type EmailActionIntent =
  | {
      kind: "ready";
      message: string;
      summary: {
        accountName: string;
        productName: string;
        quantity: number | null;
        unitPrice: number | null;
        requestedDate: string | null;
        warehouseLabel: string | null;
        servedOrgLabel: string | null;
      };
    }
  | { kind: "clarify_account" | "clarify_product"; message: string; options: Array<{ id: string; name: string }> }
  | { kind: "not_found_account" | "not_found_product"; message: string };
type ActionStep = { id: string; label: string; status: "done" | "needs_input" | "available" };
type ActionState = {
  existingSalesOrder: { id: string; soNumber: string; status: string } | null;
  intent: EmailActionIntent | null;
  steps: ActionStep[];
};

export function AssistantMailClient({
  canConfirmSend,
  canPickCrmAccount,
}: {
  canConfirmSend: boolean;
  canPickCrmAccount: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadId = searchParams.get("thread");

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importForm, setImportForm] = useState({
    fromAddress: "",
    toAddress: "",
    subject: "",
    bodyText: "",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mailtoHref, setMailtoHref] = useState<string | null>(null);
  const [crmAccounts, setCrmAccounts] = useState<CrmAccountOpt[]>([]);
  const [linkAccountId, setLinkAccountId] = useState<string>("");
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadList = useCallback(async () => {
    setErr(null);
    const res = await fetch("/api/assistant/email-threads");
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; threads?: ThreadRow[]; error?: string };
    if (!res.ok) {
      setErr(j.error || "Could not load threads.");
      return;
    }
    setThreads(j.threads ?? []);
  }, []);

  const loadActions = useCallback(async (id: string) => {
    const res = await fetch(`/api/assistant/email-threads/${id}/actions`);
    const j = (await res.json().catch(() => ({}))) as ActionState & { ok?: boolean; error?: string };
    if (!res.ok) {
      setActionState(null);
      return;
    }
    setActionState({
      existingSalesOrder: j.existingSalesOrder ?? null,
      intent: j.intent ?? null,
      steps: j.steps ?? [],
    });
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/assistant/email-threads/${id}`);
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; thread?: ThreadDetail; error?: string };
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "Could not load thread.");
      setDetail(null);
      return;
    }
    const t = j.thread ?? null;
    setDetail(t);
    setDraft(t?.draftReply ?? "");
    setLinkAccountId(t?.linkedCrmAccountId ?? "");
    if (t?.id) await loadActions(t.id);
  }, [loadActions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadList();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadList]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (threadId) {
        void loadDetail(threadId);
        return;
      }
      setDetail(null);
      setDraft("");
      setActionState(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [threadId, loadDetail]);

  useEffect(() => {
    if (!canPickCrmAccount) return;
    void (async () => {
      const res = await fetch("/api/crm/accounts");
      if (!res.ok) return;
      const j = (await res.json()) as { accounts?: CrmAccountOpt[] };
      setCrmAccounts(j.accounts ?? []);
    })();
  }, [canPickCrmAccount]);

  const selectThread = (id: string) => {
    router.push(`/assistant/mail?thread=${encodeURIComponent(id)}`);
  };

  const saveDraft = async () => {
    if (!detail) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/assistant/email-threads/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftReply: draft }),
    });
    const parsed: unknown = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(apiClientErrorMessage(parsed, "Could not save draft."));
      return;
    }
    await loadList();
    await loadDetail(detail.id);
  };

  const draftFromEmail = async () => {
    if (!detail) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/assistant/email-threads/${detail.id}/draft-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const parsed = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      draftReply?: string;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setErr(parsed.error || "Could not draft reply.");
      return;
    }
    setDraft(parsed.draftReply ?? "");
    await loadList();
    await loadDetail(detail.id);
  };

  const createSalesOrderFromEmail = async () => {
    if (!detail) return;
    setActionBusy(true);
    setErr(null);
    const res = await fetch(`/api/assistant/email-threads/${detail.id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_sales_order" }),
    });
    const parsed = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      salesOrder?: { id: string; soNumber: string; status: string };
      error?: string;
    };
    setActionBusy(false);
    if (!res.ok) {
      setErr(parsed.error || "Could not create sales order from this email.");
      await loadActions(detail.id);
      return;
    }
    await loadActions(detail.id);
    await loadList();
    await loadDetail(detail.id);
  };

  const saveLink = async () => {
    if (!detail) return;
    setBusy(true);
    const res = await fetch(`/api/assistant/email-threads/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linkedCrmAccountId: linkAccountId || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const parsed: unknown = await res.json();
      setErr(apiClientErrorMessage(parsed, "Could not link account."));
      return;
    }
    await loadDetail(detail.id);
    await loadList();
  };

  const markResolved = async () => {
    if (!detail) return;
    setBusy(true);
    const res = await fetch(`/api/assistant/email-threads/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED" }),
    });
    setBusy(false);
    if (!res.ok) {
      const parsed: unknown = await res.json();
      setErr(apiClientErrorMessage(parsed, "Could not update."));
      return;
    }
    router.push("/assistant/mail");
    await loadList();
  };

  const runConfirmSend = async () => {
    if (!detail || !canConfirmSend) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/assistant/email-threads/${detail.id}/confirm-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "mailto" }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      mailtoHref?: string;
      notice?: string;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setErr(j.error || "Confirm failed.");
      return;
    }
    setMailtoHref(j.mailtoHref ?? null);
    setConfirmOpen(true);
    await loadList();
    if (detail.id) await loadDetail(detail.id);
  };

  const ingest = async () => {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/assistant/email-threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromAddress: importForm.fromAddress,
        toAddress: importForm.toAddress,
        subject: importForm.subject,
        bodyText: importForm.bodyText,
      }),
    });
    const parsed: unknown = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(apiClientErrorMessage(parsed, "Import failed."));
      return;
    }
    const id = (parsed as { thread?: { id?: string } }).thread?.id;
    setImportOpen(false);
    setImportForm({ fromAddress: "", toAddress: "", subject: "", bodyText: "" });
    await loadList();
    if (id) selectThread(id);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="lg:col-span-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Inbox</h2>
          <button
            type="button"
            onClick={() => void loadList()}
            className="text-xs font-medium text-[var(--arscmp-primary)] hover:underline"
          >
            Refresh
          </button>
        </div>
        <button
          type="button"
          onClick={() => setImportOpen((o) => !o)}
          className="mt-3 w-full rounded-xl bg-[var(--arscmp-primary)] px-3 py-2.5 text-sm font-semibold text-white"
        >
          Import inbound (paste)
        </button>
        {importOpen ? (
          <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-sm">
            <label className="block text-xs font-medium text-zinc-600">From</label>
            <input
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              value={importForm.fromAddress}
              onChange={(e) => setImportForm((f) => ({ ...f, fromAddress: e.target.value }))}
              placeholder="customer@example.com"
            />
            <label className="block text-xs font-medium text-zinc-600">To</label>
            <input
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              value={importForm.toAddress}
              onChange={(e) => setImportForm((f) => ({ ...f, toAddress: e.target.value }))}
              placeholder="you@company.com"
            />
            <label className="block text-xs font-medium text-zinc-600">Subject</label>
            <input
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              value={importForm.subject}
              onChange={(e) => setImportForm((f) => ({ ...f, subject: e.target.value }))}
            />
            <label className="block text-xs font-medium text-zinc-600">Body</label>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              value={importForm.bodyText}
              onChange={(e) => setImportForm((f) => ({ ...f, bodyText: e.target.value }))}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void ingest()}
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Add to inbox
            </button>
          </div>
        ) : null}
        <ul className="mt-4 max-h-[60vh] space-y-1 overflow-y-auto">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => selectThread(t.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm ${
                  threadId === t.id
                    ? "border-[var(--arscmp-primary)] bg-sky-50/80"
                    : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
              >
                <p className="truncate font-medium text-zinc-900">{t.subject}</p>
                <p className="truncate text-xs text-zinc-600">{t.fromAddress}</p>
                <p className="text-[11px] text-zinc-500">
                  {t.status} · {new Date(t.receivedAt).toLocaleString()}
                </p>
                {t.salesOrder ? (
                  <p className="mt-1 text-[11px] font-medium text-emerald-700">SO {t.salesOrder.soNumber}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        {threads.length === 0 ? <p className="mt-4 text-sm text-zinc-500">No threads yet. Import a message above.</p> : null}
      </section>

      <section className="lg:col-span-8">
        {err ? <p className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{err}</p> : null}

        {detail ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Inbound</p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-900">{detail.subject}</h3>
              <p className="mt-1 text-sm text-zinc-600">
                <span className="font-medium">From</span> {detail.fromAddress}
              </p>
              <p className="text-sm text-zinc-600">
                <span className="font-medium">To</span> {detail.toAddress}
              </p>
              {detail.linkedCrmAccount ? (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Linked</span>{" "}
                  <Link className="text-[var(--arscmp-primary)] hover:underline" href={`/crm/accounts/${detail.linkedCrmAccount.id}`}>
                    {detail.linkedCrmAccount.name}
                  </Link>
                </p>
              ) : null}
              {detail.salesOrder ? (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Sales order</span>{" "}
                  <Link className="text-[var(--arscmp-primary)] hover:underline" href={`/sales-orders/${detail.salesOrder.id}`}>
                    {detail.salesOrder.soNumber}
                  </Link>{" "}
                  <span className="text-xs text-zinc-500">({detail.salesOrder.status})</span>
                </p>
              ) : null}
              <div className="mt-3 whitespace-pre-wrap rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-sm text-zinc-800">
                {detail.bodyText}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Action playbook</p>
              <h3 className="mt-1 text-base font-semibold text-zinc-900">Email to order / reply</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {(actionState?.steps ?? []).map((step, idx) => (
                  <div key={step.id} className="rounded-xl border border-white/70 bg-white p-3 text-xs shadow-sm">
                    <p className="font-semibold text-zinc-900">Step {idx + 1}</p>
                    <p className="mt-1 text-zinc-700">{step.label}</p>
                    <p
                      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        step.status === "done"
                          ? "bg-emerald-100 text-emerald-800"
                          : step.status === "needs_input"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {step.status.replace("_", " ")}
                    </p>
                  </div>
                ))}
              </div>
              {actionState?.intent?.kind === "ready" ? (
                <div className="mt-3 rounded-xl border border-white/70 bg-white p-3 text-sm">
                  <p className="font-medium text-zinc-900">Detected order</p>
                  <p className="mt-1 text-zinc-600">
                    {actionState.intent.summary.accountName} · {actionState.intent.summary.productName} · Qty{" "}
                    {actionState.intent.summary.quantity ?? "?"} · {actionState.intent.summary.requestedDate ?? "date TBD"}
                  </p>
                </div>
              ) : actionState?.intent ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {actionState.intent.message}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {actionState?.existingSalesOrder || detail.salesOrder ? (
                  <Link
                    href={`/sales-orders/${(actionState?.existingSalesOrder ?? detail.salesOrder)!.id}`}
                    className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    Open draft SO
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={actionBusy || actionState?.intent?.kind !== "ready"}
                    onClick={() => void createSalesOrderFromEmail()}
                    className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {actionBusy ? "Creating..." : "Create draft SO"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void draftFromEmail()}
                  className="rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-sky-950 hover:bg-sky-50 disabled:opacity-50"
                >
                  Draft reply
                </button>
              </div>
            </div>

            {canPickCrmAccount && crmAccounts.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="min-w-[200px] flex-1">
                  <label className="text-xs font-medium text-zinc-600">Link CRM account (optional)</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
                    value={linkAccountId}
                    onChange={(e) => setLinkAccountId(e.target.value)}
                  >
                    <option value="">— None —</option>
                    {crmAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveLink()}
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Save link
                </button>
              </div>
            ) : null}

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Draft reply (never auto-sent)</p>
              <textarea
                className="mt-2 min-h-[180px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={busy}
                placeholder="Write a reply. Saving stores a draft only. Sending requires an explicit confirm step."
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void draftFromEmail()}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-950 hover:bg-sky-100 disabled:opacity-50"
                >
                  Draft reply from email
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveDraft()}
                  className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busy || !canConfirmSend}
                  onClick={() => void runConfirmSend()}
                  className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirm &amp; open send (mailto)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void markResolved()}
                  className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-800"
                >
                  Mark resolved
                </button>
              </div>
              {!canConfirmSend ? (
                <p className="mt-2 text-xs text-amber-900">Grant org.orders → edit to use the confirm-send control.</p>
              ) : null}
              {detail.lastSendConfirmAt ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Last confirm logged: {new Date(detail.lastSendConfirmAt).toLocaleString()} (
                  {detail.lastSendMode ?? "—"})
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Select a thread or import an inbound message.</p>
        )}

        <div className="mt-8 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-4 text-sm text-zinc-600">
          <p className="font-medium text-zinc-800">Connector roadmap</p>
          <p className="mt-1">
            Gmail and Microsoft 365 OAuth are not enabled in this build. The pilot uses <strong>manual import</strong>{" "}
            and a <strong>mailto</strong> handoff so nothing is sent from the server without your mail client. Set{" "}
            <code className="rounded bg-zinc-200/80 px-1">ASSISTANT_EMAIL_PILOT=0</code> to hide this pilot if needed.
          </p>
        </div>
      </section>

      {confirmOpen && mailtoHref ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg">
            <p className="text-sm font-semibold text-zinc-900">Confirm before send</p>
            <p className="mt-2 text-sm text-zinc-600">
              Your confirmation was recorded. Open the link below in your default mail client to send from your
              mailbox. The app does not send email on your behalf in this pilot.
            </p>
            <a
              href={mailtoHref}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--arscmp-primary)] px-4 py-3 text-sm font-semibold text-white"
            >
              Open mailto draft
            </a>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                setMailtoHref(null);
              }}
              className="mt-2 w-full rounded-lg border border-zinc-300 py-2 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
