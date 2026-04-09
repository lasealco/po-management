import Link from "next/link";

type ProductRow = {
  id: string;
  productCode: string | null;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string | null;
  isActive: boolean;
  updatedAt: Date;
  category: { name: string } | null;
  division: { name: string } | null;
  supplierCount: number;
};

function truncate(text: string | null, max: number) {
  if (!text) return "—";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function ProductList({ products }: { products: ProductRow[] }) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-600">
        No products yet. Use the form below to add the first one.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Division</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Unit</th>
            <th className="px-4 py-3">Suppliers</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3"> </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {products.map((p) => (
            <tr key={p.id} className="text-zinc-800">
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-amber-800">
                {p.productCode ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-600">
                {p.sku ?? "—"}
              </td>
              <td className="px-4 py-3 font-medium text-zinc-900">{p.name}</td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                {p.category?.name ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                {p.division?.name ?? "—"}
              </td>
              <td className="max-w-[200px] px-4 py-3 text-zinc-600">
                {truncate(p.description, 48)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                {p.unit ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums text-zinc-700">
                {p.supplierCount}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {p.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                {p.updatedAt.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <Link
                  href={`/products/${p.id}`}
                  className="text-sm font-medium text-amber-800 underline-offset-2 hover:underline"
                >
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
