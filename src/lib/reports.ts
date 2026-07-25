import { prisma } from "./prisma";
import { calculateWorkedMinutes } from "./domain";
import { formatUkDate, formatUkTime, isExpectedDay, localDayBounds } from "./dates";

export async function dailyStaffReport(date: string) {
  const { start, end } = localDayBounds(date);
  const staff = await prisma.staffMember.findMany({
    where: { clockEvents: { some: { deviceTimestamp: { gte: start, lte: end } } } },
    include: {
      clockEvents: {
        where: { deviceTimestamp: { gte: start, lte: end } },
        orderBy: { deviceTimestamp: "asc" },
        include: { corrections: true, device: { select: { name: true } } },
      },
    },
    orderBy: { displayName: "asc" },
  });
  return staff.map((person) => {
    const calculated = calculateWorkedMinutes(person.clockEvents);
    return {
      id: person.id,
      staffMember: person.displayName,
      firstClockIn: person.clockEvents.find((e) => e.type === "CLOCK_IN")?.deviceTimestamp,
      finalClockOut: [...person.clockEvents].reverse().find((e) => e.type === "CLOCK_OUT")?.deviceTimestamp,
      totalMinutes: calculated.minutes,
      missingClockOut: calculated.missingClockOut,
      corrections: person.clockEvents.reduce((sum, e) => sum + e.corrections.length, 0),
      warnings: [
        ...(calculated.missingClockOut ? ["Missing clock-out"] : []),
        ...(person.clockEvents.some((e) => e.reviewRequired) ? ["Requires review"] : []),
        ...(person.clockEvents.some((e) => e.offlineRecorded) ? ["Recorded offline"] : []),
      ],
      sourceDevices: [...new Set(person.clockEvents.map((e) => e.device.name))].join(", "),
    };
  });
}

export async function studentAttendanceReport(from: string, to: string) {
  const boundsFrom = localDayBounds(from).start;
  const boundsTo = localDayBounds(to).end;
  const records = await prisma.studentAttendance.findMany({
    where: { date: { gte: boundsFrom, lte: boundsTo } },
    include: { student: true, device: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { student: { displayName: "asc" } }],
  });
  return records.map((record) => ({
    id: record.id,
    student: record.student.displayName,
    date: formatUkDate(record.date, "yyyy-MM-dd"),
    status: record.status,
    arrivalTime: record.arrivalTime,
    departureTime: record.departureTime,
    note: record.note,
    expected: isExpectedDay(record.student.expectedDays, formatUkDate(record.date, "yyyy-MM-dd")),
    device: record.device.name,
  }));
}

export async function siteSummary(date: string) {
  const staff = await dailyStaffReport(date);
  const students = await studentAttendanceReport(date, date);
  const { start, end } = localDayBounds(date);
  const [conflicts, emergencyActivity, devices] = await Promise.all([
    prisma.syncConflict.count({ where: { status: "OPEN", createdAt: { lte: end } } }),
    prisma.emergencyRollCall.count({ where: { startedAt: { gte: start, lte: end } } }),
    prisma.device.count({ where: { OR: [{ status: "REVOKED" }, { lastSeenAt: { lt: new Date(Date.now() - 15 * 60_000) } }] } }),
  ]);
  return {
    date,
    staffAttended: staff.length,
    staffStillIn: staff.filter((x) => x.missingClockOut).length,
    studentsPresent: students.filter((x) => x.status === "PRESENT" || x.status === "LATE").length,
    studentsAbsent: students.filter((x) => x.status === "ABSENT").length,
    studentsLate: students.filter((x) => x.status === "LATE").length,
    studentsUnconfirmed: students.filter((x) => x.status === "NOT_MARKED").length,
    conflicts,
    emergencyActivity,
    staleOrRevokedDevices: devices,
    staff,
    students,
  };
}

export const displayMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
export const displayDate = (value: Date | string | undefined) => value ? formatUkDate(value) : "";
export const displayTime = (value: Date | string | undefined) => value ? formatUkTime(value) : "";
