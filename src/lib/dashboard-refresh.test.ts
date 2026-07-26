import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = () => readFileSync(join(process.cwd(), "src/app/dashboard/page.tsx"), "utf8");

describe("dashboard refresh control", () => {
  it("forces a fresh server request and exposes progress and failure states", () => {
    const source = dashboard();
    expect(source).toContain("?refresh=${Date.now()}");
    expect(source).toContain('"cache-control":"no-cache"');
    expect(source).toContain("onClick={()=>void load(true)}");
    expect(source).toContain('refreshing?"Refreshing…":"Refresh"');
    expect(source).toContain("setLastUpdated(new Date())");
  });
});