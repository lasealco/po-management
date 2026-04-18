import type { Metadata } from "next";
import Link from "next/link";

import { getViewerGrantSet } from "@/lib/authz";
import { resolveNavState } from "@/lib/nav-visibility";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ARSCMP — Platform",
  description: "Choose a workspace: POs, Control Tower, WMS, CRM, SRM, and more.",
};

type ModuleCard = {
  href: string;
  title: string;
  description: string;
};

export default async function PlatformHomePage() {
  const access = await getViewerGrantSet();
  const { linkVisibility } = await resolveNavState(access);

  if (!access) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Welcome</h1>
        <p className="mt-4 text-zinc-600">
          Demo tenant not found. Run{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">npm run db:seed</code> locally,
          then deploy.
        </p>
      </main>
    );
  }

  const tenantName = access.tenant.name;
  const user = access.user;
  const v = linkVisibility;

  const modules: ModuleCard[] = [];
  if (v?.poManagement) {
    modules.push({
      href: "/orders",
      title: "PO Management",
      description: "Orders, consolidations, and products.",
    });
  }
  if (v?.salesOrders) {
    modules.push({
      href: "/sales-orders",
      title: "Sales Orders",
      description: "Customer orders and fulfillment handoff.",
    });
  }
  if (v?.reports) {
    modules.push({
      href: "/executive",
      title: "Executive Dashboard",
      description: "CEO command center for demand, risk, and capital exposure.",
    });
    modules.push({
      href: "/reporting",
      title: "Reporting",
      description: "Analytics hub across modules.",
    });
  }
  if (v?.controlTower) {
    modules.push({
      href: "/control-tower",
      title: "Control Tower",
      description: "Shipments, workbench, digest list, alerts, and reporting.",
    });
  }
  if (v?.wms) {
    modules.push({
      href: "/wms",
      title: "WMS",
      description: "Warehouse operations and inventory.",
    });
  }
  if (v?.crm) {
    modules.push({
      href: "/crm",
      title: "CRM",
      description: "Pipeline, accounts, and quotes.",
    });
  }
  if (v?.srm) {
    modules.push({
      href: "/srm",
      title: "SRM",
      description: "Supplier relationship management and supplier master data.",
    });
  }
  if (v?.settings) {
    modules.push({
      href: "/settings",
      title: "Settings",
      description: "Users, roles, and organization.",
    });
  }

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-gradient-to-b from-zinc-50 via-white to-zinc-50">
      <div className="mx-auto max-w-5xl px-6 pb-20 pt-12 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--arscmp-primary)]">
          {tenantName}
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
          Run procurement and logistics in one place.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-600">
          PO workflow, Control Tower, warehouse, and CRM — pick a workspace below or use the top
          navigation and command palette (
          <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">
            Ctrl K
          </kbd>{" "}
          or{" "}
          <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">
            ⌘K
          </kbd>
          ).
        </p>

        {!user ? (
          <div className="mt-10 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-950">Choose a demo user</h2>
            <p className="mt-2 text-sm text-amber-900/90">
              Open{" "}
              <Link
                href="/settings/demo"
                className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
              >
                Settings → Demo session
              </Link>{" "}
              to pick who you are acting as, then come back here. This environment uses demo accounts
              for investor and buyer walkthroughs.
            </p>
            <p className="mt-4 text-sm text-amber-900/80">
              Password sign-in:{" "}
              <Link
                href="/login"
                className="font-medium text-[var(--arscmp-primary)] underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-zinc-500">
            Signed in as <span className="font-medium text-zinc-800">{user.name}</span> (
            {user.email}).
          </p>
        )}

        {user && modules.length > 0 ? (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {modules.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  className="group flex h-full flex-col rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm transition-all hover:border-[var(--arscmp-primary)]/35 hover:shadow-md"
                >
                  <span className="text-lg font-semibold text-zinc-900 group-hover:text-[var(--arscmp-primary)]">
                    {m.title}
                  </span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-zinc-600">
                    {m.description}
                  </span>
                  <span className="mt-4 text-sm font-medium text-[var(--arscmp-primary)]">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {user && modules.length === 0 ? (
          <p className="mt-10 rounded-xl border border-zinc-200 bg-white p-6 text-zinc-600">
            No modules are available for this account yet. Ask an administrator to assign roles, or
            run{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">npm run db:seed</code> on this
            database.
          </p>
        ) : null}

        <p className="mt-10 text-center text-sm text-zinc-500">
          <Link href="/" className="text-[var(--arscmp-primary)] underline-offset-2 hover:underline">
            ← Back to overview
          </Link>
        </p>
      </div>
    </main>
  );
}
