import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withCapability, requestContext } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { createReviewToken, reviewExpiry, safeReviewLink, studentReviewSnapshot } from "@/lib/information-review";

const createSchema = z.object({
  studentId: z.string().uuid(),
  expiryDays: z.number().int().min(1).max(90).default(21),
  verifyDateOfBirth: z.boolean().default(false),
  source: z.enum(["ONLINE", "PAPER", "ASSISTED"]).default("ONLINE"),
});

export async function GET(req: NextRequest) {
  return withCapability(req, CAPABILITIES.INFORMATION_REVIEW_VIEW, async user => {
    if (!user.organisationId) return NextResponse.json({ error: "Your account is not assigned to an organisation." }, { status: 409 });
    const rows = await prisma.informationReviewRequest.findMany({
      where: { organisationId: user.organisationId },
      include: { student: { select: { id: true, displayName: true, internalReference: true } }, _count: { select: { proposals: true } } },
      orderBy: { createdAt: "desc" }, take: 250,
    });
    return NextResponse.json(rows);
  });
}

export async function POST(req: NextRequest) {
  return withCapability(req, CAPABILITIES.INFORMATION_REVIEW_MANAGE, async user => {
    if (!user.organisationId) return NextResponse.json({ error: "Your account is not assigned to an organisation." }, { status: 409 });
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Check the review request details.", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
    const student = await prisma.student.findFirst({ where: { id: parsed.data.studentId, active: true } });
    if (!student) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    if (parsed.data.verifyDateOfBirth && !student.dateOfBirth) return NextResponse.json({ error: "Add the client's date of birth before enabling identity verification." }, { status: 422 });
    const { token, tokenHash } = createReviewToken();
    const review = await prisma.informationReviewRequest.create({ data: {
      organisationId: user.organisationId, studentId: student.id, tokenHash,
      status: "SENT",
      source: parsed.data.source, verifyDateOfBirth: parsed.data.verifyDateOfBirth,
      expiresAt: reviewExpiry(parsed.data.expiryDays), createdById: user.id,
      baselineSnapshot: studentReviewSnapshot(student) as Prisma.InputJsonValue,
    } });
    await audit("INFORMATION_REVIEW_CREATED", { actorType: "USER", actorId: user.id, entityType: "InformationReviewRequest", entityId: review.id, afterValue: { studentId: student.id, source: review.source, verifyDateOfBirth: review.verifyDateOfBirth, expiresAt: review.expiresAt }, ...requestContext(req) });
    return NextResponse.json({ review, link: safeReviewLink(token) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
