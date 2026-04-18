/**
 * Remount key for uncontrolled document row editors after PATCH (keeps defaultValue in sync).
 */
export function supplierDocumentRowEditorKey(
  id: string,
  title: string,
  referenceUrl: string | null,
  documentDate: string | null,
  notes: string | null,
): string {
  let h = 0;
  for (const s of [title, referenceUrl ?? "", documentDate ?? "", notes ?? ""]) {
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `${id}-doc-ed-${h}`;
}
