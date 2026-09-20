import { prisma } from "./prisma";

export const quickActionOptions = [
  { id: "register", label: "Client register", href: "/register" },
  { id: "live", label: "Who is on site", href: "/live" },
  { id: "emergency", label: "Emergency roll call", href: "/emergency" },
  { id: "reports", label: "Operational reports", href: "/reports" },
  { id: "staff", label: "Staff", href: "/dashboard/staff" },
  { id: "students", label: "Clients", href: "/dashboard/students" },
  { id: "visitors", label: "Visitors", href: "/dashboard/visitors" },
  { id: "training", label: "Staff training", href: "/dashboard/training" },
  { id: "premises", label: "Safety & Compliance", href: "/dashboard/premises" },
  { id: "devices", label: "Devices", href: "/dashboard/settings/devices" },
  { id: "billing", label: "Billing & invoices", href: "/dashboard/billing" },
  { id: "payroll", label: "Payroll", href: "/dashboard/payroll" },
  { id: "calendar", label: "Operational calendar", href: "/dashboard/calendar" },
  { id: "staffCalendar", label: "Staff calendar", href: "/staff-portal/calendar" },
  { id: "staffPortal", label: "Policies & staff resources", href: "/staff-portal" },
  { id: "vehicleCheck", label: "Complete Vehicle Check", href: "/VehicleCheck" },
  { id: "fleet", label: "Fleet & vehicle defects", href: "/dashboard/premises/fleet" },
  { id: "timesheets", label: "Timesheets", href: "/timesheets" },
  { id: "informationReviews", label: "Client information reviews", href: "/dashboard/information-reviews" },
  { id: "healthSafety", label: "Risk assessments & RAMS", href: "/dashboard/health-safety" },
  { id: "conflicts", label: "Sync conflicts", href: "/dashboard/conflicts" },
  { id: "accessLevels", label: "Staff access levels", href: "/dashboard/settings/access-levels" },
  { id: "users", label: "Users & permissions", href: "/dashboard/settings/users" },
  { id: "audit", label: "Audit log", href: "/dashboard/audit" },
  { id: "email", label: "Email settings", href: "/dashboard/settings/email" },
] as const;

export const preferenceDefaults = {
  colourMode: "light" as "light" | "dark" | "system",
  quickActions: ["emergency", "staff", "students", "billing", "calendar", "fleet"] as string[],
};

export async function getUserPreferences(userId: string) {
  const row = await prisma.appSetting.findUnique({ where: { key: `userPreferences:${userId}` } });
  return { ...preferenceDefaults, ...((row?.value && typeof row.value === "object") ? row.value as object : {}), colourMode: "light" } as typeof preferenceDefaults;
}
