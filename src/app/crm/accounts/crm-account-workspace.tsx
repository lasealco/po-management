"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ACCOUNT_WORKSPACE_TABS,
  parseAccountWorkspaceTab,
  validateAccountSummaryInput,
  validateAccountMapGeoPair,
  validateContactCreateInput,
  validateQuoteDraftInput,
  type AccountWorkspaceTabId,
} from "@/lib/crm/account-workspace";
import { apiClientErrorMessage } from "@/lib/api-client-error";

type AccountDetail = {
  id: string;
  name: string;
  legalName: string | null;
  website: string | null;
  accountType: string;
  lifecycle: string;
  industry: string | null;
  segment: string | null;
  strategicFlag: boolean;
  ownerUserId: string;
  mapLatitude: string | null;
  mapLongitude: string | null;
};

type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  decisionRole: string | null;
};

type OppRow = {
  id: string;
  name: string;
  stage: string;
  probability: number;
  closeDate: string | null;
  nextStep: string | null;
};

type ActRow = {
  id: string;
  type: string;
  subject: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
};

type QuoteRow = {
  id: string;
  title: string;
  status: string;
  quoteNumber: string | null;
  subtotal: string | null;
  validUntil: string | null;
  updatedAt: string;
};

const TABS: ReadonlyArray<{ id: AccountWorkspaceTabId; label: string }> = [
  { id: "overview" as const, label: "Overview" },
  { id: "contacts" as const, label: "Contacts" },
  { id: "opportunities" as const, label: "Opportunities" },
  { id: "quotes" as const, label: "Quotes" },
  { id: "shipments" as const, label: "Shipments" },
  { id: "finance" as const, label: "Finance" },
];

const WORKSPACE_ZONES: {
  step: string;
  title: string;
  blurb: string;
  tabs: readonly AccountWorkspaceTabId[];
}[] = [
  {
    step: "Step 1",
    title: "Profile",
    blurb: "Summary, ownership, and recent CRM activity.",
    tabs: ["overview"],
  },
  {
    step: "Step 2",
    title: "Relationships",
    blurb: "People, pipeline, and commercial quotes.",
    tabs: ["contacts", "opportunities", "quotes"],
  },
  {
    step: "Step 3",
    title: "Execution & finance",
    blurb: "Shipments and ledger context when integrations are on.",
    tabs: ["shipments", "finance"],
  },
];

const primaryBtn =
  "rounded-xl bg-[var(--arscmp-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-95 disabled:opacity-50";

const secondaryOutlineBtn =
  "rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50";

