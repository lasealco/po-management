"use client";

import { useRouter } from "next/navigation";
import { ProductCreateForm } from "@/components/product-create-form";

export function ProductCreatePanel() {
  const router = useRouter();
  return <ProductCreateForm onSuccess={() => router.refresh()} />;
}
