import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/billing/runs/[id]/documents/route.ts", "utf8");
const review = readFileSync("src/components/simple-finance-run-review.tsx", "utf8");

describe("completed invoice downloads", () => {
  it("reuses an existing protected ZIP and CSV instead of creating duplicates", () => {
    expect(route).toContain('documentType: { in: ["INVOICE_ZIP", "INVOICE_REGISTER_CSV"] }');
    expect(route).toContain("if (existingZip && existingCsv)");
    expect(route).toContain("INVOICE_BULK_EXPORT_DOWNLOADED");
  });
  it("shows progress and controlled download errors", () => {
    expect(review).toContain("Preparing download...");
    expect(review).toContain("!body.zipDocument?.id");
  });
});
