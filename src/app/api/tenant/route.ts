import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import { requireApiGrant } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

const MAX_NAME = 120;
const MAX_SHORT = 200;
const MAX_URL = 500;
const MAX_LINE = 500;

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t.length ? t : null;
}

type ReadOpt = { skip: true } | { skip: false; value: string | null } | { error: string };

function readOptionalString(o: Record<string, unknown>, key: string, max: number): ReadOpt {
  if (!(key in o)) {
    return { skip: true };
  }
  const v = o[key];
  if (v === null) {
    return { skip: false, value: null };
  }
  if (typeof v !== "string") {
    return { error: `${key} must be a string or null.` };
  }
  if (v.length > max) {
    return { error: `${key} is too long (max ${max}).` };
  }
  return { skip: false, value: emptyToNull(v) };
}

export async function PATCH(request: Request) {
  const gate = await requireApiGrant("org.settings", "edit");
  if (gate) return gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON body.", code: "BAD_INPUT", status: 400 });
  }

  if (!body || typeof body !== "object") {
    return toApiErrorResponse({ error: "Expected an object.", code: "BAD_INPUT", status: 400 });
  }

  const o = body as Record<string, unknown>;
  if (typeof o.name !== "string") {
    return toApiErrorResponse({ error: "name must be a string.", code: "BAD_INPUT", status: 400 });
  }

  const name = o.name.trim();
  if (!name.length) {
    return toApiErrorResponse({ error: "name is required.", code: "BAD_INPUT", status: 400 });
  }
  if (name.length > MAX_NAME) {
    return toApiErrorResponse({ error: `name must be at most ${MAX_NAME} characters.`, code: "BAD_INPUT", status: 400 });
  }

  const legal = readOptionalString(o, "legalName", MAX_SHORT);
  const phone = readOptionalString(o, "phone", MAX_SHORT);
  const line1 = readOptionalString(o, "addressLine1", MAX_LINE);
  const line2 = readOptionalString(o, "addressLine2", MAX_LINE);
  const city = readOptionalString(o, "addressCity", MAX_LINE);
  const region = readOptionalString(o, "addressRegion", MAX_LINE);
  const postal = readOptionalString(o, "addressPostalCode", MAX_LINE);
  const website = readOptionalString(o, "website", MAX_URL);
  const linkedin = readOptionalString(o, "linkedinUrl", MAX_URL);
  const twitter = readOptionalString(o, "twitterUrl", MAX_URL);
  const country = readOptionalString(o, "addressCountryCode", 2);

  for (const r of [legal, phone, line1, line2, city, region, postal, website, linkedin, twitter, country]) {
    if (r && "error" in r) {
      return toApiErrorResponse({ error: r.error, code: "BAD_INPUT", status: 400 });
    }
  }

  if (country && !("error" in country) && !country.skip && country.value !== null) {
    if (country.value.length !== 2) {
      return toApiErrorResponse({
        error: "addressCountryCode must be a 2-letter ISO code or empty.",
        code: "BAD_INPUT",
        status: 400,
      });
    }
  }

  const tenant = await getDemoTenant();
  if (!tenant) {
    return toApiErrorResponse({ error: "Demo tenant not found. Run `npm run db:seed` to create starter data.", code: "NOT_FOUND", status: 404 });
  }

  const data: Prisma.TenantUpdateInput = { name };

  if (legal && !("error" in legal) && !legal.skip) {
    data.legalName = legal.value;
  }
  if (phone && !("error" in phone) && !phone.skip) {
    data.phone = phone.value;
  }
  if (line1 && !("error" in line1) && !line1.skip) {
    data.addressLine1 = line1.value;
  }
  if (line2 && !("error" in line2) && !line2.skip) {
    data.addressLine2 = line2.value;
  }
  if (city && !("error" in city) && !city.skip) {
    data.addressCity = city.value;
  }
  if (region && !("error" in region) && !region.skip) {
    data.addressRegion = region.value;
  }
  if (postal && !("error" in postal) && !postal.skip) {
    data.addressPostalCode = postal.value;
  }
  if (country && !("error" in country) && !country.skip) {
    data.addressCountryCode = country.value === null ? null : country.value.toUpperCase();
  }
  if (website && !("error" in website) && !website.skip) {
    data.website = website.value;
  }
  if (linkedin && !("error" in linkedin) && !linkedin.skip) {
    data.linkedinUrl = linkedin.value;
  }
  if (twitter && !("error" in twitter) && !twitter.skip) {
    data.twitterUrl = twitter.value;
  }

  const updated = await prisma.tenant.update({
    where: { id: tenant.id },
    data,
    select: {
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
    },
  });

  return NextResponse.json({ tenant: updated });
}
