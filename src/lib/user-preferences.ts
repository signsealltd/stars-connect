import { prisma } from "./prisma";

export const quickActionOptions = [
  { id: "register", label: "Student register", href: "/register" },
  { id: "live", label: "Who is on site", href: "/live" },
  { id: "emergency", label: "Emergency roll call", href: "/emergency" },
  { id: "reports", label: "Operational reports", href: "/reports" },
  { id: "staff", label: "Staff", href: "/dashboard/staff" },
  { id: "students", label: "Students", href: "/dashboard/students" },
  { id: "visitors", label: "Visitors", href: "/dashboard/visitors" },
  { id: "training", label: "Staff training", href: "/dashboard/training" },
  { id: "premises", label: "Premises & compliance", href: "/dashboard/premises" },
  { id: "devices", label: "Devices", href: "/dashboard/devices" },
] as const;

export const preferenceDefaults = {
  colourMode: "light" as "light" | "dark" | "system",
  quickActions: ["register", "live", "emergency", "reports"] as string[],
};

export async function getUserPreferences(userId: string) {
  const row = await prisma.appSetting.findUnique({ where: { key: `userPreferences:${userId}` } });
  return { ...preferenceDefaults, ...((row?.value && typeof row.value === "object") ? row.value as object : {}) } as typeof preferenceDefaults;
}
