"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SupplierCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code: code || null, email, phone }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Failed.");
      return;
    }
    setName("");
    setCode("");
    setEmail("");
    setPhone("");
    setBusy(false);
    router.refresh();
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900";

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-zinc-900">New supplier</h2>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Name *</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={f}
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} className={f} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={f}
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={f} />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Add supplier"}
      </button>
    </form>
  );
}
