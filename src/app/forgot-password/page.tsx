"use client";

import Link from "next/link";
import { useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload: unknown = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Request failed."));
      return;
    }
    setDone(true);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">Forgot password</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Enter the email for your account. If we recognize it, we will send a link to reset your
        password.
      </p>
      {done ? (
        <p className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800">
          If an account exists for that email, you will receive a link to reset your password. Check
          your inbox and spam folder.
        </p>
      ) : null}
      <div className="mt-6 space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="flex flex-col text-sm">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 rounded-xl border border-zinc-300 px-3 py-2"
            disabled={done}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || done}
          className="rounded-xl bg-[var(--arscmp-primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </div>
      <p className="mt-6 text-sm text-zinc-600">
        <Link href="/login" className="text-zinc-900 underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
