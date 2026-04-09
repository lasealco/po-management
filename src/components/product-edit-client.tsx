"use client";

import { useRouter } from "next/navigation";
import {
  ProductCatalogForm,
  type ProductFormInitial,
  type ProductFormOptions,
} from "@/components/product-catalog-form";

export function ProductEditClient(
  props: ProductFormOptions & {
    productId: string;
    initial: ProductFormInitial;
  },
) {
  const router = useRouter();
  return (
    <ProductCatalogForm
      {...props}
      mode="edit"
      onSuccess={() => router.refresh()}
    />
  );
}
