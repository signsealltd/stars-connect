import Link from "next/link";
import { subDays, startOfMonth, startOfWeek, format } from "date-fns";
import { Header } from "@/components/header";
import { TimesheetManager } from "@/components/timesheet-manager";
import { localDateKey, formatUkDate, formatUkTime } from "@/lib/dates";
import { CAPABILITIES, requirePageCapability } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { effectiveClockEvent, openClockIn } from "@/lib/timesheets";
import { timesheetRange, timesheetHistory } from "@/lib/timesheet-history";

export const dynamic = "force-dynamic";
const hours = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
export default async function Timesheets({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requirePageCapability(CAPABILITIES.PAYROLL_REVIEW);
  const params = await searchParams, today = localDateKey();
  let range = timesheetRange(undefined, undefined, today), error = "";
  try { range = timesheetRange(params.from, params.to, today); } catch (problem) { error = (problem as Error).message; }
  const date = new Date(today + "T12:00:00"), key = (value: Date) => format(value, "yyyy-MM-dd");
  const previousWeekEnd = subDays(startOfWeek(date, { weekStartsOn: 1 }), 1);
  const shortcuts = [{ label: "Today", from: today, to: today }, { label: "Yesterday", from: key(subDays(date, 1)), to: key(subDays(date, 1)) }, { label: "Last week", from: key(subDays(previousWeekEnd, 6)), to: key(previousWeekEnd) }, { label: "This month", from: key(startOfMonth(date)), to: today }];
  const staff = error ? [] : await prisma.staffMember.findMany({
    // Corrections can move an event into or out of the selected period.
    include: { clockEvents: { where: { OR: [{ deviceTimestamp: { gte: range.start, lte: range.end } }, { corrections: { some: {} } }] }, include: { corrections: { orderBy: { createdAt: "asc" } } }, orderBy: { deviceTimestamp: "asc" } } },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
  });
  const records = staff.map(member => ({ member, history: timesheetHistory(member.clockEvents, range.start, range.end) })).filter(({ member, history }) => history.days.length || (range.isToday && member.active));
  const rows = records.map(({ member, history }) => {
    const events = member.clockEvents.map(effectiveClockEvent).filter(event => event.deviceTimestamp >= range.start && event.deviceTimestamp <= range.end);
    const open = openClockIn(events);
    return { id: member.id, name: member.displayName, minutes: history.minutes, missingClockOut: Boolean(open), openClockInAt: open?.deviceTimestamp.toISOString(), transportDuty: events.some(event => event.transportDuty) };
  });
  return <main className="shell"><Header manager/><div className="content">
    <h1 className="page-title">Timesheets</h1>
    <p className="muted">View today&apos;s hours or choose a previous period. Historical clocking records include archived staff.</p>
    <section className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div className="toolbar">{shortcuts.map(item => <Link key={item.label} className="btn secondary" href={`/timesheets?from=${item.from}&to=${item.to}`}>{item.label}</Link>)}<Link className="btn ghost" href="/dashboard/reports/payroll">Previous timesheet PDFs</Link><Link className="btn ghost" href="/dashboard/payroll">Payroll runs</Link></div>
      <form action="/timesheets" className="toolbar"><label className="form-label">From<input key={range.from} className="field" type="date" name="from" defaultValue={range.from} max={today} required/></label><label className="form-label">To<input key={range.to} className="field" type="date" name="to" defaultValue={range.to} max={today} required/></label><button className="btn primary">View timesheets</button></form>
    </section>
    {error ? <div role="alert" className="alert alert-error">{error}</div> : <>
      <h2>{formatUkDate(range.start)}{range.from !== range.to && ` - ${formatUkDate(range.end)}`}</h2>
      <p className="muted">Recorded hours from paired daily clock events, including corrections. Missing clock-outs are not estimated. Approved payroll totals and saved PDFs remain in Payroll.</p>
      {range.isToday ? <TimesheetManager key={today} initialRows={rows}/> : records.length ? <section className="card" style={{padding:20}}>{records.map(({ member, history }) => <details key={member.id} style={{padding:"16px 0",borderBottom:"1px solid #e4dae8"}}><summary style={{cursor:"pointer",minHeight:44}}><strong>{member.displayName}</strong>{!member.active && " (Archived)"} — {hours(history.minutes)}{history.missingClockOut && " — Missing clock-out"}<span className="muted"> — View daily details</span></summary><div className="table-wrap"><table className="table"><thead><tr><th>Date</th><th>Clocking records</th><th>Recorded hours</th><th>Status</th></tr></thead><tbody>{history.days.map(day => <tr key={day.date}><td>{formatUkDate(day.date)}</td><td>{day.events.map(event => <div key={event.id}>{event.type === "CLOCK_IN" ? "In" : "Out"} {formatUkTime(event.at)}{event.corrected && " (corrected)"}</div>)}</td><td>{hours(day.minutes)}</td><td>{day.missingClockOut ? "Missing clock-out" : "Recorded"}</td></tr>)}</tbody></table></div></details>)}</section> : <div className="card empty"><b>No timesheets for these dates</b><p>Choose another period to view recorded clocking activity.</p></div>}
    </>}
  </div></main>;
}
