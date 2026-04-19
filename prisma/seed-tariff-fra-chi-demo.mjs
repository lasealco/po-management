/**
 * Demo tariff data: Frankfurt warehouse → Chicago warehouse (40' / 40HC), composite snapshot path.
 *
 * Prerequisites:
 * - DATABASE_URL (optional USE_DOTENV_LOCAL=1 from repo root)
 * - `prisma migrate deploy` applied on this database (tariff tables must exist)
 * - Main `npm run db:seed` at least once (demo-company + normalized charge codes + default provider optional)
 *
 * Idempotent: removes prior rows tagged with contractNumber DEMO-FRA-CHI-* and geography code DEMO_SEED_FRA_CHI_*.
 *
 * After run:
 * - Browse /tariffs/contracts — four "Demo — FRA→CHI …" contracts (approved v1).
 * - /tariffs/geography — four geography groups (warehouse + port scopes).
 * - /pricing-snapshots/new → Composite → paste the printed version IDs (FORWARDER + PRE + OCEAN + ON), incoterm e.g. EXW.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { resolve } from "node:path";
import { Pool } from "pg";

const DEMO_SLUG = "demo-company";
const DEMO_CONTRACT_NUMBERS = ["DEMO-FRA-CHI-FWD", "DEMO-FRA-CHI-PRE", "DEMO-FRA-CHI-OCEAN", "DEMO-FRA-CHI-ON"];
const GEO_CODE_PREFIX = "DEMO_SEED_FRA_CHI_";

const PROVIDER_SPECS = [
  { legalName: "Demo Seed — FRA-CHI Forwarder GmbH", tradingName: "FRA-CHI Forwarder", providerType: "FORWARDER", countryCode: "DE" },
  { legalName: "Demo Seed — FRA-CHI Pre-Carriage Trucking", tradingName: "FRA Pre-Truck", providerType: "TRUCKER", countryCode: "DE" },
  { legalName: "Demo Seed — FRA-CHI Ocean Line (MSC-style demo)", tradingName: "Demo Ocean Line", providerType: "OCEAN_CARRIER", countryCode: "US" },
  { legalName: "Demo Seed — FRA-CHI On-Carriage Trucking", tradingName: "CHI On-Truck", providerType: "TRUCKER", countryCode: "US" },
];

const cliDatabaseUrl = process.env.DATABASE_URL?.trim() || null;
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });
if (cliDatabaseUrl) {
  process.env.DATABASE_URL = cliDatabaseUrl;
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[db:seed:tariff-fra-chi-demo] Missing DATABASE_URL.");
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

/** @returns {Promise<boolean>} */
async function assertTariffTablesPresent() {
  const rows = await prisma.$queryRaw`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN (
        'contract_headers',
        'geography_groups',
        'normalized_charge_codes',
        'providers'
      )
  `;
  const required = ["contract_headers", "geography_groups", "normalized_charge_codes", "providers"];
  const have = new Set(
    Array.isArray(rows) ? rows.map((r) => (typeof r.table_name === "string" ? r.table_name : "")) : [],
  );
  const missing = required.filter((t) => !have.has(t));
  if (missing.length > 0) {
    console.error(
      "[db:seed:tariff-fra-chi-demo] This database is missing tariff tables:\n" +
        `  missing: ${missing.join(", ")}\n` +
        "  Fix: run `node --env-file=.env.local ./node_modules/prisma/build/index.js migrate deploy` on this DATABASE_URL,\n" +
        "  then `USE_DOTENV_LOCAL=1 npm run db:seed`, then retry this script.",
    );
    return false;
  }
  return true;
}

async function ensureProviders() {
  const out = [];
  for (const p of PROVIDER_SPECS) {
    let row = await prisma.tariffProvider.findFirst({
      where: { legalName: p.legalName },
      select: { id: true, legalName: true },
    });
    if (!row) {
      row = await prisma.tariffProvider.create({
        data: {
          legalName: p.legalName,
          tradingName: p.tradingName,
          providerType: p.providerType,
          countryCode: p.countryCode,
        },
        select: { id: true, legalName: true },
      });
      console.log(`[db:seed:tariff-fra-chi-demo] Created provider ${row.legalName}`);
    }
    out.push(row);
  }
  return {
    forwarder: out[0].id,
    preTrucker: out[1].id,
    ocean: out[2].id,
    onTrucker: out[3].id,
  };
}

