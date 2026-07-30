import { describe,expect,it } from "vitest";
import { canAccess } from "./domain";
import { appendSignatureStroke,hasDuplicateActiveVisitor,isMeaningfulSignature,isRetentionExpired,normalizeVisitorName,signaturePointCount,visitorSignInSchema,visitorSignOutSchema,visitDurationMinutes } from "./visitors";
const signature=[[{x:.1,y:.4,t:1},{x:.2,y:.5,t:2},{x:.3,y:.42,t:3},{x:.4,y:.55,t:4},{x:.5,y:.38,t:5},{x:.6,y:.52,t:6},{x:.7,y:.4,t:7},{x:.8,y:.5,t:8}]];
const valid={id:"11111111-1111-4111-8111-111111111111",visitorId:"22222222-2222-4222-8222-222222222222",referenceCode:"AB12CD34",fullName:"Jamie Visitor",company:"Example Ltd",host:"Morgan Manager",reasonId:"33333333-3333-4333-8333-333333333333",reasonLabel:"Meeting",signedInAt:"2026-07-26T09:00:00.000Z",ruleSetId:"44444444-4444-4444-8444-444444444444",ruleVersion:2,acceptedRulesText:"These are the exact immutable visitor rules accepted.",acceptedAt:"2026-07-26T09:00:00.000Z",signature,emergencyIncluded:true};
describe("visitor sign-in",()=>{
 it("validates a complete sign-in and site-rule acceptance",()=>expect(visitorSignInSchema.safeParse(valid).success).toBe(true));
 it("allows sign-in without a host",()=>expect(visitorSignInSchema.safeParse({...valid,host:""}).success).toBe(true));
 it("rejects missing rule acceptance data",()=>expect(visitorSignInSchema.safeParse({...valid,acceptedRulesText:""}).success).toBe(false));
 it("rejects script-like name input",()=>expect(visitorSignInSchema.safeParse({...valid,fullName:"<script>"}).success).toBe(false));
 it("validates a meaningful signature stroke",()=>{expect(signaturePointCount(signature)).toBe(8);expect(isMeaningfulSignature(signature)).toBe(true);expect(isMeaningfulSignature([[{x:.1,y:.1,t:1},{x:.11,y:.1,t:2}]])).toBe(false)});
 it("preserves earlier signature strokes when another stroke is drawn",()=>{const next=[{x:.2,y:.2,t:9},{x:.3,y:.3,t:10}];expect(appendSignatureStroke(signature,next)).toEqual([...signature,next])});
 it("prevents an active duplicate name while allowing a prior signed-out visit",()=>{expect(hasDuplicateActiveVisitor([{fullName:" Jamie  Visitor "}],"jamie visitor")).toBe(true);expect(hasDuplicateActiveVisitor([{fullName:"Jamie Visitor",signedOutAt:"2026-07-25T10:00:00Z"}],"Jamie Visitor")).toBe(false)});
 it("normalises visitor identity safely",()=>expect(normalizeVisitorName("  Jamie   VISITOR ")).toBe("jamie visitor"));
});
describe("visitor sign-out and governance",()=>{
 it("validates visitor and manager-assisted sign-out events",()=>{expect(visitorSignOutSchema.safeParse({visitId:valid.id,signedOutAt:"2026-07-26T10:00:00.000Z"}).success).toBe(true);expect(visitorSignOutSchema.safeParse({visitId:valid.id,signedOutAt:"2026-07-26T10:00:00.000Z",signedOutByUserId:valid.visitorId,correctionReason:"Reception assisted"}).success).toBe(true)});
 it("calculates total visit duration",()=>expect(visitDurationMinutes("2026-07-26T09:00:00Z","2026-07-26T10:35:00Z")).toBe(95));
 it("preserves the exact accepted rule text independently of later text",()=>{const acceptance={version:2,text:valid.acceptedRulesText};const later="Completely revised rules";expect(acceptance.text).toBe(valid.acceptedRulesText);expect(acceptance.text).not.toBe(later)});
 it("restricts signature viewing to managers and administrators",()=>{expect(canAccess("RECEPTION","signatures")).toBe(false);expect(canAccess("MANAGER","signatures")).toBe(true);expect(canAccess("ADMINISTRATOR","signatures")).toBe(true)});
 it("allows reception operational visitor access but not full reports",()=>{expect(canAccess("RECEPTION","visitors")).toBe(true);expect(canAccess("RECEPTION","reports")).toBe(false)});
 it("identifies records due for retention processing",()=>{expect(isRetentionExpired("2026-06-01T00:00:00Z",30,new Date("2026-07-26T00:00:00Z"))).toBe(true);expect(isRetentionExpired("2026-07-20T00:00:00Z",30,new Date("2026-07-26T00:00:00Z"))).toBe(false)});
});