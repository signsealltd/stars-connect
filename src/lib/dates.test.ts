import { describe, expect, it } from "vitest";
import { formatUkTime, localDateKey, localDayBounds } from "./dates";

describe("Europe/London operational dates", () => {
  it("uses the London date when UTC is still on the previous day in summer", () => {
    expect(localDateKey(new Date("2026-07-20T23:30:00Z"))).toBe("2026-07-21");
  });

  it("formats both sides of the autumn clock change correctly", () => {
    expect(formatUkTime("2026-10-25T00:30:00Z")).toBe("01:30");
    expect(formatUkTime("2026-10-25T01:30:00Z")).toBe("01:30");
  });

  it("creates a 23-hour operational day across the spring DST boundary", () => {
    const { start, end } = localDayBounds("2026-03-29");
    expect(Math.round((end.getTime() - start.getTime() + 1) / 3_600_000)).toBe(23);
  });
});
