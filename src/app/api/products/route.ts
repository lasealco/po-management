import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_TENANT_SLUG = "demo-company";

type CreateProductBody = {
  sku?: string;
  name?: string;
  description?: string;
  unit?: string;
  isActive?: boolean;
};

function normalizeOptionalString(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function POST(request: NextRequest) {
  let body: CreateProductBody;

  try {
    body = (await request.json()) as CreateProductBody;
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
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: normalizeOptionalString(body.sku),
        name,
        description: normalizeOptionalString(body.description),
        unit: normalizeOptionalString(body.unit),
        isActive: body.isActive ?? true,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        unit: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, product }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          error:
            "Product SKU already exists for this tenant. Please use a different SKU.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Unable to create product." },
      { status: 500 },
    );
  }
}
