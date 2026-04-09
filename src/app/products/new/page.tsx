import Link from "next/link";
import { ProductCreatePanel } from "@/components/product-create-panel";
import { getDemoTenant } from "@/lib/demo-tenant";
import { getProductFormOptions } from "@/lib/product-form-options";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const tenant = await getDemoTenant();

  if (!tenant) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  const opts = await getProductFormOptions(tenant.id);

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/products"
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Product catalog
        </Link>
        <div className="mt-4">
          <ProductCreatePanel {...opts} afterCreateRedirect="/products" />
        </div>
      </main>
    </div>
  );
}
