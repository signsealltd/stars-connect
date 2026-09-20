import {needsPurchaseOrder} from "@/lib/funded-days";
import bcrypt from "bcryptjs";
import { formatInTimeZone } from "date-fns-tz";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";
import { getBillingSettings } from "@/lib/billing-settings";
import { APP_TIME_ZONE, localDateAsDatabaseDate } from "@/lib/dates";
import { storeDocument } from "@/lib/documents";
import { loadInvoiceLogo, safeDocumentName } from "@/lib/invoice-logo";
import { invoicePdf } from "@/lib/invoice-pdf";
import { CAPABILITIES, requireCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { studentFullName } from "@/lib/student-name";

const schema = z.object({
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  descriptionFrom: z.string().trim().min(2).max(191).optional(),
  descriptionTo: z.string().trim().min(2).max(191).optional(),
  showPeriodAsAttendance: z.boolean().optional().default(false),
  reason: z.string().trim().min(5).max(1000),
  password: z.string().min(1).max(200),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCapability(CAPABILITIES.BILLING_APPROVE);
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter valid dates, a correction reason and your password." }, { status: 422 });
  if (!await bcrypt.compare(parsed.data.password, actor.passwordHash)) return NextResponse.json({ error: "Your password was not accepted." }, { status: 401 });

  const periodStart = localDateAsDatabaseDate(parsed.data.periodStart);
  const periodEnd = localDateAsDatabaseDate(parsed.data.periodEnd);
  if (periodEnd < periodStart) return NextResponse.json({ error: "The end date cannot be before the start date." }, { status: 422 });

  const run = await prisma.billingRun.findUnique({ where: { id }, include: { charges: true, invoices: true } });
  if (!run) return NextResponse.json({ error: "Billing run not found." }, { status: 404 });
  if (run.status !== "INVOICES_GENERATED" || !run.invoices.length) return NextResponse.json({ error: "Only a completed billing run with generated invoices can be corrected here." }, { status: 409 });
  const datesChanged = run.periodStart.getTime() !== periodStart.getTime() || run.periodEnd.getTime() !== periodEnd.getTime();
  const descriptionsProvided = Boolean(parsed.data.descriptionFrom || parsed.data.descriptionTo);
  if (descriptionsProvided && (!parsed.data.descriptionFrom || !parsed.data.descriptionTo)) return NextResponse.json({ error: "Choose the existing service wording and enter its replacement." }, { status: 422 });
  const descriptionChanged = Boolean(parsed.data.descriptionFrom && parsed.data.descriptionTo && parsed.data.descriptionFrom !== parsed.data.descriptionTo);
  if (!datesChanged && !descriptionChanged && !parsed.data.showPeriodAsAttendance) return NextResponse.json({ error: "The invoice dates, attendance display and service wording are unchanged." }, { status: 422 });
  const matchingChargeIds = descriptionChanged ? run.charges.filter(charge => !charge.excluded && charge.description === parsed.data.descriptionFrom).map(charge => charge.id) : [];
  if (descriptionChanged && !matchingChargeIds.length) return NextResponse.json({ error: "No included invoice lines use that service wording." }, { status: 422 });

  const conflicting = datesChanged ? await prisma.billingRun.findFirst({ where: { id: { not: id }, periodStart, periodEnd, version: run.version + 1 }, select: { id: true } }) : null;
  if (conflicting) return NextResponse.json({ error: "A billing run already uses these corrected dates and version. Contact an administrator before continuing." }, { status: 409 });

  const settings = await getBillingSettings();
  const logoJpeg = await loadInvoiceLogo(settings.invoiceLogoUrl);
  const profiles = await prisma.billingProfile.findMany({ where: { id: { in: run.invoices.map(invoice => invoice.billingProfileId) } } });
  if(profiles.some(profile=>needsPurchaseOrder(profile.payerName)&&!profile.purchaseOrderNumber?.trim()))return NextResponse.json({error:"Add client PO numbers to the billing profiles before correcting invoices."},{status:422});
  const studentIds = run.invoices.map(invoice => invoice.studentId).filter((value): value is string => Boolean(value));
  const students = await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true, displayName: true, internalReference: true } });
  const previousDocuments = await prisma.documentRecord.findMany({ where: { id: { in: run.invoices.map(invoice => invoice.documentId).filter((value): value is string => Boolean(value)) } } });
  if (previousDocuments.length !== run.invoices.length) return NextResponse.json({ error: "One or more original invoice documents are unavailable, so the correction was stopped safely." }, { status: 409 });

  const correctedDocuments: Array<{ invoiceId: string; newDocumentId: string; oldDocumentId: string }> = [];
  for (const invoice of run.invoices) {
    const profile = profiles.find(item => item.id === invoice.billingProfileId);
    const student = students.find(item => item.id === invoice.studentId);
    const oldDocument = previousDocuments.find(item => item.id === invoice.documentId);
    const charges = run.charges.filter(charge => !charge.excluded && !charge.exceptionCode && charge.billingProfileId === invoice.billingProfileId && charge.studentId === invoice.studentId);
    if (!profile || !student || !oldDocument || !charges.length) return NextResponse.json({ error: `Invoice ${invoice.invoiceNumber} could not be reconstructed, so no live records were changed.` }, { status: 409 });
    const nextDocumentVersion = oldDocument.version + 1;
    const content = invoicePdf({
      logoJpeg,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: formatInTimeZone(invoice.invoiceDate, APP_TIME_ZONE, "dd MMMM yyyy"),
      dueDate: formatInTimeZone(invoice.dueDate, APP_TIME_ZONE, "dd MMMM yyyy"),
      periodLabel: `${formatInTimeZone(periodStart, APP_TIME_ZONE, "dd MMM yyyy")} - ${formatInTimeZone(periodEnd, APP_TIME_ZONE, "dd MMM yyyy")}`,
      supplierName: settings.organisationLegalName,
      supplierAddress: settings.organisationAddress.split(/\r?\n/),
      companyNumber: settings.companyNumber,
      vatNumber: settings.vatNumber,
      payerName: profile.payerName,
      payerAddress: profile.billingAddress.split(/\r?\n/),
      studentName: studentFullName(student),
      studentReference: student.internalReference || "Not supplied",
      purchaseOrderNumber: invoice.purchaseOrderNumber||profile.purchaseOrderNumber||undefined,
      rows: charges.sort((a, b) => a.sourceDate.getTime() - b.sourceDate.getTime()).map(charge => ({
        date: parsed.data.showPeriodAsAttendance
          ? `${formatInTimeZone(periodStart, APP_TIME_ZONE, "d MMMM yyyy")} - ${formatInTimeZone(periodEnd, APP_TIME_ZONE, "d MMMM yyyy")}`
          : formatInTimeZone(charge.sourceDate, APP_TIME_ZONE, "dd/MM/yyyy"),
        service: matchingChargeIds.includes(charge.id) ? parsed.data.descriptionTo! : charge.description,
        days: Number(charge.quantity).toFixed(2), rate: `GBP ${Number(charge.unitRate).toFixed(2)}`,
        net: `GBP ${Number(charge.netAmount).toFixed(2)}`, vat: `GBP ${Number(charge.vatAmount).toFixed(2)}`,
        total: `GBP ${Number(charge.grossAmount).toFixed(2)}`,
      })),
      attendanceDays: charges.reduce((sum, charge) => sum + Number(charge.quantity), 0).toFixed(2),
      dayRate: new Set(charges.map(charge => Number(charge.unitRate).toFixed(2))).size === 1 ? `GBP ${Number(charges[0].unitRate).toFixed(2)}` : "Varied",
      netTotal: `GBP ${Number(invoice.netTotal).toFixed(2)}`, vatTotal: `GBP ${Number(invoice.vatTotal).toFixed(2)}`, grossTotal: `GBP ${Number(invoice.grossTotal).toFixed(2)}`,
      paymentTerms: `${settings.defaultPaymentTerms} Payment terms: ${profile.paymentTermsDays} days.`,
      bankDetails: settings.bankDetails.split(/\r?\n/), remittanceInstructions: settings.remittanceInstructions.split(/\r?\n/),
      approvedAt: run.approvedAt ? formatInTimeZone(run.approvedAt, APP_TIME_ZONE, "dd MMMM yyyy HH:mm") : "Not recorded",
      generatedAt: formatInTimeZone(new Date(), APP_TIME_ZONE, "dd MMMM yyyy HH:mm"),
    });
    const document = await storeDocument({
      documentNumber: `${invoice.invoiceNumber}-${safeDocumentName(studentFullName(student))}-${safeDocumentName(student.internalReference || "No-reference")}`,
      documentType: "INVOICE",
      periodStart,
      periodEnd,
      version: nextDocumentVersion,
      createdById: actor.id,
      approvedById: run.approvedById || undefined,
      approvedAt: run.approvedAt || undefined,
      generationSource: "ADMINISTRATOR",
      sourceType: "Invoice",
      sourceId: invoice.id,
      revisionReason: parsed.data.reason,
      mimeType: "application/pdf",
      content,
    });
    correctedDocuments.push({ invoiceId: invoice.id, newDocumentId: document.id, oldDocumentId: oldDocument.id });
  }

  await prisma.$transaction(async tx => {
    await tx.documentRecord.updateMany({ where: { sourceType: "BillingRun", sourceId: id, documentType: { in: ["INVOICE_ZIP", "INVOICE_REGISTER_CSV"] } }, data: { status: "SUPERSEDED" } });
    for (const corrected of correctedDocuments) {
      await tx.documentRecord.update({ where: { id: corrected.oldDocumentId }, data: { status: "SUPERSEDED" } });
      await tx.documentRecord.update({ where: { id: corrected.newDocumentId }, data: { supersededDocumentId: corrected.oldDocumentId } });
      await tx.invoice.update({ where: { id: corrected.invoiceId }, data: { documentId: corrected.newDocumentId, version: { increment: 1 } } });
    }
    if (matchingChargeIds.length) await tx.billingCharge.updateMany({ where: { id: { in: matchingChargeIds } }, data: { description: parsed.data.descriptionTo } });
    await tx.billingRun.update({ where: { id }, data: { periodStart, periodEnd, version: { increment: 1 }, revisionReason: parsed.data.reason } });
  });
  await audit("BILLING_INVOICES_CORRECTED", {
    actorType: "USER", actorId: actor.id, entityType: "BillingRun", entityId: id,
    beforeValue: { periodStart: run.periodStart.toISOString().slice(0, 10), periodEnd: run.periodEnd.toISOString().slice(0, 10), serviceDescription: parsed.data.descriptionFrom, version: run.version },
    afterValue: { periodStart: parsed.data.periodStart, periodEnd: parsed.data.periodEnd, attendanceDisplay: parsed.data.showPeriodAsAttendance ? "BILLING_PERIOD" : "SERVICE_DATE", serviceDescription: parsed.data.descriptionTo, correctedLines: matchingChargeIds.length, version: run.version + 1, invoiceCount: correctedDocuments.length, reason: parsed.data.reason },
    ...requestContext(req),
  });
  return NextResponse.json({ ok: true, invoiceCount: correctedDocuments.length });
}
