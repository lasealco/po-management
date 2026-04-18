import Link from "next/link";

export type SupplierSrmKind = "product" | "logistics";

export function SupplierKindTabs({
  active,
  basePath = "/suppliers",
  /** Appended after `kind=…`, e.g. `q=acme` (no leading `&`). */
  extraQuery,
}: {
  active: SupplierSrmKind;
  basePath?: "/suppliers" | "/srm";
  extraQuery?: string;
}) {
  const tab =
    "rounded-t-md border border-b-0 px-4 py-2 text-sm font-medium transition-colors";
  const activeTab = `${tab} border-zinc-200 bg-white text-zinc-900`;
  const idleTab = `${tab} border-transparent bg-zinc-100/80 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900`;

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-zinc-200"
      aria-label="Supplier categories"
    >
      <Link
        href={`${basePath}?kind=product${extraQuery ? `&${extraQuery}` : ""}`}
        className={active === "product" ? activeTab : idleTab}
        aria-current={active === "product" ? "page" : undefined}
      >
        Product suppliers
      </Link>
      <Link
        href={`${basePath}?kind=logistics${extraQuery ? `&${extraQuery}` : ""}`}
        className={active === "logistics" ? activeTab : idleTab}
        aria-current={active === "logistics" ? "page" : undefined}
      >
        Logistics suppliers
      </Link>
    </nav>
  );
}
