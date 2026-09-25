import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requestContext, withCapability } from "@/lib/api";
import { requireOrganisation, updateRamsDraft } from "@/lib/compliance-service";
import { ramsDraftInput } from "@/lib/compliance-input";
import { CAPABILITIES,hasCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";


type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  return withCapability(req, CAPABILITIES.RAMS_VIEW, async user => {

    const organisationId = requireOrganisation(user);
    const { id } = await params;
    const record = await prisma.complianceRecord.findFirst({
      where: { id, organisationId, recordType: "RAMS" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          include: {
            hazards: { orderBy: { sortOrder: "asc" } },
            methodSteps: { orderBy: { stepNumber: "asc" } },
            checklistItems: { orderBy: { sortOrder: "asc" } },
            approvals: { orderBy: { createdAt: "desc" } },
            acknowledgements: true,
            attachments: { select: { id: true, originalName: true, mimeType: true, fileSize: true, createdAt: true } },
          },
        },
      },
    });
    const people=record?await prisma.user.findMany({where:{organisationId},select:{id:true,name:true}}):[];const acceptanceIds=record?.versions.flatMap(v=>{const c=v.structuredContent as Record<string,unknown>|null;return Array.isArray(c?.cliveAcceptances)?c.cliveAcceptances.filter((x):x is string=>typeof x==="string"):[]})||[];const accepted=acceptanceIds.length?await prisma.auditLog.findMany({where:{id:{in:acceptanceIds},action:"CLIVE_SUGGESTION_ACCEPTED",actorId:{in:people.map(p=>p.id)}},select:{id:true,actorId:true,createdAt:true}}):[];return record ? NextResponse.json({...record,people,accepted,versions:record.versions.map(v=>({...v,acknowledgements:hasCapability(user.role,CAPABILITIES.COMPLIANCE_REPORTS_VIEW,user.permissionOverrides)?v.acknowledgements:[]}))}) : NextResponse.json({ error: "RAMS record not found." }, { status: 404 });
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return withCapability(req, CAPABILITIES.RAMS_EDIT, async user => {

    const { id } = await params;
    const parsed = ramsDraftInput.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Check the RAMS details.", fields: parsed.error.flatten().fieldErrors }, { status: 422 });
    try {
      return NextResponse.json(await updateRamsDraft(user, id, parsed.data));
    } catch (error) {
      const status = (error as { status?: number }).status || 500;
      return NextResponse.json({ error: (error as Error).message === "IMMUTABLE_VERSION" ? "Approved and published versions are immutable. Create a revision instead." : "RAMS update failed." }, { status });
    }
  });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  return withCapability(req, CAPABILITIES.RAMS_EDIT, async user => {

    const body = await req.json().catch(() => null) as { password?: unknown } | null;
    if (!body?.password || !await bcrypt.compare(String(body.password), user.passwordHash)) {
      return NextResponse.json({ error: "Your password was not accepted." }, { status: 401 });
    }
    const organisationId = requireOrganisation(user);
    const { id } = await params;
    const record = await prisma.complianceRecord.findFirst({
      where: { id, organisationId, recordType: "RAMS", archivedAt: null },
      include: { versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, status: true, title: true } } },
    });
    if (!record) return NextResponse.json({ error: "RAMS record not found." }, { status: 404 });
    const archivedAt = new Date();
    await prisma.complianceRecord.update({ where: { id: record.id }, data: { archivedAt } });
    await audit("RAMS_RECORD_ARCHIVED", {
      actorType: "USER",
      actorId: user.id,
      entityType: "ComplianceRecord",
      entityId: record.id,
      beforeValue: { organisationId, reference: record.reference, latestVersion: record.versions[0] ?? null },
      afterValue: { archivedAt: archivedAt.toISOString(), versionsRetained: true },
      ...requestContext(req),
    });
    return NextResponse.json({ ok: true });
  });
}
