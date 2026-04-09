import { ProductCreateForm } from "@/components/product-create-form";

export default function ProductsPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-zinc-900">Products</h1>
        <p className="mt-2 text-zinc-600">
          Create catalog items for the demo tenant. A fuller catalog UI can
          build on this later.
        </p>
        <div className="mt-8">
          <ProductCreateForm />
        </div>
      </main>
    </div>
  );
}
