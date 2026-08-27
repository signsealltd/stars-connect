import { z } from "zod";

export const invoiceReissueLineSchema = z.object({
  date: z.string().trim().min(1).max(80),
  service: z.string().trim().min(2).max(191),
  quantity: z.coerce.number().positive().max(10000),
  unitRate: z.coerce.number().min(0).max(1000000),
  vatRate: z.coerce.number().min(0).max(100),
});

export const invoiceReissueSchema = z.object({
  action: z.literal("reissue"),
  invoiceDate: z.string().date(), dueDate: z.string().date(),
  periodStart: z.string().date(), periodEnd: z.string().date(),
  supplierName: z.string().trim().min(2).max(191), supplierAddress: z.string().trim().min(2).max(2000),
  companyNumber: z.string().trim().max(100), vatNumber: z.string().trim().max(100),
  payerName: z.string().trim().min(2).max(191), payerAddress: z.string().trim().min(2).max(2000),
  studentName: z.string().trim().min(2).max(191), studentReference: z.string().trim().min(1).max(120),
  paymentTerms: z.string().trim().min(2).max(1000), bankDetails: z.string().trim().max(2000), remittanceInstructions: z.string().trim().max(2000),
  lines: z.array(invoiceReissueLineSchema).min(1).max(100),
  reason: z.string().trim().min(5).max(1000), password: z.string().min(1).max(200),
});

export type InvoiceReissueInput = z.infer<typeof invoiceReissueSchema>;
const money=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export function calculateInvoiceLines(lines:InvoiceReissueInput["lines"]){return lines.map(line=>{const net=money(line.quantity*line.unitRate),vat=money(net*line.vatRate/100);return{...line,net,vat,total:money(net+vat)}})}
export function calculateInvoiceTotals(lines:ReturnType<typeof calculateInvoiceLines>){return lines.reduce((total,line)=>({net:money(total.net+line.net),vat:money(total.vat+line.vat),gross:money(total.gross+line.total)}),{net:0,vat:0,gross:0})}
