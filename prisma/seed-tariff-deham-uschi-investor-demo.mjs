/**
 * Investor demo: door-to-door FCL DEHAM → USCHI (40' HC), two ocean carrier options with
 * pre-carriage, forwarder-style charges, main ocean leg, and on-carriage — for /tariffs/rate-lookup.
 *
 * Prerequisites: migrate + `npm run db:seed` (normalized charge codes + demo tenant).
 *
 * Idempotent: deletes prior DEMO-INV-DD-* contract headers and DEMO_INV_DD_* geography groups.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const DEMO_SLUG = "demo-company";
const CONTRACT_NOS = ["DEMO-INV-DD-OPTION-A", "DEMO-INV-DD-OPTION-B"];
const GEO_PREFIX = "DEMO_INV_DD_";

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) {
  process.env.DATABASE_URL = cliDatabaseUrl;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[db:seed:tariff-deham-uschi-investor-demo] Missing DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    }),
  ),
});

function d(s) {
  return new Prisma.Decimal(s);
}

async function assertTariffTablesPresent() {
  const rows = await prisma.$queryRaw`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('contract_headers', 'geography_groups', 'normalized_charge_codes', 'providers')
  `;
  const required = ["contract_headers", "geography_groups", "normalized_charge_codes", "providers"];
  const have = new Set(
    Array.isArray(rows) ? rows.map((r) => (typeof r.table_name === "string" ? r.table_name : "")) : [],
  );
  const missing = required.filter((t) => !have.has(t));
  if (missing.length > 0) {
    console.error(
      "[db:seed:tariff-deham-uschi-investor-demo] Missing tariff tables:",
      missing.join(", "),
      "— run prisma migrate deploy.",
    );
    return false;
  }
  return true;
}

async function ensureProviders() {
  const specs = [
    {
      legalName: "Investor Demo — Blue Star Ocean Line",
      tradingName: "Blue Star",
      providerType: "OCEAN_CARRIER",
      countryCode: "DK",
    },
    {
      legalName: "Investor Demo — Red Atlas Ocean Line",
      tradingName: "Red Atlas",
      providerType: "OCEAN_CARRIER",
      countryCode: "CH",
    },
  ];
  const ids = [];
  for (const p of specs) {
    let row = await prisma.tariffProvider.findFirst({
      where: { legalName: p.legalName },
      select: { id: true },
    });
    if (!row) {
      row = await prisma.tariffProvider.create({
        data: {
          legalName: p.legalName,
          tradingName: p.tradingName,
          providerType: p.providerType,
          countryCode: p.countryCode,
        },
        select: { id: true },
      });
      console.log(`[db:seed:tariff-deham-uschi-investor-demo] Created provider ${p.legalName}`);
    }
    ids.push(row.id);
  }
  return { oceanA: ids[0], oceanB: ids[1] };
}

async function scrub(tenantId) {
  const del = await prisma.tariffContractHeader.deleteMany({
    where: { tenantId, contractNumber: { in: CONTRACT_NOS } },
  });
  if (del.count) console.log(`[db:seed:tariff-deham-uschi-investor-demo] Removed ${del.count} prior demo contract(s).`);

  const groups = await prisma.tariffGeographyGroup.findMany({
    where: { code: { startsWith: GEO_PREFIX } },
    select: { id: true },
  });
  if (groups.length) {
    await prisma.tariffGeographyMember.deleteMany({
      where: { geographyGroupId: { in: groups.map((g) => g.id) } },
    });
    await prisma.tariffGeographyGroup.deleteMany({
      where: { id: { in: groups.map((g) => g.id) } },
    });
    console.log(`[db:seed:tariff-deham-uschi-investor-demo] Removed ${groups.length} prior geography group(s).`);
  }
}

function sharedChargeCreates(chargeByCode, gDeham, gUschi) {
  return [
    {
      rawChargeName: "Forwarder — export documentation bundle",
      normalizedChargeCodeId: chargeByCode.DOC_FEE ?? null,
      unitBasis: "PER_CONTAINER",
      equipmentScope: "40HC",
      currency: "USD",
      amount: d("118"),
      isIncluded: false,
      isMandatory: true,
    },
    {
      rawChargeName: "Forwarder — origin VGM & booking coordination",
      normalizedChargeCodeId: chargeByCode.OHC ?? null,
      geographyScopeId: gDeham.id,
      unitBasis: "PER_CONTAINER",
      equipmentScope: "40HC",
      currency: "USD",
      amount: d("95"),
      isIncluded: false,
      isMandatory: true,
    },
    {
      rawChargeName: "BAF (bunker adjustment)",
      normalizedChargeCodeId: chargeByCode.BAF ?? null,
      unitBasis: "PER_CONTAINER",
      equipmentScope: "40HC",
      currency: "USD",
      amount: d("402"),
      isIncluded: false,
      isMandatory: true,
    },
    {
      rawChargeName: "PSS (peak season surcharge — illustrative)",
      normalizedChargeCodeId: chargeByCode.PSS ?? null,
      unitBasis: "PER_CONTAINER",
      equipmentScope: "40HC",
      currency: "USD",
      amount: d("165"),
      isIncluded: false,
      isMandatory: true,
    },
    {
      rawChargeName: "Destination terminal / rail ramp handling (DTHC)",
      normalizedChargeCodeId: chargeByCode.DTHC ?? null,
      geographyScopeId: gUschi.id,
      unitBasis: "PER_CONTAINER",
      equipmentScope: "40HC",
      currency: "USD",
      amount: d("228"),
      isIncluded: false,
      isMandatory: true,
    },
    {
      rawChargeName: "Import customs clearance (US)",
      normalizedChargeCodeId: chargeByCode.CUSTOMS_CLEARANCE ?? null,
      unitBasis: "PER_CONTAINER",
      currency: "USD",
      amount: d("310"),
      isIncluded: false,
      isMandatory: true,
    },
    {
      rawChargeName: "Forwarder — ISF / arrival coordination (illustrative)",
      normalizedChargeCodeId: chargeByCode.AMS ?? null,
      unitBasis: "PER_CONTAINER",
      currency: "USD",
      amount: d("72"),
      isIncluded: false,
      isMandatory: true,
    },
  ];
}

async function main() {
  if (!(await assertTariffTablesPresent())) process.exit(1);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    console.error(`[db:seed:tariff-deham-uschi-investor-demo] Tenant "${DEMO_SLUG}" not found. Run npm run db:seed.`);
    process.exit(1);
  }

  await scrub(tenant.id);

  const chargeRows = await prisma.tariffNormalizedChargeCode.findMany({
    where: {
      code: {
        in: ["PRE_CARRIAGE", "ON_CARRIAGE", "OCEAN_FREIGHT", "BAF", "PSS", "DOC_FEE", "OHC", "DTHC", "CUSTOMS_CLEARANCE", "AMS", "ENS"],
      },
    },
    select: { id: true, code: true },
  });
  const chargeByCode = Object.fromEntries(chargeRows.map((c) => [c.code, c.id]));

  const { oceanA, oceanB } = await ensureProviders();

  const validFrom = new Date("2025-01-01");
  const validTo = new Date("2027-12-31");

  const gDeDoor = await prisma.tariffGeographyGroup.create({
    data: {
      geographyType: "INLAND_POINT",
      name: "Investor demo — DE door (Hamburg catchment)",
      code: `${GEO_PREFIX}DE_DOOR`,
      validFrom,
      validTo,
      members: {
        create: [{ memberCode: "DEHAM", memberName: "Hamburg (CY / door anchor)", memberType: "PORT" }],
      },
    },
  });

  const gDeham = await prisma.tariffGeographyGroup.create({
    data: {
      geographyType: "PORT",
      name: "Investor demo — Hamburg load port",
      code: `${GEO_PREFIX}DEHAM`,
      members: {
        create: [{ memberCode: "DEHAM", memberName: "Hamburg", memberType: "PORT" }],
      },
    },
  });

  const gUschi = await prisma.tariffGeographyGroup.create({
    data: {
      geographyType: "PORT",
      name: "Investor demo — Chicago discharge",
      code: `${GEO_PREFIX}USCHI`,
      members: {
        create: [{ memberCode: "USCHI", memberName: "Chicago, IL", memberType: "PORT" }],
      },
    },
  });

  const gUsDoor = await prisma.tariffGeographyGroup.create({
    data: {
      geographyType: "INLAND_POINT",
      name: "Investor demo — US door (Chicago delivery)",
      code: `${GEO_PREFIX}US_DOOR`,
      validFrom,
      validTo,
      members: {
        create: [
          { memberCode: "USCHI", memberName: "Chicago (drayage anchor)", memberType: "PORT" },
          { memberCode: "USORD", memberName: "Chicagoland inland", memberType: "INLAND_POINT" },
        ],
      },
    },
  });

  const rateStack = (oceanAmountUsd) => ({
    rateLines: {
      create: [
        {
          rateType: "PRE_CARRIAGE",
          equipmentType: "40HC",
          serviceScope: "Door pickup → Hamburg CY",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: d("512"),
          originScopeId: gDeDoor.id,
          destinationScopeId: gDeham.id,
          notes: "Illustrative pre-carriage / drays to Hamburg.",
        },
        {
          rateType: "BASE_RATE",
          equipmentType: "40HC",
          serviceScope: "Main ocean FCL DEHAM–USCHI",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: d(String(oceanAmountUsd)),
          originScopeId: gDeham.id,
          destinationScopeId: gUschi.id,
          notes: "Ocean base — demo only.",
        },
        {
          rateType: "ON_CARRIAGE",
          equipmentType: "40HC",
          serviceScope: "Chicago CY → door",
          unitBasis: "PER_CONTAINER",
          currency: "USD",
          amount: d("468"),
          originScopeId: gUschi.id,
          destinationScopeId: gUsDoor.id,
          notes: "Illustrative on-carriage / dray.",
        },
      ],
    },
    chargeLines: {
      create: sharedChargeCreates(chargeByCode, gDeham, gUschi),
    },
  });

  await prisma.tariffContractHeader.create({
    data: {
      tenantId: tenant.id,
      providerId: oceanA,
      transportMode: "OCEAN",
      contractNumber: CONTRACT_NOS[0],
      title: "Investor demo — Door DEHAM → door USCHI (Option A · Blue Star)",
      tradeScope:
        "Synthetic stack for investor UI: pre-carriage, forwarder surcharges, ocean base, on-carriage. Not live carrier pricing.",
      status: "APPROVED",
      versions: {
        create: {
          versionNo: 1,
          sourceType: "MANUAL",
          sourceReference: "seed-tariff-deham-uschi-investor-demo",
          approvalStatus: "APPROVED",
          status: "APPROVED",
          validFrom,
          validTo,
          comments: "Option A — higher ocean base, moderate PSS in bundled charges.",
          ...rateStack(3250),
        },
      },
    },
  });

  await prisma.tariffContractHeader.create({
    data: {
      tenantId: tenant.id,
      providerId: oceanB,
      transportMode: "OCEAN",
      contractNumber: CONTRACT_NOS[1],
      title: "Investor demo — Door DEHAM → door USCHI (Option B · Red Atlas)",
      tradeScope: "Same lane structure as Option A; different ocean base + BAF/PSS mix in charges.",
      status: "APPROVED",
      versions: {
        create: {
          versionNo: 1,
          sourceType: "MANUAL",
          sourceReference: "seed-tariff-deham-uschi-investor-demo",
          approvalStatus: "APPROVED",
          status: "APPROVED",
          validFrom,
          validTo,
          comments: "Option B — lower ocean base; BAF/PSS tuned so total differs from A.",
          rateLines: {
            create: [
              {
                rateType: "PRE_CARRIAGE",
                equipmentType: "40HC",
                serviceScope: "Door pickup → Hamburg CY",
                unitBasis: "PER_CONTAINER",
                currency: "USD",
                amount: d("512"),
                originScopeId: gDeDoor.id,
                destinationScopeId: gDeham.id,
                notes: "Illustrative pre-carriage / drays to Hamburg.",
              },
              {
                rateType: "BASE_RATE",
                equipmentType: "40HC",
                serviceScope: "Main ocean FCL DEHAM–USCHI",
                unitBasis: "PER_CONTAINER",
                currency: "USD",
                amount: d("2985"),
                originScopeId: gDeham.id,
                destinationScopeId: gUschi.id,
                notes: "Ocean base — demo only.",
              },
              {
                rateType: "ON_CARRIAGE",
                equipmentType: "40HC",
                serviceScope: "Chicago CY → door",
                unitBasis: "PER_CONTAINER",
                currency: "USD",
                amount: d("468"),
                originScopeId: gUschi.id,
                destinationScopeId: gUsDoor.id,
                notes: "Illustrative on-carriage / dray.",
              },
            ],
          },
          chargeLines: {
            create: [
              ...sharedChargeCreates(chargeByCode, gDeham, gUschi).map((row, i) =>
                i === 2
                  ? {
                      ...row,
                      amount: d("438"),
                      rawChargeName: "BAF (bunker adjustment) — Option B curve",
                    }
                  : i === 3
                    ? {
                        ...row,
                        amount: d("198"),
                        rawChargeName: "PSS (peak season surcharge — Option B curve)",
                      }
                    : row,
              ),
            ],
          },
        },
      },
    },
  });

  console.log(
    "[db:seed:tariff-deham-uschi-investor-demo] OK — contracts",
    CONTRACT_NOS.join(", "),
    "· Open /tariffs/rate-lookup",
  );
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
