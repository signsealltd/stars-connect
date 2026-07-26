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
  const rate = rateLimit(`register-pin:${device.id}`, 10, 60_000);
  if (!rate.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "PIN not recognised" }, { status: 401 });
  const credential = await prisma.staffCredential.findFirst({
    where: { kind: "PIN", lookupHash: sha256(parsed.data.pin), active: true },
    include: { staff: true },
  });
  if (!credential || !credential.staff.active || !await bcrypt.compare(parsed.data.pin, credential.valueHash)) {
    await audit("REGISTER_PIN_FAILED", { actorType: "DEVICE", deviceId: device.id, ...requestContext(req) });
    await new Promise((resolve) => setTimeout(resolve, 400));
    return NextResponse.json({ error: "PIN not recognised" }, { status: 401 });
  }
  await audit("REGISTER_UNLOCKED", { actorType: "DEVICE", deviceId: device.id, entityType: "StaffMember", entityId: credential.staffId, ...requestContext(req) });
  return NextResponse.json({ ok: true, displayName: credential.staff.displayName });
}