import {z} from "zod";
import {calculateInvoiceLines,calculateInvoiceTotals,invoiceReissueLineSchema} from "./invoice-reissue";

export const manualInvoiceSchema=z.object({
  requestKey:z.string().uuid(), studentId:z.string().uuid(), profileId:z.string().uuid(),profileVersion:z.string().datetime(),
  invoiceDate:z.string().date(),dueDate:z.string().date(),periodStart:z.string().date(),periodEnd:z.string().date(),

  lines:z.array(invoiceReissueLineSchema.extend({quantity:z.number().positive().max(10000).multipleOf(0.001),unitRate:z.number().min(0).max(1000000).multipleOf(0.01),vatRate:z.number().min(0).max(100).multipleOf(0.01)})).min(1).max(100),
}).superRefine((data,ctx)=>{
  if(data.periodEnd<data.periodStart)ctx.addIssue({code:"custom",message:"The end date must be on or after the start date.",path:["periodEnd"]});
  if(data.dueDate<data.invoiceDate)ctx.addIssue({code:"custom",message:"Payment due cannot be before the invoice date.",path:["dueDate"]});
  const total=calculateInvoiceTotals(calculateInvoiceLines(data.lines));
  if(total.gross<=0||total.gross>99999999.99)ctx.addIssue({code:"custom",message:"The invoice total must be positive and below £100 million.",path:["lines"]});
});
export type ManualInvoiceInput=z.infer<typeof manualInvoiceSchema>;
