"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";

export default function ResetPasswordForm() {
  const search = useSearchParams();
  const token = search.get("token")?.trim() ?? "";
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const payload: unknown = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Reset failed."));
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        This page needs a valid reset link. Open the link from your email, or{" "}
        <Link href="/forgot-password" className="underline">
          request a new one
        </Link>
        .
      </div>
    );
  }

  return (
    <>
      {done ? (
        <p className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Your password has been updated. You can sign in now.
        </p>
      ) : null}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="flex flex-col text-sm">
          <span>New password</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 rounded-xl border border-zinc-300 px-3 py-2"
            disabled={done}
          />
        </label>
        <label className="flex flex-col text-sm">
          <span>Confirm password</span>
          <input
            type="password"
            name="password2"
            autoComplete="new-password"
            required
            minLength={8}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
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
          {busy ? "Saving…" : "Set password"}
        </button>
      </div>
    </>
  );
}
