import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { toApiErrorResponse } from "@/app/api/_lib/api-error-contract";
import {
  buildAssistantReleaseGate,
  extractAssistantEvidenceItems,
  hasAssistantEvidence,
  isWeakAssistantAnswer,
} from "@/lib/assistant/evidence-quality";
import { getActorUserId, getViewerGrantSet } from "@/lib/authz";
import { getDemoTenant } from "@/lib/demo-tenant";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  if (!tenant) return toApiErrorResponse({ error: "Tenant not found.", code: "NOT_FOUND", status: 404 });

  const [events, evidenceRecords, examples, prompts, latestGate] = await Promise.all([
    prisma.assistantAuditEvent.findMany({
      where: { tenantId: tenant.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        surface: true,
        prompt: true,
        answerKind: true,
        message: true,
        evidence: true,
        quality: true,
        feedback: true,
        objectType: true,
        objectId: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
    }),
    prisma.assistantEvidenceRecord.findMany({
      where: { tenantId: tenant.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        auditEventId: true,
        label: true,
        href: true,
        excerpt: true,
        sourceType: true,
        confidence: true,
        createdAt: true,
      },
    }),
    prisma.assistantReviewExample.findMany({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        auditEventId: true,
        label: true,
        correctionNote: true,
        status: true,
        updatedAt: true,
      },
    }),
    prisma.assistantPromptLibraryItem.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        prompt: true,
        roleScope: true,
        domain: true,
        objectType: true,
        status: true,
        usageCount: true,
        updatedAt: true,
      },
    }),
    prisma.assistantReleaseGate.findFirst({
      where: { tenantId: tenant.id, gateKey: "assistant_quality_release" },
      orderBy: { evaluatedAt: "desc" },
      select: { id: true, status: true, score: true, threshold: true, checksJson: true, notes: true, evaluatedAt: true },
    }),
  ]);

  const evidenceBacked = events.filter(hasAssistantEvidence).length;
  const feedbackCount = events.filter((event) => event.feedback != null).length;
  const weakAnswers = events.filter(isWeakAssistantAnswer);
  const approvedPromptCount = prompts.filter((prompt) => prompt.status === "APPROVED").length;
  const releaseGate = buildAssistantReleaseGate({
    auditTotal: events.length,
    evidenceBacked,
    feedbackCount,
    weakCount: weakAnswers.length,
    approvedPromptCount,
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    metrics: {
      auditTotal: events.length,
      evidenceBacked,
      feedbackCount,
      weakAnswerCount: weakAnswers.length,
      evidenceRecordCount: evidenceRecords.length,
      reviewExampleCount: examples.length,
      approvedPromptCount,
    },
    weakAnswers: weakAnswers.slice(0, 30).map((event) => ({
      ...event,
      actorName: event.actor?.name ?? event.actor?.email ?? "Assistant user",
      evidenceItems: extractAssistantEvidenceItems(event.evidence),
      createdAt: event.createdAt.toISOString(),
    })),
    evidenceRecords: evidenceRecords.map((record) => ({ ...record, createdAt: record.createdAt.toISOString() })),
    reviewExamples: examples.map((example) => ({ ...example, updatedAt: example.updatedAt.toISOString() })),
    promptLibrary: prompts.map((prompt) => ({ ...prompt, updatedAt: prompt.updatedAt.toISOString() })),
    releaseGate: {
      ...releaseGate,
      latestSaved: latestGate
        ? { ...latestGate, evaluatedAt: latestGate.evaluatedAt.toISOString() }
        : null,
    },
  });
}

