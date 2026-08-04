import {describe,expect,it} from "vitest";
import {billingRunStudentIds} from "./billing";

describe("billing run selected-student scope",()=>{
  it("keeps every selected student from parsed MariaDB JSON",()=>{expect(billingRunStudentIds(["student-a","student-b"])).toEqual(["student-a","student-b"]);});
  it("accepts a serialized JSON selection without falling back to all students",()=>{expect(billingRunStudentIds('["student-a","student-b"]')).toEqual(["student-a","student-b"]);});
  it("rejects malformed or missing selection data",()=>{expect(billingRunStudentIds('not-json')).toEqual([]);expect(billingRunStudentIds(null)).toEqual([]);});
  it("deduplicates selected students",()=>{expect(billingRunStudentIds(["student-a","student-a","student-b"])).toEqual(["student-a","student-b"]);});
});
