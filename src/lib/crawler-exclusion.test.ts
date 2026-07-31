import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

describe("crawler exclusion", () => {
  it("disallows every route in robots.txt metadata", () => {
    const robots = readFileSync("src/app/robots.ts", "utf8");
    expect(robots).toContain('userAgent: "*"');
    expect(robots).toContain('disallow: "/"');
  });

  it("adds page metadata and response headers against indexing and archiving", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const config = readFileSync("next.config.ts", "utf8");
    expect(layout).toContain("robots:{index:false,follow:false,nocache:true");
    expect(config).toContain('key: "X-Robots-Tag"');
    expect(config).toContain("noindex, nofollow, noarchive, nosnippet, noimageindex");
  });
});
