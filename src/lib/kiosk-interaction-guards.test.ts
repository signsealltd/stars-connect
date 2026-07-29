import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(join(process.cwd(), "src/components/kiosk-battery-status.tsx"), "utf8");
const statusBar = readFileSync(join(process.cwd(), "src/components/kiosk-device-status-bar.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "src/app/kiosk-controls.css"), "utf8");
const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const idleController = readFileSync(join(process.cwd(), "src/components/kiosk-idle-controller.tsx"), "utf8");

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
  it("consumes the completed screensaver tap before waking the kiosk", () => {
    expect(idleController).toContain('onPointerDown={e=>{e.preventDefault();e.stopPropagation()}}');
    expect(idleController).toContain('onClick={e=>{e.preventDefault();e.stopPropagation();onWake()}}');
  });

  it("layers the constellation above the screensaver background and behind its content", () => {
    expect(globals).toMatch(/\.idle-constellation\{[\s\S]*?z-index:0/);
    expect(globals).toMatch(/\.idle-content\{position:relative;z-index:1/);
    expect(globals).not.toContain(".idle-constellation{position:absolute;inset:-8%;width:116%;height:116%;z-index:-1");
  });

  it("uses perceptible constellation drift and twinkling with reduced-motion support", () => {
    expect(globals).toContain("animation:constellation-drift 38s");
    expect(globals).toContain("animation:constellation-twinkle 4.8s");
    expect(globals).toContain(".constellation-drift,.idle-constellation circle,.idle-content{animation:none!important}");
  });

  it("keeps the device status bar behind the full-screen idle screensaver", () => {
    expect(css).toMatch(/\.kiosk-device-status-bar\s*\{[\s\S]*?z-index:\s*9990/);
    expect(globals).toMatch(/\.idle-screensaver\{[\s\S]*?z-index:10000/);
  });
});
