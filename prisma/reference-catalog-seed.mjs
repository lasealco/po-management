import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const OCEAN_CARRIERS = [
  { scac: "MAEU", name: "Maersk A/S", notes: "Alliance: 2M" },
  { scac: "MSCU", name: "MSC Mediterranean Shipping Company", notes: "Alliance: 2M" },
  { scac: "CMDU", name: "CMA CGM", notes: "Alliance: Ocean Alliance" },
  { scac: "ONEY", name: "Ocean Network Express (ONE)", notes: "Alliance: THE Alliance" },
  { scac: "HLCU", name: "Hapag-Lloyd AG", notes: "Alliance: Gemini / THE (regional)" },
  { scac: "EGLV", name: "Evergreen Line", notes: "Alliance: Ocean Alliance" },
  { scac: "COSU", name: "COSCO Shipping Lines", notes: "Alliance: Ocean Alliance" },
  { scac: "YMLU", name: "Yang Ming Marine Transport Corp.", notes: "Alliance: THE Alliance" },
  { scac: "OOLU", name: "OOCL (Orient Overseas Container Line)", notes: "COSCO group" },
  { scac: "ZIMU", name: "ZIM Integrated Shipping Services", notes: "Independent / slot swaps" },
  { scac: "HDMU", name: "HMM Co., Ltd.", notes: "Alliance: THE Alliance" },
  { scac: "PILU", name: "Pacific International Lines", notes: "Regional / feeder" },
  { scac: "MATS", name: "Matson, Inc.", notes: "US Pacific trades" },
  { scac: "WHLC", name: "Wan Hai Lines", notes: "Intra-Asia / feeder" },
];

/** IATA designator (2 chars typical) + AWB prefix (3 digits). Prefixes from public IATA listings — verify before production billing. */
const AIRLINES = [
  { iataCode: "DL", icaoCode: "DAL", awbPrefix3: "006", name: "Delta Air Lines" },
  { iataCode: "AA", icaoCode: "AAL", awbPrefix3: "001", name: "American Airlines" },
  { iataCode: "UA", icaoCode: "UAL", awbPrefix3: "016", name: "United Airlines" },
  { iataCode: "LH", icaoCode: "DLH", awbPrefix3: "020", name: "Lufthansa" },
  { iataCode: "BA", icaoCode: "BAW", awbPrefix3: "125", name: "British Airways" },
  { iataCode: "AF", icaoCode: "AFR", awbPrefix3: "057", name: "Air France" },
  { iataCode: "KL", icaoCode: "KLM", awbPrefix3: "074", name: "KLM Royal Dutch Airlines" },
  { iataCode: "EK", icaoCode: "UAE", awbPrefix3: "176", name: "Emirates" },
  { iataCode: "QR", icaoCode: "QTR", awbPrefix3: "157", name: "Qatar Airways" },
  { iataCode: "SQ", icaoCode: "SIA", awbPrefix3: "618", name: "Singapore Airlines" },
  { iataCode: "CX", icaoCode: "CPA", awbPrefix3: "160", name: "Cathay Pacific" },
  { iataCode: "NH", icaoCode: "ANA", awbPrefix3: "205", name: "All Nippon Airways" },
  { iataCode: "JL", icaoCode: "JAL", awbPrefix3: "131", name: "Japan Airlines" },
  { iataCode: "FX", icaoCode: "FDX", awbPrefix3: "023", name: "FedEx" },
  { iataCode: "5X", icaoCode: "UPS", awbPrefix3: "406", name: "UPS Airlines" },
];

/**
 * Upserts global reference rows (countries from RestCountries-derived JSON,
 * starter ocean SCACs and airlines). Safe to re-run.
 * @param {import("@prisma/client").PrismaClient} prisma
 */
export async function seedReferenceCatalog(prisma) {
  const countriesPath = resolve(process.cwd(), "prisma/reference-data-countries.json");
  let countriesRaw;
  try {
    countriesRaw = JSON.parse(readFileSync(countriesPath, "utf8"));
  } catch (e) {
    console.warn("[db:seed] reference-data-countries.json missing or invalid, skipping countries:", e);
    countriesRaw = [];
  }
  if (!Array.isArray(countriesRaw)) {
    console.warn("[db:seed] reference-data-countries.json: expected array, skipping.");
  } else {
    let n = 0;
    for (const c of countriesRaw) {
      const a2 = typeof c.a2 === "string" ? c.a2.trim().toUpperCase().slice(0, 2) : "";
      const a3 = typeof c.a3 === "string" ? c.a3.trim().toUpperCase().slice(0, 3) : "";
      const name = typeof c.n === "string" ? c.n.trim() : "";
      if (a2.length !== 2 || a3.length !== 3 || !name) continue;
      await prisma.referenceCountry.upsert({
        where: { isoAlpha2: a2 },
        update: { isoAlpha3: a3, name, isActive: true },
        create: { isoAlpha2: a2, isoAlpha3: a3, name, regionCode: null, isActive: true },
      });
      n += 1;
    }
    console.log(`[db:seed] Reference countries upserted: ${n} row(s).`);
  }

  for (const r of OCEAN_CARRIERS) {
    const scac = r.scac.toUpperCase().slice(0, 4);
    await prisma.referenceOceanCarrier.upsert({
      where: { scac },
      update: { name: r.name, notes: r.notes ?? null, isActive: true },
      create: { scac, name: r.name, notes: r.notes ?? null, isActive: true },
    });
  }
  console.log(`[db:seed] Reference ocean carriers: ${OCEAN_CARRIERS.length} row(s).`);

  for (const a of AIRLINES) {
    const iataCode = a.iataCode.toUpperCase().slice(0, 3);
    const icao = a.icaoCode ? a.icaoCode.toUpperCase().slice(0, 3) : null;
    const prefix = String(a.awbPrefix3).replace(/\D/g, "").padStart(3, "0").slice(-3);
    await prisma.referenceAirline.upsert({
      where: { iataCode },
      update: {
        icaoCode: icao,
        awbPrefix3: prefix,
        name: a.name,
        isActive: true,
      },
      create: {
        iataCode,
        icaoCode: icao,
        awbPrefix3: prefix,
        name: a.name,
        isActive: true,
      },
    });
  }
  console.log(`[db:seed] Reference airlines: ${AIRLINES.length} row(s).`);
}
