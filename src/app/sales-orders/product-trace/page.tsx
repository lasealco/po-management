import { ProductTraceWorkspace } from "@/components/product-trace/product-trace-workspace";

export const dynamic = "force-dynamic";

export default function SalesOrdersProductTracePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ProductTraceWorkspace searchParams={searchParams} />;
}
