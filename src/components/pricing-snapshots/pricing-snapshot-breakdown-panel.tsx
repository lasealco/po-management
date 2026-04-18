import Link from "next/link";
import type { PricingSnapshotSourceType } from "@prisma/client";

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function fmtMoney(amount: string | number | null | undefined, currency: string) {
  if (amount === null || amount === undefined) return "—";
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function PricingSnapshotBreakdownPanel(props: {
  sourceType: PricingSnapshotSourceType;
  sourceRecordId: string;
  currency: string;
  totalEstimatedCost: string;
  totalDerivation: string;
  breakdownJson: unknown;
  freeTimeBasisJson: unknown;
  commercialJson: unknown | null;
  basisSide: string | null;
}) {
  const bd = props.breakdownJson;
  const ft = props.freeTimeBasisJson;

  const contractId = isRecord(bd) && typeof bd.contract === "object" && bd.contract && isRecord(bd.contract as object)
    ? String((bd.contract as Record<string, unknown>).id ?? "")
    : "";
  const versionId = isRecord(bd) && typeof bd.version === "object" && bd.version && isRecord(bd.version as object)
    ? String((bd.version as Record<string, unknown>).id ?? "")
    : "";
  const quoteRequestId =
    isRecord(bd) && typeof bd.quoteRequest === "object" && bd.quoteRequest && isRecord(bd.quoteRequest as object)
      ? String((bd.quoteRequest as Record<string, unknown>).id ?? "")
      : "";

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Totals</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Estimated total</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
              {fmtMoney(props.totalEstimatedCost, props.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Derivation</dt>
            <dd className="mt-1 font-mono text-xs text-zinc-700">{props.totalDerivation}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Source</dt>
            <dd className="mt-1 text-zinc-800">
              {props.sourceType === "TARIFF_CONTRACT_VERSION" ? "Tariff contract version" : "RFQ quote response"}{" "}
              <span className="font-mono text-xs text-zinc-500">({props.sourceRecordId})</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Source links</dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {props.sourceType === "TARIFF_CONTRACT_VERSION" && contractId && versionId ? (
                <Link
                  href={`/tariffs/contracts/${contractId}/versions/${versionId}`}
                  className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  Open contract version
                </Link>
              ) : null}
              {props.sourceType === "QUOTE_RESPONSE" && quoteRequestId ? (
                <Link
                  href={`/rfq/requests/${quoteRequestId}/responses/${props.sourceRecordId}/edit`}
                  className="text-sm font-medium text-[var(--arscmp-primary)] hover:underline"
                >
                  Open RFQ response
                </Link>
              ) : null}
              {props.sourceType === "QUOTE_RESPONSE" && quoteRequestId ? (
                <Link
                  href={`/rfq/requests/${quoteRequestId}`}
                  className="text-sm text-zinc-600 hover:text-[var(--arscmp-primary)] hover:underline"
                >
                  RFQ request
                </Link>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      {props.sourceType === "TARIFF_CONTRACT_VERSION" && isRecord(bd) && Array.isArray(bd.rateLines) ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Rate lines (frozen)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Equipment</th>
                  <th className="py-2 pr-3">Basis</th>
                  <th className="py-2 pr-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(bd.rateLines as unknown[]).map((row, idx) =>
                  isRecord(row) ? (
                    <tr key={typeof row.id === "string" ? row.id : idx} className="border-b border-zinc-100">
                      <td className="py-2 pr-3">{String(row.rateType ?? "")}</td>
                      <td className="py-2 pr-3">{String(row.equipmentType ?? "")}</td>
                      <td className="py-2 pr-3">{String(row.unitBasis ?? "")}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {fmtMoney(row.amount != null ? String(row.amount) : null, String(row.currency ?? props.currency))}
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {props.sourceType === "TARIFF_CONTRACT_VERSION" && isRecord(bd) && Array.isArray(bd.chargeLines) ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Charge lines (frozen)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Charge</th>
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3">Basis</th>
                  <th className="py-2 pr-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(bd.chargeLines as unknown[]).map((row, idx) =>
                  isRecord(row) ? (
                    <tr key={typeof row.id === "string" ? row.id : idx} className="border-b border-zinc-100">
                      <td className="py-2 pr-3">{String(row.rawChargeName ?? "")}</td>
                      <td className="py-2 pr-3">{String(row.normalizedCode ?? "")}</td>
                      <td className="py-2 pr-3">{String(row.unitBasis ?? "")}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {fmtMoney(row.amount != null ? String(row.amount) : null, String(row.currency ?? props.currency))}
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {props.sourceType === "QUOTE_RESPONSE" && isRecord(bd) && Array.isArray(bd.lines) ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Quote lines (frozen)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(bd.lines as unknown[]).map((row, idx) =>
                  isRecord(row) ? (
                    <tr key={typeof row.id === "string" ? row.id : idx} className="border-b border-zinc-100">
                      <td className="py-2 pr-3">{String(row.label ?? "")}</td>
                      <td className="py-2 pr-3">{String(row.lineType ?? "")}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {fmtMoney(row.amount != null ? String(row.amount) : null, String(row.currency ?? props.currency))}
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Free time basis (frozen)</h2>
        <p className="mt-2 text-xs text-zinc-500">
          {props.sourceType === "TARIFF_CONTRACT_VERSION"
            ? "Contract free-time rules copied at freeze time."
            : "RFQ free-time summary copied at freeze time."}
        </p>
        <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
          {JSON.stringify(ft, null, 2)}
        </pre>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Commercial extension (reserved)</h2>
        <p className="mt-2 text-xs text-zinc-500">
          Future buy/sell splits, margin, and counterparty economics can populate{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-700">commercialJson</code> and{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-zinc-700">basisSide</code> without changing the frozen
          line payload above.
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">basisSide</dt>
            <dd className="mt-1 font-mono text-zinc-800">{props.basisSide ?? "—"}</dd>
          </div>
        </dl>
        <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
          {props.commercialJson != null ? JSON.stringify(props.commercialJson, null, 2) : "null"}
        </pre>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Raw breakdown JSON</h2>
        <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100">
          {JSON.stringify(bd, null, 2)}
        </pre>
      </section>
    </div>
  );
}
