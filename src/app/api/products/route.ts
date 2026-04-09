import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_TENANT_SLUG = "demo-company";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON object." }, { status: 400 });
  }

  const { sku, name, description, unit } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
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

  const skuValue =
    typeof sku === "string" && sku.trim() ? sku.trim() : null;
  const descriptionValue =
    typeof description === "string" && description.trim()
      ? description.trim()
      : null;
  const unitValue =
    typeof unit === "string" && unit.trim() ? unit.trim() : null;

  try {
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: skuValue,
        name: name.trim(),
        description: descriptionValue,
        unit: unitValue,
      },
      select: { id: true, name: true, sku: true },
    });

    return NextResponse.json({ product });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "A product with this SKU already exists for this tenant." },
        { status: 409 },
      );
    }
    throw e;
  }
}
