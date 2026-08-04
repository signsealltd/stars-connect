import { describe, expect, it } from "vitest";
import { overlappingSelectedStudents, studentsWithoutAttendance } from "./billing";

describe("billing attendance coverage", () => {
  it("returns only students with no register record in the period", () => {
    const students = [{ id: "student-1" }, { id: "student-2" }];
    expect(studentsWithoutAttendance(students, [{ studentId: "student-1" }])).toEqual([{ id: "student-2" }]);
  });

  it("finds selected students already present in an overlapping run", () => {
    expect(overlappingSelectedStudents(["student-1", "student-2"], ["student-2", "student-3"])).toEqual(["student-2"]);
    expect(overlappingSelectedStudents(null, ["student-2"])).toEqual([]);
  });

  it("treats an absent register record as coverage without making it billable", () => {
    expect(studentsWithoutAttendance([{ id: "student-1" }], [{ studentId: "student-1" }])).toEqual([]);
  });
});