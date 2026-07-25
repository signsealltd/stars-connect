import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(120),
  startDate: z.string().date(),
  endDate: z.string().date().optional().or(z.literal("")),
  expectedDays: z.array(z.number().int().min(1).max(7)).max(7),
  fundingCategory: z.string().trim().max(100).optional().or(z.literal("")),
  fundingOrganisation: z.string().trim().max(191).optional().or(z.literal("")),
  internalReference: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
});

export async function GET(req: NextRequest) {
  return withRole(req, "MANAGER", async () => {
    const status = req.nextUrl.searchParams.get("status") || "active";
    const search = req.nextUrl.searchParams.get("search")?.trim();
    const rows = await prisma.student.findMany({
      where: {
        ...(status === "active" ? { active: true } : status === "archived" ? { active: false } : {}),
        ...(search ? { OR: [{ displayName: { contains: search } }, { internalReference: { contains: search } }] } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    });
    return NextResponse.json(rows);
  });
}

export async function POST(req: NextRequest) {
  return withRole(req, "MANAGER", async (user) => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Please check the student details.", 422);
    const d = parsed.data;
    const student = await prisma.student.create({ data: {
      ...d,
      endDate: d.endDate ? new Date(d.endDate) : null,
      startDate: new Date(d.startDate),
      fundingCategory: d.fundingCategory || null,
      fundingOrganisation: d.fundingOrganisation || null,
      internalReference: d.internalReference || null,
      notes: d.notes || null,
    } });
    await audit("STUDENT_CREATED", { actorType: "USER", actorId: user.id, entityType: "Student", entityId: student.id, afterValue: student, ...requestContext(req) });
    return NextResponse.json(student, { status: 201 });
  });
}
