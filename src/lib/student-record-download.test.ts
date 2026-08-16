import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("complete student record download", () => {
  const route = readFileSync("src/app/api/students/records/[id]/pdf/route.ts", "utf8");
  const manager = readFileSync("src/components/student-manager-v2.tsx", "utf8");

  it("uses protected server-side generation with private download headers and audit", () => {
    expect(route).toContain("CAPABILITIES.DOCUMENT_DOWNLOAD");
    expect(route).toContain("STUDENT_RECORD_PDF_DOWNLOADED");
    expect(route).toContain('"cache-control": "private, no-store"');
    expect(route).toContain('"x-content-type-options": "nosniff"');
    expect(route).not.toContain("storeDocument(");
  });

  it("offers the download from an existing student profile", () => {
    expect(manager).toContain("Download complete record PDF");
    expect(manager).toContain("/api/students/records/${current.id}/pdf");
  });
});
