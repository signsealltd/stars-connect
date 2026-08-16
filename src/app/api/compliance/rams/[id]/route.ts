import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requestContext, withCapability } from "@/lib/api";
import { requireOrganisation, updateRamsDraft } from "@/lib/compliance-service";
import { ramsDraftInput } from "@/lib/compliance-input";
import { CAPABILITIES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isRamsPilotRole } from "@/lib/rams-access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  return withCapability(req, CAPABILITIES.RAMS_VIEW, async user => {
    if (!isRamsPilotRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const organisationId = requireOrganisation(user);
    const { id } = await params;
    const record = await prisma.complianceRecord.findFirst({
      where: { id, organisationId, recordType: "RAMS", archivedAt: null },
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
    return record ? NextResponse.json(record) : NextResponse.json({ error: "RAMS record not found." }, { status: 404 });
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return withCapability(req, CAPABILITIES.RAMS_EDIT, async user => {
    if (!isRamsPilotRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    if (!isRamsPilotRole(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
