import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateDevice } from "@/lib/device-auth";
import { audit } from "@/lib/audit";
import { requestContext, withRole } from "@/lib/api";

const schema = z.object({ rollCallId: z.string().uuid() });

async function closeActiveRollCall(rollCallId: string, closedByUserId?: string) {
  const existing = await prisma.emergencyRollCall.findUnique({
    where: { id: rollCallId },
    select: { status: true },
  });
  if (!existing) return "missing" as const;
  if (existing.status === "CLOSED") return "closed" as const;
  await prisma.emergencyRollCall.update({
    where: { id: rollCallId },
    data: { status: "CLOSED", closedAt: new Date(), closedByUserId: closedByUserId ?? null },
  });
  return "updated" as const;
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid roll call is required." }, { status: 422 });

  const device = await authenticateDevice(req);
  if (device) {
    const result = await closeActiveRollCall(parsed.data.rollCallId);
    if (result === "missing") return NextResponse.json({ error: "The roll call was not found. Synchronise the device and retry." }, { status: 404 });
    if (result === "updated") {
      await audit("EMERGENCY_ROLL_CALL_CLOSED", {
        actorType: "DEVICE",
        deviceId: device.id,
        entityType: "EmergencyRollCall",
        entityId: parsed.data.rollCallId,
        ...requestContext(req),
      });
    }
    return NextResponse.json({ ok: true, alreadyClosed: result === "closed" });
  }

  return withRole(req, "MANAGER", async user => {
    const result = await closeActiveRollCall(parsed.data.rollCallId, user.id);
    if (result === "missing") return NextResponse.json({ error: "The active roll call was not found." }, { status: 404 });
    if (result === "updated") {
      await audit("EMERGENCY_ROLL_CALL_CLOSED", {
        actorType: "USER",
        actorId: user.id,
        entityType: "EmergencyRollCall",
        entityId: parsed.data.rollCallId,
        afterValue: { source: "MANAGER_DASHBOARD" },
        ...requestContext(req),
      });
    }
    return NextResponse.json({ ok: true, alreadyClosed: result === "closed" });
  });
}
