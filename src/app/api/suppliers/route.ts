import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_TENANT_SLUG = "demo-company";

type CreateSupplierBody = {
  code?: string;
  name?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
};

function normalizeOptionalString(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function POST(request: NextRequest) {
  let body: CreateSupplierBody;

  try {
    body = (await request.json()) as CreateSupplierBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
    select: { id: true },
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

  try {
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        code: normalizeOptionalString(body.code),
        name,
        email: normalizeOptionalString(body.email),
        phone: normalizeOptionalString(body.phone),
        isActive: body.isActive ?? true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, supplier }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "Supplier code already exists for this tenant. Please use a different code.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create supplier." },
      { status: 500 },
    );
  }
}
