import { Header } from "@/components/header";
import { TimesheetManager } from "@/components/timesheet-manager";
import { localDayBounds } from "@/lib/dates";
import { calculateWorkedMinutes } from "@/lib/domain";
import { CAPABILITIES, requirePageCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { openClockIn } from "@/lib/timesheets";

export const dynamic = "force-dynamic";

export default async function Timesheets() {
  await requirePageCapability(CAPABILITIES.PAYROLL_REVIEW);
  const { start } = localDayBounds();
  const staff = await prisma.staffMember.findMany({
    where: { active: true },
    include: {
      clockEvents: {
        where: { deviceTimestamp: { gte: start } },
        include: { corrections: { orderBy: { createdAt: "asc" } } },
        orderBy: { deviceTimestamp: "asc" },
      },
    },
    orderBy: { displayName: "asc" },
  }).catch(() => []);
  const rows = staff.map(member => {
    const total = calculateWorkedMinutes(member.clockEvents);
    const open = openClockIn(member.clockEvents);
    return {
      id: member.id,
      name: member.displayName,
      minutes: total.minutes,
      missingClockOut: Boolean(open),
      openClockInAt: open?.deviceTimestamp.toISOString(),
      transportDuty: member.clockEvents.some(event => event.transportDuty),
    };
  });
  return <main className="shell">
    <Header manager/>
    <div className="content">
      <h1 className="page-title">Timesheets</h1>
      <p className="muted">
        Today&apos;s calculated hours. Managers, directors and administrators can close a
        forgotten shift; every manual entry is audited.
      </p>
      <TimesheetManager initialRows={rows}/>
    </div>
  </main>;
}
