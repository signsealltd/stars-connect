import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(join(process.cwd(), "src/components/kiosk-battery-status.tsx"), "utf8");
const statusBar = readFileSync(join(process.cwd(), "src/components/kiosk-device-status-bar.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "src/app/kiosk-controls.css"), "utf8");

describe("kiosk-only interaction guards", () => {
  it("enables and cleans up guards only while a kiosk route is active", () => {
    expect(component).toContain("const kiosk = isKioskRoute(pathname)");
    expect(component).toContain('document.body.classList.add("kiosk-route")');
    expect(component).toContain('document.body.classList.remove("kiosk-route")');
    expect(component).toContain('document.removeEventListener("contextmenu"');
    expect(component).toContain('document.removeEventListener("dragstart"');
  });

  it("keeps form controls selectable without affecting manager pages", () => {
    expect(css).toContain("body.kiosk-route");
    expect(css).toContain("body.kiosk-route input");
    expect(css).not.toMatch(/(^|,)\s*body\s*[,{]/m);
  });

  it("uses a persistent emergency battery banner rather than a modal", () => {
    expect(statusBar).toContain('pathname === "/emergency"');
    expect(statusBar).toContain('emergency ? " emergency"');
    expect(statusBar).not.toContain("modal");
  });
});
