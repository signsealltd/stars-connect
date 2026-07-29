import { describe, expect, it } from "vitest";
import { LAUNCH_CLEANUP_CONFIRMATION, launchCleanupConfirmed } from "./launch-cleanup";

describe("launch cleanup confirmation", () => {
  it("requires the complete confirmation phrase", () => {
    expect(launchCleanupConfirmed(LAUNCH_CLEANUP_CONFIRMATION)).toBe(true);
    expect(launchCleanupConfirmed(" prepare for launch ")).toBe(true);
    expect(launchCleanupConfirmed("launch")).toBe(false);
    expect(launchCleanupConfirmed(undefined)).toBe(false);
  });
});
