/**
 * MP1: Heuristic parsing for "assistant → sales order draft" (no LLM required).
 * Intent is to support scenarios like: customer ABC, product corr-roll, qty, unit price, pickup date.
 */

export type AccountCandidate = { id: string; name: string; legalName: string | null };
export type ProductCandidate = { id: string; name: string; productCode: string | null };
export type WarehousePick = { id: string; name: string; code: string | null };
export type OrgUnitPick = { id: string; name: string; code: string };

export type SalesOrderIntentContext = {
  accounts: AccountCandidate[];
  products: ProductCandidate[];
  warehouses: WarehousePick[];
  orgUnits: OrgUnitPick[];
};

export type ExtractedSnapshot = {
  contactName: string | null;
  customerTokens: string[];
  productTokens: string[];
  quantity: number | null;
  unitPrice: number | null;
  currency: string;
  /** ISO date yyyy-mm-dd */
  requestedDate: string | null;
  warehouseMention: string | null;
  raw: string;
};

type Resolve = {
  accountId: string | null;
  productId: string | null;
};

/** Filters tokens so "John" does not try to match a customer by first name. */
const PERSON_GIVEN_NAMES = new Set([
  "john",
  "jane",
  "mary",
  "james",
  "david",
  "sarah",
  "michael",
  "lisa",
  "robert",
  "linda",
]);

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "to",
  "at",
  "in",
  "on",
  "our",
  "he",
  "she",
  "will",
  "wants",
  "want",
  "from",
  "with",
  "next",
  "week",
  "called",
  "customer",
  "truck",
  "pickup",
  "send",
  "sending",
  "just",
  "order",
  "orders",
  "piece",
  "pieces",
  "usd",
  "dollar",
  "dollars",
  "per",
  "is",
  "it",
  "up",
  "us",
  "we",
  "i",
  "ve",
  "ll",
  "be",
  "this",
  "that",
  "here",
  "about",
  "some",
  "all",
  "good",
  "not",
  "any",
  "new",
  "york",
  "dover",
  "delaware", // we still match account names; tokens help company names
  "roll",
  "rolls",
  "warehouse",
  "warehouses",
  "pick",
]);

function tokenizeCompanyHints(text: string): string[] {
  const t = text.toLowerCase();
  // "from abc customer" / "from ABC" / "abc customer"
  const out = new Set<string>();
  const m1 = t.match(/from\s+([a-z0-9][a-z0-9\s\-]{0,40}?)(?:\s+customer|\s+who|\s+and|\s*[,.\n]|$)/i);
  if (m1) {
    const s = m1[1].trim();
    for (const p of s.split(/[\s,]+/)) {
      if (p.length > 1 && !STOP.has(p)) out.add(p);
    }
  }
  for (const w of t.split(/[^a-z0-9]+/i)) {
    if (w.length >= 2 && !STOP.has(w) && !PERSON_GIVEN_NAMES.has(w)) out.add(w);
  }
  // Prefer short tokens that look like company codes (e.g. abc)
  return Array.from(out);
}

function extractQuantityAndPrice(text: string): { quantity: number | null; unitPrice: number | null; currency: string } {
  let quantity: number | null = null;
  let unitPrice: number | null = null;
  const t = text.replace(/\s+/g, " ");

  const priceMatch = t.match(
    /(?:for|at|@)\s*(?:about\s+)?(?:USD\s*)?\$?\s*(\d+(?:\.\d+)?)(?:\s*USD)?(?:\s*(?:a|per)\s*piece)?/i,
  );
  if (priceMatch) {
    unitPrice = Number(priceMatch[1]);
  }
  const priceAlt = t.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:USD|dollars?|a\s*piece|per\s*piece)/i);
  if (unitPrice == null && priceAlt) {
    unitPrice = Number(priceAlt[1]);
  }

  // "100 corr" / "wants 100" / "100 x" — take first 1-6 digit count that is not a year
  const qMatch = t.match(
    /(?:^|\s)(?!(?:20)\d{2}\b)([1-9]\d{0,5})(?=\s*(?:x|×|pcs?|ea|units?|corr|roll|of|\s+for))/i,
  );
  if (qMatch) {
    quantity = Number(qMatch[1]);
  } else {
    const q2 = t.match(/(?:^|\s)(?!(?:20)\d{2}\b)([1-9]\d{0,5})(?:\s+)(?:[a-z]{3,})/i);
    if (q2) quantity = Number(q2[1]);
  }

  if (Number.isNaN(quantity!)) quantity = null;
  if (Number.isNaN(unitPrice!)) unitPrice = null;

  return { quantity, unitPrice, currency: "USD" };
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Picks a requested delivery / pickup date from phrases like "next week Tuesday".
 */
