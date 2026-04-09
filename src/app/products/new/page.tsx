import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { ProductCreatePanel } from "@/components/product-create-panel";
import { getViewerGrantSet, viewerHas } from "@/lib/authz";
import { getProductFormOptions } from "@/lib/product-form-options";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const access = await getViewerGrantSet();

  if (!access) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <p className="text-zinc-600">Demo tenant not found. Run db:seed.</p>
      </div>
    );
  }

  if (!access.user) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="New product"
          message="Choose a demo user in the header."
        />
      </div>
    );
  }

  if (!viewerHas(access.grantSet, "org.products", "edit")) {
    return (
      <div className="min-h-screen bg-zinc-50 px-6 py-16">
        <AccessDenied
          title="New product"
          message="You do not have permission to create products (org.products → edit)."
        />
      </div>
    );
  }

  const opts = await getProductFormOptions(access.tenant.id);

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <Link
          href="/products"
          className="text-sm text-zinc-600 hover:text-zinc-900"
        >
          ← Product catalog
        </Link>
        <div className="mt-2">
          <ProductCreatePanel {...opts} afterCreateRedirect="/products" />
        </div>
      </main>
    </div>
  );
}
