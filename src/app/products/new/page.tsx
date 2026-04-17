import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { WorkflowHeader } from "@/components/workflow-header";
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
          message="Choose an active demo user: open Settings → Demo session (/settings/demo)."
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
        <Link href="/products" className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline">
          ← Product catalog
        </Link>
        <div className="mt-3">
          <WorkflowHeader
            eyebrow="Product creation workspace"
            title="Create product"
            description="Standardize new SKU setup in three steps so commercial, sourcing, and logistics teams read the same product record."
            steps={["Step 1: Basic identification", "Step 2: Classification and compliance", "Step 3: Supplier linking and save"]}
            className="rounded-3xl p-6"
          />
        </div>
        <div className="mt-4">
          <ProductCreatePanel {...opts} afterCreateRedirect="/products" />
        </div>
      </main>
    </div>
  );
}
