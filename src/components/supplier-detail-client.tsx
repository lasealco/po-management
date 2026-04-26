"use client";

import { apiClientErrorMessage } from "@/lib/api-client-error";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SupplierCapabilitiesSection } from "@/components/supplier-capabilities-section";
import { SupplierComplianceSection } from "@/components/supplier-compliance-section";
import { SupplierOnboardingSection } from "@/components/supplier-onboarding-section";
import { SupplierOrderHistorySection } from "@/components/supplier-order-history";
import type { SupplierCapabilityRow } from "@/lib/srm/supplier-capability-types";
import type { SupplierOrderAnalytics } from "@/lib/supplier-order-analytics";

export type { SupplierCapabilityRow };

export type SupplierContactRow = {
  id: string;
  name: string;
  title: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isPrimary: boolean;
};

export type SupplierDetailSnapshot = {
  id: string;
  updatedAt: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  srmCategory: "product" | "logistics";
  approvalStatus: "pending_approval" | "approved" | "rejected";
  legalName: string | null;
  taxId: string | null;
  website: string | null;
  registeredAddressLine1: string | null;
  registeredAddressLine2: string | null;
  registeredCity: string | null;
  registeredRegion: string | null;
  registeredPostalCode: string | null;
  registeredCountryCode: string | null;
  paymentTermsDays: number | null;
  paymentTermsLabel: string | null;
  creditLimit: string | null;
  creditCurrency: string | null;
  defaultIncoterm: string | null;
  internalNotes: string | null;
  /** Hours to confirm booking (logistics); null = tenant default. */
  bookingConfirmationSlaHours: number | null;
  /** Phase G: operator onboarding pipeline (parallel to checklist). */
  srmOnboardingStage: "intake" | "diligence" | "review" | "cleared";
  contacts: SupplierContactRow[];
  offices: Array<{
    id: string;
    name: string;
    city: string | null;
    countryCode: string | null;
    isActive: boolean;
  }>;
  capabilities: SupplierCapabilityRow[];
  productLinkCount: number;
  orderCount: number;
};

const CONTACT_ROLES = [
  "Sales",
  "Accounts payable",
  "Operations",
  "Quality",
  "Other",
] as const;

const SRM_SUPPLIER_TABS = [
  { id: "overview", label: "Profile" },
  { id: "contacts", label: "Contacts & sites" },
  { id: "capabilities", label: "Capabilities" },
  { id: "onboarding", label: "Onboarding" },
  { id: "orders", label: "Orders" },
  { id: "compliance", label: "Compliance" },
  { id: "activity", label: "Activity" },
] as const;

type SrmSupplierTabId = (typeof SRM_SUPPLIER_TABS)[number]["id"];

