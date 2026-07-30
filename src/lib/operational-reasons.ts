export type ReasonOption = { value: string; label: string };

export const clockCorrectionReasons: ReasonOption[] = [
  { value: "FORGOTTEN_CLOCKING", label: "Staff member forgot to clock in or out" },
  { value: "DEVICE_UNAVAILABLE", label: "Kiosk or device was unavailable" },
  { value: "MANAGER_CORRECTION", label: "Manager correcting an inaccurate time" },
  { value: "TRANSPORT_DUTY", label: "Student transport duty" },
  { value: "OTHER", label: "Other" },
];

export const financeCorrectionReasons: ReasonOption[] = [
  { value: "ATTENDANCE_CONFIRMED", label: "Attendance confirmed by manager" },
  { value: "AGREED_RATE_CORRECTION", label: "Agreed rate or total corrected" },
  { value: "MISSING_CLOCKING_RESOLVED", label: "Missing clocking information resolved" },
  { value: "DUPLICATE_OR_ERROR", label: "Duplicate or incorrect record" },
  { value: "PAYER_INSTRUCTION", label: "Payer instruction or funding agreement" },
  { value: "OTHER", label: "Other" },
];

export const billingProfileReasons: ReasonOption[] = [
  { value: "DETAILS_CORRECTED", label: "Billing details corrected" },
  { value: "FUNDING_CHANGED", label: "Funding arrangement changed" },
  { value: "ARRANGEMENT_ENDED", label: "Funding arrangement ended" },
  { value: "CREATED_IN_ERROR", label: "Created in error" },
  { value: "OTHER", label: "Other" },
];

export function resolvedReason(options: ReasonOption[], selected: string, other: string) {
  if (selected === "OTHER") return other.trim();
  return options.find(option => option.value === selected)?.label || "";
}
