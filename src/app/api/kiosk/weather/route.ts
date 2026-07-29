import { NextRequest, NextResponse } from "next/server";
import { authenticateDeviceDetailed } from "@/lib/device-auth";
import { prisma } from "@/lib/prisma";
import { loadCurrentWeather, WeatherLocationError, WeatherUpstreamError } from "@/lib/weather";
import { readWeatherCache, writeWeatherCache } from "@/lib/weather-cache";

const TTL_MS = 15 * 60 * 1000;
function diagnostic(category: string) {
  console.warn(`[kiosk-weather] ${category}`);
}

export async function GET(req: NextRequest) {
  const authentication = await authenticateDeviceDetailed(req);
  if (!authentication.ok) {
    diagnostic(authentication.category);
    return NextResponse.json(
      { error: "Device not authorised", category: authentication.category },
      { status: authentication.status },
    );
  }

  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ["screensaverWeatherEnabled", "screensaverWeatherLocation"] } },
  });
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]));
  if (settings.screensaverWeatherEnabled === false) {
    diagnostic("weather-disabled");
    return new NextResponse(null, { status: 204 });
  }
  const location = typeof settings.screensaverWeatherLocation === "string"
    ? settings.screensaverWeatherLocation.trim()
    : "Enfield, London";
  if (!location) {
    diagnostic("location-missing");
    return NextResponse.json({ error: "Weather location is missing", category: "location-missing" }, { status: 422 });
  }

  const cacheKey = location.toLocaleLowerCase("en-GB");
  const cached = readWeatherCache(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ weather: cached.weather, stale: false }, {
      headers: { "cache-control": "private, max-age=300" },
    });
  }

  try {
    const weather = await loadCurrentWeather(location);
    writeWeatherCache(cacheKey, Date.now() + TTL_MS, weather);
    return NextResponse.json({ weather, stale: false }, {
      headers: { "cache-control": "private, max-age=300" },
    });
  } catch (error) {
    if (error instanceof WeatherLocationError) {
      diagnostic(error.message);
      return NextResponse.json({ error: "Weather location was not found", category: error.message }, { status: 422 });
    }
    if (cached) {
      diagnostic("stale-cache-used");
      return NextResponse.json({ weather: cached.weather, stale: true }, {
        headers: { "cache-control": "private, no-cache" },
      });
    }
    const category = error instanceof WeatherUpstreamError ? error.message : "upstream-unavailable";
    diagnostic(category);
    return NextResponse.json({ error: "Weather service is temporarily unavailable", category }, { status: 503 });
  }
}