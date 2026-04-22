export type RfqRepoErrorCode = "NOT_FOUND" | "CONFLICT" | "BAD_INPUT";

/** Domain errors from RFQ libs; `src/app/api/rfq/_lib/rfq-api-error` maps these to HTTP. */
export class RfqRepoError extends Error {
  readonly code: RfqRepoErrorCode;

  constructor(code: RfqRepoErrorCode, message: string) {
    super(message);
    this.name = "RfqRepoError";
    this.code = code;
  }
}
