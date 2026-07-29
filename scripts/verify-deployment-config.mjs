#!/usr/bin/env node
import path from "node:path";
import { execFileSync } from "node:child_process";

const EXPECTED_APP_URL = "https://app.starsconnect.co.uk";
const MINIMUM_NODE = [20, 9, 0];
const SECRET_NAMES = ["REPORT_JOB_SECRET", "CRON_SECRET", "SETTINGS_ENCRYPTION_KEY"];
const STORAGE_NAMES = ["DOCUMENT_STORAGE_PATH", "ATTENDANCE_PHOTO_STORAGE_PATH", "DATABASE_BACKUP_PATH"];

function versionAtLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if ((actual[index] || 0) > minimum[index]) return true;
    if ((actual[index] || 0) < minimum[index]) return false;
  }
  return true;
}

export function deploymentConfigurationErrors(env, pm2Processes, cwd = process.cwd(), nodeVersion = process.versions.node) {
  const errors = [];
  const actualNode = nodeVersion.split(".").map(Number);
  if (!versionAtLeast(actualNode, MINIMUM_NODE)) errors.push("NODE_VERSION: must be at least 20.9.0.");

  if (env.APP_URL !== EXPECTED_APP_URL) errors.push(`APP_URL: must be ${EXPECTED_APP_URL}.`);
  if (env.APP_ENVIRONMENT !== "production") errors.push("APP_ENVIRONMENT: must be production.");
  if (env.COOKIE_SECURE !== "true") errors.push("COOKIE_SECURE: must be true.");
  if (!/^[1-9]\d*$/.test(env.TRUSTED_PROXY_HOPS || "")) errors.push("TRUSTED_PROXY_HOPS: must be an explicitly configured positive integer.");
  if (env.HSTS_INCLUDE_SUBDOMAINS_ACKNOWLEDGED !== "true") errors.push("HSTS_INCLUDE_SUBDOMAINS_ACKNOWLEDGED: explicit true acknowledgement is required.");
  if (env.REVERSE_PROXY_HEADERS_ACKNOWLEDGED !== "true") errors.push("REVERSE_PROXY_HEADERS_ACKNOWLEDGED: explicit true acknowledgement is required.");

  for (const name of SECRET_NAMES) {
    if ((env[name] || "").length < 32) errors.push(`${name}: must exist and contain at least 32 characters.`);
  }

  const webRoot = path.resolve(env.APP_WEB_ROOT || cwd);
  for (const name of STORAGE_NAMES) {
    const value = env[name];
    if (!value) {
      errors.push(`${name}: must be configured.`);
      continue;
    }
    if (!path.isAbsolute(value)) {
      errors.push(`${name}: must be an absolute path.`);
      continue;
    }
    const resolved = path.resolve(value);
    if (resolved === webRoot || resolved.startsWith(`${webRoot}${path.sep}`)) {
      errors.push(`${name}: must be outside APP_WEB_ROOT.`);
    }
  }

  const appName = env.PM2_APP_NAME || "stars-connect";
  const matches = pm2Processes.filter(process => process.name === appName);
  if (matches.length !== 1) errors.push("PM2: exactly one process entry is required for PM2_APP_NAME.");
  if (matches.some(process => process.pm2_env?.exec_mode !== "fork_mode")) errors.push("PM2: process mode must be fork.");
  if (matches.some(process => process.pm2_env?.status !== "online")) errors.push("PM2: the single process must be online.");
  return errors;
}

function loadPm2Processes() {
  if (process.argv.includes("--synthetic")) {
    return [{ name: process.env.PM2_APP_NAME || "stars-connect", pm2_env: { exec_mode: "fork_mode", status: "online" } }];
  }
  try {
    return JSON.parse(execFileSync("pm2", ["jlist"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return [];
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || process.argv[1]?.endsWith("verify-deployment-config.mjs")) {
  const errors = deploymentConfigurationErrors(process.env, loadPm2Processes());
  if (errors.length) {
    console.error("Deployment configuration: FAIL");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Deployment configuration: PASS");
    console.log("- Node, PM2 topology, proxy acknowledgements, production flags, secret lengths and private storage paths passed.");
  }
}
