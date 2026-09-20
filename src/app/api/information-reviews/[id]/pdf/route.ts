import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCapability, requestContext } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { simplePdf } from "@/lib/documents";

const printable = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Not supplied";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withCapability(req, CAPABILITIES.INFORMATION_REVIEW_VIEW, async user => {
    if (!user.organisationId) return NextResponse.json({ error: "Organisation is not configured." }, { status: 409 });
    const review = await prisma.informationReviewRequest.findFirst({
      where: { id: (await params).id, organisationId: user.organisationId },
      include: { student: { select: { displayName: true, internalReference: true } }, submissions: { orderBy: { version: "desc" }, take: 1 }, proposals: { orderBy: [{ category: "asc" }, { fieldKey: "asc" }] } },
    });
    if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
    const submission = review.submissions[0];
    const lines = [
      `Client: ${review.student.displayName}`,
      `Reference: ${review.student.internalReference || "Not configured"}`,
      `Status: ${review.status.replaceAll("_", " ")}`,
      `Created: ${review.createdAt.toLocaleString("en-GB")}`,
      `Submitted: ${review.submittedAt?.toLocaleString("en-GB") || "Not submitted"}`,
      `Completed: ${review.completedAt?.toLocaleString("en-GB") || "Not completed"}`,
      `Declaration: ${submission ? `${submission.declarationName} (${submission.declarationCapacity}), ${submission.declaredAt.toLocaleString("en-GB")}` : "Not submitted"}`,
      "",
      "Field decisions",
      ...review.proposals.flatMap(item => [
        `${item.category} - ${item.fieldKey}: ${item.status}${item.critical ? " [critical]" : ""}`,
        `Current: ${printable(item.currentValue)}`,
        `Submitted: ${printable(item.submittedValue)}`,
      ]),
    ];
    const pdf = simplePdf("Annual information review record", lines);
    await audit("INFORMATION_REVIEW_PDF_DOWNLOADED", { actorType: "USER", actorId: user.id, entityType: "InformationReviewRequest", entityId: review.id, ...requestContext(req) });
    const filename = `information-review-${review.student.internalReference || review.student.displayName}`.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
    return new NextResponse(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${filename}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  });
}
