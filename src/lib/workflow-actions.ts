/** Actions only available on order detail (split / buyer review), not on dashboard grid. */
export const BOARD_HIDDEN_ACTION_CODES = new Set<string>([
  "propose_split",
  "buyer_accept_split",
  "buyer_reject_proposal",
]);

export function visibleOnBoard(actionCode: string): boolean {
  return !BOARD_HIDDEN_ACTION_CODES.has(actionCode);
}
