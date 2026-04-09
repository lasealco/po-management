"use client";

import { useRouter } from "next/navigation";
import {
  ProductCatalogForm,
  type ProductFormOptions,
} from "@/components/product-catalog-form";

export type { ProductFormOptions };

export function ProductCreatePanel(
  options: ProductFormOptions & { afterCreateRedirect?: string },
) {
  const router = useRouter();
  const { afterCreateRedirect, ...rest } = options;
  return (
    <ProductCatalogForm
      mode="create"
      {...rest}
      onSuccess={() => {
        if (afterCreateRedirect) {
          router.push(afterCreateRedirect);
        }
        router.refresh();
      }}
    />
  );
}
