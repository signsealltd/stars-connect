import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";

const photoRoot = path.resolve(
  process.env.ATTENDANCE_PHOTO_STORAGE_PATH ||
    path.join(process.cwd(), ".data", "attendance-photos"),
);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withRole(req, "DIRECTOR", async (user) => {
    const { id } = await context.params;
    const photo = await prisma.attendancePhoto.findUnique({
      where: { id },
      include: {
        clockEvent: {
          select: {
            id: true,
            staffId: true,
            deviceTimestamp: true,
            type: true,
          },
        },
      },
    });
    if (!photo) return jsonError("Photograph not found.", 404);
    if (photo.deletedAt || photo.expiresAt <= new Date()) {
      return jsonError("This photograph has reached the end of its retention period.", 410);
    }

    const resolved = path.resolve(photo.storagePath);
    const relative = path.relative(photoRoot, resolved);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      return jsonError("Photograph storage path is invalid.", 409);
    }

    const contents = await readFile(resolved).catch(() => null);
    if (!contents) return jsonError("The photograph file is unavailable.", 404);

    await audit("ATTENDANCE_PHOTO_VIEWED", {
      actorType: "USER",
      actorId: user.id,
      entityType: "AttendancePhoto",
      entityId: photo.id,
      afterValue: {
        clockEventId: photo.clockEvent.id,
        staffId: photo.clockEvent.staffId,
        eventType: photo.clockEvent.type,
        eventTime: photo.clockEvent.deviceTimestamp,
      },
      ...requestContext(req),
    });

    return new NextResponse(contents, {
      headers: {
        "content-type": photo.mimeType,
        "content-length": String(contents.length),
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": `inline; filename="clocking-${photo.clockEvent.id}.jpg"`,
        "x-content-type-options": "nosniff",
      },
    });
  });
}
