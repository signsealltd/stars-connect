import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  join(process.cwd(), "src/app/api/live/route.ts"),
  "utf8",
);
const page = readFileSync(
  join(process.cwd(), "src/app/live/page.tsx"),
  "utf8",
);

describe("manager live attendance", () => {
  it("uses authenticated server data rather than manager-browser IndexedDB", () => {
    expect(route).toContain('withRole(req, "RECEPTION"');
    expect(page).toContain('fetch("/api/live", { cache: "no-store" })');
    expect(page).not.toContain("@/lib/local-db");
  });

  it("returns real names and excludes demonstration attendance", () => {
    expect(route).toContain("displayName: true");
    expect(route).toContain("fullName: true");
    expect(route.match(/isSeedData: false, lastSyncAt: \{ not: null \}/g)).toHaveLength(3);
  });

  it("refreshes live occupancy regularly and on demand", () => {
    expect(page).toContain("15_000");
    expect(page).toContain("visibilitychange");
    expect(page).toContain(">Refresh</button>");
  });
});
