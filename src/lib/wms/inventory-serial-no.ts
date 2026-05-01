/** Uppercase alphanumeric-ish serial token for BF-13 registry (not full GS1 validation). */
const SERIAL_MAX = 120;

export class InventorySerialNoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventorySerialNoError";
  }
}

export function normalizeInventorySerialNo(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!t) {
    throw new InventorySerialNoError("inventorySerialNo required.");
  }
  if (t.length > SERIAL_MAX) {
    throw new InventorySerialNoError(`inventorySerialNo must be at most ${SERIAL_MAX} characters.`);
  }
  return t;
}
