import { TimesheetManager } from "@/components/timesheet-manager";
import { calculateWorkedMinutes } from "@/lib/domain";
import { localDayBounds } from "@/lib/dates";
import { CAPABILITIES, requirePageCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { openClockIn } from "@/lib/timesheets";

export const dynamic = "force-dynamic";

export default async function TimesheetsLayout({ children }: { children: React.ReactNode }) {
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
  const openRows = staff.flatMap(member => {
    const open = openClockIn(member.clockEvents);
    if (!open) return [];
    const total = calculateWorkedMinutes(member.clockEvents);
    return [{
      id: member.id,
      name: member.displayName,
      minutes: total.minutes,
      missingClockOut: true,
      openClockInAt: open.deviceTimestamp.toISOString(),
    }];
  });

  return <>
    {children}
    {openRows.length > 0 && <section className="content" aria-labelledby="manager-clock-out-title">
      <h2 id="manager-clock-out-title">Forgotten clock-outs</h2>
      <p className="muted">Record the staff member&apos;s actual finishing time. Manager entries are marked for review and audited.</p>
      <TimesheetManager initialRows={openRows}/>
    </section>}
  </>;
}
