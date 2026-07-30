export const payrollAdjustmentOptions = [
  { code: "APPROVED_ANNUAL_LEAVE", label: "Approved annual leave", category: "HOLIDAY", paid: true },
  { code: "REPORTED_SICKNESS", label: "Reported sickness", category: "SICKNESS", paid: true },
  { code: "AUTHORISED_OVERTIME", label: "Authorised overtime", category: "OVERTIME", paid: true },
  { code: "MANDATORY_TRAINING", label: "Mandatory training", category: "TRAINING", paid: true },
  { code: "UNPAID_LEAVE", label: "Unpaid leave", category: "UNPAID", paid: false },
  { code: "TRANSPORT_DUTY", label: "Student transport duty", category: "OTHER", paid: true },
  { code: "OTHER_AUTHORISED", label: "Other authorised adjustment", category: "OTHER", paid: true },
] as const;

export type PayrollAdjustmentCode = (typeof payrollAdjustmentOptions)[number]["code"];
export type PayrollAdjustmentCategory = (typeof payrollAdjustmentOptions)[number]["category"];

export function payrollAdjustmentForReason(code: string) {
  return payrollAdjustmentOptions.find((option) => option.code === code);
}

export function payrollAdjustmentForLabel(label: string) {
  return payrollAdjustmentOptions.find((option) => option.label === label);
}

export function defaultPayrollReason(category: string) {
  return payrollAdjustmentOptions.find((option) => option.category === category) ?? payrollAdjustmentOptions[0];
}
