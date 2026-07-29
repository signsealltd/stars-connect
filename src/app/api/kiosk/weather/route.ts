import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { loadCurrentWeather, type CurrentWeather } from "@/lib/weather";

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; weather: CurrentWeather }>();

export async function GET(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) return NextResponse.json({ error: "Device not authorised" }, { status: 401 });
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ["screensaverWeatherEnabled", "screensaverWeatherLocation"] } },
  });
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]));
  if (values.screensaverWeatherEnabled === false) return NextResponse.json({ enabled: false });
  const location = typeof values.screensaverWeatherLocation === "string"
    ? values.screensaverWeatherLocation.trim()
    : "Enfield, London";
  if (!location) return NextResponse.json({ enabled: false });

  const cached = cache.get(location.toLocaleLowerCase("en-GB"));
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ enabled: true, weather: cached.weather }, {
      headers: { "cache-control": "private, max-age=300" },
    });
  }

  try {
    const weather = await loadCurrentWeather(location);
    cache.set(location.toLocaleLowerCase("en-GB"), { expiresAt: Date.now() + TTL_MS, weather });
    return NextResponse.json({ enabled: true, weather }, {
      headers: { "cache-control": "private, max-age=300" },
    });
  } catch {
    return NextResponse.json({ enabled: true, unavailable: true }, { status: 503 });
  }
}
