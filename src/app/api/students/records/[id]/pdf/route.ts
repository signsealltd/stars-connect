import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCapability, requestContext } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { formatUkDate, formatUkDateTime } from "@/lib/dates";
import { loadInvoiceLogo, safeDocumentName } from "@/lib/invoice-logo";
import { getOrganisationSettings } from "@/lib/organisation-settings";
import { studentRecordPdf, type StudentRecordPdfRow, type StudentRecordPdfSection } from "@/lib/student-record-pdf";

const dayNames: Record<number, string> = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday" };
const recorded = (value: unknown) => value === null || value === undefined || value === "" ? "Not recorded" : String(value);
const yesNo = (value: boolean) => value ? "Yes" : "No";
const date = (value?: Date | null) => value ? formatUkDate(value) : "Not recorded";
const dateTime = (value?: Date | null) => value ? formatUkDateTime(value) : "Not recorded";
const title = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, character => character.toUpperCase());

function readable(value: unknown, prefix = ""): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => readable(item, `${prefix}${prefix ? " " : ""}${index + 1}`));
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => readable(item, `${prefix}${prefix ? " - " : ""}${title(key)}`));
  const display = typeof value === "boolean" ? yesNo(value) : String(value);
  return [`${prefix ? `${prefix}: ` : ""}${display}`];
}

