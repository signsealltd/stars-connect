import { describe, expect, it } from "vitest";
import { reviewHrProposal } from "./staff-hr-review";
import { RequestError } from "./request-error";

const request={baseVersion:0,before:{personal:{preferredName:"Test person",addressLine1:null,town:null}},proposed:{personal:{preferredName:"Test person",addressLine1:"New address",town:"New town"}}};

describe("staff profile approval conflict checks",()=>{
  it("approves the submitted fields after unrelated profile updates raise the version",()=>{
    expect(reviewHrProposal(request,{version:3,personal:{preferredName:"Test person",legalName:"Unrelated update"},medical:{allergies:"Separate medical update"}})).toEqual({personal:{addressLine1:"New address",town:"New town"}});
  });
  it("does not overwrite newer changes with unchanged fields from the submitted form",()=>{
    expect(reviewHrProposal(request,{version:3,personal:{preferredName:"New preferred name"},medical:{}})).toEqual({personal:{addressLine1:"New address",town:"New town"}});
  });
  it("returns a controlled conflict instead of overwriting an intervening edit",()=>{
    try {
      reviewHrProposal(request,{version:3,personal:{addressLine1:"Manager verified address"},medical:{}});
      expect.fail("Expected a conflict");
    } catch(error) {
      expect(error).toBeInstanceOf(RequestError);
      expect((error as RequestError).status).toBe(409);
      expect((error as Error).message).toContain("changed since submission");
    }
  });
  it("treats already-applied proposed values as a no-op",()=>{
    expect(reviewHrProposal(request,{version:3,personal:{preferredName:"Test person",addressLine1:"New address",town:"New town"},medical:{}})).toEqual({});
  });
  it("supports an ordinary same-version request without a historical before snapshot",()=>{
    expect(reviewHrProposal({baseVersion:0,proposed:{personal:{addressLine1:"New address"}}},{version:0,personal:{},medical:{}})).toEqual({personal:{addressLine1:"New address"}});
  });
  it("fails closed when a stale request is missing its before values",()=>{
    expect(()=>reviewHrProposal({baseVersion:0,proposed:{personal:{addressLine1:"New address"}}},{version:3,personal:{},medical:{}})).toThrow(RequestError);
  });
  it("compares nested emergency-contact values without depending on JSON key order",()=>{
    const contact={name:"Contact",relationship:"Friend",phone:"111",alternativePhone:"",email:"",notes:""};
    const reordered={notes:"",email:"",alternativePhone:"",phone:"111",relationship:"Friend",name:"Contact"};
    expect(reviewHrProposal({baseVersion:0,before:{personal:{emergencyContacts:[contact]}},proposed:{personal:{emergencyContacts:[{...contact,phone:"222"}]}}},{version:3,personal:{emergencyContacts:[reordered]},medical:{}})).toEqual({personal:{emergencyContacts:[{...contact,phone:"222"}]}});
    expect(()=>reviewHrProposal({baseVersion:0,before:{personal:{emergencyContacts:[contact]}},proposed:{personal:{emergencyContacts:[{...contact,phone:"222"}]}}},{version:3,personal:{emergencyContacts:[{...contact,phone:"333"}]},medical:{}})).toThrow(RequestError);
  });
  it("applies the same conflict protection to medical fields",()=>{
    const details={baseVersion:1,before:{medical:{allergies:""}},proposed:{medical:{allergies:"Employee update"}}};
    expect(reviewHrProposal(details,{version:2,personal:{},medical:{allergies:"",reviewDate:"2026-10-09"}})).toEqual({medical:{allergies:"Employee update"}});
    expect(()=>reviewHrProposal(details,{version:2,personal:{},medical:{allergies:"Clinician update"}})).toThrow(RequestError);
  });
  it("rejects malformed or out-of-scope proposals with a controlled validation error",()=>{
    for(const proposed of [null,{}, {personal:{}}, {employment:{contractType:"changed"}}, {personal:{legalName:"Not an employee-editable field"}}]){
      try {reviewHrProposal({baseVersion:0,proposed},{version:0,personal:{},medical:{}});expect.fail("Expected invalid proposal");}
      catch(error){expect(error).toBeInstanceOf(RequestError);expect((error as RequestError).status).toBe(422);}
    }
  });
});
