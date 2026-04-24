/**
 * Lexical (keyword) retrieval for Search & assist; scores operator queries against a
 * small in-repo corpus. Optional **semantic** hybrid is in `assist-retrieval-embed.ts`
 * when `CONTROL_TOWER_ASSIST_EMBEDDINGS=1` and `OPENAI_API_KEY` are set.
 */

export type AssistRetrievedSnippet = {
  id: string;
  /** Substrings / words matched case-insensitively (word-boundary where single-token). */
  terms: string[];
  /** Short hint shown to all users (rule + LLM paths). */
  summary: string;
  /** Longer note passed only to the LLM merge step (when enabled). */
  detail: string;
};

const SNIPPETS: AssistRetrievedSnippet[] = [
  {
    id: "inbound-webhook",
    terms: [
      "webhook",
      "inbound",
      "integration",
      "carrier feed",
      "payload",
      "idempotency",
      "milestone",
      "api",
      "visibility_flat",
      "visibility payload",
      "carrier webhook",
      "data array",
    ],
    summary:
      "Carrier / TMS milestones can be pushed with POST /api/integrations/control-tower/inbound (Bearer or x-ct-inbound secret). Use payloadFormat canonical, generic_carrier_v1, sea_port_track_v1 (example mapper: seaPortEvent in inbound-carrier-mappers.ts), simple_carrier_event_v1 (flat shipmentId + eventCode + eventTime), carrier_webhook_v1 (data[] batch, default cap 50, env CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS up to 200), tms_event_v1, or visibility_flat_v1; optional idempotencyKey for safe replays.",
    detail:
      "Inbound integration: verify CONTROL_TOWER_INBOUND_WEBHOOK_SECRET. JSON body supports idempotencyKey (replays return the first response from CtAuditLog), payloadFormat canonical | generic_carrier_v1 | sea_port_track_v1 | simple_carrier_event_v1 | carrier_webhook_v1 | tms_event_v1 | visibility_flat_v1, and optional milestone upsert as CtTrackingMilestone with sourceType INTEGRATION. Canonical uses shipmentId + milestone object; generic_carrier_v1 uses carrierPayload; sea_port_track_v1 uses seaPortEvent mapped to carrier fields (see inbound-carrier-mappers.ts); simple_carrier_event_v1 maps top-level fields to the same generic_carrier_v1 path; carrier_webhook_v1 uses non-empty data[] (each row like generic, batch cap default 50 / max 200 via CONTROL_TOWER_INBOUND_CARRIER_WEBHOOK_MAX_ROWS, per-row errors in response rows[]; JSON responses echo maxBatchRows; idempotencyKey suffix :index per row); tms_event_v1 uses tmsPayload; visibility_flat_v1 uses visibilityPayload with flat shipment id, event/status code, and timestamp fields.",
  },
  {
    id: "milestone-provenance",
    terms: [
      "simulated",
      "integration",
      "manual",
      "provenance",
      "source",
      "tracking milestone",
      "demo timeline",
    ],
    summary:
      "CtTrackingMilestone rows carry sourceType SIMULATED (demo), INTEGRATION (webhook/API), or MANUAL (user). Shipment 360 Milestones tab shows chips; use workbench or 360 demo actions to fill or regenerate simulated timelines.",
    detail:
      "Milestone provenance: SIMULATED vs INTEGRATION vs MANUAL is stored on flexible tracking milestones. Shipment 360 shows legend and per-row chips. Demo enrich/regenerate actions exist on the workbench and on Milestones (single shipment via shipmentId on POST actions enrich_ct_demo_tracking / regenerate_ct_demo_timeline).",
  },
  {
    id: "milestone-template-pack",
    terms: [
      "milestone pack",
      "template pack",
      "milestone template",
      "apply pack",
      "pack catalog",
      "milestone pack catalog",
      "ct milestone pack",
    ],
    summary:
      "Milestone template packs: GET /api/control-tower/milestone-pack-catalog (full catalog) or ?mode=OCEAN|AIR|ROAD|RAIL to filter built-ins to that lane; POST /api/control-tower with action apply_ct_milestone_pack applies a pack’s codes to a shipment (Shipment 360 Milestones, new booking flow).",
    detail:
      "CtMilestoneTemplatePack: built-in and tenant rows from seed/API; GET catalog without mode returns full merged list; mode=OCEAN|AIR|ROAD|RAIL filters built-ins (invalid mode → HTTP 400). apply_ct_milestone_pack in post-actions merges template milestones into CtTrackingMilestone (see milestone-templates.ts, control-tower-new-shipment, Shipment 360 apply pack UI).",
  },
  {
    id: "exception-catalog",
    terms: ["exception", "exception code", "catalog", "ct exception", "settings"],
    summary:
      "Tenant admins maintain exception types under Settings → Control Tower exception types; API GET /api/control-tower/exception-codes and POST action upsert_ct_exception_code extend the catalog. Filter open exceptions in workbench / search with exceptionCode= or assist exception:CODE; open alerts with alertType= or assist alertType: / ctAlert:.",
    detail:
      "Exception catalog: CtExceptionCode per tenant, Settings UI at /settings/control-tower-exception-codes, GET exception-codes, and post-actions upsert_ct_exception_code for API-driven catalog sync.",
  },
  {
    id: "control-tower-post-actions",
    terms: [
      "post action",
      "POST /api/control-tower",
      "mutation",
      "bulk",
      "acknowledge",
      "upsert",
      "save_ct_filter",
    ],
    summary:
      "All Control Tower state changes go through POST /api/control-tower with an action field (e.g. acknowledge_ct_alert, save_ct_filter) — not from Search. Assist now returns a read-only postActionToolCatalog; running mutations requires org.controltower edit (see canExecuteControlTowerPostActions in assist JSON).",
    detail:
      "post-actions.ts is the main router. Search page documents representative actions in a collapsible list; the assist API exposes the same catalog plus a boolean when the user has edit. Future tool-calling should stay allowlisted and audited — see GAP near-term #4 and issue #6.",
  },
  {
    id: "product-trace",
    terms: ["product trace", "trace", "sku", "buyer code", "map", "po to stock"],
    summary:
      "Product trace: use assist tokens trace:, sku:, or product: for productTraceQ, or open /product-trace?q=. Search UI shows Open product trace when that field is set.",
    detail:
      "Product trace answers PO → ocean → stock style questions. Assist and search support productTraceQ; help playbooks include product_trace path. /product-trace renders ControlTowerReportingHubWorkbenchLinks in the header when the actor has org.controltower view.",
  },
  {
    id: "report-ai-insight",
    terms: [
      "report insight",
      "ai insight",
      "interpret report",
      "CONTROL_TOWER_REPORT_INSIGHT",
      "openai report",
      "reports/insight",
    ],
    summary:
      "Optional AI narrative on saved report config: POST /api/control-tower/reports/insight with the same config JSON as run plus optional question. Requires OPENAI_API_KEY and CONTROL_TOWER_REPORT_INSIGHT_LLM=1.",
    detail:
      "Server runs runControlTowerReport then runReportInsightLlm (report-insight-llm.ts). buildReportInsightRunSummary lives in report-run-summary.ts and is also attached to POST /api/control-tower/reports/run. Success JSON includes insight, generatedAt, and runSummary (title, measureLabel, dimensionLabel, dateWindowLine, compareMeasureLabel, coverage subset). On LLM disabled or OpenAI failure, HTTP 503 still includes runSummary and generatedAt plus error so the UI can show the interpreted scope without a model reply.",
  },
  {
    id: "control-tower-search-api",
    terms: [
      "control tower search",
      "GET search",
      "search api",
      "take=",
      "/api/control-tower/search",
      "/api/control-tower/shipments",
      "search limit",
      "list limit",
      "truncated",
    ],
    summary:
      "GET /api/control-tower/search merges q= text with filters (mode, status, lane, originCode, destinationCode, routeAction, exceptionCode, alertType, …). Optional take= caps rows (default 60, max 200). GET /api/control-tower/shipments uses the same list builder with take (default 80, max 200) and returns listLimit, itemCount, truncated.",
    detail:
      "Search response: searchLimit (effective cap), itemCount, truncated, shipments. Shipments list response: listLimit, itemCount, truncated, shipments — same truncation semantics (full page at cap). Workbench and command center show an amber cap hint when truncated; /control-tower/search UI adds a Workbench link. Empty query with no structured filters returns itemCount 0 and a guidance message.",
  },
  {
    id: "overview-vs-reports-summary",
    terms: [
      "control tower overview",
      "overview api",
      "hub kpi",
      "reports summary",
      "reports summary api",
      "getControlTowerOverview",
      "getControlTowerReportsSummary",
    ],
    summary:
      "Two read-only KPI feeds: GET /api/control-tower/overview powers the /control-tower hub (arrivals windows, stale shipments, overdue ETA, legs/containers). GET /api/control-tower/reports/summary powers the reports workspace (route-action counts, owner load, ETA lane performance, SLA-breach-style totals).",
    detail:
      "Both require org.controltower view and use the same portal scope (customer/supplier restriction when applicable). overview.ts is lighter hub telemetry; reports-summary.ts is deeper operational analytics for the Build reports page — do not confuse the JSON shapes when wiring dashboards or assist tools.",
  },
  {
    id: "reporting-hub-focus",
    terms: [
      "reporting hub focus",
      "focus=control-tower",
      "/reporting?focus",
      "scroll reporting hub",
      "reporting cockpit focus",
    ],
    summary:
      "Cross-module /reporting supports ?focus=po|control-tower|crm|wms to scroll to that card. Help open_path payload.focus is server-validated; grants without that module drop focus but still open /reporting.",
    detail:
      "help-actions REPORTING_FOCUS and reporting hub access gate (at least one of org.reports, org.controltower, org.crm, org.wms view). Help playbook reporting_hub step “Jump to Control Tower on the hub”; help-llm reporting_hub quick action; command palette “Reporting hub — Control Tower”; reporting-hub-paths.ts: REPORTING_HUB_FOCUS_PO_HREF, …_CRM_…, …_WMS_…, REPORTING_HUB_CONTROL_TOWER_HREF; ControlTowerReportingHubWorkbenchLinks: reportingLabel/workbenchLabel/noWrapper (digest footer, “← All reporting modules” on CT reports), text row (default), includeWorkbench=false (Shipment 360), variant=button buttonSize=sm|md (My dashboard vs workbench toolbar); sky text pair on hub, Search, command center, ops, new booking, product trace; Control Tower top subnav includes Reporting hub; /reporting header links back to Control Tower home, workbench, and digest when org.controltower view.",
  },
  {
    id: "scheduled-reports",
    terms: ["schedule", "email report", "cron", "resend", "csv", "pdf", "saved report"],
    summary:
      "Saved Control Tower reports can be emailed on a schedule (DAILY/WEEKLY UTC): CtReportSchedule, cron /api/cron/control-tower-report-schedules, attachments UTF-8 CSV plus summary PDF when RESEND_API_KEY and CONTROL_TOWER_REPORTS_EMAIL_FROM are set.",
    detail:
      "Report schedules: builder Email schedule UI, POST/PATCH schedules APIs, hourly cron with CRON_SECRET. Delivery attaches CSV full series and pdf-lib summary PDF (tenant name in PDF header/footer when known; measure · dimension subtitle; optional date window line when dateFrom/dateTo set on the report). Scheduled email body includes the same measure · dimension line, optional date window, and compare measure when configured. POST reports/run and GET dashboard/widgets include runSummary on the JSON; hub pinned cards and the report builder scope strip surface the same labels. In-app Download CSV and Download PDF on the report builder match attachment formats.",
  },
  {
    id: "route-actions",
    terms: ["route action", "send booking", "plan leg", "escalate", "await booking", "mark departure", "arrival"],
    summary:
      "Workbench routeAction filter aligns with CT_URL_ROUTE_ACTION_PREFIXES; assist accepts route:<slug> (e.g. route:plan_leg) mapped to the same prefixes as deep links from dashboard and ops.",
    detail:
      "Route action buckets: Send booking, Await booking, Escalate booking, Plan leg, Mark departure, Record arrival, Route complete. assist route: token and search routeAction query use the same slug → prefix mapping as workbench URLs.",
  },
  {
    id: "saved-workbench-views",
    terms: [
      "saved view",
      "saved filter",
      "save view",
      "workbench saved",
      "save workbench",
      "save_ct_filter",
      "delete_ct_filter",
      "ct saved filter",
    ],
    summary:
      "Workbench saved views (per user): GET /api/control-tower/saved-filters lists CtSavedFilter rows; POST /api/control-tower with save_ct_filter (name + filtersJson) or delete_ct_filter. Apply saved views on /control-tower/workbench — Search & assist only hints names; it does not load a saved JSON into GET /search.",
    detail:
      "filtersJson stores workbench URL/sync state (status, mode, exceptionCode, alertType, columnVisibility, etc.). save_ct_filter clears shipper/consignee/carrier/supplier/customer name text keys before insert so master-entity blur is not persisted. Assist passes saved filter names to the LLM as savedWorkbenchFilterNames. Export CSV uses visible columns; when GET /api/control-tower/shipments returns truncated, the download starts with a # comment line documenting the listLimit cap.",
  },
  {
    id: "dispatch-owner",
    terms: ["dispatch", "assignee", "owner", "queue", "alert owner", "exception owner"],
    summary:
      "Filter open alert/exception ownership with owner:, assignee:, or dispatch: plus a user cuid; search API field dispatchOwnerUserId matches workbench deep links from ops views.",
    detail:
      "Dispatch owner scope: suggestedFilters.dispatchOwnerUserId for user id; tokens owner/assignee/dispatch in assist. Used for ops queue triage alongside status and overdue filters. Different from shipment-level ops assignee (update_shipment_ops_assignee on Shipment).",
  },
  {
    id: "shipment-party-fields",
    terms: [
      "ops assignee shipment",
      "shipment ops assignee",
      "shipment carrier",
      "carrier supplier shipment",
      "shipment customer",
      "crm account shipment",
      "set_shipment_carrier_supplier",
      "set_shipment_customer_crm_account",
      "update_shipment_ops_assignee",
    ],
    summary:
      "Shipment 360 / POST actions: set_shipment_customer_crm_account (CRM link for digest + SO flows), set_shipment_carrier_supplier (active Supplier as carrier), update_shipment_ops_assignee (Shipment.opsAssigneeUserId); workbench bulk **bulk_update_shipment_ops_assignee** + **GET /api/control-tower/workbench-assignees** for the assignee list. Not the same as workbench dispatch-owner tokens (open alert/exception queue filters).",
    detail:
      "All actions take shipmentId and tenant-scoped checks; writeCtAudit on updates. Customer CRM link gates create_sales_order_from_shipment; carrier supplier drives booking and reporting joins. Pair with workbench supplier:/customer:/carrier: cuid search filters when triaging lists.",
  },
  {
    id: "ops-command-center",
    terms: [
      "command center",
      "ops console",
      "escalation",
      "sla",
      "kanban",
      "lanes",
      "run escalation",
      "ops summary",
    ],
    summary:
      "Ops lanes live at /control-tower/ops and /control-tower/command-center. Use GET /api/control-tower/ops/summary and POST /api/control-tower/ops/run-escalation for SLA-style escalations (cron can invoke the same run-escalation path).",
    detail:
      "Ops and command center: triage-style views, escalation API to advance or flag work, workbench deep links carry status, overdue, and routeAction for drill-down. Automated booking SLA sweep: GET/POST /api/cron/control-tower-sla-escalation with CRON_SECRET. Complements dispatch-owner and alert/exception filters.",
  },
  {
    id: "control-tower-cron-jobs",
    terms: [
      "control tower cron",
      "ct cron",
      "cron secret",
      "scheduled job",
      "sla escalation cron",
      "report schedules cron",
      "fx refresh cron",
    ],
    summary:
      "Three Control Tower cron routes (GET/POST, Authorization: Bearer CRON_SECRET): /api/cron/control-tower-report-schedules (due saved-report emails), /api/cron/control-tower-fx-refresh (Frankfurter FX upserts), /api/cron/control-tower-sla-escalation (booking SLA breach notes/alerts).",
    detail:
      "Report cron uses RESEND + CONTROL_TOWER_REPORTS_EMAIL_FROM when set. FX cron reads CONTROL_TOWER_FX_BASES / CONTROL_TOWER_FX_TARGETS. SLA cron runs runSlaEscalationsAllTenants; optional CONTROL_TOWER_SYSTEM_ACTOR_EMAIL attributes audits. vercel.json may schedule these on Hobby once/day.",
  },
  {
    id: "booking-forwarder",
    terms: [
      "forwarder booking",
      "confirm forwarder",
      "booking confirmation",
      "shipment booking tab",
      "send_booking_to_forwarder",
      "confirm_forwarder_booking",
      "booking draft",
    ],
    summary:
      "Shipment 360 Booking: draft forwarder data, then POST /api/control-tower actions send_booking_to_forwarder (requires forwarder, starts SLA clock) and confirm_forwarder_booking — simulated lifecycle, not live EDI.",
    detail:
      "ShipmentBooking DRAFT → SENT → CONFIRMED-style transitions; update_ct_shipment_booking_forwarder edits forwarder and booking fields. Audited via CtAuditLog. Use workbench route:send_booking / route:await_booking filters alongside ops views.",
  },
  {
    id: "legs-containers-cargo",
    terms: [
      "shipment leg",
      "ct leg",
      "transport leg",
      "container line",
      "cargo line",
      "ct container",
      "container cargo",
      "create_ct_leg",
      "move_ct_leg",
    ],
    summary:
      "Shipment 360 Legs & Containers: POST /api/control-tower actions create_ct_leg / update_ct_leg / delete_ct_leg / move_ct_leg; create_ct_container / update_ct_container; upsert_ct_container_cargo_line / delete_ct_container_cargo_line; plus update_shipment_cargo_summary and update_shipment_item_cargo for rolled-up cargo.",
    detail:
      "CtShipmentLeg and CtShipmentContainer model multi-leg routing and equipment; CtContainerCargoLine holds per-container cargo rows. All are tenant-scoped via shipment → order; Shipment 360 tabs call these actions from the UI. See post-actions groups for legs · containers · cargo lines.",
  },
  {
    id: "shipment-refs-sales-order",
    terms: [
      "bill of lading",
      "house bl",
      "master bl",
      "awb",
      "shipment reference",
      "add_ct_reference",
      "sales order link",
      "link shipment",
      "create_sales_order_from_shipment",
      "buyer reference",
    ],
    summary:
      "References & SO link: POST add_ct_reference adds CtShipmentReference (refType + refValue on a shipment). set_order_external_reference updates PO buyer reference. create_sales_order_from_shipment (needs shipment customer CRM account) or link_shipment_sales_order sets Shipment.salesOrderId.",
    detail:
      "Manual reference rows complement inbound automation; Shipment 360 Refs tab. Sales order actions are tenant-scoped and audited; create path allocates soNumber and links shipment in a transaction. Aligns with R4 master/house doc tracking until carrier-native B/L sync exists.",
  },
  {
    id: "customer-digest",
    terms: [
      "customer digest",
      "portal digest",
      "crm account",
      "reduced 360",
      "customer portal",
      "digest api",
      "/control-tower/digest",
    ],
    summary:
      "Scoped digest: GET /api/control-tower/customer/digest and the in-app page /control-tower/digest list up to 250 recently updated shipments (portal scope when applicable).",
    detail:
      "Same query powers the API and the Digest page (buildControlTowerDigest in customer-digest.ts). JSON includes digestLimit (250), itemCount, truncated at cap, view flags. Digest page offers Download CSV with a leading # control-tower-digest metadata line and footer links to /reporting?focus=control-tower, workbench, and Control Tower home. Internal users see tenant-wide rows; CRM-linked or supplier portal users see filtered scope. Control Tower subnav shows Digest only in restricted portal sessions; the /control-tower hub adds a Shipment digest shortcut card for those sessions. Internal users can open digest via URL, command palette (⌘K / Ctrl+K → “Reporting hub — Control Tower” or “shipment digest”), reporting hub Control Tower card, executive cockpit chips, WMS/CRM reporting footers, or Help → Control Tower. Shipment 360 remains the full workspace.",
  },
  {
    id: "documents-blob",
    terms: ["document upload", "blob storage", "vercel blob", "shipment document", "upload file", "BLOB_READ_WRITE"],
    summary:
      "Shipment docs: POST /api/control-tower/documents/upload (multipart) registers metadata; Vercel Blob in prod requires BLOB_READ_WRITE_TOKEN — otherwise local public/uploads in dev.",
    detail:
      "Documents: Shipment 360 Documents tab and upload API; type normalization in shipment-document-types; INTERNAL vs SHARED visibility. Production blob token is required for durable object storage on Vercel.",
  },
  {
    id: "control-tower-fx",
    terms: [
      "fx rate",
      "exchange rate",
      "currency conversion",
      "display currency",
      "ct fx",
      "frankfurter",
      "upsert_ct_fx_rate",
      "CONTROL_TOWER_FX",
    ],
    summary:
      "FX: POST /api/control-tower actions upsert_ct_fx_rate (tenant CtFxRate pairs) and set_ct_display_currency (user preference). Cron GET/POST /api/cron/control-tower-fx-refresh (Bearer CRON_SECRET) pulls Frankfurter rates using CONTROL_TOWER_FX_BASES / CONTROL_TOWER_FX_TARGETS env lists.",
    detail:
      "CtFxRate rows power Shipment 360 finance conversions and reporting spend normalization. refreshControlTowerFxRatesAllTenants in fx-refresh.ts upserts rates per tenant; shipment-360 and report-engine read latest pairs. Display currency is stored under userPreference key controlTower.displayCurrency.",
  },
  {
    id: "shipment-notes-finance",
    terms: [
      "shipment note",
      "ct note",
      "internal note",
      "create_ct_note",
      "financial snapshot",
      "shipment finance",
      "cost line",
      "freight cost",
      "create_ct_financial_snapshot",
      "add_ct_cost_line",
    ],
    summary:
      "Shipment 360 Notes & Finance: POST create_ct_note (INTERNAL or SHARED visibility); create_ct_financial_snapshot for CtShipmentFinancialSnapshot (cost/revenue/margin fields + currency); add_ct_cost_line / delete_ct_cost_line for CtShipmentCostLine (category, amount, vendor supplier, invoice metadata).",
    detail:
      "Notes tab threads operator context; Finance tab stacks snapshots and cost lines for margin views. All actions are shipment-scoped with tenant checks and CtAuditLog. Pair with control-tower-fx for rate conversion and set_ct_display_currency for presentation currency.",
  },
];

