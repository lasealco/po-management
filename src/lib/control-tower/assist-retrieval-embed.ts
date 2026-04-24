/**
 * Optional OpenAI embedding–backed ranking over the same assist corpus as `assist-retrieval.ts`.
 * Feature-flagged (Phase 1A): `CONTROL_TOWER_ASSIST_EMBEDDINGS=1` + `OPENAI_API_KEY`.
 * On failure or when disabled, callers use keyword-only `retrieveAssistSnippets`.
 */

import {
  getAssistRetrievalCorpus,
  keywordScoresForAllSnippets,
  retrieveAssistSnippets,
  type AssistRetrievedSnippet,
  type AssistRetrievalResult,
} from "@/lib/control-tower/assist-retrieval";

export function isControlTowerAssistEmbeddingsEnabled(): boolean {
  const v = process.env.CONTROL_TOWER_ASSIST_EMBEDDINGS?.trim().toLowerCase();
  if (!v || v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}

function embeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
}

function textForEmbeddingSnippet(s: AssistRetrievedSnippet): string {
  const t = `${s.summary}\n\n${s.detail}`;
  return t.length > 12000 ? `${t.slice(0, 12000)}…` : t;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

async function openAiEmbeddingsBatch(apiKey: string, model: string, inputs: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings HTTP ${res.status}${err ? `: ${err.slice(0, 200)}` : ""}`);
  }
  const payload = (await res.json()) as {
    data?: Array<{ index?: number; embedding?: number[] }>;
  };
  const rows = payload.data ?? [];
  const sorted = [...rows].sort((x, y) => (x.index ?? 0) - (y.index ?? 0));
  return sorted.map((r) => r.embedding ?? []);
}

let corpusEmbeddingsCache: Map<string, number[]> | null = null;

async function getCorpusEmbeddingVectors(apiKey: string, model: string): Promise<Map<string, number[]>> {
  if (corpusEmbeddingsCache) return corpusEmbeddingsCache;
  const corpus = getAssistRetrievalCorpus();
  const inputs = corpus.map((s) => textForEmbeddingSnippet(s));
  const vecs = await openAiEmbeddingsBatch(apiKey, model, inputs);
  if (vecs.length !== corpus.length) {
    throw new Error("Embeddings batch length mismatch");
  }
  const m = new Map<string, number[]>();
  corpus.forEach((s, i) => {
    const v = vecs[i];
    if (!v?.length) throw new Error(`Missing embedding for ${s.id}`);
    m.set(s.id, v);
  });
  corpusEmbeddingsCache = m;
  return corpusEmbeddingsCache;
}

/**
 * Hybrid: blend cosine similarity (semantic) with normalized keyword scores (lexical).
 * Weights favor semantics slightly so "how do I email reports" can match scheduled-reports without exact tokens.
 */
function hybridScore(
  cos: number,
  kw: number,
  maxKw: number,
): number {
  const nKw = maxKw > 0 ? Math.min(1, kw / maxKw) : 0;
  return 0.62 * cos + 0.38 * nKw;
}

export type AssistRetrievalWithEmbeddings = AssistRetrievalResult & { usedEmbeddings: boolean };

/**
 * Like `retrieveAssistSnippets`, but when `CONTROL_TOWER_ASSIST_EMBEDDINGS=1` and `OPENAI_API_KEY` are set,
 * ranks the corpus with OpenAI embeddings + keyword blend; otherwise keyword-only.
 */
export async function retrieveAssistSnippetsWithOptionalEmbeddings(
  raw: string,
  opts?: { maxHints?: number; maxLlmDetails?: number; minScore?: number },
): Promise<AssistRetrievalWithEmbeddings> {
  const maxHints = opts?.maxHints ?? 2;
  const maxLlmDetails = opts?.maxLlmDetails ?? 2;
  const minScore = opts?.minScore ?? 1;

  const keywordOnly = retrieveAssistSnippets(raw, { maxHints, maxLlmDetails, minScore });

  if (!isControlTowerAssistEmbeddingsEnabled()) {
    return { ...keywordOnly, usedEmbeddings: false };
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { ...keywordOnly, usedEmbeddings: false };
  }

  const query = raw.trim();
  if (query.length < 2) {
    return { ...keywordOnly, usedEmbeddings: false };
  }

  try {
    const model = embeddingModel();
    const corpus = getAssistRetrievalCorpus();
    const kwMap = keywordScoresForAllSnippets(raw);
    let maxKw = 0;
    for (const v of kwMap.values()) {
      if (v > maxKw) maxKw = v;
    }

    const [corpusVecs, [qVec]] = await Promise.all([
      getCorpusEmbeddingVectors(apiKey, model),
      openAiEmbeddingsBatch(apiKey, model, [query]),
    ]);
    if (!qVec.length) {
      return { ...keywordOnly, usedEmbeddings: false };
    }

    const scored = corpus
      .map((s) => {
        const ev = corpusVecs.get(s.id);
        if (!ev) return { s, sc: -1 };
        const cos = cosineSimilarity(qVec, ev);
        const kw = kwMap.get(s.id) ?? 0;
        return { s, sc: hybridScore(cos, kw, maxKw) };
      })
      .filter((x) => x.sc >= 0)
      .sort((a, b) => b.sc - a.sc || a.s.id.localeCompare(b.s.id));

    const top = scored[0];
    if (!top) {
      return { ...keywordOnly, usedEmbeddings: false };
    }
    /** Avoid replacing good keyword matches with weak semantic noise. */
    if (top.sc < 0.22 && maxKw < minScore) {
      return { ...keywordOnly, usedEmbeddings: false };
    }

    const pickN = Math.max(maxHints, maxLlmDetails);
    const picked = scored.slice(0, pickN);
    const hintLines = picked.slice(0, maxHints).map((x) => x.s.summary);
    const llmDetails = picked.slice(0, maxLlmDetails).map((x) => x.s.detail);
    const matchedIds = picked.slice(0, maxHints).map((x) => x.s.id);

    return { hintLines, llmDetails, matchedIds, usedEmbeddings: true };
  } catch {
    return { ...keywordOnly, usedEmbeddings: false };
  }
}
