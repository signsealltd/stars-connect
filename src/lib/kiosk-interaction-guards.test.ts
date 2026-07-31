import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const component = readFileSync(join(process.cwd(), "src/components/kiosk-battery-status.tsx"), "utf8");
const statusBar = readFileSync(join(process.cwd(), "src/components/kiosk-device-status-bar.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "src/app/kiosk-controls.css"), "utf8");
const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const idleController = readFileSync(join(process.cwd(), "src/components/kiosk-idle-controller.tsx"), "utf8");
const appearance = readFileSync(join(process.cwd(), "src/components/appearance-controller.tsx"), "utf8");
const weatherClient = readFileSync(join(process.cwd(), "src/components/screensaver-weather.tsx"), "utf8");

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

  it("keeps the screensaver active after the idle timer fires", () => {
    expect(idleController).toContain("activeRef=useRef(false)");
    expect(idleController).toContain("activeRef.current=true;setActive(true)");
    expect(idleController).toContain("if(!activeRef.current)reset()");
    expect(idleController).not.toContain("[active,eligible,reset,settings.screensaverEnabled]");
  });
  it("renders monthly artwork behind content with accessible motion", () => {
    expect(idleController).toContain("MonthlyScreensaverScene");
    expect(globals).toContain(".monthly-scene-layer");
    expect(globals).toContain("prefers-reduced-motion:reduce");
    expect(globals).toContain("animation-play-state:paused");
  });
  it("uses kiosk-safe weather requests and bounded transient retry", () => {
    expect(appearance).toContain("shouldLoadManagerPreferences(pathname)");
    expect(weatherClient).toContain('fetch("/api/kiosk/weather"');
    expect(weatherClient).not.toContain('fetch("/api/preferences"');
    expect(weatherClient).toContain("const RETRY_DELAYS_MS = [30_000, 120_000, 300_000]");
  });

  it("keeps the device status bar behind the full-screen idle screensaver", () => {
    expect(css).toMatch(/\.kiosk-device-status-bar\s*\{[\s\S]*?z-index:\s*9990/);
    expect(globals).toMatch(/\.idle-screensaver\{[\s\S]*?z-index:10000/);
  });
});
