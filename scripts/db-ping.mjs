/**
 * Quick TCP/SSL check to Postgres using the same env vars as migrate.
 * Run: npm run db:ping
 *
 * Loads .env.local with file values winning over the shell (avoids stale
 * DATABASE_URL from an old export). Validates hostname before connect.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = path.join(root, ".env.local");
if (!fs.existsSync(envLocal)) {
  console.error("db-ping: missing .env.local in project root");
  process.exit(1);
}

const raw = fs.readFileSync(envLocal, "utf8").replace(/^\uFEFF/, "");
const parsed = dotenv.parse(raw);
for (const [k, v] of Object.entries(parsed)) {
  if (v !== undefined) {
    process.env[k] = v;
  }
}

let connectionString =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "db-ping: set DATABASE_URL or DATABASE_URL_UNPOOLED in .env.local",
  );
  process.exit(1);
}

connectionString = connectionString
  .trim()
  .replace(/[\u200B-\u200D\uFEFF]/g, "");

/** @param {string} urlStr */
function hostnameFromPostgresUrl(urlStr) {
  try {
    const normalized = urlStr.replace(/^postgres(ql)?:/i, "http:");
    return new URL(normalized).hostname;
  } catch {
    return "";
  }
}

const hostname = hostnameFromPostgresUrl(connectionString);
const ellipsis = "\u2026";
if (
  !hostname ||
  hostname.includes("...") ||
  hostname.includes(ellipsis) ||
  hostname.includes("%E2%80%A6")
) {
  console.error("db-ping: hostname is missing or still a placeholder.");
  console.error(
    "  Copy the full connection string from Neon (host looks like ep-xxxx.region.aws.neon.tech).",
  );
  console.error("  Parsed hostname (repr):", JSON.stringify(hostname));
  process.exit(1);
}

if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
  console.error(
    "db-ping: hostname has unexpected characters (often smart quotes or hidden Unicode).",
  );
  console.error("  Parsed hostname (repr):", JSON.stringify(hostname));
  console.error(
    "  Codepoints:",
    [...hostname].map((c) => c.codePointAt(0).toString(16)).join(" "),
  );
  process.exit(1);
}

const masked = connectionString.replace(
  /:\/\/([^:]+):([^@]+)@/,
  "://$1:***@",
);
console.log("db-ping: hostname:", hostname);
console.log("db-ping: connecting with", masked);

const client = new pg.Client({
  connectionString,
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const { rows } = await client.query(
    "select current_database() as db, current_user as role",
  );
  console.log("db-ping: OK — connected.");
  console.log("  database:", rows[0].db);
  console.log("  role:", rows[0].role);
} catch (err) {
  console.error("db-ping: FAILED", err.code || "", err.message);
  if (err.code === "ENOTFOUND") {
    console.error("  Hint: DNS could not resolve the hostname.");
  }
  if (err.code === "EINVAL" && /getaddrinfo/i.test(String(err.message))) {
    console.error(
      "  Hint: invalid hostname for DNS (placeholder …, smart quotes, or a bad URL). Re-copy from Neon; ensure .env.local uses straight ASCII quotes.",
    );
    console.error(
      "  If you ever exported DATABASE_URL in this terminal, run: unset DATABASE_URL DATABASE_URL_UNPOOLED DIRECT_URL",
    );
  }
  if (err.code === "ETIMEDOUT" || err.code === "ECONNREFUSED") {
    console.error(
      "  Hint: port 5432 blocked, Neon compute asleep, or IP allowlist.",
    );
  }
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
