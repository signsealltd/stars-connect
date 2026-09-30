import {describe,it,expect,vi,beforeEach} from "vitest";
const db=vi.hoisted(()=>({appSetting:{upsert:vi.fn()},$queryRaw:vi.fn(),invoice:{findMany:vi.fn(),update:vi.fn()},auditLog:{create:vi.fn()},documentRecord:{updateMany:vi.fn()}}));
vi.mock("./prisma",()=>({prisma:{$transaction:async(fn:(tx:typeof db)=>unknown)=>fn(db)}}));
import {deleteInvoices,invoiceDeletionSchema} from "./invoice-deletion";
const id="11111111-1111-4111-8111-111111111111";
describe("Invoice deletion",()=>{
 beforeEach(()=>{vi.clearAllMocks();});
 it("requires a bounded selection and an audit reason",()=>{expect(invoiceDeletionSchema.safeParse({invoiceIds:[id],reason:"Test invoice"}).success).toBe(true);expect(invoiceDeletionSchema.safeParse({invoiceIds:[],reason:"Test"}).success).toBe(false);expect(invoiceDeletionSchema.safeParse({invoiceIds:[id],reason:""}).success).toBe(false);expect(invoiceDeletionSchema.safeParse({invoiceIds:Array(101).fill(id),reason:"Test"}).success).toBe(false);});
 it("removes a paid invoice without erasing its recorded payment state",async()=>{db.invoice.findMany.mockResolvedValue([{id,status:"ISSUED",paymentState:"PAID",paymentRevision:3,invoiceNumber:"TEST-1",grossTotal:30,documentId:"pdf",billingRunId:"run"}]);await expect(deleteInvoices({invoiceIds:[id],reason:"Duplicate"},"actor")).resolves.toEqual({deleted:1});expect(db.invoice.update).toHaveBeenCalledWith({where:{id},data:{status:"DELETED",paymentRevision:{increment:1}}});expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:"INVOICE_DELETED",beforeValue:expect.objectContaining({paymentState:"PAID"}),afterValue:{status:"DELETED",reason:"Duplicate"}})}));expect(db.documentRecord.updateMany).toHaveBeenCalledWith(expect.objectContaining({data:{status:"SUPERSEDED"}}));});
 it("makes repeated deletion harmless",async()=>{db.invoice.findMany.mockResolvedValue([{id,status:"DELETED"}]);expect(await deleteInvoices({invoiceIds:[id],reason:"Retry"},"actor")).toEqual({deleted:0});expect(db.invoice.update).not.toHaveBeenCalled();expect(db.auditLog.create).not.toHaveBeenCalled();});
 it("rejects an unavailable selection before changing anything",async()=>{db.invoice.findMany.mockResolvedValue([]);await expect(deleteInvoices({invoiceIds:[id],reason:"Test"},"actor")).rejects.toThrow("nothing was deleted");expect(db.invoice.update).not.toHaveBeenCalled();});
});
