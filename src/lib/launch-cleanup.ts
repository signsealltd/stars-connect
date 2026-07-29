import type { Prisma, PrismaClient } from "@prisma/client";

export const LAUNCH_CLEANUP_CONFIRMATION = "PREPARE FOR LAUNCH";

type CleanupClient = Prisma.TransactionClient | PrismaClient;

export function launchCleanupConfirmed(value: unknown) {
  return typeof value === "string" && value.trim().toUpperCase() === LAUNCH_CLEANUP_CONFIRMATION;
}

export async function clearLaunchData(tx: CleanupClient) {
  const counts = {
    staff: await tx.staffMember.count(),
    students: await tx.student.count(),
    devices: await tx.device.count(),
    visitors: await tx.visitor.count(),
    auditEntries: await tx.auditLog.count(),
    premisesAssets: await tx.premisesAsset.count(),
  };

  await tx.reportDelivery.deleteMany();
  await tx.dailyAttendanceReport.deleteMany();
  await tx.invoice.deleteMany();
  await tx.billingCharge.deleteMany();
  await tx.billingRun.deleteMany();
  await tx.chargeRule.deleteMany();
  await tx.billingProfile.deleteMany();
  await tx.payrollEntry.deleteMany();
  await tx.payrollAdjustment.deleteMany();
  await tx.payrollPeriod.deleteMany();
  await tx.documentRecord.deleteMany();
  await tx.dailySummaryEmail.deleteMany();
  await tx.mailOperation.deleteMany();
  await tx.scheduledJobRun.deleteMany();

  await tx.visitorSignature.deleteMany();
  await tx.visitorRuleAcceptance.deleteMany();
  await tx.visitorVisit.deleteMany();
  await tx.visitor.deleteMany();
  await tx.visitorReason.deleteMany();
  await tx.visitorRuleSet.deleteMany();

  await tx.emergencyRollCallEntry.deleteMany();
  await tx.emergencyRollCall.deleteMany();
  await tx.attendancePhoto.deleteMany();
  await tx.clockCorrection.deleteMany();
  await tx.clockEvent.deleteMany();
  await tx.studentAttendance.deleteMany();
  await tx.staffTrainingRecord.deleteMany();
  await tx.staffCredential.deleteMany();

  await tx.syncConflict.deleteMany();
  await tx.syncEvent.deleteMany();
  await tx.deviceProvisioningCode.deleteMany();
  await tx.device.deleteMany();

  await tx.premisesCorrectiveAction.deleteMany();
  await tx.premisesInspection.deleteMany();
  await tx.premisesDocument.deleteMany();
  await tx.premisesAsset.deleteMany();

  await tx.staffMember.deleteMany();
  await tx.student.deleteMany();
  await tx.appSetting.deleteMany();
  await tx.auditLog.deleteMany();

  return counts;
}
