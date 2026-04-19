import { prisma } from "@/lib/prisma";

import { InvoiceAuditError } from "@/lib/invoice-audit/invoice-audit-error";

/**
 * Deploy checklist: these Prisma migration folders must be applied to the target database
 * before invoice audit APIs and pages can run (order matters if replaying manually).
 */
export const INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT =
  "prisma/migrations: 20260419100000_invoice_audit_foundation → 20260420120000_invoice_audit_ocean_matching → 20260421103000_invoice_intake_accounting_handoff";

/** Folder names as recorded in `_prisma_migrations.migration_name` after successful `migrate deploy`. */
export const REQUIRED_INVOICE_AUDIT_PRISMA_MIGRATION_NAMES = [
  "20260419100000_invoice_audit_foundation",
  "20260420120000_invoice_audit_ocean_matching",
  "20260421103000_invoice_intake_accounting_handoff",
] as const;

const REQUIRED_TABLES = [
  "invoice_intakes",
  "invoice_lines",
  "audit_results",
  "tolerance_rules",
  "invoice_charge_aliases",
] as const;

const REQUIRED_INTAKE_COLUMNS = [
  "polCode",
  "podCode",
  "approvedForAccounting",
  "accountingApprovedAt",
  "accountingApprovedByUserId",
  "accountingApprovalNote",
] as const;

const REQUIRED_LINE_COLUMNS = ["equipmentType", "chargeStructureHint"] as const;

export type InvoiceAuditSchemaCheck = {
  ok: boolean;
  issues: string[];
  /** Prisma migration rows found (finished). Empty if table unreadable. */
  appliedPrismaMigrations?: string[];
  /** Subset of REQUIRED_INVOICE_AUDIT_PRISMA_MIGRATION_NAMES not present in `_prisma_migrations`. */
  missingPrismaMigrations?: string[];
  /**
   * When `_prisma_migrations` cannot be queried (non-Prisma workflow, permissions, etc.).
   * Schema table/column checks may still be authoritative.
   */
  migrationHistoryNote?: string | null;
};

let cache: { checkedAtMs: number; result: InvoiceAuditSchemaCheck } | null = null;
const CACHE_TTL_OK_MS = 60_000;
const CACHE_TTL_FAIL_MS = 15_000;

export type CheckInvoiceAuditDatabaseSchemaOptions = {
  /** Skip in-memory cache (e.g. `?refresh=1` after running `migrate deploy`). */
  bypassCache?: boolean;
};

/**
 * Verifies public tables/columns the invoice-audit stack expects (Postgres).
 * Safe to call from API routes and server layouts; uses a short in-memory cache.
 */
export async function checkInvoiceAuditDatabaseSchema(
  options?: CheckInvoiceAuditDatabaseSchemaOptions,
): Promise<InvoiceAuditSchemaCheck> {
  const now = Date.now();
  if (options?.bypassCache) {
    cache = null;
  } else if (cache) {
    const ttl = cache.result.ok ? CACHE_TTL_OK_MS : CACHE_TTL_FAIL_MS;
    if (now - cache.checkedAtMs < ttl) return cache.result;
  }

  const issues: string[] = [];
  let migrationHistoryNote: string | null = null;
  let appliedPrismaMigrations: string[] | undefined;
  let missingPrismaMigrations: string[] | undefined;

  try {
    const tableRows = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name IN (
          'invoice_intakes',
          'invoice_lines',
          'audit_results',
          'tolerance_rules',
          'invoice_charge_aliases'
        )
    `;
    const tableCount = Number(tableRows[0]?.c ?? 0);
    if (tableCount !== REQUIRED_TABLES.length) {
      issues.push(
        `Expected ${REQUIRED_TABLES.length} invoice-audit tables in public schema, found ${tableCount}. ` +
          `Run \`npm run db:migrate\` (or \`prisma migrate deploy\`) on this database.`,
      );
    }

    const intakeColRows = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoice_intakes'
        AND column_name IN (
          'polCode',
          'podCode',
          'approvedForAccounting',
          'accountingApprovedAt',
          'accountingApprovedByUserId',
          'accountingApprovalNote'
        )
    `;
    const intakeColCount = Number(intakeColRows[0]?.c ?? 0);
    if (intakeColCount !== REQUIRED_INTAKE_COLUMNS.length) {
      issues.push(
        `invoice_intakes is missing ocean or accounting-handoff columns (found ${intakeColCount} of ${REQUIRED_INTAKE_COLUMNS.length}). ` +
          `Apply ${INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT}.`,
      );
    }

    const lineColRows = await prisma.$queryRaw<{ c: bigint }[]>`
      SELECT COUNT(*)::bigint AS c
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoice_lines'
        AND column_name IN ('equipmentType', 'chargeStructureHint')
    `;
    const lineColCount = Number(lineColRows[0]?.c ?? 0);
    if (lineColCount !== REQUIRED_LINE_COLUMNS.length) {
      issues.push(
        `invoice_lines is missing equipment/structure columns (found ${lineColCount} of ${REQUIRED_LINE_COLUMNS.length}). ` +
          `Apply migration 20260420120000_invoice_audit_ocean_matching.`,
      );
    }

    try {
      const migrationRows = await prisma.$queryRaw<{ migration_name: string }[]>`
        SELECT migration_name::text AS migration_name
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL
          AND migration_name IN (
            '20260419100000_invoice_audit_foundation',
            '20260420120000_invoice_audit_ocean_matching',
            '20260421103000_invoice_intake_accounting_handoff'
          )
      `;
      const applied = migrationRows.map((r) => r.migration_name);
      appliedPrismaMigrations = applied;
      const missing = [...REQUIRED_INVOICE_AUDIT_PRISMA_MIGRATION_NAMES].filter((n) => !applied.includes(n));
      if (missing.length > 0) {
        missingPrismaMigrations = missing;
        issues.push(
          `Prisma migration history is incomplete for invoice audit (missing: ${missing.join(", ")}). ` +
            `Run \`npm run db:migrate\` / \`prisma migrate deploy\` on this database, then reload.`,
        );
      }
    } catch (me) {
      const m = me instanceof Error ? me.message : String(me);
      migrationHistoryNote =
        `Could not read _prisma_migrations (${m}). Table/column checks above still apply; ` +
        `if you use a non-Prisma migration path, confirm the three invoice-audit migrations were applied manually.`;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    issues.push(
      `Could not verify invoice-audit schema against information_schema (${msg}). ` +
        `Confirm DATABASE_URL points at Postgres and migrations have been applied.`,
    );
  }

  const result: InvoiceAuditSchemaCheck = {
    ok: issues.length === 0,
    issues,
    appliedPrismaMigrations,
    missingPrismaMigrations,
    migrationHistoryNote,
  };
  cache = { checkedAtMs: now, result };
  return result;
}

export async function ensureInvoiceAuditSchemaReady(): Promise<void> {
  const { ok, issues } = await checkInvoiceAuditDatabaseSchema();
  if (ok) return;
  const detail = issues.join(" ");
  throw new InvoiceAuditError(
    "SCHEMA_NOT_READY",
    `${detail} Expected sequence: ${INVOICE_AUDIT_MIGRATION_SEQUENCE_HINT}.`,
  );
}

export function clearInvoiceAuditSchemaCheckCacheForTests(): void {
  cache = null;
}
