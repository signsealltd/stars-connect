import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { organisationDefaults } from "./organisation-settings";
import { preferenceDefaults, quickActionOptions } from "./user-preferences";
import { themePresets } from "./theme-presets";

describe("organisation and user personalisation", () => {
  it("keeps the STARS purple theme as the default", () => {
    expect(organisationDefaults.themePrimary).toBe("#82368c");
    expect(organisationDefaults.themePrimaryDark).toBe("#54205d");
    expect(organisationDefaults.themePreset).toBe("default");
    expect(Object.keys(themePresets)).toHaveLength(6);
  });

  it("provides user-specific display and quick-action defaults", () => {
    expect(preferenceDefaults.colourMode).toBe("light");
    expect(preferenceDefaults.quickActions).toContain("emergency");
    expect(quickActionOptions.some((item) => item.href === "/dashboard/premises")).toBe(true);
  });

  it("does not use native browser confirmation APIs", () => {
    const files = [
      "src/components/device-manager.tsx",
      "src/components/finance-console.tsx",
      "src/components/user-manager.tsx",
      "src/app/emergency/page.tsx",
    ].map((file) => readFileSync(file, "utf8")).join("\n");
    expect(files).not.toMatch(/\b(confirm|prompt|alert)\s*\(/);
    expect(files).toContain("appConfirm");
  });

  it("suppresses PIN autofill without exposing the PIN", () => {
    const staff = readFileSync("src/components/staff-manager.tsx", "utf8");
    expect(staff).toContain('name="staff-pin-entry"');
    expect(staff).toContain('data-lpignore="true"');
    expect(staff).toContain("pin-entry-secure");
  });
});
