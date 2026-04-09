import { NextResponse } from "next/server";
import { requireApiGrant } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const DEFAULT_TENANT_SLUG = "demo-company";

export async function GET() {
  const gate = await requireApiGrant("org.settings", "view");
  if (gate) return gate;

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
    select: { id: true, name: true, slug: true },
  });

  if (!tenant) {
    return NextResponse.json(
      {
        error:
          "Demo tenant not found. Run `npm run db:seed` to create starter data.",
      },
      { status: 404 },
    );
  }

  const workflows = await prisma.workflow.findMany({
    where: { tenantId: tenant.id },
    include: {
      statuses: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          code: true,
          label: true,
          isStart: true,
          isEnd: true,
          sortOrder: true,
        },
      },
      transitions: {
        select: {
          fromStatusId: true,
          toStatusId: true,
          actionCode: true,
          label: true,
          requiresComment: true,
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ tenant, workflows });
}
