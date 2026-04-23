"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionButton } from "@/components/action-button";
import { WorkflowHeader } from "@/components/workflow-header";

export function SupplierCreateForm({
  defaultSrmCategory = "product",
}: {
  defaultSrmCategory?: "product" | "logistics";
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [legalName, setLegalName] = useState("");
  const [website, setWebsite] = useState("");
  const [taxId, setTaxId] = useState("");
  const [registeredAddressLine1, setRegisteredAddressLine1] = useState("");
  const [registeredCity, setRegisteredCity] = useState("");
  const [registeredRegion, setRegisteredRegion] = useState("");
  const [registeredPostalCode, setRegisteredPostalCode] = useState("");
  const [registeredCountryCode, setRegisteredCountryCode] = useState("");
  const [paymentTermsLabel, setPaymentTermsLabel] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("");
  const [defaultIncoterm, setDefaultIncoterm] = useState("");
  const [srmCategory, setSrmCategory] = useState<"product" | "logistics">(
    defaultSrmCategory,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSrmCategory(defaultSrmCategory);
  }, [defaultSrmCategory]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Partner name is required.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        code: code || null,
        email,
        phone,
        legalName: legalName || null,
        website: website || null,
        taxId: taxId || null,
        registeredAddressLine1: registeredAddressLine1 || null,
        registeredCity: registeredCity || null,
        registeredRegion: registeredRegion || null,
        registeredPostalCode: registeredPostalCode || null,
        registeredCountryCode: registeredCountryCode.trim().toUpperCase() || null,
        paymentTermsLabel: paymentTermsLabel || null,
        paymentTermsDays:
          paymentTermsDays.trim() === "" ? null : Number.parseInt(paymentTermsDays.trim(), 10),
        defaultIncoterm: defaultIncoterm.trim().toUpperCase() || null,
        srmCategory,
      }),
    });
    const payload: unknown = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Failed."));
      return;
    }
    const created = payload as { supplier?: { id: string } };
    if (created.supplier?.id) {
      setBusy(false);
      router.push(`/srm/${created.supplier.id}?kind=${srmCategory}`);
      router.refresh();
      return;
    }
    setBusy(false);
    setError("Created supplier but response was missing id. Refresh the list.");
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900";

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <WorkflowHeader
        eyebrow="Create supplier"
        title="New supplier"
        description="Create a full partner profile in SRM. You can still enrich contacts and offices on the detail page."
        steps={["Step 1: Partner type", "Step 2: Company and address", "Step 3: Commercial defaults"]}
        className="border-0 bg-transparent p-0 shadow-none"
      />
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700">SRM category</span>
          <select
            value={srmCategory}
            onChange={(e) =>
              setSrmCategory(e.target.value === "logistics" ? "logistics" : "product")
            }
            className={f}
          >
            <option value="product">Product (materials / PO vendor)</option>
            <option value="logistics">Logistics (forwarder, carrier party, etc.)</option>
          </select>
        </label>
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
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Legal name</span>
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className={f} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Website</span>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} className={f} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Tax/registration ID</span>
          <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={f} />
        </label>
        <label className="flex flex-col text-sm sm:col-span-2">
          <span className="font-medium text-zinc-700">Registered address line 1</span>
          <input
            value={registeredAddressLine1}
            onChange={(e) => setRegisteredAddressLine1(e.target.value)}
            className={f}
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">City</span>
          <input value={registeredCity} onChange={(e) => setRegisteredCity(e.target.value)} className={f} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Region/state</span>
          <input value={registeredRegion} onChange={(e) => setRegisteredRegion(e.target.value)} className={f} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Postal code</span>
          <input value={registeredPostalCode} onChange={(e) => setRegisteredPostalCode(e.target.value)} className={f} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Country (ISO-2)</span>
          <input
            value={registeredCountryCode}
            onChange={(e) => setRegisteredCountryCode(e.target.value)}
            className={f}
            maxLength={2}
          />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Payment terms label</span>
          <input value={paymentTermsLabel} onChange={(e) => setPaymentTermsLabel(e.target.value)} className={f} placeholder="Net 30" />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Payment terms days</span>
          <input value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} type="number" min={0} className={f} />
        </label>
        <label className="flex flex-col text-sm">
          <span className="font-medium text-zinc-700">Default Incoterm</span>
          <input value={defaultIncoterm} onChange={(e) => setDefaultIncoterm(e.target.value)} className={f} maxLength={8} />
        </label>
      </div>
      <ActionButton
        type="submit"
        disabled={busy}
        className="mt-5"
      >
        {busy ? "Saving…" : "Add supplier"}
      </ActionButton>
    </form>
  );
}
