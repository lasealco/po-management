import type { PrismaClient } from "@prisma/client";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      continue;
    }
    if (ch !== "\r") cur += ch;
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

export async function importLocationCodesFromWeb(prisma: PrismaClient, tenantId: string) {
  const unLocodeUrl = "https://raw.githubusercontent.com/datasets/un-locode/main/data/code-list.csv";
  const airportUrl = "https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";

  const [unLocodeRes, airportsRes] = await Promise.all([fetch(unLocodeUrl), fetch(airportUrl)]);
  if (!unLocodeRes.ok) throw new Error(`Failed to download UN/LOCODE: ${unLocodeRes.statusText}`);
  if (!airportsRes.ok) throw new Error(`Failed to download airports: ${airportsRes.statusText}`);

  const unLocodeCsv = await unLocodeRes.text();
  const airportsJson = (await airportsRes.json()) as Record<
    string,
    { name?: string; country?: string; iata?: string | null }
  >;

  const csvRows = parseCsv(unLocodeCsv);
  const header = csvRows[0] ?? [];
  const idxLocode = header.findIndex((h) => h.toLowerCase() === "locode");
  const idxName = header.findIndex((h) => h.toLowerCase() === "name");
  const idxCountry = header.findIndex((h) => h.toLowerCase() === "country");
  const idxSubdiv = header.findIndex((h) => h.toLowerCase() === "subdivision");
  const idxFunc = header.findIndex((h) => h.toLowerCase() === "function");

  const seen = new Set<string>();
  let unlocodeCount = 0;
  let portCount = 0;
  let airportCount = 0;

  for (const row of csvRows.slice(1)) {
    const code = (row[idxLocode] ?? "").trim().toUpperCase();
    const name = (row[idxName] ?? "").trim();
    if (!code || code.length < 5 || !name) continue;
    const country = (row[idxCountry] ?? "").trim().toUpperCase().slice(0, 2) || null;
    const subdivision = (row[idxSubdiv] ?? "").trim() || null;
    const fn = (row[idxFunc] ?? "").trim();
    const unKey = `U:${code}`;
    if (!seen.has(unKey)) {
      seen.add(unKey);
      await prisma.locationCode.upsert({
        where: { tenantId_type_code: { tenantId, type: "UN_LOCODE", code } },
        update: { name, countryCode: country, subdivision, source: "unlocode", isActive: true },
        create: { tenantId, type: "UN_LOCODE", code, name, countryCode: country, subdivision, source: "unlocode", isActive: true },
      });
      unlocodeCount += 1;
    }
    if (fn.includes("1")) {
      const pKey = `P:${code}`;
      if (!seen.has(pKey)) {
        seen.add(pKey);
        await prisma.locationCode.upsert({
          where: { tenantId_type_code: { tenantId, type: "PORT", code } },
          update: { name, countryCode: country, subdivision, source: "unlocode-port", isActive: true },
          create: { tenantId, type: "PORT", code, name, countryCode: country, subdivision, source: "unlocode-port", isActive: true },
        });
        portCount += 1;
      }
    }
  }

  for (const a of Object.values(airportsJson)) {
    const code = (a.iata ?? "").trim().toUpperCase();
    const name = (a.name ?? "").trim();
    if (!code || code.length !== 3 || !name) continue;
    const country = (a.country ?? "").trim().toUpperCase().slice(0, 2) || null;
    await prisma.locationCode.upsert({
      where: { tenantId_type_code: { tenantId, type: "AIRPORT", code } },
      update: { name, countryCode: country, source: "mwgg-airports", isActive: true },
      create: { tenantId, type: "AIRPORT", code, name, countryCode: country, source: "mwgg-airports", isActive: true },
    });
    airportCount += 1;
  }

  return { unlocodeCount, portCount, airportCount };
}
