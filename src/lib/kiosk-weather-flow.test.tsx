import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  auth: { ok: true, device: { id: "tablet-1", status: "ACTIVE", name: "Reception" } } as
    | { ok: true; device: { id: string; status: string; name: string } }
    | { ok: false; status: 401 | 403; category: "device-auth-missing" | "device-revoked" },
  settings: {
    screensaverWeatherEnabled: true,
    screensaverWeatherLocation: "Enfield, London",
  },
}));

vi.mock("@/lib/device-auth", () => ({
  authenticateDeviceDetailed: vi.fn(async () => state.auth),
  authenticateDevice: vi.fn(async () => state.auth.ok ? state.auth.device : null),
}));
vi.mock("@/lib/security", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/security")>();
  return { ...actual, getSession: vi.fn(async () => null) };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    appSetting: {
      findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) =>
        where.key.in.flatMap(key => key in state.settings
          ? [{ key, value: state.settings[key as keyof typeof state.settings] }]
          : [])),
    },
  },
}));
vi.mock("@/lib/weather", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/weather")>();
  return { ...actual, loadCurrentWeather: vi.fn() };
});

import { GET as getManagerPreferences } from "@/app/api/preferences/route";
import { GET as getKioskConfiguration } from "@/app/api/kiosk/screensaver/route";
import { GET as getWeather } from "@/app/api/kiosk/weather/route";
import { clearWeatherCacheForTesting } from "@/lib/weather-cache";
import { ScreensaverWeatherContent } from "@/components/screensaver-weather";
import { loadCurrentWeather, WeatherLocationError, WeatherUpstreamError, type CurrentWeather } from "@/lib/weather";

const weather: CurrentWeather = {
  location: "Enfield",
  temperature: 21,
  feelsLike: 20,
  weatherCode: 2,
  condition: "Partly cloudy",
  isDay: true,
  updatedAt: "2026-07-29T14:00",
};
const request = () => new NextRequest("https://app.starsconnect.co.uk/api/kiosk/weather", {
  headers: { "x-device-id": "tablet-1", authorization: "Bearer synthetic-token" },
});

beforeEach(() => {
  vi.restoreAllMocks();
  clearWeatherCacheForTesting();
  state.auth = { ok: true, device: { id: "tablet-1", status: "ACTIVE", name: "Reception" } };
  state.settings.screensaverWeatherEnabled = true;
  state.settings.screensaverWeatherLocation = "Enfield, London";
  vi.mocked(loadCurrentWeather).mockReset().mockResolvedValue(weather);
});

describe("kiosk weather authentication and configuration", () => {
  it("keeps manager preferences unavailable to kiosk authentication", async () => {
    expect((await getManagerPreferences()).status).toBe(401);
  });

  it("returns only kiosk-safe screensaver weather configuration", async () => {
    const response = await getKioskConfiguration(request());
    const body = await response.json();
    expect(body.weatherConfiguration).toEqual({ enabled: true, location: "Enfield, London" });
    expect(body).not.toHaveProperty("smtpPassword");
    expect(body).not.toHaveProperty("finance");
    expect(body).not.toHaveProperty("security");
  });

  it("returns weather to a valid provisioned kiosk", async () => {
    const response = await getWeather(request());
    expect(response.status).toBe(200);
    expect((await response.json()).weather.location).toBe("Enfield");
  });

  it("returns controlled authentication responses", async () => {
    state.auth = { ok: false, status: 401, category: "device-auth-missing" };
    expect((await getWeather(request())).status).toBe(401);
    state.auth = { ok: false, status: 403, category: "device-revoked" };
    expect((await getWeather(request())).status).toBe(403);
  });

  it("hides weather with a controlled no-content response when disabled", async () => {
    state.settings.screensaverWeatherEnabled = false;
    expect((await getWeather(request())).status).toBe(204);
    expect(loadCurrentWeather).not.toHaveBeenCalled();
  });

  it("returns 422 for an invalid configured location", async () => {
    vi.mocked(loadCurrentWeather).mockRejectedValue(new WeatherLocationError("geocoding-not-found"));
    expect((await getWeather(request())).status).toBe(422);
  });

  it("uses stale cached data after an upstream failure", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);
    expect((await getWeather(request())).status).toBe(200);
    clock.mockReturnValue(1_000 + 16 * 60 * 1000);
    vi.mocked(loadCurrentWeather).mockRejectedValue(new WeatherUpstreamError("upstream-timeout"));
    const response = await getWeather(request());
    expect(response.status).toBe(200);
    expect((await response.json()).stale).toBe(true);
  });

  it("returns 503 for upstream failure without cached data", async () => {
    vi.mocked(loadCurrentWeather).mockRejectedValue(new WeatherUpstreamError("upstream-unavailable"));
    expect((await getWeather(request())).status).toBe(503);
  });

  it("refreshes changed configured locations without reprovisioning", async () => {
    await getWeather(request());
    state.settings.screensaverWeatherLocation = "Barnet, London";
    await getWeather(request());
    expect(loadCurrentWeather).toHaveBeenNthCalledWith(1, "Enfield, London");
    expect(loadCurrentWeather).toHaveBeenNthCalledWith(2, "Barnet, London");
  });

  it("renders Enfield and stale state in the screensaver panel", () => {
    const html = renderToStaticMarkup(<ScreensaverWeatherContent weather={{ ...weather, stale: true }}/>);
    expect(html).toContain("Enfield");
    expect(html).toContain("21");
    expect(html).toContain("Cached");
  });
});
