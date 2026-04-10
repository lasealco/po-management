"use client";

import { useState } from "react";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/";
  return decoded;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(payload?.error ?? "Login failed.");
      return;
    }
    const next = safeNextPath(
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next")
        : null,
    );
    window.location.assign(next);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Use your tenant user email and password. Demo seed users use password{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">demo12345</code>{" "}
        (e.g. buyer@demo-company.com) when the{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">demo-company</code> tenant exists.
      </p>
      <div className="mt-6 space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="flex flex-col text-sm">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </main>
  );
}