const jsonRow = (label: string, value: unknown): StudentRecordPdfRow => ({ label, value: readable(value).join("\n") || "Not recorded" });

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCapability(req, CAPABILITIES.DOCUMENT_DOWNLOAD, async user => {
    const { id } = await params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        attendance: { orderBy: { date: "desc" } },
        consentHistory: { orderBy: { createdAt: "desc" } },
        informationReviews: {
          where: user.organisationId ? { organisationId: user.organisationId } : undefined,
          orderBy: { createdAt: "desc" },
          include: { submissions: { orderBy: { version: "desc" }, take: 1 } },
        },
        operationAttendances: {
          where: user.organisationId ? { organisationId: user.organisationId } : undefined,
          orderBy: { occurrence: { startAt: "desc" } },
          include: { occurrence: { include: { operation: true } } },
        },
      },
    });
    if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });

    const billingProfiles = await prisma.billingProfile.findMany({
      where: { studentId: student.id },
      include: { chargeRules: { orderBy: { createdAt: "desc" } } },
      orderBy: { activeFrom: "desc" },
    });
    const organisation = await getOrganisationSettings();
    const active = student.active && !student.archivedAt;
    const sections: StudentRecordPdfSection[] = [
      { title: "Student details", rows: [
        { label: "Legal name", value: `${student.firstName} ${student.lastName}`.trim() },
        { label: "Display name", value: student.displayName },
        { label: "Student reference", value: recorded(student.internalReference) },
        { label: "Date of birth", value: date(student.dateOfBirth) },
        { label: "Status", value: active ? "Active" : "Archived" },
        { label: "Start date", value: date(student.startDate) },
        { label: "End date", value: date(student.endDate) },
        { label: "Expected days", value: Array.isArray(student.expectedDays) ? student.expectedDays.map(Number).map(day => dayNames[day] || String(day)).join(", ") || "None" : "None" },
        { label: "Last reviewed", value: date(student.lastInformationReviewAt) },
        { label: "Next review due", value: date(student.nextInformationReviewAt) },
      ] },
      { title: "Contact details", rows: [
        { label: "Address", value: [student.addressLine1, student.addressLine2, student.town, student.postcode].filter(Boolean).join("\n") || "Not recorded" },
        { label: "Telephone", value: recorded(student.phone) },
        { label: "Email", value: recorded(student.email) },
      ] },
      { title: "Emergency contacts", rows: [
        { label: "Primary contact", value: [student.emergencyContactName, student.emergencyContactRelationship, student.emergencyContactPhone, student.emergencyContactAlternativePhone, student.emergencyContactEmail].filter(Boolean).join("\n") || "Not recorded" },
        { label: "Primary contact notes", value: recorded(student.emergencyContactNotes) },
        jsonRow("Secondary contact", student.secondaryEmergencyContact),
      ] },
      { title: "Health and medical", rows: [
        { label: "NHS number", value: recorded(student.nhsNumber) },
        { label: "Hospital number", value: recorded(student.hospitalNumber) },
        { label: "GP", value: [student.gpName, student.gpSurgery, student.gpPhone].filter(Boolean).join("\n") || "Not recorded" },
        jsonRow("Medical profile", student.medicalProfile),
      ] },
      { title: "Person-centred profile", rows: [jsonRow("Current profile", student.personCentredProfile), { label: "Restricted notes", value: recorded(student.notes) }] },
      { title: "Consent history", rows: student.consentHistory.length ? student.consentHistory.map(item => ({
        label: `${title(item.consentType)} - ${dateTime(item.providedAt)}`,
        value: `${readable(item.newValue).join("; ") || "Not recorded"}\nProvided by ${item.providedByName}${item.approvedAt ? `; approved ${dateTime(item.approvedAt)}` : ""}`,
      })) : [{ label: "Consent", value: "No consent history recorded" }] },
      { title: "Billing records", rows: billingProfiles.length ? billingProfiles.flatMap((profile, index) => [
        { label: `Profile ${index + 1}`, value: `${profile.payerName} (${title(profile.payerType)})\n${profile.billingAddress}\nEmail: ${recorded(profile.billingEmail)}\nTelephone: ${recorded(profile.contactTelephone)}\nActive ${date(profile.activeFrom)} to ${date(profile.activeTo)}\nInvoice frequency: ${title(profile.invoiceFrequency)}; payment terms: ${profile.paymentTermsDays} days; VAT: ${profile.vatRate}%` },
        ...profile.chargeRules.map(rule => ({ label: "Charge rule", value: `${rule.description}\n${title(rule.unitType)} at GBP ${rule.rate}; ${title(rule.attendanceDependency)}; ${rule.active ? "active" : "inactive"}` })),
      ]) : [{ label: "Billing", value: "No billing profile recorded" }] },
      { title: `Attendance history (${student.attendance.length} records)`, rows: student.attendance.length ? student.attendance.map(item => ({
        label: date(item.date),
        value: `${title(item.status)}; arrival ${item.arrivalTime ? formatUkDateTime(item.arrivalTime) : "not recorded"}; departure ${item.departureTime ? formatUkDateTime(item.departureTime) : "not recorded"}${item.note ? `; note: ${item.note}` : ""}`,
      })) : [{ label: "Attendance", value: "No attendance records" }] },
      { title: `Information review history (${student.informationReviews.length} records)`, rows: student.informationReviews.length ? student.informationReviews.map(review => {
        const submission = review.submissions[0];
        return { label: `${title(review.status)} - ${dateTime(review.createdAt)}`, value: `Opened: ${dateTime(review.openedAt)}; submitted: ${dateTime(review.submittedAt)}; completed: ${dateTime(review.completedAt)}${submission ? `\nDeclared by ${submission.declarationName} (${submission.declarationCapacity}) on ${dateTime(submission.declaredAt)}` : ""}` };
      }) : [{ label: "Reviews", value: "No information reviews recorded" }] },
      { title: `Activities and outings (${student.operationAttendances.length} records)`, rows: student.operationAttendances.length ? student.operationAttendances.map(item => ({
        label: `${formatUkDate(item.occurrence.startAt)} - ${item.occurrence.operation.title}`,
        value: `${title(item.status)}${item.transportMode ? `; transport: ${item.transportMode}` : ""}${item.supportLevel ? `; support: ${item.supportLevel}` : ""}${item.operationalNotes ? `; notes: ${item.operationalNotes}` : ""}`,
      })) : [{ label: "Activities", value: "No activity or outing records" }] },
      { title: "Record metadata", rows: [
        { label: "Profile created", value: dateTime(student.createdAt) },
        { label: "Profile last updated", value: dateTime(student.updatedAt) },
        { label: "Disclosure scope", value: "Current student profile and linked attendance, consent, billing, information-review, activity and outing records held in STARS Connect at the time of generation." },
      ] },
    ];
    const generatedAt = new Date();
    const pdf = studentRecordPdf({
      logoJpeg: await loadInvoiceLogo(), organisationName: organisation.organisationLegalName || organisation.organisationName,
      studentName: student.displayName, studentReference: student.internalReference || "Not configured",
      generatedBy: user.name, generatedAt: formatUkDateTime(generatedAt), sections,
    });
    await audit("STUDENT_RECORD_PDF_DOWNLOADED", { actorType: "USER", actorId: user.id, entityType: "Student", entityId: student.id, afterValue: { generatedAt: generatedAt.toISOString(), attendanceRecords: student.attendance.length, reviewRecords: student.informationReviews.length }, ...requestContext(req) });
    const filename = `${safeDocumentName(student.displayName)}-${safeDocumentName(student.internalReference || "record")}-complete-record.pdf`;
    return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  });
}
