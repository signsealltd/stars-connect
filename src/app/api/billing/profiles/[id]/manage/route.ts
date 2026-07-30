import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, requireCapability } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { jsonError, requestContext } from "@/lib/api";
import { localDateAsDatabaseDate } from "@/lib/dates";

const updateSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    payerType: z.string().min(1).max(40),
    payerName: z.string().min(1).max(191),
    billingAddress: z.string().min(1).max(2000),
    billingEmail: z.string().email().optional().or(z.literal("")),
    activeFrom: z.string().date(),
    vatTreatment: z.string().max(30),
    vatRate: z.number().min(0).max(100),
    rate: z.number().nonnegative(),
    reason: z.string().trim().min(5).max(1000),
  }),
  z.object({
    action: z.literal("end"),
    activeTo: z.string().date(),
    reason: z.string().trim().min(5).max(1000),
  }),
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCapability(CAPABILITIES.BILLING_APPROVE);
  const { id } = await params;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the billing change and provide a reason of at least five characters.", 422);
  const before = await prisma.billingProfile.findUnique({ where: { id }, include: { chargeRules: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!before) return jsonError("Billing profile not found.", 404);
  const data = parsed.data;
  const result = await prisma.$transaction(async tx => {
    if (data.action === "end") {
      await tx.chargeRule.updateMany({ where: { billingProfileId: id, active: true }, data: { activeTo: localDateAsDatabaseDate(data.activeTo) } });
      return tx.billingProfile.update({ where: { id }, data: { activeTo: localDateAsDatabaseDate(data.activeTo) }, include: { chargeRules: true } });
    }
    const activeFrom = localDateAsDatabaseDate(data.activeFrom);
    await tx.billingProfile.update({ where: { id }, data: {
      payerType: data.payerType, payerName: data.payerName, billingAddress: data.billingAddress,
      billingEmail: data.billingEmail || null, activeFrom, vatTreatment: data.vatTreatment,
      vatRate: new Prisma.Decimal(data.vatRate),
    } });
    const rule = before.chargeRules[0];
    if (rule) await tx.chargeRule.update({ where: { id: rule.id }, data: {
      rate: new Prisma.Decimal(data.rate), activeFrom, activeTo: null, active: true,
      attendanceDependency: "ATTENDED", applicableWeekdays: [1, 2, 3, 4, 5],
      vatTreatment: data.vatTreatment, vatRate: new Prisma.Decimal(data.vatRate),
    } });
    else await tx.chargeRule.create({ data: {
      billingProfileId: id, chargeType: "FULL_DAY", description: "Attended day", unitType: "DAY",
      rate: new Prisma.Decimal(data.rate), attendanceDependency: "ATTENDED",
      applicableWeekdays: [1, 2, 3, 4, 5], activeFrom,
      vatTreatment: data.vatTreatment, vatRate: new Prisma.Decimal(data.vatRate),
    } });
    return tx.billingProfile.findUniqueOrThrow({ where: { id }, include: { chargeRules: true } });
  });
  await audit(data.action === "end" ? "BILLING_PROFILE_ENDED" : "BILLING_PROFILE_CHANGED", {
    actorType: "USER", actorId: user.id, entityType: "BillingProfile", entityId: id,
    beforeValue: { payerName: before.payerName, activeTo: before.activeTo },
    afterValue: { action: data.action, reason: data.reason },
    ...requestContext(req),
  });
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCapability(CAPABILITIES.BILLING_APPROVE);
  const { id } = await params;
  const parsed = z.object({ reason: z.string().trim().min(5).max(1000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Provide a reason of at least five characters.", 422);
  const profile = await prisma.billingProfile.findUnique({ where: { id }, include: { chargeRules: true } });
  if (!profile) return jsonError("Billing profile not found.", 404);
  const [chargeCount, invoiceCount] = await Promise.all([
    prisma.billingCharge.count({ where: { billingProfileId: id } }),
    prisma.invoice.count({ where: { billingProfileId: id } }),
  ]);
  if (chargeCount || invoiceCount) {
    return jsonError("This profile is part of financial history and cannot be deleted. End it instead.", 409);
  }
  await prisma.billingProfile.delete({ where: { id } });
  await audit("BILLING_PROFILE_DELETED", {
    actorType: "USER", actorId: user.id, entityType: "BillingProfile", entityId: id,
    beforeValue: { studentId: profile.studentId, payerName: profile.payerName, ruleCount: profile.chargeRules.length },
    afterValue: { reason: parsed.data.reason },
    ...requestContext(req),
  });
  return NextResponse.json({ deleted: true });
}
