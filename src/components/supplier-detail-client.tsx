"use client";

import type { SupplierDocumentCategory, SupplierQualificationStatus } from "@prisma/client";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SRM_REGISTER_CATEGORY_QUERY,
  parseRegisterCategorySearchParam,
} from "@/lib/srm/register-category-url";
import { SupplierCapabilitiesSection } from "@/components/supplier-capabilities-section";
import type { SupplierContractRecordRow } from "@/components/supplier-contract-records-section";
import { SupplierContractRecordsSection } from "@/components/supplier-contract-records-section";
import type { SupplierDocumentRow } from "@/components/supplier-documents-section";
import { SupplierDocumentsSection } from "@/components/supplier-documents-section";
import type { SupplierRelationshipNoteRow } from "@/components/supplier-relationship-notes-section";
import { SupplierRelationshipNotesSection } from "@/components/supplier-relationship-notes-section";
import type { SupplierComplianceReviewRow } from "@/components/supplier-compliance-reviews-section";
import { SupplierComplianceDocumentSignals } from "@/components/supplier-compliance-document-signals";
import { listComplianceDocumentFindings } from "@/lib/srm/supplier-compliance-document-signals";
import { SupplierComplianceReviewsSection } from "@/components/supplier-compliance-reviews-section";
import { SupplierOnboardingSection } from "@/components/supplier-onboarding-section";
import type { SupplierPerformanceScorecardRow } from "@/components/supplier-performance-scorecards-section";
import { SupplierPerformanceScorecardsSection } from "@/components/supplier-performance-scorecards-section";
import { SupplierQualificationSection } from "@/components/supplier-qualification-section";
import type { SupplierRiskRecordRow } from "@/components/supplier-risk-records-section";
import { SupplierRiskRecordsSection } from "@/components/supplier-risk-records-section";
import type { SupplierSrmAlertRow } from "@/components/supplier-srm-alerts-section";
import { SupplierSrmAlertsSection } from "@/components/supplier-srm-alerts-section";
import { SupplierOrderHistorySection } from "@/components/supplier-order-history";
import type { SupplierCapabilityRow } from "@/lib/srm/supplier-capability-types";
import type { SupplierOnboardingTaskRow } from "@/lib/srm/supplier-onboarding-types";
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

export type SupplierOfficeRow = {
  id: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  isActive: boolean;
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
  contacts: SupplierContactRow[];
  offices: SupplierOfficeRow[];
  capabilities: SupplierCapabilityRow[];
  onboardingTasks: SupplierOnboardingTaskRow[];
  onboardingWorkflow: {
    completedCount: number;
    totalCount: number;
    nextTaskLabel: string | null;
    nextTaskKey: string | null;
    openCount: number;
    readyForActivation: boolean;
  };
  qualification: {
    status: SupplierQualificationStatus;
    summary: string | null;
    lastReviewedAt: string | null;
    suggestedStatus: SupplierQualificationStatus;
  };
  complianceReviews: SupplierComplianceReviewRow[];
  performanceScorecards: SupplierPerformanceScorecardRow[];
  riskRecords: SupplierRiskRecordRow[];
  documents: SupplierDocumentRow[];
  relationshipNotes: SupplierRelationshipNoteRow[];
  contractRecords: SupplierContractRecordRow[];
  srmAlerts: SupplierSrmAlertRow[];
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
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "onboarding", label: "Onboarding" },
  { id: "capabilities", label: "Capabilities" },
  { id: "qualification", label: "Qualification" },
  { id: "compliance", label: "Compliance" },
  { id: "contracts", label: "Contracts" },
  { id: "performance", label: "Performance" },
  { id: "risk", label: "Risk" },
  { id: "relationship", label: "Relationship" },
  { id: "documents", label: "Documents" },
  { id: "alerts", label: "Alerts" },
] as const;

type SrmSupplierTabId = (typeof SRM_SUPPLIER_TABS)[number]["id"];

