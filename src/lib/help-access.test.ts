import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(join(process.cwd(), "src/components/help-training-system.tsx"), "utf8");

describe("help access", () => {
  it("does not render help on public kiosk routes and requires a manager session", () => {
    expect(component).not.toContain("kioskRoots");
    expect(component).toContain('fetch("/api/auth/me"');
    expect(component).toContain("if(!isManager||!authorised)return null");
    expect(component).toContain('"/help"');
  });
});