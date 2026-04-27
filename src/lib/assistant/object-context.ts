export type AssistantObjectContext = {
  objectType: string | null;
  objectId: string | null;
};

function firstEvidenceHref(input: { evidence?: Array<{ href: string }> }) {
  return input.evidence?.find((e) => typeof e.href === "string" && e.href.startsWith("/"))?.href ?? "";
}

export function inferAssistantObjectContext(input: {
  prompt?: string;
  evidence?: Array<{ href: string }>;
}): AssistantObjectContext {
  const text = `${input.prompt ?? ""} ${firstEvidenceHref(input)}`;
  const patterns: Array<[string, RegExp]> = [
    ["sales_order", /\/sales-orders\/([a-z0-9_-]+)/i],
    ["shipment", /\/control-tower\/shipments\/([a-z0-9_-]+)/i],
    ["product", /\/products\/([a-z0-9_-]+)/i],
    ["purchase_order", /\/orders\/([a-z0-9_-]+)/i],
  ];
  for (const [objectType, re] of patterns) {
    const match = text.match(re);
    if (match?.[1]) return { objectType, objectId: match[1] };
  }
  return { objectType: null, objectId: null };
}
