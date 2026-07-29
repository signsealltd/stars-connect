import { describe, expect, it } from "vitest";
import { productionEnvironmentErrors } from "./environment-validation";

const safe = {
  NODE_ENV: "production",
  NEXT_PHASE: "phase-production-server",
  DATABASE_URL: "mysql://stars_runtime:a-strong-database-passphrase@127.0.0.1:3306/starsconnect",
  APP_URL: "https://app.starsconnect.co.uk",
  APP_ENV: "production",
  APP_ENVIRONMENT: "production",
  COOKIE_SECURE: "true",
  EMAIL_DELIVERY_MODE: "database-smtp",
  REPORT_JOB_SECRET: "r".repeat(48),
  CRON_SECRET: "c".repeat(48),
  SETTINGS_ENCRYPTION_KEY: "e".repeat(48),
  DOCUMENT_STORAGE_PATH: "/srv/stars-connect/documents",
  ATTENDANCE_PHOTO_STORAGE_PATH: "/srv/stars-connect/attendance-photos",
  DATABASE_BACKUP_PATH: "/srv/stars-connect/backups",
};

describe("production environment validation", () => {
  it("accepts a complete non-placeholder production configuration", () => {
    expect(productionEnvironmentErrors(safe, "/srv/stars-connect/app")).toEqual([]);
  });

  it("rejects secrets safely without including their values", () => {
    const errors = productionEnvironmentErrors({ ...safe, CRON_SECRET: "change-me", REPORT_JOB_SECRET: "", SETTINGS_ENCRYPTION_KEY: "short" }, "/srv/stars-connect/app");
    expect(errors).toHaveLength(3);
    expect(errors.join(" ")).not.toContain("change-me");
  });

  it("rejects test flags, demo databases, mock email and insecure cookies", () => {
    const errors = productionEnvironmentErrors({
      ...safe,
      DATABASE_URL: "mysql://stars_runtime:strong-password@db:3306/stars_connect_test",
      APP_ENVIRONMENT: "test",
      COOKIE_SECURE: "false",
      EMAIL_DELIVERY_MODE: "mock",
    }, "/srv/stars-connect/app");
    expect(errors.some(error => error.includes("test or demonstration"))).toBe(true);
    expect(errors.some(error => error.includes("runtime flags"))).toBe(true);
    expect(errors.some(error => error.includes("COOKIE_SECURE"))).toBe(true);
    expect(errors.some(error => error.includes("real SMTP"))).toBe(true);
  });

  it("rejects public and relative private-storage paths", () => {
    const errors = productionEnvironmentErrors({
      ...safe,
      DOCUMENT_STORAGE_PATH: "/srv/stars-connect/app/public/documents",
      ATTENDANCE_PHOTO_STORAGE_PATH: "photos",
    }, "/srv/stars-connect/app");
    expect(errors.some(error => error.includes("public web root"))).toBe(true);
    expect(errors.some(error => error.includes("absolute private path"))).toBe(true);
  });

  it("does not enforce runtime-only values during build or non-production execution", () => {
    expect(productionEnvironmentErrors({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toEqual([]);
    expect(productionEnvironmentErrors({ NODE_ENV: "test" })).toEqual([]);
  });
});
