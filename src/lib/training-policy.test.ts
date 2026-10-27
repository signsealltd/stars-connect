import {expect,it} from "vitest";
import {canonicalTrainingCourses,verifyCanonicalCatalogue} from "./training-policy";
import {policyTrainingCell,compositeTrainingStatus} from "./training-status";
const course=(name:string)=>({id:name,...canonicalTrainingCourses.find(c=>c.name===name)!});
const record=(c:ReturnType<typeof course>,date="2024-01-31")=>({id:"record",courseId:c.id,courseName:c.name,completedDate:new Date(date+"T00:00:00Z"),expiryDate:null});
const now=new Date("2026-10-12T12:00:00Z");
it("has exactly 45 online and 15 local courses, approved roles and one GDPR 1",()=>{
 expect(verifyCanonicalCatalogue()).toEqual({online:45,additional:15,roles:{"Assistant Manager":44,"Team Leader":43,"Support Worker":37}});
 expect(canonicalTrainingCourses.filter(c=>c.name==="GDPR 1 (Careskills)")).toHaveLength(1);
 expect(canonicalTrainingCourses.some(c=>c.evidenceKind==="FULL_TIER2")).toBe(false);
});
it("calculates renewal from historic completion with end-of-month handling and earlier provider expiry",()=>{
 const c=course("Basic Life Support (Careskills)"),r={...record(c,"2024-02-29"),externalResult:{qualifies:true,completedAt:new Date("2024-02-29Z"),providerExpiryDate:new Date("2024-12-31Z")}};
 const cell=policyTrainingCell(c,"REQUIRED",[r],[],undefined,now);
 expect(cell.policyRenewalDate?.toISOString().slice(0,10)).toBe("2025-02-28");expect(cell.expiryDate?.toISOString().slice(0,10)).toBe("2024-12-31");expect(cell.state).toBe("EXPIRED");
});
it("keeps one-off completions current and labels development reviews separately",()=>{
 const once=course("Care Certificate (Careskills)");expect(policyTrainingCell(once,"REQUIRED",[record(once,"2010-01-01")],[],undefined,now)).toMatchObject({state:"CURRENT",expiryDate:null});
 const review=course("Appraisal (Careskills)");expect(policyTrainingCell(review,"REQUIRED",[record(review,"2020-01-01")],[],undefined,now).state).toBe("REVIEW_DUE");
});
it("shows unresolved conditional applicability without making it mandatory or compliant",()=>{
 const c=course("Medication Administration — Practical Competency");
 expect(policyTrainingCell(c,"CONDITIONAL",[],[],undefined,now)).toMatchObject({requirement:"CONDITIONAL",state:"REQUIRES_REVIEW"});
 expect(policyTrainingCell(c,"CONDITIONAL",[],[],{required:false,reason:"Does not administer"},now).state).toBe("NOT_REQUIRED");
});
it("keeps a current completion when a newer attempt is in progress, and never credits failed attempts",()=>{
 const c=course("Fire Safety (Careskills)"),r=record(c,"2026-01-01");
 expect(policyTrainingCell(c,"REQUIRED",[r],[{courseId:c.id,qualifies:false,completedAt:null,statusLabel:"In progress"}],undefined,now).state).toBe("CURRENT");
 expect(policyTrainingCell(c,"REQUIRED",[{...r,externalResult:{qualifies:false,completedAt:r.completedDate,providerExpiryDate:null}}],[],undefined,now).state).toBe("MISSING");
});
it("flags a successful undated result and keeps overdue training overdue despite a booking",()=>{
 const c=course("Basic Life Support (Careskills)");
 expect(policyTrainingCell(c,"REQUIRED",[],[{courseId:c.id,qualifies:true,completedAt:null,statusLabel:"Passed"}],undefined,now).state).toBe("REQUIRES_REVIEW");
 expect(policyTrainingCell(c,"REQUIRED",[record(c)],[],{required:true,reason:null,policy:{bookedFor:"2027-01-01"}},now).state).toBe("EXPIRED");
});
it("derives part-complete Tier 2 without a third course or crediting practical evidence",()=>{
 const online=course("The Oliver McGowan Mandatory Training"),face=course("Oliver McGowan Tier 2 — Face-to-Face Training");
 expect(compositeTrainingStatus([{courseId:online.id,state:"CURRENT"},{courseId:face.id,state:"MISSING"}],[online,face])[0].state).toBe("PART_COMPLETE");
 expect(policyTrainingCell(face,"REQUIRED",[{...record(face),externalResult:{qualifies:true,completedAt:new Date(),providerExpiryDate:null}}],[],undefined,now).state).toBe("MISSING");
});
it("requires each client's matching plan version and flags material changes",()=>{
 const c=course("Client-Specific Care and Emergency Plan Briefing"),r={...record(c),evidenceDetails:{clientId:"a",planId:"plan",planVersion:"1"}};
 const assignment={required:true,reason:null,policy:{clientPlans:[{clientId:"a",planId:"plan",version:"1"}]}};
 expect(policyTrainingCell(c,"REQUIRED",[r],[],assignment,now).state).toBe("CURRENT");
 assignment.policy.clientPlans[0].version="2";expect(policyTrainingCell(c,"REQUIRED",[r],[],assignment,now).state).toBe("REQUIRES_REVIEW");
 assignment.policy.clientPlans[0]={clientId:"b",planId:"plan",version:"1"};expect(policyTrainingCell(c,"REQUIRED",[r],[],assignment,now).state).toBe("REQUIRES_REVIEW");
});
it("keeps practical competency and formal refresher dates separate and actions the earlier deadline",()=>{
 const c=course("Buccal Midazolam — Practical Training and Competency"),r={...record(c,"2026-01-01"),evidenceDetails:{formalTrainingDate:"2023-01-01",outcome:"PASSED"}};
 const cell=policyTrainingCell(c,"REQUIRED",[r],[],undefined,now);
 expect(cell.policyRenewalDate?.toISOString().slice(0,10)).toBe("2027-01-01");expect(cell.formalReviewDate?.toISOString().slice(0,10)).toBe("2025-01-01");expect(cell.state).toBe("EXPIRED");
});

