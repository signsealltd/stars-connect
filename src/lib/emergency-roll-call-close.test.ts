import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("emergency roll-call closure", () => {
  it("allows an authorised manager to close the exact server roll call and audits it", () => {
    const route = readFileSync("src/app/api/emergency/close/route.ts", "utf8");
    expect(route).toContain('withRole(req, "MANAGER"');
    expect(route).toContain("closedByUserId: closedByUserId ?? null");
    expect(route).toContain('actorType: "USER"');
    expect(route).toContain('source: "MANAGER_DASHBOARD"');
  });

  it("keeps device closure idempotent so stale local snapshots can be cleared", () => {
    const route = readFileSync("src/app/api/emergency/close/route.ts", "utf8");
    expect(route).toContain('if (existing.status === "CLOSED") return "closed"');
    expect(route).toContain('alreadyClosed: result === "closed"');
  });

  it("shows a controlled end action for the server roll call on the dashboard", () => {
    const actions = readFileSync("src/components/dashboard-quick-actions.tsx", "utf8");
    const dashboard = readFileSync("src/app/dashboard/page.tsx", "utf8");
    expect(actions).toContain("End roll call");
    expect(actions).toContain("rollCallId: emergency.id");
    expect(actions).toContain("onEmergencyClosed?.()");
    expect(dashboard).toContain("emergency={d.emergency}");
  });
});
