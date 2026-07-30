import { readFile } from "fs/promises";
import path from "path";
import { formatInTimeZone } from "date-fns-tz";
import type { PayrollAdjustment, PayrollEntry, PayrollPeriod } from "@prisma/client";
import { APP_TIME_ZONE } from "./dates";
import { prisma } from "./prisma";
import { payrollTimesheetPdf } from "./payroll-timesheet-pdf";
import { getTransportSettings } from "./transport-settings";

const dateLabel = (value: Date) => formatInTimeZone(value, APP_TIME_ZONE, "dd/MM/yyyy");
const dateTimeLabel = (value: Date | null | undefined) =>
  value ? formatInTimeZone(value, APP_TIME_ZONE, "dd MMMM yyyy HH:mm") : "Not recorded";
const timeLabel = (value: Date) => formatInTimeZone(value, APP_TIME_ZONE, "HH:mm");
const hours = (minutes: number) => `${(minutes / 60).toFixed(2)}h`;

type EffectiveClockEvent = {
  type: "CLOCK_IN" | "CLOCK_OUT";
  at: Date;
  transportDuty: boolean;
  correction?: { reason: string; managerName: string; createdAt: Date };
};

export async function buildPayrollTimesheet(input: {
  entry: PayrollEntry;
  period: PayrollPeriod;
  adjustments: PayrollAdjustment[];
  approvedBy: string;
  generatedBy: string;
  generatedAt: Date;
}) {
  const transportSettings = await getTransportSettings();
  const events = await prisma.clockEvent.findMany({
    where: {
      staffId: input.entry.staffId,
      deviceTimestamp: {
        gte: input.period.periodStart,
        lte: new Date(input.period.periodEnd.getTime() + 86_399_999),
      },
    },
    include: {
      corrections: {
        orderBy: { createdAt: "asc" },
        include: { manager: { select: { name: true } } },
      },
    },
    orderBy: { deviceTimestamp: "asc" },
  });
  const effectiveEvents: EffectiveClockEvent[] = events
    .map(event => {
      const correction = event.corrections.at(-1);
      const value = correction?.newValue as { deviceTimestamp?: string; type?: "CLOCK_IN" | "CLOCK_OUT" } | undefined;
      return {
        type: value?.type || event.type,
        at: value?.deviceTimestamp ? new Date(value.deviceTimestamp) : event.deviceTimestamp,
        transportDuty: event.transportDuty,
        correction: correction
          ? {
              reason: correction.reason,
              managerName: correction.manager?.name || "Authorised user",
              createdAt: correction.createdAt,
            }
          : undefined,
      };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const dayEvents = new Map<string, EffectiveClockEvent[]>();
  for (const event of effectiveEvents) {
    const key = formatInTimeZone(event.at, APP_TIME_ZONE, "yyyy-MM-dd");
    dayEvents.set(key, [...(dayEvents.get(key) || []), event]);
  }
  const rows: Array<{ date: string; entry: string; details: string; hours: string; notes: string }> = [];
  for (const eventsForDay of dayEvents.values()) {
    for (let index = 0; index < eventsForDay.length; index += 2) {
      const start = eventsForDay[index];
      const finish = eventsForDay[index + 1];
      const complete = start.type === "CLOCK_IN" && finish?.type === "CLOCK_OUT";
      const minutes = complete ? Math.max(0, Math.round((finish.at.getTime() - start.at.getTime()) / 60_000)) : 0;
      const transportMinutes =
        (start.type === "CLOCK_IN" && start.transportDuty ? transportSettings.clockInAllowanceMinutes : 0) +
        (finish?.type === "CLOCK_OUT" && finish.transportDuty ? transportSettings.clockOutAllowanceMinutes : 0);
      const corrections = [start.correction, finish?.correction].filter(
        (value): value is NonNullable<typeof value> => Boolean(value),
      );
      rows.push({
        date: dateLabel(start.at),
        entry: start.transportDuty || finish?.transportDuty ? "Transport" : "Clocked hours",
        details: complete ? `${timeLabel(start.at)} - ${timeLabel(finish.at)}` : `${timeLabel(start.at)} - missing clock-out`,
        hours: (minutes / 60).toFixed(2),
        notes: corrections.length
          ? corrections
              .map(item => `${item.reason} (${item.managerName}, ${dateTimeLabel(item.createdAt)})`)
              .join("; ")
          : transportMinutes
            ? `+${hours(transportMinutes)} transport`
            : "No correction",
      });
    }
  }

  const categoryLabels: Record<string, string> = {
    HOLIDAY: "Holiday",
    SICKNESS: "Sickness",
    OVERTIME: "Overtime",
    TRAINING: "Training",
    UNPAID: "Unpaid",
    TRANSPORT: "Transport",
    OTHER: "Other adjustment",
  };
  for (const adjustment of input.adjustments.filter(item => item.staffId === input.entry.staffId)) {
    rows.push({
      date: dateLabel(adjustment.date),
      entry: categoryLabels[adjustment.category] || adjustment.category,
      details: adjustment.reason,
      hours: (Math.abs(adjustment.minutes) / 60).toFixed(2),
      notes: adjustment.paid ? "Paid manual pay item" : "Unpaid time",
    });
  }
  rows.sort((a, b) => {
    const [ad, am, ay] = a.date.split("/").map(Number);
    const [bd, bm, by] = b.date.split("/").map(Number);
    return Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd);
  });

  const reviewer = input.entry.reviewedById
    ? await prisma.user.findUnique({ where: { id: input.entry.reviewedById }, select: { name: true } })
    : null;
  const logoJpeg = await readFile(path.join(process.cwd(), "public", "branding", "stars-logo-pdf.jpg"));
  return payrollTimesheetPdf({
    logoJpeg,
    employeeName: input.entry.staffName,
    payrollNumber: input.entry.payrollNumber || "Not configured",
    periodLabel: `${formatInTimeZone(input.period.periodStart, APP_TIME_ZONE, "dd MMM yyyy")} - ${formatInTimeZone(input.period.periodEnd, APP_TIME_ZONE, "dd MMM yyyy")}`,
    documentVersion: input.period.version,
    hourlyRate: input.entry.hourlyRate ? `GBP ${Number(input.entry.hourlyRate).toFixed(2)}` : "Not configured",
    estimatedGrossPay: input.entry.grossPay ? `GBP ${Number(input.entry.grossPay).toFixed(2)}` : "Not configured",
    summary: [
      { label: "Ordinary", value: hours(input.entry.ordinaryMinutes) },
      { label: "Overtime", value: hours(input.entry.overtimeMinutes) },
      { label: "Holiday", value: hours(input.entry.holidayMinutes) },
      { label: "Sickness", value: hours(input.entry.sicknessMinutes) },
      { label: "Total payable", value: hours(input.entry.totalPayableMinutes) },
      { label: "Training", value: hours(input.entry.trainingMinutes) },
      { label: "Unpaid", value: hours(input.entry.unpaidMinutes) },
      { label: "Adjustments", value: hours(input.entry.adjustmentMinutes) },
    ],
    rows,
    exceptionStatus: input.entry.exceptionStatus.replaceAll("_", " "),
    exceptionCount: input.entry.exceptionCount,
    reviewedBy: reviewer?.name || "Not recorded",
    reviewedAt: dateTimeLabel(input.entry.reviewedAt),
    approvedBy: input.approvedBy,
    approvedAt: dateTimeLabel(input.period.approvedAt),
    generatedBy: input.generatedBy,
    generatedAt: dateTimeLabel(input.generatedAt),
  });
}
