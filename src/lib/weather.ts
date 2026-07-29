import { z } from "zod";

const geocodingResponse = z.object({
  results: z.array(z.object({
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    admin1: z.string().optional(),
  })).optional(),
});

const forecastResponse = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    weather_code: z.number().int(),
    is_day: z.number().int(),
  }),
});

export type CurrentWeather = {
  location: string;
  temperature: number;
  feelsLike: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
  updatedAt: string;
};

export class WeatherLocationError extends Error {
  constructor(message: "location-missing" | "geocoding-not-found") {
    super(message);
    this.name = "WeatherLocationError";
  }
}

export class WeatherUpstreamError extends Error {
  constructor(message: "upstream-timeout" | "upstream-unavailable") {
    super(message);
    this.name = "WeatherUpstreamError";
  }
}
export function weatherCondition(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}

export async function loadCurrentWeather(location: string, fetcher: typeof fetch = fetch): Promise<CurrentWeather> {
  if (!location.trim()) throw new WeatherLocationError("location-missing");
  const query = new URLSearchParams({ name: location, count: "1", language: "en", format: "json", countryCode: "GB" });
  let geocoding: Response;
  try {
    geocoding = await fetcher(`https://geocoding-api.open-meteo.com/v1/search?${query}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw new WeatherUpstreamError(error instanceof DOMException && error.name === "TimeoutError" ? "upstream-timeout" : "upstream-unavailable");
  }
  if (!geocoding.ok) throw new WeatherUpstreamError("upstream-unavailable");
  const place = geocodingResponse.parse(await geocoding.json()).results?.[0];
  if (!place) throw new WeatherLocationError("geocoding-not-found");

  const forecastQuery = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: "temperature_2m,apparent_temperature,weather_code,is_day",
    timezone: "Europe/London",
  });
  let forecast: Response;
  try {
    forecast = await fetcher(`https://api.open-meteo.com/v1/forecast?${forecastQuery}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw new WeatherUpstreamError(error instanceof DOMException && error.name === "TimeoutError" ? "upstream-timeout" : "upstream-unavailable");
  }
  if (!forecast.ok) throw new WeatherUpstreamError("upstream-unavailable");
  const current = forecastResponse.parse(await forecast.json()).current;
  return {
    location: place.name,
    temperature: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    weatherCode: current.weather_code,
    condition: weatherCondition(current.weather_code),
    isDay: current.is_day === 1,
    updatedAt: current.time,
  };
}
