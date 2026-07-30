export function payrollGrossPay(input: {
  totalPayableMinutes: number;
  overtimeMinutes: number;
  hourlyRate: number | null;
  overtimeHourlyRate: number | null;
}) {
  if (input.hourlyRate === null) return null;
  const overtimeRate = input.overtimeHourlyRate ?? input.hourlyRate;
  const overtimeMinutes = Math.min(Math.max(0, input.overtimeMinutes), Math.max(0, input.totalPayableMinutes));
  const standardMinutes = Math.max(0, input.totalPayableMinutes - overtimeMinutes);
  return Math.round(((standardMinutes / 60) * input.hourlyRate + (overtimeMinutes / 60) * overtimeRate) * 100) / 100;
}