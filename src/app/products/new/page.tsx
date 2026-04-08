import { CreateProductForm } from "@/components/create-product-form";

export const dynamic = "force-dynamic";

export default function NewProductPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-zinc-900">Create product</h1>
        <p className="mt-2 text-zinc-600">
          Add a product to your catalog so it can be referenced by purchase order items.
        </p>
      </header>

      <CreateProductForm />
    </main>
  );
}
