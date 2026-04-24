import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const DEMO_TENANT_SLUG = "demo-company";

const demoTenantSelect = {
  id: true,
  name: true,
  slug: true,
  legalName: true,
  phone: true,
  website: true,
  addressLine1: true,
  addressLine2: true,
  addressCity: true,
  addressRegion: true,
  addressPostalCode: true,
  addressCountryCode: true,
  linkedinUrl: true,
  twitterUrl: true,
} satisfies Prisma.TenantSelect;

export type DemoTenant = Prisma.TenantGetPayload<{ select: typeof demoTenantSelect }>;

export async function getDemoTenant(): Promise<DemoTenant | null> {
  return prisma.tenant.findUnique({
    where: { slug: DEMO_TENANT_SLUG },
    select: demoTenantSelect,
  });
}
