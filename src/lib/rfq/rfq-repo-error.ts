export type RfqRepoErrorCode = "NOT_FOUND" | "CONFLICT" | "BAD_INPUT";

export class RfqRepoError extends Error {
  readonly code: RfqRepoErrorCode;

  constructor(code: RfqRepoErrorCode, message: string) {
    super(message);
    this.name = "RfqRepoError";
    this.code = code;
  }
}
