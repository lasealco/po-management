import Link from "next/link";

type HomeQuickActionsProps = {
  canManageSuppliers: boolean;
  canUseConsolidation: boolean;
  canManageUsers: boolean;
};

export function HomeQuickActions({
  canManageSuppliers,
  canUseConsolidation,
  canManageUsers,
}: HomeQuickActionsProps) {
  return (
    <section className="mx-auto mb-4 grid w-full max-w-7xl gap-3 px-4 pt-4 md:grid-cols-3">
      <Link
        href="/suppliers"
        className={`rounded-xl border px-4 py-3 shadow-sm transition hover:shadow ${
          canManageSuppliers
            ? "border-amber-200 bg-amber-50"
            : "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-60"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Master Data</p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">Suppliers</p>
        <p className="mt-1 text-xs text-zinc-700">Create or update supplier profiles and contacts.</p>
      </Link>
      <Link
        href="/consolidation"
        className={`rounded-xl border px-4 py-3 shadow-sm transition hover:shadow ${
          canUseConsolidation
            ? "border-blue-200 bg-blue-50"
            : "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-60"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Planning</p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">Load Consolidation</p>
        <p className="mt-1 text-xs text-zinc-700">Build loads and monitor capacity warnings.</p>
      </Link>
      <Link
        href="/settings/users"
        className={`rounded-xl border px-4 py-3 shadow-sm transition hover:shadow ${
          canManageUsers
            ? "border-emerald-200 bg-emerald-50"
            : "cursor-not-allowed border-zinc-200 bg-zinc-100 opacity-60"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Access</p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">Users & Roles</p>
        <p className="mt-1 text-xs text-zinc-700">Invite users and assign portal permissions.</p>
      </Link>
    </section>
  );
}
