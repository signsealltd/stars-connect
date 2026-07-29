import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
import { directorRoles, emergencyContactFields, inlineBillingSchema, nullableEmergencyContacts, optionalBillingProfileIdSchema, studentValidationMessage } from "@/lib/student-management";
import { createInlineBillingProfile, updateInlineBillingProfile } from "@/lib/billing-profile-management";

const schema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional().or(z.literal("")),
  expectedDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
  fundingCategory: z.string().trim().max(100).optional().or(z.literal("")),
  fundingOrganisation: z.string().trim().max(191).optional().or(z.literal("")),
  internalReference: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  ...emergencyContactFields,
  active: z.boolean().optional(),
  billing: inlineBillingSchema.extend({ profileId: optionalBillingProfileIdSchema }).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRole(req, "MANAGER", async user => {
    const { id } = await params;
    const before = await prisma.student.findUnique({ where: { id } });
    if (!before) return jsonError("Student not found.", 404);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(studentValidationMessage(parsed.error), 422);
    const { billing, ...input } = parsed.data;
    if (billing?.enabled && !directorRoles.has(user.role)) return jsonError("Only a director or administrator can configure billing.", 403);
    try {
      const result = await prisma.$transaction(async tx => {
        const data = nullableEmergencyContacts(input);
        const student = await tx.student.update({ where: { id }, data: {
          ...data,
          ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate ? new Date(input.endDate) : null } : {}),
          ...(input.fundingCategory !== undefined ? { fundingCategory: input.fundingCategory || null } : {}),
          ...(input.fundingOrganisation !== undefined ? { fundingOrganisation: input.fundingOrganisation || null } : {}),
          ...(input.internalReference !== undefined ? { internalReference: input.internalReference || null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
          ...(input.active === false ? { archivedAt: new Date() } : input.active === true ? { archivedAt: null } : {}),
        } });
        let profile = null;
        if (billing?.enabled) {
          profile = billing.profileId
            ? await updateInlineBillingProfile(tx, billing.profileId, id, billing, input.expectedDays || (before.expectedDays as number[]))
            : await createInlineBillingProfile(tx, id, user.id, billing, input.expectedDays || (before.expectedDays as number[]));
        }
        return { student, billingProfile: profile };
      });
      const action = before.active !== result.student.active ? (result.student.active ? "STUDENT_RESTORED" : "STUDENT_ARCHIVED") : "STUDENT_UPDATED";
      await audit(action, { actorType: "USER", actorId: user.id, entityType: "Student", entityId: id, afterValue: { displayName: result.student.displayName, emergencyContactConfigured: Boolean(result.student.emergencyContactName) }, ...requestContext(req) });
      if (result.billingProfile) await audit("BILLING_PROFILE_CHANGED", { actorType: "USER", actorId: user.id, entityType: "BillingProfile", entityId: result.billingProfile.id, afterValue: { studentId: id, source: "STUDENT_FORM" }, ...requestContext(req) });
      return NextResponse.json({ ...result.student, billingProfile: result.billingProfile });
    } catch (error) {
      if (error instanceof Error && error.message === "ACTIVE_BILLING_PROFILE_EXISTS") return jsonError("This student already has an active billing profile. Edit that profile instead.", 409);
      if (error instanceof Error && error.message === "BILLING_PROFILE_NOT_FOUND") return jsonError("The billing profile could not be found.", 404);
      throw error;
    }
  });
}