export async function POST(request: Request) {
  const access = await getViewerGrantSet();
  if (!access?.user) return toApiErrorResponse({ error: "Not signed in.", code: "UNAUTHORIZED", status: 401 });
  const tenant = await getDemoTenant();
  const actorUserId = await getActorUserId();
  if (!tenant || !actorUserId) return toApiErrorResponse({ error: "No active user.", code: "FORBIDDEN", status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return toApiErrorResponse({ error: "Invalid JSON.", code: "BAD_INPUT", status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const action = typeof o.action === "string" ? o.action : "";

  if (action === "attach_evidence") {
    const auditEventId = typeof o.auditEventId === "string" && o.auditEventId.trim() ? o.auditEventId.trim() : null;
    const label = typeof o.label === "string" ? o.label.trim().slice(0, 300) : "";
    if (!auditEventId || !label) return toApiErrorResponse({ error: "auditEventId and label are required.", code: "BAD_INPUT", status: 400 });
    const event = await prisma.assistantAuditEvent.findFirst({ where: { id: auditEventId, tenantId: tenant.id }, select: { id: true } });
    if (!event) return toApiErrorResponse({ error: "Audit event not found.", code: "NOT_FOUND", status: 404 });
    const record = await prisma.assistantEvidenceRecord.create({
      data: {
        tenantId: tenant.id,
        auditEventId,
        label,
        href: typeof o.href === "string" && o.href.trim() ? o.href.trim().slice(0, 2048) : null,
        excerpt: typeof o.excerpt === "string" && o.excerpt.trim() ? o.excerpt.trim().slice(0, 4000) : null,
        sourceType: typeof o.sourceType === "string" && o.sourceType.trim() ? o.sourceType.trim().slice(0, 32).toUpperCase() : "LINK",
        confidence: typeof o.confidence === "string" && o.confidence.trim() ? o.confidence.trim().slice(0, 16).toUpperCase() : "MEDIUM",
        createdByUserId: actorUserId,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, evidenceRecord: record });
  }

  if (action === "record_review") {
    const auditEventId = typeof o.auditEventId === "string" && o.auditEventId.trim() ? o.auditEventId.trim() : "";
    const label = typeof o.label === "string" && o.label.trim() ? o.label.trim().toUpperCase().slice(0, 32) : "CORRECTION";
    const event = await prisma.assistantAuditEvent.findFirst({
      where: { id: auditEventId, tenantId: tenant.id },
      select: { id: true, prompt: true, answerKind: true, message: true, evidence: true, quality: true, feedback: true },
    });
    if (!event) return toApiErrorResponse({ error: "Audit event not found.", code: "NOT_FOUND", status: 404 });
    const correctionNote = typeof o.correctionNote === "string" ? o.correctionNote.trim().slice(0, 8000) : "";
    const example = await prisma.assistantReviewExample.create({
      data: {
        tenantId: tenant.id,
        auditEventId,
        reviewerUserId: actorUserId,
        label,
        correctionNote: correctionNote || null,
        status: label === "APPROVED" ? "APPROVED" : "QUEUED",
        exportJson: {
          prompt: event.prompt,
          answerKind: event.answerKind,
          message: event.message,
          correctionNote: correctionNote || null,
          evidence: event.evidence,
          quality: event.quality,
          feedback: event.feedback,
        } as Prisma.InputJsonObject,
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, reviewExample: example });
  }

  if (action === "save_prompt") {
    const title = typeof o.title === "string" ? o.title.trim().slice(0, 180) : "";
    const prompt = typeof o.prompt === "string" ? o.prompt.trim().slice(0, 8000) : "";
    if (!title || !prompt) return toApiErrorResponse({ error: "title and prompt are required.", code: "BAD_INPUT", status: 400 });
    const item = await prisma.assistantPromptLibraryItem.create({
      data: {
        tenantId: tenant.id,
        createdByUserId: actorUserId,
        title,
        prompt,
        roleScope: typeof o.roleScope === "string" && o.roleScope.trim() ? o.roleScope.trim().slice(0, 64) : null,
        domain: typeof o.domain === "string" && o.domain.trim() ? o.domain.trim().slice(0, 64) : null,
        objectType: typeof o.objectType === "string" && o.objectType.trim() ? o.objectType.trim().slice(0, 64) : null,
        status: o.status === "APPROVED" ? "APPROVED" : "DRAFT",
      },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true, promptLibraryItem: item });
  }

  if (action === "evaluate_gate") {
    const events = await prisma.assistantAuditEvent.findMany({
      where: { tenantId: tenant.id, archivedAt: null },
      take: 200,
      select: { evidence: true, quality: true, feedback: true, objectType: true, objectId: true },
    });
    const approvedPromptCount = await prisma.assistantPromptLibraryItem.count({
      where: { tenantId: tenant.id, status: "APPROVED" },
    });
    const gate = buildAssistantReleaseGate({
      auditTotal: events.length,
      evidenceBacked: events.filter(hasAssistantEvidence).length,
      feedbackCount: events.filter((event) => event.feedback != null).length,
      weakCount: events.filter(isWeakAssistantAnswer).length,
      approvedPromptCount,
    });
    const row = await prisma.assistantReleaseGate.create({
      data: {
        tenantId: tenant.id,
        gateKey: "assistant_quality_release",
        status: gate.status,
        score: gate.score,
        threshold: gate.threshold,
        checksJson: gate.checks as unknown as Prisma.InputJsonValue,
        notes: typeof o.notes === "string" && o.notes.trim() ? o.notes.trim().slice(0, 4000) : null,
        evaluatedByUserId: actorUserId,
      },
      select: { id: true, status: true, score: true },
    });
    return NextResponse.json({ ok: true, releaseGate: row });
  }

  return toApiErrorResponse({ error: "Unsupported evidence-quality action.", code: "BAD_INPUT", status: 400 });
}
