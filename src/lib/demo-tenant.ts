import { prisma } from "@/lib/prisma";

export const DEMO_TENANT_SLUG = "demo-company";

export async function getDemoTenant() {
  return prisma.tenant.findUnique({
    where: { slug: DEMO_TENANT_SLUG },
    select: { id: true, name: true, slug: true },
  });
}
