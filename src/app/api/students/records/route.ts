import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
import { directorRoles, emergencyContactFields, inlineBillingSchema, nullableEmergencyContacts, studentValidationMessage } from "@/lib/student-management";
import { createInlineBillingProfile } from "@/lib/billing-profile-management";

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
  ...emergencyContactFields,
  billing: inlineBillingSchema.extend({ profileId: z.string().uuid().optional() }).optional(),
}).refine(data => !data.endDate || data.endDate >= data.startDate, {
  message: "The end date cannot be before the start date.",
  path: ["endDate"],
});

const publicAuditValue = (student: { displayName: string; internalReference: string | null; active: boolean }) => ({
  displayName: student.displayName,
  internalReference: student.internalReference,
  active: student.active,
  emergencyContactConfigured: true,
});

export async function GET(req: NextRequest) {
  return withRole(req, "MANAGER", async user => {
    const status = req.nextUrl.searchParams.get("status") || "active";
    const search = req.nextUrl.searchParams.get("search")?.trim();
    const students = await prisma.student.findMany({
      where: {
        ...(status === "active" ? { active: true } : status === "archived" ? { active: false } : {}),
        ...(search ? { OR: [{ displayName: { contains: search } }, { internalReference: { contains: search } }] } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    });
    if (!directorRoles.has(user.role) || !students.length) return NextResponse.json(students);
    const profiles = await prisma.billingProfile.findMany({
      where: { studentId: { in: students.map(student => student.id) } },
      include: { chargeRules: { where: { active: true }, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(students.map(student => ({
      ...student,
      billingProfile: profiles.find(profile => profile.studentId === student.id && !profile.activeTo) || null,
    })));
  });
}

export async function POST(req: NextRequest) {
  return withRole(req, "MANAGER", async user => {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: studentValidationMessage(parsed.error), fields: parsed.error.flatten().fieldErrors }, { status: 422 });
    const { billing, ...input } = parsed.data;
    if (billing?.enabled && !directorRoles.has(user.role)) return jsonError("Only a director or administrator can configure billing.", 403);
    try {
      const result = await prisma.$transaction(async tx => {
        const data = nullableEmergencyContacts(input);
        const student = await tx.student.create({ data: {
          ...data,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : null,
          fundingCategory: input.fundingCategory || null,
          fundingOrganisation: input.fundingOrganisation || null,
          internalReference: input.internalReference || null,
          notes: input.notes || null,
        } });
        const profile = billing?.enabled ? await createInlineBillingProfile(tx, student.id, user.id, billing, input.expectedDays) : null;
        return { student, billingProfile: profile };
      });
      await audit("STUDENT_CREATED", { actorType: "USER", actorId: user.id, entityType: "Student", entityId: result.student.id, afterValue: publicAuditValue(result.student), ...requestContext(req) });
      if (result.billingProfile) await audit("BILLING_PROFILE_CREATED", { actorType: "USER", actorId: user.id, entityType: "BillingProfile", entityId: result.billingProfile.id, afterValue: { studentId: result.student.id, source: "STUDENT_FORM" }, ...requestContext(req) });
      return NextResponse.json({ ...result.student, billingProfile: result.billingProfile }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === "ACTIVE_BILLING_PROFILE_EXISTS") return jsonError("This student already has an active billing profile. Edit that profile instead.", 409);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return jsonError("That internal reference is already in use.", 409);
      throw error;
    }
  });
}