export function CrmAccountWorkspace({
  accountId,
  actorUserId,
  canEditAll,
}: {
  accountId: string;
  actorUserId: string;
  canEditAll: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialTab = useMemo(() => {
    return parseAccountWorkspaceTab(searchParams.get("tab"));
  }, [searchParams]);

  const [tab, setTab] = useState<AccountWorkspaceTabId>(initialTab);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const currentRaw = params.get("tab");
    const current = currentRaw && ACCOUNT_WORKSPACE_TABS.includes(currentRaw as AccountWorkspaceTabId)
      ? currentRaw
      : "";
    const want = tab === "overview" ? "" : tab;
    if (current === want) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    if (tab === "overview") nextParams.delete("tab");
    else nextParams.set("tab", tab);
    const q = nextParams.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [tab, pathname, router, searchParams]);

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [opportunities, setOpportunities] = useState<OppRow[]>([]);
  const [activities, setActivities] = useState<ActRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [strategic, setStrategic] = useState(false);
  const [mapLat, setMapLat] = useState("");
  const [mapLng, setMapLng] = useState("");

  const [cFirst, setCFirst] = useState("");
  const [cLast, setCLast] = useState("");
  const [cEmail, setCEmail] = useState("");

  const [quoteTitle, setQuoteTitle] = useState("");

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    if (opts?.refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/crm/accounts/${accountId}`);
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Load failed"));
      const body = data as {
        account: AccountDetail;
        contacts?: ContactRow[];
        opportunities?: OppRow[];
        activities?: ActRow[];
        quotes?: QuoteRow[];
      };
      setAccount(body.account);
      setName(body.account.name);
      setIndustry(body.account.industry ?? "");
      setStrategic(body.account.strategicFlag);
      setMapLat(body.account.mapLatitude?.trim() ?? "");
      setMapLng(body.account.mapLongitude?.trim() ?? "");
      setContacts(body.contacts ?? []);
      setOpportunities(body.opportunities ?? []);
      setActivities(body.activities ?? []);
      setQuotes(body.quotes ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Load failed");
    } finally {
      if (opts?.refresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateAccountSummaryInput({ name, industry });
    if (!validation.ok) {
      setActionError(validation.error);
      return;
    }
    const geo = validateAccountMapGeoPair(mapLat, mapLng);
    if (!geo.ok) {
      setActionError(geo.error);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/crm/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry: industry.trim() || null,
          strategicFlag: strategic,
          mapLatitude: geo.lat,
          mapLongitude: geo.lng,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Save failed"));
      setAccount((data as { account: AccountDetail }).account);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateContactCreateInput({
      firstName: cFirst,
      lastName: cLast,
      email: cEmail,
    });
    if (!validation.ok) {
      setActionError(validation.error);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          firstName: cFirst.trim(),
          lastName: cLast.trim(),
          email: cEmail.trim() || null,
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Add contact failed"));
      setCFirst("");
      setCLast("");
      setCEmail("");
      await load({ refresh: true });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function createQuote(e: React.FormEvent) {
    e.preventDefault();
    const validation = validateQuoteDraftInput({ title: quoteTitle });
    if (!validation.ok) {
      setActionError(validation.error);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/crm/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          title: quoteTitle.trim(),
        }),
      });
      const data: unknown = await res.json();
      if (!res.ok) throw new Error(apiClientErrorMessage(data, "Create quote failed"));
      setQuoteTitle("");
      await load({ refresh: true });
      setTab("quotes");
      const quoteId = (data as { quote?: { id?: string } }).quote?.id;
      if (quoteId) {
        router.push(`/crm/quotes/${quoteId}`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  if (loadError && !account) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-red-700">{loadError}</p>
        <Link
          href="/crm"
          className="mt-4 inline-block text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
        >
          ← Back to CRM
        </Link>
      </div>
    );
  }

  if (!account && loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!account) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-zinc-700">
          Account context is unavailable right now. Try reloading this workspace.
        </p>
        <Link
          href="/crm/accounts"
          className="mt-4 inline-block text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
        >
          ← Back to Accounts
        </Link>
      </div>
    );
  }

  const canPatch = canEditAll || account.ownerUserId === actorUserId;
  const panelLoading = loading || refreshing;
  const canSaveAccountDraft = !!name.trim() && name.trim().length >= 2;
  const canAddContactDraft =
    !!cFirst.trim() &&
    !!cLast.trim() &&
    cFirst.trim().length >= 2 &&
    cLast.trim().length >= 2;
  const canCreateQuoteDraft = quoteTitle.trim().length >= 6;

  const tabMeta: Record<AccountWorkspaceTabId, { description: string; empty: string }> = {
    overview: {
      description: "Track profile context and account timeline at a glance.",
      empty: "No activities linked to this account yet.",
    },
    contacts: {
      description: "Maintain key stakeholders and roles.",
      empty: "No contacts are linked to this account yet.",
    },
    opportunities: {
      description: "Review pipeline tied to this account.",
      empty: "No opportunities are linked to this account yet.",
    },
    quotes: {
      description: "Start and monitor commercial proposals.",
      empty: "No quotes are linked to this account yet.",
    },
    shipments: {
      description: "Execution placeholder for future shipment integrations.",
      empty: "Shipment data is not available yet.",
    },
    finance: {
      description: "Financial placeholder for ERP/accounting integrations.",
      empty: "Financial account data is not available yet.",
    },
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/crm/accounts"
          className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
        >
          ← Accounts
        </Link>
        <span className="text-zinc-300">/</span>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {account.name}
        </h1>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
          {account.accountType}
        </span>
        {account.strategicFlag ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            Strategic
          </span>
        ) : null}
        <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-600">
          Account 360
        </span>
      </div>

      <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workflow</p>
        <p className="mt-1 text-sm text-zinc-600">
          Move across profile, relationships, and execution tabs. Shipments and finance are
          placeholders until integrations land.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {WORKSPACE_ZONES.map((zone) => {
            const active = zone.tabs.includes(tab);
            return (
              <button
                key={zone.step}
                type="button"
                onClick={() => setTab(zone.tabs[0])}
                className={`rounded-xl border p-4 text-left transition-shadow ${
                  active
                    ? "border-[var(--arscmp-primary)] bg-[color-mix(in_srgb,var(--arscmp-primary)_8%,white)] shadow-sm ring-1 ring-[var(--arscmp-primary)]/25"
                    : "border-zinc-200 bg-zinc-50/80 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {zone.step}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-900">{zone.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">{zone.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-zinc-200 pb-2">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === id
                ? "bg-[color-mix(in_srgb,var(--arscmp-primary)_14%,white)] text-[var(--arscmp-primary)]"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loadError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {loadError}
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {actionError}
        </div>
      ) : null}
      <section className="mb-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">{TABS.find((x) => x.id === tab)?.label}</h2>
        <p className="mt-1 text-sm text-zinc-600">{tabMeta[tab].description}</p>
        {panelLoading ? (
          <p className="mt-2 text-xs font-medium text-zinc-500">Refreshing account context…</p>
        ) : null}
      </section>

      {tab === "overview" ? (
        <>
          <section className="mb-10 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Account summary</h2>
            {canPatch ? (
              <form onSubmit={saveAccount} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  <span className="text-zinc-600">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    disabled={busy}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-zinc-600">Industry</span>
                  <input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                    disabled={busy}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={strategic}
                    onChange={(e) => setStrategic(e.target.checked)}
                    disabled={busy}
                  />
                  <span className="text-zinc-700">Strategic account</span>
                </label>
                <div className="sm:col-span-2 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Control Tower map (BF-19)
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Optional WGS84 coordinates — shown as read-only CRM pins on{" "}
                    <Link href="/control-tower/map" className="font-semibold text-[var(--arscmp-primary)] underline-offset-2 hover:underline">
                      /control-tower/map
                    </Link>{" "}
                    when you have org.crm view. Leave blank for privacy (no pin).
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="text-zinc-600">Latitude (°)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={mapLat}
                        onChange={(e) => setMapLat(e.target.value)}
                        placeholder="e.g. 51.9244"
                        className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm tabular-nums"
                        disabled={busy}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-zinc-600">Longitude (°)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={mapLng}
                        onChange={(e) => setMapLng(e.target.value)}
                        placeholder="e.g. 4.4777"
                        className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm tabular-nums"
                        disabled={busy}
                      />
                    </label>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <button type="submit" disabled={busy || !canSaveAccountDraft} className={primaryBtn}>
                    Save changes
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">Read-only for this user.</p>
            )}
          </section>
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Recent activities</h2>
            <ul className="mt-4 divide-y divide-zinc-100 text-sm">
              {panelLoading ? (
                <li className="py-3 text-zinc-500">Loading activities…</li>
              ) : activities.length === 0 ? (
                <li className="py-3 text-zinc-500">{tabMeta.overview.empty}</li>
              ) : (
                activities.map((a) => (
                  <li key={a.id} className="py-2">
                    <span className="font-medium text-zinc-800">{a.subject}</span>
                    <span className="text-zinc-500"> · {a.type}</span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      ) : null}

      {tab === "contacts" ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Contacts</h2>
          {canPatch ? (
            <form onSubmit={addContact} className="mt-4 grid gap-2 sm:grid-cols-3">
              <input
                placeholder="First"
                value={cFirst}
                onChange={(e) => setCFirst(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
              <input
                placeholder="Last"
                value={cLast}
                onChange={(e) => setCLast(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                disabled={busy}
              />
              <input
                placeholder="Email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm sm:col-span-3"
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !canAddContactDraft}
                className={`${secondaryOutlineBtn} sm:col-span-3`}
              >
                Add contact
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              You can view contacts but cannot add them on accounts you do not own.
            </p>
          )}
          <ul className="mt-4 divide-y divide-zinc-100 text-sm">
            {panelLoading ? (
              <li className="py-3 text-zinc-500">Loading contacts…</li>
            ) : contacts.length === 0 ? (
              <li className="py-3 text-zinc-500">{tabMeta.contacts.empty}</li>
            ) : (
              contacts.map((c) => (
                <li key={c.id} className="py-2">
                  <span className="font-medium text-zinc-900">
                    {c.firstName} {c.lastName}
                  </span>
                  {c.title ? <span className="text-zinc-500"> · {c.title}</span> : null}
                  {c.email ? <div className="text-xs text-zinc-500">{c.email}</div> : null}
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "opportunities" ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Opportunities</h2>
          <ul className="mt-4 divide-y divide-zinc-100 text-sm">
            {panelLoading ? (
              <li className="py-3 text-zinc-500">Loading opportunities…</li>
            ) : opportunities.length === 0 ? (
              <li className="py-3 text-zinc-500">{tabMeta.opportunities.empty}</li>
            ) : (
              opportunities.map((o) => (
                <li key={o.id} className="py-2">
                  <Link
                    href={`/crm/opportunities/${o.id}`}
                    className="font-medium text-[var(--arscmp-primary)] hover:underline"
                  >
                    {o.name}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {o.stage} · {o.probability}%
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "quotes" ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Quotes</h2>
          {canPatch ? (
            <form onSubmit={createQuote} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm">
                <span className="text-zinc-600">New quote title</span>
                <input
                  value={quoteTitle}
                  onChange={(e) => setQuoteTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  placeholder="e.g. Chicago lane — Q2 proposal"
                  disabled={busy}
                />
              </label>
              <button
                type="submit"
                disabled={busy || !canCreateQuoteDraft}
                className={primaryBtn}
              >
                Create & open
              </button>
            </form>
          ) : null}
          <ul className="mt-6 divide-y divide-zinc-100 text-sm">
            {panelLoading ? (
              <li className="py-3 text-zinc-500">Loading quotes…</li>
            ) : quotes.length === 0 ? (
              <li className="py-3 text-zinc-500">{tabMeta.quotes.empty}</li>
            ) : (
              quotes.map((q) => (
                <li key={q.id} className="py-2">
                  <Link
                    href={`/crm/quotes/${q.id}`}
                    className="font-medium text-[var(--arscmp-primary)] hover:underline"
                  >
                    {q.title}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {q.quoteNumber ?? "—"} · {q.status}
                    {q.subtotal != null ? ` · ${q.subtotal}` : ""}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      ) : null}

      {tab === "shipments" ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-sm text-amber-950 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-950">Shipments (placeholder)</h2>
          <p className="mt-2 leading-relaxed">
            This panel will show milestones, bookings, and execution status when shipment
            integrations are connected.
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-amber-800">
            Current state: empty integration feed
          </p>
          <p className="mt-1 text-xs text-amber-900/90">
            Use opportunities and activities for manual coordination until connectors are enabled.
          </p>
        </section>
      ) : null}

      {tab === "finance" ? (
        <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-6 text-sm text-sky-950 shadow-sm">
          <h2 className="text-lg font-semibold text-sky-950">Finance (placeholder)</h2>
          <p className="mt-2 leading-relaxed">
            Invoices, payments, and account health snapshots appear here once ERP/accounting
            connectors are enabled.
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-wide text-sky-800">
            Current state: empty integration feed
          </p>
          <p className="mt-1 text-xs text-sky-900/90">
            No finance records are synced for this account yet.
          </p>
        </section>
      ) : null}
    </div>
  );
}
