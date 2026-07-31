import { z } from "zod";

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const monthlyScreensaverIds = [
  "january-winter", "february-hearts", "march-daffodils", "april-rainshowers",
  "may-butterflies", "june-summer-flowers", "july-beach", "august-fairground",
  "september-woodland", "october-halloween", "november-bonfire", "december-christmas",
] as const;
export type MonthlyScreensaverId = typeof monthlyScreensaverIds[number];
export const screensaverAnimationIds = ["automatic-monthly", ...monthlyScreensaverIds] as const;
export type ScreensaverAnimationId = typeof screensaverAnimationIds[number];

export const monthlyScreensaverOptions: ReadonlyArray<{ id: MonthlyScreensaverId; month: string; name: string; palette: string }> = [
  { id: "january-winter", month: "January", name: "January \u2013 Winter Village", palette: "#17335c" },
  { id: "february-hearts", month: "February", name: "February \u2013 Hearts", palette: "#ad5e8d" },
  { id: "march-daffodils", month: "March", name: "March \u2013 Daffodils", palette: "#74a86a" },
  { id: "april-rainshowers", month: "April", name: "April \u2013 Rain Showers", palette: "#638eb1" },
  { id: "may-butterflies", month: "May", name: "May \u2013 Butterflies", palette: "#63add0" },
  { id: "june-summer-flowers", month: "June", name: "June \u2013 Summer Flowers", palette: "#43a8d4" },
  { id: "july-beach", month: "July", name: "July \u2013 Beach", palette: "#e8b468" },
  { id: "august-fairground", month: "August", name: "August \u2013 Fairground", palette: "#75437e" },
  { id: "september-woodland", month: "September", name: "September \u2013 Woodland", palette: "#a85c32" },
  { id: "october-halloween", month: "October", name: "October \u2013 Halloween", palette: "#351747" },
  { id: "november-bonfire", month: "November", name: "November \u2013 Bonfire Night", palette: "#24304b" },
  { id: "december-christmas", month: "December", name: "December \u2013 Christmas Village", palette: "#173654" },
];

export const legacyScreensaverMap: Readonly<Record<string, MonthlyScreensaverId>> = {
  constellation: "january-winter",
  halloween: "october-halloween",
  christmas: "december-christmas",
  "st-patricks": "march-daffodils",
  celebration: "november-bonfire",
};

export function normaliseScreensaverAnimationId(value: unknown): ScreensaverAnimationId {
  if (typeof value !== "string") return "automatic-monthly";
  if ((screensaverAnimationIds as readonly string[]).includes(value)) return value as ScreensaverAnimationId;
  return legacyScreensaverMap[value] ?? "automatic-monthly";
}

export function resolveScreensaverScene(value: unknown, date = new Date()): MonthlyScreensaverId {
  const id = normaliseScreensaverAnimationId(value);
  return id === "automatic-monthly" ? monthlyScreensaverIds[date.getMonth()] : id;
}

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
  backgroundAnimationStyle: "automatic-monthly" as ScreensaverAnimationId,
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
  backgroundAnimationStyle: z.enum(screensaverAnimationIds),
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

/** Merge legacy kiosk caches with current defaults and migrate retired scene IDs. */
export function normaliseScreensaverSettings(value: unknown): ScreensaverSettings {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const candidate = {
    ...screensaverDefaults,
    ...raw,
    backgroundAnimationStyle: normaliseScreensaverAnimationId(raw.backgroundAnimationStyle),
  };
  const parsed = screensaverSchema.safeParse(candidate);
  return parsed.success ? parsed.data : screensaverDefaults;
}

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
