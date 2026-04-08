import { CreateSupplierForm } from "@/components/create-supplier-form";

export const dynamic = "force-dynamic";

export default function NewSupplierPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-zinc-900">Create supplier</h1>
        <p className="mt-2 text-zinc-600">
          Add a supplier record to use on purchase orders.
        </p>
      </header>

      <CreateSupplierForm />
    </main>
  );
}
