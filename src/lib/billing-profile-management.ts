import { Prisma } from "@prisma/client";
import { localDateAsDatabaseDate } from "./dates";
import type { z } from "zod";
import { inlineBillingSchema } from "./student-management";

export type InlineBilling = z.infer<typeof inlineBillingSchema>;

export async function createInlineBillingProfile(
  tx: Prisma.TransactionClient,
  studentId: string,
  userId: string,
  billing: InlineBilling,
  expectedDays: number[],
) {
  const active = await tx.billingProfile.findFirst({ where: { studentId, activeTo: null }, select: { id: true } });
  if (active) throw new Error("ACTIVE_BILLING_PROFILE_EXISTS");
  const activeFrom = localDateAsDatabaseDate(billing.activeFrom);
  return tx.billingProfile.create({
    data: {
      studentId,
      payerType: billing.payerType,
      payerName: billing.payerName,
      billingAddress: billing.billingAddress,
      billingEmail: billing.billingEmail || null,
      activeFrom,
      vatTreatment: billing.vatTreatment,
      vatRate: new Prisma.Decimal(billing.vatRate),
      createdById: userId,
      chargeRules: {
        create: {
          chargeType: "FULL_DAY",
          description: "Attended day",
          unitType: "DAY",
          rate: new Prisma.Decimal(billing.rate),
          attendanceDependency: "ATTENDED",
          applicableWeekdays: expectedDays.length ? expectedDays : [1, 2, 3, 4, 5],
          activeFrom,
          vatTreatment: billing.vatTreatment,
          vatRate: new Prisma.Decimal(billing.vatRate),
        },
      },
    },
    include: { chargeRules: true },
  });
}

export async function updateInlineBillingProfile(
  tx: Prisma.TransactionClient,
  profileId: string,
  studentId: string,
  billing: InlineBilling,
  expectedDays: number[],
) {
  const existing = await tx.billingProfile.findFirst({
    where: { id: profileId, studentId },
    include: { chargeRules: { where: { active: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!existing) throw new Error("BILLING_PROFILE_NOT_FOUND");
  const activeFrom = localDateAsDatabaseDate(billing.activeFrom);
  await tx.billingProfile.update({
    where: { id: profileId },
    data: {
      payerType: billing.payerType,
      payerName: billing.payerName,
      billingAddress: billing.billingAddress,
      billingEmail: billing.billingEmail || null,
      activeFrom,
      vatTreatment: billing.vatTreatment,
      vatRate: new Prisma.Decimal(billing.vatRate),
    },
  });
  const rule = existing.chargeRules[0];
  if (rule) {
    await tx.chargeRule.update({
      where: { id: rule.id },
      data: {
        rate: new Prisma.Decimal(billing.rate),
        applicableWeekdays: expectedDays.length ? expectedDays : [1, 2, 3, 4, 5],
        activeFrom,
        vatTreatment: billing.vatTreatment,
        vatRate: new Prisma.Decimal(billing.vatRate),
      },
    });
  }
  return tx.billingProfile.findUniqueOrThrow({ where: { id: profileId }, include: { chargeRules: true } });
}
