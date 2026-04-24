"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import type { DemoTenant } from "@/lib/demo-tenant";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  tenant: DemoTenant;
  userCount: number;
  contactCount: number;
};

function str(v: string | null | undefined): string {
  return v ?? "";
}

export function SettingsOrganizationForm({ tenant, userCount, contactCount }: Props) {
  const router = useRouter();
  const [name, setName] = useState(tenant.name);
  const [legalName, setLegalName] = useState(str(tenant.legalName));
  const [phone, setPhone] = useState(str(tenant.phone));
  const [website, setWebsite] = useState(str(tenant.website));
  const [addressLine1, setAddressLine1] = useState(str(tenant.addressLine1));
  const [addressLine2, setAddressLine2] = useState(str(tenant.addressLine2));
  const [addressCity, setAddressCity] = useState(str(tenant.addressCity));
  const [addressRegion, setAddressRegion] = useState(str(tenant.addressRegion));
  const [addressPostalCode, setAddressPostalCode] = useState(str(tenant.addressPostalCode));
  const [addressCountryCode, setAddressCountryCode] = useState(str(tenant.addressCountryCode));
  const [linkedinUrl, setLinkedinUrl] = useState(str(tenant.linkedinUrl));
  const [twitterUrl, setTwitterUrl] = useState(str(tenant.twitterUrl));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyPatch(t: DemoTenant) {
    setName(t.name);
    setLegalName(str(t.legalName));
    setPhone(str(t.phone));
    setWebsite(str(t.website));
    setAddressLine1(str(t.addressLine1));
    setAddressLine2(str(t.addressLine2));
    setAddressCity(str(t.addressCity));
    setAddressRegion(str(t.addressRegion));
    setAddressPostalCode(str(t.addressPostalCode));
    setAddressCountryCode(str(t.addressCountryCode));
    setLinkedinUrl(str(t.linkedinUrl));
    setTwitterUrl(str(t.twitterUrl));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    const res = await fetch("/api/tenant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        legalName,
        phone,
        website,
        addressLine1,
        addressLine2,
        addressCity,
        addressRegion,
        addressPostalCode,
        addressCountryCode: addressCountryCode.trim().toUpperCase(),
        linkedinUrl,
        twitterUrl,
      }),
    });
    const payload: unknown = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(apiClientErrorMessage(payload, "Update failed."));
      return;
    }
    const b = payload as { tenant?: DemoTenant };
    if (b.tenant) {
      applyPatch(b.tenant);
    }
    setMessage("Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-2xl space-y-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-800">Identity</h3>
        <p className="mt-1 text-xs text-zinc-500">How the company is labeled in the app and on exports.</p>
        <div className="mt-4 space-y-4">
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
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Legal / registered name</span>
            <input
              maxLength={200}
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
              placeholder="Optional, for contracts and invoices"
            />
          </label>
          <div className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
            <span className="font-medium text-zinc-700">Tenant slug</span>
            <p className="mt-0.5 font-mono text-xs text-zinc-800">{tenant.slug}</p>
            <p className="mt-2 text-xs text-zinc-500">
              Identifier used in URLs and integrations. Changing it is not supported in this demo.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-800">Registered address</h3>
        <p className="mt-1 text-xs text-zinc-500">Headquarters or primary mailing address (optional).</p>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Address line 1</span>
            <input
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Address line 2</span>
            <input
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800">City</span>
              <input
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
                className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800">Region / state</span>
              <input
                value={addressRegion}
                onChange={(e) => setAddressRegion(e.target.value)}
                className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800">Postal code</span>
              <input
                value={addressPostalCode}
                onChange={(e) => setAddressPostalCode(e.target.value)}
                className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-800">Country (ISO-2)</span>
              <input
                maxLength={2}
                value={addressCountryCode}
                onChange={(e) => setAddressCountryCode(e.target.value.toUpperCase())}
                className="h-9 rounded border border-zinc-300 px-2 font-mono text-sm text-zinc-900"
                placeholder="e.g. US"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-800">Contact & web</h3>
        <p className="mt-1 text-xs text-zinc-500">Phone, site, and public social links.</p>
        <div className="mt-4 space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
              placeholder="+1 …"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">Website</span>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
              placeholder="https://"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">LinkedIn</span>
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
              placeholder="https://www.linkedin.com/…"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-800">X (Twitter) URL</span>
            <input
              value={twitterUrl}
              onChange={(e) => setTwitterUrl(e.target.value)}
              className="h-9 rounded border border-zinc-300 px-2 text-sm text-zinc-900"
              placeholder="https://x.com/…"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5">
        <h3 className="text-sm font-semibold text-zinc-800">People & directory</h3>
        <p className="mt-1 text-xs text-zinc-600">
          Sign-in users and role assignments are managed in Settings. Business contacts (customers, partners) live in
          CRM.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-zinc-700">Users in this tenant</span>
            <span className="text-zinc-500">
              <span className="font-medium text-zinc-800">{userCount}</span>{" "}
              <Link href="/settings/users" className="ml-1 font-medium text-sky-800 hover:underline">
                Manage users
              </Link>
            </span>
          </li>
          <li className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-zinc-700">CRM contacts (people)</span>
            <span className="text-zinc-500">
              <span className="font-medium text-zinc-800">{contactCount}</span>{" "}
              <Link href="/crm/contacts" className="ml-1 font-medium text-sky-800 hover:underline">
                Open contacts
              </Link>
            </span>
          </li>
        </ul>
      </section>

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
      <div>
        <button
          type="submit"
          disabled={busy}
          className="h-9 rounded-xl border border-arscmp-primary bg-[var(--arscmp-primary)] px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save company profile"}
        </button>
      </div>
    </form>
  );
}
