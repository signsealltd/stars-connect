import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateDevice } from "@/lib/device-auth";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";

const schema = z.object({ rollCallId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) return NextResponse.json({ error: "This device is not authorised." }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid roll call is required." }, { status: 422 });
  const result = await prisma.emergencyRollCall.updateMany({
    where: { id: parsed.data.rollCallId, status: "ACTIVE" },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  if (!result.count) return NextResponse.json({ error: "The active roll call was not found. Synchronise the device and retry." }, { status: 404 });
  await audit("EMERGENCY_ROLL_CALL_CLOSED", { actorType: "DEVICE", deviceId: device.id, entityType: "EmergencyRollCall", entityId: parsed.data.rollCallId, ...requestContext(req) });
  return NextResponse.json({ ok: true });
}
