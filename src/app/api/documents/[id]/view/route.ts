import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";
import { loadDocument } from "@/lib/documents";
import { CAPABILITIES, requireCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCapability(CAPABILITIES.DOCUMENT_DOWNLOAD);
  const { id } = await params;
  const document = await prisma.documentRecord.findUnique({ where: { id } });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (document.mimeType !== "application/pdf") return NextResponse.json({ error: "Only PDF documents can be viewed in the browser." }, { status: 422 });
  const data = await loadDocument(document.storagePath);
  await audit("DOCUMENT_VIEWED", { actorType: "USER", actorId: user.id, entityType: "DocumentRecord", entityId: id, afterValue: { documentType: document.documentType, version: document.version }, ...requestContext(req) });
  return new NextResponse(data, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${document.documentNumber}-v${document.version}.pdf"`, "cache-control": "private, no-store" } });
}
