export type SnapshotRepoErrorCode = "NOT_FOUND" | "BAD_INPUT" | "FORBIDDEN";

export class SnapshotRepoError extends Error {
  readonly code: SnapshotRepoErrorCode;

  constructor(code: SnapshotRepoErrorCode, message: string) {
    super(message);
    this.name = "SnapshotRepoError";
    this.code = code;
  }
}