export function extractRequestedDate(text: string, now = new Date()): string | null {
  const t = text.toLowerCase();
  let targetDow: number | null = null;
  for (const [name, d] of Object.entries(WEEKDAYS)) {
    if (t.includes(name)) {
      targetDow = d;
      break;
    }
  }
  if (targetDow == null) return null;

  const d = new Date(now);
  const cur = d.getDay();
  let add = (targetDow - cur + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  if (t.includes("next week")) {
    d.setDate(d.getDate() + 7);
  }
  return d.toISOString().slice(0, 10);
}

function extractProductHints(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  const corr = t.match(/corr[-\s]?roll/g);
  if (corr) out.push("corr-roll");
  const m = t.match(
    /(\d+)\s*[-x×]?\s*([a-z0-9][a-z0-9\-\s]{1,32}?)(?=\s+(?:for|at|@|usd|\$|per|next|he|will|a\s+truck|pickup|our))/i,
  );
  if (m) {
    const name = m[2].replace(/\s+/g, " ").trim();
    if (name.length > 2) out.push(name);
  }
  for (const w of t.split(/[^a-z0-9]+/)) {
    if (w.length > 2 && w.includes("corr")) out.push(w);
  }
  return Array.from(new Set(out));
}

function extractContactName(text: string): string | null {
  const m = text.match(/([A-Z][a-z]+)\s+from/i);
  if (m) return m[1];
  const m2 = text.match(/from\s+([A-Z][a-z]+)(?:\s+customer)?/i);
  if (m2 && m2[1].length < 2) return null;
  return m2 ? m2[1] : null;
}

function extractWarehouseMention(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("demo warehouse") || t.includes("at our demo") || t.includes("our demo warehouse")) return "demo";
  if (t.includes("warehouse")) {
    const m = t.match(/(?:at|@)\s+(?:our\s+)?([a-z0-9][a-z0-9\s\-]{2,32}?)(?:\s+warehouse|\.|$)/i);
    if (m) return m[1].trim();
  }
  return null;
}

function filterAccounts(accounts: AccountCandidate[], customerTokens: string[]): AccountCandidate[] {
  if (customerTokens.length === 0) return [];
  const tset = new Set(customerTokens.map((s) => s.toLowerCase()));
  return accounts.filter((a) => {
    const blob = `${a.name} ${a.legalName ?? ""}`.toLowerCase();
    for (const tok of tset) {
      if (tok.length < 2) continue;
      if (blob.includes(tok)) return true;
    }
    return false;
  });
}

function filterProducts(products: ProductCandidate[], hints: string[]): ProductCandidate[] {
  if (hints.length === 0) return [];
  const res: ProductCandidate[] = [];
  for (const p of products) {
    const blob = `${p.name} ${p.productCode ?? ""}`.toLowerCase();
    for (const h of hints) {
      const n = h.toLowerCase().replace(/-/g, " ");
      if (n.length < 2) continue;
      if (blob.includes(n) || n.split(/\s+/).every((w) => w && blob.includes(w))) {
        res.push(p);
        break;
      }
      if (h.includes("corr") && (blob.includes("corr") || blob.includes("roll"))) {
        res.push(p);
        break;
      }
    }
  }
  return Array.from(new Map(res.map((p) => [p.id, p])).values());
}

function pickServedOrgId(orgUnits: OrgUnitPick[], warehouseMention: string | null, warehouses: WarehousePick[]): string | null {
  if (warehouseMention) {
    const w = warehouses.find(
      (x) => x.name.toLowerCase().includes("demo") || (x.code ?? "").toLowerCase().includes("demo"),
    );
    if (w) {
      const om = w.name.toLowerCase();
      const org = orgUnits.find((o) => om.includes(o.name.toLowerCase().slice(0, 4)) || o.name.toLowerCase().includes("demo"));
      if (org) return org.id;
    }
  }
  const demoOrg = orgUnits.find((o) => o.name.toLowerCase().includes("demo") || o.code.toLowerCase().includes("demo"));
  return demoOrg?.id ?? null;
}

