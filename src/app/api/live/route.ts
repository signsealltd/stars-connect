import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api";
import { localDateAsDatabaseDate, localDateKey } from "@/lib/dates";
import { staffOccupancy } from "@/lib/staff-presence";

export async function GET(req: NextRequest) {
  return withRole(req, "RECEPTION", async () => {
    const date = localDateAsDatabaseDate(localDateKey());
    const [staff, attendance, visitors] = await Promise.all([
      prisma.staffMember.findMany({
        where: { active: true, clockingEnabled: true },
        select: {
          id: true,
          displayName: true,
          clockEvents: {
            where: { device: { isSeedData: false, lastSyncAt: { not: null } } },
            orderBy: { deviceTimestamp: "desc" },
            take: 1,
            select: { type: true, deviceTimestamp: true },
          },
          presenceEvents: {
            where: { device: { isSeedData: false, lastSyncAt: { not: null } } },
            orderBy: { deviceTimestamp: "desc" },
            take: 1,
            select: { type: true, deviceTimestamp: true },
          },
        },
        orderBy: { displayName: "asc" },
      }),
      prisma.studentAttendance.findMany({
        where: {
          date,
          status: { in: ["PRESENT", "LATE"] },
          student: { active: true },
          device: { isSeedData: false, lastSyncAt: { not: null } },
        },
        select: {
          id: true,
          status: true,
          arrivalTime: true,
          student: { select: { id: true, displayName: true } },
        },
        orderBy: { student: { displayName: "asc" } },
      }),
      prisma.visitorVisit.findMany({
        where: { signedOutAt: null, emergencyIncluded: true },
        select: {
          id: true,
          host: true,
          signedInAt: true,
          visitor: { select: { fullName: true, company: true } },
        },
        orderBy: { visitor: { fullName: "asc" } },
      }),
    ]);

    return NextResponse.json(
      {
        staff: staff
          .filter((member) => staffOccupancy(member.clockEvents[0], member.presenceEvents[0]) === "ONSITE")
          .map((member) => ({
            id: member.id,
            name: member.displayName,
            since: member.clockEvents[0]!.deviceTimestamp,
          })),
        students: attendance.map((row) => ({
          id: row.student.id,
          name: row.student.displayName,
          status: row.status,
          since: row.arrivalTime,
        })),
        visitors: visitors.map((visit) => ({
          id: visit.id,
          name: visit.visitor.fullName,
          company: visit.visitor.company,
          host: visit.host,
          since: visit.signedInAt,
        })),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  });
}
