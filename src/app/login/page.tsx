"use client";

import Link from "next/link";
import { useState } from "react";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { PLATFORM_HUB_PATH } from "@/lib/marketing-public-paths";

function safeNextPath(raw: string | null): string {
  if (!raw) return PLATFORM_HUB_PATH;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return PLATFORM_HUB_PATH;
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
    const payload: unknown = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload ?? {}, "Login failed."));
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
        Sign in with <strong>email</strong> and password. After{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">npm run db:seed</code> on the
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs"> demo-company</code> tenant:{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">buyer@demo-company.com</code> /{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">demo12345</code>, and the seeded full-access
        user{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">superuser@arscmp.com</code> with password{" "}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">superuser</code>. (Use a real email so login and
        password managers work reliably.) For roles vs deeper RBAC roadmap, see{" "}
        <code className="rounded bg-zinc-100 px-1">docs/engineering/USER_ROLES_AND_RBAC.md</code> and{" "}
        <code className="rounded bg-zinc-100 px-1">docs/icp-and-tenancy.md</code>.
      </p>
      <div className="mt-6 space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="flex flex-col text-sm">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 rounded border border-zinc-300 px-3 py-2"
          />
        </label>
        <div className="space-y-1">
          <label className="flex flex-col text-sm">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 rounded border border-zinc-300 px-3 py-2"
            />
          </label>
          <p className="text-right text-xs">
            <Link href="/forgot-password" className="text-zinc-600 underline">
              Forgot password?
            </Link>
          </p>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="rounded bg-arscmp-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </main>
  );
}
