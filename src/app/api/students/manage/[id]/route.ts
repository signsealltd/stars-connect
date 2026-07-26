import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().nullable().optional().or(z.literal("")),
  expectedDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  fundingCategory: z.string().trim().max(100).nullable().optional().or(z.literal("")),
  fundingOrganisation: z.string().trim().max(191).nullable().optional().or(z.literal("")),
  internalReference: z.string().trim().max(100).nullable().optional().or(z.literal("")),
  notes: z.string().trim().max(5000).nullable().optional().or(z.literal("")),
  active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  return withRole(req, "MANAGER", async () => {
    const { id } = await params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: { attendance: { orderBy: { date: "desc" }, take: 60, include: { device: { select: { name: true } } } } },
    });
    return student ? NextResponse.json(student) : jsonError("Student not found.", 404);
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withRole(req, "MANAGER", async (user) => {
    const { id } = await params;
    const before = await prisma.student.findUnique({ where: { id } });
    if (!before) return jsonError("Student not found.", 404);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Please check the student details.", 422);
    const d = parsed.data;
    const after = await prisma.student.update({ where: { id }, data: {
      ...d,
      ...(d.startDate ? { startDate: new Date(d.startDate) } : {}),
      ...(d.endDate !== undefined ? { endDate: d.endDate ? new Date(d.endDate) : null } : {}),
      ...(d.fundingCategory !== undefined ? { fundingCategory: d.fundingCategory || null } : {}),
      ...(d.fundingOrganisation !== undefined ? { fundingOrganisation: d.fundingOrganisation || null } : {}),
      ...(d.internalReference !== undefined ? { internalReference: d.internalReference || null } : {}),
      ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
      ...(d.active === false ? { archivedAt: new Date() } : d.active === true ? { archivedAt: null } : {}),
    } });
    const action = before.active !== after.active ? (after.active ? "STUDENT_RESTORED" : "STUDENT_ARCHIVED") : "STUDENT_UPDATED";
    await audit(action, { actorType: "USER", actorId: user.id, entityType: "Student", entityId: id, beforeValue: before, afterValue: after, ...requestContext(req) });
    return NextResponse.json(after);
  });
}
