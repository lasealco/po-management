import Link from "next/link";
import { Suspense } from "react";

import ResetPasswordForm from "./reset-form";

function ResetFallback() {
  return <p className="text-sm text-zinc-500">Loading…</p>;
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">Set a new password</h1>
      <p className="mt-2 text-sm text-zinc-600">Choose a new password for your account.</p>
      <div className="mt-6">
        <Suspense fallback={<ResetFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </div>
      <p className="mt-6 text-sm text-zinc-600">
        <Link href="/login" className="text-zinc-900 underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
