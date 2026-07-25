import { describe, expect, it } from "vitest";
import { createCsv, escapeCsv } from "./csv";

describe("CSV export", () => {
  it("escapes commas, quotes and line breaks", () => {
    expect(escapeCsv('Jones, "Sam"\nNote')).toBe('"Jones, ""Sam""\nNote"');
  });

  it("creates UTF-8 Excel-friendly output", () => {
    const csv = createCsv(["Name", "Status"], [["Zoë", "Present"]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Zoë,Present");
  });
});
