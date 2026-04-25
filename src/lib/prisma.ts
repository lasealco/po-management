import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function normalizeDatabaseUrlSslMode(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
    // pg-connection-string v2 treats these as verify-full and warns; be explicit.
    if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
  } catch {
    return raw;
  }
  return raw;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(
      new Pool({
        connectionString: normalizeDatabaseUrlSslMode(process.env.DATABASE_URL),
      }),
    ),
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
