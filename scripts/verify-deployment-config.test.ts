import { describe, expect, it } from "vitest";
import { deploymentConfigurationErrors } from "./verify-deployment-config.mjs";

const safe = {
  APP_URL: "https://app.starsconnect.co.uk",
  APP_ENVIRONMENT: "production",
  COOKIE_SECURE: "true",
  TRUSTED_PROXY_HOPS: "1",
  HSTS_INCLUDE_SUBDOMAINS_ACKNOWLEDGED: "true",
  REVERSE_PROXY_HEADERS_ACKNOWLEDGED: "true",
  REPORT_JOB_SECRET: "r".repeat(32),
  CRON_SECRET: "c".repeat(32),
  SETTINGS_ENCRYPTION_KEY: "s".repeat(32),
  APP_WEB_ROOT: "/var/www/vhosts/starsconnect.co.uk/app.starsconnect.co.uk",
  DOCUMENT_STORAGE_PATH: "/var/lib/stars-connect/documents",
  ATTENDANCE_PHOTO_STORAGE_PATH: "/var/lib/stars-connect/attendance-photos",
  DATABASE_BACKUP_PATH: "/var/backups/stars-connect",
  PM2_APP_NAME: "stars-connect",
};

const pm2 = [{ name: "stars-connect", pm2_env: { exec_mode: "fork_mode", status: "online" } }];

describe("deployment configuration verification", () => {
  it("accepts a safe single-process synthetic VPS configuration", () => {
    expect(deploymentConfigurationErrors(safe, pm2, safe.APP_WEB_ROOT, "20.9.0")).toEqual([]);
  });

  it("reports names and safe reasons without secret values", () => {
    const secret = "do-not-print-this";
    const errors = deploymentConfigurationErrors({
      ...safe,
      REPORT_JOB_SECRET: secret,
      TRUSTED_PROXY_HOPS: "",
      DOCUMENT_STORAGE_PATH: `${safe.APP_WEB_ROOT}/public/files`,
    }, [], safe.APP_WEB_ROOT, "18.20.0");
    const output = errors.join(" ");
    expect(output).toContain("REPORT_JOB_SECRET");
    expect(output).toContain("TRUSTED_PROXY_HOPS");
    expect(output).toContain("DOCUMENT_STORAGE_PATH");
    expect(output).toContain("NODE_VERSION");
    expect(output).not.toContain(secret);
  });

  it("rejects cluster mode and multiple application processes", () => {
    const cluster = [
      { name: "stars-connect", pm2_env: { exec_mode: "cluster_mode", status: "online" } },
      { name: "stars-connect", pm2_env: { exec_mode: "cluster_mode", status: "online" } },
    ];
    expect(deploymentConfigurationErrors(safe, cluster, safe.APP_WEB_ROOT, "22.0.0").some(error => error.startsWith("PM2:"))).toBe(true);
  });
});
