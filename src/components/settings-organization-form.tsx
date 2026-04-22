"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  initialName: string;
  slug: string;
};

export function SettingsOrganizationForm({ initialName, slug }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const res = await fetch("/api/tenant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const payload: unknown = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload, "Update failed."));
      return;
    }
    const body = payload as { tenant?: { name: string } };
    if (body.tenant) setName(body.tenant.name);
    setMessage("Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-md space-y-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-zinc-800">Company display name</span>
        <input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
        />
      </label>
      <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
        <span className="font-medium text-zinc-700">Tenant slug</span>
        <p className="mt-0.5 font-mono text-xs text-zinc-800">{slug}</p>
        <p className="mt-2 text-xs text-zinc-500">
          Identifier used in URLs and integrations. Changing it is not supported
          in this demo.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="h-9 rounded border border-arscmp-primary bg-arscmp-primary px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
