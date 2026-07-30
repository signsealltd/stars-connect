import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, requestContext, withRole } from "@/lib/api";
import { LAUNCH_CLEANUP_CONFIRMATION, clearLaunchData, launchCleanupConfirmed } from "@/lib/launch-cleanup";
import { deleteStoredDocument } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { ensureVisitorConfiguration } from "@/lib/visitor-defaults";

export async function POST(req: NextRequest) {
  return withRole(req, "ADMINISTRATOR", async actor => {
    const body = await req.json().catch(() => null);
    if (!launchCleanupConfirmed(body?.confirmation)) {
      return jsonError(`Type ${LAUNCH_CLEANUP_CONFIRMATION} to confirm.`, 422);
    }
    if (!body?.password || !await bcrypt.compare(String(body.password), actor.passwordHash)) {
      return jsonError("Your administrator password was not accepted.", 401);
    }

    const context = requestContext(req);
    const storedDocuments = await prisma.documentRecord.findMany({ select: { storagePath: true } });
    const counts = await prisma.$transaction(async tx => {
      const removed = await clearLaunchData(tx);
      await ensureVisitorConfiguration(tx);
      await tx.auditLog.create({
        data: {
          action: "LAUNCH_DATA_CLEANUP_COMPLETED",
          actorType: "USER",
          actorId: actor.id,
          entityType: "System",
          afterValue: {
            ...removed,
            preserved: "User accounts, password hashes and login sessions",
            restored: "Safe default visitor reasons and site rules",
          },
          ...context,
        },
      });
      return removed;
    }, { timeout: 120_000 });

    const deletionResults = await Promise.allSettled(
      storedDocuments.map(document => deleteStoredDocument(document.storagePath)),
    );
    const fileDeletionFailures = deletionResults.filter(result => result.status === "rejected").length;

    return NextResponse.json({
      counts,
      fileDeletionFailures,
      summary: "Launch cleanup complete. Login accounts were preserved; operational data was removed and essential visitor defaults were restored.",
      reprovisionDevices: true,
    });
  });
}
