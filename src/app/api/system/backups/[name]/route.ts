import { NextRequest, NextResponse } from "next/server";
import { readFile, unlink } from "fs/promises";
import path from "path";
import { requireRole } from "@/lib/security";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";

export async function GET(_: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try { await requireRole("ADMINISTRATOR"); } catch { return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 }); }
  const { name } = await params;
  if (!/^stars-connect-\d{8}-\d{6}\.sql$/.test(name)) return NextResponse.json({ error: "Backup not found." }, { status: 404 });
  try {
    const directory = path.resolve(process.env.DATABASE_BACKUP_PATH || path.join(process.cwd(), "storage", "backups"));
    const content = await readFile(path.join(directory, name));
    return new NextResponse(content, { headers: { "content-type": "application/sql", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
  } catch { return NextResponse.json({ error: "Backup not found." }, { status: 404 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  let user;
  try { user = await requireRole("ADMINISTRATOR"); } catch { return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 }); }
  const { name } = await params;
  if (!/^stars-connect-\d{8}-\d{6}\.sql$/.test(name)) return NextResponse.json({ error: "Backup not found." }, { status: 404 });
  const directory = path.resolve(process.env.DATABASE_BACKUP_PATH || path.join(process.cwd(), "storage", "backups"));
  const target = path.resolve(directory, name);
  if (path.dirname(target) !== directory) return NextResponse.json({ error: "Backup not found." }, { status: 404 });
  try {
    await unlink(target);
    await audit("DATABASE_BACKUP_DELETED", { actorType: "USER", actorId: user.id, entityType: "DatabaseBackup", entityId: name, ...requestContext(req) });
    return NextResponse.json({ ok: true, name });
  } catch {
    return NextResponse.json({ error: "Backup not found." }, { status: 404 });
  }
}
