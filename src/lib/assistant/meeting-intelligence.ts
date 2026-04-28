export type MeetingTranscriptSignal = {
  id: string;
  sourceType: "EMAIL_THREAD" | "CRM_ACTIVITY" | "SHIPMENT_NOTE" | "CT_EXCEPTION" | "SUPPLIER_TASK";
  title: string;
  body: string;
  speakerLabel: string | null;
  occurredAt: string;
  objectType: string | null;
  objectId: string | null;
  objectHref: string | null;
};

export type MeetingIntelligenceInputs = {
  transcripts: MeetingTranscriptSignal[];
};

const ACTION_WORDS = ["follow up", "confirm", "send", "call", "assign", "review", "resolve", "update", "queue", "approve"];
const RISK_WORDS = ["risk", "delay", "blocked", "issue", "problem", "escalate", "urgent", "late", "miss", "exception"];
const DECISION_WORDS = ["decided", "decision", "approved", "agreed", "go with", "choose", "confirmed"];

function sentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);
}

export function redactTranscript(text: string) {
  const redactions: Array<{ type: string; match: string }> = [];
  let redacted = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (match) => {
    redactions.push({ type: "EMAIL", match });
    return "[redacted-email]";
  });
  redacted = redacted.replace(/\+?\d[\d ()-]{7,}\d/g, (match) => {
    redactions.push({ type: "PHONE", match });
    return "[redacted-phone]";
  });
  redacted = redacted.replace(/\b(?:\d[ -]*?){13,16}\b/g, (match) => {
    redactions.push({ type: "PAYMENT_OR_ID", match });
    return "[redacted-number]";
  });
  return { redacted, redactions };
}

export function buildTranscriptDigest(transcripts: MeetingTranscriptSignal[]) {
  return transcripts.map((transcript) => {
    const redacted = redactTranscript(transcript.body);
    const excerpt = sentences(redacted.redacted).slice(0, 2).join(" ");
    return {
      sourceId: transcript.id,
      sourceType: transcript.sourceType,
      title: transcript.title,
      speakerLabel: transcript.speakerLabel,
      occurredAt: transcript.occurredAt,
      excerpt: excerpt.slice(0, 500),
      redactionCount: redacted.redactions.length,
    };
  });
}

function includesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

export function extractMeetingActions(transcripts: MeetingTranscriptSignal[]) {
  const actions = [];
  for (const transcript of transcripts) {
    const redacted = redactTranscript(transcript.body);
    for (const sentence of sentences(redacted.redacted)) {
      if (!includesAny(sentence, ACTION_WORDS)) continue;
      actions.push({
        sourceId: transcript.id,
        sourceType: transcript.sourceType,
        objectType: transcript.objectType,
        objectId: transcript.objectId,
        objectHref: transcript.objectHref,
        ownerHint: transcript.speakerLabel ?? "Unassigned",
        action: sentence.slice(0, 260),
        priority: includesAny(sentence, ["urgent", "blocked", "escalate", "late"]) ? "HIGH" : "MEDIUM",
        guardrail: "Requires review before creating tasks, sending follow-ups, or updating source records.",
      });
    }
  }
  return actions.slice(0, 40);
}

export function extractMeetingRisks(transcripts: MeetingTranscriptSignal[]) {
  const risks = [];
  for (const transcript of transcripts) {
    const redacted = redactTranscript(transcript.body);
    for (const sentence of sentences(redacted.redacted)) {
      if (!includesAny(sentence, RISK_WORDS)) continue;
      risks.push({
        sourceId: transcript.id,
        sourceType: transcript.sourceType,
        objectType: transcript.objectType,
        objectId: transcript.objectId,
        risk: sentence.slice(0, 260),
        severity: includesAny(sentence, ["urgent", "blocked", "escalate", "miss"]) ? "HIGH" : "MEDIUM",
      });
    }
  }
  return risks.slice(0, 30);
}

export function extractMeetingDecisions(transcripts: MeetingTranscriptSignal[]) {
  const decisions = [];
  for (const transcript of transcripts) {
    const redacted = redactTranscript(transcript.body);
    for (const sentence of sentences(redacted.redacted)) {
      if (!includesAny(sentence, DECISION_WORDS)) continue;
      decisions.push({
        sourceId: transcript.id,
        sourceType: transcript.sourceType,
        objectType: transcript.objectType,
        objectId: transcript.objectId,
        decision: sentence.slice(0, 260),
        confidence: sentence.toLowerCase().includes("approved") || sentence.toLowerCase().includes("decided") ? "HIGH" : "MEDIUM",
      });
    }
  }
  return decisions.slice(0, 30);
}

