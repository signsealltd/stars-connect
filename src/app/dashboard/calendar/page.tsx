import "@/app/calendar-pilot.css";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { CalendarPilot } from "@/components/calendar-pilot";
import { calendarPilotEnabled, canUseCalendarPilot } from "@/lib/calendar-pilot";
import { requirePageCapability, CAPABILITIES } from "@/lib/permissions";

export default async function CalendarPage() {
  const user = await requirePageCapability(CAPABILITIES.CALENDAR_VIEW);
  if (!calendarPilotEnabled() || !canUseCalendarPilot(user.role)) redirect("/access-denied?from=calendar-pilot");
  return <main className="shell"><Header manager/><div className="content"><div className="page-head"><div><span className="badge badge-info">Restricted pilot</span><h1 className="page-title">Operational calendar</h1><p className="muted">Expected attendance, training renewals, billing cycles and activities in one planning view.</p></div></div><CalendarPilot/></div></main>;
}
