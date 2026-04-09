/** Money helpers for split allocations (demo-grade; swap for a decimal library later). */
export function allocateTotals(
  lineTotals: string[],
  parentSubtotal: string,
  parentTax: string,
): { subtotal: string; taxAmount: string; totalAmount: string } {
  const subtotal = lineTotals.reduce((s, x) => s + Number(x), 0);
  const ps = Number(parentSubtotal);
  const pt = Number(parentTax);
  const ratio = ps === 0 ? 0 : pt / ps;
  const taxAmount = subtotal * ratio;
  const totalAmount = subtotal + taxAmount;
  return {
    subtotal: subtotal.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
  };
}
