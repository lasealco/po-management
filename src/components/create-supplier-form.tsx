"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type SupplierPayload =
  | {
      error: string;
    }
  | {
      ok: true;
      supplier: {
        id: string;
        name: string;
      };
    };

export function CreateSupplierForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage("Supplier name is required.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        name,
        email,
        phone,
        isActive,
      }),
    });

    const payload = (await response.json()) as SupplierPayload;

    if (!response.ok) {
      setErrorMessage(
        "error" in payload ? payload.error : "Unable to create supplier.",
      );
      setIsSubmitting(false);
      return;
    }

    setSuccessMessage(`Supplier "${payload.supplier.name}" created successfully.`);
    setCode("");
    setName("");
    setEmail("");
    setPhone("");
    setIsActive(true);
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-zinc-200 bg-white p-6">
      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Supplier code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            type="text"
            placeholder="SUP-002"
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-zinc-300 focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Name <span className="text-red-600">*</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            type="text"
            required
            placeholder="Northwind Components"
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-zinc-300 focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Email
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="orders@example.com"
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-zinc-300 focus:ring-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-zinc-700">
          Phone
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            placeholder="+1 555 0100"
            className="rounded-md border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-zinc-300 focus:ring-2"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="size-4 rounded border-zinc-300"
        />
        Supplier is active
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create supplier"}
        </button>
        <Link
          href="/"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to orders
        </Link>
      </div>
    </form>
  );
}