function supplierOfficeAddressLines(o: SupplierOfficeRow): string[] {
  const lines: string[] = [];
  if (o.addressLine1?.trim()) lines.push(o.addressLine1.trim());
  if (o.addressLine2?.trim()) lines.push(o.addressLine2.trim());
  const locality = [o.city, o.region, o.postalCode].filter((x) => x?.trim()).join(", ");
  if (locality) lines.push(locality);
  if (o.countryCode?.trim()) lines.push(o.countryCode.trim().toUpperCase());
  return lines.length > 0 ? lines : ["—"];
}

function parseSrmTabParam(raw: string | null): SrmSupplierTabId {
  if (!raw) return "overview";
  return SRM_SUPPLIER_TABS.some((t) => t.id === raw) ? (raw as SrmSupplierTabId) : "overview";
}

export function SupplierDetailClient({
  initial,
  canEdit = true,
  canApprove = false,
  orderHistory = null,
  /** `srm` = opened from `/srm/[id]` (directory back-link); `suppliers` = legacy directory. */
  detailNavContext = "suppliers",
}: {
  initial: SupplierDetailSnapshot;
  canEdit?: boolean;
  /** Approver / admin: approve or reject supplier, change activation. */
  canApprove?: boolean;
  /** Present when viewer has org.orders → view. */
  orderHistory?: SupplierOrderAnalytics | null;
  detailNavContext?: "suppliers" | "srm";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);

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
      setEditingContactId(null);
      setEditC({});
      setEditingOfficeId(null);
      setEditO({});
    });
  }, [initial.updatedAt]);

  useEffect(() => {
    if (!saveNotice) return;
    const t = window.setTimeout(() => setSaveNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [saveNotice]);

  useEffect(() => {
    if (!clipboardNotice) return;
    const t = window.setTimeout(() => setClipboardNotice(null), 2500);
    return () => window.clearTimeout(t);
  }, [clipboardNotice]);

  const [officeName, setOfficeName] = useState("");
  const [officeAddressLine1, setOfficeAddressLine1] = useState("");
  const [officeAddressLine2, setOfficeAddressLine2] = useState("");
  const [officeCity, setOfficeCity] = useState("");
  const [officeRegion, setOfficeRegion] = useState("");
  const [officePostalCode, setOfficePostalCode] = useState("");
  const [officeCountry, setOfficeCountry] = useState("");

  const [cName, setCName] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cRole, setCRole] = useState<string>("Sales");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [cPrimary, setCPrimary] = useState(false);

  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editC, setEditC] = useState<Partial<SupplierContactRow>>({});
  const [editingOfficeId, setEditingOfficeId] = useState<string | null>(null);
  const [editO, setEditO] = useState<Partial<SupplierOfficeRow>>({});

  const isSrmShell = detailNavContext === "srm";
  const [srmTab, setSrmTabState] = useState<SrmSupplierTabId>(() =>
    isSrmShell ? parseSrmTabParam(searchParams.get("tab")) : "overview",
  );

  const showOverviewMain = !isSrmShell || srmTab === "overview";
  const showContactsWorkspace =
    !isSrmShell || srmTab === "overview" || srmTab === "contacts";

  const complianceDocumentAttentionCount = listComplianceDocumentFindings(
    initial.documents,
  ).length;

  const [documentsRegisterCategory, setDocumentsRegisterCategory] =
    useState<SupplierDocumentCategory | null>(null);

  useEffect(() => {
    const cat = parseRegisterCategorySearchParam(
      searchParams.get(SRM_REGISTER_CATEGORY_QUERY),
    );
    if (cat) {
      setDocumentsRegisterCategory(cat);
      if (isSrmShell) {
        const q = new URLSearchParams(searchParams.toString());
        q.delete(SRM_REGISTER_CATEGORY_QUERY);
        q.set("tab", "documents");
        const s = q.toString();
        startTransition(() => {
          setSrmTabState("documents");
          void router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
        });
      } else {
        window.requestAnimationFrame(() =>
          document.getElementById("supplier-documents-section")?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        );
        const q = new URLSearchParams(searchParams.toString());
        q.delete(SRM_REGISTER_CATEGORY_QUERY);
        const s = q.toString();
        void router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
      }
      return;
    }
    if (!isSrmShell) return;
    const t = parseSrmTabParam(searchParams.get("tab"));
    if (t === srmTab) return;
    startTransition(() => setSrmTabState(t));
  }, [isSrmShell, searchParams, srmTab, pathname, router]);

  function selectSrmTab(next: SrmSupplierTabId) {
    setSrmTabState(next);
    if (!isSrmShell) return;
    const q = new URLSearchParams(searchParams.toString());
    if (next === "overview") q.delete("tab");
    else q.set("tab", next);
    const s = q.toString();
    void router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  function openDocumentsWorkspace(focus?: SupplierDocumentCategory) {
    setDocumentsRegisterCategory(focus ?? null);
    if (isSrmShell) {
      selectSrmTab("documents");
    } else {
      window.requestAnimationFrame(() =>
        document.getElementById("supplier-documents-section")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      );
    }
  }

  async function copyAdminField(label: string, text: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setClipboardNotice(`${label} copied to clipboard.`);
    } catch {
      setError("Could not copy to clipboard (browser blocked or unavailable).");
    }
  }

  async function saveSupplierProfile() {
    setError(null);
    setSaveNotice(null);
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
    };
    if (canApprove) {
      baseBody.isActive = isActive;
    }
    const res = await fetch(`/api/suppliers/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(baseBody),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Save failed.");
      return;
    }
    setBusy(false);
    setSaveNotice("Company & commercial details saved.");
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
        addressLine1: officeAddressLine1.trim() || null,
        addressLine2: officeAddressLine2.trim() || null,
        city: officeCity.trim() || null,
        region: officeRegion.trim() || null,
        postalCode: officePostalCode.trim() || null,
        countryCode: officeCountry.trim().toUpperCase().slice(0, 2) || null,
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add office.");
      return;
    }
    setOfficeName("");
    setOfficeAddressLine1("");
    setOfficeAddressLine2("");
    setOfficeCity("");
    setOfficeRegion("");
    setOfficePostalCode("");
    setOfficeCountry("");
    setBusy(false);
    router.refresh();
  }

  async function saveOffice(officeId: string) {
    const nm = (editO.name ?? "").trim();
    if (!nm) {
      setError("Office name is required.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/suppliers/${initial.id}/offices/${officeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nm,
        addressLine1: (editO.addressLine1 ?? "").trim() || null,
        addressLine2: (editO.addressLine2 ?? "").trim() || null,
        city: (editO.city ?? "").trim() || null,
        region: (editO.region ?? "").trim() || null,
        postalCode: (editO.postalCode ?? "").trim() || null,
        countryCode: (editO.countryCode ?? "").trim().toUpperCase().slice(0, 2) || null,
        isActive: Boolean(editO.isActive),
      }),
    });
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not update office.");
      return;
    }
    setEditingOfficeId(null);
    setEditO({});
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
    if (editingOfficeId === officeId) {
      setEditingOfficeId(null);
      setEditO({});
    }
    setBusy(true);
    const res = await fetch(
      `/api/suppliers/${initial.id}/offices/${officeId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const payload = (await res.json()) as { error?: string };
      setBusy(false);
      setError(payload.error ?? "Delete failed.");
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
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setBusy(false);
      setError(payload?.error ?? "Delete failed.");
      return;
    }
    setBusy(false);
    const listHref =
      detailNavContext === "srm"
        ? `/srm?kind=${initial.srmCategory === "logistics" ? "logistics" : "product"}`
        : `/suppliers?kind=${initial.srmCategory === "logistics" ? "logistics" : "product"}`;
    router.push(listHref);
    router.refresh();
  }

  async function submitApproval(decision: "approve" | "reject") {
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/suppliers/${initial.id}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const payload = (await res.json().catch(() => null)) as {
      error?: string;
      onboarding?: { pendingCount: number; pendingTasks: { taskKey: string; label: string }[] };
    } | null;
    if (!res.ok) {
      setBusy(false);
      const base = payload?.error ?? "Approval update failed.";
      const pending = payload?.onboarding?.pendingTasks;
      if (pending?.length) {
        setError(
          `${base} Open checklist rows: ${pending.map((p) => p.label).join("; ")}.`,
        );
      } else {
        setError(base);
      }
      return;
    }
    setBusy(false);
    setIsActive(decision === "approve");
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
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setBusy(false);
      setError(payload?.error ?? "Archive failed.");
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
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Could not add contact.");
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
    const payload = (await res.json()) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(payload.error ?? "Update failed.");
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
      const payload = (await res.json()) as { error?: string };
      setBusy(false);
      setError(payload.error ?? "Delete failed.");
      return;
    }
    setBusy(false);
    router.refresh();
  }

  const f =
    "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900";
  const label = "font-medium text-zinc-700";

  function formatTerms() {
    const parts = [];
    if (initial.paymentTermsLabel)
      parts.push(initial.paymentTermsLabel);
    else if (initial.paymentTermsDays != null)
      parts.push(`Net ${initial.paymentTermsDays}`);
    if (initial.defaultIncoterm) parts.push(initial.defaultIncoterm);
    return parts.length ? parts.join(" · ") : "—";
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
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
          <span className="inline-flex flex-wrap items-center gap-1">
            <span className="text-zinc-500">System ID</span>
            <code className="max-w-[min(100%,18rem)] truncate rounded bg-zinc-100 px-1 font-mono text-zinc-800">
              {initial.id}
            </code>
            <button
              type="button"
              className="text-[var(--arscmp-primary)] underline"
              onClick={() => void copyAdminField("System ID", initial.id)}
            >
              Copy
            </button>
          </span>
          {initial.code ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              <span className="text-zinc-500">Code</span>
              <code className="rounded bg-zinc-100 px-1 font-mono text-zinc-800">{initial.code}</code>
              <button
                type="button"
                className="text-[var(--arscmp-primary)] underline"
                onClick={() => void copyAdminField("Code", initial.code!)}
              >
                Copy
              </button>
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {saveNotice ? (
        <div
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900"
          role="status"
        >
          {saveNotice}
        </div>
      ) : null}
      {clipboardNotice ? (
        <div
          className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-800"
          role="status"
        >
          {clipboardNotice}
        </div>
      ) : null}

      {initial.approvalStatus === "pending_approval" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Pending procurement approval</p>
          <p className="mt-2 text-xs font-medium text-amber-900">
            Onboarding: {initial.onboardingWorkflow.completedCount}/
            {initial.onboardingWorkflow.totalCount} steps done or waived
            {initial.onboardingWorkflow.readyForActivation ? (
              <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-emerald-900">
                Checklist ready for approval
              </span>
            ) : (
              <span className="ml-2 rounded bg-white/80 px-2 py-0.5 text-amber-950">
                {initial.onboardingWorkflow.openCount} still open
              </span>
            )}
            {initial.onboardingWorkflow.nextTaskLabel ? (
              <span className="mt-1 block font-normal text-amber-900/90">
                Suggested next: {initial.onboardingWorkflow.nextTaskLabel}
              </span>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-amber-900/90">
            This supplier is not active until an approver confirms it. Every onboarding checklist item
            must be <strong className="font-semibold">done</strong> or <strong className="font-semibold">waived</strong>{" "}
            before <strong className="font-semibold">Approve and activate</strong> will succeed. Mark{" "}
            <strong className="font-semibold">Approval chain completed</strong> before{" "}
            <strong className="font-semibold">Activation decision logged</strong>. Register documents
            (especially <strong className="font-semibold">insurance</strong>,{" "}
            <strong className="font-semibold">license</strong>, or{" "}
            <strong className="font-semibold">certificate</strong> with an expiry) so the Compliance tab
            readiness strip has something to evaluate. Use Reject to block activation.
          </p>
          {isSrmShell ? (
            <div className="mt-3 border-t border-amber-200/70 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/85">
                Demo path — jump to tabs
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                  onClick={() => selectSrmTab("onboarding")}
                >
                  Onboarding checklist
                </button>
                <button
                  type="button"
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                  onClick={() => openDocumentsWorkspace()}
                >
                  Documents
                </button>
                <button
                  type="button"
                  className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
                  onClick={() => selectSrmTab("compliance")}
                >
                  Compliance signals
                </button>
              </div>
              {!canApprove ? (
                <p className="mt-2 text-xs text-amber-900/90">
                  To approve: open <strong className="font-semibold">Settings → Demo session</strong> and act as{" "}
                  <strong className="font-semibold">approver@demo-company.com</strong> (password{" "}
                  <code className="rounded bg-amber-100/80 px-1">demo12345</code>), then return here.
                </p>
              ) : null}
            </div>
          ) : null}
          {canApprove ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitApproval("approve")}
                className="rounded-md bg-[var(--arscmp-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Approve and activate
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

      {isSrmShell ? (
        <nav
          className="-mx-1 flex flex-wrap gap-1 border-b border-zinc-200 pb-2"
          aria-label="Supplier workspace"
        >
          {SRM_SUPPLIER_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectSrmTab(t.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:text-sm ${
                srmTab === t.id
                  ? "bg-[var(--arscmp-primary-50)] text-[var(--arscmp-primary)] ring-1 ring-[var(--arscmp-primary)]/20"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {t.label}
              {t.id === "onboarding" &&
              initial.approvalStatus === "pending_approval" &&
              initial.onboardingWorkflow.openCount > 0 ? (
                <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                  {initial.onboardingWorkflow.openCount}
                </span>
              ) : null}
              {t.id === "compliance" && complianceDocumentAttentionCount > 0 ? (
                <span className="ml-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-900">
                  {complianceDocumentAttentionCount}
                </span>
              ) : null}
              {t.id === "documents" && complianceDocumentAttentionCount > 0 ? (
                <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950">
                  {complianceDocumentAttentionCount}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      ) : null}

      {showOverviewMain && (
        <>
          {orderHistory ? (
            <SupplierOrderHistorySection analytics={orderHistory} />
          ) : null}

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
                <p className="mt-1 text-zinc-900">{legalName || "—"}</p>
              </div>
              <div className="text-sm">
                <span className={label}>Tax / VAT ID</span>
                <p className="mt-1 text-zinc-900">{taxId || "—"}</p>
              </div>
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
              <div className="text-sm">
                <span className={label}>Email</span>
                <p className="mt-1 text-zinc-900">{email || "—"}</p>
              </div>
              <div className="text-sm">
                <span className={label}>Phone</span>
                <p className="mt-1 text-zinc-900">{phone || "—"}</p>
              </div>
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
          ) : (
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
              <div className="text-sm">
                <span className={label}>Payment terms</span>
                <p className="mt-1 text-zinc-900">{formatTerms()}</p>
              </div>
              <div className="text-sm">
                <span className={label}>Credit limit</span>
                <p className="mt-1 text-zinc-900">
                  {initial.creditLimit
                    ? `${initial.creditCurrency ?? ""} ${initial.creditLimit}`.trim()
                    : "—"}
                </p>
              </div>
              <div className="text-sm">
                <span className={label}>Default Incoterm</span>
                <p className="mt-1 text-zinc-900">{incoterm || "—"}</p>
              </div>
              <div className="text-sm sm:col-span-2">
                <span className={label}>Internal notes</span>
                <p className="mt-1 whitespace-pre-wrap text-zinc-900">
                  {internalNotes || "—"}
                </p>
              </div>
            </>
          )}
        </div>
        {canEdit ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveSupplierProfile()}
            className="mt-6 rounded-md bg-arscmp-primary px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save company & commercial details"}
          </button>
        ) : null}
      </section>
        </>
      )}

      {showContactsWorkspace && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Contacts</h2>
        <p className="mt-1 text-xs text-zinc-500">
          People for orders, AP, and operations (separate from the main company phone/email).
          {isSrmShell && srmTab === "contacts"
            ? " Use the Overview tab to edit company master data and registered address."
            : ""}
        </p>
        {isSrmShell && srmTab === "overview" ? (
          <p className="mt-2 text-xs text-zinc-500">
            <button
              type="button"
              className="font-medium text-[var(--arscmp-primary)] hover:underline"
              onClick={() => selectSrmTab("contacts")}
            >
              Open full contacts workspace
            </button>{" "}
            for a larger form layout and fewer surrounding sections.
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
      )}

      {showOverviewMain && (
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Offices &amp; sites</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Ship-from / warehouse locations and regional sites. Names must be unique per supplier; inactive
          sites stay on record for history.
        </p>
        <ul className="mt-4 divide-y divide-zinc-100 border border-zinc-100 rounded-md">
          {initial.offices.length === 0 ? (
            <li className="px-4 py-6 text-sm text-zinc-500">No offices yet.</li>
          ) : (
            initial.offices.map((o) => (
              <li key={o.id} className="px-4 py-4 text-sm">
                {editingOfficeId === o.id && canEdit ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col text-sm sm:col-span-2">
                      <span className={label}>Name *</span>
                      <input
                        value={editO.name ?? ""}
                        onChange={(e) => setEditO((p) => ({ ...p, name: e.target.value }))}
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm sm:col-span-2">
                      <span className={label}>Address line 1</span>
                      <input
                        value={editO.addressLine1 ?? ""}
                        onChange={(e) =>
                          setEditO((p) => ({ ...p, addressLine1: e.target.value }))
                        }
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm sm:col-span-2">
                      <span className={label}>Address line 2</span>
                      <input
                        value={editO.addressLine2 ?? ""}
                        onChange={(e) =>
                          setEditO((p) => ({ ...p, addressLine2: e.target.value }))
                        }
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm">
                      <span className={label}>City</span>
                      <input
                        value={editO.city ?? ""}
                        onChange={(e) => setEditO((p) => ({ ...p, city: e.target.value }))}
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm">
                      <span className={label}>Region / state</span>
                      <input
                        value={editO.region ?? ""}
                        onChange={(e) => setEditO((p) => ({ ...p, region: e.target.value }))}
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm">
                      <span className={label}>Postal code</span>
                      <input
                        value={editO.postalCode ?? ""}
                        onChange={(e) =>
                          setEditO((p) => ({ ...p, postalCode: e.target.value }))
                        }
                        className={f}
                      />
                    </label>
                    <label className="flex flex-col text-sm">
                      <span className={label}>Country (ISO-2)</span>
                      <input
                        value={editO.countryCode ?? ""}
                        onChange={(e) =>
                          setEditO((p) => ({
                            ...p,
                            countryCode: e.target.value.toUpperCase().slice(0, 2),
                          }))
                        }
                        maxLength={2}
                        className={f}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={Boolean(editO.isActive)}
                        onChange={(e) =>
                          setEditO((p) => ({ ...p, isActive: e.target.checked }))
                        }
                        className="rounded border-zinc-300"
                      />
                      Active site
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveOffice(o.id)}
                        className="rounded-md bg-arscmp-primary px-3 py-2 text-sm text-white disabled:opacity-50"
                      >
                        Save office
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingOfficeId(null);
                          setEditO({});
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
                        {o.name}
                        {!o.isActive ? (
                          <span className="ml-2 rounded bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
                            Inactive
                          </span>
                        ) : null}
                      </p>
                      {supplierOfficeAddressLines(o).map((line, i) => (
                        <p key={`${o.id}-addr-${i}`} className="text-zinc-600">
                          {line}
                        </p>
                      ))}
                    </div>
                    {canEdit ? (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditingOfficeId(o.id);
                            setEditO({ ...o });
                          }}
                          className="text-sm text-amber-800 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeOffice(o.id)}
                          className="text-sm text-red-700 hover:underline"
                        >
                          Delete
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
            onSubmit={addOffice}
            className="mt-6 space-y-3 rounded-md border border-dashed border-zinc-300 p-4"
          >
            <p className="text-sm font-medium text-zinc-800">Add office</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col text-sm sm:col-span-2">
                <span>Name *</span>
                <input
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm sm:col-span-2">
                <span>Address line 1</span>
                <input
                  value={officeAddressLine1}
                  onChange={(e) => setOfficeAddressLine1(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm sm:col-span-2">
                <span>Address line 2</span>
                <input
                  value={officeAddressLine2}
                  onChange={(e) => setOfficeAddressLine2(e.target.value)}
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
                <span>Region / state</span>
                <input
                  value={officeRegion}
                  onChange={(e) => setOfficeRegion(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span>Postal code</span>
                <input
                  value={officePostalCode}
                  onChange={(e) => setOfficePostalCode(e.target.value)}
                  className={f}
                />
              </label>
              <label className="flex flex-col text-sm">
                <span>Country (ISO-2)</span>
                <input
                  value={officeCountry}
                  onChange={(e) =>
                    setOfficeCountry(e.target.value.toUpperCase().slice(0, 2))
                  }
                  maxLength={2}
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
      )}

      {(!isSrmShell || srmTab === "capabilities") && (
        <SupplierCapabilitiesSection
          key={`${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          initialRows={initial.capabilities}
        />
      )}

      {(!isSrmShell || srmTab === "onboarding") && (
        <SupplierOnboardingSection
          key={`onb-${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          initialRows={initial.onboardingTasks}
          workflowSummary={initial.onboardingWorkflow}
          supplierApprovalStatus={initial.approvalStatus}
        />
      )}

      {(!isSrmShell || srmTab === "qualification") && (
        <SupplierQualificationSection
          key={`qual-${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          qualification={initial.qualification}
        />
      )}

      {(!isSrmShell || srmTab === "compliance") && (
        <>
          <SupplierComplianceDocumentSignals
            key={`comp-signals-${initial.id}-${initial.updatedAt}`}
            documents={initial.documents}
            complianceReviews={initial.complianceReviews}
            isSrmShell={isSrmShell}
            onOpenDocumentsTab={openDocumentsWorkspace}
          />
          <SupplierComplianceReviewsSection
            key={`comp-${initial.id}-${initial.updatedAt}`}
            supplierId={initial.id}
            canEdit={canEdit}
            initialRows={initial.complianceReviews}
          />
        </>
      )}

      {(!isSrmShell || srmTab === "contracts") && (
        <SupplierContractRecordsSection
          key={`ctr-${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          initialRows={initial.contractRecords}
        />
      )}

      {(!isSrmShell || srmTab === "performance") && (
        <SupplierPerformanceScorecardsSection
          key={`perf-${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          initialRows={initial.performanceScorecards}
        />
      )}

      {(!isSrmShell || srmTab === "risk") && (
        <SupplierRiskRecordsSection
          key={`risk-${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          initialRows={initial.riskRecords}
        />
      )}

      {(!isSrmShell || srmTab === "documents") && (
        <SupplierDocumentsSection
          key={`docs-${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          initialRows={initial.documents}
          registerCategoryFocus={documentsRegisterCategory}
          onConsumedRegisterCategoryFocus={() => setDocumentsRegisterCategory(null)}
        />
      )}

      {(!isSrmShell || srmTab === "relationship") && (
        <SupplierRelationshipNotesSection
          key={`rel-${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          initialRows={initial.relationshipNotes}
        />
      )}

      {(!isSrmShell || srmTab === "alerts") && (
        <SupplierSrmAlertsSection
          key={`alerts-${initial.id}-${initial.updatedAt}`}
          supplierId={initial.id}
          canEdit={canEdit}
          initialRows={initial.srmAlerts}
        />
      )}
    </div>
  );
}
