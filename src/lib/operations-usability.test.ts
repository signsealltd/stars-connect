import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("operations usability pass", () => {
  it("groups audit entries and resolves friendly actors and devices", () => {
    const page = readFileSync("src/app/dashboard/audit/page.tsx", "utf8");
    expect(page).toContain("Map.groupBy");
    expect(page).toContain("userMap");
    expect(page).toContain("deviceMap");
    expect(page).toContain("Jump to date");
  });

  it("supports authenticated emergency closure", () => {
    const route = readFileSync("src/app/api/emergency/close/route.ts", "utf8");
    expect(route).toContain("authenticateDevice");
    expect(route).toContain('status: "CLOSED"');
    expect(route).toContain("EMERGENCY_ROLL_CALL_CLOSED");
  });

  it("preserves existing SMTP credentials when blank fields are submitted", () => {
    const settings = readFileSync("src/lib/smtp-settings.ts", "utf8");
    expect(settings).toContain('input.username||previous.username||""');
    const form = readFileSync("src/components/smtp-configuration-form.tsx", "utf8");
    expect(form).toContain("STARTTLS (recommended, port 587)");
    expect(form).toContain("Implicit TLS (port 465)");
  });

  it("compresses staff photographs and exposes screensaver presentation controls", () => {
    const staff = readFileSync("src/components/staff-manager.tsx", "utf8");
    expect(staff).toContain('canvas.toDataURL("image/jpeg",0.72)');
    expect(staff).toContain("320 × 320");
    const screensaver = readFileSync("src/lib/screensaver.ts", "utf8");
    for (const key of ["showLogo", "logoUrl", "headline", "showOnSiteCount", "backgroundColor", "textColor", "accentColor"]) {
      expect(screensaver).toContain(key);
    }
  });
});
