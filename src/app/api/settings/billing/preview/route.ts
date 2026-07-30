import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CAPABILITIES, requireCapability } from "@/lib/permissions";
import { invoicePdf } from "@/lib/invoice-pdf";
import { loadInvoiceLogo } from "@/lib/invoice-logo";

const schema = z.object({
  invoicePrefix: z.string().trim().min(2).max(20),
  organisationLegalName: z.string().trim().min(2).max(191),
  organisationAddress: z.string().max(2000),
  companyNumber: z.string().max(50),
  vatNumber: z.string().max(50),
  bankDetails: z.string().max(2000),
  remittanceInstructions: z.string().max(2000),
  defaultPaymentTerms: z.string().max(1000),
  invoiceLogoUrl: z.string().max(250000),
});

export async function POST(req: NextRequest) {
  await requireCapability(CAPABILITIES.BILLING_APPROVE);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the invoice settings." }, { status: 422 });
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/London" });
  const content = invoicePdf({
    logoJpeg: await loadInvoiceLogo(parsed.data.invoiceLogoUrl),
    invoiceNumber: `${parsed.data.invoicePrefix}-PREVIEW`,
    invoiceDate: date,
    dueDate: new Date(now.getTime() + 30 * 86400000).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/London" }),
    periodLabel: "Example billing period",
    supplierName: parsed.data.organisationLegalName,
    supplierAddress: parsed.data.organisationAddress.split(/\r?\n/).filter(Boolean),
    companyNumber: parsed.data.companyNumber,
    vatNumber: parsed.data.vatNumber,
    payerName: "Example payer",
    payerAddress: ["Example billing address"],
    studentName: "Example Student",
    studentReference: "STUDENT-001",
    rows: [{ date, days: "1.000", rate: "GBP 100.00", net: "GBP 100.00", vat: "GBP 0.00", total: "GBP 100.00" }],
    attendanceDays: "1.000",
    dayRate: "GBP 100.00",
    netTotal: "GBP 100.00",
    vatTotal: "GBP 0.00",
    grossTotal: "GBP 100.00",
    paymentTerms: parsed.data.defaultPaymentTerms,
    bankDetails: parsed.data.bankDetails.split(/\r?\n/).filter(Boolean),
    remittanceInstructions: parsed.data.remittanceInstructions.split(/\r?\n/).filter(Boolean),
    approvedAt: "Preview only",
    generatedAt: now.toLocaleString("en-GB", { timeZone: "Europe/London" }),
  });
  return new NextResponse(content, { headers: { "content-type": "application/pdf", "content-disposition": "inline; filename=\"invoice-preview.pdf\"", "cache-control": "no-store" } });
}
