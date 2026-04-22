/**
 * Guided import assistant — user-stated purpose (never auto-selected).
 * Domain ids are stored in analysis job notes for audit; mapping heuristics stay generic unless we add domain-specific catalogs later.
 */

export const IMPORT_ASSISTANT_DOMAIN_IDS = [
  "shipments_visibility",
  "invoicing_charges",
  "co2_emissions",
  "customs_compliance",
  "master_data_parties",
  "other",
] as const;

export type ImportAssistantDomainId = (typeof IMPORT_ASSISTANT_DOMAIN_IDS)[number];

export type ImportAssistantDomainOption = {
  id: ImportAssistantDomainId;
  title: string;
  description: string;
  /** Keywords for lightweight “does this file match what you said?” hints only — not authoritative. */
  matchSignals: RegExp[];
};

export const IMPORT_ASSISTANT_DOMAINS: ImportAssistantDomainOption[] = [
  {
    id: "shipments_visibility",
    title: "Shipments and visibility",
    description: "Milestones, events, ETAs, equipment, and consignment-style payloads.",
    matchSignals: [/shipment/i, /consignment/i, /container/i, /booking/i, /vessel/i, /milestone/i, /tracking/i],
  },
  {
    id: "invoicing_charges",
    title: "Invoicing and charges",
    description: "Invoice lines, tariffs, accruals, cost breakdowns, and payment references.",
    matchSignals: [/invoice/i, /charge/i, /billing/i, /tariff/i, /accrual/i, /payable/i, /cost/i, /amount/i],
  },
  {
    id: "co2_emissions",
    title: "CO₂ and emissions reporting",
    description: "Emissions factors, distance, mode, and reporting period fields.",
    matchSignals: [/co2/i, /emission/i, /carbon/i, /wtt/i, /ttw/i, /intensity/i, /gco2/i],
  },
  {
    id: "customs_compliance",
    title: "Customs and compliance",
    description: "Declarations, HS codes, licenses, and restricted-party style references.",
    matchSignals: [/customs/i, /declaration/i, /hs\s*code/i, /entry/i, /license/i, /compliance/i],
  },
  {
    id: "master_data_parties",
    title: "Master data (parties, sites)",
    description: "Addresses, carriers, forwarders, locations, and reference codes.",
    matchSignals: [/party/i, /address/i, /supplier/i, /carrier/i, /forwarder/i, /location/i, /unloc/i],
  },
  {
    id: "other",
    title: "Something else",
    description: "You will confirm the purpose after upload; we will not guess business meaning.",
    matchSignals: [],
  },
];

export function importAssistantDomainById(id: string): ImportAssistantDomainOption | null {
  return IMPORT_ASSISTANT_DOMAINS.find((d) => d.id === id) ?? null;
}

export function importAssistantNotePrefix(domainId: ImportAssistantDomainId): string {
  return `[import-assistant] stated_domain=${domainId}`;
}
