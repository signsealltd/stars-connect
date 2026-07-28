import { describe, expect, it } from "vitest";
import {
  DISPOSABLE_SEED_ACKNOWLEDGEMENT,
  assertDisposableSeedEnvironment,
  disposableSeedContext,
} from "./seed-safety";

const safe = {
  NODE_ENV: "test",
  APP_ENVIRONMENT: "test",
  DATABASE_URL: "mysql://seed:seed@mariadb:3306/stars_connect_test",
  DISPOSABLE_DATABASE_ACKNOWLEDGEMENT: DISPOSABLE_SEED_ACKNOWLEDGEMENT,
};

describe("production-safe seed gate", () => {
  it("accepts an explicitly acknowledged disposable database", () => {
    expect(() => assertDisposableSeedEnvironment(safe)).not.toThrow();
  });

  it.each([
    [{ ...safe, DISPOSABLE_DATABASE_ACKNOWLEDGEMENT: "" }, "acknowledgement"],
    [{ ...safe, NODE_ENV: "production" }, "production"],
    [{ ...safe, DATABASE_URL: "mysql://seed:seed@db:3306/starsconnect" }, "not explicitly disposable"],
    [{ ...safe, DATABASE_URL: "mysql://seed:seed@production-db:3306/stars_connect_test" }, "allowlist"],
    [{ ...safe, DATABASE_URL: "not-a-url" }, "invalid"],
  ])("refuses unsafe configuration before a client is created", (environment, reason) => {
    expect(() => assertDisposableSeedEnvironment(environment)).toThrow(reason);
  });

  it("generates non-fixed credentials without exposing them through logs", () => {
    const first = disposableSeedContext(safe);
    const second = disposableSeedContext(safe);
    expect(first.generatedPassword).not.toBe(second.generatedPassword);
    expect(first.generatedDeviceToken()).not.toBe(first.generatedDeviceToken());
    expect(first.generatedPassword.length).toBeGreaterThanOrEqual(32);
  });
});
