export const staffAbsenceTypes = ["ANNUAL_LEAVE","SICKNESS","UNPAID_LEAVE","COMPASSIONATE_LEAVE"] as const;
export function staffAbsenceLabel(type: string) {
  return ({ANNUAL_LEAVE:"Holiday",SICKNESS:"Sickness",UNPAID_LEAVE:"Unpaid holiday",COMPASSIONATE_LEAVE:"Compassionate leave"} as Record<string,string>)[type] || type.replaceAll("_", " ").toLowerCase();
}
export function requestedLeaveType(category: unknown) {
  return category === "UNPAID_LEAVE" ? "UNPAID_LEAVE" : category === "COMPASSIONATE_LEAVE" ? "COMPASSIONATE_LEAVE" : "ANNUAL_LEAVE";
}
