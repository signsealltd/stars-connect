import { randomBytes } from "node:crypto";

export const DISPOSABLE_SEED_ACKNOWLEDGEMENT = "STARS_CONNECT_DISPOSABLE_TEST_DATA_ONLY";

export type SeedEnvironment = Record<string, string | undefined>;

export function assertDisposableSeedEnvironment(env: SeedEnvironment) {
  if (env.DISPOSABLE_DATABASE_ACKNOWLEDGEMENT !== DISPOSABLE_SEED_ACKNOWLEDGEMENT) {
    throw new Error("Seed refused: explicit disposable-database acknowledgement is required.");
  }
  if ([env.NODE_ENV, env.APP_ENV, env.APP_ENVIRONMENT].some(value => value === "production")) {
    throw new Error("Seed refused: production runtime flags are not permitted.");
  }
  if (!env.DATABASE_URL) throw new Error("Seed refused: DATABASE_URL is required.");

  let parsed: URL;
  try {
    parsed = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("Seed refused: DATABASE_URL is invalid.");
  }
  if (!["mysql:", "mariadb:"].includes(parsed.protocol)) throw new Error("Seed refused: a disposable MariaDB/MySQL URL is required.");
  const database = parsed.pathname.slice(1);
  if (!/(?:^|_)(?:test|testing|dev|development|demo|disposable)(?:$|_)/i.test(database)) {
    throw new Error("Seed refused: database name is not explicitly disposable.");
  }
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "mariadb", "db"]);
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
    throw new Error("Seed refused: database host is not in the disposable-host allowlist.");
  }
}

export function disposableSeedContext(env: SeedEnvironment) {
  assertDisposableSeedEnvironment(env);
  return {
    generatedPassword: randomBytes(24).toString("base64url"),
    generatedDeviceToken: () => randomBytes(32).toString("base64url"),
  };
}
