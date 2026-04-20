export type AttachTariffApplicationRequestFields = {
  contractVersionId: string;
  isPrimary: boolean;
  source: string;
  polCode: string | null;
  podCode: string | null;
  equipmentType: string | null;
  appliedNotes: string | null;
};

export type ParseAttachTariffApplicationRequestBodyResult =
  | { ok: true; body: AttachTariffApplicationRequestFields }
  | { ok: false; error: string };

/** Parses JSON body for `POST /api/shipments/[id]/tariff-applications`. */
export function parseAttachTariffApplicationRequestBody(raw: unknown): ParseAttachTariffApplicationRequestBodyResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Expected object body." };
  }
  const o = raw as Record<string, unknown>;
  const contractVersionId = typeof o.contractVersionId === "string" ? o.contractVersionId.trim() : "";
  if (!contractVersionId) {
    return { ok: false, error: "contractVersionId is required." };
  }
  return {
    ok: true,
    body: {
      contractVersionId,
      isPrimary: typeof o.isPrimary === "boolean" ? o.isPrimary : true,
      source: typeof o.source === "string" ? o.source : "MANUAL",
      polCode: typeof o.polCode === "string" ? o.polCode : null,
      podCode: typeof o.podCode === "string" ? o.podCode : null,
      equipmentType: typeof o.equipmentType === "string" ? o.equipmentType : null,
      appliedNotes: typeof o.appliedNotes === "string" ? o.appliedNotes : null,
    },
  };
}
