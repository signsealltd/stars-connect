import { type ComplianceWorkflowStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requestContext, withCapability } from "@/lib/api";
import { ramsReadiness } from "@/lib/compliance-core";
import {
  acknowledgeVersion,
  createRamsRevision,
  requireOrganisation,
  transitionVersion,
} from "@/lib/compliance-service";
import { CAPABILITIES, type Capability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isRamsPilotRole } from "@/lib/rams-access";

const actions: Record<string, { capability: Capability; to?: ComplianceWorkflowStatus }> = {
  submit: { capability: CAPABILITIES.RAMS_EDIT, to: "UNDER_REVIEW" },
  review: { capability: CAPABILITIES.RAMS_APPROVE, to: "AWAITING_APPROVAL" },
  approve: { capability: CAPABILITIES.RAMS_APPROVE, to: "APPROVED" },
  reject: { capability: CAPABILITIES.RAMS_APPROVE, to: "DRAFT" },
  publish: { capability: CAPABILITIES.RAMS_APPROVE, to: "PUBLISHED" },
  revision: { capability: CAPABILITIES.RAMS_EDIT },
  acknowledge: { capability: CAPABILITIES.COMPLIANCE_ACKNOWLEDGE },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;
  const config = actions[action];
  if (!config) return NextResponse.json({ error: "Unsupported action." }, { status: 404 });

  return withCapability(req, config.capability, async (user) => {
    if (!isRamsPilotRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    try {
      if (action === "revision") return NextResponse.json(await createRamsRevision(user, id), { status: 201 });
      if (action === "acknowledge") {
        const organisationId = requireOrganisation(user);
        const published = await prisma.complianceRecordVersion.findFirst({
          where: { recordId: id, organisationId, status: "PUBLISHED" },
          orderBy: { version: "desc" },
          select: { id: true },
        });
        if (!published) return NextResponse.json({ error: "No published version is available to acknowledge." }, { status: 409 });
        return NextResponse.json(await acknowledgeVersion(user, published.id, requestContext(req)), { status: 201 });
      }

      if (["submit", "review", "approve"].includes(action)) {
        const organisationId = requireOrganisation(user);
        const latest = await prisma.complianceRecordVersion.findFirst({
          where: { recordId: id, organisationId },
          orderBy: { version: "desc" },
          include: { hazards: true, methodSteps: true, checklistItems: true },
        });
        if (!latest) return NextResponse.json({ error: "RAMS record not found." }, { status: 404 });
        const content = (latest.structuredContent ?? {}) as Record<string, unknown>;
        const readiness = ramsReadiness({
          title: latest.title,
          activityDescription: latest.description ?? "",
          location: latest.premisesLocation ?? "",
          responsiblePerson: String(content.responsiblePerson ?? ""),
          assessmentAuthor: String(content.assessmentAuthor ?? ""),
          assessmentDate: latest.assessmentDate?.toISOString(),
          reviewDate: latest.reviewDate?.toISOString(),
          hazards: latest.hazards,
          methodSteps: latest.methodSteps,
          checklistItems: latest.checklistItems,
        });
        if (!readiness.ready) {
          return NextResponse.json({ error: "Complete the readiness checks before progressing.", issues: readiness.issues }, { status: 422 });
        }
      }

      const body = await req.json().catch(() => ({}));
      return NextResponse.json(await transitionVersion({
        user,
        recordId: id,
        to: config.to!,
        comments: String(body.comments ?? "").slice(0, 10000),
      }));
    } catch (error) {
      const message = (error as Error).message;
      const status = (error as { status?: number }).status || 500;
      if ((error as { code?: string }).code === "P2002") {
        return NextResponse.json({ error: "This version has already been acknowledged." }, { status: 409 });
      }
      return NextResponse.json(
        { error: message === "INVALID_COMPLIANCE_TRANSITION" ? "That workflow change is not valid for the current version." : "The RAMS workflow action failed." },
        { status: message === "INVALID_COMPLIANCE_TRANSITION" ? 409 : status },
      );
    }
  });
}
