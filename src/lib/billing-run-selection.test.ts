import {describe,expect,it} from "vitest";
import {billingRunStudentIds} from "./billing";

describe("billing run selected-client scope",()=>{
  it("keeps every selected client from parsed MariaDB JSON",()=>{expect(billingRunStudentIds(["student-a","student-b"])).toEqual(["student-a","student-b"]);});
  it("accepts a serialized JSON selection without falling back to all clients",()=>{expect(billingRunStudentIds('["student-a","student-b"]')).toEqual(["student-a","student-b"]);});
  it("rejects malformed or missing selection data",()=>{expect(billingRunStudentIds('not-json')).toEqual([]);expect(billingRunStudentIds(null)).toEqual([]);});
  it("deduplicates selected clients",()=>{expect(billingRunStudentIds(["student-a","student-a","student-b"])).toEqual(["student-a","student-b"]);});
});
