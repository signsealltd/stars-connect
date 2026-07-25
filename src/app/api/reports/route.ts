import { NextRequest, NextResponse } from "next/server";
import { eachDayOfInterval, format as formatDate } from "date-fns";
import { z } from "zod";
import { withRole, jsonError, requestContext } from "@/lib/api";
import { audit } from "@/lib/audit";
import { createCsv } from "@/lib/csv";
import { dailyStaffReport, displayMinutes, displayTime, siteSummary, studentAttendanceReport } from "@/lib/reports";
import { localDateKey } from "@/lib/dates";

const querySchema = z.object({
  type: z.enum(["daily-staff", "weekly-staff", "students", "site"]),
  from: z.string().date(),
  to: z.string().date(),
  format: z.enum(["json", "csv"]).default("json"),
});

export async function GET(req: NextRequest) {
  return withRole(req, "MANAGER", async (user) => {
    const parsed = querySchema.safeParse({
      type: req.nextUrl.searchParams.get("type") || "daily-staff",
      from: req.nextUrl.searchParams.get("from") || localDateKey(),
      to: req.nextUrl.searchParams.get("to") || req.nextUrl.searchParams.get("from") || localDateKey(),
      format: req.nextUrl.searchParams.get("format") || "json",
    });
    if (!parsed.success) return jsonError("Invalid report filters.", 422);
    const { type, from, to, format } = parsed.data;
    let data: unknown;
    let headers: string[] = [];
    let rows: unknown[][] = [];
    if (type === "daily-staff" || type === "weekly-staff") {
      const days = eachDayOfInterval({ start: new Date(`${from}T12:00:00Z`), end: new Date(`${to}T12:00:00Z`) }).map((day) => formatDate(day, "yyyy-MM-dd"));
      const entries = (await Promise.all(days.map(async (date) => (await dailyStaffReport(date)).map((row) => ({ date, ...row })) ))).flat();
      data = entries;
      headers = ["Date","Staff member","First clock-in","Final clock-out","Total hours","Missing clock-out","Corrections","Warnings","Source devices"];
      rows = entries.map((r) => [r.date,r.staffMember,displayTime(r.firstClockIn),displayTime(r.finalClockOut),displayMinutes(r.totalMinutes),r.missingClockOut?"Yes":"No",r.corrections,r.warnings.join("; "),r.sourceDevices]);
    } else if (type === "students") {
      const entries = await studentAttendanceReport(from, to);
      data = entries;
      headers = ["Date","Student","Status","Expected","Arrival","Departure","Notes","Source device"];
      rows = entries.map((r) => [r.date,r.student,r.status,r.expected?"Yes":"No",displayTime(r.arrivalTime || undefined),displayTime(r.departureTime || undefined),r.note || "",r.device]);
    } else {
      const report = await siteSummary(from);
      data = report;
      headers = ["Date","Staff attended","Staff still in","Students present","Students absent","Students late","Students unconfirmed","Open conflicts","Emergency activity","Stale/revoked devices"];
      rows = [[report.date,report.staffAttended,report.staffStillIn,report.studentsPresent,report.studentsAbsent,report.studentsLate,report.studentsUnconfirmed,report.conflicts,report.emergencyActivity,report.staleOrRevokedDevices]];
    }
    if (format === "csv") {
      await audit("REPORT_EXPORTED", { actorType:"USER",actorId:user.id,entityType:"Report",afterValue:{type,from,to},...requestContext(req) });
      return new NextResponse(createCsv(headers, rows), { headers: { "content-type":"text/csv; charset=utf-8", "content-disposition":`attachment; filename="stars-connect-${type}-${from}-${to}.csv"` } });
    }
    return NextResponse.json({ type, from, to, data });
  });
}
