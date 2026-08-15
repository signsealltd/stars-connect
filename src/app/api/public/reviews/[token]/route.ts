import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { buildChangeProposals, hashReviewToken, publicReviewState, reviewAnswersSchema, reviewDeclarationSchema, REVIEW_LOCK_MINUTES, REVIEW_MAX_VERIFICATION_FAILURES } from "@/lib/information-review";
import { requestContext } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

const headers = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow, noarchive" };
const verifySchema = z.object({ action: z.literal("verify"), dateOfBirth: z.string().date() });
const submitSchema = z.object({ action: z.literal("submit"), answers: reviewAnswersSchema, declaration: reviewDeclarationSchema });
const saveSchema = z.object({ answers: reviewAnswersSchema.partial() });

function proofFor(tokenHash: string) {
  const secret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("REVIEW_VERIFICATION_SECRET_MISSING");
  return createHash("sha256").update(`${tokenHash}:${secret}`).digest("hex");
}

function proofValid(req: NextRequest, tokenHash: string) {
  return req.headers.get("x-review-verification") === proofFor(tokenHash);
}

async function find(token: string) {
  return prisma.informationReviewRequest.findUnique({ where: { tokenHash: hashReviewToken(token) }, include: { student: true, submissions: { orderBy: { version: "desc" }, take: 1 } } });
}

function stateResponse(state: string, status = 410) { return NextResponse.json({ state }, { status, headers }); }

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const review = await find((await params).token);
  if (!review) return stateResponse("INVALID", 404);
  const state = publicReviewState(review);
  if (state !== "OPEN") return stateResponse(state, state === "LOCKED" ? 429 : 410);
  if (review.verifyDateOfBirth && !proofValid(req, review.tokenHash)) return NextResponse.json({ state: "VERIFY_REQUIRED" }, { headers });
  if (!review.openedAt) await prisma.informationReviewRequest.update({ where: { id: review.id }, data: { openedAt: new Date(), status: review.status === "DRAFT" || review.status === "SENT" ? "OPENED" : review.status } });
  return NextResponse.json({ state: "OPEN", studentName: review.student.displayName, expiresAt: review.expiresAt, answers: review.draftAnswers || review.baselineSnapshot, lastSavedAt: review.lastSavedAt }, { headers });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token, context = requestContext(req);
  const limit = rateLimit(`review-save:${hashReviewToken(token)}:${context.ipAddress || "local"}`, 120, 15 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many save requests. Please wait and try again.", retryAfter: limit.retryAfter }, { status: 429, headers });
  const review = await find(token);
  if (!review) return stateResponse("INVALID", 404);
  if (publicReviewState(review) !== "OPEN") return stateResponse(publicReviewState(review));
  if (review.verifyDateOfBirth && !proofValid(req, review.tokenHash)) return stateResponse("VERIFY_REQUIRED", 401);
  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the saved information." }, { status: 422, headers });
  const baseline = review.baselineSnapshot as Record<string, unknown>, previous = (review.draftAnswers || {}) as Record<string, unknown>;
  const answers = { ...baseline, ...previous, ...parsed.data.answers };
  const updated = await prisma.informationReviewRequest.update({ where: { id: review.id }, data: { draftAnswers: answers as Prisma.InputJsonValue, lastSavedAt: new Date(), status: "IN_PROGRESS" } });
  return NextResponse.json({ saved: true, lastSavedAt: updated.lastSavedAt }, { headers });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token, context = requestContext(req);
  const limit = rateLimit(`review-action:${hashReviewToken(token)}:${context.ipAddress || "local"}`, 20, 15 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests. Please wait and try again.", retryAfter: limit.retryAfter }, { status: 429, headers });
  const review = await find(token);
  if (!review) return stateResponse("INVALID", 404);
  const body = await req.json().catch(() => null);
  const verify = verifySchema.safeParse(body);
  if (verify.success) {
    const state = publicReviewState(review);
    if (state !== "OPEN") return stateResponse(state, state === "LOCKED" ? 429 : 410);
    const expected = review.student.dateOfBirth?.toISOString().slice(0, 10);
    if (!expected || expected !== verify.data.dateOfBirth) {
      const failures = review.verificationFailures + 1, lockedUntil = failures >= REVIEW_MAX_VERIFICATION_FAILURES ? new Date(Date.now() + REVIEW_LOCK_MINUTES * 60_000) : null;
      await prisma.informationReviewRequest.update({ where: { id: review.id }, data: { verificationFailures: lockedUntil ? 0 : failures, lockedUntil } });
      await audit("INFORMATION_REVIEW_VERIFICATION_FAILED", { actorType: "PUBLIC_REVIEW", entityType: "InformationReviewRequest", entityId: review.id, afterValue: { locked: Boolean(lockedUntil) }, ...requestContext(req) });
      return NextResponse.json({ error: lockedUntil ? "Too many attempts. Try again later." : "The information did not match." }, { status: lockedUntil ? 429 : 401, headers });
    }
    await prisma.informationReviewRequest.update({ where: { id: review.id }, data: { verificationFailures: 0, lockedUntil: null } });
    return NextResponse.json({ verified: true, proof: proofFor(review.tokenHash) }, { headers });
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Complete the required information and declaration.", fields: parsed.error.flatten().fieldErrors }, { status: 422, headers });
  const state = publicReviewState(review);
  if (state !== "OPEN") return stateResponse(state, 409);
  if (review.verifyDateOfBirth && !proofValid(req, review.tokenHash)) return stateResponse("VERIFY_REQUIRED", 401);
  const proposals = buildChangeProposals(review.baselineSnapshot as Record<string, unknown>, parsed.data.answers);
  await prisma.$transaction(async tx => {
    await tx.informationReviewSubmission.create({ data: { reviewRequestId: review.id, version: (review.submissions[0]?.version || 0) + 1, answers: parsed.data.answers as Prisma.InputJsonValue, declarationName: parsed.data.declaration.declarationName, declarationCapacity: parsed.data.declaration.declarationCapacity, signatureData: parsed.data.declaration.signatureData || null, declaredAt: new Date() } });
    if (proposals.length) await Promise.all(proposals.map(proposal => tx.recordChangeProposal.create({ data: { reviewRequestId: review.id, fieldKey: proposal.fieldKey, category: proposal.category, critical: proposal.critical, currentValue: proposal.currentValue === null ? Prisma.JsonNull : proposal.currentValue as Prisma.InputJsonValue, submittedValue: proposal.submittedValue === null ? Prisma.JsonNull : proposal.submittedValue as Prisma.InputJsonValue } })));
    await tx.informationReviewRequest.update({ where: { id: review.id }, data: { draftAnswers: parsed.data.answers as Prisma.InputJsonValue, submittedAt: new Date(), status: "SUBMITTED", lastSavedAt: new Date() } });
  });
  await audit("INFORMATION_REVIEW_SUBMITTED", { actorType: "PUBLIC_REVIEW", entityType: "InformationReviewRequest", entityId: review.id, afterValue: { proposalCount: proposals.length, criticalCount: proposals.filter(item => item.critical).length }, ...requestContext(req) });
  return NextResponse.json({ submitted: true, state: "SUBMITTED" }, { headers });
}
