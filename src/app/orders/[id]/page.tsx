import { OrderDetail } from "@/components/order-detail";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-zinc-50">
      <OrderDetail orderId={id} />
    </div>
  );
}
