/**
 * Read-only JSON preview for twin snapshot payloads (server component).
 * Large payloads are truncated by UTF-8 byte budget to keep HTML responses bounded.
 */
const MAX_PREVIEW_UTF8_BYTES = 8_000;

function truncateUtf8(text: string, maxBytes: number): { text: string; truncated: boolean } {
  if (Buffer.byteLength(text, "utf8") <= maxBytes) {
    return { text, truncated: false };
  }
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const slice = text.slice(0, mid);
    if (Buffer.byteLength(slice, "utf8") <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  const cut = text.slice(0, lo);
  return { text: `${cut}\n…`, truncated: true };
}

export function TwinEntityJsonPreview({ payload }: { payload: unknown }) {
  let raw: string;
  try {
    raw = JSON.stringify(payload ?? null, null, 2);
  } catch {
    raw = "(unable to serialize payload)";
  }
  const { text, truncated } = truncateUtf8(raw, MAX_PREVIEW_UTF8_BYTES);

  return (
    <div className="space-y-2">
      <pre className="max-h-[min(24rem,50vh)] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-800">
        {text}
      </pre>
      {truncated ? (
        <p className="text-xs text-zinc-500">
          Preview truncated for size. Full payload editing and expand-in-place are not available in this preview yet.
        </p>
      ) : null}
    </div>
  );
}
