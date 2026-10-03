import { NextRequest, NextResponse } from "next/server";
import { withCapability, requestContext } from "@/lib/api";
import { CAPABILITIES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { formatUkDate } from "@/lib/dates";
import { getOrganisationSettings } from "@/lib/organisation-settings";
import { clientAttendanceExport } from "@/lib/client-attendance-export";

export async function GET(req: NextRequest) {
  return withCapability(req, CAPABILITIES.STUDENTS_VIEW, async user => {
    const clients = await prisma.student.findMany({
      where: { active: true, archivedAt: null },
      select: { id: true, firstName: true, lastName: true, displayName: true, internalReference: true },
    });
    const organisation = await getOrganisationSettings();
    const pdf = clientAttendanceExport(clients, formatUkDate(new Date()), organisation.organisationName);
    await audit("ACTIVE_CLIENT_ATTENDANCE_EXPORTED", { actorType: "USER", actorId: user.id, entityType: "Student", afterValue: { count: clients.length }, ...requestContext(req) });
    return new NextResponse(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="active-clients-attendance.pdf"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  });
}
