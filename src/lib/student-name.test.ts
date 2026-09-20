import { describe, expect, it } from "vitest";
import { studentFullName } from "./student-name";

describe("studentFullName", () => {
  it("uses the client's first and last name instead of their known-as name", () => {
    expect(studentFullName({ firstName: "Elizabeth", lastName: "Jones", displayName: "Elif" })).toBe("Elizabeth Jones");
  });

  it("falls back safely when legacy records do not contain both name fields", () => {
    expect(studentFullName({ displayName: "Elif" })).toBe("Elif");
  });
});
