import { z } from "zod";

export const manualBillingPeriodSchema = z.object({
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  cycle: z.enum(["LBE", "MONTHLY"]),
}).refine(value => {
  const days = (Date.parse(value.periodEnd) - Date.parse(value.periodStart)) / 86400000 + 1;
  return days >= 1 && days <= 62;
}, "Choose a From and To date covering 1 to 62 days.");

export type ManualBillingPeriod = z.infer<typeof manualBillingPeriodSchema>;
export function manualPeriodLabel(period: ManualBillingPeriod) {
  const date = (value: string) => new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${period.cycle === "LBE" ? "LBE" : "Clients"} — ${date(period.periodStart)} – ${date(period.periodEnd)}`;
}