function termScore(queryLc: string, term: string): number {
  const t = term.toLowerCase().trim();
  if (t.length < 2) return 0;
  if (/\s/.test(t)) return queryLc.includes(t) ? 1 : 0;
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${esc}\\b`, "i");
  return re.test(queryLc) ? 1 : 0;
}

function snippetScore(queryLc: string, s: AssistRetrievedSnippet): number {
  return s.terms.reduce((acc, term) => acc + termScore(queryLc, term), 0);
}

/** Raw keyword hit counts per corpus id (for hybrid embedding + keyword ranking). */
export function keywordScoresForAllSnippets(raw: string): Map<string, number> {
  const queryLc = raw.trim().toLowerCase();
  const m = new Map<string, number>();
  for (const s of SNIPPETS) {
    m.set(s.id, snippetScore(queryLc, s));
  }
  return m;
}

/** Stable corpus for embedding-backed assist (Phase 1A); same rows as keyword retrieval. */
export function getAssistRetrievalCorpus(): readonly AssistRetrievedSnippet[] {
  return SNIPPETS;
}

export type AssistRetrievalResult = {
  /** Top summaries for UI hints (capped). */
  hintLines: string[];
  /** Detail strings for LLM context only (capped). */
  llmDetails: string[];
  /** Snippet ids that fired (for debugging / future telemetry). */
  matchedIds: string[];
};

/**
 * Score `raw` against the static corpus; returns hints and LLM-only detail lines.
 * @param maxHints — max summary lines (default 2)
 * @param maxLlmDetails — max detail paragraphs passed to the model (default 2)
 * @param minScore — minimum summed term hits to include a snippet (default 1)
 */
export function retrieveAssistSnippets(
  raw: string,
  opts?: { maxHints?: number; maxLlmDetails?: number; minScore?: number },
): AssistRetrievalResult {
  const maxHints = opts?.maxHints ?? 2;
  const maxLlmDetails = opts?.maxLlmDetails ?? 2;
  const minScore = opts?.minScore ?? 1;

  const queryLc = raw.trim().toLowerCase();
  if (queryLc.length < 2) {
    return { hintLines: [], llmDetails: [], matchedIds: [] };
  }

  const ranked = SNIPPETS.map((s) => ({ s, score: snippetScore(queryLc, s) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score || a.s.id.localeCompare(b.s.id));

  const picked = ranked.slice(0, Math.max(maxHints, maxLlmDetails));
  const hintLines = picked.slice(0, maxHints).map((x) => x.s.summary);
  const llmDetails = picked.slice(0, maxLlmDetails).map((x) => x.s.detail);
  const matchedIds = picked.slice(0, maxHints).map((x) => x.s.id);

  return { hintLines, llmDetails, matchedIds };
}
