/** Tokens documented for BF-42 note templates (`apply_wms_disposition_template_to_shipment_item`). */
export type ReceivingDispositionTemplateContext = {
  lineNo: string | number;
  qtyShipped: string;
  qtyReceived: string;
  productSku: string;
  asnReference: string;
  orderNumber: string;
};

export const RECEIVING_DISPOSITION_TEMPLATE_VARIANCE_NOTE_MAX = 1000;

/** Replace `{{lineNo}}`, `{{qtyShipped}}`, `{{qtyReceived}}`, `{{productSku}}`, `{{asnReference}}`, `{{orderNumber}}`. */
export function substituteReceivingDispositionNoteTemplate(
  template: string,
  ctx: ReceivingDispositionTemplateContext,
): string {
  let s = template;
  s = s.replaceAll("{{lineNo}}", String(ctx.lineNo));
  s = s.replaceAll("{{qtyShipped}}", ctx.qtyShipped);
  s = s.replaceAll("{{qtyReceived}}", ctx.qtyReceived);
  s = s.replaceAll("{{productSku}}", ctx.productSku);
  s = s.replaceAll("{{asnReference}}", ctx.asnReference);
  s = s.replaceAll("{{orderNumber}}", ctx.orderNumber);
  return s.slice(0, RECEIVING_DISPOSITION_TEMPLATE_VARIANCE_NOTE_MAX);
}