function buildExternalRef(
  contact: string | null,
  acc: AccountCandidate,
  ex: { quantity: number | null; unitPrice: number | null },
  lineSummary: string,
): string {
  const parts = [
    "Assistant",
    contact ? `Contact: ${contact}` : null,
    `Customer: ${acc.name}`,
    ex.quantity != null ? `Qty: ${ex.quantity}` : null,
    ex.unitPrice != null ? `Unit: ${ex.unitPrice} USD` : null,
    `Product line: ${lineSummary}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

function buildNotes(
  ex: ExtractedSnapshot,
  productLabel: string,
  whName: string | null,
  servedName: string | null,
): string {
  const lines = [
    "Created from Sales Assistant (MP1).",
    `Request: ${ex.raw.slice(0, 500)}${ex.raw.length > 500 ? "…" : ""}`,
    productLabel ? `Product: ${productLabel}.` : null,
    whName ? `Warehouse / pickup: ${whName}.` : null,
    servedName ? `Served org: ${servedName}.` : null,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

export type SalesOrderIntentResult =
  | {
      kind: "clarify_account";
      message: string;
      options: AccountCandidate[];
      snapshot: ExtractedSnapshot;
    }
  | {
      kind: "clarify_product";
      message: string;
      options: ProductCandidate[];
      snapshot: ExtractedSnapshot;
    }
  | {
      kind: "not_found_account";
      message: string;
      snapshot: ExtractedSnapshot;
    }
  | {
      kind: "not_found_product";
      message: string;
      snapshot: ExtractedSnapshot;
    }
  | {
      kind: "ready";
      message: string;
      createPayload: {
        customerCrmAccountId: string;
        /** ISO date or null */
        requestedDeliveryDate: string | null;
        externalRef: string;
        /** Server accepts optional notes (MP1) */
        notes: string;
        /** Optional; may be null if org cannot be resolved */
        servedOrgUnitId: string | null;
      };
      summary: {
        accountName: string;
        productName: string;
        productId: string;
        quantity: number | null;
        unitPrice: number | null;
        /** yyyy-mm-dd */
        requestedDate: string | null;
        warehouseLabel: string | null;
        servedOrgLabel: string | null;
        contactName: string | null;
      };
      snapshot: ExtractedSnapshot;
    };

export function parseSalesOrderIntent(
  text: string,
  ctx: SalesOrderIntentContext,
  resolve: Resolve = { accountId: null, productId: null },
): SalesOrderIntentResult {
  const raw = text.trim();
  const contactName = extractContactName(raw);
  const customerTokens = tokenizeCompanyHints(raw);
  const { quantity, unitPrice, currency } = extractQuantityAndPrice(raw);
  const requestedDate = extractRequestedDate(raw) ?? null;
  const productHints = extractProductHints(raw);
  const warehouseMention = extractWarehouseMention(raw);

  const snapshot: ExtractedSnapshot = {
    contactName,
    customerTokens,
    productTokens: productHints,
    quantity,
    unitPrice,
    currency,
    requestedDate,
    warehouseMention,
    raw,
  };

  let accCandidates: AccountCandidate[] = [];
  if (resolve.accountId) {
    const a = ctx.accounts.find((x) => x.id === resolve.accountId);
    if (a) accCandidates = [a];
  } else {
    accCandidates = filterAccounts(ctx.accounts, customerTokens);
  }

  if (accCandidates.length === 0) {
    if (ctx.accounts.length === 0) {
      return {
        kind: "not_found_account",
        message: "No CRM customers are set up in this tenant. Add an account in CRM, then try again.",
        snapshot,
      };
    }
    return {
      kind: "not_found_account",
      message:
        "Could not match a customer from your message. Try including a distinctive company name (e.g. the account name in CRM).",
      snapshot,
    };
  }

  if (accCandidates.length > 1 && !resolve.accountId) {
    return {
      kind: "clarify_account",
      message: "Multiple customers match. Which one do you mean?",
      options: accCandidates,
      snapshot,
    };
  }

  const account = accCandidates[0]!;

  let prodCandidates: ProductCandidate[] = [];
  if (resolve.productId) {
    const p = ctx.products.find((x) => x.id === resolve.productId);
    if (p) prodCandidates = [p];
  } else {
    prodCandidates = filterProducts(ctx.products, productHints);
  }

  if (prodCandidates.length === 0) {
    if (ctx.products.length === 0) {
      return {
        kind: "not_found_product",
        message: "No products are set up. Add products under PO / products, then try again.",
        snapshot,
      };
    }
    return {
      kind: "not_found_product",
      message:
        "Could not match a product. Try a clearer product name or product code (e.g. the corr‑roll product code in your catalog).",
      snapshot,
    };
  }

  if (prodCandidates.length > 1 && !resolve.productId) {
    return {
      kind: "clarify_product",
      message: "Multiple products match. Which SKU / product is this for?",
      options: prodCandidates,
      snapshot,
    };
  }

  const product = prodCandidates[0]!;

  const wh = ctx.warehouses.find(
    (w) => warehouseMention && (w.name.toLowerCase().includes("demo") || (w.code ?? "").toLowerCase().includes("demo")),
  );
  const servedId = pickServedOrgId(ctx.orgUnits, warehouseMention, ctx.warehouses);
  const served = servedId ? ctx.orgUnits.find((o) => o.id === servedId) ?? null : null;

  const lineSummary = `${product.productCode || product.name} x${quantity ?? "?" } @ ${unitPrice != null ? `${unitPrice} ${currency}` : "?"}`;

  return {
    kind: "ready",
    message: "Ready to create a **DRAFT** sales order. Review the summary, then open it to add or edit lines if needed.",
    createPayload: {
      customerCrmAccountId: account.id,
      requestedDeliveryDate: requestedDate,
      externalRef: buildExternalRef(contactName, account, { quantity, unitPrice }, lineSummary).slice(0, 2_000),
      notes: buildNotes(snapshot, product.name, wh?.name ?? null, served?.name ?? null).slice(0, 12_000),
      servedOrgUnitId: servedId,
    },
    summary: {
      accountName: account.name,
      productName: product.name,
      productId: product.id,
      quantity,
      unitPrice,
      requestedDate,
      warehouseLabel: wh?.name ?? (warehouseMention ? "Demo / pickup (see notes)" : null),
      servedOrgLabel: served?.name ?? null,
      contactName,
    },
    snapshot,
  };
}
