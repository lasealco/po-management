import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Max UTF-8 byte length of `JSON.stringify(payload)` before insert (aligned with Slice 14 schema policy).
 * Keep in sync with any API documentation for ingest writers.
 */
export const TWIN_INGEST_MAX_PAYLOAD_BYTES = 32_768;

/** Stable machine code for oversize payloads (no PII in message). */
export const TWIN_INGEST_PAYLOAD_TOO_LARGE = "TWIN_INGEST_PAYLOAD_TOO_LARGE" as const;

/** Max length of trimmed `Idempotency-Key` (POST ingest). */
export const TWIN_INGEST_IDEMPOTENCY_KEY_MAX_LEN = 255 as const;

export class TwinIngestPayloadTooLargeError extends Error {
  readonly code = TWIN_INGEST_PAYLOAD_TOO_LARGE;

  constructor() {
    super(TWIN_INGEST_PAYLOAD_TOO_LARGE);
    this.name = "TwinIngestPayloadTooLargeError";
  }
}

export type AppendIngestEventInput = {
  tenantId: string;
  /** Non-empty event discriminator (writer-owned vocabulary). */
  type: string;
  /** Stored as JSON; must serialize under {@link TWIN_INGEST_MAX_PAYLOAD_BYTES} UTF-8 bytes. */
  payload: Prisma.InputJsonValue;
  /**
   * When set, DB enforces uniqueness per tenant (`@@unique([tenantId, idempotencyKey])`). A duplicate append
   * (same tenant + key) returns the **first** row’s `id` and `type` without inserting again. Concurrent duplicate
   * requests may race: one insert wins; the other surfaces `P2002` and is resolved via `findFirst` (same outcome).
   */
  idempotencyKey?: string;
};

function payloadUtf8ByteLength(payload: Prisma.InputJsonValue): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

function isPrismaUniqueViolation(caught: unknown): caught is { code: "P2002" } {
  return (
    typeof caught === "object" &&
    caught !== null &&
    "code" in caught &&
    (caught as { code?: unknown }).code === "P2002"
  );
}

/**
 * Append-only ingest row. Rejects oversize payloads before DB write (no logging of payload contents).
 * When `idempotencyKey` is set, returns the existing row on unique violation (idempotent replay).
 */
export async function appendIngestEvent(
  input: AppendIngestEventInput,
): Promise<{ id: string; type: string }> {
  const type = input.type.trim();
  if (type.length === 0 || type.length > 128) {
    throw new RangeError("INVALID_TWIN_INGEST_TYPE");
  }

  const bytes = payloadUtf8ByteLength(input.payload);
  if (bytes > TWIN_INGEST_MAX_PAYLOAD_BYTES) {
    throw new TwinIngestPayloadTooLargeError();
  }

  try {
    const row = await prisma.supplyChainTwinIngestEvent.create({
      data: {
        tenantId: input.tenantId,
        type,
        payloadJson: input.payload as Prisma.InputJsonValue,
        ...(input.idempotencyKey != null ? { idempotencyKey: input.idempotencyKey } : {}),
      },
      select: { id: true, type: true },
    });
    return row;
  } catch (caught) {
    if (input.idempotencyKey != null && isPrismaUniqueViolation(caught)) {
      const existing = await prisma.supplyChainTwinIngestEvent.findFirst({
        where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey },
        select: { id: true, type: true },
      });
      if (existing) {
        return existing;
      }
    }
    throw caught;
  }
}
