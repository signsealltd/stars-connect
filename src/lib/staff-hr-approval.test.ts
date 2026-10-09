import {beforeEach,expect,it,vi} from "vitest";
import type {Prisma,StaffRequest,User} from "@prisma/client";
const mocks=vi.hoisted(()=>({audit:vi.fn()}));
vi.mock("./action-notifications",()=>({prisma:{},jsonValue:(value:unknown)=>value,auditAction:mocks.audit,actionRecipients:vi.fn(),notifyAction:vi.fn()}));
import {approveHr} from "./staff-hr-service";
const actor={id:"reviewer",role:"ADMINISTRATOR",permissionOverrides:{}} as User;
const request={staffId:"staff",details:{hr:true,baseVersion:0,before:{personal:{addressLine1:null,preferredName:"Original"}},proposed:{personal:{addressLine1:"Requested address",preferredName:"Original"}}}} as unknown as StaffRequest;
function transaction(personal:object={preferredName:"Updated name"}) {
  const record={version:3,personal,employment:{holidayAllowances:[{yearStart:"2026-01-01",entitlementDays:28,carryOverDays:0}]},medical:{reviewDate:"2026-10-09"}};
  const tx={staffMember:{findUniqueOrThrow:vi.fn().mockResolvedValue({portalAccount:null}),update:vi.fn()},staffHrRecord:{findUnique:vi.fn().mockResolvedValue(record),upsert:vi.fn().mockResolvedValue({...record,version:4})},staffHrEvent:{create:vi.fn()}};
  return {tx,client:tx as unknown as Prisma.TransactionClient,record};
}
beforeEach(()=>{vi.clearAllMocks();mocks.audit.mockResolvedValue({id:"audit"});});
it("approves an address request while preserving intervening holiday, medical and name changes",async()=>{
  const {tx,client,record}=transaction();
  await expect(approveHr(client,request,actor,"Reviewed")).resolves.toMatchObject({auditId:"audit"});
  expect(tx.staffHrRecord.upsert.mock.calls[0][0].update).toMatchObject({personal:{preferredName:"Updated name",addressLine1:"Requested address"},employment:record.employment,medical:record.medical,version:{increment:1}});
  expect(tx.staffMember.update).not.toHaveBeenCalled();
  expect(tx.staffHrEvent.create).toHaveBeenCalledOnce();expect(mocks.audit).toHaveBeenCalledOnce();
});
it("does not write anything when the requested field conflicts with a newer change",async()=>{
  const {tx,client}=transaction({addressLine1:"More recent address"});
  await expect(approveHr(client,request,actor,"Reviewed")).rejects.toMatchObject({status:409});
  expect(tx.staffHrRecord.upsert).not.toHaveBeenCalled();expect(tx.staffHrEvent.create).not.toHaveBeenCalled();
});
it("returns a controlled permission error and does not write medical changes without edit access",async()=>{
  const {tx,client}=transaction();
  const medicalRequest={...request,details:{baseVersion:0,proposed:{medical:{allergies:"Updated"}}}} as unknown as StaffRequest;
  await expect(approveHr(client,medicalRequest,{...actor,role:"MANAGER"},"Reviewed")).rejects.toMatchObject({status:403});
  expect(tx.staffHrRecord.upsert).not.toHaveBeenCalled();
});
