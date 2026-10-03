import { describe, expect, it } from "vitest";
import { clientAttendanceExport } from "./client-attendance-export";
const client = (name: string, id = name) => ({ id, firstName: name, lastName: "Example", displayName: "Nickname", internalReference: "REF-123" });
describe("active client attendance PDF", () => {
  it("prints full names alphabetically in landscape with reference and a blank count column", () => {
    const pdf = clientAttendanceExport([client("Zoe"), client("Adam")], "03/10/2026", "STARS").toString();
    expect(pdf).toContain("/MediaBox [0 0 842 595]");
    expect(pdf.indexOf("Adam Example")).toBeLessThan(pdf.indexOf("Zoe Example"));
    expect(pdf).toContain("REF-123");
    expect(pdf).toContain("Attendance count");
    expect(pdf).not.toContain("Nickname");
  });
  it("paginates without losing rows and repeats headings", () => {
    const pdf = clientAttendanceExport(Array.from({length: 40}, (_, i) => client(`Client ${i}`)), "03/10/2026", "STARS").toString();
    expect(pdf).toContain("/Count 4");
    expect(pdf.match(/Attendance count/g)).toHaveLength(4);
    expect(pdf.match(/REF-123/g)).toHaveLength(40);
    expect(pdf).toContain("Page 4 of 4");
  });
  it("handles an empty list and missing references", () => {
    expect(clientAttendanceExport([], "Today", "STARS").toString()).toContain("No active clients.");
    expect(clientAttendanceExport([{...client("Adam"),internalReference:null}], "Today", "STARS").toString()).toContain("Not recorded");
  });
});
