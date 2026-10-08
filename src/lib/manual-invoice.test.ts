import {describe,it,expect} from "vitest";
import {manualInvoiceSchema} from "./manual-invoice";
import {calculateInvoiceLines,calculateInvoiceTotals} from "./invoice-reissue";
const sample=()=>({requestKey:"11111111-1111-4111-8111-111111111111",studentId:"22222222-2222-4222-8222-222222222222",profileId:"33333333-3333-4333-8333-333333333333",profileVersion:"2026-09-30T12:00:00.000Z",invoiceDate:"2026-09-30",dueDate:"2026-10-30",periodStart:"2026-09-01",periodEnd:"2026-09-30",payerName:"Example payer",payerAddress:"Example address",purchaseOrderNumber:"",lines:[{date:"12–14 September 2026",service:"Respite weekend with support",quantity:2.5,unitRate:88.39,vatRate:0},{date:"19 September 2026",service:"Day trip",quantity:1,unitRate:25,vatRate:20}]});
describe("Custom Invoice",()=>{
 it("retains independent descriptions and service dates with an optional PO",()=>{expect(manualInvoiceSchema.parse(sample()).lines[0].date).toBe("12–14 September 2026");});
 it("does not accept payer overrides from the browser",()=>{const data=manualInvoiceSchema.parse(sample());expect(data).not.toHaveProperty("payerName");expect(data).not.toHaveProperty("payerAddress");expect(data).not.toHaveProperty("purchaseOrderNumber");});
 it("rounds each charge and VAT before summing",()=>{expect(calculateInvoiceTotals(calculateInvoiceLines(sample().lines))).toEqual({net:245.98,vat:5,gross:250.98});});
 it.each([0,-1,Infinity,NaN])("rejects invalid quantities %s",quantity=>{const input=sample();input.lines[0].quantity=quantity;expect(manualInvoiceSchema.safeParse(input).success).toBe(false);});
 it("rejects missing lines, reversed dates and excessive totals",()=>{expect(manualInvoiceSchema.safeParse({...sample(),lines:[]}).success).toBe(false);expect(manualInvoiceSchema.safeParse({...sample(),periodEnd:"2026-08-01"}).success).toBe(false);expect(manualInvoiceSchema.safeParse({...sample(),dueDate:"2026-09-01"}).success).toBe(false);const input=sample();input.lines[0].quantity=10000;input.lines[0].unitRate=1000000;expect(manualInvoiceSchema.safeParse(input).success).toBe(false);});
 it("rejects negative charges and fractions of a penny",()=>{const input=sample();input.lines[0].unitRate=-1;expect(manualInvoiceSchema.safeParse(input).success).toBe(false);input.lines[0].unitRate=0.001;expect(manualInvoiceSchema.safeParse(input).success).toBe(false);});
});

it("preserves line breaks within a single custom invoice charge", () => {
  const input = sample();
  input.lines = [{...input.lines[0], service: "Respite\n\nTransport included"}];
  const parsed = manualInvoiceSchema.parse(JSON.parse(JSON.stringify(input)));
  const lines = calculateInvoiceLines(parsed.lines);
  expect(lines).toHaveLength(1);
  expect(lines[0].service).toBe("Respite\n\nTransport included");
  expect(calculateInvoiceTotals(lines)).toEqual({net: 220.98, vat: 0, gross: 220.98});
});
