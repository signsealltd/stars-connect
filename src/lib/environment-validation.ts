import path from "node:path";

export type EnvironmentMap = Record<string, string | undefined>;

const placeholders = /(change[-_ ]?me|replace[-_ ]?me|example|placeholder|development|test[-_ ]?only|your[-_ ])/i;
const requiredSecrets = ["REPORT_JOB_SECRET", "CRON_SECRET", "SETTINGS_ENCRYPTION_KEY"] as const;

function productionMode(env: EnvironmentMap) {
  return env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";
}

function privatePath(name: string, env: EnvironmentMap, cwd: string, errors: string[]) {
  const value = env[name];
  if (!value) {
    errors.push(`${name} is required.`);
    return;
  }
  if (!path.isAbsolute(value)) {
    errors.push(`${name} must be an absolute private path.`);
    return;
  }
  const resolved = path.resolve(value);
  const publicRoot = path.resolve(cwd, "public");
  if (resolved === publicRoot || resolved.startsWith(`${publicRoot}${path.sep}`)) {
    errors.push(`${name} must not be inside the public web root.`);
  }
}

export function productionEnvironmentErrors(env: EnvironmentMap, cwd = process.cwd()) {
  if (!productionMode(env)) return [];
  const errors: string[] = [];
  const databaseUrl = env.DATABASE_URL || "";
  if (!databaseUrl) errors.push("DATABASE_URL is required.");
  else {
    try {
      const parsed = new URL(databaseUrl);
      if (!["mysql:", "mariadb:"].includes(parsed.protocol)) errors.push("DATABASE_URL must use MariaDB/MySQL.");
      if (!parsed.password || placeholders.test(parsed.password)) errors.push("DATABASE_URL must contain a non-placeholder database credential.");
      if (/(^|[_-])(test|demo|example)([_-]|$)/i.test(parsed.pathname.slice(1))) errors.push("DATABASE_URL must not target a test or demonstration database.");
    } catch {
      errors.push("DATABASE_URL is not a valid connection URL.");
    }
  }

  const appUrl = env.APP_URL || env.NEXT_PUBLIC_APP_URL || "";
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(parsed.hostname) || placeholders.test(parsed.hostname)) {
      errors.push("APP_URL must be a non-placeholder HTTPS production URL.");
    }
  } catch {
    errors.push("APP_URL must be a valid HTTPS production URL.");
  }

  for (const name of requiredSecrets) {
    const value = env[name] || "";
    if (value.length < 32 || placeholders.test(value)) errors.push(`${name} must be at least 32 characters and must not be a placeholder.`);
  }

  if (env.APP_ENV === "development" || env.APP_ENV === "test" || env.APP_ENVIRONMENT !== "production") {
    errors.push("Production runtime flags are inconsistent.");
  }
  if (env.COOKIE_SECURE !== "true") errors.push("COOKIE_SECURE must be true in production.");
  const emailMode = env.EMAIL_DELIVERY_MODE;
  if (!["smtp", "database-smtp"].includes(emailMode || "")) {
    errors.push("EMAIL_DELIVERY_MODE must select a real SMTP mode in production.");
  }
  if (emailMode === "smtp" && (!env.SMTP_HOST || !env.SMTP_FROM_EMAIL)) {
    errors.push("SMTP host and sender identity are required for environment SMTP mode.");
  }

  privatePath("DOCUMENT_STORAGE_PATH", env, cwd, errors);
  privatePath("ATTENDANCE_PHOTO_STORAGE_PATH", env, cwd, errors);
  privatePath("DATABASE_BACKUP_PATH", env, cwd, errors);
  return errors;
}

export function validateProductionEnvironment(env: EnvironmentMap = process.env) {
  const errors = productionEnvironmentErrors(env);
  if (errors.length) throw new Error(`Unsafe production configuration:\n- ${errors.join("\n- ")}`);
}
