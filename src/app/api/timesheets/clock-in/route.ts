import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";
import { localDateAsDatabaseDate, localDateKey } from "@/lib/dates";
import { CAPABILITIES, requireCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { effectiveClockEvent, openClockIn } from "@/lib/timesheets";

const schema = z.object({
  staffId: z.string().uuid(),
  clockInAt: z.string().datetime(),
  reason: z.string().trim().min(5).max(1000),
});

export async function POST(req: NextRequest) {
  const user = await requireCapability(CAPABILITIES.PAYROLL_REVIEW);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Staff member, clock-in time and a reason are required." },
      { status: 422 },
    );
  }
  const clockInAt = new Date(parsed.data.clockInAt);
  if (clockInAt.getTime() > Date.now() + 60_000) {
    return NextResponse.json({ error: "The clock-in time cannot be in the future." }, { status: 422 });
  }
  const staff = await prisma.staffMember.findUnique({
    where: { id: parsed.data.staffId },
    include: {
      clockEvents: {
        include: { corrections: { orderBy: { createdAt: "asc" } } },
        orderBy: { deviceTimestamp: "asc" },
      },
    },
  });
  if (!staff || !staff.active) {
    return NextResponse.json({ error: "Active staff member not found." }, { status: 404 });
  }
  if (openClockIn(staff.clockEvents)) {
    return NextResponse.json({ error: "This staff member is already clocked in." }, { status: 409 });
  }
  const latest = staff.clockEvents.map(effectiveClockEvent).sort(
    (a, b) => b.deviceTimestamp.getTime() - a.deviceTimestamp.getTime(),
  )[0];
  if (latest && clockInAt <= latest.deviceTimestamp) {
    return NextResponse.json(
      { error: `Clock-in must be after the latest clock event at ${latest.deviceTimestamp.toLocaleString("en-GB")}.` },
      { status: 422 },
    );
  }
  const date = localDateAsDatabaseDate(localDateKey(clockInAt));
  const locked = await prisma.payrollPeriod.findFirst({
    where: {
      periodStart: { lte: date },
      periodEnd: { gte: date },
      status: { in: ["APPROVED", "LOCKED", "EXPORTED"] },
    },
  });
  if (locked) {
    return NextResponse.json(
      { error: "This date belongs to an approved payroll period. Create a revised period instead." },
      { status: 409 },
    );
  }
  const fallbackDevice = await prisma.device.findFirst({
    where: { status: "ACTIVE", isSeedData: false },
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  if (!fallbackDevice) {
    return NextResponse.json(
      { error: "No active registered device is available to attribute this manual clock-in." },
      { status: 409 },
    );
  }
  const created = await prisma.clockEvent.create({
    data: {
      id: randomUUID(),
      staffId: staff.id,
      deviceId: fallbackDevice.id,
      type: "CLOCK_IN",
      deviceTimestamp: clockInAt,
      serverReceivedAt: new Date(),
      offlineRecorded: false,
      photoStatus: "NOT_REQUIRED",
      reviewRequired: true,
    },
  });
  await prisma.dailyAttendanceReport.updateMany({
    where: { reportDate: date, status: { in: ["GENERATED", "SUPERSEDED"] } },
    data: { potentiallyOutdated: true },
  });
  await audit("MANAGER_CLOCK_IN_RECORDED", {
    actorType: "USER",
    actorId: user.id,
    entityType: "ClockEvent",
    entityId: created.id,
    beforeValue: latest
      ? { latestClockEventId: latest.id, latestClockEventType: latest.type, latestClockEventAt: latest.deviceTimestamp }
      : undefined,
    afterValue: {
      staffId: staff.id,
      clockInAt,
      reason: parsed.data.reason,
      source: "TIMESHEET_MANAGER",
      attributedDeviceId: fallbackDevice.id,
    },
    ...requestContext(req),
  });
  return NextResponse.json({ id: created.id, clockInAt: created.deviceTimestamp }, { status: 201 });
}
