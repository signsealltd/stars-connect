import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CAPABILITIES, requireCapability } from "@/lib/permissions";
import { createCsv } from "@/lib/csv";
import { loadDocument, storeDocument, zipFiles } from "@/lib/documents";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCapability(CAPABILITIES.BILLING_APPROVE);
  const { id } = await params;
  const run = await prisma.billingRun.findUnique({ where: { id }, include: { invoices: true } });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (run.status !== "INVOICES_GENERATED") return NextResponse.json({ error: "Generate invoices first." }, { status: 409 });

  const existing = await prisma.documentRecord.findMany({
    where: {
      sourceType: "BillingRun",
      sourceId: id,
      version: run.version,
      documentType: { in: ["INVOICE_ZIP", "INVOICE_REGISTER_CSV"] },
    },
    orderBy: { generatedAt: "desc" },
  });
  const existingZip = existing.find(document => document.documentType === "INVOICE_ZIP");
  const existingCsv = existing.find(document => document.documentType === "INVOICE_REGISTER_CSV");
  if (existingZip && existingCsv) {
    await audit("INVOICE_BULK_EXPORT_DOWNLOADED", { actorType: "USER", actorId: user.id, entityType: "BillingRun", entityId: id, afterValue: { reused: true, count: run.invoices.length }, ...requestContext(req) });
    return NextResponse.json({ zipDocument: existingZip, csvDocument: existingCsv });
  }

  const invoiceDocumentIds = run.invoices.map(invoice => invoice.documentId).filter((value): value is string => Boolean(value));
  if (!run.invoices.length || invoiceDocumentIds.length !== run.invoices.length) {
    return NextResponse.json({ error: "One or more invoice documents are unavailable. Please contact an administrator." }, { status: 409 });
  }
  const docs = await prisma.documentRecord.findMany({ where: { id: { in: invoiceDocumentIds } } });
  if (docs.length !== invoiceDocumentIds.length) {
    return NextResponse.json({ error: "One or more invoice documents could not be found. Please contact an administrator." }, { status: 409 });
  }

  const files = await Promise.all(docs.map(async document => ({ name: `${document.documentNumber}.pdf`, content: await loadDocument(document.storagePath) })));
  const csv = Buffer.from(createCsv(
    ["Invoice number", "Payer", "Invoice date", "Due date", "Net", "VAT", "Total", "Status"],
    run.invoices.map(invoice => [invoice.invoiceNumber, invoice.payerName, invoice.invoiceDate.toISOString().slice(0, 10), invoice.dueDate.toISOString().slice(0, 10), invoice.netTotal, invoice.vatTotal, invoice.grossTotal, invoice.status]),
  ));
  const zip = zipFiles(files);
  const zipDoc = existingZip || await storeDocument({ documentNumber: `INVOICE-RUN-${id.slice(0, 8)}`, documentType: "INVOICE_ZIP", periodStart: run.periodStart, periodEnd: run.periodEnd, version: run.version, createdById: user.id, generationSource: "ADMINISTRATOR", sourceType: "BillingRun", sourceId: id, mimeType: "application/zip", content: zip });
  const csvDoc = existingCsv || await storeDocument({ documentNumber: `INVOICE-REGISTER-${id.slice(0, 8)}`, documentType: "INVOICE_REGISTER_CSV", periodStart: run.periodStart, periodEnd: run.periodEnd, version: run.version, createdById: user.id, generationSource: "ADMINISTRATOR", sourceType: "BillingRun", sourceId: id, mimeType: "text/csv", content: csv });
  await audit("INVOICE_BULK_EXPORT_GENERATED", { actorType: "USER", actorId: user.id, entityType: "BillingRun", entityId: id, afterValue: { count: run.invoices.length }, ...requestContext(req) });
  return NextResponse.json({ zipDocument: zipDoc, csvDocument: csvDoc });
}