it("explains why a signed practical assessment still needs an applicability decision and resolves it explicitly",()=>{
 const c=canonicalTrainingCourses.find(c=>c.evidenceKind==="PRACTICAL"&&!c.policy.component&&!c.policy.formalRefresherMonths)!;
 const selected={...c,id:"practical"};
 const r={...record(selected,"2026-10-01"),evidenceDetails:{assessor:"Assessor",outcome:"PASSED",scope:"Observed assessment"}};
 const unresolved=policyTrainingCell(selected,"CONDITIONAL",[r],[],undefined,now);
 expect(unresolved.state).toBe("REQUIRES_REVIEW");
 expect(unresolved.recordId).toBe(r.id);
 expect(unresolved.reviewReasons.join(" ")).toContain("Confirm Required or Not required");
 const resolved=policyTrainingCell(selected,"CONDITIONAL",[r],[],{required:true,reason:"Administers medication"},now);
 expect(resolved.state).toBe("CURRENT");
 expect(resolved.reviewReasons).toEqual([]);
 expect(policyTrainingCell(selected,"CONDITIONAL",[{...r,evidenceDetails:{...r.evidenceDetails,outcome:"FAILED"}}],[],{required:true,reason:null},now).state).toBe("MISSING");
});
it("explains plan and reassessment blockers without letting matching old plans clear reassessment",()=>{
 const c=course("Client-Specific Care and Emergency Plan Briefing");
 const r={...record(c,"2026-01-01"),evidenceDetails:{clientId:"a",planId:"plan",planVersion:"1"}};
 expect(policyTrainingCell(c,"REQUIRED",[r],[],undefined,now).reviewReasons.join(" ")).toContain("No required client plans");
 const assignment={required:true,reason:"Plan review",policy:{reassessmentAfter:"2026-09-01",clientPlans:[{clientId:"a",planId:"plan",version:"1"}]}};
 const blocked=policyTrainingCell(c,"REQUIRED",[r],[],assignment,now);
 expect(blocked.state).toBe("REQUIRES_REVIEW");
 expect(blocked.reviewReasons.join(" ")).toContain("2026-09-01");
 const completed=policyTrainingCell(c,"REQUIRED",[{...r,completedDate:new Date("2026-10-01Z")}],[],assignment,now);
 expect(completed.state).toBe("CURRENT");
 expect(completed.reviewReasons).toEqual([]);
});
