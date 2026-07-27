import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name.").max(80),
  lastName: z.string().trim().min(1, "Enter a surname.").max(80),
  displayName: z.string().trim().min(1, "Enter a display name.").max(120),
  startDate: z.string().date("Enter a valid start date."),
  endDate: z.string().date("Enter a valid end date.").optional().or(z.literal("")),
  expectedDays: z.array(z.number().int().min(1).max(7)).max(7),
  fundingCategory: z.string().trim().max(100).optional().or(z.literal("")),
  fundingOrganisation: z.string().trim().max(191).optional().or(z.literal("")),
  internalReference: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
}).refine(data => !data.endDate || data.endDate >= data.startDate, {
  message: "The end date cannot be before the start date.",
  path: ["endDate"],
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
  return withRole(req, "MANAGER", async user => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Please check the student details.";
      return NextResponse.json({ error: message, fields: parsed.error.flatten().fieldErrors }, { status: 422 });
    }
    const data = parsed.data;
    if (data.internalReference) {
      const duplicate = await prisma.student.findUnique({ where: { internalReference: data.internalReference }, select: { displayName: true, active: true } });
      if (duplicate) return jsonError(`Internal reference “${data.internalReference}” is already used by ${duplicate.displayName}${duplicate.active ? "" : " (archived)"}. Use a different reference or restore that student.`, 409);
    }
    try {
      const student = await prisma.student.create({ data: {
        ...data,
        endDate: data.endDate ? new Date(data.endDate) : null,
        startDate: new Date(data.startDate),
        fundingCategory: data.fundingCategory || null,
        fundingOrganisation: data.fundingOrganisation || null,
        internalReference: data.internalReference || null,
        notes: data.notes || null,
      } });
      await audit("STUDENT_CREATED", { actorType: "USER", actorId: user.id, entityType: "Student", entityId: student.id, afterValue: student, ...requestContext(req) });
      return NextResponse.json(student, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return jsonError("That internal reference is already in use. Enter a unique reference or leave it blank.", 409);
      }
      throw error;
    }
  });
}
