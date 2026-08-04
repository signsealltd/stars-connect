import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { withRole, jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireOrganisation } from "@/lib/compliance-service";
import { APP_TIME_ZONE, localDateAsDatabaseDate } from "@/lib/dates";
import { calendarDateKeys, calendarPilotEnabled, expectedOnDate } from "@/lib/calendar-pilot";
import { createOperation } from "@/lib/operations-service";
import { CAPABILITIES, hasCapability } from "@/lib/permissions";

const createSchema = z.object({
  title: z.string().trim().min(2).max(191),
  type: z.enum(["ACTIVITY", "EVENT", "OUTING", "APPOINTMENT", "MEETING"]),
  date: z.string().date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().trim().max(191).optional(),
  description: z.string().trim().max(2000).optional(),
});

const dateKey = (value: Date) => formatInTimeZone(value, APP_TIME_ZONE, "yyyy-MM-dd");

export async function GET(req: NextRequest) {
  return withRole(req, "DIRECTOR", async user => {
    if (!calendarPilotEnabled()) return jsonError("The calendar pilot is currently disabled.", 404);
    if (!hasCapability(user.role, CAPABILITIES.CALENDAR_VIEW, user.permissionOverrides)) return jsonError("You do not have permission to view the calendar.", 403);
    const startKey = req.nextUrl.searchParams.get("start") || "";
    const endKey = req.nextUrl.searchParams.get("end") || "";
    let keys: string[];
    try { keys = calendarDateKeys(startKey, endKey); } catch { return jsonError("Choose a valid calendar range of no more than 31 days.", 422); }
    const organisationId = requireOrganisation(user);
    const start = fromZonedTime(`${startKey}T00:00:00`, APP_TIME_ZONE);
    const endExclusive = fromZonedTime(`${endKey}T23:59:59.999`, APP_TIME_ZONE);
    const startDate = localDateAsDatabaseDate(startKey);
    const endDate = localDateAsDatabaseDate(endKey);
    const trainingHorizon = addDays(endDate, 60);
    const [students, shifts, operations, training, billingRuns] = await Promise.all([
      prisma.student.findMany({ where: { active: true, archivedAt: null, startDate: { lte: endDate }, OR: [{ endDate: null }, { endDate: { gte: startDate } }] }, select: { id: true, displayName: true, expectedDays: true, startDate: true, endDate: true }, orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }] }),
      prisma.staffScheduleOccurrence.findMany({ where: { organisationId, startAt: { lte: endExclusive }, endAt: { gte: start }, status: { not: "CANCELLED" } }, include: { staff: { select: { displayName: true } } }, orderBy: { startAt: "asc" }, take: 500 }),
      prisma.operationOccurrence.findMany({ where: { organisationId, startAt: { lte: endExclusive }, endAt: { gte: start }, status: { not: "CANCELLED" } }, include: { operation: { select: { title: true, type: true, description: true } }, assignments: { where: { status: "ASSIGNED" }, include: { staff: { select: { displayName: true } } } }, attendees: { include: { student: { select: { displayName: true } } } } }, orderBy: { startAt: "asc" }, take: 250 }),
      prisma.staffTrainingRecord.findMany({ where: { active: true, expiryDate: { not: null, lte: trainingHorizon }, staff: { active: true, archivedAt: null } }, include: { staff: { select: { displayName: true } } }, orderBy: { expiryDate: "asc" }, take: 250 }),
      prisma.billingRun.findMany({ where: { periodStart: { lte: endDate }, periodEnd: { gte: startDate } }, select: { id: true, label: true, periodStart: true, periodEnd: true, status: true, selectedStudentIds: true }, orderBy: { periodStart: "asc" }, take: 100 }),
    ]);
    const days = keys.map(key => {
      const dayStart = localDateAsDatabaseDate(key);
      const activeStudents = students.filter(student => student.startDate <= dayStart && (!student.endDate || student.endDate >= dayStart) && expectedOnDate(student.expectedDays, key));
      return {
        date: key,
        expectedStudents: activeStudents.map(student => ({ id: student.id, name: student.displayName })),
        expectedStaff: shifts.filter(shift => dateKey(shift.startAt) === key).map(shift => ({ id: shift.staffId, name: shift.staff.displayName, start: shift.startAt, end: shift.endAt, status: shift.status, role: shift.role })),
        activities: operations.filter(item => dateKey(item.startAt) === key).map(item => ({ id: item.id, title: item.operation.title, type: item.operation.type, description: item.operation.description, start: item.startAt, end: item.endAt, location: item.location || item.premisesName, status: item.status, readiness: item.readiness, staff: item.assignments.map(row => row.staff.displayName), students: item.attendees.map(row => row.student.displayName) })),
        training: training.filter(item => item.expiryDate && dateKey(item.expiryDate) === key).map(item => ({ id: item.id, staff: item.staff.displayName, course: item.courseName, expiryDate: item.expiryDate, mandatory: item.mandatory })),
        billingCycles: billingRuns.filter(run => dateKey(run.periodStart) === key).map(run => ({ id: run.id, label: run.label || "Unlabelled billing cycle", start: run.periodStart, end: run.periodEnd, status: run.status, studentCount: Array.isArray(run.selectedStudentIds) ? run.selectedStudentIds.length : 0 })),
      };
    });
    const now = new Date();
    const trainingFlags = training.map(item => ({ id: item.id, staff: item.staff.displayName, course: item.courseName, expiryDate: item.expiryDate, mandatory: item.mandatory, state: item.expiryDate && item.expiryDate < now ? "OVERDUE" : "DUE_SOON" }));
    return NextResponse.json({ pilot: true, readOnlySources: ["student expected days", "staff schedules", "training renewals", "billing cycles"], days, trainingFlags });
  });
}

export async function POST(req: NextRequest) {
  return withRole(req, "DIRECTOR", async user => {
    if (!calendarPilotEnabled()) return jsonError("The calendar pilot is currently disabled.", 404);
    if (!hasCapability(user.role, CAPABILITIES.CALENDAR_MANAGE, user.permissionOverrides)) return jsonError("You do not have permission to manage the calendar.", 403);
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success || parsed.data.endTime <= parsed.data.startTime) return jsonError("Check the activity title, date and times.", 422);
    const input = parsed.data;
    const startAt = fromZonedTime(`${input.date}T${input.startTime}:00`, APP_TIME_ZONE).toISOString();
    const endAt = fromZonedTime(`${input.date}T${input.endTime}:00`, APP_TIME_ZONE).toISOString();
    const created = await createOperation(user, { title: input.title, type: input.type, description: input.description, startAt, endAt, timezone: APP_TIME_ZONE, location: input.location });
    return NextResponse.json(created, { status: 201 });
  });
}
