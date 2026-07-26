import { describe, expect, it } from "vitest";
import { approvalProblems, workflowActions } from "./finance-workflow";

describe("shared finance workflow states", () => {
  it("routes calculated runs to review before approval", () => {
    const actions = workflowActions("REQUIRES_REVIEW", 3);
    expect(actions.review).toBe(true);
    expect(actions.approve).toBe(true);
    expect(actions.lock).toBe(false);
    expect(actions.generate).toBe(false);
  });

  it("only permits generation from locked values", () => {
    expect(workflowActions("APPROVED", 3).generate).toBe(false);
    expect(workflowActions("LOCKED", 3).generate).toBe(true);
  });

  it("reports all server approval blockers", () => {
    expect(approvalProblems({ status: "REQUIRES_REVIEW", recordCount: 2, blockingCount: 1, unreviewedCount: 1 })).toEqual([
      "Blocking exceptions remain.",
      "Included records remain unreviewed.",
    ]);
  });
});
