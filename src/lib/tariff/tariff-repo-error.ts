export type TariffRepoErrorCode =
  | "NOT_FOUND"
  | "BAD_INPUT"
  | "TENANT_MISMATCH"
  | "VERSION_FROZEN"
  | "CONFLICT";

export class TariffRepoError extends Error {
  readonly code: TariffRepoErrorCode;

  constructor(code: TariffRepoErrorCode, message: string) {
    super(message);
    this.name = "TariffRepoError";
    this.code = code;
  }
}
