import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/security";

export async function GET(req: NextRequest) {
  return withRole(req, "ADMINISTRATOR", async () => {
    const devices = await prisma.device.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, status: true, appVersion: true, lastSeenAt: true,
        lastSyncAt: true, pendingEventCount: true, currentCursor: true,
        tokenRotatedAt: true, revokedAt: true, createdAt: true,
      },
    });
    return NextResponse.json(devices.map((d) => ({ ...d, currentCursor: String(d.currentCursor) })));
  });
}

export async function POST(req: NextRequest) {
  return withRole(req, "ADMINISTRATOR", async (user) => {
    const parsed = z.object({ name: z.string().trim().min(2).max(120) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Enter a device name.", 422);
    const token = randomBytes(32).toString("base64url");
    const device = await prisma.device.create({
      data: { name: parsed.data.name, tokenHash: sha256(token), tokenRotatedAt: new Date() },
    });
    await audit("DEVICE_PROVISIONED", {
      actorType: "USER", actorId: user.id, entityType: "Device", entityId: device.id,
      afterValue: { name: device.name, status: device.status }, ...requestContext(req),
    });
    return NextResponse.json({
      device: { id: device.id, name: device.name, status: device.status },
      token,
      setupCode: `${device.id}.${token}`,
    }, { status: 201 });
  });
}
