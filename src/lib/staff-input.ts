import { z } from "zod";

export const staffUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  email: z.email().max(191).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  jobRole: z.string().trim().min(1).max(100).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().or(z.literal("")).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  contractedWeeklyHours: z.number().min(0).max(168).nullable().optional(),
  hourlyRate: z.number().min(0).max(10000).nullable().optional(),
  payrollNumber: z.string().trim().max(80).nullable().optional(),
  clockingEnabled: z.boolean().optional(),
  active: z.boolean().optional(),
  pin: z.string().regex(/^\d{4,8}$/).optional(),
});