export function buildObjectLinks(transcripts: MeetingTranscriptSignal[]) {
  const seen = new Set<string>();
  const links = [];
  for (const transcript of transcripts) {
    if (!transcript.objectType || !transcript.objectId) continue;
    const key = `${transcript.objectType}:${transcript.objectId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      objectType: transcript.objectType,
      objectId: transcript.objectId,
      objectHref: transcript.objectHref,
      sourceTypes: transcripts.filter((item) => item.objectType === transcript.objectType && item.objectId === transcript.objectId).map((item) => item.sourceType),
    });
  }
  return links;
}

export function buildMeetingMinutes(
  digest: ReturnType<typeof buildTranscriptDigest>,
  actions: ReturnType<typeof extractMeetingActions>,
  risks: ReturnType<typeof extractMeetingRisks>,
  decisions: ReturnType<typeof extractMeetingDecisions>,
) {
  return {
    title: `Meeting minutes from ${digest.length} source${digest.length === 1 ? "" : "s"}`,
    summary: [
      digest[0]?.excerpt ?? "No transcript text available.",
      `${actions.length} action${actions.length === 1 ? "" : "s"}, ${risks.length} risk${risks.length === 1 ? "" : "s"}, and ${decisions.length} decision${decisions.length === 1 ? "" : "s"} extracted for review.`,
    ].join("\n\n"),
    actionBullets: actions.slice(0, 8).map((action) => `${action.ownerHint}: ${action.action}`),
    riskBullets: risks.slice(0, 8).map((risk) => `${risk.severity}: ${risk.risk}`),
    decisionBullets: decisions.slice(0, 8).map((decision) => `${decision.confidence}: ${decision.decision}`),
    guardrail: "Minutes are draft-only until reviewed; follow-ups, tasks, and object updates are not created automatically.",
  };
}

export function scoreMeetingIntelligence(inputs: MeetingIntelligenceInputs) {
  const digest = buildTranscriptDigest(inputs.transcripts);
  const actions = extractMeetingActions(inputs.transcripts);
  const risks = extractMeetingRisks(inputs.transcripts);
  const decisions = extractMeetingDecisions(inputs.transcripts);
  const links = buildObjectLinks(inputs.transcripts);
  const redactionCount = digest.reduce((sum, row) => sum + row.redactionCount, 0);
  const coverage = Math.min(35, inputs.transcripts.length * 5 + links.length * 4);
  const extraction = Math.min(35, actions.length * 4 + decisions.length * 3 + risks.length * 2);
  const redactionPenalty = Math.min(20, redactionCount * 2);
  return Math.max(0, Math.min(100, Math.round(45 + coverage + extraction - redactionPenalty)));
}

export function buildMeetingIntelligencePacket(inputs: MeetingIntelligenceInputs) {
  const transcriptDigest = buildTranscriptDigest(inputs.transcripts);
  const extractedActions = extractMeetingActions(inputs.transcripts);
  const risks = extractMeetingRisks(inputs.transcripts);
  const decisions = extractMeetingDecisions(inputs.transcripts);
  const objectLinks = buildObjectLinks(inputs.transcripts);
  const redactions = inputs.transcripts.flatMap((transcript) =>
    redactTranscript(transcript.body).redactions.map((redaction) => ({ sourceId: transcript.id, sourceType: transcript.sourceType, ...redaction })),
  );
  const minutes = buildMeetingMinutes(transcriptDigest, extractedActions, risks, decisions);
  const meetingScore = scoreMeetingIntelligence(inputs);
  const sourceSummary = {
    transcripts: inputs.transcripts.length,
    emailThreads: inputs.transcripts.filter((item) => item.sourceType === "EMAIL_THREAD").length,
    crmActivities: inputs.transcripts.filter((item) => item.sourceType === "CRM_ACTIVITY").length,
    shipmentNotes: inputs.transcripts.filter((item) => item.sourceType === "SHIPMENT_NOTE").length,
    supplierTasks: inputs.transcripts.filter((item) => item.sourceType === "SUPPLIER_TASK").length,
  };
  const leadershipSummary = [
    `Meeting intelligence score is ${meetingScore}/100 across ${inputs.transcripts.length} transcript source${inputs.transcripts.length === 1 ? "" : "s"}.`,
    `${extractedActions.length} action${extractedActions.length === 1 ? "" : "s"}, ${risks.length} risk${risks.length === 1 ? "" : "s"}, ${decisions.length} decision${decisions.length === 1 ? "" : "s"}, and ${redactions.length} redaction${redactions.length === 1 ? "" : "s"} are ready for review.`,
    "Draft minutes and follow-ups remain approval-gated; no CRM activity, shipment note, supplier task, email, or action queue update happens automatically.",
  ].join("\n\n");
  return {
    title: `Meeting intelligence packet: score ${meetingScore}/100`,
    status: "DRAFT",
    meetingScore,
    transcriptCount: inputs.transcripts.length,
    extractedActionCount: extractedActions.length,
    riskCount: risks.length,
    decisionCount: decisions.length,
    redactionCount: redactions.length,
    sourceSummary,
    transcriptDigest,
    extractedActions,
    risks,
    decisions,
    objectLinks,
    redactions,
    minutes,
    leadershipSummary,
  };
}
