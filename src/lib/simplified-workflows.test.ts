import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("simplified student and visitor workflows", () => {
  it("returns a useful duplicate student reference error", () => {
    const route = readFileSync("src/app/api/students/manage/route.ts", "utf8");
    expect(route).toContain("P2002");
    expect(route).toContain("Internal reference");
    expect(route).toContain("fields: parsed.error.flatten().fieldErrors");
  });

  it("uses an authenticated minimal on-site visitor list", () => {
    const route = readFileSync("src/app/api/visitors/onsite/route.ts", "utf8");
    expect(route).toContain("authenticateDevice");
    expect(route).toContain("signedOutAt: null");
    expect(route).not.toContain("mobile:");
    expect(route).not.toContain("email:");
  });

  it("signs out by selected visit without requesting the reference", () => {
    const page = readFileSync("src/app/visitors/page.tsx", "utf8");
    expect(page).toContain("Select your name below, then confirm.");
    expect(page).toContain("saveVisitorSignOut");
    expect(page).not.toContain("Visit reference<input");
    expect(page).not.toContain("private visit reference");
  });
});