async function scrubPriorDemo(tenantId) {
  const delHeaders = await prisma.tariffContractHeader.deleteMany({
    where: { tenantId, contractNumber: { in: DEMO_CONTRACT_NUMBERS } },
  });
  if (delHeaders.count) {
    console.log(`[db:seed:tariff-fra-chi-demo] Removed ${delHeaders.count} prior demo contract header(s).`);
  }

  const groups = await prisma.tariffGeographyGroup.findMany({
    where: { code: { startsWith: GEO_CODE_PREFIX } },
    select: { id: true },
  });
  if (groups.length) {
    await prisma.tariffGeographyMember.deleteMany({
      where: { geographyGroupId: { in: groups.map((g) => g.id) } },
    });
    await prisma.tariffGeographyGroup.deleteMany({
      where: { id: { in: groups.map((g) => g.id) } },
    });
    console.log(`[db:seed:tariff-fra-chi-demo] Removed ${groups.length} prior demo geography group(s).`);
  }
}

async function main() {
  if (!(await assertTariffTablesPresent())) {
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: DEMO_SLUG },
    select: { id: true },
  });
  if (!tenant) {
    console.error(`[db:seed:tariff-fra-chi-demo] Tenant "${DEMO_SLUG}" not found. Run npm run db:seed first.`);
    process.exit(1);
  }

  await scrubPriorDemo(tenant.id);

  const chargeRows = await prisma.tariffNormalizedChargeCode.findMany({
    where: {
      code: {
        in: [
          "PRE_CARRIAGE",
          "ON_CARRIAGE",
          "OCEAN_FREIGHT",
          "BAF",
          "PSS",
          "DOC_FEE",
          "OHC",
          "DTHC",
          "CUSTOMS_CLEARANCE",
          "ENS",
          "AMS",
        ],
      },
    },
    select: { id: true, code: true },
  });
  const chargeByCode = Object.fromEntries(chargeRows.map((c) => [c.code, c.id]));

  const providers = await ensureProviders();

  const gFraWh = await prisma.tariffGeographyGroup.create({
    data: {
      geographyType: "INLAND_POINT",
      name: "Demo — Frankfurt warehouse catchment",
      code: `${GEO_CODE_PREFIX}FRA_WH`,
      aliasSource: "seed",
      validFrom: new Date("2025-01-01"),
      validTo: new Date("2027-12-31"),
      members: {
        create: [
          { memberCode: "DEFFM", memberName: "Frankfurt am Main (inland)", memberType: "INLAND_POINT" },
          { memberCode: "DEHAM", memberName: "Hamburg (feeder context)", memberType: "PORT" },
        ],
      },
    },
  });

  const gDeham = await prisma.tariffGeographyGroup.create({
    data: {
      geographyType: "PORT",
      name: "Demo — Hamburg load port",
      code: `${GEO_CODE_PREFIX}DEHAM`,
      members: {
        create: [{ memberCode: "DEHAM", memberName: "Hamburg", memberType: "PORT" }],
      },
    },
  });

  const gUschi = await prisma.tariffGeographyGroup.create({
    data: {
      geographyType: "PORT",
      name: "Demo — Chicago discharge port",
      code: `${GEO_CODE_PREFIX}USCHI`,
      members: {
        create: [{ memberCode: "USCHI", memberName: "Chicago, IL", memberType: "PORT" }],
      },
    },
  });

  const gChiWh = await prisma.tariffGeographyGroup.create({
    data: {
      geographyType: "INLAND_POINT",
      name: "Demo — Chicago warehouse catchment",
      code: `${GEO_CODE_PREFIX}CHI_WH`,
      validFrom: new Date("2025-01-01"),
      validTo: new Date("2027-12-31"),
      members: {
        create: [
          { memberCode: "USCHI", memberName: "Chicago (drayage anchor)", memberType: "PORT" },
          { memberCode: "USORD", memberName: "Greater Chicagoland inland", memberType: "INLAND_POINT" },
        ],
      },
    },
  });

  const validFrom = new Date("2025-01-01");
  const validTo = new Date("2027-12-31");
  const sailingFrom = new Date("2026-04-20");
  const sailingTo = new Date("2026-04-27");

  /** @type {{ header: import("@prisma/client").TariffContractHeader, version: import("@prisma/client").TariffContractVersion, role: string }[]} */
  const seeded = [];

  // Forwarder: charges only (export/import handling, filings — illustrative)
  const hdrFwd = await prisma.tariffContractHeader.create({
    data: {
      tenantId: tenant.id,
      providerId: providers.forwarder,
      transportMode: "LOCAL_SERVICE",
      contractNumber: "DEMO-FRA-CHI-FWD",
      title: "Demo — FRA→CHI forwarder (export/import handling)",
      tradeScope: "Illustrative door-move paperwork bundle. Schedules not integrated.",
      status: "APPROVED",
      versions: {
        create: {
          versionNo: 1,
          sourceType: "MANUAL",
          sourceReference: "seed-tariff-fra-chi-demo",
          approvalStatus: "APPROVED",
          status: "APPROVED",
          validFrom,
          validTo,
          comments: "Seed: customs broker coordination, AMS/ENS-style filings as line items (not live filings).",
          chargeLines: {
            create: [
              {
                rawChargeName: "Export documentation & VGM coordination",
                normalizedChargeCodeId: chargeByCode.DOC_FEE ?? null,
                unitBasis: "PER_SHIPMENT",
                currency: "USD",
                amount: d("95"),
                isIncluded: false,
                isMandatory: true,
              },
              {
                rawChargeName: "Origin customs / security filing (illustrative)",
                normalizedChargeCodeId: chargeByCode.ENS ?? chargeByCode.AMS ?? null,
                unitBasis: "PER_SHIPMENT",
                currency: "USD",
                amount: d("45"),
                isIncluded: false,
                isMandatory: true,
              },
              {
                rawChargeName: "Import customs clearance (Chicago)",
                normalizedChargeCodeId: chargeByCode.CUSTOMS_CLEARANCE ?? null,
                geographyScopeId: gChiWh.id,
                unitBasis: "PER_SHIPMENT",
                currency: "USD",
                amount: d("285"),
                isIncluded: false,
                isMandatory: true,
              },
              {
                rawChargeName: "Destination documentation & ISF coordination (illustrative)",
                normalizedChargeCodeId: chargeByCode.AMS ?? null,
                unitBasis: "PER_SHIPMENT",
                currency: "USD",
                amount: d("65"),
                isIncluded: false,
                isMandatory: true,
              },
            ],
          },
        },
      },
    },
    include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
  });
  seeded.push({ header: hdrFwd, version: hdrFwd.versions[0], role: "FORWARDER_HANDLING" });

  const hdrPre = await prisma.tariffContractHeader.create({
    data: {
      tenantId: tenant.id,
      providerId: providers.preTrucker,
      transportMode: "TRUCK",
      contractNumber: "DEMO-FRA-CHI-PRE",
      title: "Demo — FRA→CHI pre-carriage (warehouse to Hamburg)",
      status: "APPROVED",
      versions: {
        create: {
          versionNo: 1,
          sourceType: "MANUAL",
          approvalStatus: "APPROVED",
          status: "APPROVED",
          validFrom,
          validTo,
          comments: "Seed: FTL pre-carriage for 40HC/40DV scope.",
          rateLines: {
            create: [
              {
                rateType: "PRE_CARRIAGE",
                equipmentType: "40HC",
                unitBasis: "PER_CONTAINER",
                currency: "USD",
                amount: d("725"),
                originScopeId: gFraWh.id,
                destinationScopeId: gDeham.id,
                notes: "Illustrative FRA warehouse cluster → Hamburg CY. Not a live truck quote.",
              },
            ],
          },
          chargeLines: {
            create: [
              {
                rawChargeName: "Fuel surcharge — pre-carriage (illustrative)",
                normalizedChargeCodeId: chargeByCode.BAF ?? null,
                unitBasis: "PER_CONTAINER",
                equipmentScope: "40HC",
                currency: "USD",
                amount: d("85"),
                isIncluded: false,
                isMandatory: true,
              },
            ],
          },
        },
      },
    },
    include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
  });
  seeded.push({ header: hdrPre, version: hdrPre.versions[0], role: "PRE_CARRIAGE" });

  const hdrOcean = await prisma.tariffContractHeader.create({
    data: {
      tenantId: tenant.id,
      providerId: providers.ocean,
      transportMode: "OCEAN",
      contractNumber: "DEMO-FRA-CHI-OCEAN",
      title: "Demo — FRA→CHI ocean (Hamburg → Chicago, 40HC)",
      tradeScope: "Main leg FCL. Carrier name is illustrative; sailing window is fake for UI only.",
      status: "APPROVED",
      versions: {
        create: {
          versionNo: 1,
          sourceType: "MANUAL",
          approvalStatus: "APPROVED",
          status: "APPROVED",
          validFrom,
          validTo,
          bookingDateValidFrom: new Date("2026-04-01"),
          bookingDateValidTo: new Date("2026-06-30"),
          sailingDateValidFrom: sailingFrom,
          sailingDateValidTo: sailingTo,
          comments:
            "Illustrative weekly sailing — not integrated with carrier schedules. Equipment: 40HC.",
          rateLines: {
            create: [
              {
                rateType: "BASE_RATE",
                equipmentType: "40HC",
                unitBasis: "PER_CONTAINER",
                currency: "USD",
                amount: d("2925"),
                originScopeId: gDeham.id,
                destinationScopeId: gUschi.id,
                notes: "Ocean freight base — DEMO only.",
              },
            ],
          },
          chargeLines: {
            create: [
              {
                rawChargeName: "BAF",
                normalizedChargeCodeId: chargeByCode.BAF ?? null,
                unitBasis: "PER_CONTAINER",
                equipmentScope: "40HC",
                currency: "USD",
                amount: d("385"),
                isIncluded: false,
                isMandatory: true,
              },
              {
                rawChargeName: "PSS (peak season — illustrative)",
                normalizedChargeCodeId: chargeByCode.PSS ?? null,
                unitBasis: "PER_CONTAINER",
                equipmentScope: "40HC",
                currency: "USD",
                amount: d("175"),
                isIncluded: false,
                isMandatory: true,
              },
              {
                rawChargeName: "Origin terminal handling (OTHC)",
                normalizedChargeCodeId: chargeByCode.OHC ?? null,
                geographyScopeId: gDeham.id,
                unitBasis: "PER_CONTAINER",
                equipmentScope: "40HC",
                currency: "USD",
                amount: d("128"),
                isIncluded: false,
                isMandatory: true,
              },
              {
                rawChargeName: "Destination terminal handling (DTHC)",
                normalizedChargeCodeId: chargeByCode.DTHC ?? null,
                geographyScopeId: gUschi.id,
                unitBasis: "PER_CONTAINER",
                equipmentScope: "40HC",
                currency: "USD",
                amount: d("198"),
                isIncluded: false,
                isMandatory: true,
              },
              {
                rawChargeName: "Documentation fee",
                normalizedChargeCodeId: chargeByCode.DOC_FEE ?? null,
                unitBasis: "PER_CONTAINER",
                currency: "USD",
                amount: d("55"),
                isIncluded: false,
                isMandatory: true,
              },
            ],
          },
        },
      },
    },
    include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
  });
  seeded.push({ header: hdrOcean, version: hdrOcean.versions[0], role: "MAIN_OCEAN" });

  const hdrOn = await prisma.tariffContractHeader.create({
    data: {
      tenantId: tenant.id,
      providerId: providers.onTrucker,
      transportMode: "TRUCK",
      contractNumber: "DEMO-FRA-CHI-ON",
      title: "Demo — FRA→CHI on-carriage (Chicago port to warehouse)",
      status: "APPROVED",
      versions: {
        create: {
          versionNo: 1,
          sourceType: "MANUAL",
          approvalStatus: "APPROVED",
          status: "APPROVED",
          validFrom,
          validTo,
          rateLines: {
            create: [
              {
                rateType: "ON_CARRIAGE",
                equipmentType: "40HC",
                unitBasis: "PER_CONTAINER",
                currency: "USD",
                amount: d("695"),
                originScopeId: gUschi.id,
                destinationScopeId: gChiWh.id,
                notes: "Illustrative dray + delivery to Chicagoland warehouse.",
              },
            ],
          },
          chargeLines: {
            create: [
              {
                rawChargeName: "Chassis rental / flip (illustrative)",
                unitBasis: "PER_CONTAINER",
                equipmentScope: "40HC",
                currency: "USD",
                amount: d("110"),
                isIncluded: false,
                isMandatory: true,
              },
            ],
          },
        },
      },
    },
    include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } },
  });
  seeded.push({ header: hdrOn, version: hdrOn.versions[0], role: "ON_CARRIAGE" });

  const fwd = seeded.find((s) => s.role === "FORWARDER_HANDLING");
  const pre = seeded.find((s) => s.role === "PRE_CARRIAGE");
  const ocean = seeded.find((s) => s.role === "MAIN_OCEAN");
  const on = seeded.find((s) => s.role === "ON_CARRIAGE");

  console.log("");
  console.log("[db:seed:tariff-fra-chi-demo] Done. Geography (browse /tariffs/geography):");
  console.log(`  ${gFraWh.name}  code=${gFraWh.code}`);
  console.log(`  ${gDeham.name}  code=${gDeham.code}`);
  console.log(`  ${gUschi.name}  code=${gUschi.code}`);
  console.log(`  ${gChiWh.name}  code=${gChiWh.code}`);
  console.log("");
  console.log("[db:seed:tariff-fra-chi-demo] Contracts (browse /tariffs/contracts):");
  for (const s of seeded) {
    console.log(`  ${s.header.contractNumber} → /tariffs/contracts/${s.header.id}/versions/${s.version.id}`);
  }
  console.log("");
  console.log("[db:seed:tariff-fra-chi-demo] Composite snapshot — open /pricing-snapshots/new → Composite tab:");
  console.log("  Order roles (top to bottom):");
  console.log(`    FORWARDER_HANDLING  ${fwd.version.id}`);
  console.log(`    PRE_CARRIAGE        ${pre.version.id}`);
  console.log(`    MAIN_OCEAN          ${ocean.version.id}`);
  console.log(`    ON_CARRIAGE         ${on.version.id}`);
  console.log("  Suggested incoterm: EXW (optional). Then “Freeze composite snapshot”.");
  console.log("");
}

main()
  .catch((e) => {
    console.error("[db:seed:tariff-fra-chi-demo] Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
