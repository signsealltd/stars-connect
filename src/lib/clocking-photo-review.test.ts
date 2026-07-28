import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (file: string) => readFileSync(file, "utf8");

describe("clocking photograph review", () => {
  it("restricts the review page and image delivery to directors and administrators", () => {
    expect(source("src/app/dashboard/reports/clocking-photos/page.tsx")).toContain('requireRole("DIRECTOR")');
    expect(source("src/app/api/attendance-photos/[id]/route.ts")).toContain('withRole(req, "DIRECTOR"');
  });

  it("keeps photographs private, retention-aware and audited", () => {
    const route = source("src/app/api/attendance-photos/[id]/route.ts");
    expect(route).toContain('"cache-control": "private, no-store, max-age=0"');
    expect(route).toContain("photo.expiresAt <= new Date()");
    expect(route).toContain("ATTENDANCE_PHOTO_VIEWED");
    expect(route).toContain("path.relative(photoRoot, resolved)");
  });

  it("does not load an image until an authorised reviewer selects it", () => {
    const component = source("src/components/clocking-photo-review.tsx");
    expect(component).toContain("selected &&");
    expect(component).toContain("/api/attendance-photos/");
    expect(component).toContain("Access to this photograph has been recorded");
  });
});
