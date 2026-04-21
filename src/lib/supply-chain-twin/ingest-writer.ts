import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Max UTF-8 byte length of `JSON.stringify(payload)` before insert (aligned with Slice 14 schema policy).
 * Keep in sync with any API documentation for ingest writers.
 */
export const TWIN_INGEST_MAX_PAYLOAD_BYTES = 32_768;

/** Stable machine code for oversize payloads (no PII in message). */
export const TWIN_INGEST_PAYLOAD_TOO_LARGE = "TWIN_INGEST_PAYLOAD_TOO_LARGE" as const;

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
};

function payloadUtf8ByteLength(payload: Prisma.InputJsonValue): number {
  return Buffer.byteLength(JSON.stringify(payload), "utf8");
}

/**
 * Append-only ingest row. Rejects oversize payloads before DB write (no logging of payload contents).
 */
export async function appendIngestEvent(input: AppendIngestEventInput): Promise<{ id: string }> {
  const type = input.type.trim();
  if (type.length === 0 || type.length > 128) {
    throw new RangeError("INVALID_TWIN_INGEST_TYPE");
  }

  const bytes = payloadUtf8ByteLength(input.payload);
  if (bytes > TWIN_INGEST_MAX_PAYLOAD_BYTES) {
    throw new TwinIngestPayloadTooLargeError();
  }

  const row = await prisma.supplyChainTwinIngestEvent.create({
    data: {
      tenantId: input.tenantId,
      type,
      payloadJson: input.payload as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return { id: row.id };
}
