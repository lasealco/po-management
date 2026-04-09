"use client";

import { useRouter } from "next/navigation";
import { ProductCreateForm } from "@/components/product-create-form";

export type ProductFormOptions = {
  categories: { id: string; name: string }[];
  divisions: { id: string; name: string }[];
  supplierOffices: { id: string; label: string }[];
  suppliers: { id: string; name: string }[];
};

export function ProductCreatePanel(options: ProductFormOptions) {
  const router = useRouter();
  return <ProductCreateForm {...options} onSuccess={() => router.refresh()} />;
}
