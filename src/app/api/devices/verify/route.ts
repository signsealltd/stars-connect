import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { safeEqual, sha256 } from "@/lib/security";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";

export async function POST(req: NextRequest) {
  const context = requestContext(req);
  const rate = rateLimit(`provision:${context.ipAddress || "local"}`, 8, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  const parsed = z.object({ setupCode: z.string().min(40).max(200) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The setup code is not valid." }, { status: 400 });
  const dot = parsed.data.setupCode.indexOf(".");
  if (dot < 1) return NextResponse.json({ error: "The setup code is not valid." }, { status: 400 });
  const id = parsed.data.setupCode.slice(0, dot);
  const token = parsed.data.setupCode.slice(dot + 1);
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || device.status !== "ACTIVE" || !safeEqual(device.tokenHash, sha256(token))) {
    await audit("DEVICE_SETUP_FAILED", { actorType: "DEVICE", deviceId: id, ...context });
    return NextResponse.json({ error: "The setup code is invalid or the device has been revoked." }, { status: 401 });
  }
  await prisma.device.update({ where: { id }, data: { lastSeenAt: new Date() } });
  await audit("DEVICE_SETUP_COMPLETED", { actorType: "DEVICE", deviceId: id, entityType: "Device", entityId: id, ...context });
  return NextResponse.json({ id: device.id, name: device.name, token });
}
