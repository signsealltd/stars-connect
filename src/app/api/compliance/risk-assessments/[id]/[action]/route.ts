import { NextRequest, NextResponse } from "next/server";
import type { ComplianceWorkflowStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestContext, withCapability } from "@/lib/api";
import { CAPABILITIES, type Capability } from "@/lib/permissions";
import { workflowCommentInput } from "@/lib/compliance-input";
import { acknowledgeVersion, requireOrganisation, transitionVersion } from "@/lib/compliance-service";

const actions: Record<string, { capability: Capability; to?: ComplianceWorkflowStatus }> = {
  submit: { capability: CAPABILITIES.RISK_ASSESSMENT_EDIT, to: "UNDER_REVIEW" },
  requestApproval: { capability: CAPABILITIES.RISK_ASSESSMENT_EDIT, to: "AWAITING_APPROVAL" },
  "request-approval": { capability: CAPABILITIES.RISK_ASSESSMENT_EDIT, to: "AWAITING_APPROVAL" },
  approve: { capability: CAPABILITIES.RISK_ASSESSMENT_APPROVE, to: "APPROVED" },
  reject: { capability: CAPABILITIES.RISK_ASSESSMENT_APPROVE, to: "DRAFT" },
  publish: { capability: CAPABILITIES.RISK_ASSESSMENT_PUBLISH, to: "PUBLISHED" },
  acknowledge: { capability: CAPABILITIES.COMPLIANCE_ACKNOWLEDGE },
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  const config = actions[action];
  if (!config) return NextResponse.json({ error: "Unsupported workflow action." }, { status: 404 });

  return withCapability(req, config.capability, async (user) => {
    try {
      if (action === "acknowledge") {
        const organisationId = requireOrganisation(user);
        const published = await prisma.complianceRecordVersion.findFirst({
          where: { recordId: id, status: "PUBLISHED", record: { organisationId } },
          orderBy: { version: "desc" },
          select: { id: true },
        });
        if (!published) return NextResponse.json({ error: "No published version is available to acknowledge." }, { status: 409 });
        return NextResponse.json(await acknowledgeVersion(user, published.id, requestContext(req)), { status: 201 });
      }

      const parsed = workflowCommentInput.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return NextResponse.json({ error: "Invalid workflow comments." }, { status: 422 });
      return NextResponse.json(await transitionVersion({ user, recordId: id, to: config.to!, comments: parsed.data.comments }));
    } catch (error) {
      const message = (error as Error).message;
      const status = (error as { status?: number }).status;
      if (message === "INVALID_COMPLIANCE_TRANSITION") return NextResponse.json({ error: "That workflow change is not valid for the current version." }, { status: 409 });
      if ((error as { code?: string }).code === "P2002") return NextResponse.json({ error: "This version has already been acknowledged." }, { status: 409 });
      return NextResponse.json({ error: status === 404 ? "Record not found." : "The workflow action could not be completed." }, { status: status || 500 });
    }
  });
}

