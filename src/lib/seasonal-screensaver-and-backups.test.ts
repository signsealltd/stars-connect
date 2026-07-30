import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { screensaverSchema } from "./screensaver";

describe("seasonal screensaver and managed backups", () => {
  it.each(["constellation", "halloween", "christmas", "st-patricks"])("accepts the %s animation preset", (style) => {
    const defaults = JSON.parse(JSON.stringify({
      screensaverEnabled: true, idleTimeoutSeconds: 30, showLogo: true, logoUrl: "/branding/stars-logo.svg",
      headline: "STARS", showClock: true, showDate: true, showOnSiteCount: false, screensaverMessage: "Touch",
      showDeviceName: true, screensaverWeatherEnabled: true, screensaverWeatherLocation: "Enfield, London",
      constellationEnabled: true, constellationIntensity: 35, backgroundAnimationStyle: style, wakeTransitionSeconds: 1.25,
      backgroundColor: "#050407", textColor: "#ffffff", accentColor: "#dec8e4", dayModeStart: "07:00",
      eveningModeStart: "19:00", nightModeStart: "22:00", dayDimLevel: 45, eveningDimLevel: 25,
      nightDimLevel: 10, deviceLocationName: "",
    }));
    expect(screensaverSchema.safeParse(defaults).success).toBe(true);
  });

  it("keeps the overlay active during the configured wake fade", () => {
    const controller = readFileSync("src/components/kiosk-idle-controller.tsx", "utf8");
    expect(controller).toContain("settings.wakeTransitionSeconds*1000");
    expect(controller).toContain("if(waking)return");
    expect(controller).toContain('waking?" waking":""');
  });

  it("only permits named managed backup files to be deleted and audits deletion", () => {
    const route = readFileSync("src/app/api/system/backups/[name]/route.ts", "utf8");
    expect(route).toContain("export async function DELETE");
    expect(route).toContain("DATABASE_BACKUP_DELETED");
    expect(route).toContain("path.dirname(target) !== directory");
    expect(route).toContain("stars-connect-\\d{8}-\\d{6}");
  });
});

