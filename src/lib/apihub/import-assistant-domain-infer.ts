import {
  IMPORT_ASSISTANT_DOMAINS,
  type ImportAssistantDomainId,
} from "@/lib/apihub/import-assistant-domains";

export type ImportAssistantDomainScore = {
  id: ImportAssistantDomainId;
  score: number;
};

/**
 * Lightweight keyword scan — only to cross-check the user's stated domain, never to override without confirmation.
 */
export function scoreImportAssistantDomainsFromRecords(records: unknown[]): ImportAssistantDomainScore[] {
  const sample = records.slice(0, 3);
  const blob = JSON.stringify(sample).toLowerCase();
  const scores: ImportAssistantDomainScore[] = IMPORT_ASSISTANT_DOMAINS.filter((d) => d.id !== "other").map((d) => {
    let score = 0;
    for (const rx of d.matchSignals) {
      const m = blob.match(rx);
      if (m) {
        score += 1;
      }
    }
    return { id: d.id, score };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

export function topImportAssistantDomainGuess(records: unknown[]): ImportAssistantDomainId | null {
  const scored = scoreImportAssistantDomainsFromRecords(records);
  const top = scored[0];
  if (!top || top.score < 1) {
    return null;
  }
  return top.id;
}
