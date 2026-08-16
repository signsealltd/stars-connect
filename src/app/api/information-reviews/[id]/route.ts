import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withCapability, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
import { CAPABILITIES } from "@/lib/permissions";
import bcrypt from "bcryptjs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke") }),
  z.object({ action: z.literal("extend"), days: z.number().int().min(1).max(90) }),
  z.object({ action: z.literal("proposal"), proposalId: z.string().uuid(), decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("complete"), nextReviewDate: z.string().date().optional() }),
]);

async function scoped(id: string, organisationId: string) {
  return prisma.informationReviewRequest.findFirst({ where: { id, organisationId }, include: { student: true, submissions: { orderBy: { version: "desc" }, take: 1 }, proposals: { orderBy: [{ critical: "desc" }, { category: "asc" }, { fieldKey: "asc" }] }, consentHistory: true } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCapability(req, CAPABILITIES.INFORMATION_REVIEW_VIEW, async user => {
    if (!user.organisationId) return NextResponse.json({ error: "Organisation is not configured." }, { status: 409 });
    const review = await scoped((await params).id, user.organisationId);
    return review ? NextResponse.json(review) : NextResponse.json({ error: "Review not found." }, { status: 404 });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCapability(req, CAPABILITIES.INFORMATION_REVIEW_APPROVE, async user => {
    if (!user.organisationId) return NextResponse.json({ error: "Organisation is not configured." }, { status: 409 });
    const id = (await params).id, existing = await scoped(id, user.organisationId);
    if (!existing) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Check the requested action." }, { status: 422 });
    if (parsed.data.action === "revoke") {
      const review = await prisma.informationReviewRequest.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } });
      await audit("INFORMATION_REVIEW_REVOKED", { actorType: "USER", actorId: user.id, entityType: "InformationReviewRequest", entityId: id, ...requestContext(req) });
      return NextResponse.json(review);
    }
    if (parsed.data.action === "extend") {
      const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + parsed.data.days);
      const review = await prisma.informationReviewRequest.update({ where: { id }, data: { expiresAt, status: existing.status === "EXPIRED" ? "IN_PROGRESS" : existing.status } });
      await audit("INFORMATION_REVIEW_EXTENDED", { actorType: "USER", actorId: user.id, entityType: "InformationReviewRequest", entityId: id, afterValue: { expiresAt }, ...requestContext(req) });
      return NextResponse.json(review);
    }
    if (parsed.data.action === "proposal") {
      const proposalAction = parsed.data;
      const proposal = existing.proposals.find(item => item.id === proposalAction.proposalId);
      if (!proposal) return NextResponse.json({ error: "Change not found." }, { status: 404 });
      await prisma.recordChangeProposal.update({ where: { id: proposal.id }, data: { status: proposalAction.decision, approvedValue: proposalAction.decision === "APPROVED" ? proposal.submittedValue ?? Prisma.JsonNull : undefined, reviewNote: proposalAction.note, reviewedById: user.id, reviewedAt: new Date() } });
      await audit(`INFORMATION_REVIEW_CHANGE_${proposalAction.decision}`, { actorType: "USER", actorId: user.id, entityType: "RecordChangeProposal", entityId: proposal.id, beforeValue: { fieldKey: proposal.fieldKey, value: proposal.currentValue }, afterValue: { fieldKey: proposal.fieldKey, value: proposal.submittedValue, note: proposalAction.note }, ...requestContext(req) });
      return NextResponse.json(await scoped(id, user.organisationId));
    }
    if (!["SUBMITTED", "UNDER_REVIEW", "PARTIALLY_APPROVED"].includes(existing.status)) {
      return NextResponse.json({ error: "This review has not been submitted and cannot be completed." }, { status: 409 });
    }
    const pending = existing.proposals.filter(item => item.status === "PENDING");
    if (pending.length) return NextResponse.json({ error: "Accept or reject every proposed change before completing the review." }, { status: 409 });
    const approved = existing.proposals.filter(item => item.status === "APPROVED");
    const scalar: Record<string, unknown> = {};
    const jsonFields = new Set(["secondaryEmergencyContact", "medicalProfile", "personCentredProfile"]);
    for (const proposal of approved) if (!jsonFields.has(proposal.fieldKey) && !["consents", "billing"].includes(proposal.fieldKey)) scalar[proposal.fieldKey] = proposal.submittedValue;
    if (typeof scalar.dateOfBirth === "string") scalar.dateOfBirth = scalar.dateOfBirth ? new Date(scalar.dateOfBirth) : null;
    const jsonData = Object.fromEntries(approved.filter(item => jsonFields.has(item.fieldKey)).map(item => [item.fieldKey, item.submittedValue ?? Prisma.JsonNull]));
    const nextReviewDate = parsed.data.nextReviewDate ? new Date(parsed.data.nextReviewDate) : existing.nextReviewDate;
    await prisma.$transaction(async tx => {
      await tx.student.update({ where: { id: existing.studentId }, data: { ...scalar, ...jsonData, lastInformationReviewAt: new Date(), nextInformationReviewAt: nextReviewDate } });
      await tx.informationReviewRequest.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date(), reviewedById: user.id, nextReviewDate } });
      const consent = approved.find(item => item.fieldKey === "consents");
      if (consent && consent.submittedValue && typeof consent.submittedValue === "object" && !Array.isArray(consent.submittedValue)) for (const [consentType, newValue] of Object.entries(consent.submittedValue as Record<string, unknown>)) await tx.studentConsentHistory.create({ data: { studentId: existing.studentId, reviewRequestId: id, consentType, previousValue: Prisma.JsonNull, newValue: newValue as Prisma.InputJsonValue, providedByName: existing.submissions[0]?.declarationName || "Submitted representative", providedAt: existing.submissions[0]?.declaredAt || new Date(), approvedById: user.id, approvedAt: new Date() } });
    });
    await audit("INFORMATION_REVIEW_COMPLETED", { actorType: "USER", actorId: user.id, entityType: "InformationReviewRequest", entityId: id, afterValue: { approvedFields: approved.map(item => item.fieldKey), nextReviewDate }, ...requestContext(req) });
    return NextResponse.json(await scoped(id, user.organisationId));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCapability(req, CAPABILITIES.INFORMATION_REVIEW_MANAGE, async user => {
    if (!user.organisationId) return NextResponse.json({ error: "Organisation is not configured." }, { status: 409 });
    const id = (await params).id;
    const existing = await scoped(id, user.organisationId);
    if (!existing) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    const body = await req.json().catch(() => null);
    if (!body?.password || !await bcrypt.compare(String(body.password), user.passwordHash)) {
      return NextResponse.json({ error: "Your password was not accepted." }, { status: 401 });
    }
    const snapshot = {
      studentId: existing.studentId,
      status: existing.status,
      completedAt: existing.completedAt,
      submissions: existing.submissions.length,
      proposals: existing.proposals.length,
    };
    await prisma.informationReviewRequest.delete({ where: { id } });
    const completed = existing.status === "COMPLETED";
    await audit(completed ? "INFORMATION_REVIEW_DELETED" : "INFORMATION_REVIEW_CANCELLED", {
      actorType: "USER", actorId: user.id, entityType: "InformationReviewRequest", entityId: id,
      beforeValue: snapshot, afterValue: { deleted: true, cancelled: !completed }, ...requestContext(req),
    });
    return NextResponse.json({ ok: true });
  });
}
