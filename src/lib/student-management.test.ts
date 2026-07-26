import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = () => readFileSync(join(process.cwd(), "src/app/api/students/manage/[id]/route.ts"), "utf8");

describe("student management updates", () => {
  it("accepts blank optional form fields and stores them as null", () => {
    const source = route();
    expect(source.match(/or\(z\.literal\(""\)\)/g)).toHaveLength(5);
    expect(source).toContain("fundingCategory: d.fundingCategory || null");
    expect(source).toContain("fundingOrganisation: d.fundingOrganisation || null");
    expect(source).toContain("internalReference: d.internalReference || null");
    expect(source).toContain("notes: d.notes || null");
  });
});