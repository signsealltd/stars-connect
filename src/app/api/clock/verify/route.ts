import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { authenticateDevice } from "@/lib/device-auth";
import { requestContext } from "@/lib/api";

const schema = z.object({ pin: z.string().regex(/^\d{4,8}$/) });

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) return NextResponse.json({ error: "This tablet is not authorised." }, { status: 401 });
  const rate = rateLimit(`pin:${device.id}`, 10, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "PIN not recognised" }, { status: 401 });
  const credential = await prisma.staffCredential.findFirst({
    where: { kind: "PIN", lookupHash: sha256(parsed.data.pin), active: true },
    include: { staff: true },
  });
  if (!credential || !credential.staff.active || !credential.staff.clockingEnabled || !await bcrypt.compare(parsed.data.pin, credential.valueHash)) {
    await audit("STAFF_PIN_FAILED", { actorType: "DEVICE", deviceId: device.id, ...requestContext(req) });
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: "PIN not recognised" }, { status: 401 });
  }
  const [last, cameraSetting] = await Promise.all([
    prisma.clockEvent.findFirst({ where: { staffId: credential.staffId }, orderBy: { deviceTimestamp: "desc" } }),
    prisma.appSetting.findUnique({ where: { key: "cameraMode" } }),
  ]);
  const cameraMode = typeof cameraSetting?.value === "string" ? cameraSetting.value : "OPTIONAL";
  const cameraRequired = cameraMode === "REQUIRED_ALL" || (cameraMode === "REQUIRED_SELECTED" && credential.staff.cameraRequired);
  await audit("STAFF_PIN_VERIFIED", { actorType: "DEVICE", deviceId: device.id, entityType: "StaffMember", entityId: credential.staffId, ...requestContext(req) });
  return NextResponse.json({
    staffId: credential.staffId,
    displayName: credential.staff.displayName,
    nextAction: last?.type === "CLOCK_IN" ? "CLOCK_OUT" : "CLOCK_IN",
    cameraMode,
    cameraRequired,
  });
}
