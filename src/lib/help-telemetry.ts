import type { HelpAssistantGrantSnapshot } from "@/lib/help-assistant-grants";

/** Set `HELP_TELEMETRY=0` to disable stdout lines (e.g. very quiet prod). Default: emit structured lines. */
function helpTelemetryDisabled(): boolean {
  return process.env.HELP_TELEMETRY === "0";
}

/** First path segment only, e.g. `/control-tower/workbench` → `/control-tower` (max length bounded). */
export function helpTelemetryPathPrefix(pathname: string | undefined | null): string {
  const raw = (pathname ?? "").trim();
  if (!raw.startsWith("/")) return "";
  const parts = raw.split("/").filter(Boolean);
  const first = parts[0] ?? "";
  if (!first) return "/";
  const p = `/${first}`;
  return p.length > 48 ? p.slice(0, 48) : p;
}

export function helpTelemetryGrantBits(g: HelpAssistantGrantSnapshot): string {
  const bits = [
    g.signedIn ? "1" : "0",
    g.ordersView ? "1" : "0",
    g.consolidationNav ? "1" : "0",
    g.controlTowerView ? "1" : "0",
    g.reportingHub ? "1" : "0",
    g.tariffsView ? "1" : "0",
    g.rfqView ? "1" : "0",
    g.invoiceAuditView ? "1" : "0",
  ];
  return bits.join("");
}

type HelpTelemetryChat = {
  kind: "help_chat";
  tenantId: string;
  messageLen: number;
  answerLen: number;
  playbookId: string | null;
  llmUsed: boolean;
  pathPrefix: string;
  doActionCount: number;
  actionCount: number;
  suggestionCount: number;
  /** Compact capability fingerprint: signedIn,orders,consolidation,ct,reporting,tariffs,rfq,invoiceAudit */
  grantBits: string;
};

type HelpTelemetryAction = {
  kind: "help_action";
  tenantId: string;
  /** Executed action type, or `malformed_request` / `unsupported_type` for early validation failures */
  actionType: string;
  ok: boolean;
  httpStatus: number;
  /** For open_path only — path without query; allowlisted routes only */
  pathKey?: string;
  /** For open_orders_queue only */
  queueKey?: string;
  /** True when open_order was attempted (never log order numbers) */
  openOrderAttempt?: boolean;
};

export function logHelpChatTelemetry(payload: HelpTelemetryChat): void {
  if (helpTelemetryDisabled()) return;
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...payload }));
}

export function logHelpActionTelemetry(payload: HelpTelemetryAction): void {
  if (helpTelemetryDisabled()) return;
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...payload }));
}
