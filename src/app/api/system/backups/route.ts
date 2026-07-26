import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { mkdir, readdir, stat } from "fs/promises";
import path from "path";
import { promisify } from "util";
import packageInfo from "../../../../../package.json";
import { withRole, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";

const run = promisify(execFile);
const backupDirectory = () => path.resolve(process.env.DATABASE_BACKUP_PATH || path.join(process.cwd(), "storage", "backups"));
async function backups() {
  await mkdir(backupDirectory(), { recursive: true });
  const names = (await readdir(backupDirectory())).filter((name) => /^stars-connect-\d{8}-\d{6}\.sql$/.test(name));
  return Promise.all(names.map(async (name) => { const info = await stat(path.join(backupDirectory(), name)); return { name, size: info.size, createdAt: info.birthtime.toISOString() }; }));
}

export async function GET(req: NextRequest) {
  return withRole(req, "ADMINISTRATOR", async () => NextResponse.json({
    version: packageInfo.version,
    commit: process.env.GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_GIT_COMMIT_SHA || "Not supplied",
    environment: process.env.APP_ENVIRONMENT || process.env.NODE_ENV || "unknown",
    backups: (await backups()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }));
}

export async function POST(req: NextRequest) {
  return withRole(req, "ADMINISTRATOR", async (user) => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
    const url = new URL(databaseUrl);
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
    const name = `stars-connect-${stamp}.sql`;
    await mkdir(backupDirectory(), { recursive: true });
    const target = path.join(backupDirectory(), name);
    const binary = process.env.MARIADB_DUMP_PATH || "mariadb-dump";
    try {
      await run(binary, ["--single-transaction", "--routines", "--triggers", "--events", "--default-character-set=utf8mb4", `--host=${url.hostname}`, `--port=${url.port || "3306"}`, `--user=${decodeURIComponent(url.username)}`, `--result-file=${target}`, decodeURIComponent(url.pathname.replace(/^\//, ""))], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, timeout: 300_000, windowsHide: true });
      const info = await stat(target);
      await audit("DATABASE_BACKUP_CREATED", { actorType: "USER", actorId: user.id, entityType: "DatabaseBackup", entityId: name, afterValue: { name, size: info.size }, ...requestContext(req) });
      return NextResponse.json({ name, size: info.size, createdAt: info.birthtime.toISOString() }, { status: 201 });
    } catch {
      await audit("DATABASE_BACKUP_FAILED", { actorType: "USER", actorId: user.id, afterValue: { category: "DUMP_COMMAND_FAILED" }, ...requestContext(req) });
      return NextResponse.json({ error: "The database backup could not be created. Check the MariaDB dump path and backup directory permissions." }, { status: 500 });
    }
  });
}