export function SupplierDetailClient({
  initial,
  canEdit = true,
  canApprove = false,
  /** Phase K: internal notes and similar require edit or approve, not view-only. */
  canViewSupplierSensitiveFields,
  canViewOrders = false,
  orderHistory = null,
  /** `srm` = opened from `/srm/[id]` (directory back-link); `suppliers` = legacy directory. */
  detailNavContext = "suppliers",
  onboardingAssigneeOptions = undefined,
  viewerUserId = undefined,
  initialSrmTab = undefined,
}: {
  initial: SupplierDetailSnapshot;
  canEdit?: boolean;
  /** Approver / admin: approve or reject supplier, change activation. */
  canApprove?: boolean;
  canViewSupplierSensitiveFields: boolean;
  canViewOrders?: boolean;
  /** Present when viewer has org.orders → view. */
  orderHistory?: SupplierOrderAnalytics | null;
  detailNavContext?: "suppliers" | "srm";
  onboardingAssigneeOptions?: { id: string; name: string; email: string }[];
  viewerUserId?: string;
  /** Deep-link from `/srm/[id]?tab=onboarding` etc. */
  initialSrmTab?: SrmSupplierTabId;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderAnalytics, setOrderAnalytics] = useState<SupplierOrderAnalytics | null>(orderHistory);
  const [orderAnalyticsLoading, setOrderAnalyticsLoading] = useState(false);
  const [orderAnalyticsError, setOrderAnalyticsError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [code, setCode] = useState(initial.code ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [isActive, setIsActive] = useState(initial.isActive);
  const [srmCategory, setSrmCategory] = useState<"product" | "logistics">(
    initial.srmCategory,
  );
  const [legalName, setLegalName] = useState(initial.legalName ?? "");
  const [taxId, setTaxId] = useState(initial.taxId ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [regLine1, setRegLine1] = useState(
    initial.registeredAddressLine1 ?? "",
  );
  const [regLine2, setRegLine2] = useState(
    initial.registeredAddressLine2 ?? "",
  );
  const [regCity, setRegCity] = useState(initial.registeredCity ?? "");
  const [regRegion, setRegRegion] = useState(initial.registeredRegion ?? "");
  const [regPostal, setRegPostal] = useState(
    initial.registeredPostalCode ?? "",
  );
  const [regCountry, setRegCountry] = useState(
    initial.registeredCountryCode ?? "",
  );
  const [payDays, setPayDays] = useState(
    initial.paymentTermsDays != null ? String(initial.paymentTermsDays) : "",
  );
  const [payLabel, setPayLabel] = useState(initial.paymentTermsLabel ?? "");
  const [creditLimit, setCreditLimit] = useState(initial.creditLimit ?? "");
  const [creditCurrency, setCreditCurrency] = useState(
    initial.creditCurrency ?? "",
  );
  const [incoterm, setIncoterm] = useState(initial.defaultIncoterm ?? "");
  const [internalNotes, setInternalNotes] = useState(
    initial.internalNotes ?? "",
  );
  const [bookingSlaHours, setBookingSlaHours] = useState(
    initial.bookingConfirmationSlaHours != null
      ? String(initial.bookingConfirmationSlaHours)
      : "",
  );
  const [srmOnboardingStage, setSrmOnboardingStage] = useState(
    initial.srmOnboardingStage,
  );

  useEffect(() => {
    startTransition(() => {
      setName(initial.name);
      setCode(initial.code ?? "");
      setEmail(initial.email ?? "");
      setPhone(initial.phone ?? "");
      setIsActive(initial.isActive);
      setSrmCategory(initial.srmCategory);
      setLegalName(initial.legalName ?? "");
      setTaxId(initial.taxId ?? "");
      setWebsite(initial.website ?? "");
      setRegLine1(initial.registeredAddressLine1 ?? "");
      setRegLine2(initial.registeredAddressLine2 ?? "");
      setRegCity(initial.registeredCity ?? "");
      setRegRegion(initial.registeredRegion ?? "");
      setRegPostal(initial.registeredPostalCode ?? "");
      setRegCountry(initial.registeredCountryCode ?? "");
      setPayDays(
        initial.paymentTermsDays != null ? String(initial.paymentTermsDays) : "",
      );
      setPayLabel(initial.paymentTermsLabel ?? "");
      setCreditLimit(initial.creditLimit ?? "");
      setCreditCurrency(initial.creditCurrency ?? "");
      setIncoterm(initial.defaultIncoterm ?? "");
      setInternalNotes(initial.internalNotes ?? "");
      setBookingSlaHours(
        initial.bookingConfirmationSlaHours != null
          ? String(initial.bookingConfirmationSlaHours)
          : "",
      );
      setSrmOnboardingStage(initial.srmOnboardingStage);
    });
    // Intentionally only re-sync when `initial.updatedAt` changes (full `initial` deps would over-reset).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial.* fields track one payload version
  }, [initial.updatedAt]);

  const [officeName, setOfficeName] = useState("");
  const [officeCity, setOfficeCity] = useState("");
  const [officeCountry, setOfficeCountry] = useState("");
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null);
  const [editOfficeName, setEditOfficeName] = useState("");
  const [editOfficeCity, setEditOfficeCity] = useState("");
  const [editOfficeCountry, setEditOfficeCountry] = useState("");

  const [cName, setCName] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cRole, setCRole] = useState<string>("Sales");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [cPrimary, setCPrimary] = useState(false);

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editC, setEditC] = useState<Partial<SupplierContactRow>>({});

  const isSrmShell = detailNavContext === "srm";
  const [srmTab, setSrmTab] = useState<SrmSupplierTabId>(() => {
    if (initialSrmTab && SRM_SUPPLIER_TABS.some((t) => t.id === initialSrmTab)) {
      return initialSrmTab;
    }
    return "overview";
  });

  useEffect(() => {
    setOrderAnalytics(orderHistory);
  }, [initial.id, orderHistory]);

  useEffect(() => {
    if (!isSrmShell || srmTab !== "orders" || !canViewOrders || orderAnalytics || orderAnalyticsLoading) return;
    const controller = new AbortController();
    setOrderAnalyticsError(null);
    setOrderAnalyticsLoading(true);
    fetch(`/api/suppliers/${initial.id}/order-analytics`, { signal: controller.signal })
      .then(async (res) => {
        const payload: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(apiClientErrorMessage(payload ?? {}, "Could not load supplier order analytics."));
        }
        const analytics = (payload as { analytics?: SupplierOrderAnalytics }).analytics;
        if (!analytics) throw new Error("Supplier order analytics response was empty.");
        setOrderAnalytics(analytics);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setOrderAnalyticsError(e instanceof Error ? e.message : "Could not load supplier order analytics.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setOrderAnalyticsLoading(false);
      });
    return () => controller.abort();
  }, [canViewOrders, initial.id, isSrmShell, orderAnalytics, orderAnalyticsLoading, srmTab]);

  async function saveSupplierProfile() {
    setError(null);
    setBusy(true);
    const paymentTermsDaysParsed =
      payDays.trim() === "" ? null : Number.parseInt(payDays.trim(), 10);
    if (
      payDays.trim() !== "" &&
      (Number.isNaN(paymentTermsDaysParsed) ||
        paymentTermsDaysParsed! < 0 ||
        paymentTermsDaysParsed! > 3650)
    ) {
      setBusy(false);
      setError("Payment terms (days) must be a whole number from 0 to 3650.");
      return;
    }
    let bookingConfirmationSlaHours: number | null;
    if (bookingSlaHours.trim() === "") {
      bookingConfirmationSlaHours = null;
    } else {
      const sla = Number.parseInt(bookingSlaHours.trim(), 10);
      if (Number.isNaN(sla) || sla < 1 || sla > 8760) {
        setBusy(false);
        setError(
          "Booking confirmation SLA (hours) must be empty or a whole number from 1 to 8760.",
        );
        return;
      }
      bookingConfirmationSlaHours = sla;
    }
    const baseBody: Record<string, unknown> = {
        name,
        code: code || null,
        email: email || null,
        phone: phone || null,
        srmCategory,
        legalName: legalName || null,
        taxId: taxId || null,
        website: website || null,
        registeredAddressLine1: regLine1 || null,
        registeredAddressLine2: regLine2 || null,
        registeredCity: regCity || null,
        registeredRegion: regRegion || null,
        registeredPostalCode: regPostal || null,
        registeredCountryCode: regCountry.trim().toUpperCase() || null,
        paymentTermsDays: paymentTermsDaysParsed,
        paymentTermsLabel: payLabel || null,
        creditLimit: creditLimit.trim() === "" ? null : creditLimit.trim(),
        creditCurrency: creditCurrency.trim().toUpperCase() || null,
        defaultIncoterm: incoterm || null,
        internalNotes: internalNotes || null,
        bookingConfirmationSlaHours,
    };
    if (canApprove) {
      baseBody.isActive = isActive;
    }
    const res = await fetch(`/api/suppliers/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseBody),
    });
    const payload: unknown = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Save failed."));
      return;
    }
    setBusy(false);
    router.refresh();
  }

  async function addOffice(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!officeName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/suppliers/${initial.id}/offices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: officeName.trim(),
        city: officeCity.trim() || null,
        countryCode: officeCountry.trim() || null,
      }),
    });
    const payload: unknown = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Could not add office."));
      return;
    }
    setOfficeName("");
    setOfficeCity("");
    setOfficeCountry("");
    setBusy(false);
    router.refresh();
  }

  async function saveOfficeEdit(officeId: string) {
    if (!editOfficeName.trim()) {
      setError("Office name is required.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/suppliers/${initial.id}/offices/${officeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editOfficeName.trim(),
        city: editOfficeCity.trim() || null,
        countryCode: editOfficeCountry.trim() || null,
      }),
    });
    const payload: unknown = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Update failed."));
      return;
    }
    setEditingOfficeId(null);
    setEditOfficeName("");
    setEditOfficeCity("");
    setEditOfficeCountry("");
    setBusy(false);
    router.refresh();
  }

  async function removeOffice(officeId: string) {
    if (
      !window.confirm(
        "Delete this office? Products referencing it will clear the office link.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(
      `/api/suppliers/${initial.id}/offices/${officeId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const payload: unknown = await res.json();
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Delete failed."));
      return;
    }
    setBusy(false);
    router.refresh();
  }

  async function removeSupplier() {
    if (
      !window.confirm(
        "Delete this supplier permanently? This is only allowed when it has no purchase orders.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/suppliers/${initial.id}`, { method: "DELETE" });
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload ?? {}, "Delete failed."));
      return;
    }
    setBusy(false);
    router.push(
      detailNavContext === "srm"
        ? `/srm?kind=${initial.srmCategory === "logistics" ? "logistics" : "product"}`
        : "/suppliers",
    );
    router.refresh();
  }

  async function submitApproval(decision: "approve" | "reject" | "reopen") {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/suppliers/${initial.id}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload ?? {}, "Approval update failed."));
      return;
    }
    setBusy(false);
    if (decision === "approve") setIsActive(true);
    if (decision === "reject" || decision === "reopen") setIsActive(false);
    router.refresh();
  }

  async function archiveSupplier() {
    if (!canApprove) return;
    if (!window.confirm("Archive this supplier (set inactive)?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/suppliers/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    const payload: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload ?? {}, "Archive failed."));
      return;
    }
    setBusy(false);
    router.refresh();
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cName.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/suppliers/${initial.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cName.trim(),
        title: cTitle.trim() || null,
        role: cRole || null,
        email: cEmail.trim() || null,
        phone: cPhone.trim() || null,
        notes: cNotes.trim() || null,
        isPrimary: cPrimary,
      }),
    });
    const payload: unknown = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Could not add contact."));
      return;
    }
    setCName("");
    setCTitle("");
    setCRole("Sales");
    setCEmail("");
    setCPhone("");
    setCNotes("");
    setCPrimary(false);
    setBusy(false);
    router.refresh();
  }

  async function saveContact(contactId: string) {
    const nm = (editC.name ?? "").trim();
    if (!nm) {
      setError("Contact name is required.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await fetch(
      `/api/suppliers/${initial.id}/contacts/${contactId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nm,
          title: (editC.title ?? "").trim() || null,
          role: (editC.role ?? "").trim() || null,
          email: (editC.email ?? "").trim() || null,
          phone: (editC.phone ?? "").trim() || null,
          notes: (editC.notes ?? "").trim() || null,
          isPrimary: Boolean(editC.isPrimary),
        }),
      },
    );
    const payload: unknown = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Update failed."));
      return;
    }
    setEditingContactId(null);
    setEditC({});
    setBusy(false);
    router.refresh();
  }

  async function removeContact(contactId: string) {
    if (!window.confirm("Remove this contact?")) return;
    setBusy(true);
    const res = await fetch(
      `/api/suppliers/${initial.id}/contacts/${contactId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const payload: unknown = await res.json();
      setBusy(false);
      setError(apiClientErrorMessage(payload, "Delete failed."));
      return;
    }
    setBusy(false);
    router.refresh();
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900";
  const label = "font-medium text-zinc-700";

  /** Payment label / net days only (Incoterm has its own row). */
  function formatPaymentTermsReadOnly() {
    if (initial.paymentTermsLabel) return initial.paymentTermsLabel;
    if (initial.paymentTermsDays != null) return `Net ${initial.paymentTermsDays}`;
    return "—";
  }

  return (
    <div className="space-y-10">
      <div>
        <Link
          href={
            detailNavContext === "srm"
              ? initial.srmCategory === "logistics"
                ? "/srm?kind=logistics"
                : "/srm?kind=product"
              : initial.srmCategory === "logistics"
                ? "/suppliers?kind=logistics"
                : "/suppliers?kind=product"
          }
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← {initial.srmCategory === "logistics" ? "Logistics" : "Product"}{" "}
          {detailNavContext === "srm" ? "partners (SRM)" : "suppliers"}
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900">
            {canEdit ? "Manage supplier" : "Supplier"}
          </h1>
          {canEdit ? (
            <div className="flex gap-2">
              {canApprove ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void archiveSupplier()}
                  className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 disabled:opacity-50"
                >
                  Archive supplier
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeSupplier()}
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 disabled:opacity-50"
              >
                Delete supplier
              </button>
            </div>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-zinc-600">
          {initial.productLinkCount} catalog product link
          {initial.productLinkCount === 1 ? "" : "s"} · {initial.orderCount} linked
          PO row
          {initial.orderCount === 1 ? "" : "s"} (includes split children)
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {initial.approvalStatus === "pending_approval" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Pending procurement approval</p>
          <p className="mt-1 text-xs text-amber-900/90">
            This supplier is not active until an approver confirms it. Pending partners cannot be used
            on new purchase orders or as forwarders.
          </p>
          {canApprove ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitApproval("approve")}
                className="rounded-md bg-[var(--arscmp-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Approve &amp; activate
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitApproval("reject")}
                className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {initial.approvalStatus === "rejected" ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          <p className="font-medium">Rejected supplier</p>
          <p className="mt-1 text-xs text-rose-900/90">
            This record cannot be used on new POs or as a forwarder until it is reopened or approved
            again.
          </p>
          {canApprove ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitApproval("reopen")}
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 disabled:opacity-50"
              >
                Reopen (pending)
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitApproval("approve")}
                className="rounded-md bg-[var(--arscmp-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Approve &amp; activate
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {initial.approvalStatus === "approved" && canApprove ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-2 text-xs text-emerald-950">
          <span className="font-medium">Approved and eligible for POs and forwarder selection.</span>{" "}
          <button
            type="button"
            disabled={busy}
            className="font-semibold text-rose-800 underline decoration-rose-300 hover:text-rose-900 disabled:opacity-50"
            onClick={() => {
              if (!window.confirm("Revoke approval? The supplier will be rejected and deactivated.")) {
                return;
              }
              void submitApproval("reject");
            }}
          >
            Revoke approval
          </button>
        </div>
      ) : null}

      {isSrmShell ? (
        <nav
          className="sticky top-0 z-20 -mx-1 mb-4 flex flex-wrap gap-1 border-b border-zinc-200 bg-zinc-50/95 py-2 backdrop-blur-sm"
          aria-label="Supplier workspace"
        >
          {SRM_SUPPLIER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSrmTab(t.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:text-sm ${
                srmTab === t.id
                  ? "bg-[var(--arscmp-primary-50)] text-[var(--arscmp-primary)] ring-1 ring-[var(--arscmp-primary)]/20"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      ) : null}

      {orderAnalytics && (!isSrmShell || srmTab === "orders") ? (
        <SupplierOrderHistorySection analytics={orderAnalytics} />
      ) : null}

      {isSrmShell && srmTab === "orders" && !orderAnalytics ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Orders</h2>
          {orderAnalyticsLoading ? (
            <p className="mt-2 text-sm text-zinc-600">Loading linked purchase-order history…</p>
          ) : orderAnalyticsError ? (
            <p className="mt-2 text-sm text-amber-900">{orderAnalyticsError}</p>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              Linked purchase-order history is hidden for your role. Grant{" "}
              <strong className="text-zinc-800">org.orders</strong> → view to see counts and recent
              rows here.
            </p>
          )}
        </section>
      ) : null}

      {(!isSrmShell || srmTab === "overview") && (
        <>
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Company</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Trade name, identifiers, and main company channels.
          {canEdit ? " Saved with the button under Commercial & credit." : ""}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {canEdit ? (
            <>
              <label className="flex flex-col text-sm">
                <span className={label}>Name *</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Code</span>
                <input value={code} onChange={(e) => setCode(e.target.value)} className={f} />
              </label>
              <label className="flex flex-col text-sm sm:col-span-2">
                <span className={label}>SRM category</span>
                <select
                  value={srmCategory}
                  onChange={(e) =>
                    setSrmCategory(e.target.value === "logistics" ? "logistics" : "product")
                  }
                  className={f}
                >
                  <option value="product">Product (PO / materials)</option>
                  <option value="logistics">Logistics (forwarder, carrier party, …)</option>
                </select>
              </label>
              <label className="flex flex-col text-sm sm:col-span-2">
                <span className={label}>Legal name</span>
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className={f}
                  placeholder="Registered entity name if different"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Tax / VAT ID</span>
                <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={f} />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Website</span>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className={f}
                  placeholder="https://"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={f} />
              </label>
              {canApprove ? (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  Active supplier
                </label>
              ) : (
                <div className="text-sm sm:col-span-2">
                  <span className={label}>Activation</span>
                  <p className="mt-1 text-zinc-600">
                    {isActive ? "Active" : "Inactive"} — only users with supplier approval rights can
                    change this.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-sm">
                <span className={label}>Name</span>
                <p className="mt-1 text-zinc-900">{name}</p>
              </div>
              <div className="text-sm">
                <span className={label}>Code</span>
                <p className="mt-1 text-zinc-900">{code || "—"}</p>
              </div>
              <div className="text-sm sm:col-span-2">
                <span className={label}>Legal name</span>
                {canViewSupplierSensitiveFields ? (
                  <p className="mt-1 text-zinc-900">{legalName || "—"}</p>
                ) : (
                  <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                    Hidden for read-only supplier access. Requires <strong>org.suppliers</strong> →{" "}
                    <strong>edit</strong> or <strong>approve</strong>.
                  </p>
                )}
              </div>
              {canViewSupplierSensitiveFields ? (
                <div className="text-sm">
                  <span className={label}>Tax / VAT ID</span>
                  <p className="mt-1 text-zinc-900">{taxId || "—"}</p>
                </div>
              ) : (
                <div className="text-sm rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <span className={label}>Tax / VAT ID</span>
                  <p className="mt-1 text-xs text-amber-950">
                    Hidden for read-only supplier access. Requires <strong>org.suppliers</strong> →{" "}
                    <strong>edit</strong> or <strong>approve</strong>.
                  </p>
                </div>
              )}
              <div className="text-sm">
                <span className={label}>Website</span>
                <p className="mt-1 text-zinc-900">
                  {website ? (
                    <a
                      href={website.startsWith("http") ? website : `https://${website}`}
                      className="text-amber-800 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {website}
                    </a>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              {canViewSupplierSensitiveFields ? (
                <>
                  <div className="text-sm">
                    <span className={label}>Email</span>
                    <p className="mt-1 text-zinc-900">{email || "—"}</p>
                  </div>
                  <div className="text-sm">
                    <span className={label}>Phone</span>
                    <p className="mt-1 text-zinc-900">{phone || "—"}</p>
                  </div>
                </>
              ) : (
                <div className="text-sm sm:col-span-2">
                  <span className={label}>Email &amp; phone</span>
                  <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                    Hidden for read-only supplier access. Requires <strong>org.suppliers</strong> →{" "}
                    <strong>edit</strong> or <strong>approve</strong>.
                  </p>
                </div>
              )}
              <div className="text-sm">
                <span className={label}>SRM category</span>
                <p className="mt-1 capitalize text-zinc-900">{initial.srmCategory}</p>
              </div>
              <div className="text-sm">
                <span className={label}>Approval</span>
                <p className="mt-1 text-zinc-900">
                  {initial.approvalStatus === "pending_approval"
                    ? "Pending approval"
                    : initial.approvalStatus === "approved"
                      ? "Approved"
                      : "Rejected"}
                </p>
              </div>
              <div className="text-sm sm:col-span-2">
                <span className={label}>Active</span>
                <p className="mt-1 text-zinc-900">
                  {isActive ? "Yes" : "No"}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">
          Registered address
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Legal / invoicing address (ship-from sites live under offices).
          {canEdit ? " Saved with the button under Commercial & credit." : ""}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {canEdit ? (
            <>
              <label className="flex flex-col text-sm sm:col-span-2">
                <span className={label}>Address line 1</span>
                <input value={regLine1} onChange={(e) => setRegLine1(e.target.value)} className={f} />
              </label>
              <label className="flex flex-col text-sm sm:col-span-2">
                <span className={label}>Address line 2</span>
                <input value={regLine2} onChange={(e) => setRegLine2(e.target.value)} className={f} />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>City</span>
                <input value={regCity} onChange={(e) => setRegCity(e.target.value)} className={f} />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Region / state</span>
                <input value={regRegion} onChange={(e) => setRegRegion(e.target.value)} className={f} />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Postal code</span>
                <input value={regPostal} onChange={(e) => setRegPostal(e.target.value)} className={f} />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Country (ISO)</span>
                <input
                  value={regCountry}
                  onChange={(e) => setRegCountry(e.target.value.toUpperCase())}
                  className={f}
                  maxLength={2}
                  placeholder="US"
                />
              </label>
            </>
          ) : canViewSupplierSensitiveFields ? (
            <div className="text-sm sm:col-span-2">
              <p className="whitespace-pre-line text-zinc-900">
                {[
                  regLine1,
                  regLine2,
                  [regCity, regRegion, regPostal].filter(Boolean).join(", "),
                  regCountry,
                ]
                  .filter(Boolean)
                  .join("\n") || "—"}
              </p>
            </div>
          ) : (
            <div className="text-sm sm:col-span-2">
              <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                Registered address is hidden for read-only supplier access. Requires <strong>org.suppliers</strong> →{" "}
                <strong>edit</strong> or <strong>approve</strong>.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">
          Commercial &amp; credit
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Payment terms, credit limit, default Incoterm, and internal notes.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {canEdit ? (
            <>
              <label className="flex flex-col text-sm">
                <span className={label}>Payment terms (days)</span>
                <input
                  value={payDays}
                  onChange={(e) => setPayDays(e.target.value)}
                  className={f}
                  placeholder="30"
                  inputMode="numeric"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Terms label</span>
                <input
                  value={payLabel}
                  onChange={(e) => setPayLabel(e.target.value)}
                  className={f}
                  placeholder="Net 30, 2/10 Net 30…"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Credit limit</span>
                <input
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className={f}
                  placeholder="250000"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Credit currency (ISO)</span>
                <input
                  value={creditCurrency}
                  onChange={(e) =>
                    setCreditCurrency(e.target.value.toUpperCase().slice(0, 3))
                  }
                  className={f}
                  placeholder="USD"
                  maxLength={3}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Default Incoterm</span>
                <input
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value)}
                  className={f}
                  placeholder="FOB, DDP, EXW…"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className={label}>Booking confirmation SLA (hours)</span>
                <input
                  value={bookingSlaHours}
                  onChange={(e) => setBookingSlaHours(e.target.value)}
                  className={f}
                  placeholder="e.g. 24 — logistics partners"
                  inputMode="numeric"
                />
                <span className="mt-1 text-xs text-zinc-500">
                  Leave blank to use tenant default. Range 1–8760.
                </span>
              </label>
              <label className="flex flex-col text-sm sm:col-span-2">
                <span className={label}>Internal notes</span>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  className={f}
                  placeholder="Buyer-only notes (not shared with supplier portal)."
                />
              </label>
            </>
          ) : (
            <>
              {canViewSupplierSensitiveFields ? (
                <div className="text-sm">
                  <span className={label}>Payment terms</span>
                  <p className="mt-1 text-zinc-900">{formatPaymentTermsReadOnly()}</p>
                </div>
              ) : (
                <div className="text-sm rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <span className={label}>Payment terms</span>
                  <p className="mt-1 text-xs text-amber-950">
                    Hidden for read-only supplier access. Requires <strong>org.suppliers</strong> →{" "}
                    <strong>edit</strong> or <strong>approve</strong>.
                  </p>
                </div>
              )}
              {canViewSupplierSensitiveFields ? (
                <div className="text-sm">
                  <span className={label}>Credit limit</span>
                  <p className="mt-1 text-zinc-900">
                    {initial.creditLimit
                      ? `${initial.creditCurrency ?? ""} ${initial.creditLimit}`.trim()
                      : "—"}
                  </p>
                </div>
              ) : (
                <div className="text-sm rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <span className={label}>Credit limit</span>
                  <p className="mt-1 text-xs text-amber-950">
                    Hidden for read-only supplier access. Requires <strong>org.suppliers</strong> →{" "}
                    <strong>edit</strong> or <strong>approve</strong>.
                  </p>
                </div>
              )}
              {canViewSupplierSensitiveFields ? (
                <div className="text-sm">
                  <span className={label}>Default Incoterm</span>
                  <p className="mt-1 text-zinc-900">{incoterm || "—"}</p>
                </div>
              ) : (
                <div className="text-sm rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <span className={label}>Default Incoterm</span>
                  <p className="mt-1 text-xs text-amber-950">
                    Hidden for read-only supplier access. Requires <strong>org.suppliers</strong> →{" "}
                    <strong>edit</strong> or <strong>approve</strong>.
                  </p>
                </div>
              )}
              {canViewSupplierSensitiveFields ? (
                <div className="text-sm">
                  <span className={label}>Booking confirmation SLA</span>
                  <p className="mt-1 text-zinc-900">
                    {initial.bookingConfirmationSlaHours != null
                      ? `${initial.bookingConfirmationSlaHours} h`
                      : "Tenant default"}
                  </p>
                </div>
              ) : (
                <div className="text-sm rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2">
                  <span className={label}>Booking confirmation SLA</span>
                  <p className="mt-1 text-xs text-amber-950">
                    Hidden for read-only supplier access. Requires <strong>org.suppliers</strong> →{" "}
                    <strong>edit</strong> or <strong>approve</strong>.
                  </p>
                </div>
              )}
              {canViewSupplierSensitiveFields ? (
                <div className="text-sm sm:col-span-2">
                  <span className={label}>Internal notes</span>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-900">
                    {internalNotes || "—"}
                  </p>
                </div>
              ) : (
                <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
                  <span className={label}>Internal notes</span>
                  <p className="mt-1 text-xs leading-relaxed">
                    Hidden for your role. Procurement notes require <strong>org.suppliers</strong> →{" "}
                    <strong>edit</strong> or <strong>approve</strong> (read-only supplier view is not enough).
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveSupplierProfile()}
            className="mt-6 rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save company & commercial details"}
          </button>
        ) : null}
      </section>
        </>
      )}

      {(!isSrmShell || srmTab === "contacts") && (
        <>
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Contacts</h2>
        <p className="mt-1 text-xs text-zinc-500">
          People for orders, AP, and operations (separate from the main company phone/email).
        </p>
        {!canViewSupplierSensitiveFields ? (
          <p className="mt-2 text-xs text-amber-900/90">
            <strong>Email</strong>, <strong>phone</strong>, and per-contact <strong>notes</strong> require{" "}
            <strong>org.suppliers</strong> → <strong>edit</strong> or <strong>approve</strong>. Names, titles, and roles
            stay visible for coordination.
          </p>
        ) : null}
        <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
          {initial.contacts.length === 0 ? (
            <li className="px-4 py-6 text-sm text-zinc-500">No contacts yet.</li>
          ) : (
            initial.contacts.map((c) => (
              <li key={c.id} className="px-4 py-4 text-sm">
                {editingContactId === c.id && canEdit ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col text-sm sm:col-span-2">
                      <span className={label}>Name</span>
                      <input
                        value={editC.name ?? ""}
                        onChange={(e) =>
                          setEditC((p) => ({ ...p, name: e.target.value }))
                        }
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm">
                      <span className={label}>Title</span>
                      <input
                        value={editC.title ?? ""}
                        onChange={(e) =>
                          setEditC((p) => ({ ...p, title: e.target.value }))
                        }
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm">
                      <span className={label}>Role</span>
                      <input
                        value={editC.role ?? ""}
                        onChange={(e) =>
                          setEditC((p) => ({ ...p, role: e.target.value }))
                        }
                        className={f}
                        placeholder="Sales, Accounts payable…"
                        list={`contact-roles-${c.id}`}
                      />
                      <datalist id={`contact-roles-${c.id}`}>
                        {CONTACT_ROLES.map((r) => (
                          <option key={r} value={r} />
                        ))}
                      </datalist>
                    </label>
                    <label className="flex flex-col text-sm">
                      <span className={label}>Email</span>
                      <input
                        value={editC.email ?? ""}
                        onChange={(e) =>
                          setEditC((p) => ({ ...p, email: e.target.value }))
                        }
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm">
                      <span className={label}>Phone</span>
                      <input
                        value={editC.phone ?? ""}
                        onChange={(e) =>
                          setEditC((p) => ({ ...p, phone: e.target.value }))
                        }
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm sm:col-span-2">
                      <span className={label}>Notes</span>
                      <textarea
                        value={editC.notes ?? ""}
                        onChange={(e) =>
                          setEditC((p) => ({ ...p, notes: e.target.value }))
                        }
                        rows={2}
                        className={f}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={Boolean(editC.isPrimary)}
                        onChange={(e) =>
                          setEditC((p) => ({
                            ...p,
                            isPrimary: e.target.checked,
                          }))
                        }
                        className="rounded border-zinc-300"
                      />
                      Primary contact
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveContact(c.id)}
                        className="rounded-md bg-arscmp-primary px-3 py-2 text-sm text-white disabled:opacity-50"
                      >
                        Save contact
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingContactId(null);
                          setEditC({});
                        }}
                        className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-zinc-900">
                        {c.name}
                        {c.isPrimary ? (
                          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Primary
                          </span>
                        ) : null}
                      </p>
                      <p className="text-zinc-600">
                        {[c.title, c.role].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-zinc-600">
                        {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {c.notes ? (
                        <p className="mt-1 text-xs text-zinc-500">{c.notes}</p>
                      ) : null}
                    </div>
                    {canEdit ? (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingContactId(c.id);
                            setEditC({ ...c });
                          }}
                          className="text-sm text-amber-800 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeContact(c.id)}
                          className="text-sm text-red-700 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            ))
          )}
        </ul>

        {canEdit ? (
          <form
            onSubmit={addContact}
            className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4"
          >
            <p className="text-sm font-medium text-zinc-800">Add contact</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col text-sm sm:col-span-2">
                <span>Name *</span>
                <input
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span>Title</span>
                <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} className={f} />
              </label>
              <label className="flex flex-col text-sm">
                <span>Role</span>
                <select
                  value={cRole}
                  onChange={(e) => setCRole(e.target.value)}
                  className={f}
                >
                  {CONTACT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col text-sm">
                <span>Email</span>
                <input
                  type="email"
                  value={cEmail}
                  onChange={(e) => setCEmail(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span>Phone</span>
                <input value={cPhone} onChange={(e) => setCPhone(e.target.value)} className={f} />
              </label>
              <label className="flex flex-col text-sm sm:col-span-2">
                <span>Notes</span>
                <textarea
                  value={cNotes}
                  onChange={(e) => setCNotes(e.target.value)}
                  rows={2}
                  className={f}
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={cPrimary}
                  onChange={(e) => setCPrimary(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                Primary contact
              </label>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            >
              Add contact
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Offices &amp; sites</h2>
        {!canViewSupplierSensitiveFields ? (
          <p className="mt-2 text-xs text-amber-900/90">
            City and country for each site are hidden for read-only access (requires <strong>org.suppliers</strong> →{" "}
            <strong>edit</strong> or <strong>approve</strong>).
          </p>
        ) : null}
        <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
          {initial.offices.length === 0 ? (
            <li className="px-4 py-6 text-sm text-zinc-500">No offices yet.</li>
          ) : (
            initial.offices.map((o) => (
              <li
                key={o.id}
                className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                {editingOfficeId === o.id && canEdit ? (
                  <div className="grid w-full gap-2 sm:grid-cols-3">
                    <input
                      value={editOfficeName}
                      onChange={(e) => setEditOfficeName(e.target.value)}
                      className={f}
                      placeholder="Name"
                    />
                    <input
                      value={editOfficeCity}
                      onChange={(e) => setEditOfficeCity(e.target.value)}
                      className={f}
                      placeholder="City"
                    />
                    <input
                      value={editOfficeCountry}
                      onChange={(e) => setEditOfficeCountry(e.target.value)}
                      className={f}
                      placeholder="Country"
                    />
                    <div className="flex flex-wrap gap-2 sm:col-span-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveOfficeEdit(o.id)}
                        className="rounded-md bg-[var(--arscmp-primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingOfficeId(null);
                          setEditOfficeName("");
                          setEditOfficeCity("");
                          setEditOfficeCountry("");
                        }}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-zinc-900">{o.name}</p>
                      <p className="text-zinc-600">
                        {[o.city, o.countryCode].filter(Boolean).join(", ") || "—"}
                      </p>
                    </div>
                    {canEdit ? (
                      <div className="flex shrink-0 gap-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingOfficeId(o.id);
                            setEditOfficeName(o.name);
                            setEditOfficeCity(o.city ?? "");
                            setEditOfficeCountry(o.countryCode ?? "");
                          }}
                          className="text-[var(--arscmp-primary)] hover:underline disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeOffice(o.id)}
                          className="text-red-700 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            ))
          )}
        </ul>

        {canEdit ? (
          <form
            onSubmit={addOffice}
            className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4"
          >
            <p className="text-sm font-medium text-zinc-800">Add office</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col text-sm sm:col-span-1">
                <span>Name *</span>
                <input
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span>City</span>
                <input
                  value={officeCity}
                  onChange={(e) => setOfficeCity(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span>Country</span>
                <input
                  value={officeCountry}
                  onChange={(e) => setOfficeCountry(e.target.value)}
                  className={f}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            >
              Add office
            </button>
          </form>
        ) : null}
      </section>
        </>
      )}

      {(!isSrmShell || srmTab === "capabilities") && (
        <SupplierCapabilitiesSection
          key={`${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          canViewSupplierSensitiveFields={canViewSupplierSensitiveFields}
          initialRows={initial.capabilities}
        />
      )}

      {isSrmShell && srmTab === "onboarding" && onboardingAssigneeOptions && viewerUserId ? (
        <SupplierOnboardingSection
          supplierId={initial.id}
          assigneeOptions={onboardingAssigneeOptions}
          viewerUserId={viewerUserId}
          srmOnboardingStage={srmOnboardingStage}
          canEdit={canEdit}
          onStageUpdated={(next) => {
            setSrmOnboardingStage(next);
            router.refresh();
          }}
        />
      ) : null}
      {isSrmShell && srmTab === "onboarding" && (!onboardingAssigneeOptions || !viewerUserId) ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">Onboarding checklist requires a signed-in user context.</p>
        </section>
      ) : null}

      {isSrmShell && srmTab === "compliance" ? (
        <SupplierComplianceSection supplierId={initial.id} canEdit={canEdit} />
      ) : null}
      {isSrmShell && srmTab === "activity" ? (
        <section className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-zinc-800">Activity</p>
          <p className="mt-2 text-xs text-zinc-600">
            Supplier activity and cross-module audit timeline can be layered on in a later slice.
          </p>
        </section>
      ) : null}
    </div>
  );
}
