import { NextResponse } from "next/server";
import { SrmSupplierCategory, SupplierApprovalStatus } from "@prisma/client";

import {
  getActorUserId,
  loadGlobalGrantsForUser,
  requireApiGrant,
  viewerHas,
} from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const gate = await requireApiGrant("org.suppliers", "view");
  if (gate) return gate;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { offices: true, productSuppliers: true } },
    },
  });

  return NextResponse.json({ suppliers });
}

export async function POST(request: Request) {
  const gate = await requireApiGrant("org.suppliers", "edit");
  if (gate) return gate;

  const actorId = await getActorUserId();
  if (!actorId) {
    return NextResponse.json({ error: "No active user." }, { status: 403 });
  }
  const grantSet = await loadGlobalGrantsForUser(actorId);
  const canApprove = viewerHas(grantSet, "org.suppliers", "approve");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object." }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const name =
    typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const code =
    typeof o.code === "string" && o.code.trim() ? o.code.trim() : null;
  const email =
    typeof o.email === "string" && o.email.trim() ? o.email.trim() : null;
  const phone =
    typeof o.phone === "string" && o.phone.trim() ? o.phone.trim() : null;
  const legalName =
    typeof o.legalName === "string" && o.legalName.trim() ? o.legalName.trim() : null;
  const website =
    typeof o.website === "string" && o.website.trim() ? o.website.trim() : null;
  const taxId =
    typeof o.taxId === "string" && o.taxId.trim() ? o.taxId.trim() : null;
  const registeredAddressLine1 =
    typeof o.registeredAddressLine1 === "string" && o.registeredAddressLine1.trim()
      ? o.registeredAddressLine1.trim()
      : null;
  const registeredCity =
    typeof o.registeredCity === "string" && o.registeredCity.trim() ? o.registeredCity.trim() : null;
  const registeredRegion =
    typeof o.registeredRegion === "string" && o.registeredRegion.trim() ? o.registeredRegion.trim() : null;
  const registeredPostalCode =
    typeof o.registeredPostalCode === "string" && o.registeredPostalCode.trim()
      ? o.registeredPostalCode.trim()
      : null;
  const rawCountry =
    typeof o.registeredCountryCode === "string" ? o.registeredCountryCode.trim().toUpperCase() : "";
  const registeredCountryCode = rawCountry ? rawCountry.slice(0, 2) : null;
  const paymentTermsLabel =
    typeof o.paymentTermsLabel === "string" && o.paymentTermsLabel.trim() ? o.paymentTermsLabel.trim() : null;
  const rawPaymentTermsDays =
    o.paymentTermsDays == null || o.paymentTermsDays === ""
      ? null
      : Number.parseInt(String(o.paymentTermsDays), 10);
  if (rawPaymentTermsDays != null && (!Number.isFinite(rawPaymentTermsDays) || rawPaymentTermsDays < 0 || rawPaymentTermsDays > 3650)) {
    return NextResponse.json({ error: "paymentTermsDays must be a whole number between 0 and 3650." }, { status: 400 });
  }
  const paymentTermsDays = rawPaymentTermsDays;
  const defaultIncoterm =
    typeof o.defaultIncoterm === "string" && o.defaultIncoterm.trim()
      ? o.defaultIncoterm.trim().toUpperCase()
      : null;

  const srmCategoryRaw =
    typeof o.srmCategory === "string" ? o.srmCategory.trim().toLowerCase() : "";
  const srmCategory: SrmSupplierCategory =
    srmCategoryRaw === "logistics"
      ? SrmSupplierCategory.logistics
      : SrmSupplierCategory.product;

  const tenant = await getDemoTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: tenant.id,
        name,
        code,
        email,
        phone,
        legalName,
        website,
        taxId,
        registeredAddressLine1,
        registeredCity,
        registeredRegion,
        registeredPostalCode,
        registeredCountryCode,
        paymentTermsLabel,
        paymentTermsDays,
        defaultIncoterm,
        srmCategory,
        ...(canApprove
          ? {
              approvalStatus: SupplierApprovalStatus.approved,
              isActive: true,
            }
          : {
              approvalStatus: SupplierApprovalStatus.pending_approval,
              isActive: false,
            }),
      },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        phone: true,
        isActive: true,
        srmCategory: true,
        approvalStatus: true,
      },
    });
    return NextResponse.json({ supplier });
  } catch (e: unknown) {
    const codeErr =
      typeof e === "object" && e !== null && "code" in e
        ? (e as { code: string }).code
        : null;
    if (codeErr === "P2002") {
      return NextResponse.json(
        { error: "Supplier code must be unique per tenant." },
        { status: 409 },
      );
    }
    throw e;
  }
}
