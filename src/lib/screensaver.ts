import { z } from "zod";

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const screensaverDefaults = {
  screensaverEnabled: true,
  idleTimeoutSeconds: 30,
  showLogo: true,
  logoUrl: "/branding/stars-logo.svg",
  headline: "STARS Connect",
  showClock: true,
  showDate: true,
  showOnSiteCount: false,
  screensaverMessage: "Touch anywhere to begin",
  showDeviceName: true,
  screensaverWeatherEnabled: true,
  screensaverWeatherLocation: "Enfield, London",
  constellationEnabled: true,
  constellationIntensity: 35,
  backgroundAnimationStyle: "constellation" as const,
  wakeTransitionSeconds: 1.25,
  backgroundColor: "#050407",
  textColor: "#ffffff",
  accentColor: "#dec8e4",
  dayModeStart: "07:00",
  eveningModeStart: "19:00",
  nightModeStart: "22:00",
  dayDimLevel: 45,
  eveningDimLevel: 25,
  nightDimLevel: 10,
  deviceLocationName: "",
};

export const screensaverSchema = z.object({
  screensaverEnabled: z.boolean(),
  idleTimeoutSeconds: z.number().int().min(15).max(3600),
  showLogo: z.boolean(),
  logoUrl: z.string().trim().max(200000),
  headline: z.string().trim().max(120),
  showClock: z.boolean(),
  showDate: z.boolean(),
  showOnSiteCount: z.boolean(),
  screensaverMessage: z.string().trim().min(1).max(120),
  showDeviceName: z.boolean(),
  screensaverWeatherEnabled: z.boolean(),
  screensaverWeatherLocation: z.string().trim().min(2).max(120),
  constellationEnabled: z.boolean(),
  constellationIntensity: z.number().int().min(0).max(100),
  backgroundAnimationStyle: z.enum(["constellation", "halloween", "christmas", "st-patricks"]),
  wakeTransitionSeconds: z.number().min(0).max(5),
  backgroundColor: colour,
  textColor: colour,
  accentColor: colour,
  dayModeStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  eveningModeStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  nightModeStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dayDimLevel: z.number().int().min(5).max(100),
  eveningDimLevel: z.number().int().min(5).max(100),
  nightDimLevel: z.number().int().min(5).max(100),
  deviceLocationName: z.string().trim().max(120),
});

export type ScreensaverSettings = z.infer<typeof screensaverSchema>;
export const screensaverKeys = Object.keys(screensaverDefaults) as Array<keyof ScreensaverSettings>;

export function visualPeriod(now: Date, settings: ScreensaverSettings) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const parse = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const day = parse(settings.dayModeStart), evening = parse(settings.eveningModeStart), night = parse(settings.nightModeStart);
  if (minutes >= night || minutes < day) return { mode: "night" as const, brightness: settings.nightDimLevel };
  if (minutes >= evening) return { mode: "evening" as const, brightness: settings.eveningDimLevel };
  return { mode: "day" as const, brightness: settings.dayDimLevel };
}

export function screensaverAllowedOnRoute(pathname: string) {
  return ["/", "/clock", "/register", "/visitors", "/live", "/offline"].some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`),
  );
}
