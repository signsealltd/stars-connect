import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("device battery preference migration", () => {
  it("is additive and gives existing devices the safe visible default", () => {
    const sql = readFileSync(
      "prisma/migrations/202607290001_configurable_device_battery_display/migration.sql",
      "utf8",
    );
    expect(sql).toMatch(/ADD COLUMN `showBatteryStatus` BOOLEAN NOT NULL DEFAULT true/i);
    expect(sql).toMatch(/ADD COLUMN `deviceType` ENUM\('KIOSK_TABLET', 'MANAGER_DESKTOP'\) NOT NULL DEFAULT 'KIOSK_TABLET'/i);
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE)\b/i);
  });
});
