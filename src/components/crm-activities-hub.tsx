"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ActivityRow = {
  id: string;
  type: string;
  subject: string;
  status: string;
  dueDate: string | null;
  relatedAccountId: string | null;
  relatedOpportunityId: string | null;
  owner: { name: string };
  relatedAccount: { id: string; name: string } | null;
  relatedOpportunity: { id: string; name: string } | null;
};

type AccountOpt = { id: string; name: string };

export function CrmActivitiesHub() {
  const searchParams = useSearchParams();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const statusFilter = (searchParams.get("status") || "").toUpperCase();
  const dueFilter = (searchParams.get("due") || "").toLowerCase();
  const now = new Date();
  const visibleActivities = activities.filter((row) => {
    if (statusFilter && row.status.toUpperCase() !== statusFilter) return false;
    if (dueFilter === "overdue") {
      if (!row.dueDate) return false;
      if (row.status.toUpperCase() === "DONE" || row.status.toUpperCase() === "CANCELLED") return false;
      return new Date(row.dueDate) < now;
    }
    return true;
  });

  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [subject, setSubject] = useState("");
  const [type, setType] = useState("TASK");
  const [due, setDue] = useState("");
  const [accountId, setAccountId] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [aRes, accRes] = await Promise.all([
        fetch("/api/crm/activities"),
        fetch("/api/crm/accounts"),
      ]);
      const aData = await aRes.json();
      const accData = await accRes.json();
      if (!aRes.ok) throw new Error(aData.error ?? "Failed to load activities");
      if (!accRes.ok) throw new Error(accData.error ?? "Failed to load accounts");
      setActivities(aData.activities ?? []);
      setAccounts((accData.accounts ?? []).map((x: AccountOpt) => ({ id: x.id, name: x.name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          type,
          dueDate: due.trim() || null,
          relatedAccountId: accountId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSubject("");
      setDue("");
      setAccountId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchStatus(id: string, status: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Activities</h1>
          <p className="text-sm text-zinc-600">
            Tasks, calls, and meetings. Scoped like other CRM lists.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {error}
        </div>
      ) : null}
      {(statusFilter || dueFilter === "overdue") ? (
        <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Filtered view:{" "}
          {statusFilter ? <span className="font-semibold">status={statusFilter}</span> : null}
          {statusFilter && dueFilter === "overdue" ? " · " : null}
          {dueFilter === "overdue" ? <span className="font-semibold">overdue only</span> : null}
          {" · "}
          <Link href="/crm/activities" className="underline">
            clear
          </Link>
        </div>
      ) : null}

      <section className="mb-10 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">New activity</h2>
        <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            >
              {["TASK", "CALL", "MEETING", "NOTE", "EMAIL"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-zinc-600">Due</span>
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-zinc-600">Related account (optional)</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={busy}
            >
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy || !subject.trim()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Save activity
            </button>
          </div>
        </form>
      </section>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Subject</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Links</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {activities.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No activities yet.
                </td>
              </tr>
            ) : visibleActivities.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  No activities match the active filter.
                </td>
              </tr>
            ) : (
              visibleActivities.map((row) => (
                <tr key={row.id} className="border-b border-zinc-50 last:border-0">
                  <td className="px-4 py-2 font-medium text-zinc-900">{row.subject}</td>
                  <td className="px-4 py-2 text-zinc-600">{row.type}</td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {row.relatedAccount ? (
                      <Link
                        href={`/crm/accounts/${row.relatedAccount.id}`}
                        className="text-violet-700 hover:underline"
                      >
                        {row.relatedAccount.name}
                      </Link>
                    ) : null}
                    {row.relatedOpportunity ? (
                      <>
                        {row.relatedAccount ? " · " : null}
                        <Link
                          href={`/crm/opportunities/${row.relatedOpportunity.id}`}
                          className="text-violet-700 hover:underline"
                        >
                          {row.relatedOpportunity.name}
                        </Link>
                      </>
                    ) : null}
                    {!row.relatedAccount && !row.relatedOpportunity ? "—" : null}
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {row.dueDate ? new Date(row.dueDate).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={row.status}
                      disabled={busy}
                      onChange={(e) => void patchStatus(row.id, e.target.value)}
                      className="rounded border border-zinc-200 px-2 py-1 text-xs"
                    >
                      {["OPEN", "DONE", "CANCELLED"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
