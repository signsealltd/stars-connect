import { describe, expect, it, vi } from "vitest";
import { loadCurrentWeather, weatherCondition } from "./weather";

describe("screensaver weather", () => {
  it("maps representative WMO weather codes", () => {
    expect(weatherCondition(0)).toBe("Clear");
    expect(weatherCondition(3)).toBe("Partly cloudy");
    expect(weatherCondition(63)).toBe("Rain");
    expect(weatherCondition(75)).toBe("Snow");
    expect(weatherCondition(95)).toBe("Thunderstorm");
  });

  it("geocodes the configured UK location and returns current weather", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ name: "Enfield", latitude: 51.6521, longitude: -0.0815, admin1: "England" }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        current: {
          time: "2026-07-29T14:00",
          temperature_2m: 21.4,
          apparent_temperature: 20.6,
          weather_code: 2,
          is_day: 1,
        },
      })));

    const result = await loadCurrentWeather("Enfield, London", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).toContain("countryCode=GB");
    expect(String(fetcher.mock.calls[1][0])).toContain("timezone=Europe%2FLondon");
    expect(result).toEqual({
      location: "Enfield",
      temperature: 21,
      feelsLike: 21,
      weatherCode: 2,
      condition: "Partly cloudy",
      isDay: true,
      updatedAt: "2026-07-29T14:00",
    });
  });

  it("fails safely when the configured location is not found", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] })));
    await expect(loadCurrentWeather("Invalid synthetic location", fetcher)).rejects.toThrow("WEATHER_LOCATION_NOT_FOUND");
  });
});
