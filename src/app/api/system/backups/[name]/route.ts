import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requireRole } from "@/lib/security";

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