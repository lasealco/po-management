import { describe, expect, it } from "vitest";

import { parseImportAssistantChatBody } from "./import-assistant-chat-body";

describe("parseImportAssistantChatBody", () => {
  it("accepts valid body", () => {
    const r = parseImportAssistantChatBody({
      messages: [{ role: "user", content: "What next?" }],
      context: { step: "domain" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.messages).toHaveLength(1);
    expect(r.value.context.step).toBe("domain");
  });

  it("rejects empty messages", () => {
    const r = parseImportAssistantChatBody({
      messages: [],
      context: { step: "domain" },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects bad fileKind", () => {
    const r = parseImportAssistantChatBody({
      messages: [{ role: "user", content: "hi" }],
      context: { step: "upload", fileKind: "pdf" },
    });
    expect(r.ok).toBe(false);
  });
});
