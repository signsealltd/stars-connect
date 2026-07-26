export type FinanceWorkflowStatus =
  | "DRAFT"
  | "REQUIRES_REVIEW"
  | "REVIEWED"
  | "APPROVED"
  | "LOCKED"
  | "EXPORTED"
  | "INVOICES_GENERATED"
  | "SUPERSEDED";

export function workflowActions(status: string, recordCount: number) {
  return {
    calculate: ["DRAFT", "REQUIRES_REVIEW", "REVIEWED"].includes(status),
    review: recordCount > 0,
    edit: ["REQUIRES_REVIEW", "REVIEWED"].includes(status),
    approve: ["REQUIRES_REVIEW", "REVIEWED"].includes(status) && recordCount > 0,
    lock: status === "APPROVED",
    generate: status === "LOCKED",
    download: ["EXPORTED", "INVOICES_GENERATED"].includes(status),
  };
}

export function approvalProblems(input: {
  status: string;
  recordCount: number;
  blockingCount: number;
  unreviewedCount: number;
}) {
  const problems: string[] = [];
  if (!["REQUIRES_REVIEW", "REVIEWED"].includes(input.status))
    problems.push("The run is not awaiting approval.");
  if (!input.recordCount) problems.push("No calculated records exist.");
  if (input.blockingCount) problems.push("Blocking exceptions remain.");
  if (input.unreviewedCount) problems.push("Included records remain unreviewed.");
  return problems;
}
