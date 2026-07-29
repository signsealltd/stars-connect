import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requestContext, withRole } from "@/lib/api";
import { deleteStoredDocument, loadDocument, storeDocument } from "@/lib/documents";
import { prisma } from "@/lib/prisma";

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRole(req, "DIRECTOR", async user => {
    const { id } = await params;
    const premisesDocument = await prisma.premisesDocument.findFirst({ where: { id, active: true } });
    if (!premisesDocument) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const stored = await prisma.documentRecord.findFirst({
      where: { sourceType: "PREMISES_DOCUMENT", sourceId: id },
      orderBy: { version: "desc" },
    });
    if (!stored) return NextResponse.json({ error: "No uploaded file is attached." }, { status: 404 });
    const content = await loadDocument(stored.storagePath);
    await audit("PREMISES_DOCUMENT_DOWNLOADED", {
      actorType: "USER", actorId: user.id, entityType: "PremisesDocument", entityId: id,
      afterValue: { documentType: premisesDocument.documentType, version: stored.version },
      ...requestContext(req),
    });
    return new NextResponse(content, {
      headers: {
        "content-type": stored.mimeType,
        "content-disposition": `inline; filename="${premisesDocument.title.replace(/[^a-z0-9._-]+/gi, "-")}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withRole(req, "DIRECTOR", async user => {
    const { id } = await params;
    const premisesDocument = await prisma.premisesDocument.findFirst({ where: { id, active: true } });
    if (!premisesDocument) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 422 });
    if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Upload a PDF, JPEG, PNG, Word or Excel file." }, { status: 422 });
    if (!file.size || file.size > MAX_BYTES) return NextResponse.json({ error: "The file must be no larger than 10 MB." }, { status: 422 });

    const previous = await prisma.documentRecord.findFirst({
      where: { sourceType: "PREMISES_DOCUMENT", sourceId: id },
      orderBy: { version: "desc" },
    });
    const now = new Date();
    const stored = await storeDocument({
      documentNumber: `PREMISES-${id}`,
      documentType: "PREMISES_DOCUMENT",
      periodStart: now,
      periodEnd: now,
      version: (previous?.version ?? 0) + 1,
      createdById: user.id,
      generationSource: "USER_UPLOAD",
      sourceType: "PREMISES_DOCUMENT",
      sourceId: id,
      mimeType: file.type,
      content: Buffer.from(await file.arrayBuffer()),
    });
    await prisma.premisesDocument.update({
      where: { id },
      data: { documentUrl: `/api/premises/documents/${id}/file`, updatedById: user.id },
    });
    if (previous) {
      await deleteStoredDocument(previous.storagePath).catch(() => undefined);
      await prisma.documentRecord.delete({ where: { id: previous.id } }).catch(() => undefined);
    }
    await audit("PREMISES_DOCUMENT_FILE_UPLOADED", {
      actorType: "USER", actorId: user.id, entityType: "PremisesDocument", entityId: id,
      afterValue: { mimeType: file.type, fileSize: file.size, version: stored.version, replaced: Boolean(previous) },
      ...requestContext(req),
    });
    return NextResponse.json({ uploaded: true, version: stored.version });
  });
}
