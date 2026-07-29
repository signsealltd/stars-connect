import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requestContext } from "@/lib/api";
import { localDateAsDatabaseDate, localDateKey } from "@/lib/dates";
import { CAPABILITIES, requireCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { openClockIn } from "@/lib/timesheets";

const schema = z.object({
  staffId: z.string().uuid(),
  clockOutAt: z.string().datetime(),
  reason: z.string().trim().min(5).max(1000),
});

export async function POST(req: NextRequest) {
  const user = await requireCapability(CAPABILITIES.PAYROLL_REVIEW);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Staff member, clock-out time and a reason are required." }, { status: 422 });
  const clockOutAt = new Date(parsed.data.clockOutAt);
  if (clockOutAt.getTime() > Date.now() + 60_000) return NextResponse.json({ error: "The clock-out time cannot be in the future." }, { status: 422 });
  const staff = await prisma.staffMember.findUnique({
    where: { id: parsed.data.staffId },
    include: { clockEvents: { include: { corrections: { orderBy: { createdAt: "asc" } } }, orderBy: { deviceTimestamp: "asc" } } },
  });
  if (!staff || !staff.active) return NextResponse.json({ error: "Active staff member not found." }, { status: 404 });
  const open = openClockIn(staff.clockEvents);
  if (!open) return NextResponse.json({ error: "This staff member is not currently clocked in." }, { status: 409 });
  if (clockOutAt <= open.deviceTimestamp) return NextResponse.json({ error: "Clock-out must be after the open clock-in." }, { status: 422 });
  const date = localDateAsDatabaseDate(localDateKey(clockOutAt));
  const locked = await prisma.payrollPeriod.findFirst({
    where: { periodStart: { lte: date }, periodEnd: { gte: date }, status: { in: ["APPROVED", "LOCKED", "EXPORTED"] } },
  });
  if (locked) return NextResponse.json({ error: "This date belongs to an approved payroll period. Create a revised period instead." }, { status: 409 });
  const created = await prisma.clockEvent.create({
    data: {
      id: randomUUID(), staffId: staff.id, deviceId: open.deviceId, type: "CLOCK_OUT",
      deviceTimestamp: clockOutAt, serverReceivedAt: new Date(), offlineRecorded: false,
      photoStatus: "NOT_REQUIRED", reviewRequired: true,
    },
  });
  await prisma.dailyAttendanceReport.updateMany({
    where: { reportDate: date, status: { in: ["GENERATED", "SUPERSEDED"] } },
    data: { potentiallyOutdated: true },
  });
  await audit("MANAGER_CLOCK_OUT_RECORDED", {
    actorType: "USER", actorId: user.id, entityType: "ClockEvent", entityId: created.id,
    beforeValue: { openClockInId: open.id, openClockInAt: open.deviceTimestamp },
    afterValue: { staffId: staff.id, clockOutAt, reason: parsed.data.reason, source: "TIMESHEET_MANAGER" },
    ...requestContext(req),
  });
  return NextResponse.json({ id: created.id, clockOutAt: created.deviceTimestamp }, { status: 201 });
}
